"""Generates the Gathera interior tileset from the Art Bible palette.
Every tile is 32x32, warm outlines, three tone shading, light from upper left.
Run: python3 tools/generate_art.py
"""
import json, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
from palette import *

S = 32
COLS = 12
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "assets")

TILES = [
    "wood_a", "wood_b", "wood_c", "wood_d", "wood_knot",
    "tile_a", "tile_b",
    "rug_warm", "rug_warm_edge", "rug_teal", "rug_teal_edge", "carpet",
    "wall_low", "wall_top", "window_low", "window_top",
    "glass_low", "glass_top", "door", "trim",
    "desk_l", "desk_r", "monitor", "chair_down", "chair_up",
    "plant_small", "plant_tall_b", "plant_tall_t",
    "sofa_l", "sofa_m", "sofa_r", "table_low",
    "shelf_b", "shelf_t", "counter", "kettle",
    "board_b", "board_t", "lamp_b", "lamp_t",
    "boxes", "poster", "doormat", "hooks",
    "cooler_b", "cooler_t", "ltable_l", "ltable_m", "ltable_r",
    "stool", "clutter", "blank",
]


def box(d, x0, y0, x1, y1, dark, mid, light, outline=OUTLINE):
    """Three tone shaded box with a warm outline. Light from upper left."""
    d.rectangle([x0, y0, x1, y1], fill=mid, outline=outline)
    d.line([x0 + 1, y0 + 1, x1 - 1, y0 + 1], fill=light)
    d.line([x0 + 1, y0 + 1, x0 + 1, y1 - 1], fill=light)
    d.line([x0 + 1, y1 - 1, x1 - 1, y1 - 1], fill=dark)
    d.line([x1 - 1, y0 + 1, x1 - 1, y1 - 1], fill=dark)


def make(fn):
    im = Image.new("RGBA", (S, S), T)
    fn(ImageDraw.Draw(im), im)
    return im


# ---------------- floors ----------------
def wood(seed):
    def f(d, im):
        rnd = random.Random(seed)
        d.rectangle([0, 0, S - 1, S - 1], fill=WOOD_FLOOR)
        for y in range(0, S, 8):
            d.line([0, y, S - 1, y], fill=WOOD_FLOOR_DARK)
            d.line([0, y + 1, S - 1, y + 1], fill=WOOD_FLOOR_LIGHT)
            seam = rnd.randrange(0, S)
            d.line([seam, y, seam, y + 7], fill=WOOD_FLOOR_DARK)
        for _ in range(10):
            d.point((rnd.randrange(S), rnd.randrange(S)), fill=WOOD_FLOOR_LIGHT)
        for _ in range(6):
            d.point((rnd.randrange(S), rnd.randrange(S)), fill=WOOD_FLOOR_DARK)
    return f


def wood_knot(d, im):
    wood(99)(d, im)
    d.ellipse([12, 12, 18, 17], outline=WOOD_FLOOR_DARK)
    d.ellipse([14, 13, 16, 16], fill=WOOD_FLOOR_DARK)


def tile_floor(alt):
    def f(d, im):
        base = TILE_FLOOR_ALT if alt else TILE_FLOOR
        other = TILE_FLOOR if alt else TILE_FLOOR_ALT
        d.rectangle([0, 0, S - 1, S - 1], fill=base)
        d.rectangle([0, 0, 15, 15], fill=other)
        d.rectangle([16, 16, 31, 31], fill=other)
        d.line([0, 15, S - 1, 15], fill=WALL_SHADOW)
        d.line([15, 0, 15, S - 1], fill=WALL_SHADOW)
    return f


def rug(dark, mid, light, edge):
    def f(d, im):
        d.rectangle([0, 0, S - 1, S - 1], fill=mid)
        for x in range(2, S, 6):
            d.line([x, 0, x, S - 1], fill=light)
        if edge:
            d.rectangle([0, 0, S - 1, 3], fill=dark)
            for x in range(1, S, 4):
                d.line([x, 0, x, 2], fill=light)
    return f


def carpet(d, im):
    rnd = random.Random(7)
    d.rectangle([0, 0, S - 1, S - 1], fill=h("CDB99A"))
    for _ in range(60):
        d.point((rnd.randrange(S), rnd.randrange(S)), fill=h("BFA987"))
    for _ in range(30):
        d.point((rnd.randrange(S), rnd.randrange(S)), fill=h("DCCBAA"))


