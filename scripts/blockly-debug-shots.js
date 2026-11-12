// Screenshots and real console lines for Debugging with Blockly (mecanum/blockly-debug.html).
// Each scene is a small program: its picture goes to img/blockly-debug-<name>.png; scenes
// with run: true are also run on the simulator (fastest speed, map and random choices
// pinned) and what the console said goes to scripts/blockly-debug-console.json, so the
// console lines printed on the sheet are real.
// Run: node scripts/blockly-debug-shots.js [scene...], then python3 scripts/blockly-debug.py
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const puppeteer = require(path.join(__dirname, "node_modules", "puppeteer"));
const root = path.resolve(__dirname, "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const only = process.argv.slice(2);
const CONSOLE_FILE = path.join(__dirname, "blockly-debug-console.json");

(async () => {
  const server = spawn("node", [path.join(__dirname, "serve.js"), "8211"], { cwd: __dirname, stdio: "ignore" });
  await sleep(700);
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
  page.on("dialog", (d) => d.dismiss());
  await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) { /* fresh */ } });
  await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 2 });
  await page.goto("http://127.0.0.1:8211/mecanum/blocks", { waitUntil: "load" });
  await sleep(1500);
  await page.addStyleTag({ content: ".blocklyMainBackground { fill: #fff !important; } .blocklyScrollbarHorizontal, .blocklyScrollbarVertical, .blocklyZoom, .blocklyTrash { display: none !important; }" });
  const names = await page.evaluate(() => {
    let ids = {};
    window.__debugReset = () => { ids = {}; };
    const v = (name) => { ids[name] = ids[name] || "debug_" + name.replace(/ /g, "_"); return ids[name]; };
    const num = (n) => ({ shadow: { type: "math_number", fields: { NUM: n } } });
    const txt = (t) => ({ shadow: { type: "text", fields: { TEXT: t } } });
    const realNum = (n) => ({ type: "math_number", fields: { NUM: n } });
    const get = (name) => ({ type: "variables_get", fields: { VAR: { id: v(name) } } });
    const chain = (list) => { for (let i = list.length - 2; i >= 0; i--) list[i].next = { block: list[i + 1] }; return list[0]; };
    const start = (blocks) => ({ type: "robot_start", x: 60, y: 20, next: blocks.length ? { block: chain(blocks) } : undefined });
    const drive = (mm) => ({ type: "robot_drive", fields: { DIRECTION: "0" }, inputs: { DISTANCE: num(mm) } });
    const driveVar = (name) => ({ type: "robot_drive", fields: { DIRECTION: "0" }, inputs: { DISTANCE: Object.assign(num(100), { block: get(name) }) } });
    const turn = (deg) => ({ type: "robot_turn", fields: { DIRECTION: "1" }, inputs: { ANGLE: num(deg) } });
    const wait = (s) => ({ type: "robot_wait", inputs: { SECONDS: num(s) } });
    const repeat = (n, blocks) => ({ type: "controls_repeat_ext", inputs: { TIMES: num(n), DO: { block: chain(blocks) } } });
    const set = (name, value) => ({ type: "variables_set", fields: { VAR: { id: v(name) } }, inputs: { VALUE: { block: value } } });
    const change = (name, d) => ({ type: "math_change", fields: { VAR: { id: v(name) } }, inputs: { DELTA: num(d) } });
    const say = (value) => ({ type: "text_print", inputs: { TEXT: Object.assign(txt(""), { block: value }) } });
    const sayText = (t) => ({ type: "text_print", inputs: { TEXT: txt(t) } });
    const join = (items) => { const b = { type: "text_join", extraState: { itemCount: items.length }, inputs: {} }; items.forEach((it, i) => { b.inputs["ADD" + i] = { block: it }; }); return b; };
    const text = (t) => ({ type: "text", fields: { TEXT: t } });
    const compare = (op, a, b) => ({ type: "logic_compare", fields: { OP: op }, inputs: { A: { block: a }, B: { block: b } } });
    const and = (a, b) => ({ type: "logic_operation", fields: { OP: "AND" }, inputs: { A: { block: a }, B: { block: b } } });
    const sonar = () => ({ type: "robot_distance", fields: { SENSOR: "sonar" } });
    const closer = (mm) => ({ type: "robot_sees_closer", fields: { SENSOR: "sonar" }, inputs: { DISTANCE: num(mm) } });
    const clear = () => ({ type: "robot_clear_console" });
    const ifElse = (cond, yes, no) => ({ type: "controls_if", extraState: no ? { hasElse: true } : undefined, inputs: Object.assign({ IF0: { block: cond }, DO0: { block: chain(yes) } }, no ? { ELSE: { block: chain(no) } } : {}) });
    const call = (name, params, args) => { const b = { type: "procedures_callnoreturn", extraState: { name: name, params: params }, inputs: {} }; (args || []).forEach((a, i) => { b.inputs["ARG" + i] = { block: a }; }); return b; };
    const def = (name, params, body, x, y, collapsed) => ({ type: "procedures_defnoreturn", x: x, y: y, collapsed: !!collapsed, fields: { NAME: name }, extraState: params.length ? { params: params.map((p) => ({ name: p, id: v(p) })) } : undefined, inputs: body.length ? { STACK: { block: chain(body) } } : {} });
    const state = (tops) => ({ blocks: { languageVersion: 0, blocks: tops }, variables: Object.keys(ids).map((name) => ({ name: name, id: ids[name] })) });
    const scenes = {};
    // page 1
    scenes.sayloop = { map: "wall", state: () => state([start([clear(), repeat(5, [say(join([text("sonar: "), sonar()])), drive(200)])])]), run: true };
    scenes.readonce = { map: "square", state: () => state([start([clear(), repeat(4, [
      set("light", { type: "robot_light_level" }),
      say(join([text("light: "), get("light")])),
      ifElse(compare("GT", get("light"), realNum(70)), [drive(200)], [turn(90)])])])]), run: true };
    scenes.where = { map: "wall", state: () => state([start([clear(), sayText("1: to the wall"), call("go to wall", []), sayText("2: turn around"), turn(180), sayText("3: back"), drive(500)]),
      def("go to wall", [], [{ type: "robot_keep_driving", fields: { DIRECTION: "forward" }, inputs: { POWER: num(40) } }, { type: "controls_whileUntil", fields: { MODE: "UNTIL" }, inputs: { BOOL: { block: closer(300) }, DO: { block: wait(0.05) } } }, { type: "robot_stop" }], 400, 20, true)]), run: true, keep: true };
    scenes.clear = { state: () => state([start([clear(), set("count", realNum(0)), set("side", realNum(300)), set("name", text("Rex"))])]) };
    scenes.misspelled = { map: "square", state: () => state([start([clear(), set("side", realNum(300)), say(join([text("sides is "), get("sides")])), driveVar("sides")])]), run: true };
    // page 2
    scenes.jobs = { state: () => state([start([call("go to wall", []), call("turn around", []), call("find the light", [])]),
      def("go to wall", [], [{ type: "robot_keep_driving", fields: { DIRECTION: "forward" }, inputs: { POWER: num(40) } }], 330, 20, true),
      def("turn around", [], [turn(180)], 330, 80, true),
      def("find the light", [], [{ type: "robot_follow_light", fields: { MODE: "moth" }, inputs: { SECONDS: num(10), POWER: num(40) } }], 330, 140, true)]), keep: true };
    scenes.shadow = { map: "square", state: () => state([start([set("size", realNum(100)), call("square", ["size"], [realNum(300)]), say(get("size"))]),
      def("square", ["size"], [say(get("size")), set("size", realNum(999))], 400, 20)]), run: true, keep: true };
    scenes.shared = { map: "square", state: () => state([start([set("count", realNum(0)), call("bump", []), call("bump", []), call("bump", []), say(get("count"))]),
      def("bump", [], [change("count", 1)], 400, 20)]), run: true, keep: true };
    scenes.minusone = { state: () => state([start([set("wall", sonar()),
      ifElse(and(compare("GT", get("wall"), realNum(0)), compare("LT", get("wall"), realNum(300))), [sayText("wall ahead")]),
      ifElse(closer(300), [sayText("wall ahead")])])]) };
    scenes.running = { state: () => state([start([repeat(4, [drive(300), turn(90)])])]), highlight: "robot_turn" };
    scenes.runon = { state: () => state([start([drive(300)])]), element: "#runTargetButtons" };
    scenes.willdo = { state: () => state([start([repeat(2, [drive(300), turn(90)]), sayText("half way"), { type: "controls_whileUntil", fields: { MODE: "UNTIL" }, inputs: { BOOL: { block: closer(300) }, DO: { block: drive(100) } } }])]), pane: "willdo" };
    window.__debugScenes = scenes;
    return Object.keys(scenes);
  });

  const consoleText = fs.existsSync(CONSOLE_FILE) ? JSON.parse(fs.readFileSync(CONSOLE_FILE, "utf8")) : {};
  for (const name of names) {
    if (only.length && !only.includes(name)) continue;
    const scene = await page.evaluate((name) => {
      Blockly.DropDownDiv.hideWithoutAnimation();
      window.__debugReset();
      const s = window.__debugScenes[name];
      addProgram("debug " + name, s.state());
      blockWorkspace.setScale(1);
      if (!s.keep) blockWorkspace.cleanUp();
      blockWorkspace.getTopBlocks(false).forEach((t) => t.moveBy(40, 0));
      blockWorkspace.scroll(0, 0);
      return { run: !!s.run, map: s.map || null, highlight: s.highlight || null, element: s.element || null, pane: s.pane || null };
    }, name);
    await sleep(400);
    if (scene.highlight) {
      await page.evaluate((type) => { const b = blockWorkspace.getAllBlocks(false).find((x) => x.type === type); blockWorkspace.highlightBlock(b.id); }, scene.highlight);
      await sleep(300);
    }
    if (scene.pane) {
      await page.evaluate((pane) => { openSidePane(pane); pressPaneTab(pane); }, scene.pane);
      await sleep(800);
      // the pane scrolls: keep its text for the sheet instead of a cut-off picture
      consoleText[name] = await page.evaluate(() => ({
        list: Array.from(document.querySelectorAll("#willDoList li")).map((li) => li.textContent.trim()),
        notes: document.getElementById("willDoNotes").innerText.trim() }));
      console.log(name, JSON.stringify(consoleText[name]));
      continue;
    }
    const box = scene.element ? await page.evaluate((selector) => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return { x: Math.floor(r.left), y: Math.floor(r.top), width: Math.ceil(r.width), height: Math.ceil(r.height) };
    }, scene.element) : await page.evaluate(() => {
      let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
      const add = (r) => { if (!r || r.width < 2 || r.height < 2) return; left = Math.min(left, r.left); top = Math.min(top, r.top); right = Math.max(right, r.right); bottom = Math.max(bottom, r.bottom); };
      blockWorkspace.getTopBlocks(false).forEach((b) => add(b.getSvgRoot().getBoundingClientRect()));
      return { x: Math.floor(left - 6), y: Math.floor(top - 6), width: Math.ceil(right - left + 12), height: Math.ceil(bottom - top + 12) };
    });
    await page.screenshot({ path: path.join(root, "img", "blockly-debug-" + name + ".png"), clip: box, captureBeyondViewport: false });
    let said = "";
    if (scene.run) {
      await page.evaluate((map) => {
        chooseSimulatorMap(map);
        const speed = document.getElementById("simulatorSpeedSelect"); speed.value = "60"; speed.dispatchEvent(new Event("change"));
        clearConsoleLines();
        const realRandom = Math.random;
        Math.random = () => 0.5;
        document.getElementById("runButton").click();
        Math.random = realRandom;
      }, scene.map);
      const started = Date.now();
      while (Date.now() - started < 20000) { await sleep(200); if (await page.evaluate(() => activeRun === null)) break; }
      if (await page.evaluate(() => activeRun !== null)) await page.evaluate(() => document.getElementById("stopButton").click());
      await sleep(300);
      said = await page.evaluate(() => Array.from(document.getElementById("consoleLines").children).map((l) => [l.className.replace("console-line-", ""), l.textContent]));
      consoleText[name] = said;
    }
    console.log(name, box.width + "x" + box.height, said ? JSON.stringify(said) : "");
  }
  fs.writeFileSync(CONSOLE_FILE, JSON.stringify(consoleText, null, 1) + "\n");
  console.log("errors:", JSON.stringify(errors));
  await browser.close();
  server.kill();
})().catch((e) => { console.error(e); process.exit(1); });
