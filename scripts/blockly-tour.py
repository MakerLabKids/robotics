# Writes mecanum/blockly-tour.html, "The Blockly screen": page 1 is the whole Blockly
# editor with a numbered marker on every part and what it does; page 2 has close-ups
# (the simulator, a block and its right-click menu, the console) with more callouts.
# The screenshots and the marker positions come from node scripts/blockly-tour-shots.js
# (img/blockly-tour-*.png, scripts/blockly-tour-points.json); run that first when the
# editor changes, then: python3 scripts/blockly-tour.py and node scripts/site-nav.js
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
PAGE = os.path.join(ROOT, "mecanum", "blockly-tour.html")
VERSION = "0.1.0"
POINTS = json.load(open(os.path.join(HERE, "blockly-tour-points.json")))
B = POINTS["full"]["boxes"]
W, H = POINTS["full"]["width"], POINTS["full"]["height"]


def at(box, where="tl", dx=0, dy=0):
    x, y, w, h = box["x"], box["y"], box["w"], box["h"]
    spots = {"tl": (x + 3, y + 3), "tr": (x + w - 3, y + 3), "c": (x + w / 2, y + h / 2), "l": (x - 2, y + h / 2), "r": (x + w + 2, y + h / 2), "t": (x + w / 2, y - 2)}
    sx, sy = spots[where]
    return sx + dx, sy + dy


def picture(image, view, markers, label, radius, height=None):
    vx, vy, vw, vh = view
    out = ['<svg class="shot" viewBox="%.1f %.1f %.1f %.1f" role="img" aria-label="%s">' % (vx, vy, vw, vh, label),
           '<image href="../img/%s" x="0" y="0" width="%d" height="%d"/>' % (image, W, height or H),
           '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="none" stroke="#9aa4ae" stroke-width="%.1f"/>' % (vx, vy, vw, vh, radius / 6)]
    for number, (x, y) in markers:
        out.append('<g class="marker"><circle cx="%.1f" cy="%.1f" r="%.1f" fill="#c24400" stroke="#fff" stroke-width="%.1f"/>'
                   '<text x="%.1f" y="%.1f" font-size="%.1f" font-weight="700" fill="#fff" text-anchor="middle" font-family="system-ui, sans-serif">%s</text></g>'
                   % (x, y, radius, radius / 5, x, y + radius * 0.36, radius * 1.05, number))
    out.append("</svg>")
    return "".join(out)


def legend(entries, cls="legend"):
    rows = "".join('<li><span class="n">%s</span><span><b>%s</b> %s</span></li>' % (n, name, text) for n, name, text in entries)
    return '<ol class="%s">%s</ol>' % (cls, rows)