# ---------------- walls ----------------
def wall_low(d, im):
    d.rectangle([0, 0, S - 1, S - 1], fill=WALL_BASE)
    d.line([0, 0, S - 1, 0], fill=WALL_SHADOW)
    d.rectangle([0, 26, S - 1, S - 1], fill=WALL_TRIM)
    d.line([0, 26, S - 1, 26], fill=h("8A6444"))
    d.line([0, S - 1, S - 1, S - 1], fill=OUTLINE)


def wall_top(d, im):
    d.rectangle([0, 0, S - 1, S - 1], fill=WALL_BASE)
    d.rectangle([0, 0, S - 1, 4], fill=WALL_HIGHLIGHT)
    d.line([0, 0, S - 1, 0], fill=OUTLINE)
    d.line([0, 5, S - 1, 5], fill=WALL_SHADOW)


def window_top(d, im):
    wall_top(d, im)
    box(d, 3, 8, 28, 31, WOOD_DARK, WOOD_MID, WOOD_LIGHT)
    d.rectangle([5, 10, 26, 31], fill=DAYLIGHT_COOL)
    d.rectangle([5, 10, 15, 20], fill=DAYLIGHT_WARM)
    d.line([16, 10, 16, 31], fill=WOOD_MID)
    d.line([5, 21, 26, 21], fill=WOOD_MID)


def window_low(d, im):
    d.rectangle([0, 0, S - 1, S - 1], fill=WALL_BASE)
    box(d, 3, 0, 28, 12, WOOD_DARK, WOOD_MID, WOOD_LIGHT)
    d.rectangle([5, 0, 26, 10], fill=DAYLIGHT_COOL)
    d.line([16, 0, 16, 10], fill=WOOD_MID)
    d.rectangle([1, 13, 30, 15], fill=WOOD_LIGHT)
    d.rectangle([0, 26, S - 1, S - 1], fill=WALL_TRIM)
    d.line([0, S - 1, S - 1, S - 1], fill=OUTLINE)


def glass_top(d, im):
    d.rectangle([0, 0, S - 1, S - 1], fill=(168, 214, 214, 70))
    d.line([0, 0, S - 1, 0], fill=WOOD_MID)
    d.line([0, 0, 0, S - 1], fill=(255, 255, 255, 90))
    d.line([6, 0, 14, S - 1], fill=(255, 255, 255, 60))


def glass_low(d, im):
    glass_top(d, im)
    d.rectangle([0, 27, S - 1, S - 1], fill=WOOD_MID)
    d.line([0, 27, S - 1, 27], fill=WOOD_LIGHT)
    d.line([0, S - 1, S - 1, S - 1], fill=OUTLINE)


def door(d, im):
    d.rectangle([0, 0, S - 1, S - 1], fill=WALL_BASE)
    box(d, 3, 1, 28, 31, WOOD_DARK, WOOD_MID, WOOD_LIGHT)
    d.rectangle([7, 5, 24, 15], outline=WOOD_DARK)
    d.rectangle([7, 19, 24, 29], outline=WOOD_DARK)
    d.ellipse([23, 17, 26, 20], fill=AMBER, outline=OUTLINE)


def trim(d, im):
    d.rectangle([0, 0, S - 1, S - 1], fill=WALL_TRIM)
    d.line([0, 0, S - 1, 0], fill=h("8A6444"))


# ---------------- furniture ----------------
def desk(right):
    def f(d, im):
        box(d, 0 if right else 1, 6, 30 if right else 31, 20, WOOD_DARK, WOOD_LIGHT, h("D9A06A"))
        d.rectangle([1, 20, 30, 26], fill=WOOD_MID)
        d.line([1, 20, 30, 20], fill=WOOD_DARK)
        d.rectangle([3, 26, 6, 31], fill=WOOD_DARK)
        d.rectangle([25, 26, 28, 31], fill=WOOD_DARK)
        if right:
            d.rectangle([20, 9, 27, 13], fill=PARCHMENT, outline=OUTLINE)
            d.ellipse([6, 10, 12, 16], fill=TEAL, outline=OUTLINE)
            d.line([12, 12, 14, 14], fill=OUTLINE)
        else:
            d.rectangle([8, 9, 22, 17], fill=h("2B2B33"), outline=OUTLINE)
            d.rectangle([10, 11, 20, 15], fill=h("41414D"))
    return f


def monitor(d, im):
    box(d, 6, 4, 26, 20, h("1E2428"), h("2E3840"), h("49565F"))
    d.rectangle([8, 6, 24, 18], fill=SCREEN_ON)
    d.rectangle([8, 6, 15, 12], fill=h("A9DAE4"))
    d.rectangle([14, 21, 18, 26], fill=METAL_D)
    d.rectangle([10, 26, 22, 29], fill=METAL, outline=OUTLINE)


