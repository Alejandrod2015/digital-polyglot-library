#!/usr/bin/env python3
"""
Build Google Play listing assets from the existing iOS screenshots, entirely
locally (no image credits, no external calls).

Play phone-screenshot spec: JPEG/PNG, each side 320-3840px, and the long side
at most 2x the short side. The raw shots are 1206x2622 (2.17:1) which VIOLATES
the 2:1 cap, so they cannot be uploaded as-is. Each shot is composed onto a
branded canvas with a short headline; the side padding brings the ratio under
2:1 and the result reads as an intentional listing frame instead of letterboxed
bars.

Also builds the required 1024x500 feature graphic, which did not exist.

Run: python3 apps/mobile/scripts/build-play-assets.py
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
MOBILE = os.path.dirname(HERE)
# journey-shots is untracked and lives only in the primary checkout, not in
# worktrees. Prefer the local copy, fall back to the primary repo.
SHOTS = os.path.join(MOBILE, "journey-shots")
if not os.path.isdir(SHOTS):
    SHOTS = "/Users/alejandrodelcarpio/digital-polyglot-library/apps/mobile/journey-shots"
ASSETS = os.path.join(MOBILE, "assets")
OUT = os.path.join(MOBILE, "play-store-assets")
FONT_DIR = os.path.join(
    MOBILE, "node_modules", "@expo-google-fonts", "nunito"
)

# Brand palette (from the splash + paywall).
BG = (12, 22, 38)          # #0c1626 splash navy
BG2 = (17, 30, 51)         # slightly lighter for the gradient
INK = (255, 255, 255)
ACCENT = (248, 193, 92)    # #f8c15c paywall gold

# order = the iOS narrative set. Headlines are faithful to what each shot shows.
SHOTS_SPEC = [
    ("i01-journey-story.png", "Real stories, real Spanish"),
    ("i02-word-save.png",     "Tap any word to learn it"),
    ("i05b-practice-round.png", "Practice that sticks"),
    ("i04-story-end.png",     "Remember 2× more"),
    ("j-home.png",            "A journey, theme by theme"),
]


def font(weight_file, size):
    return ImageFont.truetype(os.path.join(FONT_DIR, weight_file), size)


NUNITO_XBOLD = "800ExtraBold/Nunito_800ExtraBold.ttf"
NUNITO_SEMI = "600SemiBold/Nunito_600SemiBold.ttf"


def rounded_mask(size, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0], size[1]], radius, fill=255)
    return m


def vertical_gradient(size, top, bottom):
    w, h = size
    base = Image.new("RGB", (1, h))
    for y in range(h):
        t = y / max(1, h - 1)
        base.putpixel(
            (0, y),
            tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3)),
        )
    return base.resize((w, h))


def wrap(draw, text, fnt, max_w):
    words, lines, cur = text.split(), [], ""
    for wd in words:
        trial = (cur + " " + wd).strip()
        if draw.textlength(trial, font=fnt) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = wd
    if cur:
        lines.append(cur)
    return lines


def build_screenshot(shot_file, headline):
    shot = Image.open(os.path.join(SHOTS, shot_file)).convert("RGB")
    sw0, sh0 = shot.size

    CANVAS_W = 1600
    SIDE = 232                      # side padding -> drops ratio under 2:1
    TITLE_ZONE = 360               # headline band at the top
    GAP = 44                       # title -> device
    BOTTOM = 64

    target_w = CANVAS_W - 2 * SIDE
    scale = target_w / sw0
    dw, dh = target_w, round(sh0 * scale)
    CANVAS_H = TITLE_ZONE + GAP + dh + BOTTOM
    assert CANVAS_H / CANVAS_W <= 2.0, f"ratio {CANVAS_H/CANVAS_W:.3f} exceeds 2:1"

    canvas = vertical_gradient((CANVAS_W, CANVAS_H), BG2, BG)
    draw = ImageDraw.Draw(canvas)

    # Headline, centered in the title zone, wrapped to <=2 lines.
    f_title = font(NUNITO_XBOLD, 82)
    lines = wrap(draw, headline, f_title, CANVAS_W - 2 * 120)
    line_h = f_title.getbbox("Ay")[3] + 14
    block_h = line_h * len(lines)
    y = (TITLE_ZONE - block_h) // 2 + 18
    for ln in lines:
        w = draw.textlength(ln, font=f_title)
        draw.text(((CANVAS_W - w) / 2, y), ln, font=f_title, fill=INK)
        y += line_h

    # Device: rounded shot with a soft drop shadow.
    device = shot.resize((dw, dh), Image.LANCZOS)
    radius = 72
    mask = rounded_mask((dw, dh), radius)
    dx, dy = SIDE, TITLE_ZONE + GAP

    shadow = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    sh = Image.new("RGBA", (dw, dh), (0, 0, 0, 150))
    shadow.paste(sh, (dx, dy + 20), mask)
    shadow = shadow.filter(ImageFilter.GaussianBlur(38))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), shadow).convert("RGB")
    canvas.paste(device, (dx, dy), mask)

    return canvas


def fit_font(draw, text, weight_file, max_w, start, min_size=20):
    """Largest size (<= start) at which `text` fits in max_w on one line."""
    size = start
    while size > min_size:
        f = font(weight_file, size)
        if draw.textlength(text, font=f) <= max_w:
            return f
        size -= 2
    return font(weight_file, min_size)


def build_feature_graphic():
    W, H = 1024, 500
    canvas = vertical_gradient((W, H), BG2, BG)
    draw = ImageDraw.Draw(canvas)

    # dP mark on the left.
    mark = Image.open(os.path.join(ASSETS, "icon-adaptive-foreground.png")).convert("RGBA")
    # foreground is the mark on white; drop the white so it sits on the navy.
    r, g, b, _ = mark.split()
    lum = Image.merge("RGB", (r, g, b)).convert("L")
    alpha = lum.point(lambda v: 0 if v > 244 else 255)
    mark.putalpha(alpha)
    m = mark.crop(mark.getbbox())
    mh = 236
    mw = round(m.size[0] * mh / m.size[1])
    m = m.resize((mw, mh), Image.LANCZOS)
    mx, my = 84, (H - mh) // 2
    canvas.paste(m, (mx, my), m)

    # Wordmark + tagline on the right, each auto-fit to the remaining width so
    # nothing overflows the 1024px canvas.
    tx = mx + mw + 60
    avail = W - tx - 56
    name_txt, tag_txt = "Digital Polyglot", "Authentic Spanish in context"
    f_name = fit_font(draw, name_txt, NUNITO_XBOLD, avail, 78)
    f_tag = fit_font(draw, tag_txt, NUNITO_SEMI, avail, 40)

    name_h = f_name.getbbox("Ay")[3]
    tag_h = f_tag.getbbox("Ay")[3]
    gap = 24
    block_h = name_h + gap + tag_h
    ty = (H - block_h) // 2
    draw.text((tx, ty), name_txt, font=f_name, fill=INK)
    draw.text((tx, ty + name_h + gap), tag_txt, font=f_tag, fill=ACCENT)
    return canvas


def main():
    os.makedirs(OUT, exist_ok=True)
    for i, (shot_file, headline) in enumerate(SHOTS_SPEC, 1):
        img = build_screenshot(shot_file, headline)
        name = f"play-screenshot-{i:02d}.png"
        img.save(os.path.join(OUT, name))
        print(f"{name}: {img.size[0]}x{img.size[1]}  ratio {img.size[1]/img.size[0]:.3f}  ← {headline}")
    fg = build_feature_graphic()
    fg.save(os.path.join(OUT, "feature-graphic.png"))
    print(f"feature-graphic.png: {fg.size[0]}x{fg.size[1]}")


if __name__ == "__main__":
    main()
