# Writes mecanum/blockly-debug.html, "Debugging with Blockly": a printable two-page sheet in
# the style of Blockly tips and tricks. Page 1: finding a bug (the console, say, read a sensor
# once, start clean, undefined, simulator first, one change at a time). Page 2: organizing a
# program (subroutines, input names, shared variables, tabs) and asking the real robot
# (console commands, measuring, sonar -1, the robot lines).
# Pictures: img/blockly-debug-<name>.png and the console lines in
# scripts/blockly-debug-console.json, both from scripts/blockly-debug-shots.js (the console
# lines are what the simulator really said). The robot lines on page 2 are written here in the
# firmware's own formats (programming.ino / ir.ino): keep them in step with the sketches.
# Run: node scripts/blockly-debug-shots.js, python3 scripts/blockly-debug.py,
# node scripts/site-nav.js, PDF: node temp/print-debug.js (copy to resources/blockly-debug.pdf)
import html
import json
import os
import re
import struct

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
PAGE = os.path.join(ROOT, "mecanum", "blockly-debug.html")
VERSION = "0.1.0"
CONSOLE = json.load(open(os.path.join(HERE, "blockly-debug-console.json"), encoding="utf-8"))


def console_lines(scene, first=None, last=None, pick=None):
    lines = CONSOLE[scene]
    if pick is not None:
        lines = [lines[i] for i in pick]
    else:
        lines = lines[first:last]
    return [(kind, text) for kind, text in lines]


def robot(*pairs):
    """Robot console lines, written here: (kind, text) with kind sent / robot / say / app."""
    prefixes = {"sent": "→ ", "robot": "← ", "say": "says: ", "app": ""}
    return [(kind, prefixes[kind] + text) for kind, text in pairs]


COMMANDS = [
    ("u", "the sonar: <code>U,412</code> is 412 mm, <code>U,-1</code> nothing in range"),
    ("b", "the light sensors: <code>B,</code>direction, brightest, left, right (0 to 1000)"),
    ("p?;", "what is saved in the remote slots"),
    ("x", "stop the wheels"),
    ("?", "the list of every command"),
]

# (title, picture, console lines, text, tag)
PAGE1 = [
    ("Read the console", None, console_lines("where", 0, 6),
     '<b>says:</b> is your <b>say</b> block, <b>sim:</b> a move. <b>&#9888;</b> is a warning, <b>&#10006;</b> an error: the program stopped there.', ""),
    ("Watch it run", "running", None,
     'The block that is running <b>lights up</b>. Set the simulator <b>Speed</b> to <b>real time</b> to follow along.', ""),
    ("Say what it sees", "sayloop", console_lines("sayloop", 0, 3),
     'Put <b>say</b> inside the loop: the console shows the sensor <b>while</b> the program runs.', ""),
    ("Read once, use it twice", "readonce", console_lines("readonce", 0, 2),
     'Every sensor block reads <b>again</b>. Read it into a variable once, then <b>say</b> that variable and <b>decide</b> with it: the number you see is the number it used.', "key"),
    ("Label every say", "where", console_lines("where", pick=[3, 5]),
     'A bare <b>412</b> could be anything: say <b>"wall: "</b> and the number. Number your steps: the last one in the console is how far it got.', ""),
    ("Start clean", "clear", None,
     'Right under <b>when RUN</b>: <b>clear the console</b>, then <b>set</b> every variable. Each run starts the same. (The <b>Clear</b> button empties it by hand.)', "key"),
    ("\"undefined\" means never set", "misspelled", console_lines("misspelled", 0, 2),
     'Every RUN starts all variables <b>empty</b>. <b>sides</b> is not <b>side</b>: a second variable nobody set. And the drive? <b>Skipped</b>, with no warning.', "key"),
    ("Simulator first", "runon", None,
     'Wrong in the <b>simulator</b> too? It is the program. Right in the simulator, wrong on the robot? Look at the robot: its numbers, battery, sensor.', ""),
    ("One change at a time", None, None,
     '<ol class="loop"><li>Guess what is wrong.</li><li>Change <b>one</b> thing.</li><li>RUN.</li><li>Look: better? Keep it. Not? <b>Undo</b> (Ctrl+Z).</li></ol>', ""),
    ("Make it smaller", None, None,
     'Right-click, <b>Disable Block</b> on half the program. Bug gone? It is in that half. Or put just <b>one subroutine</b> under a <b>when RUN</b> and test it alone.', ""),
    ("Run it three times", None, None,
     'Maps <b>4 to 10</b> change every run, and real floors and batteries change too. Worked once? Maybe lucky. Three in a row: it works.', ""),
    ("Explain it out loud", None, None,
     'Read your program to a friend (or a toy), block by block: "then it turns right 90..." Bugs show up when you say what each block <b>really</b> does.', ""),
]

