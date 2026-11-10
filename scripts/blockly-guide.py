# Writes mecanum/blockly-guide.html, "Programming with Blockly": a printable guide in the
# step-sheet style (Program a square, the build sheets). Page 1: twelve first steps with
# pictures of real Blockly programs (img/blockly-guide-*.png, made by
# temp/shot-guide-blocks.js). Page 2: the ten simulator maps, drawn here from the same
# numbers as SIMULATOR_MAPS in mecanum/blocks.html (keep them in step), each with its goal
# and the blocks that help.
# Run: python3 scripts/blockly-guide.py, then node scripts/site-nav.js
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from robot_svg import bot_top  # noqa: E402

ROOT = os.path.join(HERE, "..")
PAGE = os.path.join(ROOT, "mecanum", "blockly-guide.html")
VERSION = "0.1.0"

WALL = "#8f98a3"
STAR = "#f6c21c"
uid_counter = [0]


def uid():
    uid_counter[0] += 1
    return "g%d" % uid_counter[0]


def star(cx, cy, r):
    points = []
    import math
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.45
        points.append("%.1f,%.1f" % (cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    return '<polygon points="%s" fill="%s" stroke="#8a6d00" stroke-width="12"/>' % (" ".join(points), STAR)


def box(r1, f1, r2, f2, fill=WALL, extra=""):
    return '<rect x="%d" y="%d" width="%d" height="%d" fill="%s"%s/>' % (min(r1, r2), -max(f1, f2), abs(r2 - r1), abs(f2 - f1), fill, extra)


def lamp(r, f, on=True, ghost=False):
    out = []
    if on and not ghost:
        out.append('<circle cx="%d" cy="%d" r="170" fill="#ffe680" opacity="0.55"/>' % (r, -f))
    out.append('<circle cx="%d" cy="%d" r="70" fill="%s" stroke="#8a6d00" stroke-width="12"%s/>' % (r, -f, "#ffd84a" if on else "#9aa3ad", ' stroke-dasharray="30 20" opacity="0.7"' if ghost else ""))
    return "".join(out)


def label(x, y, text, size=130, color="#c24400", anchor="middle"):
    return '<text x="%d" y="%d" font-size="%d" font-weight="700" fill="%s" text-anchor="%s" font-family="system-ui, sans-serif">%s</text>' % (x, y, size, color, anchor, text)


def arrow(x1, y1, x2, y2, color="#c24400"):
    import math
    a = math.atan2(y2 - y1, x2 - x1)
    h = 70
    p1 = (x2 - h * math.cos(a - 0.5), y2 - h * math.sin(a - 0.5))
    p2 = (x2 - h * math.cos(a + 0.5), y2 - h * math.sin(a + 0.5))
    return ('<path d="M%d %d L%d %d M%.0f %.0f L%d %d L%.0f %.0f" fill="none" stroke="%s" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>'
            % (x1, y1, x2, y2, p1[0], p1[1], x2, y2, p2[0], p2[1], color))


def map_svg(number, width, depth, start, items, title):
    pad = 60
    robot = bot_top(start[0], -start[1], 0, 1.0, True, "map%d" % number)
    body = ['<rect x="%d" y="%d" width="%d" height="%d" class="pic-bg" fill="#f4f1ea"/>' % (-width / 2 - pad, -depth / 2 - pad, width + 2 * pad, depth + 2 * pad),
            '<rect x="%d" y="%d" width="%d" height="%d" fill="#ffffff" stroke="#3a4350" stroke-width="30"/>' % (-width / 2, -depth / 2, width, depth)]
    body.extend(items)
    body.append(robot)
    return ('<svg viewBox="%d %d %d %d" role="img" aria-label="%s">%s</svg>'
            % (-width / 2 - pad, -depth / 2 - pad, width + 2 * pad, depth + 2 * pad, title, "".join(body)))


def maze_walls(edges):
    out = []
    for kind, column, row in edges:
        if kind == "v":
            x = -400 + 800 * column
            out.append(box(x - 20, -1200 + 800 * row, x + 20, -400 + 800 * row))
        else:
            y = -400 + 800 * row
            out.append(box(-1200 + 800 * column, y - 20, -400 + 800 * column, y + 20))
    return out


MAPS = [
    dict(name="Square room", size=(1600, 1600), start=(0, 0),
         items=['<circle cx="0" cy="-500" r="500" fill="none" stroke="#2b323b" stroke-width="20"/>', lamp(600, 600)],
         goal="Drive a square. Then try the light and the loop of tape.",
         use="drive, turn, repeat"),
    dict(name="Star behind the box", size=(1600, 1600), start=(0, -600),
         items=[box(-300, -150, 300, 150), star(0, -600, 120)],
         goal="Get to the star. Go around the box.",
         use="drive (slide left / right), turn"),
    dict(name="The hallway", size=(2000, 2000), start=(-666, -750),
         items=[box(-353, -1000, -313, 450), box(313, -450, 353, 1000), star(666, -750, 120)],
         goal="Follow the hallway to the star. Plan every move.",
         use="drive, turn, a subroutine for each part"),
    dict(name="Stop at the wall", size=(1200, 3000), start=(0, -1300),
         items=[box(-600, 400, 600, 440), star(0, -185 - 400 + 400, 90), arrow(450, -300, 450, -800), arrow(450, -560, 450, 0), label(380, -560, "?", 200, anchor="end")],
         goal="The wall moves every run. Stop on the star, closer than 20 cm, no bump.",
         use="keep driving, repeat until, sonar sees closer than"),
    dict(name="Stop on the dark tile", size=(1200, 3000), start=(0, -1300),
         items=[box(-150, -700 + i * 400 - 150, 150, -700 + i * 400 + 150, "#1b1f24" if i == 2 else "#e2ddd2") for i in range(6)] + [label(330, -(-700 + 400 * 4) + 60, "?", 200)],
         goal="A different tile is dark every run. Stop on it.",
         use="repeat until sees the line, stop"),
    dict(name="Find the light", size=(2000, 2000), start=(0, 0),
         items=[lamp(-750, 750)] + [lamp(x, y, True, True) for x, y in ((750, 750), (-750, -750), (750, -750))] + [label(0, -380, "which corner?", 130)],
         goal="The lamp is in a different corner every run. Find it.",
         use="light direction, turn, follow the light"),
    dict(name="Find the gap", size=(2000, 2000), start=(0, -750),
         items=[box(-1000, -20, 150, 20), box(600, -20, 1000, 20), star(375, -650, 110), arrow(240, 170, -160, 170), arrow(500, 170, 900, 170)],
         goal="The gap moves every run. Slide until the sonar sees through it, then go.",
         use="keep driving (slide), repeat while, sonar"),
    dict(name="The door", size=(1600, 2400), start=(0, -900),
         items=[box(-800, 0, -250, 40), box(250, 0, 800, 40), box(-250, 0, 250, 40, "#ff9b54", ' stroke="#c24400" stroke-width="10" stroke-dasharray="40 25"'), star(0, -900, 120), label(0, 180, "opens and closes", 120)],
         goal="Wait until the sonar sees the door open, then go through.",
         use="repeat while, wait, sonar, drive"),
    dict(name="Red light, green light", size=(1600, 3200), start=(0, -1400),
         items=[lamp(0, 1450), star(0, -1100, 120), label(330, -1420, "on / off", 120, anchor="start")],
         goal="Move only while the lamp is on. Moving in the dark gets you caught.",
         use="light level, if ... else, wait"),
    dict(name="The maze", size=(2400, 2400), start=(-800, -800),
         items=maze_walls([["v", 0, 0], ["h", 1, 1], ["v", 1, 2], ["h", 2, 0]]) + [star(800, -800, 120), label(0, 1150, "a new maze every run", 120)],
         goal="Look before you go: turn, check the sonar, pick the open way.",
         use="subroutines, if, sonar, repeat"),
]

STEPS = [
    ("Open Blockly", None, 'On a computer: <a href="/mecanum/blocks">robotics.makerlabkids.com/mecanum/blocks</a>. Pick <b>Simulator</b>. The pretend robot is on the right.', "qr"),
    ("Your first move", "first", 'Drag <b>drive forward</b> from <b>Moves</b> and snap it under <b>when RUN is pressed</b>. Press <b>RUN</b>.', None),
    ("Add a turn", "turn", 'Snap <b>turn right 90°</b> under it. Click a number to change it. Run it again.', None),
    ("Repeat", "square", 'A square is 4 times "drive, turn". <b>repeat</b> (in <b>Loops</b>) does it for you.', None),
    ("Pick a map", "map2", 'Under the simulator: <b>Map</b>. Try <b>2. Star behind the box</b>. Drag the robot to move where it starts.', None),
    ("Variables", "variable", 'A variable is a box with a number in it. <b>change side by 100</b> makes each side longer: a spiral.', None),
    ("Subroutines", "subroutine", 'Make your own block (<b>Subroutines</b>). The gear adds an input like <b>size</b>.', None),
    ("Watch a sensor", "say", '<b>say</b> puts a number in the <b>Console</b>. Watch the sonar change as the robot moves.', None),
    ("Repeat until", "sensor", 'Drive until something is near, then stop. The wall is somewhere new every run on <b>map 4</b>.', None),
    ("If ... else", "ifelse", 'Decide! If the way is blocked, turn. Else, go forward. Try <b>maps 7 and 8</b>.', None),
    ("Follow the light", "light", '<b>light direction</b> says which way the lamp is. Turn that much. Try <b>maps 6 and 9</b>.', None),
    ("The toolbox", None, '<b>+ New</b>, then <b>Toolbox: subroutines</b>: ready-made blocks like <b>creep to wall</b>. On the real robot: <b>Bluetooth</b>, <b>Robot</b>, <b>RUN</b>.', "toolbox"),
]

IMAGE_SIZES = {}


def png_size(name):
    import struct
    with open(os.path.join(ROOT, "img", "blockly-guide-%s.png" % name), "rb") as f:
        head = f.read(24)
    return struct.unpack(">II", head[16:24])


def qr_svg():
    source = open(os.path.join(ROOT, "mecanum", "bluetooth-build.html"), encoding="utf-8").read()
    match = re.search(r'<svg class="qr" viewBox="0 0 41 41" role="img" aria-label="QR code for https://robotics.makerlabkids.com/mecanum/blocks".*?</svg>', source, re.S)
    return match.group(0)


def toolbox_svg():
    return ('<svg viewBox="0 0 240 150" role="img" aria-label="The + New menu with Toolbox: subroutines picked">'
            '<rect width="240" height="150" rx="8" class="pic-bg" fill="#f4f1ea"/>'
            '<rect x="14" y="14" width="64" height="26" rx="5" fill="#fff" stroke="#9aa4ae"/><text x="46" y="32" font-size="13" text-anchor="middle" font-family="system-ui, sans-serif">+ New</text>'
            '<rect x="40" y="48" width="186" height="88" rx="6" fill="#fff" stroke="#9aa4ae"/>'
            '<text x="52" y="68" font-size="11" fill="#5b6670" font-family="system-ui, sans-serif">Examples that run live</text>'
            '<text x="52" y="88" font-size="12" font-family="system-ui, sans-serif">Look first</text>'
            '<rect x="46" y="98" width="174" height="24" rx="4" fill="#ffe3cc"/>'
            '<text x="52" y="115" font-size="12" font-weight="700" font-family="system-ui, sans-serif">Toolbox: subroutines</text></svg>')


def step_html(index, title, image, text, special):
    if special == "qr":
        picture = '<div class="qr">%s</div>' % qr_svg()
    elif special == "toolbox":
        picture = toolbox_svg()
    elif image == "map2":
        m = MAPS[1]
        picture = map_svg(2, m["size"][0], m["size"][1], m["start"], m["items"], "Map 2: the star behind the box")
    else:
        w, h = png_size(image)
        picture = '<img class="blocks" src="../img/blockly-guide-%s.png" alt="Blocks: %s" width="%d" height="%d">' % (image, title, w // 2, h // 2)
    return ('    <div class="step">\n      <div class="step-head"><span class="num">%d</span>%s</div>\n      <div class="pic">%s</div>\n      <p>%s</p>\n    </div>\n'
            % (index, title, picture, text))


def map_card(number, m):
    svg = map_svg(number, m["size"][0], m["size"][1], m["start"], m["items"], "Map %d: %s" % (number, m["name"]))
    return ('    <div class="map">\n      <div class="step-head"><span class="num">%d</span>%s</div>\n      <div class="pic">%s</div>\n'
            '      <p>%s</p>\n      <p class="use"><b>Use:</b> %s</p>\n    </div>\n' % (number, m["name"], svg, m["goal"], m["use"]))


STYLE = """
  :root { --ink: #1c1f24; --dim: #5b6670; --orange: #c24400; --blue: #0b6fb3; --mono: ui-monospace, "Cascadia Mono", Menlo, Consolas, monospace; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #e9ecef; }
  body { color: var(--ink); font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; font-size: 14px; line-height: 1.35; }
  .sheet { background: #fff; max-width: 8.5in; margin: 16px auto; padding: 0.4in 0.45in; box-shadow: 0 2px 14px rgba(0,0,0,0.15); }
  .top { display: flex; align-items: center; gap: 14px; margin-bottom: 6px; }
  .top img { height: 64px; width: auto; }
  .top h1 { font-size: 24px; margin: 0; line-height: 1.1; }
  .top .sub { color: var(--dim); font-size: 13px; }
  .note { background: #fff4e5; border-left: 4px solid var(--orange); padding: 6px 10px; margin: 8px 0 12px; font-size: 13px; }
  .steps, .maps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .maps { grid-template-columns: repeat(5, 1fr); }
  .step, .map { border: 1.5px solid #c9ced4; border-radius: 10px; padding: 7px 8px; display: flex; flex-direction: column; }
  .step-head { font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 6px; }
  .num { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: var(--orange); color: #fff; font-size: 13px; flex: none; }
  .pic { display: flex; align-items: center; justify-content: center; min-height: 1.3in; margin: 5px 0 2px; }
  .pic img.blocks { max-width: 100%; max-height: 1.45in; width: auto; height: auto; }
  .pic svg { max-width: 100%; max-height: 1.45in; width: auto; height: auto; display: block; }
  .map .pic { min-height: 1.6in; }
  .map .pic svg { max-height: 1.75in; }
  .qr svg { width: 1.2in; height: 1.2in; }
  .step p, .map p { margin: 5px 0 0; font-size: 13px; }
  .map p.use { color: var(--dim); font-size: 12px; }
  .sheet a { color: var(--blue); }
  .tips { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 12px; font-size: 12.5px; }
  .tips div { background: #f4f6f8; border-radius: 8px; padding: 6px 9px; }
  @media (max-width: 760px) { .steps, .maps { grid-template-columns: repeat(2, 1fr); } .tips { grid-template-columns: 1fr; } .sheet { padding: 16px; } }
  @media print {
    @page { size: letter; margin: 0.3in 0.3in 0.45in;
      @bottom-center { content: "Maker Lab Kids \\00B7  robotics.makerlabkids.com"; font: 10px system-ui, sans-serif; color: #555; } }
    .sheet a { color: inherit; }
    .print-link { display: none; }
    .top img { height: 52px; }
    html, body { background: #fff; }
    .sheet { box-shadow: none; margin: 0; padding: 0; max-width: none; }
    .sheet + .sheet { break-before: page; page-break-before: always; }
    .pic-bg { fill: #fff; }
    .num { background: none; color: var(--orange); border: 2px solid var(--orange); }
    .note { background: none; }
    .tips div { background: none; border: 1px solid #c9ced4; }
  }
"""


def build():
    steps = "".join(step_html(i + 1, *step) for i, step in enumerate(STEPS))
    maps = "".join(map_card(i + 1, m) for i, m in enumerate(MAPS))
    return """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Programming with Blockly %(version)s - Maker Lab Kids</title>
<meta name="description" content="Start programming the mecanum robot with Blockly in the simulator: first moves, repeat, variables, subroutines, sensors and if, then ten maps to solve.">
<!-- written by scripts/blockly-guide.py: edit that, then run it and node scripts/site-nav.js -->
<style>%(style)s</style>
<link rel="stylesheet" href="/css/nav.css">
</head>
<body>
<!-- mlk-nav: written by scripts/site-nav.js, do not edit here -->
<!-- /mlk-nav -->
<div class="sheet">
  <div class="top">
    <img src="../img/lockup.png" alt="Maker Lab Kids" width="300" height="99">
    <div><h1>Programming with Blockly</h1><div class="sub">In the simulator first. Simple things first. <span class="print-link">Print it: <a href="../resources/blockly-guide.pdf">PDF</a></span></div></div>
  </div>
  <div class="note">Every program starts under <b>when RUN is pressed</b>. Press <b>RUN</b> to try it, <b>STOP</b> to stop it,
  <b>Back to start</b> to put the robot back. Mistakes are fine: change one thing and run it again.</div>
  <div class="steps">
%(steps)s  </div>
</div>
<div class="sheet">
  <div class="top">
    <img src="../img/lockup.png" alt="Maker Lab Kids" width="300" height="99">
    <div><h1>Ten maps</h1><div class="sub">Pick one under the simulator: <b>Map</b>. The star says when you made it.</div></div>
  </div>
  <div class="note">Maps <b>4 to 10 change every run</b>: the wall moves, the door opens and closes, the lamp goes dark.
  A program that only counts millimeters will miss. Use the <b>sensors</b> and <b>if</b> to decide.</div>
  <div class="maps">
%(maps)s  </div>
  <div class="tips">
    <div><b>Made it?</b> The Console says <b>&#9733; Made it!</b> with your time, bumps and catches. Run it again: does it still work?</div>
    <div><b>Stuck?</b> Put <b>say</b> blocks in your program to see what the sensor reads, and slow the simulator to <b>real time</b>.</div>
    <div><b>Need a hand?</b> <b>+ New</b>, <b>Toolbox: subroutines</b>: copy a ready-made subroutine into your tab (Ctrl+C, Ctrl+V).</div>
  </div>
</div>
<!-- mlk-foot -->
<!-- /mlk-foot -->
</body>
</html>
""" % dict(version=VERSION, style=STYLE, steps=steps, maps=maps)


with open(PAGE, "w", encoding="utf-8") as f:
    f.write(build())
print("wrote mecanum/blockly-guide.html")
