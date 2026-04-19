export class TVOverlay {
  constructor(container, tvDisplay, onJoinWatch, onToggleTracking) {
    this.container = container;
    this.tvDisplay = tvDisplay;
    this.onJoinWatch = onJoinWatch;
    this.onToggleTracking = onToggleTracking;
    this.element = null;
  }

  show() {
    this.hide();

    this.element = document.createElement('div');
    this.element.className = 'tv-overlay';

    const header = document.createElement('div');
    header.className = 'tv-overlay-header';

    const backBtn = document.createElement('button');
    backBtn.className = 'tv-overlay-back';
    backBtn.textContent = '\u2190 Back';
    backBtn.addEventListener('click', () => this.hide());

    const title = document.createElement('span');
    title.textContent = 'Activity';

    header.appendChild(backBtn);
    header.appendChild(title);
    this.element.appendChild(header);

    const state = this.tvDisplay.getDisplayState();
    const activity = this.tvDisplay.partnerState.activity;

    if (activity) {
      const activitySection = document.createElement('div');
      activitySection.className = 'tv-overlay-activity';

      const siteName = document.createElement('div');
      siteName.className = 'tv-overlay-site';
      siteName.textContent = activity.site || 'Unknown';

      const pageTitle = document.createElement('div');
      pageTitle.className = 'tv-overlay-title';
      pageTitle.textContent = activity.title || '';

      activitySection.appendChild(siteName);
      activitySection.appendChild(pageTitle);
      this.element.appendChild(activitySection);
    }

    if (state === 'youtube') {
      const joinBtn = document.createElement('button');
      joinBtn.className = 'tv-overlay-join';
      joinBtn.textContent = 'Join & Watch Together';
      joinBtn.addEventListener('click', () => {
        if (this.onJoinWatch) this.onJoinWatch();
        this.hide();
      });
      this.element.appendChild(joinBtn);
    }

    if (this.tvDisplay.history.length > 0) {
      const historySection = document.createElement('div');
      historySection.className = 'tv-overlay-history';

      const historyTitle = document.createElement('div');
      historyTitle.className = 'tv-overlay-history-title';
      historyTitle.textContent = 'Recent Activity';
      historySection.appendChild(historyTitle);

      for (const entry of this.tvDisplay.history) {
        const item = document.createElement('div');
        item.className = 'tv-overlay-history-item';

        const name = document.createElement('span');
        name.textContent = entry.site;

        const time = document.createElement('span');
        time.className = 'tv-overlay-time';
        const mins = Math.floor((Date.now() - entry.timestamp) / 60000);
        time.textContent = mins < 1 ? 'just now' : `${mins}m ago`;

        item.appendChild(name);
        item.appendChild(time);
        historySection.appendChild(item);
      }

      this.element.appendChild(historySection);
    }

    this.container.innerHTML = '';
    this.container.appendChild(this.element);
    this.container.classList.remove('hidden');
  }

  hide() {
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
    this.container.classList.add('hidden');
  }
}
