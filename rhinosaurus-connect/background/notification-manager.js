export class NotificationManager {
  async notify(messageData) {
    const { senderName, animation } = messageData;
    const preview = messageData.preview !== undefined ? messageData.preview : this.formatPreview(messageData);
    const ok = await this.tryContentScriptNotification({ preview, animation: animation || 'speaking' });
    if (!ok) this.showChromeNotification(senderName, preview);
  }

  async tryContentScriptNotification(data) {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (
        !activeTab ||
        !activeTab.url ||
        activeTab.url.startsWith('chrome://') ||
        activeTab.url.startsWith('chrome-extension://')
      ) {
        return false;
      }
      await chrome.tabs.sendMessage(activeTab.id, { type: 'SHOW_NOTIFICATION', data });
      return true;
    } catch {
      return false;
    }
  }

  showChromeNotification(senderName, preview) {
    chrome.notifications.create(`rhino-${Date.now()}`, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('assets/icons/icon-48.png'),
      title: senderName || 'Rhinosaurus Connect',
      message: preview,
      priority: 2,
    });
  }

  formatPreview(messageData) {
    const { type, content } = messageData;
    switch (type) {
      case 'heart':
        return '❤️';
      case 'kiss':
        return '💋';
      case 'image':
        return 'Sent you a photo 📷';
      default:
        if (!content) return '';
        return content.length <= 80 ? content : content.substring(0, 80) + '...';
    }
  }
}
