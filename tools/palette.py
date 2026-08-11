"""Gathera Art Bible palette. Single source of truth for every generated pixel."""

def h(s):
    s = s.lstrip("#")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), 255)

T = (0, 0, 0, 0)

# ---- outlines ----
OUTLINE = h("3A211D")
OUTLINE_SOFT = h("5C3A2E")

# ---- floors ----
WOOD_FLOOR_DARK = h("8B5A3C")
WOOD_FLOOR = h("A9713F")
WOOD_FLOOR_LIGHT = h("C18443")
TILE_FLOOR = h("E8DCC4")
TILE_FLOOR_ALT = h("DCCBAA")
RUG_WARM = h("C25E4A")
RUG_WARM_D = h("9E4736")
RUG_WARM_L = h("DD7C67")
RUG_TEAL = h("2E8B8B")
RUG_TEAL_D = h("1F6B6B")
RUG_TEAL_L = h("5FC7C0")

# ---- walls ----
WALL_SHADOW = h("C9A97E")
WALL_BASE = h("E3C79B")
WALL_HIGHLIGHT = h("F2DFBC")
WALL_TRIM = h("6B4A32")

# ---- plants ----
LEAF_DARK = h("3E6B2A")
LEAF_MID = h("62A83D")
LEAF_LIGHT = h("86C94A")
POT = h("C4703F")
POT_D = h("9C5730")
POT_L = h("E08E5C")

# ---- wood furniture ----
WOOD_DARK = h("6B4526")
WOOD_MID = h("8B542F")
WOOD_LIGHT = h("C18443")

# ---- light ----
DAYLIGHT_WARM = h("F7E3B0")
DAYLIGHT_COOL = h("CFE4E8")
LAMP_GLOW = h("F2A93B")

# ---- accents ----
TEAL = h("2E8B8B")
TEAL_D = h("1F6B6B")
TEAL_L = h("5FC7C0")
CLAY = h("D8623F")
CLAY_D = h("A8452C")
CLAY_L = h("EE8A63")
AMBER = h("F2A93B")
AMBER_D = h("C4801F")
AMBER_L = h("FFC96B")

PARCHMENT = h("FDF8EE")
INK = h("2A1D14")
SCREEN_OFF = h("3D4B52")
SCREEN_ON = h("7FB6C4")
METAL = h("9A8570")
METAL_D = h("6B5340")
GLASS = (168, 214, 214, 90)

# ---- character ----
SKIN = {
    "light": (h("E6A87C"), h("FFD3A8"), h("FFE8CC")),
    "medium": (h("C97F4E"), h("F2B078"), h("FFD09B")),
    "tan": (h("A0603A"), h("CE8A55"), h("E8AC79")),
    "deep": (h("6B3F27"), h("90583A"), h("B37A55")),
}

HAIR = {
    "dark": (h("241413"), h("39211E"), h("51322B")),
    "brown": (h("3E2318"), h("60372A"), h("8A5236")),
    "light": (h("8A6132"), h("C79A55"), h("E8C480")),
    "ginger": (h("7A3418"), h("B15426"), h("D97C42")),
}

CLOTH = {
    "blue": (h("2E5F8B"), h("3D7FB5"), h("6BA8D8")),
    "teal": (h("1F6B6B"), h("2E8B8B"), h("5FC7C0")),
    "clay": (h("A8452C"), h("D8623F"), h("EE8A63")),
    "amber": (h("C4801F"), h("F2A93B"), h("FFC96B")),
    "moss": (h("4E7A28"), h("6FA83C"), h("96C95E")),
    "plum": (h("5C3A5E"), h("82568A"), h("AE7FB5")),
}

PANTS = {
    "indigo": (h("29344F"), h("3B4A6B"), h("55688F")),
    "charcoal": (h("2C2A28"), h("423E3A"), h("5C5651")),
    "khaki": (h("8A7245"), h("B39A63"), h("D3BC８A".replace("８", "8"))),
}

SHOE = {
    "sneakers": (h("E8E0D0"), h("FFFFFF"[:7]) if False else h("F5EFE2")),
    "boots": (h("4A3428"), h("6B4A32")),
    "flats": (h("3A2A34"), h("55414D")),
}
