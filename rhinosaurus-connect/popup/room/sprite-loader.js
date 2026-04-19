export class SpriteFrame {
  constructor(sheet, sx, sy, sw, sh) {
    this.sheet = sheet;
    this.sx = sx;
    this.sy = sy;
    this.sw = sw;
    this.sh = sh;
  }

  draw(ctx, dx, dy, dw, dh) {
    ctx.drawImage(this.sheet, this.sx, this.sy, this.sw, this.sh, dx, dy, dw || this.sw, dh || this.sh);
  }
}

export class SpriteLoader {
  constructor() {
    this.definitions = new Map();
    this.sheets = new Map();
  }

  register(type, variant, def) {
    const key = `${type}:${variant}`;
    this.definitions.set(key, def);
  }

  getDefinition(type, variant) {
    return this.definitions.get(`${type}:${variant}`) || null;
  }

  async loadSheet(name, url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.sheets.set(name, img);
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  getFrame(type, variant) {
    const def = this.getDefinition(type, variant);
    if (!def) return null;
    const sheet = this.sheets.get(def.sheet);
    if (!sheet) return null;
    return new SpriteFrame(sheet, def.sx, def.sy, def.sw, def.sh);
  }
}