PAGE2 = [
    ("One job per subroutine", "jobs", None,
     'Do not pack it all into one long stack. Give each job a subroutine with a <b>name that says what it does</b>. The main program reads like a list.', "key"),
    ("Inputs get their own names", "shadow", console_lines("shadow", pick=[1, 2]),
     'The input <b>size</b> said 300, the program\'s <b>size</b> stayed 100: <b>two boxes</b>, one name. Do not reuse a name: call the input <b>square size</b>.', "key"),
    ("Subroutines share the rest", "shared", console_lines("shared", pick=[1]),
     'Every <b>other</b> variable is shared: <b>bump</b> changes the program\'s <b>count</b>. Handy for counters. To make a subroutine work on <b>any</b> number, use an input.', ""),
    ("Each tab is its own program", None, robot(("say", "5"), ("say", "1")),
     '<b>x</b> in one tab and <b>x</b> in another are two boxes. <b>run program</b> runs the other tab, but its variables stay there: here it said 5, and ours is still 1.', ""),
    ("Good names", None, None,
     '<b>wall</b>, <b>side</b>, <b>light at start</b>: not <b>x</b> and <b>a</b>. A name that says what is inside makes the bug easy to spot.', ""),
    ("Save a copy first", None, None,
     'About to change a lot? <b>This program...</b>, <b>Duplicate</b>. Then try. Broken? The copy is still there. Small changes: <b>Ctrl+Z</b>.', ""),
    ("Ask the robot", "commands", None,
     'Connect, type in the box under the console, press <b>Send</b>.', "robot"),
    ("Measure first", None, robot(("sent", "b"), ("robot", "B,0,412,398,412"), ("sent", "b"), ("robot", "B,-13,846,846,520")),
     'Light numbers depend on the room. Read <b>b</b> where the robot will drive, then with the flashlight, and pick a number <b>in between</b>. The light level block is the brightest <b>&divide; 10</b>.', "robot"),
    ("Sonar -1 means nothing", "minusone", None,
     '<b>-1</b>: nothing in range (or no echo). <b>wall &lt; 300</b> is true for -1! Check <b>wall &gt; 0</b> too, or use <b>sees something closer than</b>: it ignores -1.', "robot"),
    ("The arrows: sent and answered", None, robot(("sent", "m0,300,0;"), ("robot", "move: done"), ("sent", "u"), ("robot", "U,412"), ("say", "wall: 412")),
     'With <b>Robot</b>: <b>&rarr;</b> is what the page sent, <b>&larr;</b> what the robot answered. No &larr; at all? The robot did not hear it.', "robot"),
    ("The robot will do", "willdo", None,
     'Check the plan <b>before</b> you RUN: every move, in order, up to the first sensor block.', ""),
    ("Robot not doing it?", None, None,
     '<ul class="checks"><li>Switch on, shield light bright (dim: batteries).</li><li><b>Run on: Robot</b>, and connected.</li><li>One thing at a time over Bluetooth: wait for it, STOP if stuck.</li><li><b>u</b> and <b>b</b> answer? Sensor plugged in right.</li></ul>', "robot"),
]

TAGS = {"key": ("try this", "Try this first"), "robot": ("robot", "Needs the real robot")}


def png_size(name):
    with open(os.path.join(ROOT, "img", "blockly-debug-%s.png" % name), "rb") as f:
        head = f.read(24)
    return struct.unpack(">II", head[16:24])


