"""Generate the application icon (assets/icon.png + assets/icon.ico)."""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
ASSETS.mkdir(parents=True, exist_ok=True)

SIZE = 1024
SCALE = 4
W = SIZE * SCALE

img = Image.new("RGBA", (W, W), (0, 0, 0, 0))

# Dark vertical gradient backdrop
bg = Image.new("RGBA", (W, W))
bg_draw = ImageDraw.Draw(bg)
top = (30, 37, 52)
bottom = (13, 17, 24)
for y in range(W):
    t = y / (W - 1)
    color = tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    bg_draw.line([(0, y), (W, y)], fill=color + (255,))

radius = 190 * SCALE
mask = Image.new("L", (W, W), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, W - 1, W - 1], radius=radius, fill=255)
img.paste(bg, (0, 0), mask)

draw = ImageDraw.Draw(img)

# Thin luminous border
draw.rounded_rectangle(
    [10 * SCALE, 10 * SCALE, W - 10 * SCALE, W - 10 * SCALE],
    radius=radius - 10 * SCALE,
    outline=(255, 255, 255, 26),
    width=4 * SCALE,
)

# Four panes
margin = 190 * SCALE
gap = 26 * SCALE
cell = (W - margin * 2 - gap) // 2
cell_radius = 26 * SCALE

panes = {
    "tl": (margin, margin),
    "tr": (margin + cell + gap, margin),
    "bl": (margin, margin + cell + gap),
    "br": (margin + cell + gap, margin + cell + gap),
}


def amber_gradient(x, y, w, h):
    tile = Image.new("RGBA", (w, h))
    td = ImageDraw.Draw(tile)
    hi = (246, 196, 124)
    lo = (224, 160, 74)
    for row in range(h):
        t = row / max(1, h - 1)
        color = tuple(round(hi[i] + (lo[i] - hi[i]) * t) for i in range(3))
        td.line([(0, row), (w, row)], fill=color + (255,))
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], radius=cell_radius, fill=255)
    tile.putalpha(m)
    return tile


for key, (x, y) in panes.items():
    if key == "tr":
        # Active pane: dark card with amber ring + teal play mark
        draw.rounded_rectangle(
            [x, y, x + cell, y + cell],
            radius=cell_radius,
            fill=(23, 31, 42, 255),
            outline=(240, 179, 94, 210),
            width=5 * SCALE,
        )
        cx, cy = x + cell // 2, y + cell // 2
        s = 64 * SCALE
        tri = [(cx - s * 0.62, cy - s), (cx - s * 0.62, cy + s), (cx + s, cy)]
        draw.polygon(tri, fill=(94, 224, 196, 255))
    else:
        img.paste(amber_gradient(x, y, cell, cell), (x, y))

# Soft inner highlight on panes
for key, (x, y) in panes.items():
    if key == "tr":
        continue
    draw.rounded_rectangle(
        [x, y, x + cell, y + cell],
        radius=cell_radius,
        outline=(255, 240, 210, 60),
        width=2 * SCALE,
    )

icon = img.resize((SIZE, SIZE), Image.LANCZOS)
icon.save(ASSETS / "icon.png")
icon.save(
    ASSETS / "icon.ico",
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)
print("wrote", ASSETS / "icon.png", "and", ASSETS / "icon.ico")
