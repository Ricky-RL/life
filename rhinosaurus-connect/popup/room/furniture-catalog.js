const CATALOG = {
  Furniture: [
    { type: 'nightstand', variant: 'wooden', label: 'Wooden Nightstand' },
    { type: 'nightstand', variant: 'modern', label: 'Modern Nightstand' },
    { type: 'nightstand', variant: 'cute', label: 'Heart Nightstand' },
    { type: 'lamp', variant: 'floor', label: 'Floor Lamp' },
    { type: 'lamp', variant: 'desk', label: 'Desk Lamp' },
    { type: 'rug', variant: 'round', label: 'Round Rug' },
    { type: 'rug', variant: 'rectangular', label: 'Rectangle Rug' },
    { type: 'curtains', variant: 'solid', label: 'Solid Curtains' },
    { type: 'curtains', variant: 'patterned', label: 'Patterned Curtains' },
  ],
  Decorations: [
    { type: 'wall_art', variant: 'fairy_lights', label: 'Fairy Lights' },
    { type: 'wall_art', variant: 'poster', label: 'Poster' },
    { type: 'wall_art', variant: 'photo_frame', label: 'Photo Frame' },
    { type: 'wall_art', variant: 'shelf', label: 'Wall Shelf' },
  ],
  Plants: [
    { type: 'plant', variant: 'potted', label: 'Potted Plant' },
    { type: 'plant', variant: 'hanging', label: 'Hanging Plant' },
    { type: 'plant', variant: 'succulent', label: 'Succulent' },
  ],
  Misc: [
    { type: 'misc', variant: 'plushie', label: 'Plushie' },
    { type: 'misc', variant: 'books', label: 'Book Stack' },
    { type: 'misc', variant: 'pet_bed', label: 'Pet Bed' },
    { type: 'misc', variant: 'candles', label: 'Candles' },
  ],
};

let idCounter = 0;

export class FurnitureCatalog {
  getCategories() {
    return Object.keys(CATALOG);
  }

  getItems(category) {
    return CATALOG[category] || [];
  }

  generateId(type) {
    idCounter++;
    return `${type}-${Date.now()}-${idCounter}`;
  }

  createPlaceable(catalogEntry) {
    return {
      id: this.generateId(catalogEntry.type),
      type: catalogEntry.type,
      variant: catalogEntry.variant,
      color: null,
      x: 160,
      y: 200,
      interactive: false,
    };
  }
}
