# Puts the shared top-view robot drawing (robot_svg.bot_top, the Blocks
# simulator's robot) into mecanum/tune.html, between its marker comments:
#   <!-- bot:dial -->...<!-- /bot:dial -->     the robot the turn dial rotates
#   <!-- bot:slide -->...<!-- /bot:slide -->   the robot under the wheel-pair outlines
# Run: python3 scripts/tune-figs.py   (safe to rerun; standard library only)
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from robot_svg import bot_top

PAGE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "mecanum", "tune.html")

with open(PAGE, encoding="utf-8") as f:
    source = f.read()

for name in ("dial", "slide"):
    pattern = re.compile(r"<!-- bot:%s -->.*?<!-- /bot:%s -->" % (name, name), re.S)
    if not pattern.search(source):
        sys.exit("no <!-- bot:%s --> marker in %s" % (name, PAGE))
    drawing = bot_top(0, 0, 0, 0.5, False, "tune" + name)
    source = pattern.sub(lambda match: "<!-- bot:%s -->%s<!-- /bot:%s -->" % (name, drawing, name), source)

with open(PAGE, "w", encoding="utf-8") as f:
    f.write(source)
print("wrote the robot drawings into mecanum/tune.html")