def chair(up):
    def f(d, im):
        if up:
            box(d, 7, 14, 25, 27, CLAY_D, CLAY, CLAY_L)
            box(d, 8, 4, 24, 15, CLAY_D, CLAY, CLAY_L)
        else:
            box(d, 8, 6, 24, 18, CLAY_D, CLAY, CLAY_L)
            box(d, 7, 16, 25, 28, CLAY_D, CLAY_L, h("F5A98A"))
        d.line([12, 28, 12, 31], fill=METAL_D)
        d.line([20, 28, 20, 31], fill=METAL_D)
    return f


def plant_small(d, im):
    box(d, 10, 20, 22, 30, POT_D, POT, POT_L)
    for (cx, cy, r, c) in [(16, 14, 6, LEAF_MID), (11, 17, 5, LEAF_DARK), (21, 17, 5, LEAF_LIGHT), (16, 10, 4, LEAF_LIGHT)]:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c, outline=OUTLINE)


def plant_tall_b(d, im):
    box(d, 8, 14, 24, 31, POT_D, POT, POT_L)
    d.rectangle([15, 0, 17, 15], fill=LEAF_DARK)
    d.ellipse([4, 2, 16, 12], fill=LEAF_MID, outline=OUTLINE)
    d.ellipse([16, 4, 28, 14], fill=LEAF_DARK, outline=OUTLINE)


def plant_tall_t(d, im):
    d.rectangle([15, 18, 17, 31], fill=LEAF_DARK)
    for (cx, cy, r, c) in [(16, 14, 9, LEAF_MID), (7, 20, 7, LEAF_DARK), (25, 20, 7, LEAF_LIGHT), (16, 6, 6, LEAF_LIGHT)]:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c, outline=OUTLINE)


def sofa(part):
    def f(d, im):
        box(d, -1 if part != "l" else 2, 6, 32 if part != "r" else 29, 20, TEAL_D, TEAL, TEAL_L)
        d.rectangle([0 if part != "l" else 3, 20, 31 if part != "r" else 28, 27], fill=TEAL_D)
        d.line([0, 20, 31, 20], fill=OUTLINE)
        if part == "m":
            d.rectangle([6, 9, 25, 18], fill=TEAL_L, outline=TEAL_D)
        d.rectangle([4, 27, 8, 31], fill=WOOD_DARK)
        d.rectangle([23, 27, 27, 31], fill=WOOD_DARK)
    return f


def table_low(d, im):
    box(d, 2, 8, 29, 22, WOOD_DARK, WOOD_LIGHT, h("DCA972"))
    d.rectangle([5, 22, 8, 30], fill=WOOD_DARK)
    d.rectangle([23, 22, 26, 30], fill=WOOD_DARK)
    d.ellipse([12, 10, 19, 17], fill=PARCHMENT, outline=OUTLINE)
    d.ellipse([14, 12, 17, 15], fill=CLAY)


def shelf(top):
    def f(d, im):
        box(d, 2, 0, 29, 31, WOOD_DARK, WOOD_MID, WOOD_LIGHT)
        rnd = random.Random(3 if top else 5)
        books = [CLAY, TEAL, AMBER, LEAF_MID, h("82568A"), h("3D7FB5")]
        for row in (4, 18):
            x = 5
            while x < 26:
                w = rnd.choice([2, 3, 3, 4])
                hgt = rnd.choice([8, 9, 10])
                c = rnd.choice(books)
                d.rectangle([x, row + (10 - hgt), x + w, row + 10], fill=c, outline=OUTLINE)
                x += w + 1
            d.line([3, row + 11, 28, row + 11], fill=WOOD_DARK)
    return f


def counter(d, im):
    box(d, 0, 8, 31, 14, h("BFAE8C"), TILE_FLOOR, h("F4EBD8"))
    d.rectangle([0, 14, 31, 31], fill=WOOD_MID)
    d.line([0, 14, 31, 14], fill=WOOD_DARK)
    d.rectangle([4, 18, 14, 28], outline=WOOD_DARK)
    d.rectangle([17, 18, 27, 28], outline=WOOD_DARK)
    d.line([8, 23, 11, 23], fill=METAL)
    d.line([21, 23, 24, 23], fill=METAL)


