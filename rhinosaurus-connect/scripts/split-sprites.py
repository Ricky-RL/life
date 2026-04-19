#!/usr/bin/env python3
"""
Split Gemini sprite sheet — final version with text label removal.
Text labels (dark pixels near edges) are made transparent along with the checkerboard.
"""

from PIL import Image
import os
import sys
import numpy as np

SPRITE_SHEET = sys.argv[1]
OUTPUT_DIR = sys.argv[2] if len(sys.argv) > 2 else "assets/sprites"

# Refined bounding boxes — pushed Y starts down to skip text labels above sprites
# and trimmed Y ends to skip text labels below
SPRITES = [
    # ROW 1 (y=24-310): main furniture
    ("bed-double-wood",       23,   24, 300, 296),
    ("tv-crt",               374,   24, 148, 186),
    ("desk-wooden",          552,   24, 200, 186),
    ("calendar-default",     786,   24, 148, 186),
    ("makeup-stand-default", 980,   24, 163, 186),
    ("window-default",      1184,   24, 220, 186),

    # ROW 2 (y=240-395): medium items — skip text rows at y≈216-240
    ("nightstand-wooden",    402,  244, 100, 155),
    ("nightstand-wooden-2",  592,  244, 100, 155),
    ("rug-round",            755,  260, 260, 138),
    ("photo-frame",         1090,  260, 84,  135),
    ("bookshelf",           1234,  240, 152, 180),

    # ROW 3 (y=416-520): small decoratives — skip text at y≈408-416
    ("plant-potted",          42,  416, 84, 110),
    ("plant-hanging",        213,  410, 92, 118),
    ("plant-succulent",      350,  430, 100, 98),
    # Fairy lights are the string of colored bulbs — need to find actual location
    # From ASCII map, they seem to be in the row3 area around x≈450-740, y≈440-470
    ("fairy-lights",         350,  440, 400,  45),
    ("plushie",              745,  416, 75, 110),
    ("candles",              821,  420, 150, 108),

    # ROW 5 (y=590-720): bottom items — skip text at y≈536-575
    ("pet-bed",               31,  600, 124, 128),
    ("book-stack",           226,  590, 88, 138),
    ("floor-lamp",           387,  580, 98, 148),
    ("wall-shelf",           539,  590, 143, 130),
    ("flowers-vase",         742,  590, 82, 132),
    ("rug-rectangular",      866,  592, 190, 130),
    ("poster",              1099,  590, 92, 130),
    ("curtains-solid",      1288,  555, 62, 175),
]


def replace_bg(data):
    """Replace checkerboard + near-black text with transparency."""
    result = data.copy()
    r = result[:, :, 0].astype(int)
    g = result[:, :, 1].astype(int)
    b = result[:, :, 2].astype(int)

    # Checkerboard: gray tones
    is_gray = (np.abs(r - g) < 10) & (np.abs(g - b) < 10)
    in_dark = (r >= 85) & (r <= 130)
    in_light = (r >= 138) & (r <= 185)
    is_checker = is_gray & (in_dark | in_light)

    result[is_checker, 3] = 0
    return result


def remove_text_border(img_array, border=15):
    """Make dark text-like pixels transparent in the border region of the crop."""
    result = img_array.copy()
    h, w = result.shape[:2]
    r = result[:, :, 0].astype(int)
    g = result[:, :, 1].astype(int)
    b = result[:, :, 2].astype(int)

    # Text is very dark (near black)
    is_dark = (r < 60) & (g < 60) & (b < 60)

    # Only remove dark pixels in border regions (not inside the sprite)
    border_mask = np.zeros((h, w), dtype=bool)
    border_mask[:border, :] = True      # top
    border_mask[-border:, :] = True     # bottom
    border_mask[:, :border] = True      # left
    border_mask[:, -border:] = True     # right

    result[is_dark & border_mask, 3] = 0
    return result


def extract(data, name, x, y, w, h, img_w, img_h):
    x2 = min(img_w, x + w)
    y2 = min(img_h, y + h)
    region = data[y:y2, x:x2].copy()
    region = replace_bg(region)
    region = remove_text_border(region, border=20)
    result = Image.fromarray(region)
    bbox = result.getbbox()
    if bbox:
        result = result.crop(bbox)
    return result


def main():
    img = Image.open(SPRITE_SHEET).convert("RGBA")
    data = np.array(img)
    h, w = data.shape[:2]
    print(f"Image: {w}x{h}")

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    for f in os.listdir(OUTPUT_DIR):
        if f.endswith('.png'):
            os.remove(os.path.join(OUTPUT_DIR, f))

    for name, sx, sy, sw, sh in SPRITES:
        sprite = extract(data, name, sx, sy, sw, sh, w, h)
        path = os.path.join(OUTPUT_DIR, f"{name}.png")
        sprite.save(path)
        print(f"  {name}.png  ({sprite.width}x{sprite.height})")

    open(os.path.join(OUTPUT_DIR, '.gitkeep'), 'w').close()
    print(f"\n{len(SPRITES)} sprites saved.")


if __name__ == "__main__":
    main()
