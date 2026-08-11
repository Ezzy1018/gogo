"""Generates the Gathera office map as Tiled JSON (Art Bible s6).
60x40 tiles. Seven zones. Dense props. Run after generate_art.py.

Layers:
  ground     floors and rugs
  decor      flat non blocking floor decor
  furniture  desks, sofas, walls at body height
  above      tall tops drawn over the player
  collision  invisible, 1 = solid
  objects    spawn point + zone rectangles

Run: python3 tools/generate_map.py
"""
import json, os, random

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
IDX = json.load(open(os.path.join(HERE, "tile_index.json")))
GID = IDX["tiles"]
COLS, ROWS = IDX["cols"], IDX["rows"]

W, H, TS = 60, 40, 32
rnd = random.Random(20260812)

ground = [0] * (W * H)
decor = [0] * (W * H)
furn = [0] * (W * H)
above = [0] * (W * H)
coll = [0] * (W * H)


def inb(x, y):
    return 0 <= x < W and 0 <= y < H


def put(layer, x, y, name, solid=False):
    if not inb(x, y):
        return
    layer[y * W + x] = GID[name]
    if solid:
        coll[y * W + x] = 1


def fill(layer, x0, y0, x1, y1, names, solid=False):
    if isinstance(names, str):
        names = [names]
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            put(layer, x, y, rnd.choice(names), solid)


