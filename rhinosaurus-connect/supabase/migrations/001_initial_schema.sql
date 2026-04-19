-- Rhinosaurus Connect: Initial Database Schema
-- Run this in Supabase SQL Editor or via supabase db push

-- ============================================================
-- TABLES
-- ============================================================

-- Users
create table if not exists public.users (
  id uuid primary key references auth.users(id),
  display_name text not null,
  avatar_config jsonb not null default '{}',
  mood text check (mood in ('happy', 'sad', 'missing_you', 'stressed', 'sleepy', 'excited', 'cozy')) default null,
  is_online boolean default false,
  last_seen_at timestamptz default now(),
  tracking_enabled boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Pairs (LEAST/GREATEST canonical ordering prevents duplicate A/B vs B/A)
create table if not exists public.pairs (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.users(id),
  user_b uuid not null references public.users(id),
  anniversary_date date default null,
  created_at timestamptz default now(),
  check (user_a < user_b),
  unique(user_a, user_b)
);

-- Pair Codes (temporary, for pairing flow)
create table if not exists public.pair_codes (
  code text primary key,
  user_id uuid not null references public.users(id),
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- Messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.pairs(id) on delete cascade,
  sender_id uuid not null references public.users(id),
  type text not null check (type in ('text', 'image', 'heart', 'kiss')),
  content text default null,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- Room State
create table if not exists public.room_state (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.pairs(id) on delete cascade unique,
  furniture jsonb not null default '[]',
  avatar_positions jsonb not null default '{}',
  theme text default 'default',
  version integer not null default 0,
  updated_at timestamptz default now()
);

-- Tracked Dates
create table if not exists public.tracked_dates (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.pairs(id) on delete cascade,
  label text not null,
  date date not null,
  is_countdown boolean default false,
  is_recurring boolean default false,
  created_by uuid not null references public.users(id),
  created_at timestamptz default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_messages_pair_id on public.messages(pair_id);
create index if not exists idx_messages_pair_unread on public.messages(pair_id, is_read) where is_read = false;
create index if not exists idx_tracked_dates_pair_id on public.tracked_dates(pair_id);
create index if not exists idx_pair_codes_expires on public.pair_codes(expires_at);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.users enable row level security;
alter table public.pairs enable row level security;
alter table public.pair_codes enable row level security;
alter table public.messages enable row level security;
alter table public.room_state enable row level security;
alter table public.tracked_dates enable row level security;

-- Users: read/write own record, read partner's record
create policy "users_select_own" on public.users for select
  using (auth.uid() = id);
create policy "users_select_partner" on public.users for select
  using (
    id in (
      select user_a from public.pairs where user_b = auth.uid()
      union
      select user_b from public.pairs where user_a = auth.uid()
    )
  );
create policy "users_update_own" on public.users for update
  using (auth.uid() = id);
create policy "users_insert_own" on public.users for insert
  with check (auth.uid() = id);

-- Pairs: members can read their own pair
create policy "pairs_select_member" on public.pairs for select
  using (auth.uid() = user_a or auth.uid() = user_b);
create policy "pairs_delete_member" on public.pairs for delete
  using (auth.uid() = user_a or auth.uid() = user_b);

-- Pair Codes: anyone can read (for pairing), only creator can write/delete
create policy "pair_codes_select_all" on public.pair_codes for select
  using (true);
create policy "pair_codes_insert_own" on public.pair_codes for insert
  with check (auth.uid() = user_id);
create policy "pair_codes_delete_own" on public.pair_codes for delete
  using (auth.uid() = user_id);

-- Messages: pair members only
create policy "messages_select_pair" on public.messages for select
  using (pair_id in (select id from public.pairs where user_a = auth.uid() or user_b = auth.uid()));
create policy "messages_insert_pair" on public.messages for insert
  with check (
    pair_id in (select id from public.pairs where user_a = auth.uid() or user_b = auth.uid())
    and sender_id = auth.uid()
  );
create policy "messages_update_pair" on public.messages for update
  using (pair_id in (select id from public.pairs where user_a = auth.uid() or user_b = auth.uid()));

-- Room State: pair members only
create policy "room_state_select_pair" on public.room_state for select
  using (pair_id in (select id from public.pairs where user_a = auth.uid() or user_b = auth.uid()));
create policy "room_state_update_pair" on public.room_state for update
  using (pair_id in (select id from public.pairs where user_a = auth.uid() or user_b = auth.uid()));
create policy "room_state_insert_pair" on public.room_state for insert
  with check (pair_id in (select id from public.pairs where user_a = auth.uid() or user_b = auth.uid()));

-- Tracked Dates: pair members only
create policy "tracked_dates_select_pair" on public.tracked_dates for select
  using (pair_id in (select id from public.pairs where user_a = auth.uid() or user_b = auth.uid()));
create policy "tracked_dates_insert_pair" on public.tracked_dates for insert
  with check (
    pair_id in (select id from public.pairs where user_a = auth.uid() or user_b = auth.uid())
    and created_by = auth.uid()
  );
create policy "tracked_dates_update_pair" on public.tracked_dates for update
  using (pair_id in (select id from public.pairs where user_a = auth.uid() or user_b = auth.uid()));
create policy "tracked_dates_delete_pair" on public.tracked_dates for delete
  using (pair_id in (select id from public.pairs where user_a = auth.uid() or user_b = auth.uid()));

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Atomic pair code claiming (prevents race conditions)
create or replace function public.claim_pair_code(p_code text, p_user_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_code_record record;
  v_pair_id uuid;
  v_user_a uuid;
  v_user_b uuid;
begin
  -- Lock the code row to prevent concurrent claims
  select * into v_code_record
  from public.pair_codes
  where code = p_code
  for update;

  if v_code_record is null then
    raise exception 'Invalid code';
  end if;

  if v_code_record.expires_at < now() then
    delete from public.pair_codes where code = p_code;
    raise exception 'Code expired';
  end if;

  if v_code_record.user_id = p_user_id then
    raise exception 'Cannot pair with yourself';
  end if;

  -- Canonical ordering: smaller UUID first
  if v_code_record.user_id < p_user_id then
    v_user_a := v_code_record.user_id;
    v_user_b := p_user_id;
  else
    v_user_a := p_user_id;
    v_user_b := v_code_record.user_id;
  end if;

  -- Check if pair already exists
  select id into v_pair_id
  from public.pairs
  where user_a = v_user_a and user_b = v_user_b;

  if v_pair_id is not null then
    raise exception 'Already paired';
  end if;

  -- Create the pair
  insert into public.pairs (user_a, user_b)
  values (v_user_a, v_user_b)
  returning id into v_pair_id;

  -- Create default room state
  insert into public.room_state (pair_id, furniture, avatar_positions)
  values (
    v_pair_id,
    '[
      {"id":"bed-1","type":"bed","variant":"double-wood","color":"#FF6B9D","x":40,"y":80,"interactive":false},
      {"id":"tv-1","type":"tv","variant":"crt","color":null,"x":240,"y":180,"interactive":true,"interaction":"activity"},
      {"id":"desk-1","type":"desk","variant":"wooden","color":null,"x":40,"y":220,"interactive":true,"interaction":"chat"},
      {"id":"calendar-1","type":"calendar","variant":"default","color":null,"x":270,"y":30,"interactive":true,"interaction":"dates"},
      {"id":"makeup-1","type":"makeup_stand","variant":"default","color":null,"x":240,"y":80,"interactive":true,"interaction":"makeup"},
      {"id":"window-1","type":"window","variant":"default","color":"#E8D5E0","x":80,"y":20,"interactive":false},
      {"id":"rug-1","type":"rug","variant":"round","color":"#D4A5C9","x":130,"y":160,"interactive":false},
      {"id":"nightstand-1","type":"nightstand","variant":"wooden","color":null,"x":10,"y":130,"interactive":false},
      {"id":"nightstand-2","type":"nightstand","variant":"wooden","color":null,"x":180,"y":130,"interactive":false}
    ]'::jsonb,
    '{}'::jsonb
  );

  -- Delete the used code
  delete from public.pair_codes where code = p_code;

  return v_pair_id;
end;
$$;

-- Cleanup expired pair codes (run via pg_cron every 5 minutes)
-- Schedule in Supabase Dashboard > Database > Cron Jobs:
-- select cron.schedule('cleanup-pair-codes', '*/5 * * * *', $$delete from public.pair_codes where expires_at < now()$$);

-- ============================================================
-- STORAGE
-- ============================================================

-- Create storage bucket for message images (run in SQL editor)
-- insert into storage.buckets (id, name, public) values ('message-images', 'message-images', false);

-- Storage RLS policies
-- create policy "message_images_select" on storage.objects for select
--   using (bucket_id = 'message-images' and (storage.foldername(name))[1] in (
--     select id::text from public.pairs where user_a = auth.uid() or user_b = auth.uid()
--   ));
-- create policy "message_images_insert" on storage.objects for insert
--   with check (bucket_id = 'message-images' and (storage.foldername(name))[1] in (
--     select id::text from public.pairs where user_a = auth.uid() or user_b = auth.uid()
--   ));

-- ============================================================
-- REALTIME
-- ============================================================

-- Enable realtime for messages table (for new message notifications)
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.tracked_dates;
