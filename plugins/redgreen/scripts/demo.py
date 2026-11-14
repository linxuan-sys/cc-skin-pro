"""Draws docs/demo.gif: a Claude Code session beside the Tests pane.

The pane follows hooks/pane.tsx row for row and shows what the parser reads from the
vitest fixture (scripts/runs.mjs), so the demo cannot drift from what the mod draws.
Needs Pillow, Node 22.6+ and ffmpeg. Run from the repo root: python scripts/demo.py
"""

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
W, H = 1280, 720
SIZE = 15
FONTS = Path("C:/Windows/Fonts")

BG = "#0e0e10"
FG = "#d4d4d8"
DIM = "#71717a"
FAINT = "#3f3f46"
RED = "#f87171"
GREEN = "#4ade80"
YELLOW = "#facc15"
CLAUDE = "#d97757"

mono = ImageFont.truetype(str(FONTS / "CascadiaMono.ttf"), SIZE)
bold = ImageFont.truetype(str(FONTS / "CascadiaMono.ttf"), SIZE)
bold.set_variation_by_name("Bold")
CW = mono.getlength("M")
LH = round(SIZE * 1.55)


# The two glyphs Cascadia Mono lacks, stroked to fill the cell like the font's own would.
def cross(d, x, y, color, width):
    d.line((x + 1.5, y + 5, x + CW - 1.5, y + 15), fill=color, width=width)
    d.line((x + CW - 1.5, y + 5, x + 1.5, y + 15), fill=color, width=width)


def elbow(d, x, y, color, width):
    d.line((x + 2, y + 2, x + 2, y + 13, x + CW, y + 13), fill=color, width=width, joint="curve")


DRAWN = {"✗": cross, "⎿": elbow}


def draw_text(d, x, y, text, color=FG, strong=False, limit=None):
    """One cell per character, so columns line up whatever draws the glyph."""
    if limit is not None and len(text) > limit:
        text = text[: limit - 1] + "…"
    for i, ch in enumerate(text):
        if ch in DRAWN:
            DRAWN[ch](d, x + i * CW, y, color, 2 if strong else 1)
        else:
            d.text((x + i * CW, y), ch, font=bold if strong else mono, fill=color)
    return x + len(text) * CW


def spans(d, x, y, parts, limit):
    """A row of (text, color, bold) parts, cut at `limit` columns like wrap="truncate-end"."""
    used = 0
    for text, color, strong in parts:
        room = limit - used
        if room <= 0:
            break
        draw_text(d, x + used * CW, y, text, color, strong, room if len(text) > room else None)
        used += len(text)


