const DEFAULT_FURNITURE = [
  // Core furniture — cozy bedroom essentials
  { id: 'bed-1', type: 'bed', variant: 'double-wood', x: 8, y: 46, renderWidth: 100, renderHeight: 100, interactive: false },
  { id: 'window-1', type: 'window', variant: 'default', x: 56, y: 0, renderWidth: 72, renderHeight: 58, interactive: false },
  { id: 'nightstand-1', type: 'nightstand', variant: 'wooden', x: 112, y: 86, renderWidth: 30, renderHeight: 50, interactive: false },
  { id: 'tv-1', type: 'tv', variant: 'crt', x: 240, y: 100, renderWidth: 52, renderHeight: 48, interactive: true, interaction: 'activity' },
  { id: 'desk-1', type: 'desk', variant: 'wooden', x: 8, y: 190, renderWidth: 68, renderHeight: 58, interactive: true, interaction: 'chat' },
  { id: 'rug-1', type: 'rug', variant: 'round', x: 110, y: 220, renderWidth: 100, renderHeight: 50, interactive: false },
  { id: 'bookshelf-1', type: 'bookshelf', variant: 'default', x: 270, y: 160, renderWidth: 44, renderHeight: 52, interactive: false },

  // Wall decorations
  { id: 'calendar-1', type: 'calendar', variant: 'default', x: 170, y: 8, renderWidth: 34, renderHeight: 38, interactive: true, interaction: 'dates' },
  { id: 'poster-1', type: 'poster', variant: 'default', x: 220, y: 4, renderWidth: 26, renderHeight: 32, interactive: false },

  // A few cozy touches — not too many
  { id: 'plant-1', type: 'plant', variant: 'potted', x: 2, y: 155, renderWidth: 22, renderHeight: 30, interactive: false },
  { id: 'flowers-1', type: 'flowers', variant: 'vase', x: 82, y: 182, renderWidth: 18, renderHeight: 28, interactive: false },
  { id: 'pet-bed-1', type: 'misc', variant: 'pet_bed', x: 255, y: 60, renderWidth: 40, renderHeight: 28, interactive: false },

  // Interactive
  { id: 'makeup-1', type: 'makeup_stand', variant: 'default', x: 148, y: 100, renderWidth: 44, renderHeight: 50, interactive: true, interaction: 'makeup' },
];

export class RoomState {
  static ESSENTIAL_TYPES = ['bed', 'tv', 'desk', 'calendar', 'makeup_stand'];
  static MAX_FURNITURE = 30;

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

  addFurniture(item) {
    if (this.furniture.length >= RoomState.MAX_FURNITURE) {
      return false;
    }
    this.furniture.push(item);
    this.isDirty = true;
    return true;
  }

  removeFurniture(furnitureId) {
    const item = this.furniture.find(f => f.id === furnitureId);
    if (!item) return false;
    if (RoomState.ESSENTIAL_TYPES.includes(item.type)) return false;
    this.furniture = this.furniture.filter(f => f.id !== furnitureId);
    this.isDirty = true;
    return true;
  }

  isEssential(furnitureId) {
    const item = this.furniture.find(f => f.id === furnitureId);
    return item ? RoomState.ESSENTIAL_TYPES.includes(item.type) : false;
  }

  getFurnitureById(furnitureId) {
    return this.furniture.find(f => f.id === furnitureId) || null;
  }
}
