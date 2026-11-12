# Writes mecanum/blockly-tips.html, "Blockly tips and tricks": a printable two-page sheet in
# the step-sheet style of Programming with Blockly. Page 1: the basics and variables (start
# one with a number, math, text or a sensor). Page 2: subroutines, the gears and the menus
# that are easy to miss. The cards marked hidden are the ones nobody finds by looking.
# Pictures: img/blockly-tips-<name>.png from scripts/blockly-tips-shots.js.
# Run: node scripts/blockly-tips-shots.js, python3 scripts/blockly-tips.py,
# node scripts/site-nav.js, PDF: node temp/print-tips.js (copy to resources/blockly-tips.pdf)
import os
import struct

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
PAGE = os.path.join(ROOT, "mecanum", "blockly-tips.html")
VERSION = "0.1.0"

KEYS = [
    ("Ctrl+C, Ctrl+V", "copy, paste (other tabs too)"),
    ("Ctrl+X", "cut"),
    ("Ctrl+Z, Ctrl+Y", "undo, redo"),
    ("Delete", "delete it"),
    ("D", "duplicate it"),
    ("X", "pull it out of its stack"),
    ("C", "clean up: line blocks up"),
]

# (title, picture, text, hidden)
PAGE1 = [
    ("Snap it on, or it does nothing", "loose",
     'Only blocks under <b>when RUN is pressed</b> (or in a subroutine) run. A loose block turns <b>gray</b> and is skipped.', False),
    ("Pull out just one block", "pull",
     'A drag takes every block under it too. Hold <b>Ctrl</b> while you drag to take just that one. Or click it, press <b>X</b>.', True),
    ("Duplicate", "duplicate",
     '<b>Right-click</b>, <b>Duplicate</b>: a copy of the block and all inside it. Faster: click it, press <b>D</b>.', True),
    ("Keys", "keys",
     'Click a block first. Mac: <b>Cmd</b> for Ctrl.', True),
    ("Numbers are slots", "slot",
     'Click a number to type. Drop a <b>variable</b> or a <b>math</b> block on it. Drag that out: the number comes back.', True),
    ("Make a variable", "newvar",
     'A box with a name, for a number or some text. <b>Variables</b>, <b>Create variable...</b>, type a name like <b>side</b>.', False),
    ("Start it with a number", "number",
     '<b>set side to 300</b>, then put the round <b>side</b> where a number goes. Change 300 once: every move follows.', False),
    ("Start it with math", "math",
     'Drop a <b>Math</b> block in: <b>100 &times; 3</b>, or <b>random integer 200 to 600</b> for a new number every run.', False),
    ("Start it with text", "text",
     'The <b>" "</b> block (<b>Text</b>) holds words. <b>create text with</b> glues words and numbers together for <b>say</b>.', False),
    ("Start it from a sensor", "sensor",
     '<b>set wall to sonar distance</b> keeps what the sonar saw right then. Read it again later: did it change?', False),
    ("Change it as you go", "change",
     '<b>change side by 100</b> adds 100 each time round: a spiral. <b>-100</b> makes it smaller.', False),
    ("Rename or delete it", "vardrop",
     'Click the <b>triangle</b> on a variable: pick another one, <b>Rename</b> it everywhere, or <b>Delete</b> it.', True),
]

