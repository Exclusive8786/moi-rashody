# -*- coding: utf-8 -*-
"""Generate launcher icons and splash screens for the Android project."""
import os
from PIL import Image, ImageDraw

RES = r"D:\Harness\Money\app\android\app\src\main\res"
BLUE = (47, 107, 255, 255)
WHITE = (255, 255, 255, 255)

DENSITIES = {
    "mdpi": 1,
    "hdpi": 1.5,
    "xhdpi": 2,
    "xxhdpi": 3,
    "xxxhdpi": 4,
}


def check_points(size, scale=1.0):
    w = size * scale
    left = size / 2 - w / 2
    top = size / 2 - w / 2
    pts = [
        (left + w * 0.05, top + w * 0.52),
        (left + w * 0.36, top + w * 0.82),
        (left + w * 0.95, top + w * 0.18),
    ]
    return pts, max(2, int(w * 0.16))


def draw_check(draw, size, scale=1.0):
    pts, width = check_points(size, scale)
    draw.line(pts, fill=WHITE, width=width, joint="curve")
    for p in pts:
        draw.ellipse(
            [p[0] - width / 2, p[1] - width / 2, p[0] + width / 2, p[1] + width / 2],
            fill=WHITE,
        )


def rounded_icon(size, radius_ratio=0.22):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=BLUE)
    draw_check(d, size, 0.62)
    return img


def round_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([0, 0, size - 1, size - 1], fill=BLUE)
    draw_check(d, size, 0.58)
    return img


def adaptive_foreground(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    draw_check(d, size, 0.42)
    return img


for density, factor in DENSITIES.items():
    legacy = int(48 * factor)
    folder = os.path.join(RES, f"mipmap-{density}")
    os.makedirs(folder, exist_ok=True)
    rounded_icon(legacy).save(os.path.join(folder, "ic_launcher.png"))
    round_icon(legacy).save(os.path.join(folder, "ic_launcher_round.png"))
    adaptive_foreground(int(108 * factor)).save(
        os.path.join(folder, "ic_launcher_foreground.png")
    )

# Splash screens: brand background + check mark, keep the original dimensions.
for root, _dirs, files in os.walk(RES):
    for name in files:
        if name != "splash.png":
            continue
        path = os.path.join(root, name)
        try:
            with Image.open(path) as source:
                w, h = source.size
        except Exception:
            continue
        img = Image.new("RGB", (w, h), (47, 107, 255))
        d = ImageDraw.Draw(img)
        side = max(120, int(min(w, h) * 0.28))
        pts, width = check_points(side)
        ox = (w - side) / 2
        oy = (h - side) / 2
        pts = [(x + ox, y + oy) for x, y in pts]
        d.line(pts, fill=WHITE, width=width, joint="curve")
        for p in pts:
            d.ellipse(
                [p[0] - width / 2, p[1] - width / 2, p[0] + width / 2, p[1] + width / 2],
                fill=WHITE,
            )
        img.save(path)

print("icons and splash generated")