# ---------------------------------------------------------------- page 1
PAGE1 = [
    ("1", B["robotChip"], "tl", "Robot", "Whose tabs these are. Leave it on <i>shared</i>. Connecting a robot never changes your tabs."),
    ("2", B["tabs"], "tl", "Program tabs", "Each tab is one program. Click one to open it. Tabs 1 to 9 are also the remote's slots 1 to 9."),
    ("3", B["newProgram"], "tl", "+ New", "A blank program, a copy of a demo, an example (like <i>Look first</i>), or the <i>Toolbox</i> of subroutines."),
    ("4", B["programMenu"], "tl", "This program...", "Rename, duplicate or delete the open program."),
    ("5", B["undo"], "tl", "Undo, redo", "Take back the last change (Ctrl+Z), or put it back."),
    ("6", B["run"], "tl", "RUN", "Runs the program in the open tab, on the simulator or on the robot."),
    ("7", B["stop"], "tl", "STOP", "Stops the program and the wheels. Always works."),
    ("8", B["runOn"], "tl", "Run on", "<i>Simulator</i>: the pretend robot on the right. <i>Robot</i>: your real robot, once connected."),
    ("9", B["serial"], "tl", "Serial, Bluetooth", "Connect to your robot: <i>Serial</i> with a USB cable, <i>Bluetooth</i> without one."),
    ("10", B["status"], "tl", "Connection", "Says <i>not connected</i> or how the robot is connected."),
    ("11", B["sketch"], "tl", "Sketch", "Which program is on the robot's Arduino. It picks itself when the robot connects."),
    ("12", B["slots"], "tl", "Remote slots...", "Turns the program into a remote slot, sends it to the robot, or reads the robot's slots back."),
    ("13", B["share"], "tl", "Share / phone...", "A link, a QR code, the program as text or a file. <i>Bring a program in</i> pastes one back."),
    ("14", B["help"], "tl", "Help", "What the buttons and blocks do."),
    ("15", B["toolbox"], "tr", "Categories", "Click one to see its blocks, then drag a block out onto the workspace."),
    ("16", {"x": 560, "y": 640, "w": 0, "h": 0}, "tl", "Workspace", "Build the program here. Only blocks under <i>when RUN is pressed</i> run. Drag empty space to move around."),
    ("17", B["zoom"], "l", "Center, zoom", "Bring the blocks back into view, make them bigger or smaller."),
    ("18", B["trash"], "l", "Trash", "Drag a block here to delete it (or select it and press Delete)."),
    ("19", B["mat"], "l", "Simulator", "The pretend robot on a floor, 10 cm squares. Drag the robot to choose where it starts."),
    ("20", B["readout"], "l", "Readout", "Where the robot is, which way it faces, and what the sonar sees."),
    ("21", B["task"], "l", "Map goal", "What to do on this map. Reach the star to see <i>Made it!</i>"),
    ("22", B["controls"], "l", "Simulator controls", "Pick a <i>Map</i>, the <i>Speed</i>, the <i>View</i>, a bigger picture, and <i>Back to start</i>."),
    ("23", B["paneTabs"], "l", "Console, The robot will do, Code", "What happened, the list of moves your program makes, and the program as code."),
    ("24", B["console"], "l", "Console", "Every move, every <i>say</i> block, and every message from the robot."),
    ("25", B["consoleInput"], "l", "Command box", "Type a robot command (like <i>u</i> for the sonar) and press Send. <i>Clear</i> empties the console."),
]
page1_svg = picture("blockly-tour-full.png", (0, 0, W, H), [(n, at(box, where)) for n, box, where, _, _ in PAGE1],
                    "The Blockly screen with numbered markers on every part", 17)
page1_legend = legend([(n, name, text) for n, _, _, name, text in PAGE1])

# ---------------------------------------------------------------- page 2: the simulator
S = POINTS["closeUps"]["simulator"]
SIM = [
    ("A", B["robot"], "c", "The robot", "Drag it to choose where it starts. RUN and <i>Back to start</i> put it there. The orange arrow is its nose."),
    ("B", B["star"], "c", "The star", "The goal. Reach it and the console says <i>Made it!</i> with your time and bumps."),
    ("C", B["wall"], "c", "Walls", "The sonar sees them and the robot bumps into them. On some maps they move, or open and close."),
    ("D", B["sonarLine"], "c", "Dashed line", "What the sonar sees: straight ahead, to the nearest wall."),
    ("E", B["readout"], "l", "Readout", "Position, heading and the sonar reading. Watch it while the program runs."),
    ("F", B["map"], "r", "Map", "Ten floors, from easy to hard. From map 4 on, something changes every run."),
    ("G", B["speed"], "r", "Speed", "<i>real time</i> to watch closely, faster to finish quickly."),
    ("H", B["view"], "r", "View", "The whole floor, or close up around the robot."),
    ("I", B["bigger"], "t", "Bigger, Full screen", "A bigger simulator, or the whole screen (Esc to leave)."),
    ("J", B["walls"], "t", "walls, size", "The room's walls on or off, and its size in mm."),
    ("K", B["back"], "r", "Back to start", "Puts the robot back where it starts (press STOP first)."),
]
sim_svg = picture("blockly-tour-full.png", (S["x"], S["y"], S["width"], S["height"]), [(n, at(box, where)) for n, box, where, _, _ in SIM],
                  "Close-up of the simulator with lettered markers", 13)
sim_legend = legend([(n, name, text) for n, _, _, name, text in SIM], "legend small")

# ---------------------------------------------------------------- page 2: a block
M = POINTS["menu"]["menu"]
blk = M["ifBlock"]
block_view = (blk["x"] - 40, blk["y"] - 28, blk["w"] + 60, blk["h"] + 50)
BLOCK = [
    ("a", M["gear"], "l", "Gear", "Changes the block: here it adds <i>else if</i> and <i>else</i>. Subroutines use it to add inputs."),
    ("b", M["dropdown"], "t", "Dropdown", "Click the little triangle to choose: <i>sonar</i> or <i>laser</i>, <i>right</i> or <i>left</i>."),
    ("c", M["number"], "t", "Number", "Click it and type. You can also drop a variable or a math block on it."),
    ("d", M["turn"], "l", "Snap", "Blocks snap together top to bottom. The ones inside <i>do</i> and <i>else</i> are what <i>if</i> does."),
]
block_svg = picture("blockly-tour-full.png", block_view, [(n, at(box, where)) for n, box, where, _, _ in BLOCK],
                    "Close-up of an if block with lettered markers", 11)