def solid(x0, y0, x1, y1, v=1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if inb(x, y):
                coll[y * W + x] = v


WOODS = ["wood_a", "wood_b", "wood_c", "wood_d", "wood_a", "wood_b", "wood_knot"]
TILES_F = ["tile_a", "tile_b"]

# ---------------- base floor ----------------
fill(ground, 0, 0, W - 1, H - 1, WOODS)

# ---------------- outer shell ----------------
# top wall: rows 0,1 = wall_top, row 2 = wall_low
for x in range(W):
    put(above, x, 0, "wall_top")
    put(above, x, 1, "wall_top")
    put(furn, x, 2, "wall_low", solid=True)
    solid(x, 0, x, 2)
# big window wall along the top (Art Bible s6)
for x in list(range(6, 22)) + list(range(32, 52)):
    put(above, x, 1, "window_top")
    put(furn, x, 2, "window_low", solid=True)

# bottom wall
for x in range(W):
    put(furn, x, H - 2, "wall_low", solid=True)
    put(above, x, H - 1, "trim")
    solid(x, H - 2, x, H - 1)
# entrance door in the bottom wall
for x in (29, 30):
    put(furn, x, H - 2, "door", solid=True)

# side walls
for y in range(H):
    for x in (0, 1):
        put(furn, x, y, "wall_low", solid=True)
    for x in (W - 2, W - 1):
        put(furn, x, y, "wall_low", solid=True)
    solid(0, y, 1, y)
    solid(W - 2, y, W - 1, y)

ZONES = []


def zone(zid, name, x, y, w, h, private, icon):
    ZONES.append({"id": zid, "name": name, "x": x, "y": y, "w": w, "h": h, "private": private, "icon": icon})


# ================= WORK FLOOR =================
zone("work", "Work Floor", 2, 3, 29, 19, False, "💻")


DESKS = []


def desk_cluster(ox, oy):
    """Four desks facing each other with chairs, monitors and clutter.

    Chair placement is deterministic so src/shared/desks.ts can assign seats.
    """
    for dx, dy, facing in [(0, 0, "up"), (2, 0, "up"), (0, 3, "down"), (2, 3, "down")]:
        x, y = ox + dx, oy + dy
        put(furn, x, y, "desk_l", solid=True)
        put(furn, x + 1, y, "desk_r", solid=True)
        put(above, x, y - 1, "monitor")
        cy = y + 1 if facing == "down" else y - 1
        put(decor, x, cy, "chair_up" if facing == "down" else "chair_down")
        if rnd.random() < 0.5:
            put(decor, x + 1, y + (2 if facing == "down" else -2), "clutter")
        DESKS.append({
            "id": len(DESKS),
            "deskTX": x,
            "deskTY": y,
            "seatTX": x,
            "seatTY": cy,
            "dir": "up" if facing == "down" else "down",
        })


for cx in (4, 12, 20):
    for cy in (6, 14):
        desk_cluster(cx, cy)

# work floor plants and life
for (px, py) in [(3, 4), (10, 4), (18, 4), (27, 5), (3, 20), (28, 12), (16, 20), (26, 20)]:
    put(furn, px, py, "plant_tall_b", solid=True)
    put(above, px, py - 1, "plant_tall_t")
for (px, py) in [(9, 12), (17, 12), (25, 8), (5, 21), (23, 21)]:
    put(decor, px, py, "plant_small")
for px in (7, 15, 23):
    put(above, px, 2, "poster")
put(furn, 28, 16, "boxes", solid=True)
put(furn, 29, 4, "cooler_b", solid=True)
put(above, 29, 3, "cooler_t")

# ================= MEETING ROOM (private) =================
MX0, MY0, MX1, MY1 = 34, 3, 56, 14
zone("meeting", "Meeting Room", MX0, MY0, MX1 - MX0 + 1, MY1 - MY0 + 1, True, "🎙️")
fill(ground, MX0, MY0, MX1, MY1, TILES_F)
# glass west wall with a doorway
for y in range(MY0, MY1 + 1):
    if y in (8, 9):
        continue
    put(furn, MX0 - 1, y, "glass_low", solid=True)
    put(above, MX0 - 1, y - 1, "glass_top")
# glass south wall
for x in range(MX0 - 1, MX1 + 1):
    put(furn, x, MY1 + 1, "glass_low", solid=True)
    put(above, x, MY1, "glass_top")
# long table
for x in range(39, 52):
    name = "ltable_l" if x == 39 else ("ltable_r" if x == 51 else "ltable_m")
    put(furn, x, 8, name, solid=True)
for x in range(39, 52, 2):
    put(decor, x, 7, "chair_down")
    put(decor, x, 9, "chair_up")
put(furn, 44, 4, "board_b", solid=True)
put(above, 44, 3, "board_t")
put(furn, 45, 4, "board_b", solid=True)
put(above, 45, 3, "board_t")
for (px, py) in [(36, 5), (54, 5), (36, 12), (54, 12)]:
    put(furn, px, py, "plant_tall_b", solid=True)
    put(above, px, py - 1, "plant_tall_t")
fill(ground, 38, 6, 52, 11, ["rug_teal"])
for x in range(38, 53):
    put(ground, x, 6, "rug_teal_edge")

# ================= KITCHEN NOOK =================
KX0, KY0, KX1, KY1 = 2, 25, 17, 33
zone("kitchen", "Kitchen Nook", KX0, KY0, KX1 - KX0 + 1, KY1 - KY0 + 1, False, "☕")
fill(ground, KX0, KY0, KX1, KY1, TILES_F)
# partition wall above the kitchen
for x in range(KX0, KX1 + 1):
    if x in (9, 10):
        continue
    put(furn, x, KY0 - 1, "wall_low", solid=True)
    put(above, x, KY0 - 2, "wall_top")
# counter run
for x in range(3, 13):
    put(furn, x, 26, "kettle" if x in (5, 9) else "counter", solid=True)
for x in (4, 7, 11):
    put(decor, x, 27, "stool")
put(furn, 15, 27, "table_low", solid=True)
put(decor, 15, 26, "chair_down")
put(decor, 15, 28, "chair_up")
put(furn, 3, 31, "plant_tall_b", solid=True)
put(above, 3, 30, "plant_tall_t")
put(decor, 13, 30, "plant_small")
put(above, 6, 25, "poster")
put(decor, 8, 29, "clutter")

# ================= LOUNGE =================
LX0, LY0, LX1, LY1 = 20, 25, 38, 35
zone("lounge", "Lounge", LX0, LY0, LX1 - LX0 + 1, LY1 - LY0 + 1, False, "🛋️")
fill(ground, LX0 + 2, LY0 + 2, LX1 - 2, LY1 - 2, ["rug_warm"])
for x in range(LX0 + 2, LX1 - 1):
    put(ground, x, LY0 + 2, "rug_warm_edge")
for x in range(23, 30):
    name = "sofa_l" if x == 23 else ("sofa_r" if x == 29 else "sofa_m")
    put(furn, x, 28, name, solid=True)
for x in range(23, 30):
    name = "sofa_l" if x == 23 else ("sofa_r" if x == 29 else "sofa_m")
    put(furn, x, 33, name, solid=True)
for x in range(25, 28):
    put(furn, x, 30, "table_low", solid=True)
put(furn, 33, 27, "shelf_b", solid=True)
put(above, 33, 26, "shelf_t")
put(furn, 34, 27, "shelf_b", solid=True)
put(above, 34, 26, "shelf_t")
put(furn, 36, 29, "lamp_b", solid=True)
put(above, 36, 28, "lamp_t")
put(furn, 21, 33, "lamp_b", solid=True)
put(above, 21, 32, "lamp_t")
for (px, py) in [(37, 26), (21, 26), (37, 34)]:
    put(furn, px, py, "plant_tall_b", solid=True)
    put(above, px, py - 1, "plant_tall_t")
for (px, py) in [(31, 31), (22, 30), (35, 33)]:
    put(decor, px, py, "plant_small")
put(decor, 27, 31, "clutter")

# ================= FOCUS BOOTH (private) =================
FX0, FY0, FX1, FY1 = 44, 20, 52, 27
zone("focus", "Focus Booth", FX0, FY0, FX1 - FX0 + 1, FY1 - FY0 + 1, True, "🧘")
fill(ground, FX0, FY0, FX1, FY1, ["carpet"])
for x in range(FX0 - 1, FX1 + 2):
    put(furn, x, FY0 - 1, "glass_low", solid=True)
    put(above, x, FY0 - 2, "glass_top")
    if x not in (47, 48):
        put(furn, x, FY1 + 1, "glass_low", solid=True)
        put(above, x, FY1, "glass_top")
for y in range(FY0, FY1 + 1):
    put(furn, FX0 - 1, y, "glass_low", solid=True)
    put(above, FX0 - 1, y - 1, "glass_top")
    put(furn, FX1 + 1, y, "glass_low", solid=True)
    put(above, FX1 + 1, y - 1, "glass_top")
put(furn, 47, 23, "table_low", solid=True)
put(furn, 48, 23, "table_low", solid=True)
put(decor, 47, 22, "chair_down")
put(decor, 48, 24, "chair_up")
put(furn, 45, 21, "plant_tall_b", solid=True)
put(above, 45, 20, "plant_tall_t")
put(furn, 51, 26, "lamp_b", solid=True)
put(above, 51, 25, "lamp_t")

# ================= ENTRANCE =================
EX0, EY0, EX1, EY1 = 26, 34, 34, 37
zone("entrance", "Entrance", EX0, EY0, EX1 - EX0 + 1, EY1 - EY0 + 1, False, "🚪")
fill(ground, EX0, EY0, EX1, EY1, TILES_F)
for x in (29, 30):
    put(decor, x, 36, "doormat")
put(above, 27, 34, "hooks")
put(furn, 33, 36, "plant_tall_b", solid=True)
put(above, 33, 35, "plant_tall_t")
put(decor, 26, 36, "plant_small")

# ================= YOUR DESK =================
zone("desk", "Your Desk", 4, 6, 8, 4, False, "🏠")

# ---------------- density pass ----------------
# A light sprinkle only inside room zones — hallways stay clear.
SCATTER = ["plant_small"]
placed = 0
for (x0, y0, x1, y1, rate) in [
    (3, 4, 28, 20, 0.01),
    (35, 4, 55, 13, 0.008),
    (35, 18, 55, 23, 0.012),
    (3, 24, 24, 32, 0.01),
]:
    for y in range(y0, y1):
        for x in range(x0, x1):
            i = y * W + x
            if coll[i] or furn[i] or decor[i] or above[i]:
                continue
            if rnd.random() < rate:
                put(decor, x, y, rnd.choice(SCATTER))
                placed += 1


def layer(name, data, visible=True, opacity=1.0):
    return {
        "data": data, "height": H, "id": layer.n, "name": name, "opacity": opacity,
        "type": "tilelayer", "visible": visible, "width": W, "x": 0, "y": 0,
    }


layer.n = 0


def nl(name, data, visible=True, opacity=1.0):
    layer.n += 1
    return layer(name, data, visible, opacity)


objects = [{
    "id": 1, "name": "spawn", "point": True, "rotation": 0, "type": "", "visible": True,
    "x": 29.5 * TS, "y": 35.5 * TS, "width": 0, "height": 0,
}]
for i, d in enumerate(DESKS):
    objects.append({
        "id": 100 + i, "name": "desk", "point": True, "rotation": 0, "type": "", "visible": True,
        "x": (d["seatTX"] + 0.5) * TS, "y": (d["seatTY"] + 0.5) * TS, "width": 0, "height": 0,
        "properties": [
            {"name": "deskId", "type": "int", "value": d["id"]},
            {"name": "dir", "type": "string", "value": d["dir"]},
            {"name": "deskTX", "type": "int", "value": d["deskTX"]},
            {"name": "deskTY", "type": "int", "value": d["deskTY"]},
        ],
    })
for i, z in enumerate(ZONES):
    objects.append({
        "id": 10 + i, "name": "zone", "rotation": 0, "type": "", "visible": True,
        "x": z["x"] * TS, "y": z["y"] * TS, "width": z["w"] * TS, "height": z["h"] * TS,
        "properties": [
            {"name": "zoneId", "type": "string", "value": z["id"]},
            {"name": "zoneName", "type": "string", "value": z["name"]},
            {"name": "private", "type": "bool", "value": z["private"]},
            {"name": "icon", "type": "string", "value": z["icon"]},
        ],
    })

tilemap = {
    "compressionlevel": -1, "height": H, "infinite": False,
    "layers": [
        nl("ground", ground),
        nl("decor", decor),
        nl("furniture", furn),
        nl("above", above),
        nl("collision", [g and GID["blank"] for g in coll], visible=False, opacity=0.0),
        {"draworder": "topdown", "id": 90, "name": "objects", "objects": objects,
         "opacity": 1, "type": "objectgroup", "visible": True, "x": 0, "y": 0},
    ],
    "nextlayerid": 99, "nextobjectid": 999, "orientation": "orthogonal",
    "renderorder": "right-down", "tiledversion": "1.10.2",
    "tileheight": TS, "tilewidth": TS, "type": "map", "version": "1.10",
    "width": W,
    "tilesets": [{
        "columns": COLS, "firstgid": 1, "image": "../tilesets/office.png",
        "imageheight": ROWS * TS, "imagewidth": COLS * TS, "margin": 0,
        "name": "office", "spacing": 0, "tilecount": COLS * ROWS,
        "tileheight": TS, "tilewidth": TS,
    }],
}

os.makedirs(os.path.join(ROOT, "public", "assets", "maps"), exist_ok=True)
with open(os.path.join(ROOT, "public", "assets", "maps", "office.json"), "w") as fp:
    json.dump(tilemap, fp)

# emit zones for the client UI as well
src_shared = os.path.join(ROOT, "src", "shared")
os.makedirs(src_shared, exist_ok=True)
with open(os.path.join(src_shared, "zones.json"), "w") as fp:
    json.dump(ZONES, fp, indent=2)

solid_count = sum(coll)
props = sum(1 for v in furn if v) + sum(1 for v in decor if v) + sum(1 for v in above if v)
print(f"map: {W}x{H} tiles, {len(ZONES)} zones, {props} props placed ({placed} scattered), {solid_count} solid tiles")