PAGE2 = [
    ("Make a subroutine", "submake",
     'Drag <b>subroutine</b> out of <b>Subroutines</b>, click its name to rename it, fill it. Its call (<b>square</b>) is in <b>Subroutines</b> now.', False),
    ("The gear adds inputs", "subgear",
     'Click the <b>gear</b>. Drag <b>input name</b> into <b>inputs</b>, click the <b>x</b>, type <b>size</b>. Click the gear again to close.', True),
    ("Use the input inside", "subget",
     'An input is a variable. <b>Right-click</b> the subroutine: <b>Create \'get size\'</b> makes its block, <b>Create \'square\'</b> a call.', True),
    ("Give it a value", "subcall",
     'Each call now has a slot: <b>square with size 300</b>, then <b>600</b>. One subroutine, any size.', False),
    ("A subroutine that answers", "subreturn",
     'The second <b>subroutine</b> block ends in <b>return</b>: it gives back a number, so its call fits in a slot.', True),
    ("Where is that subroutine?", "highlight",
     '<b>Right-click</b> a call: <b>Highlight function definition</b> shows the subroutine it runs.', True),
    ("Gears on if and text", "ifgear",
     'On <b>if</b>: drag in <b>else if</b> and <b>else</b>. On <b>create text with</b> and <b>create list with</b>: more <b>items</b>.', True),
    ("Notes for people", "comment",
     '<b>Right-click</b>, <b>Add Comment</b>. Click the <b>?</b> to read it. The program ignores it. Subroutines come with one.', True),
    ("Turn a block off", "disable",
     '<b>Right-click</b>, <b>Disable Block</b>: it is skipped. Run it with and without. <b>Enable Block</b> turns it back on.', True),
    ("Fold it up", "collapse",
     '<b>Right-click</b>, <b>Collapse Block</b>: one short line. It still runs. <b>Expand Block</b> opens it.', True),
    ("Right-click empty space", "wsmenu",
     '<b>Clean up Blocks</b> lines them up. <b>Collapse</b> or <b>Expand</b> all. <b>Delete</b> all (Ctrl+Z brings them back).', True),
    ("Run another program", "runprogram",
     '<b>run program</b> (<b>Start</b>) runs another tab, then goes on. Two <b>when RUN</b> blocks: the top one runs first.', True),
]

TIPS = [
    ('<b>What does it do?</b> Rest the mouse on a block: a hint pops up.'),
    ('<b>Set it first.</b> A variable never set is empty: <b>set</b> it at the top.'),
    ('<b>Watch it.</b> <b>say</b> a variable each time round, simulator at <b>real time</b>.'),
    ('<b>Keep it.</b> Programs live in this browser. <b>Share / phone...</b> saves a file.'),
]


def png_size(name):
    with open(os.path.join(ROOT, "img", "blockly-tips-%s.png" % name), "rb") as f:
        head = f.read(24)
    return struct.unpack(">II", head[16:24])


def keys_html():
    rows = "".join('<tr><td><kbd>%s</kbd></td><td>%s</td></tr>' % (k.replace(", ", "</kbd> <kbd>"), what) for k, what in KEYS)
    return '<table class="keys">%s</table>' % rows


