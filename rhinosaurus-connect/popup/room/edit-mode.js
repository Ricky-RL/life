export class EditModeController {
  constructor(roomState, roomSync) {
    this.roomState = roomState;
    this.sync = roomSync;
    this.isEditMode = false;
    this.selectedId = null;
    this.isDragging = false;
    this.lastDragPos = null;
    this.onSelectionChange = null;
    this.onModeChange = null;
  }

  enter() {
    this.isEditMode = true;
    this.selectedId = null;
    if (this.onModeChange) this.onModeChange(true);
  }

  exit() {
    this.isEditMode = false;
    this.selectedId = null;
    this.isDragging = false;
    this.sync.scheduleSave(this.roomState.toDbRecord());
    if (this.onModeChange) this.onModeChange(false);
  }

  select(furnitureId) {
    if (this.selectedId === furnitureId) {
      this.selectedId = null;
    } else {
      this.selectedId = furnitureId;
    }
    if (this.onSelectionChange) this.onSelectionChange(this.selectedId);
  }

  startDrag(x, y) {
    if (!this.selectedId) return;
    this.isDragging = true;
    this.lastDragPos = { x, y };
  }

  drag(x, y) {
    if (!this.isDragging || !this.selectedId) return;
    this.roomState.updateFurniture(this.selectedId, { x, y });
    this.lastDragPos = { x, y };
  }

  endDrag() {
    if (!this.isDragging || !this.selectedId) return;
    this.isDragging = false;
    if (this.lastDragPos) {
      this.sync.broadcastFurnitureMove(this.selectedId, this.lastDragPos);
      this.sync.scheduleSave(this.roomState.toDbRecord());
    }
    this.lastDragPos = null;
  }

  changeVariant(variant) {
    if (!this.selectedId) return;
    this.roomState.updateFurniture(this.selectedId, { variant });
    this.sync.broadcastFurnitureChange(this.selectedId, { variant });
    this.sync.scheduleSave(this.roomState.toDbRecord());
  }

  changeColor(color) {
    if (!this.selectedId) return;
    this.roomState.updateFurniture(this.selectedId, { color });
    this.sync.broadcastFurnitureChange(this.selectedId, { color });
    this.sync.scheduleSave(this.roomState.toDbRecord());
  }

  removeItem(furnitureId) {
    if (this.roomState.isEssential(furnitureId)) return false;
    const removed = this.roomState.removeFurniture(furnitureId);
    if (removed) {
      this.sync.broadcastFurnitureChange(furnitureId, { removed: true });
      this.sync.scheduleSave(this.roomState.toDbRecord());
      if (this.selectedId === furnitureId) this.selectedId = null;
    }
    return removed;
  }

  addItem(item) {
    const added = this.roomState.addFurniture(item);
    if (added) {
      this.sync.broadcastFurnitureChange(item.id, { added: true, ...item });
      this.sync.scheduleSave(this.roomState.toDbRecord());
    }
    return added;
  }
}
