#!/usr/bin/env python3
"""Generate stylized Genshin character theme art for Codex theme switcher.

These are placeholder illustrations in the characters' signature palettes.
Users can replace the generated art.png in each theme folder with their own
high-resolution character artwork; the CSS will use it as the hero background.
"""
import math
import os
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent / "themes"
OUT_SIZE = (1400, 700)

THEMES = {
    "genshin-furina": {
        "bg_top": (224, 242, 254),      # sky-100
        "bg_bottom": (240, 249, 255),   # sky-50
        "primary": (14, 165, 233),      # sky-500
        "secondary": (125, 211, 252),   # sky-300
        "accent": (255, 215, 0),        # gold
        "glow": (56, 189, 248),         # sky-400
        "shapes": "droplets",
    },
    "genshin-hutao": {
        "bg_top": (60, 20, 20),         # dark plum
        "bg_bottom": (127, 29, 29),     # red-900
        "primary": (239, 68, 68),       # red-500
        "secondary": (252, 165, 165),   # red-300
        "accent": (251, 191, 36),       # amber-400
        "glow": (220, 38, 38),          # red-600
        "shapes": "blossoms",
    },
    "genshin-nahida": {
        "bg_top": (220, 252, 231),      # green-100
        "bg_bottom": (240, 253, 244),   # green-50
        "primary": (34, 197, 94),       # green-500
        "secondary": (134, 239, 172),   # green-300
        "accent": (250, 204, 21),       # yellow-400
        "glow": (74, 222, 128),         # green-400
        "shapes": "leaves",
    },
    "genshin-raiden": {
        "bg_top": (30, 20, 50),         # deep violet
        "bg_bottom": (88, 28, 135),     # purple-900
        "primary": (168, 85, 247),      # purple-500
        "secondary": (216, 180, 254),   # purple-300
        "accent": (56, 189, 248),       # sky-400 lightning
        "glow": (147, 51, 234),         # purple-600
        "shapes": "lightning",
    },
    "genshin-zhongli": {
        "bg_top": (40, 30, 20),         # dark brown
        "bg_bottom": (120, 53, 15),     # amber-900
        "primary": (217, 119, 6),       # amber-600
        "secondary": (251, 191, 36),    # amber-400
        "accent": (234, 179, 8),        # yellow-500
        "glow": (202, 138, 4),          # amber-700
        "shapes": "geo",
    },
}


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def make_gradient(size, top, bottom):
    img = Image.new("RGB", size)
    draw = ImageDraw.Draw(img)
    width, height = size
    for y in range(height):
        color = lerp(top, bottom, y / height)
        draw.line([(0, y), (width, y)], fill=color)
    return img


def add_radial_glow(img, center, radius, color, alpha=120):
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    for r in range(radius, 0, -2):
        t = r / radius
        a = int(alpha * (1 - t ** 2))
        draw.ellipse(
            [center[0] - r, center[1] - r, center[0] + r, center[1] + r],
            fill=(*color, a),
        )
    img_rgba = img.convert("RGBA")
    return Image.alpha_composite(img_rgba, glow).convert("RGB")


def random_point(width, height, margin=50):
    return (random.randint(margin, width - margin), random.randint(margin, height - margin))


def draw_droplets(draw, cx, cy, color, n=12):
    for i in range(n):
        angle = random.uniform(0, math.pi * 2)
        dist = random.randint(80, 280)
        x = int(cx + math.cos(angle) * dist)
        y = int(cy + math.sin(angle) * dist * 0.6)
        r = random.randint(8, 28)
        draw.ellipse([x - r, y - r * 1.4, x + r, y + r * 1.4], fill=color)