menu_view = (M["x"] - 12, M["y"] - 12, M["w"] + 24, M["h"] + 24)
MENU_TEXT = {
    "Duplicate": "a copy, right next to it",
    "Add Comment": "a note for people (the program ignores it)",
    "Inline Inputs": "the inputs in one row or stacked",
    "Collapse Block": "fold it up small (Expand opens it again)",
    "Disable Block": "the program skips it for now",
    "Delete": "the block and everything inside it",
    "Help": "about this kind of block",
}
MENU = []
letters = "efghijk"
for index, item in enumerate(M["items"][:7]):
    name = next((key for key in MENU_TEXT if item["text"].startswith(key)), item["text"])
    MENU.append((letters[index], {"x": item["x"] + item["w"] - 14, "y": item["y"] + item["h"] / 2, "w": 0, "h": 0}, "tl", name, MENU_TEXT.get(name, "")))
menu_svg = picture("blockly-tour-menu-full.png", menu_view, [(n, at(box, where)) for n, box, where, _, _ in MENU],
                   "The right-click menu of a block", 9)
block_legend = legend([(n, name, text) for n, _, _, name, text in BLOCK] +
                      [("e-k", "Right-click a block", "for this menu:")] +
                      [(n, name, text) for n, _, _, name, text in MENU], "legend small two")

# ---------------------------------------------------------------- page 2: the console
C = POINTS["console"]
area = C["area"]
console_view = (area["x"] - 2, area["y"] - 4, area["w"] + 4, area["h"] + 8)
kinds = [("1", "plain", "A message from the page: what it is doing."),
         ("2", "&rarr;", "A command the page sent to the robot."),
         ("3", "&larr;", "What the robot answered."),
         ("4", "sim:", "What the pretend robot did."),
         ("5", "says:", "A <i>say</i> block in your program."),
         ("6", "&#9888;", "A warning: something to look at."),
         ("7", "&#10006;", "An error: the program stopped."),
         ("8", "&#9733; Made it!", "You reached the star.")]
CONSOLE = [(n, {"x": line["x"] + line["w"] - 22, "y": line["y"] + line["h"] / 2, "w": 0, "h": 0}, "tl", name, text) for (n, name, text), line in zip(kinds, C["lines"])]
CONSOLE += [("9", C["willdoTab"], "tl", "The robot will do", "The moves your program will make, worked out before it runs."),
            ("10", C["codeTab"], "tl", "Code", "Your blocks as JavaScript code."),
            ("11", C["clear"], "tl", "Clear", "Empties the console (or use the <i>clear the console</i> block).")]
console_svg = picture("blockly-tour-console-full.png", console_view, [(n, at(box, where)) for n, box, where, _, _ in CONSOLE],
                      "Close-up of the console with numbered markers", 11, POINTS.get("consoleHeight"))
console_legend = legend([(n, name, text) for n, _, _, name, text in CONSOLE], "legend small two")

