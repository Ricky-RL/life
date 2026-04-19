const DEFAULT_FURNITURE = [
  { id: 'bed-1', type: 'bed', variant: 'double-wood', color: '#FF6B9D', x: 40, y: 80, interactive: false },
  { id: 'tv-1', type: 'tv', variant: 'crt', color: null, x: 240, y: 180, interactive: true, interaction: 'activity' },
  { id: 'desk-1', type: 'desk', variant: 'wooden', color: null, x: 40, y: 220, interactive: true, interaction: 'chat' },
  { id: 'calendar-1', type: 'calendar', variant: 'default', color: null, x: 270, y: 30, interactive: true, interaction: 'dates' },
  { id: 'makeup-1', type: 'makeup_stand', variant: 'default', color: null, x: 240, y: 80, interactive: true, interaction: 'makeup' },
  { id: 'window-1', type: 'window', variant: 'default', color: '#E8D5E0', x: 80, y: 20, interactive: false },
  { id: 'rug-1', type: 'rug', variant: 'round', color: '#D4A5C9', x: 130, y: 160, interactive: false },
  { id: 'nightstand-1', type: 'nightstand', variant: 'wooden', color: null, x: 10, y: 130, interactive: false },
  { id: 'nightstand-2', type: 'nightstand', variant: 'wooden', color: null, x: 180, y: 130, interactive: false },
];

export class RoomState {
  constructor() {
    this.furniture = DEFAULT_FURNITURE.map(f => ({ ...f }));
    this.avatarPositions = {};
    this.theme = 'default';
    this.version = 0;
    this.isDirty = false;
  }

  loadFromDb(record) {
    this.furniture = record.furniture || [];
    this.avatarPositions = record.avatar_positions || {};
    this.theme = record.theme || 'default';
    this.version = record.version || 0;
    this.isDirty = false;
  }

  updateFurniture(furnitureId, changes) {
    const item = this.furniture.find(f => f.id === furnitureId);
    if (!item) return false;
    Object.assign(item, changes);
    this.isDirty = true;
    return true;
  }

  setAvatarPosition(userId, x, y) {
    this.avatarPositions[userId] = { x, y };
    this.isDirty = true;
  }

  toDbRecord() {
    return {
      furniture: this.furniture,
      avatar_positions: this.avatarPositions,
      theme: this.theme,
      version: this.version + 1,
    };
  }

  markClean() {
    this.isDirty = false;
  }
}