def console_html(lines):
    rows = "".join('<div class="c-%s">%s</div>' % (kind, html.escape(text)) for kind, text in lines)
    return '<div class="console">%s</div>' % rows


def commands_html():
    rows = "".join('<tr><td><kbd>%s</kbd></td><td>%s</td></tr>' % (c, what) for c, what in COMMANDS)
    return '<table class="keys">%s</table>' % rows


def willdo_html():
    data = CONSOLE["willdo"]
    items = "".join("<li>%s</li>" % html.escape(re.sub(r"m[-0-9,]+;$", "", item).strip()) for item in data["list"])
    return '<div class="willdo"><ol>%s</ol><div class="willdo-note">%s</div></div>' % (items, html.escape(data["notes"]))


def card(index, title, image, lines, text, tag):
    parts = []
    if image == "commands":
        parts.append('<div class="pic table-pic">%s</div>' % commands_html())
    elif image == "willdo":
        parts.append('<div class="pic table-pic">%s</div>' % willdo_html())
    elif image:
        w, h = png_size(image)
        size = " small" if lines else ""
        if image == "runon":
            size = " tiny"
        parts.append('<div class="pic%s"><img class="blocks" src="../img/blockly-debug-%s.png" alt="Blocks: %s" width="%d" height="%d"></div>' % (size, image, title, w // 2, h // 2))
    if lines:
        parts.append(console_html(lines))
    body = text if text.startswith("<ol") or text.startswith("<ul") else "<p>%s</p>" % text
    flag = '<span class="tag tag-%s" title="%s">%s</span>' % (tag, TAGS[tag][1], TAGS[tag][0]) if tag else ""
    return ('    <div class="step">\n      <div class="step-head"><span class="num">%d</span>%s%s</div>\n      %s\n      %s\n    </div>\n'
            % (index, title, flag, "\n      ".join(parts), body))


STYLE = """
  :root { --ink: #1c1f24; --dim: #5b6670; --orange: #c24400; --blue: #0b6fb3; --purple: #6b3fa0; --green: #1d7a46; }
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
  .step { border: 1.5px solid #c9ced4; border-radius: 10px; padding: 6px 8px; display: flex; flex-direction: column; gap: 3px; }
  .step-head { font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 6px; line-height: 1.15; }
  .num { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: var(--orange); color: #fff; font-size: 13px; flex: none; }
  .tag { margin-left: auto; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; border: 1.5px solid; border-radius: 9px; padding: 0 5px; flex: none; }
  .tag-key { color: var(--green); }
  .tag-robot { color: var(--purple); }
  .pic { display: flex; align-items: center; justify-content: center; height: 1.2in; overflow: hidden; }
  .pic.small { height: 1.0in; }
  .pic.tiny { height: 0.45in; }
  .pic img.blocks { max-width: 100%; max-height: 100%; width: auto; height: auto; }
  .pic.table-pic { height: auto; display: block; }
  .console { font: 10.5px/1.3 ui-monospace, "Cascadia Mono", Menlo, Consolas, monospace; background: #f4f6f8; border: 1px solid #d5dbe1; border-radius: 6px; padding: 3px 6px; white-space: pre-wrap; }
  .console .c-say { color: #8a5a00; font-weight: 700; }
  .console .c-simulator { color: #2b3f87; }
  .console .c-sent { color: var(--blue); }
  .console .c-robot { color: var(--green); }
  .console .c-app { color: var(--dim); }
  .keys { border-collapse: collapse; font-size: 11.5px; width: 100%; line-height: 1.25; }
  .keys td { padding: 1px 3px; vertical-align: top; }
  .keys td:first-child { white-space: nowrap; }
  kbd { font: 700 11px ui-monospace, Menlo, Consolas, monospace; border: 1px solid #9aa4ae; border-bottom-width: 2px; border-radius: 4px; padding: 0 3px; background: #f7f8f9; }
  code { font: 10.5px ui-monospace, Menlo, Consolas, monospace; }
  .willdo { font-size: 11.5px; line-height: 1.25; }
  .willdo ol { margin: 0; padding-left: 20px; }
  .willdo-note { margin-top: 3px; background: #fff7d6; border-radius: 5px; padding: 2px 6px; color: #5b4500; }
  .step p { margin: 0; font-size: 12px; line-height: 1.28; }
  .step ol, .step ul { margin: 0; padding-left: 18px; font-size: 12px; line-height: 1.3; }
  .step ol.loop li { margin: 1px 0; }
  .sheet a { color: var(--blue); }
  @media (max-width: 760px) { .steps { grid-template-columns: repeat(2, 1fr); } .sheet { padding: 16px; } .top img { height: 44px; } }
  @media (max-width: 420px) { .steps { grid-template-columns: 1fr; } }
  @media print {
    @page { size: letter; margin: 0.3in 0.3in 0.45in;
      @bottom-center { content: "Maker Lab Kids \\00B7  robotics.makerlabkids.com"; font: 10px system-ui, sans-serif; color: #555; } }
    .sheet a { color: inherit; }
    .print-link { display: none; }
    .top img { height: 46px; }
    .note { margin: 6px 0 8px; padding: 4px 10px; background: none; }
    html, body { background: #fff; }
    .sheet { box-shadow: none; margin: 0; padding: 0; max-width: none; }
    .sheet + .sheet { break-before: page; page-break-before: always; }
    .num { background: none; color: var(--orange); border: 2px solid var(--orange); }
    .console { background: none; }
    kbd { background: none; }
  }
"""


def build():
    page1 = "".join(card(i + 1, *c) for i, c in enumerate(PAGE1))
    page2 = "".join(card(i + 13, *c) for i, c in enumerate(PAGE2))
    return """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Debugging with Blockly %(version)s - Maker Lab Kids</title>
<meta name="description" content="How to find bugs in a Blockly program for the mecanum robot: the console, say blocks, reading a sensor once, starting clean, subroutines and variable names, and asking the real robot with console commands.">
<!-- written by scripts/blockly-debug.py: edit that, then run it and node scripts/site-nav.js -->
<style>%(style)s</style>
<link rel="stylesheet" href="/css/nav.css">
</head>
<body>
<!-- mlk-nav: written by scripts/site-nav.js, do not edit here -->
<!-- /mlk-nav -->
<div class="sheet">
  <div class="top">
    <img src="../img/lockup.png" alt="Maker Lab Kids" width="300" height="99">
    <div><h1>Debugging with Blockly</h1><div class="sub">Finding out why the robot did not do what you meant. <span class="print-link">Print it: <a href="../resources/blockly-debug.pdf">PDF</a>. More: <a href="/mecanum/blockly-tips">Blockly tips and tricks</a>.</span></div></div>
  </div>
  <div class="note">A <b>bug</b> is the difference between what you think the program does and what it really does.
  Do not guess: make the program <b>tell you</b>. It talks in the <b>Console</b>, next to the simulator.
  Cards marked <span class="tag tag-key">try this</span> fix the most bugs.</div>
  <div class="steps">
%(page1)s  </div>
</div>
<div class="sheet">
  <div class="top">
    <img src="../img/lockup.png" alt="Maker Lab Kids" width="300" height="99">
    <div><h1>Organize it, then ask the robot</h1><div class="sub">Programs that are easy to read are easy to fix. Then the real robot: what it sees, what it heard.</div></div>
  </div>
  <div class="note">Cards marked <span class="tag tag-robot">robot</span> need a robot connected (<b>Serial</b> or <b>Bluetooth</b>) and <b>Run on: Robot</b>.
  Numbers on them are examples: yours will be different. That is the point of measuring.</div>
  <div class="steps">
%(page2)s  </div>
</div>
<!-- mlk-foot -->
<!-- /mlk-foot -->
</body>
</html>
""" % dict(version=VERSION, style=STYLE, page1=page1, page2=page2)


with open(PAGE, "w", encoding="utf-8") as f:
    f.write(build())
print("wrote mecanum/blockly-debug.html")
