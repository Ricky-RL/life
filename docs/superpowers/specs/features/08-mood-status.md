# Feature 08: Mood Status

## Summary
Each partner can set a mood that displays as a small bubble above their avatar in the shared room. Mood updates are visible in real-time. Simple, expressive, and always visible.

---

## Mood Options

| Mood | Emoji | Display Text |
|------|-------|-------------|
| Happy | 😊 | happy |
| Sad | 😢 | sad |
| Missing You | 🥺 | missing you |
| Stressed | 😩 | stressed |
| Sleepy | 😴 | sleepy |
| Excited | 🤩 | excited |
| Cozy | 🥰 | cozy |
| *(none)* | — | *(no mood bubble shown)* |

---

## User Flow

### Setting Mood
1. Click mood button in bottom toolbar (shows current mood emoji, or neutral face if none)
2. Dropdown appears above the toolbar with mood options as a grid of emoji buttons
3. Click an emoji → mood is set immediately
4. Click the same emoji again → mood is cleared
5. Dropdown closes

### Display
- Small pixel art speech bubble above avatar containing the emoji
- Bubble is always visible (doesn't fade like message bubbles)
- Positioned above the avatar's head, slightly offset
- When mood changes: brief sparkle animation, old bubble fades out, new one fades in

### Partner Sees It
- Mood update broadcast via Realtime → partner's room updates instantly
- Partner's avatar mood bubble updates in real-time
- No notification for mood changes — it's passive, not intrusive

---

## Technical Implementation

### Setting Mood
```js
async function setMood(mood) {
  // Update local state
  currentUser.mood = mood;

  // Update database
  await supabase
    .from('users')
    .update({ mood })
    .eq('id', currentUser.id);

  // Broadcast
  await channel.send({
    type: 'broadcast',
    event: 'mood_update',
    payload: { user_id: currentUser.id, mood }
  });
}
```

### Rendering Mood Bubble
```js
function drawMoodBubble(ctx, avatarX, avatarY, mood) {
  if (!mood) return;

  const emoji = MOOD_EMOJIS[mood];
  const bubbleX = avatarX + 10;
  const bubbleY = avatarY - 20;

  // Draw pixel art bubble background
  drawPixelBubble(ctx, bubbleX, bubbleY, 20, 16);

  // Draw emoji text
  ctx.font = '12px sans-serif';
  ctx.fillText(emoji, bubbleX + 4, bubbleY + 12);
}
```

Note: emoji rendering on canvas is inconsistent across platforms. **Use pre-rendered pixel art sprites for each mood emoji** to maintain Stardew Valley visual consistency. Each mood gets a small 16x16 pixel art icon rendered from a sprite sheet, not a system emoji.

### Dropdown Dismiss Behavior
- Click outside the dropdown → closes without changing mood
- Press Escape → closes without changing mood
- Click a mood option → sets mood and closes
- Click the mood button again → toggles dropdown closed

---

## Database
- `users.mood`: `text`, nullable. One of: `'happy'`, `'sad'`, `'missing_you'`, `'stressed'`, `'sleepy'`, `'excited'`, `'cozy'`, or `null`

## Realtime
- Broadcast on `pair:{pair_id}:events`:
  - `{ type: 'mood_update', user_id, mood }`
- Also part of presence state so mood is visible on initial popup load

---

## Edge Cases
- **User goes offline with mood set**: mood persists in database. When partner opens popup and sees the sleeping avatar, the mood bubble is still shown (e.g., sleeping avatar with "stressed" bubble — relatable).
- **Mood cleared**: send `mood: null`, bubble disappears.
- **Rapid mood changes**: no throttle needed — these are intentional user actions and the DB write is a simple update.
