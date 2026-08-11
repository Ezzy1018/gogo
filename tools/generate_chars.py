"""Generates modular character layer sheets (Art Bible s5).

Each sheet is 16 frames of 32x48 laid out horizontally:
  index = dir*4 + f,  dirs: down=0 left=1 right=2 up=3
  f: 0 idle_a, 1 idle_b (breathing bob), 2 step_a, 3 step_b

Layers composite in this order in the browser:
  base -> bottom -> shoes -> top -> hair -> accessory

Run: python3 tools/generate_chars.py
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
from palette import *

W, H, NF = 32, 48, 16
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "assets", "characters")
DIRS = ["down", "left", "right", "up"]


def geom(dr, f):
    """Per frame geometry. bob lifts the upper body, legs swing on step frames."""
    bob = -1 if f in (1, 2, 3) else 0
    side = dr in ("left", "right")
    g = {
        "bob": bob,
        "head": (10, 6 + bob, 21, 20 + bob) if side else (9, 6 + bob, 22, 20 + bob),
        "torso": (11, 21 + bob, 20, 33 + bob) if side else (10, 21 + bob, 21, 33 + bob),
        "armL": (7, 22 + bob, 9, 32 + bob),
        "armR": (22, 22 + bob, 24, 32 + bob),
        "side": side,
    }
    # legs: swing forward/back on step frames
    if f == 2:
        g["legL"], g["legR"] = (10, 33, 14, 45), (17, 33, 21, 43)
    elif f == 3:
        g["legL"], g["legR"] = (11, 33, 15, 43), (16, 33, 20, 45)
    else:
        g["legL"], g["legR"] = (11, 33, 15, 44), (16, 33, 20, 44)
    if side:
        g["legL"] = (12, g["legL"][1], 16, g["legL"][3])
        g["legR"] = (15, g["legR"][1], 19, g["legR"][3])
    return g


def shade(d, x0, y0, x1, y1, dark, mid, light, outline=True):
    d.rectangle([x0, y0, x1, y1], fill=mid, outline=OUTLINE if outline else None)
    if x1 - x0 > 2:
        d.line([x0 + 1, y0 + 1, x0 + 1, y1 - 1], fill=light)
        d.line([x1 - 1, y0 + 1, x1 - 1, y1 - 1], fill=dark)


def sheet(fn):
    im = Image.new("RGBA", (W * NF, H), T)
    for di, dr in enumerate(DIRS):
        for f in range(4):
            cell = Image.new("RGBA", (W, H), T)
            fn(ImageDraw.Draw(cell), dr, f, geom(dr, f))
            im.paste(cell, ((di * 4 + f) * W, 0))
    return im


# ---------------- base body ----------------
def make_base(skin):
    dark, mid, light = SKIN[skin]

    def f(d, dr, fi, g):
        # legs
        for leg in (g["legL"], g["legR"]):
            shade(d, *leg, dark, mid, light)
        # arms
        if g["side"]:
            shade(d, 13, g["armL"][1], 15, g["armL"][3], dark, mid, light)
        else:
            shade(d, *g["armL"], dark, mid, light)
            shade(d, *g["armR"], dark, mid, light)
        # torso
        shade(d, *g["torso"], dark, mid, light)
        # head
        hx0, hy0, hx1, hy1 = g["head"]
        d.rounded_rectangle([hx0, hy0, hx1, hy1], radius=4, fill=mid, outline=OUTLINE)
        d.line([hx0 + 1, hy0 + 2, hx0 + 1, hy1 - 2], fill=light)
        d.line([hx1 - 1, hy0 + 2, hx1 - 1, hy1 - 2], fill=dark)
        # face
        if dr == "down":
            d.point((hx0 + 4, hy0 + 8), fill=OUTLINE)
            d.point((hx0 + 4, hy0 + 9), fill=OUTLINE)
            d.point((hx1 - 4, hy0 + 8), fill=OUTLINE)
            d.point((hx1 - 4, hy0 + 9), fill=OUTLINE)
            d.point((hx0 + 6, hy0 + 12), fill=OUTLINE_SOFT)
            d.point((hx0 + 7, hy0 + 12), fill=OUTLINE_SOFT)
        elif dr == "left":
            d.point((hx0 + 3, hy0 + 8), fill=OUTLINE)
            d.point((hx0 + 3, hy0 + 9), fill=OUTLINE)
            d.point((hx0 + 2, hy0 + 12), fill=OUTLINE_SOFT)
        elif dr == "right":
            d.point((hx1 - 3, hy0 + 8), fill=OUTLINE)
            d.point((hx1 - 3, hy0 + 9), fill=OUTLINE)
            d.point((hx1 - 2, hy0 + 12), fill=OUTLINE_SOFT)
    return f


# ---------------- hair ----------------
def make_hair(style, color):
    dark, mid, light = HAIR[color]

    def f(d, dr, fi, g):
        hx0, hy0, hx1, hy1 = g["head"]
        back = dr == "up"
        cap_bottom = hy1 - 2 if back else hy0 + 5
        d.rounded_rectangle([hx0 - 1, hy0 - 2, hx1 + 1, cap_bottom], radius=4, fill=mid, outline=OUTLINE)
        d.line([hx0, hy0 - 1, hx1 - 2, hy0 - 1], fill=light)
        d.line([hx1, hy0, hx1, cap_bottom - 1], fill=dark)
        if style == "buzz":
            pass
        elif style == "short":
            d.rectangle([hx0 - 1, hy0 + 3, hx0 + 1, hy0 + 8], fill=mid, outline=OUTLINE)
            d.rectangle([hx1 - 1, hy0 + 3, hx1 + 1, hy0 + 8], fill=dark, outline=OUTLINE)
        elif style == "messy":
            for i, x in enumerate(range(hx0, hx1, 3)):
                d.rectangle([x, hy0 - 4 + (i % 2), x + 2, hy0 + 1], fill=light if i % 2 else mid, outline=OUTLINE)
        elif style == "long":
            d.rectangle([hx0 - 1, hy0 + 3, hx0 + 2, hy1 + 7], fill=mid, outline=OUTLINE)
            d.rectangle([hx1 - 2, hy0 + 3, hx1 + 1, hy1 + 7], fill=dark, outline=OUTLINE)
            if back:
                d.rounded_rectangle([hx0, hy1 - 3, hx1, hy1 + 8], radius=3, fill=mid, outline=OUTLINE)
        elif style == "bun":
            cx = (hx0 + hx1) // 2
            d.ellipse([cx - 4, hy0 - 8, cx + 4, hy0], fill=mid, outline=OUTLINE)
            d.ellipse([cx - 3, hy0 - 7, cx, hy0 - 4], fill=light)
        elif style == "curly":
            for cx, cy in [(hx0, hy0), (hx0 + 5, hy0 - 3), (hx0 + 10, hy0 - 3), (hx1, hy0), (hx0 - 1, hy0 + 6), (hx1 + 1, hy0 + 6)]:
                d.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill=mid, outline=OUTLINE)
            d.ellipse([hx0 + 3, hy0 - 4, hx0 + 7, hy0], fill=light)
    return f


# ---------------- tops ----------------
def make_top(kind, color):
    dark, mid, light = CLOTH[color]

    def f(d, dr, fi, g):
        x0, y0, x1, y1 = g["torso"]
        bottom = y1 - 1 if kind == "tee" else y1 + 1
        shade(d, x0 - 1, y0 - 1, x1 + 1, bottom, dark, mid, light)
        sleeve_len = 4 if kind == "tee" else 10
        if g["side"]:
            shade(d, 13, y0, 15, y0 + sleeve_len, dark, mid, light)
        else:
            shade(d, g["armL"][0] - 1, y0, g["armL"][2] + 1, y0 + sleeve_len, dark, mid, light)
            shade(d, g["armR"][0] - 1, y0, g["armR"][2] + 1, y0 + sleeve_len, dark, mid, light)
        if kind == "hoodie":
            hx0, hy0, hx1, hy1 = g["head"]
            d.rounded_rectangle([hx0 - 2, hy1 - 5, hx1 + 2, hy1 + 3], radius=3, fill=dark, outline=OUTLINE)
            d.line([(x0 + x1) // 2 - 1, y0 + 3, (x0 + x1) // 2 - 1, y0 + 8], fill=light)
            d.line([(x0 + x1) // 2 + 1, y0 + 3, (x0 + x1) // 2 + 1, y0 + 8], fill=light)
        elif kind == "jacket":
            d.line([(x0 + x1) // 2, y0, (x0 + x1) // 2, bottom - 1], fill=dark)
            d.line([x0 + 2, y0 + 1, (x0 + x1) // 2 - 1, y0 + 4], fill=light)
            d.line([x1 - 2, y0 + 1, (x0 + x1) // 2 + 1, y0 + 4], fill=light)
        elif kind == "shirt":
            d.line([x0 + 2, y0 + 1, (x0 + x1) // 2, y0 + 5], fill=light)
            d.line([x1 - 2, y0 + 1, (x0 + x1) // 2, y0 + 5], fill=light)
            for by in range(y0 + 6, bottom - 1, 4):
                d.point(((x0 + x1) // 2, by), fill=dark)
        elif kind == "sweater":
            for by in range(y0 + 2, bottom - 1, 3):
                d.line([x0, by, x1, by], fill=dark)
    return f


# ---------------- bottoms ----------------
def make_bottom(kind, color):
    dark, mid, light = PANTS[color]

    def f(d, dr, fi, g):
        lg, rg = g["legL"], g["legR"]
        if kind == "skirt":
            top = min(lg[1], rg[1])
            d.polygon([(9, top), (22, top), (25, top + 9), (6, top + 9)], fill=mid, outline=OUTLINE)
            d.line([10, top + 1, 8, top + 8], fill=light)
            d.line([21, top + 1, 23, top + 8], fill=dark)
            return
        cut = 6 if kind == "shorts" else (10 if kind == "trousers" else 11)
        for leg in (lg, rg):
            shade(d, leg[0], leg[1], leg[2], min(leg[3], leg[1] + cut), dark, mid, light)
        if kind == "jeans":
            d.point((lg[0] + 1, lg[1] + 2), fill=light)
            d.point((rg[2] - 1, rg[1] + 2), fill=light)
    return f


# ---------------- shoes ----------------
def make_shoes(kind):
    dark, light = SHOE[kind]

    def f(d, dr, fi, g):
        for leg in (g["legL"], g["legR"]):
            y = leg[3]
            hgt = 4 if kind == "boots" else 3
            d.rounded_rectangle([leg[0] - 1, y - hgt + 1, leg[2] + 1, y + 1], radius=1, fill=dark, outline=OUTLINE)
            d.line([leg[0], y - hgt + 2, leg[2], y - hgt + 2], fill=light)
    return f


# ---------------- accessories ----------------
def make_acc(kind):
    def f(d, dr, fi, g):
        hx0, hy0, hx1, hy1 = g["head"]
        if kind == "glasses":
            if dr == "up":
                return
            if dr == "down":
                d.rectangle([hx0 + 2, hy0 + 7, hx0 + 6, hy0 + 10], outline=OUTLINE)
                d.rectangle([hx1 - 6, hy0 + 7, hx1 - 2, hy0 + 10], outline=OUTLINE)
                d.line([hx0 + 6, hy0 + 8, hx1 - 6, hy0 + 8], fill=OUTLINE)
            else:
                d.rectangle([hx0 + 1, hy0 + 7, hx0 + 6, hy0 + 10], outline=OUTLINE)
        elif kind == "headphones":
            d.arc([hx0 - 2, hy0 - 5, hx1 + 2, hy0 + 12], 180, 360, fill=OUTLINE)
            d.arc([hx0 - 2, hy0 - 4, hx1 + 2, hy0 + 13], 180, 360, fill=TEAL)
            d.rounded_rectangle([hx0 - 3, hy0 + 4, hx0 + 1, hy0 + 10], radius=2, fill=TEAL, outline=OUTLINE)
            d.rounded_rectangle([hx1 - 1, hy0 + 4, hx1 + 3, hy0 + 10], radius=2, fill=TEAL_D, outline=OUTLINE)
        elif kind == "cap":
            d.rounded_rectangle([hx0 - 1, hy0 - 4, hx1 + 1, hy0 + 4], radius=3, fill=CLAY, outline=OUTLINE)
            d.line([hx0, hy0 - 3, hx1 - 3, hy0 - 3], fill=CLAY_L)
            if dr != "up":
                brim = [hx0 - 2, hy0 + 3, hx1 + 2, hy0 + 6] if dr == "down" else (
                    [hx0 - 5, hy0 + 3, hx0 + 6, hy0 + 6] if dr == "left" else [hx1 - 6, hy0 + 3, hx1 + 5, hy0 + 6])
                d.rounded_rectangle(brim, radius=1, fill=CLAY_D, outline=OUTLINE)
        elif kind == "scarf":
            d.rounded_rectangle([hx0, hy1 - 3, hx1, hy1 + 3], radius=2, fill=AMBER, outline=OUTLINE)
            d.line([hx0 + 2, hy1 - 2, hx1 - 2, hy1 - 2], fill=AMBER_L)
            d.rectangle([hx0 + 2, hy1 + 2, hx0 + 5, hy1 + 9], fill=AMBER, outline=OUTLINE)
    return f


def main():
    os.makedirs(OUT, exist_ok=True)
    index = {"frameWidth": W, "frameHeight": H, "frames": NF, "dirs": DIRS, "layers": {}}
    count = 0

    def save(name, img):
        nonlocal count
        img.save(os.path.join(OUT, name + ".png"))
        count += 1

    skins = list(SKIN.keys())
    hairs = ["short", "messy", "long", "bun", "curly", "buzz"]
    haircolors = list(HAIR.keys())
    tops = ["sweater", "shirt", "hoodie", "jacket", "tee"]
    topcolors = list(CLOTH.keys())
    bottoms = ["jeans", "trousers", "skirt", "shorts"]
    bottomcolors = list(PANTS.keys())
    shoes = list(SHOE.keys())
    accs = ["glasses", "headphones", "cap", "scarf"]

    for s in skins:
        save(f"base_{s}", sheet(make_base(s)))
    for st in hairs:
        for c in haircolors:
            save(f"hair_{st}_{c}", sheet(make_hair(st, c)))
    for t in tops:
        for c in topcolors:
            save(f"top_{t}_{c}", sheet(make_top(t, c)))
    for b in bottoms:
        for c in bottomcolors:
            save(f"bottom_{b}_{c}", sheet(make_bottom(b, c)))
    for sh in shoes:
        save(f"shoes_{sh}", sheet(make_shoes(sh)))
    for a in accs:
        save(f"acc_{a}", sheet(make_acc(a)))

    index["layers"] = {
        "skin": skins, "hair": hairs, "hairColor": haircolors,
        "top": tops, "topColor": topcolors,
        "bottom": bottoms, "bottomColor": bottomcolors,
        "shoes": shoes, "accessory": ["none"] + accs,
    }
    with open(os.path.join(OUT, "index.json"), "w") as fp:
        json.dump(index, fp, indent=2)
    print(f"characters: {count} layer sheets ({NF} frames each) -> public/assets/characters/")


if __name__ == "__main__":
    main()
