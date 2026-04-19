// rhinosaurus-connect/popup/calendar/calendar-overlay.js
import { formatDateDistance, getDaysDifference } from '../../shared/date-utils.js';

export class CalendarOverlay {
  constructor(container, dateService, anniversaryDate) {
    this.container = container;
    this.service = dateService;
    this.anniversaryDate = anniversaryDate;
    this.isOpen = false;
    this.dates = [];
    this.onClose = null;
    this.editingId = null;
  }

  render() {
    this.container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'calendar-header';
    const backBtn = document.createElement('button');
    backBtn.className = 'calendar-back-btn';
    backBtn.textContent = '← Back';
    backBtn.addEventListener('click', () => this.close());
    const title = document.createElement('span');
    title.textContent = 'Calendar';
    header.appendChild(backBtn);
    header.appendChild(title);

    const anniversary = document.createElement('div');
    anniversary.className = 'calendar-anniversary';
    const days = this.service.getAnniversaryDays(this.anniversaryDate);
    if (days !== null) {
      anniversary.textContent = `❤️ Day ${days} Together ❤️`;
    } else {
      anniversary.textContent = 'Set your anniversary!';
    }

    const datesContainer = document.createElement('div');
    datesContainer.className = 'calendar-dates';

    const addBtn = document.createElement('button');
    addBtn.className = 'calendar-add-btn';
    addBtn.textContent = '+ Add Date';
    addBtn.addEventListener('click', () => this.showAddForm());

    this.container.appendChild(header);
    this.container.appendChild(anniversary);
    this.container.appendChild(datesContainer);
    this.container.appendChild(addBtn);
  }

  async open() {
    this.render();
    this.isOpen = true;
    this.container.classList.remove('hidden');
    this.dates = await this.service.fetchDates();
    this.renderDates();
  }

  close() {
    this.isOpen = false;
    this.container.classList.add('hidden');
    if (this.onClose) this.onClose();
  }

  renderDates() {
    const datesContainer = this.container.querySelector('.calendar-dates');
    if (!datesContainer) return;
    datesContainer.innerHTML = '';

    const { upcoming, past } = this.service.sortDates(this.dates);

    if (upcoming.length > 0) {
      const section = document.createElement('div');
      section.className = 'calendar-section';
      const heading = document.createElement('h3');
      heading.textContent = 'Upcoming';
      section.appendChild(heading);
      for (const d of upcoming) {
        section.appendChild(this.createDateRow(d, formatDateDistance(d.days)));
      }
      datesContainer.appendChild(section);
    }

    if (past.length > 0) {
      const section = document.createElement('div');
      section.className = 'calendar-section';
      const heading = document.createElement('h3');
      heading.textContent = 'Memories';
      section.appendChild(heading);
      for (const d of past) {
        section.appendChild(this.createDateRow(d, formatDateDistance(d.days)));
      }
      datesContainer.appendChild(section);
    }
  }

  createDateRow(dateEntry, distanceText) {
    const row = document.createElement('div');
    row.className = 'calendar-date-row';
    row.addEventListener('click', () => this.showEditForm(dateEntry));

    const label = document.createElement('span');
    label.className = 'calendar-date-label';
    label.textContent = dateEntry.label;

    const distance = document.createElement('span');
    distance.className = 'calendar-date-distance';
    distance.textContent = distanceText;

    row.appendChild(label);
    row.appendChild(distance);
    return row;
  }

  showAddForm() {
    this.editingId = null;
    this.renderForm('', '', true, false);
  }

  showEditForm(dateEntry) {
    this.editingId = dateEntry.id;
    this.renderForm(dateEntry.label, dateEntry.date, dateEntry.is_countdown, dateEntry.is_recurring);
  }

  renderForm(label, date, isCountdown, isRecurring) {
    const existing = this.container.querySelector('.calendar-form');
    if (existing) existing.remove();

    const form = document.createElement('div');
    form.className = 'calendar-form';

    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.className = 'calendar-label-input';
    labelInput.placeholder = 'Label (e.g., "Next Visit")';
    labelInput.value = label;

    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'calendar-date-input';
    dateInput.value = date;

    const recurringLabel = document.createElement('label');
    const recurringCheck = document.createElement('input');
    recurringCheck.type = 'checkbox';
    recurringCheck.className = 'calendar-recurring-input';
    recurringCheck.checked = isRecurring;
    recurringLabel.appendChild(recurringCheck);
    recurringLabel.appendChild(document.createTextNode(' Recurring yearly'));

    const saveBtn = document.createElement('button');
    saveBtn.className = 'calendar-save-btn';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => this.handleSave());

    form.appendChild(labelInput);
    form.appendChild(dateInput);
    form.appendChild(recurringLabel);
    form.appendChild(saveBtn);

    if (this.editingId) {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'calendar-delete-btn';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => this.handleDelete());
      form.appendChild(deleteBtn);
    }

    this.container.appendChild(form);
  }

  async handleSave() {
    const label = this.container.querySelector('.calendar-label-input')?.value.trim();
    const date = this.container.querySelector('.calendar-date-input')?.value;
    const isRecurring = this.container.querySelector('.calendar-recurring-input')?.checked || false;

    if (!label || !date) return;

    const isCountdown = getDaysDifference(date) >= 0;

    if (this.editingId) {
      await this.service.updateDate(this.editingId, { label, date, is_countdown: isCountdown, is_recurring: isRecurring });
    } else {
      await this.service.addDate(label, date, isCountdown, isRecurring);
    }

    this.dates = await this.service.fetchDates();
    this.renderDates();
    const form = this.container.querySelector('.calendar-form');
    if (form) form.remove();
  }

  async handleDelete() {
    if (!this.editingId) return;
    await this.service.deleteDate(this.editingId);
    this.dates = await this.service.fetchDates();
    this.renderDates();
    const form = this.container.querySelector('.calendar-form');
    if (form) form.remove();
  }
}