# The pane, as hooks/pane.tsx lays it out.
def pane(d, box, runs, index, chosen, ago):
    x0, y0, x1, y1 = box
    d.rounded_rectangle(box, radius=8, outline=FAINT, width=1)
    draw_text(d, x0 + 14, y0 - LH // 2 + 2, " Tests ", FG, True)
    cols = int((x1 - x0 - 28) / CW)
    x, y = x0 + 14, y0 + LH

    run = runs[index]
    green = run["failed"] == 0
    total = run["passed"] + run["failed"]
    verdict = f"✓ All {total} tests passed" if green else f"✗ {run['failed']} failed"
    meta = " · ".join(p for p in (f"{run['durationMs']}ms", run["runner"], ago) if p)
    parts = [(verdict, GREEN if green else RED, True), ("  ", FG, False)]
    if not green:
        parts += [(f"{run['passed']} passed", GREEN, False), ("  ", FG, False)]
    if run["skipped"]:
        parts += [(f"{run['skipped']} skipped", YELLOW, False), ("  ", FG, False)]
    parts += [(meta, DIM, False)]
    spans(d, x, y, parts, cols)
    y += LH
    draw_text(d, x, y, f"$ {run['command']}", DIM, limit=cols)
    y += LH * 2

    blocks = [("●" if i == index else "■", GREEN if r["failed"] == 0 else RED, False) for i, r in enumerate(runs)]
    buttons = []
    if index > 0:
        buttons.append(("  older", DIM, False))
    if index < len(runs) - 1:
        buttons += [("  newer", DIM, False), ("  latest", DIM, False)]
    spans(d, x, y, blocks + buttons, cols)
    y += LH * 2

    failures = run["failures"]
    for i, f in enumerate(failures):
        mark = "›" if i == chosen else " "
        name_color = FG if i == chosen else DIM
        spans(d, x, y, [(mark, RED, False), (" ", FG, False), (f["name"], name_color, i == chosen), ("  " + f.get("file", ""), FAINT, False)], cols)
        y += LH

    if failures:
        f = failures[chosen]
        top = y + LH // 2
        bottom = min(y1 - 14, top + LH * (len(f["detail"]) + 2) + 6)
        d.rounded_rectangle((x - 4, top, x1 - 14, bottom), radius=7, outline="#7f1d1d", width=1)
        inner = cols - 4
        ty = top + 8
        draw_text(d, x + 10, ty, f["name"], FG, True, inner)
        ty += LH
        for line in f["detail"]:
            if ty + LH > bottom - 4:
                break
            s = line.lstrip()
            err = s.startswith(("+", ">", "AssertionError", "Error", "expected"))
            quiet = s.startswith(("❯", "-")) or (s[:3].strip().rstrip("|").isdigit() and "|" in s[:8]) or s.startswith("|")
            draw_text(d, x + 10, ty, line or " ", RED if err else DIM if quiet else FG, limit=inner)
            ty += LH
    elif green:
        draw_text(d, x, y, "Nothing failing.", DIM)


def transcript(d, box, lines):
    x0, y0, _, _ = box
    y = y0
    for parts in lines:
        spans(d, x0, y, parts, 64)
        y += LH


def frame(state):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    # Window chrome
    for i, c in enumerate(("#ff5f57", "#febc2e", "#28c840")):
        d.ellipse((20 + i * 20, 18, 32 + i * 20, 30), fill=c)
    draw_text(d, W / 2 - 9 * CW, 14, "claude  ~/cart", DIM)
    d.line((0, 46, W, 46), fill="#1c1c1f")

    split = 668
    transcript(d, (28, 70, split - 20, H - 90), state["transcript"])

    # Prompt and status line
    d.rounded_rectangle((24, H - 92, split - 16, H - 50), radius=7, outline=FAINT)
    draw_text(d, 40, H - 82, "> " + state.get("typing", ""), FG)
    status = state.get("status")
    if status:
        draw_text(d, 40, H - 38, status, GREEN if "✓" in status else RED)
        draw_text(d, 40 + (len(status) + 3) * CW, H - 38, "Opus 5.5 · ~/cart", FAINT)

    if state.get("pane"):
        p = state["pane"]
        pane(d, (split, 70, W - 24, H - 24), p["runs"], p["index"], p["chosen"], p["ago"])
    return img


def main():
    for tool in ("node", "ffmpeg"):
        if shutil.which(tool) is None:
            sys.exit(f"demo.py needs {tool} on PATH")

    vitest = json.loads(subprocess.run(["node", str(ROOT / "scripts/runs.mjs")], capture_output=True, encoding="utf-8", check=True).stdout)
    red = {**vitest, "command": "pnpm exec vitest run"}
    earlier = {"runner": "vitest", "passed": 4, "failed": 0, "skipped": 1, "failures": [], "durationMs": 812, "command": "pnpm exec vitest run"}
    fixed = {**earlier, "durationMs": 874}

    ask = "make checkout round tax the way finance wants"
    user = [("> " + ask, FG, False)]
    blank = [("", FG, False)]
    ran = [
        user, blank,
        [("● ", CLAUDE, False), ("Bash", FG, True), ("(pnpm exec vitest run)", DIM, False)],
        [("  ⎿  ", DIM, False), (" FAIL  cart.test.ts > cart > applies discount", RED, False)],
        [("     ", DIM, False), ("AssertionError: expected 13.5 to be 14", DIM, False)],
        [("     … +41 lines", FAINT, False)],
        [("     ", DIM, False), ("Tests  3 failed | 1 passed | 1 skipped (5)", DIM, False)],
        blank,
        [("● ", FG, False), ("Three failures: a missing import and two", FG, False)],
        [("  assertions in cart.test.ts. Fixing them.", FG, False)],
    ]
    fixing = ran + [
        blank,
        [("● ", CLAUDE, False), ("Update", FG, True), ("(cart.ts)", DIM, False)],
        [("  ⎿  ", DIM, False), ("Updated cart.ts with 3 additions and 1 removal", DIM, False)],
        [("● ", CLAUDE, False), ("Update", FG, True), ("(broken.test.ts)", DIM, False)],
        [("  ⎿  ", DIM, False), ("Updated broken.test.ts with 1 addition", DIM, False)],
    ]
    green = fixing + [
        [("● ", CLAUDE, False), ("Bash", FG, True), ("(pnpm exec vitest run)", DIM, False)],
        [("  ⎿  ", DIM, False), ("Tests  4 passed | 1 skipped (5)", GREEN, False)],
        blank,
        [("● ", FG, False), ("All four pass.", FG, False)],
    ]

    reds = {"runs": [earlier, red], "index": 1, "ago": "2s ago"}
    states = []
    for n in range(0, len(ask) + 1, 9):
        states.append(({"transcript": [], "typing": ask[:n], "status": "tests ✓ 4"}, 0.09))
    states.append(({"transcript": [user], "status": "tests ✓ 4"}, 0.5))
    states.append(({"transcript": [user, blank, ran[2]], "status": "tests ✓ 4"}, 0.9))
    states.append(({"transcript": ran, "status": "tests ✗ 3/4", "pane": {**reds, "chosen": 0}}, 1.8))
    poster = len(states)
    states.append(({"transcript": ran, "status": "tests ✗ 3/4", "pane": {**reds, "chosen": 1}}, 2.2))
    states.append(({"transcript": ran, "status": "tests ✗ 3/4", "pane": {**reds, "chosen": 2}}, 1.6))
    states.append(({"transcript": ran, "status": "tests ✗ 3/4", "pane": {**reds, "index": 0, "chosen": 0, "ago": "3m ago"}}, 1.2))
    states.append(({"transcript": fixing, "status": "tests ✗ 3/4", "pane": {**reds, "chosen": 1, "ago": "14s ago"}}, 1.2))
    states.append(({"transcript": green, "status": "tests ✓ 4", "pane": {"runs": [earlier, red, fixed], "index": 2, "chosen": 0, "ago": "1s ago"}}, 3.2))

    out = ROOT / "docs/demo.gif"
    with tempfile.TemporaryDirectory() as tmp:
        listing = []
        for i, (state, seconds) in enumerate(states):
            path = Path(tmp) / f"f{i:03}.png"
            frame(state).save(path)
            listing += [f"file '{path.as_posix()}'", f"duration {seconds}"]
        listing.append(f"file '{(Path(tmp) / f'f{len(states) - 1:03}.png').as_posix()}'")
        (Path(tmp) / "list.txt").write_text("\n".join(listing))
        frame(states[poster][0]).save(ROOT / "docs/demo.png")
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(Path(tmp) / "list.txt"),
             "-vf", "split[a][b];[a]palettegen=max_colors=64:stats_mode=full[p];[b][p]paletteuse=dither=none", "-loop", "0", str(out)],
            check=True,
        )
    print(f"{out.relative_to(ROOT)}  {out.stat().st_size // 1024} KiB")


if __name__ == "__main__":
    main()
