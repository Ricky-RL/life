# Feature 05: Messaging & Notifications

## Summary
Text and image messaging between partners, with a chat overlay in the popup and corner popup notifications when browsing. Messages are persisted, support offline queuing, and are displayed with avatar speech bubbles.

---

## Chat Overlay

### Opening Chat
- Click the desk/phone in the room OR the chat button in the toolbar
- Opens as an overlay on top of the room canvas (not a separate page)
- Overlay covers ~80% of the popup, room is dimmed behind it
- Close button (X) or click outside to dismiss

### Chat UI Layout
```
┌──────────────────────────────────┐
│  [← Back]    Chat    [📷 Image] │  ← Header
│──────────────────────────────────│
│                                  │
│  [Her avatar] miss you 🥺       │  ← Their message (left)
│                          2:34pm  │
│                                  │
│         miss you more ❤️ [You]   │  ← Your message (right)
│  2:35pm                          │
│                                  │
│  [Her avatar] look what i found  │
│  [image thumbnail]               │
│                          2:36pm  │
│                                  │
│──────────────────────────────────│
│  [Type a message...    ] [Send]  │  ← Input bar
│  [❤️] [💋] [📷]                 │  ← Quick actions
└──────────────────────────────────┘
```

### Message Display
- Messages grouped by sender, with small avatar icon (24x24, static idle frame)
- Your messages: right-aligned, colored background (e.g., soft pink)
- Their messages: left-aligned, neutral background
- Timestamps shown below each message group
- Images displayed inline as thumbnails (click to expand)
- Heart/kiss reactions shown as emoji with matching avatar animation icon

### Message Types
| Type | Content | Display |
|------|---------|---------|
| `text` | String, max 500 chars | Text in bubble |
| `image` | Supabase Storage path | Thumbnail inline, click to full size |
| `heart` | None (type conveys meaning) | ❤️ emoji with heart animation indicator |
| `kiss` | None | 💋 emoji with kiss animation indicator |

---

## Sending Messages

### Text Messages
1. User types in input field, hits Enter or Send button
2. Insert into `messages` table: `{ pair_id, sender_id, type: 'text', content: 'message text' }`
3. Broadcast via Realtime for instant delivery
4. Sender's avatar in the room plays `speaking` animation with speech bubble
5. If partner is online in popup: their chat updates, phone desk glows
6. If partner is browsing: corner popup notification with avatar + speech bubble
7. If partner is offline: message stored in DB, delivered on next login

### Image Messages
1. User clicks 📷 button → file picker opens (accept: image/*)
2. Image compressed client-side (max 1MB, max 1200px on longest side)
3. Upload to Supabase Storage bucket `message-images` with path: `{pair_id}/{message_id}.{ext}`
4. Insert into `messages` table: `{ pair_id, sender_id, type: 'image', content: 'storage-path' }`
5. Broadcast via Realtime
6. Recipient loads image from Storage and displays thumbnail

### Image Compression
```js
async function compressImage(file, maxSize = 1200, quality = 0.8) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(bitmap.width * scale, bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.convertToBlob({ type: 'image/jpeg', quality });
}
```

---

## Notifications

### In-Popup Notifications (Phone Glow)
When the popup is open and a new message arrives:
- The desk/phone object glows with a pulsing animation
- A small badge number appears on the phone (unread count)
- User must click the phone to open chat and see the message
- Sender's avatar does NOT auto-show speech bubble in room for regular messages (only for hearts/kisses)
- On opening chat, messages are marked as read

### Corner Popup Notifications (Content Script)
When the user is browsing other tabs (popup is closed):
- Content script injects a corner popup in the bottom-right of the current page
- Shows sender's avatar (rendered from sprite sheet) at 2x scale
- Speech bubble next to avatar with message preview:
  - Text: first 80 characters
  - Image: "Sent you a photo 📷"
  - Heart: ❤️ (avatar plays heart_eyes)
  - Kiss: 💋 (avatar plays kiss_face)
- Popup slides in from right, stays 5 seconds, slides out
- Click popup → opens the extension popup (chat overlay)

### Corner Popup Implementation
**Security: NEVER use innerHTML for user content. Use DOM API to prevent XSS.**

```js
// content/corner-popup.js
function showCornerPopup(avatarData, message) {
  const container = document.createElement('div');
  container.id = 'rhinosaurus-notification';

  const inner = document.createElement('div');
  inner.className = 'rhino-notif-container';

  const canvas = document.createElement('canvas');
  canvas.className = 'rhino-avatar';
  canvas.width = 64;
  canvas.height = 96;

  const bubble = document.createElement('div');
  bubble.className = 'rhino-speech-bubble';

  const msgSpan = document.createElement('span');
  msgSpan.className = 'rhino-message';
  msgSpan.textContent = message.preview; // textContent auto-escapes

  bubble.appendChild(msgSpan);
  inner.appendChild(canvas);
  inner.appendChild(bubble);
  container.appendChild(inner);
  document.body.appendChild(container);

  // Render avatar on the mini canvas
  renderAvatarOnCanvas(canvas, avatarData, message.animation);

  // Animate in
  requestAnimationFrame(() => container.classList.add('rhino-visible'));

  // Remove after 5 seconds
  setTimeout(() => {
    container.classList.remove('rhino-visible');
    setTimeout(() => container.remove(), 500);
  }, 5000);
}
```

### Chrome Native Notifications
Fired as a backup when:
- Chrome is minimized
- The active tab doesn't have the content script (chrome:// pages, etc.)

```js
// background/notification-manager.js
chrome.notifications.create(messageId, {
  type: 'basic',
  iconUrl: avatarIconUrl, // 48x48 static avatar image
  title: senderName,
  message: messagePreview,
  priority: 2
});
```

Click → opens extension popup.

---

## Message Queue (Offline Delivery)

### How It Works
- All messages are persisted to the `messages` table regardless of partner's online status
- When partner comes online (popup opens):
  1. Query unread messages: `SELECT * FROM messages WHERE pair_id = ? AND sender_id != ? AND is_read = false ORDER BY created_at ASC`
  2. If there are queued messages:
     - Show a special notification: partner's avatar plays `waving` with speech bubble: "You missed X messages!"
     - Hearts/kisses batched: "She sent you 3 ❤️ and 1 💋 while you were away" with a burst animation
  3. All queued messages appear in chat with their original timestamps
  4. Mark messages as read after user opens chat

### Read Receipts
- Messages marked as `is_read = true` when the chat overlay is opened and scrolled to show them
- No "seen" indicator shown to sender (keep it low-pressure)

---

## Database
- `messages` table: `id, pair_id, sender_id, type, content, is_read, created_at`
- `message-images` storage bucket

## Realtime
- Subscribe to inserts on `messages` table filtered by `pair_id`
- Broadcast on `pair:{pair_id}:events`:
  - `{ type: 'typing', user_id }` — for typing indicator

---

## Edge Cases
- **Very long message**: truncated in corner popup (80 chars), full text in chat
- **Large image**: compressed before upload, max 1MB
- **Rapid messages**: corner popups queue, showing one at a time with 1s gap
- **Content script blocked** (some pages block injection): fall back to Chrome native notification
- **Storage quota**: Supabase free tier has 1GB storage. Monitor usage, implement cleanup for old images (>90 days) if needed.
- **Message ordering**: use `created_at` timestamp from server (not client) for consistent ordering
