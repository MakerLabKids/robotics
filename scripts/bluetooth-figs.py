# Draws the two motor shield pictures of the Bluetooth sheet and puts them into
# mecanum/bluetooth-build.html, between its marker comments:
#   <!-- bt:board -->...<!-- /bt:board -->     the shield from above: where the analog header is
#   <!-- bt:header -->...<!-- /bt:header -->   close-up of the header with the four plugs in an L
# They are the light sensor sheet's drawings (board_overview and header_closeup in
# scripts/ldr-figs.py: same board, same sizes, same colors) with other pins marked: the
# Bluetooth wires sit on +5V, Gnd and A0 down the A0 column, and A1 next to A0.
# Run: python3 scripts/bluetooth-figs.py   (safe to rerun; standard library only)
import os
import re
import sys

PAGE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "mecanum", "bluetooth-build.html")
MARK = "#e65100"
# (wire colors in the pictures only: the text never names one, the kids' wires are any color)
PLUGS = [(0, 0, "#d42a2a"), (0, 1, "#161616"), (0, 2, "#1f6fd1"), (1, 2, "#f6c21c")]   # column, row, dot


def board_overview():
    """The motor shield from above, simplified: where the analog header is, with the
    L of the four Bluetooth pins outlined."""
    out = ['<rect width="360" height="300" rx="10" class="fig-bg" fill="#f4f1ea"/>',
           '<rect x="20" y="20" width="320" height="240" rx="12" fill="#1f5fae" stroke="#174a88" stroke-width="2"/>']
    out.append('<rect x="20" y="70" width="34" height="62" rx="3" fill="#2f86d6" stroke="#174a88"/>')
    out.append('<rect x="20" y="150" width="34" height="62" rx="3" fill="#2f86d6" stroke="#174a88"/>')
    for x in (95, 160, 225):                 # the three chips
        out.append(f'<rect x="{x}" y="60" width="44" height="90" rx="3" fill="#222"/>')
    out.append('<rect x="70" y="200" width="56" height="40" rx="3" fill="#2f86d6" stroke="#174a88"/>')
    out.append('<text x="98" y="256" text-anchor="middle" font-size="11" fill="#fff">power in</text>')
    pitch = 13
    a5x, top = 300, 214                      # A5 column x, +5 row y
    hx = a5x - 5 * pitch                     # A0 column x
    out.append(f'<rect x="{hx - 8}" y="{top - 8}" width="{5 * pitch + 16}" height="{2 * pitch + 16}" rx="2" fill="#f2d33c"/>')
    for row in range(3):
        for col in range(6):
            out.append(f'<rect x="{hx + col * pitch - 3}" y="{top + row * pitch - 3}" width="6" height="6" fill="#6b5a12"/>')
    out.append(f'<rect x="{a5x - 14}" y="80" width="54" height="{top - 8 - 80}" rx="3" fill="#2f86d6" stroke="#174a88"/>')   # right motor connector
    out.append(f'<text x="{a5x + 12}" y="140" text-anchor="middle" font-size="11" fill="#fff">motors</text>')
    bottom = top + 2 * pitch
    out.append(f'<path d="M{hx - 7} {top - 7} H{hx + 7} V{bottom - 7} H{hx + pitch + 7} V{bottom + 7} H{hx - 7} Z" fill="none" stroke="{MARK}" stroke-width="3" stroke-linejoin="round"/>')
    out.append(f'<text x="{a5x + 12}" y="{top + 4}" font-size="10" fill="#fff">+5V</text>')
    out.append(f'<text x="{a5x + 12}" y="{top + pitch + 4}" font-size="10" fill="#fff">Gnd</text>')
    out.append(f'<text x="{a5x + 12}" y="{bottom + 4}" font-size="10" fill="#fff">A0-5</text>')
    out.append(f'<path d="M168 288 Q{hx} 290 {hx} {bottom + 12}" fill="none" stroke="{MARK}" stroke-width="2.5"/>')
    out.append(f'<path d="M{hx - 6} {bottom + 22} L{hx} {bottom + 11} L{hx + 6} {bottom + 22}" fill="none" stroke="{MARK}" stroke-width="2.5"/>')
    out.append('<text x="162" y="292" text-anchor="end" font-size="14" fill="#222">the A0 corner</text>')
    label = ("The motor shield from above. The analog header is at the bottom right, under the right motor connector: three rows, "
             "+5V on top, Gnd in the middle and A0-5 along the board's edge, with A0 on the left and A5 on the right. "
             "An L is outlined at the left end: the A0 column, plus A1 on the bottom row.")
    return f'<svg viewBox="0 0 360 300" role="img" aria-label="{label}">\n' + "\n".join(out) + "\n</svg>"


