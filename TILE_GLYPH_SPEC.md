# Tile Glyph Fidelity Spec

> Visual identity for tiles in Charleston Lab. Players read scoring hands off the tile faces
> themselves, and those faces barely vary between physical sets — so our glyphs must be
> **recognizably identical to a real American Mahjong (NMJL) set**, harmonized to our palette.
> Source research: Wikipedia *Mahjong tiles*; Lara's Mahjong Edit *American Mahjong Tiles
> Explained*; the Unicode Mahjong Tiles block (U+1F000–1F02B) as a canonical reference.

## Design rules
1. **Draw the face, don't label it.** Each tile is an SVG face on an ivory tile body, not text.
   Unicode mahjong glyphs are rejected: they render inconsistently per-OS and have **no joker**.
2. **Match the real tile's defining feature** — the thing players recognize at a glance:
   - Dots → *count of circles* in the standard arrangement.
   - Bams → *count of bamboo sticks* (and the 1 Bam *bird*).
   - Craks → *Arabic numeral over 萬*.
   - Honors → their *Chinese character* (萬/中/發/東南西北) with the Latin helper letter.
3. **Palette harmony.** Use the app tokens, which already align with tradition:
   `--bam #2f7d44` (green), `--crak #b83227` (red), `--dot #2660a4` (blue),
   `--wind #4a3f8f`, `--soap #6b6f76`, `--flower #c2780a`, `--joker #8a3ea0`.
   Tile body = ivory `#fbf7ee` with a thin warm border; engraved look via a subtle inner shadow.
4. **Per-number color accents** preserved where they aid recognition (red middle row of 9 Dot,
   red middle stick of 5 Bam, etc.) but mapped onto our 3-color ramp so the rack reads as one set.

## Engine tile codes → glyph
Codes come from `meta()` in the tools: suited = `<n><suit>` (suit ∈ `B`/`C`/`D`, n 1–9);
winds = `W`+`N/E/W/S`; dragons = `DG`/`DR`/`DW`; flower = `FL`; joker = `JK`.

### Craks — `1C`…`9C`  (Characters / 萬)
- Arabic numeral on top in **blue** (`--dot` blue is traditional for the crak number), the
  character **萬 in red** (`--crak`) below. 5 may use 伍 in some sets; we use 萬 uniformly.
- Defining feature: number-over-萬. This is the most legible suit; keep the numeral bold.

### Bams — `1B`…`9B`  (Bamboo / sticks)
- **1 Bam = a bird** (sparrow), green with a red accent. The single most iconic tile; never a stick.
- 2–9 = that many **vertical segmented sticks** (bamboo), laid out in the canonical groupings:
  - 2: two side by side · 3: a top stick over a pair (or 1-over-2) · 4: 2×2 · 5: 2×2 + center
  - 6: 2×3 · 7: a top stick over 2×3 · 8: two diagonal fans (the "M" + mirror) · 9: 3×3
- Color: green sticks; **red accents** on the 5 (center stick), 7 (top stick), 9 (center column).

### Dots — `1D`…`9D`  (Circles / coins)
- N rings in the fixed arrangement; ring count IS the number:
  - 1: one large ring ("big pancake"), multi-ring styling
  - 2: vertical pair · 3: diagonal of three · 4: 2×2 · 5: 2×2 + center
  - 6: 2×3 · 7: three-diagonal over a 2×2 · 8: 2×4 · 9: 3×3
- Color: our blue base, with the traditional **green/red/blue tri-color** reduced to accents —
  9 Dot keeps a red middle row; 6/7 keep a red lower group — to preserve recognition.

### Winds — `WN`/`WE`/`WW`/`WS`
- Chinese character primary: **北 / 東 / 西 / 南** in `--wind` purple-blue, with the Latin
  letter **N/E/W/S** small in a top corner (American sets show the letter).

### Dragons
- `DR` Red Dragon: **中** in red (`--crak`). Pairs with Crak.
- `DG` Green Dragon: **發** in green (`--bam`). Pairs with Bam.
- `DW` White Dragon / **Soap**: the iconic **blue rectangular frame around an empty center**
  (`--dot` blue border). Pairs with Dot. Doubles as **0** — show a faint corner `0` since this
  app uses it as zero on the card, but the frame is the recognizable feature.

### Flower — `FL`
- A simple stylized **blossom** in `--flower` gold. All flowers are interchangeable, so one
  faithful blossom is correct; art varies between real sets anyway.

### Joker — `JK`
- Bold red **JOKER** wordmark (the American joker's defining look), `--joker` accent frame.
  No Unicode glyph exists for this — another reason drawn faces are required.

## Layout
- **Linear rack, never a grid.** Tiles render in a single horizontal row (`display:flex; flex-wrap:nowrap`)
  with horizontal scroll on overflow — mirroring how players actually line up and manipulate a rack.
  Applies to the Tile Tray and every tile-manipulation surface; small inline "chips" (ledger) may
  stay inline-wrapped since they are references, not a manipulable rack.
- Tile size: ~44×58 desktop, ~38×50 mobile. Keep the 1:1.3 aspect of a real tile.
