import { describe, it, expect } from 'vitest';
import { FurnitureCatalog } from '../../../popup/room/furniture-catalog.js';

describe('FurnitureCatalog', () => {
  it('has categories', () => {
    const catalog = new FurnitureCatalog();
    const categories = catalog.getCategories();
    expect(categories).toContain('Furniture');
    expect(categories).toContain('Decorations');
    expect(categories).toContain('Plants');
    expect(categories).toContain('Misc');
  });

  it('returns items for a category', () => {
    const catalog = new FurnitureCatalog();
    const items = catalog.getItems('Plants');
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].type).toBeDefined();
    expect(items[0].variant).toBeDefined();
  });

  it('generates unique IDs for new items', () => {
    const catalog = new FurnitureCatalog();
    const id1 = catalog.generateId('plant');
    const id2 = catalog.generateId('plant');
    expect(id1).not.toBe(id2);
  });

  it('creates a placeable item from catalog entry', () => {
    const catalog = new FurnitureCatalog();
    const items = catalog.getItems('Plants');
    const placed = catalog.createPlaceable(items[0]);
    expect(placed.id).toBeDefined();
    expect(placed.x).toBe(160);
    expect(placed.y).toBe(200);
    expect(placed.interactive).toBe(false);
  });
});