def kettle(d, im):
    counter(d, im)
    box(d, 6, 0, 17, 11, METAL_D, METAL, h("C6B6A0"))
    d.arc([15, 2, 21, 9], 270, 90, fill=METAL_D)
    d.rectangle([20, 4, 25, 11], fill=PARCHMENT, outline=OUTLINE)
    d.line([25, 6, 27, 8], fill=OUTLINE)


def board(top):
    def f(d, im):
        if top:
            box(d, 1, 6, 30, 31, WOOD_DARK, PARCHMENT, PARCHMENT)
            d.line([5, 12, 20, 12], fill=TEAL)
            d.line([5, 16, 24, 16], fill=CLAY)
            d.line([5, 20, 16, 20], fill=AMBER)
            d.line([5, 24, 22, 24], fill=TEAL)
        else:
            box(d, 1, 0, 30, 8, WOOD_DARK, PARCHMENT, PARCHMENT)
            d.rectangle([1, 8, 30, 11], fill=WOOD_MID, outline=OUTLINE)
            d.rectangle([12, 9, 16, 10], fill=CLAY)
    return f


def lamp_b(d, im):
    d.rectangle([14, 0, 17, 27], fill=METAL_D)
    d.ellipse([8, 26, 23, 31], fill=METAL, outline=OUTLINE)


def lamp_t(d, im):
    d.rectangle([14, 22, 17, 31], fill=METAL_D)
    d.polygon([(6, 22), (25, 22), (21, 8), (10, 8)], fill=AMBER, outline=OUTLINE)
    d.polygon([(10, 8), (16, 8), (14, 22), (8, 22)], fill=AMBER_L)
    d.ellipse([9, 20, 22, 25], fill=AMBER_L, outline=OUTLINE)


def boxes(d, im):
    box(d, 2, 12, 18, 30, h("9C7B4E"), h("C29B63"), h("DCBB86"))
    box(d, 15, 6, 30, 24, h("9C7B4E"), h("B08C58"), h("CDAA74"))
    d.line([2, 20, 18, 20], fill=h("9C7B4E"))
    d.line([15, 14, 30, 14], fill=h("9C7B4E"))


def poster(d, im):
    d.rectangle([0, 0, S - 1, S - 1], fill=WALL_BASE)
    box(d, 5, 4, 26, 27, WOOD_DARK, PARCHMENT, PARCHMENT)
    d.ellipse([9, 8, 17, 16], fill=AMBER, outline=OUTLINE)
    d.polygon([(8, 24), (14, 14), (20, 24)], fill=LEAF_MID, outline=OUTLINE)
    d.polygon([(15, 24), (21, 17), (24, 24)], fill=LEAF_DARK, outline=OUTLINE)


def doormat(d, im):
    box(d, 1, 8, 30, 26, h("6B5340"), h("8A7256"), h("A68E6C"))
    for x in range(4, 28, 3):
        d.line([x, 10, x, 24], fill=h("6B5340"))


def hooks(d, im):
    d.rectangle([0, 0, S - 1, S - 1], fill=WALL_BASE)
    d.rectangle([2, 8, 29, 13], fill=WOOD_MID, outline=OUTLINE)
    for x in (7, 15, 23):
        d.line([x, 13, x, 17], fill=METAL_D)
        d.point((x + 1, 17), fill=METAL)
    d.polygon([(4, 17), (12, 17), (10, 30), (6, 30)], fill=CLAY, outline=OUTLINE)
    d.polygon([(19, 17), (27, 17), (26, 28), (20, 28)], fill=TEAL, outline=OUTLINE)


def cooler_b(d, im):
    box(d, 8, 0, 24, 31, h("7E8B90"), h("A9B6BA"), h("CBD6D8"))
    d.rectangle([11, 6, 21, 12], fill=h("6B7A80"), outline=OUTLINE)


def cooler_t(d, im):
    box(d, 9, 8, 23, 31, h("3E8FA0"), h("5EC0CE"), h("9BE2EA"))
    d.rectangle([12, 12, 20, 28], fill=h("AEEAF2"))


def ltable(part):
    def f(d, im):
        x0 = 2 if part == "l" else -1
        x1 = 29 if part == "r" else 32
        box(d, x0, 6, x1, 24, WOOD_DARK, WOOD_LIGHT, h("DCA972"))
        if part == "m":
            d.ellipse([8, 10, 15, 17], fill=PARCHMENT, outline=OUTLINE)
            d.rectangle([18, 11, 26, 16], fill=h("2B2B33"), outline=OUTLINE)
        if part == "l":
            d.rectangle([5, 24, 8, 31], fill=WOOD_DARK)
        if part == "r":
            d.rectangle([23, 24, 26, 31], fill=WOOD_DARK)
    return f