def card(index, title, image, text, hidden):
    if image == "keys":
        picture = keys_html()
    else:
        w, h = png_size(image)
        picture = '<img class="blocks" src="../img/blockly-tips-%s.png" alt="Blocks: %s" width="%d" height="%d">' % (image, title, w // 2, h // 2)
    flag = '<span class="hidden" title="Hard to find by looking">hidden</span>' if hidden else ""
    return ('    <div class="step%s">\n      <div class="step-head"><span class="num">%d</span>%s%s</div>\n      <div class="pic%s">%s</div>\n      <p>%s</p>\n    </div>\n'
            % (" is-hidden" if hidden else "", index, title, flag, " keys-pic" if image == "keys" else "", picture, text))


STYLE = """
  :root { --ink: #1c1f24; --dim: #5b6670; --orange: #c24400; --blue: #0b6fb3; --purple: #6b3fa0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #e9ecef; }
  body { color: var(--ink); font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; font-size: 14px; line-height: 1.35; }
  .sheet { background: #fff; max-width: 8.5in; margin: 16px auto; padding: 0.4in 0.45in; box-shadow: 0 2px 14px rgba(0,0,0,0.15); }
  .top { display: flex; align-items: center; gap: 14px; margin-bottom: 6px; }
  .top img { height: 64px; width: auto; }
  .top h1 { font-size: 24px; margin: 0; line-height: 1.1; }
  .top .sub { color: var(--dim); font-size: 13px; }
  .note { background: #fff4e5; border-left: 4px solid var(--orange); padding: 6px 10px; margin: 8px 0 12px; font-size: 13px; }
  .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 10px; }
  .step { border: 1.5px solid #c9ced4; border-radius: 10px; padding: 6px 8px; display: flex; flex-direction: column; }
  .step.is-hidden { border-color: #b9a3d6; }
  .step-head { font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 6px; line-height: 1.15; }
  .num { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: var(--orange); color: #fff; font-size: 13px; flex: none; }
  .hidden { margin-left: auto; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--purple); border: 1.5px solid var(--purple); border-radius: 9px; padding: 0 5px; flex: none; }
  .pic { display: flex; align-items: center; justify-content: center; height: 1.2in; margin: 3px 0 1px; overflow: hidden; }
  .pic.keys-pic { height: auto; }
  .pic img.blocks { max-width: 100%; max-height: 1.2in; width: auto; height: auto; }
  .keys { border-collapse: collapse; font-size: 11.5px; width: 100%; line-height: 1.2; }
  .keys td { padding: 1px 3px; vertical-align: top; }
  .keys td:first-child { white-space: nowrap; }
  kbd { font: 700 11px ui-monospace, Menlo, Consolas, monospace; border: 1px solid #9aa4ae; border-bottom-width: 2px; border-radius: 4px; padding: 0 3px; background: #f7f8f9; }
  .step p { margin: 3px 0 0; font-size: 12px; line-height: 1.28; }
  .sheet a { color: var(--blue); }
  .tips { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px 10px; margin: 6px 0 8px; font-size: 11.5px; line-height: 1.25; }
  .tips div { background: #f4f6f8; border-radius: 8px; padding: 4px 8px; }
  @media (max-width: 760px) { .steps { grid-template-columns: repeat(2, 1fr); } .tips { grid-template-columns: 1fr; } .sheet { padding: 16px; } .top img { height: 44px; } }
  @media (max-width: 420px) { .steps { grid-template-columns: 1fr; } }
  @media print {
    @page { size: letter; margin: 0.3in 0.3in 0.45in;
      @bottom-center { content: "Maker Lab Kids \\00B7  robotics.makerlabkids.com"; font: 10px system-ui, sans-serif; color: #555; } }
    .sheet a { color: inherit; }
    .print-link { display: none; }
    .top img { height: 46px; }
    .note { margin: 6px 0 8px; padding: 4px 10px; }
    html, body { background: #fff; }
    .sheet { box-shadow: none; margin: 0; padding: 0; max-width: none; }
    .sheet + .sheet { break-before: page; page-break-before: always; }
    .num { background: none; color: var(--orange); border: 2px solid var(--orange); }
    .note { background: none; }
    .tips div { background: none; border: 1px solid #c9ced4; }
    kbd { background: none; }
  }
"""


def build():
    page1 = "".join(card(i + 1, *c) for i, c in enumerate(PAGE1))
    page2 = "".join(card(i + 13, *c) for i, c in enumerate(PAGE2))
    tips = "".join("    <div>%s</div>\n" % t for t in TIPS)
    return """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Blockly Tips and Tricks %(version)s - Maker Lab Kids</title>
<meta name="description" content="Tips for programming the mecanum robot in Blockly: the basics, variables started with numbers, math, text or sensors, subroutines with inputs, the gears, right-click menus and keys that are easy to miss.">
<!-- written by scripts/blockly-tips.py: edit that, then run it and node scripts/site-nav.js -->
<style>%(style)s</style>
<link rel="stylesheet" href="/css/nav.css">
</head>
<body>
<!-- mlk-nav: written by scripts/site-nav.js, do not edit here -->
<!-- /mlk-nav -->
<div class="sheet">
  <div class="top">
    <img src="../img/lockup.png" alt="Maker Lab Kids" width="300" height="99">
    <div><h1>Blockly tips and tricks</h1><div class="sub">The basics, variables, and the handy things nobody finds by looking. <span class="print-link">Print it: <a href="../resources/blockly-tips.pdf">PDF</a>. New to Blockly? <a href="/mecanum/blockly-guide">Programming with Blockly</a>.</span></div></div>
  </div>
  <div class="note"><b>Click</b> a block to pick it. <b>Right-click</b> it for its menu. A <b>gear</b> changes its shape, a <b>triangle</b> is a list
  to choose from, a <b>?</b> is a note. Cards marked <span class="hidden">hidden</span> are tricks you only find if someone shows you.</div>
  <div class="steps">
%(page1)s  </div>
</div>
<div class="sheet">
  <div class="top">
    <img src="../img/lockup.png" alt="Maker Lab Kids" width="300" height="99">
    <div><h1>Subroutines, gears and menus</h1><div class="sub">Make your own blocks. Then the menus that hide behind a right-click.</div></div>
  </div>
  <div class="tips">
%(tips)s  </div>
  <div class="steps">
%(page2)s  </div>
</div>
<!-- mlk-foot -->
<!-- /mlk-foot -->
</body>
</html>
""" % dict(version=VERSION, style=STYLE, page1=page1, page2=page2, tips=tips)


with open(PAGE, "w", encoding="utf-8") as f:
    f.write(build())
print("wrote mecanum/blockly-tips.html")