STYLE = """
  :root { --ink: #1c1f24; --dim: #5b6670; --orange: #c24400; --blue: #0b6fb3; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #e9ecef; }
  body { color: var(--ink); font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; font-size: 14px; line-height: 1.35; }
  .sheet { background: #fff; max-width: 8.5in; margin: 16px auto; padding: 0.4in 0.45in; box-shadow: 0 2px 14px rgba(0,0,0,0.15); }
  .top { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; }
  .top img { height: 60px; width: auto; }
  .top h1 { font-size: 24px; margin: 0; line-height: 1.1; }
  .top .sub { color: var(--dim); font-size: 13px; }
  svg.shot { width: 100%; height: auto; display: block; }
  .legend { list-style: none; margin: 8px 0 0; padding: 0; columns: 3; column-gap: 14px; font-size: 10.5px; line-height: 1.28; }
  .legend li { display: flex; gap: 5px; break-inside: avoid; margin: 0 0 4px; }
  .legend .n { flex: none; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 10px; background: var(--orange); color: #fff; font-weight: 700; font-size: 11px; display: inline-flex; align-items: center; justify-content: center; }
  .legend.small { columns: 1; font-size: 10.5px; margin-top: 6px; }
  .legend.two { columns: 2; }
  .details { display: grid; grid-template-columns: 1fr 1.5fr; gap: 12px; }
  .panel { border: 1.5px solid #c9ced4; border-radius: 10px; padding: 8px; }
  .panel h2 { font-size: 15px; margin: 0 0 6px; }
  .panel + .panel { margin-top: 12px; }
  .pair { display: grid; grid-template-columns: 1.6fr 1fr; gap: 8px; align-items: start; }
  .con svg.shot { max-height: 2.2in; width: auto; max-width: 100%; margin: 0 auto; }
  .sim svg.shot { max-height: 3.9in; width: auto; max-width: 100%; margin: 0 auto; }
  .tips { margin-top: 10px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 11px; }
  .tips div { background: #f4f6f8; border-radius: 8px; padding: 6px 9px; }
  .sheet a { color: var(--blue); }
  @media (max-width: 760px) { .legend { columns: 1; } .details, .pair, .tips { grid-template-columns: 1fr; } .sheet { padding: 16px; } }
  @media print {
    @page { size: letter; margin: 0.3in 0.3in 0.45in;
      @bottom-center { content: "Maker Lab Kids \\00B7  robotics.makerlabkids.com"; font: 10px system-ui, sans-serif; color: #555; } }
    html, body { background: #fff; }
    .sheet { box-shadow: none; margin: 0; padding: 0; max-width: none; }
    .sheet + .sheet { break-before: page; page-break-before: always; }
    .top img { height: 48px; }
    .legend .n { background: none; color: var(--orange); border: 1.5px solid var(--orange); }
    .tips div { background: none; border: 1px solid #c9ced4; }
    .sheet a { color: inherit; }
    .print-link { display: none; }
  }
"""

HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>The Blockly Screen %(version)s - Maker Lab Kids</title>
<meta name="description" content="A labeled picture of the Blockly editor for the mecanum robot: what every button, tab and panel is and what it does, with close-ups of the simulator, a block and the console.">
<!-- written by scripts/blockly-tour.py: edit that, then run it and node scripts/site-nav.js -->
<style>%(style)s</style>
<link rel="stylesheet" href="/css/nav.css">
</head>
<body>
<!-- mlk-nav: written by scripts/site-nav.js, do not edit here -->
<!-- /mlk-nav -->
<div class="sheet">
  <div class="top">
    <img src="../img/lockup.png" alt="Maker Lab Kids" width="300" height="99">
    <div><h1>The Blockly screen</h1><div class="sub">What everything is and what it does. <span class="print-link">Print it: <a href="../resources/blockly-tour.pdf">PDF</a>. Next: <a href="/mecanum/blockly-guide">Programming with Blockly</a>.</span></div></div>
  </div>
  %(page1_svg)s
  %(page1_legend)s
</div>
<div class="sheet">
  <div class="top">
    <img src="../img/lockup.png" alt="Maker Lab Kids" width="300" height="99">
    <div><h1>A closer look</h1><div class="sub">The simulator, a block and its menu, and the console.</div></div>
  </div>
  <div class="details">
    <div class="panel sim">
      <h2>The simulator</h2>
      %(sim_svg)s
      %(sim_legend)s
    </div>
    <div>
      <div class="panel">
        <h2>A block, and its right-click menu</h2>
        <div class="pair">%(block_svg)s%(menu_svg)s</div>
        %(block_legend)s
      </div>
      <div class="panel con">
        <h2>The console</h2>
        %(console_svg)s
        %(console_legend)s
      </div>
    </div>
  </div>
  <div class="tips">
    <div><b>Copy and paste:</b> click a block, Ctrl+C, then Ctrl+V. It works from one tab to another too.</div>
    <div><b>Lost your blocks?</b> Press the center button (17 on page 1), or drag the empty workspace.</div>
    <div><b>Saved by itself:</b> your tabs stay in this browser. To keep a copy, use <i>Share / phone...</i>, <i>Save as a file</i>.</div>
  </div>
</div>
<!-- mlk-foot -->
<!-- /mlk-foot -->
</body>
</html>
"""

with open(PAGE, "w", encoding="utf-8") as f:
    f.write(HTML % dict(version=VERSION, style=STYLE, page1_svg=page1_svg, page1_legend=page1_legend, sim_svg=sim_svg, sim_legend=sim_legend,
                        block_svg=block_svg, menu_svg=menu_svg, block_legend=block_legend, console_svg=console_svg, console_legend=console_legend))
print("wrote mecanum/blockly-tour.html")