def stool(d, im):
    box(d, 8, 12, 24, 20, WOOD_DARK, WOOD_MID, WOOD_LIGHT)
    d.rectangle([10, 20, 12, 30], fill=WOOD_DARK)
    d.rectangle([20, 20, 22, 30], fill=WOOD_DARK)
    d.line([10, 26, 22, 26], fill=WOOD_DARK)


def clutter(d, im):
    d.rectangle([4, 22, 14, 28], fill=PARCHMENT, outline=OUTLINE)
    d.rectangle([5, 19, 15, 23], fill=TEAL_L, outline=OUTLINE)
    d.ellipse([19, 20, 26, 27], fill=CLAY, outline=OUTLINE)
    d.arc([25, 21, 29, 26], 270, 90, fill=OUTLINE)


def blank(d, im):
    pass


DRAW = {
    "wood_a": wood(1), "wood_b": wood(2), "wood_c": wood(3), "wood_d": wood(4), "wood_knot": wood_knot,
    "tile_a": tile_floor(False), "tile_b": tile_floor(True),
    "rug_warm": rug(RUG_WARM_D, RUG_WARM, RUG_WARM_L, False),
    "rug_warm_edge": rug(RUG_WARM_D, RUG_WARM, RUG_WARM_L, True),
    "rug_teal": rug(RUG_TEAL_D, RUG_TEAL, RUG_TEAL_L, False),
    "rug_teal_edge": rug(RUG_TEAL_D, RUG_TEAL, RUG_TEAL_L, True),
    "carpet": carpet,
    "wall_low": wall_low, "wall_top": wall_top,
    "window_low": window_low, "window_top": window_top,
    "glass_low": glass_low, "glass_top": glass_top,
    "door": door, "trim": trim,
    "desk_l": desk(False), "desk_r": desk(True), "monitor": monitor,
    "chair_down": chair(False), "chair_up": chair(True),
    "plant_small": plant_small, "plant_tall_b": plant_tall_b, "plant_tall_t": plant_tall_t,
    "sofa_l": sofa("l"), "sofa_m": sofa("m"), "sofa_r": sofa("r"), "table_low": table_low,
    "shelf_b": shelf(False), "shelf_t": shelf(True), "counter": counter, "kettle": kettle,
    "board_b": board(False), "board_t": board(True), "lamp_b": lamp_b, "lamp_t": lamp_t,
    "boxes": boxes, "poster": poster, "doormat": doormat, "hooks": hooks,
    "cooler_b": cooler_b, "cooler_t": cooler_t,
    "ltable_l": ltable("l"), "ltable_m": ltable("m"), "ltable_r": ltable("r"),
    "stool": stool, "clutter": clutter, "blank": blank,
}


def main():
    rows = (len(TILES) + COLS - 1) // COLS
    sheet = Image.new("RGBA", (COLS * S, rows * S), T)
    index = {}
    for i, name in enumerate(TILES):
        tile = make(DRAW[name])
        sheet.paste(tile, ((i % COLS) * S, (i // COLS) * S))
        index[name] = i + 1  # Tiled gid, firstgid = 1
    os.makedirs(os.path.join(OUT_DIR, "tilesets"), exist_ok=True)
    sheet.save(os.path.join(OUT_DIR, "tilesets", "office.png"))

    # effects: soft foot shadow + proximity bubble ring
    sh = Image.new("RGBA", (32, 16), T)
    ImageDraw.Draw(sh).ellipse([2, 3, 29, 13], fill=(58, 33, 29, 56))
    sh.save(os.path.join(OUT_DIR, "tilesets", "shadow.png"))

    ring = Image.new("RGBA", (256, 256), T)
    rd = ImageDraw.Draw(ring)
    for i in range(6):
        a = 46 - i * 7
        rd.ellipse([4 + i, 4 + i, 251 - i, 251 - i], outline=(242, 169, 59, a))
    rd.ellipse([10, 10, 245, 245], fill=(242, 169, 59, 16))
    ring.save(os.path.join(OUT_DIR, "tilesets", "bubble.png"))

    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "tile_index.json"), "w") as fp:
        json.dump({"cols": COLS, "rows": rows, "tiles": index}, fp, indent=2)
    print(f"tileset: {len(TILES)} tiles, {COLS}x{rows} grid -> public/assets/tilesets/office.png")


if __name__ == "__main__":
    main()