def draw_blossoms(draw, cx, cy, color, n=18):
    for i in range(n):
        angle = random.uniform(0, math.pi * 2)
        dist = random.randint(60, 320)
        x = int(cx + math.cos(angle) * dist)
        y = int(cy + math.sin(angle) * dist * 0.5)
        size = random.randint(6, 18)
        for petal in range(5):
            pa = angle + petal * (math.pi * 2 / 5)
            px = int(x + math.cos(pa) * size)
            py = int(y + math.sin(pa) * size * 0.6)
            draw.ellipse([px - size // 2, py - size // 2, px + size // 2, py + size // 2], fill=color)
        draw.ellipse([x - 2, y - 2, x + 2, y + 2], fill=(255, 255, 255, 80))


def draw_leaves(draw, cx, cy, color, n=16):
    for i in range(n):
        angle = random.uniform(-math.pi / 3, math.pi / 3)
        dist = random.randint(80, 360)
        x = int(cx + math.cos(angle) * dist)
        y = int(cy + math.sin(angle) * dist * 0.5)
        w = random.randint(10, 30)
        h = random.randint(20, 50)
        draw.ellipse([x - w, y - h, x + w, y + h], fill=color)


def draw_lightning(draw, cx, cy, color, n=8):
    for i in range(n):
        x = cx + random.randint(-250, 250)
        y = cy + random.randint(-200, 100)
        points = [(x, y)]
        for step in range(random.randint(4, 7)):
            points.append((points[-1][0] + random.randint(-40, 40), points[-1][1] + random.randint(20, 70)))
        for j in range(len(points) - 1):
            draw.line([points[j], points[j + 1]], fill=color, width=random.randint(2, 5))


def draw_geo(draw, cx, cy, color, n=10):
    for i in range(n):
        angle = random.uniform(0, math.pi * 2)
        dist = random.randint(80, 300)
        x = int(cx + math.cos(angle) * dist)
        y = int(cy + math.sin(angle) * dist * 0.5)
        size = random.randint(20, 60)
        points = [
            (x, y - size),
            (x + size * 0.87, y - size * 0.5),
            (x + size * 0.87, y + size * 0.5),
            (x, y + size),
            (x - size * 0.87, y + size * 0.5),
            (x - size * 0.87, y - size * 0.5),
        ]
        draw.polygon(points, fill=color)


def generate(theme_id, palette):
    random.seed(theme_id)
    img = make_gradient(OUT_SIZE, palette["bg_top"], palette["bg_bottom"])

    # Large ambient glows
    img = add_radial_glow(img, (1050, 180), 450, palette["glow"], alpha=90)
    img = add_radial_glow(img, (1150, 500), 350, palette["primary"], alpha=70)
    img = add_radial_glow(img, (980, 350), 280, palette["accent"], alpha=60)

    # Add subtle sparkles
    overlay = Image.new("RGBA", OUT_SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for _ in range(80):
        x = random.randint(0, OUT_SIZE[0])
        y = random.randint(0, OUT_SIZE[1])
        r = random.randint(1, 3)
        a = random.randint(40, 160)
        draw.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, a))

    # Character-side decorative shapes (right side of hero)
    shape_color = (*palette["secondary"], 70)
    shape_draw = ImageDraw.Draw(overlay)
    if palette["shapes"] == "droplets":
        draw_droplets(shape_draw, 1150, 320, shape_color, n=16)
    elif palette["shapes"] == "blossoms":
        draw_blossoms(shape_draw, 1150, 320, shape_color, n=22)
    elif palette["shapes"] == "leaves":
        draw_leaves(shape_draw, 1150, 320, shape_color, n=18)
    elif palette["shapes"] == "lightning":
        draw_lightning(shape_draw, 1150, 120, shape_color, n=10)
    elif palette["shapes"] == "geo":
        draw_geo(shape_draw, 1150, 320, shape_color, n=12)

    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")

    # Soft blur for background feel
    img = img.filter(ImageFilter.GaussianBlur(radius=1.2))

    # Add a subtle vignette
    vignette = Image.new("RGBA", OUT_SIZE, (0, 0, 0, 0))
    vdraw = ImageDraw.Draw(vignette)
    for r in range(max(OUT_SIZE) // 2, 0, -8):
        t = r / (max(OUT_SIZE) // 2)
        a = int(35 * (1 - t ** 2))
        vdraw.rectangle([0, 0, OUT_SIZE[0], OUT_SIZE[1]], fill=(0, 0, 0, a))
    img = Image.alpha_composite(img.convert("RGBA"), vignette).convert("RGB")

    out_path = ROOT / theme_id / "art.png"
    img.save(out_path, "PNG")
    print(f"Generated {out_path}")


def main():
    for theme_id, palette in THEMES.items():
        generate(theme_id, palette)


if __name__ == "__main__":
    main()
