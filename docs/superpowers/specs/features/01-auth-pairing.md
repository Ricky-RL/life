# Feature 01: Authentication & Pairing

## Summary
Google OAuth login via Supabase Auth, followed by a 6-digit pair code system to link two users as a couple. This is the foundation — every other feature depends on a valid pair existing.

---

## User Flows

### First-Time Login
1. User clicks extension icon → popup shows a welcome screen with the Rhinosaurus Connect logo (pixel art rhinoceros)
2. "Sign in with Google" button
3. Chrome identity API triggers Google OAuth → Supabase creates/signs in user
4. After auth, check if user has an existing pair:
   - **No pair** → show pairing screen
   - **Has pair** → go straight to the bedroom

### Pairing Flow
1. Pairing screen shows two options:
   - **"Generate Code"** → creates a 6-digit alphanumeric code, displays it large on screen with a copy button. Code expires in 10 minutes. User tells their partner the code (text, call, etc.)
   - **"Enter Code"** → text input for the 6-digit code. On submit, validates the code, creates the pair, and both users are redirected to the bedroom setup
2. When pair is created:
   - Insert row into `pairs` table
   - Insert default room state into `room_state` table
   - Delete the used pair code
   - Both users' popups transition to the bedroom

### Returning Login
1. User clicks extension icon
2. Service worker checks stored auth token → auto-login if valid
3. Check pair status → load bedroom

### Unpairing
1. Settings → "Unpair" button
2. Confirmation modal: "Are you sure? This will delete your shared room, chat history, and tracked dates."
3. On confirm:
   - Delete pair record (cascades to messages, room_state, tracked_dates)
   - Both users return to the pairing screen
   - Individual user records and avatar configs are preserved

---

## Technical Implementation

### Supabase Auth Setup
```
Provider: Google
Redirect URL: https://<extension-id>.chromiumapp.org/
```

### Chrome Identity Integration
```js
// In service worker or popup
const token = await chrome.identity.getAuthToken({ interactive: true });
// Exchange token with Supabase
const { data, error } = await supabase.auth.signInWithIdToken({
  provider: 'google',
  token: token
});
```

### Pair Code Generation
- 6 characters, alphanumeric, uppercase (e.g., "A3X9K2")
- Avoid ambiguous characters: 0/O, 1/I/L
- Stored in `pair_codes` table with 10-minute expiry
- Expired codes cleaned up via Supabase scheduled cron job (pg_cron) running every 10 minutes: `DELETE FROM pair_codes WHERE expires_at < now()`

### Pair Code Validation
```js
// 1. Look up code
const { data: codeRecord } = await supabase
  .from('pair_codes')
  .select('*')
  .eq('code', inputCode)
  .gt('expires_at', new Date().toISOString())
  .single();

// 2. Validate: creator and redeemer must be different users
if (codeRecord.user_id === currentUser.id) {
  throw new Error("You can't pair with yourself");
}

// 3. Create pair
const { data: pair } = await supabase
  .from('pairs')
  .insert({
    user_a: codeRecord.user_id,
    user_b: currentUser.id
  });

// 3. Create default room
await supabase
  .from('room_state')
  .insert({
    pair_id: pair.id,
    furniture: DEFAULT_FURNITURE,
    avatar_positions: DEFAULT_POSITIONS
  });

// 4. Delete used code
await supabase.from('pair_codes').delete().eq('code', inputCode);
```

### Session Persistence
- Store Supabase session in `chrome.storage.local`
- Service worker restores session on startup
- Refresh token automatically via Supabase client

---

## Database Tables Used
- `users` (create on first login)
- `pair_codes` (temporary, during pairing)
- `pairs` (created on successful pairing)
- `room_state` (default created with pair)

## Realtime Channels Used
- None during auth/pairing — realtime subscriptions start after pair is established

---

## Edge Cases
- **Code expired**: show "Code expired, please generate a new one"
- **Code already used**: show "Invalid code"
- **User already paired**: skip pairing screen, go to bedroom
- **Partner unpairs while other is online**: other user gets kicked to pairing screen with a message "Your partner has unlinked your accounts"
- **Google account changed**: Supabase handles this — different Google account = different user
- **Service worker restart**: session restored from chrome.storage.local

---

## UI Screens
1. **Welcome/Login screen**: Rhinosaurus Connect logo, "Sign in with Google" button, warm pixel art background
2. **Pairing screen**: two big buttons ("Generate Code" / "Enter Code"), simple and clear
3. **Code display**: large 6-digit code with copy button, countdown timer showing expiry
4. **Code entry**: text input with large characters, "Connect" button
5. **Unpair confirmation**: modal with warning text, "Cancel" and "Unpair" buttons
