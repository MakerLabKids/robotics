// Screenshots for Blockly tips and tricks (mecanum/blockly-tips.html): small programs, some
// with a menu, a gear bubble or a dropdown open. img/blockly-tips-<name>.png, light, no grid.
// Run: node scripts/blockly-tips-shots.js, then python3 scripts/blockly-tips.py
const path = require("path");
const { spawn } = require("child_process");
const puppeteer = require(path.join(__dirname, "node_modules", "puppeteer"));
const root = path.resolve(__dirname, "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const only = process.argv.slice(2);

(async () => {
  const server = spawn("node", [path.join(__dirname, "serve.js"), "8216"], { cwd: __dirname, stdio: "ignore" });
  await sleep(700);
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
  await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) { /* fresh */ } });
  await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 2 });
  await page.goto("http://127.0.0.1:8216/mecanum/blocks", { waitUntil: "load" });
  await sleep(1500);
  await page.addStyleTag({ content: ".blocklyMainBackground { fill: #fff !important; } .blocklyScrollbarHorizontal, .blocklyScrollbarVertical, .blocklyZoom, .blocklyTrash { display: none !important; }" });
  const names = await page.evaluate(() => {
    let ids = {};
    window.__tipReset = () => { ids = {}; };
    const v = (name) => { ids[name] = ids[name] || "tips_" + name; return ids[name]; };
    const num = (n) => ({ shadow: { type: "math_number", fields: { NUM: n } } });
    const txt = (t) => ({ shadow: { type: "text", fields: { TEXT: t } } });
    const realNum = (n) => ({ block: { type: "math_number", fields: { NUM: n } } });
    const get = (name) => ({ type: "variables_get", fields: { VAR: { id: v(name) } } });
    const slotVar = (name, n) => ({ shadow: { type: "math_number", fields: { NUM: n } }, block: get(name) });
    const chain = (list) => { for (let i = list.length - 2; i >= 0; i--) list[i].next = { block: list[i + 1] }; return list[0]; };
    const start = (blocks, y) => ({ type: "robot_start", x: 60, y: y || 20, next: blocks.length ? { block: chain(blocks) } : undefined });
    const drive = (mm) => ({ type: "robot_drive", fields: { DIRECTION: "0" }, inputs: { DISTANCE: num(mm) } });
    const driveVar = (name) => ({ type: "robot_drive", fields: { DIRECTION: "0" }, inputs: { DISTANCE: slotVar(name, 100) } });
    const turn = (deg) => ({ type: "robot_turn", fields: { DIRECTION: "1" }, inputs: { ANGLE: num(deg) } });
    const repeat = (n, blocks) => ({ type: "controls_repeat_ext", inputs: { TIMES: num(n), DO: { block: chain(blocks) } } });
    const set = (name, value) => ({ type: "variables_set", fields: { VAR: { id: v(name) } }, inputs: { VALUE: { block: value } } });
    const say = (value) => ({ type: "text_print", inputs: { TEXT: Object.assign(txt(""), { block: value }) } });
    const join = (items) => { const b = { type: "text_join", extraState: { itemCount: items.length }, inputs: {} }; items.forEach((it, i) => { b.inputs["ADD" + i] = { block: it }; }); return b; };
    const text = (t) => ({ type: "text", fields: { TEXT: t } });
    const arith = (op, a, b) => ({ type: "math_arithmetic", fields: { OP: op }, inputs: { A: Object.assign(num(1), a), B: Object.assign(num(1), b) } });
    const sonar = () => ({ type: "robot_distance", fields: { SENSOR: "sonar" } });
    const callSquare = (n) => ({ type: "procedures_callnoreturn", extraState: { name: "square", params: ["size"] }, inputs: { ARG0: realNum(n) } });
    const defSquare = (y, body, x) => ({ type: "procedures_defnoreturn", x: x || 60, y: y, fields: { NAME: "square" }, extraState: { params: [{ name: "size", id: v("size") }] },
      inputs: body === false ? {} : { STACK: { block: repeat(4, [driveVar("size"), turn(90)]) } } });
    const state = (tops) => ({ blocks: { languageVersion: 0, blocks: tops }, variables: Object.keys(ids).map((name) => ({ name, id: ids[name] })) });
    const scenes = {};
    // page 1
    scenes.loose = { state: () => state([start([drive(300), turn(90)]), Object.assign(drive(500), { x: 340, y: 150 })]), keep: true };
    scenes.pull = { state: () => state([start([drive(300), drive(300)]), Object.assign(turn(90), { x: 340, y: 120 })]), keep: true };
    scenes.duplicate = { state: () => state([start([repeat(4, [drive(300), turn(90)])])]), menu: "controls_repeat_ext" };
    scenes.slot = { state: () => state([start([{ type: "robot_drive", fields: { DIRECTION: "0" }, inputs: { DISTANCE: Object.assign(num(100), { block: arith("MULTIPLY", realNum(100), realNum(3)) }) } }, { type: "robot_turn", fields: { DIRECTION: "1" }, inputs: { ANGLE: slotVar("angle", 90) } }])]) };
    scenes.newvar = { state: () => { v("side"); v("speed"); return state([]); }, flyout: "Variables" };
    scenes.number = { state: () => state([start([set("side", realNum(300).block), driveVar("side")])]) };
    scenes.math = { state: () => state([start([
      set("side", arith("MULTIPLY", realNum(100), realNum(3))),
      set("far", { type: "math_random_int", inputs: { FROM: num(200), TO: num(600) } }),
      driveVar("far")])]) };
    scenes.text = { state: () => state([start([set("name", text("Rex")), say(join([text("Hello, I am "), get("name")]))])]) };
    scenes.sensor = { state: () => state([start([set("wall", sonar()), say(join([text("The wall is "), get("wall"), text(" mm away")]))])]) };
    scenes.change = { state: () => state([start([set("side", realNum(100).block), repeat(8, [driveVar("side"), turn(90), { type: "math_change", fields: { VAR: { id: v("side") } }, inputs: { DELTA: num(100) } }])])]) };
    scenes.vardrop = { state: () => state([start([set("side", realNum(300).block), driveVar("side")])]), dropdown: "side" };
    // page 2
    scenes.submake = { state: () => state([start([callSquare(300), callSquare(600)]), defSquare(20, true, 330)]), keep: true };
    scenes.subcall = { state: () => state([start([callSquare(300), callSquare(600)]), Object.assign(defSquare(20, true, 330), { collapsed: true })]), keep: true };
    scenes.subgear = { state: () => state([defSquare(20, false)]), gear: "procedures_defnoreturn" };
    scenes.subget = { state: () => state([defSquare(20, false)]), menu: "procedures_defnoreturn", menuRight: true };
    scenes.subreturn = { state: () => state([
      start([say({ type: "procedures_callreturn", extraState: { name: "double", params: ["n"] }, inputs: { ARG0: realNum(21) } })]),
      { type: "procedures_defreturn", x: 60, y: 210, fields: { NAME: "double" }, extraState: { params: [{ name: "n", id: v("n") }] },
        inputs: { RETURN: { block: arith("MULTIPLY", { block: get("n") }, realNum(2)) } } }]), keep: true };
    scenes.highlight = { state: () => state([start([callSquare(300)]), defSquare(20, true, 360)]), menu: "procedures_callnoreturn", keep: true };
    scenes.ifgear = { state: () => state([start([{ type: "controls_if", extraState: { elseIfCount: 1, hasElse: true } }])]), gear: "controls_if" };
    scenes.comment = { state: () => state([start([Object.assign(drive(300), { icons: { comment: { text: "Half way to the box", pinned: true, height: 60, width: 170 } } }), turn(90)])]) };
    scenes.disable = { state: () => state([start([drive(300), Object.assign(turn(90), { enabled: false }), drive(300)])]) };
    scenes.collapse = { state: () => state([start([drive(300), Object.assign(repeat(4, [drive(300), turn(90)]), { collapsed: true }), turn(180)])]) };
    scenes.wsmenu = { state: () => state([start([drive(300), turn(90)])]), wsmenu: true };
    scenes.runprogram = { state: () => state([start([{ type: "robot_run_program", extraState: { program: "Square" }, fields: { PROGRAM: "Square" } }, drive(300)]), Object.assign(start([turn(180)]), { x: 380 })]), keep: true };
    window.__tipScenes = scenes;
    return Object.keys(scenes);
  });

  for (const name of names) {
    if (only.length && !only.includes(name)) continue;
    const scene = await page.evaluate((name) => {
      Blockly.ContextMenu.hide && Blockly.ContextMenu.hide();
      Blockly.DropDownDiv.hideWithoutAnimation();
      blockWorkspace.getToolbox().clearSelection();
      const s = window.__tipScenes[name];
      window.__tipReset();
      addProgram("tips " + name, s.state());
      blockWorkspace.setScale(1);
      if (!s.keep) blockWorkspace.cleanUp();
      blockWorkspace.getTopBlocks(false).forEach((t) => t.moveBy(40, 0));
      blockWorkspace.scroll(0, 0);
      return { menuRight: !!s.menuRight, menu: s.menu || null, gear: s.gear || null, dropdown: s.dropdown || null, flyout: s.flyout || null, wsmenu: !!s.wsmenu };
    }, name);
    await sleep(400);
    // a pinned comment opens over its block: move it beside the block
    await page.evaluate(() => blockWorkspace.getAllBlocks(false).forEach((b) => {
      const icon = b.getIcon && b.getIcon(Blockly.icons.CommentIcon.TYPE);
      if (icon && b.type !== "procedures_defnoreturn" && b.type !== "procedures_defreturn") {
        icon.setBubbleVisible(true);
        const at = b.getRelativeToSurfaceXY();
        icon.setBubbleLocation(new Blockly.utils.Coordinate(at.x + b.getHeightWidth().width + 30, at.y - 20));
      }
    }));
    await sleep(300);
    let extra = null;
    if (scene.menu) {
      const at = await page.evaluate((type, right) => {
        const b = blockWorkspace.getAllBlocks(false).find((x) => x.type === type);
        const r = b.getSvgRoot().getBoundingClientRect();
        return { x: right ? r.right - 30 : r.left + 8, y: r.bottom - 24 };
      }, scene.menu, scene.menuRight);
      await page.mouse.click(at.x, at.y, { button: "right" });
      await sleep(400);
      extra = ".blocklyContextMenu";
    }
    if (scene.wsmenu) {
      await page.mouse.click(420, 200, { button: "right" });
      await sleep(400);
      extra = ".blocklyContextMenu";
    }
    if (scene.gear) {
      await page.evaluate((type) => {
        blockWorkspace.getTopBlocks(false).forEach((t) => t.moveBy(150, 0));
        const b = blockWorkspace.getAllBlocks(false).find((x) => x.type === type);
        b.getIcon(Blockly.icons.MutatorIcon.TYPE).setBubbleVisible(true);
      }, scene.gear);
      await sleep(600);
    }
    if (scene.dropdown) {
      await page.evaluate((name) => {
        const b = blockWorkspace.getAllBlocks(false).find((x) => x.type === "variables_get" && x.getField("VAR").getText() === name);
        b.getField("VAR").showEditor();
      }, scene.dropdown);
      await sleep(400);
      extra = ".blocklyDropDownDiv";
    }
    if (scene.flyout) {
      await page.evaluate((label) => {
        const toolbox = blockWorkspace.getToolbox();
        const item = toolbox.getToolboxItems().find((i) => i.getName && i.getName() === label);
        toolbox.setSelectedItem(item);
      }, scene.flyout);
      await sleep(600);
    }
    const box = await page.evaluate((extra, flyout) => {
      let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
      const add = (r) => { if (!r || r.width < 2 || r.height < 2) return; left = Math.min(left, r.left); top = Math.min(top, r.top); right = Math.max(right, r.right); bottom = Math.max(bottom, r.bottom); };
      if (flyout) {
        const f = blockWorkspace.getToolbox().getFlyout().getWorkspace();
        f.getTopBlocks(false).forEach((b) => add(b.getSvgRoot().getBoundingClientRect()));
        document.querySelectorAll(".blocklyFlyout .blocklyFlyoutButton").forEach((e) => add(e.getBoundingClientRect()));
      } else {
        blockWorkspace.getTopBlocks(false).forEach((b) => add(b.getSvgRoot().getBoundingClientRect()));
        add(blockWorkspace.getBubbleCanvas().getBoundingClientRect());
      }
      if (extra) { const e = document.querySelector(extra); if (e && e.offsetParent !== null) add(e.getBoundingClientRect()); }
      return { x: Math.floor(left - 6), y: Math.floor(top - 6), width: Math.ceil(right - left + 12), height: Math.ceil(bottom - top + 12) };
    }, extra, !!scene.flyout);
    await page.screenshot({ path: path.join(root, "img", "blockly-tips-" + name + ".png"), clip: box, captureBeyondViewport: false });
    console.log(name, box.width + "x" + box.height);
    await page.keyboard.press("Escape");
    await page.mouse.click(1000, 900);
    await sleep(200);
  }
  console.log("errors:", JSON.stringify(errors));
  await browser.close();
  server.kill();
})().catch((e) => { console.error(e); process.exit(1); });