def header_closeup():
    """Close-up of the analog header from above. Each dupont plug stands on its pin with
    the wire coming straight up at you: a colored dot on the plug. Four plugs in an L."""
    xs = [30 + i * 46 for i in range(6)]          # A0 .. A5
    ys = [92, 138, 184]                           # +5, Gnd, A0-5
    out = ['<rect y="20" width="360" height="250" rx="10" class="fig-bg" fill="#f4f1ea"/>',
           '<rect x="0" y="20" width="360" height="206" fill="#1f5fae"/>',
           '<line x1="0" y1="226" x2="360" y2="226" stroke="#174a88" stroke-width="3"/>',
           f'<rect x="{xs[0] - 23}" y="{ys[0] - 23}" width="{xs[5] - xs[0] + 46}" height="{ys[2] - ys[0] + 46}" rx="3" fill="#f2d33c"/>']
    for y in ys:
        for x in xs:
            out.append(f'<rect x="{x - 7}" y="{y - 7}" width="14" height="14" fill="#6b5a12"/>')
    # the right motor connector, overhanging A5's +5 pin and just touching A4's
    out.append(f'<rect x="{xs[4] + 8}" y="20" width="{360 - xs[4] - 8}" height="{ys[0] - 20 - 21}" fill="#2f86d6" stroke="#174a88" stroke-width="2"/>')
    out.append(f'<text x="{(xs[4] + 368) / 2}" y="50" text-anchor="middle" font-size="13" fill="#fff">motor connector</text>')
    for col, row, color in PLUGS:
        out.append(f'<rect x="{xs[col] - 20}" y="{ys[row] - 20}" width="40" height="40" rx="3" fill="#202326" stroke="#4a5058" stroke-width="1.5"/>')
        out.append(f'<circle cx="{xs[col]}" cy="{ys[row]}" r="11" fill="{color}" stroke="#fff" stroke-width="1.5"/>')
    out.append(f'<path d="M{xs[0] - 25} {ys[0] - 25} H{xs[0] + 25} V{ys[2] - 25} H{xs[1] + 25} V{ys[2] + 25} H{xs[0] - 25} Z" fill="none" stroke="{MARK}" stroke-width="3.5" stroke-linejoin="round"/>')
    for label, y in (("+5V", ys[0]), ("Gnd", ys[1]), ("A0-5", ys[2])):
        out.append(f'<text x="{xs[5] + 28}" y="{y + 5}" font-size="13" font-weight="700" fill="#fff">{label}</text>')
    for i, x in enumerate(xs):
        used = i in (0, 1)
        out.append(f'<text x="{x}" y="246" text-anchor="middle" font-size="14" font-weight="{700 if used else 400}" fill="{"#c24400" if used else "#555"}">A{i}</text>')
    out.append(f'<text x="{(xs[4] + xs[5]) / 2}" y="263" text-anchor="middle" font-size="12" fill="#555">light sensors</text>')
    label = ("Close-up of the analog header from above: columns A0 to A5 from left to right, the top row all +5V, the middle row all Gnd, "
             "the bottom row A0 to A5 at the board's edge. Four plugs make an L at the left end: +5V, Gnd and A0 down the A0 column, "
             "and A1 beside A0 on the bottom row. The light sensors are at the other end, on A4 and A5.")
    return f'<svg viewBox="0 20 360 250" role="img" aria-label="{label}">\n' + "\n".join(out) + "\n</svg>"


with open(PAGE, encoding="utf-8") as f:
    source = f.read()

for name, drawing in (("board", board_overview()), ("header", header_closeup())):
    pattern = re.compile(r"<!-- bt:%s -->.*?<!-- /bt:%s -->" % (name, name), re.S)
    if not pattern.search(source):
        sys.exit("no <!-- bt:%s --> marker in %s" % (name, PAGE))
    source = pattern.sub(lambda match: "<!-- bt:%s -->%s<!-- /bt:%s -->" % (name, drawing, name), source)

with open(PAGE, "w", encoding="utf-8") as f:
    f.write(source)
print("wrote the shield drawings into mecanum/bluetooth-build.html")
