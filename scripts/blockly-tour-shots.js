// Screenshots for the Blockly tour (mecanum/blockly-tour.html): the whole editor with a
// sample program and map 7, plus close-ups, light, and where each labeled part is
// (scripts/blockly-tour-points.json: percent of each picture, for the numbered markers).
// Run: node scripts/blockly-tour-shots.js, then python3 scripts/blockly-tour.py
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const puppeteer = require(path.join(__dirname, "node_modules", "puppeteer"));
const root = path.resolve(__dirname, "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WIDTH = 1400, HEIGHT = 1000, SCALE = 2;

(async () => {
  const server = spawn("node", [path.join(__dirname, "serve.js"), "8215"], { cwd: __dirname, stdio: "ignore" });
  await sleep(700);
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
  await page.evaluateOnNewDocument(() => {
    if (!navigator.bluetooth) Object.defineProperty(navigator, "bluetooth", { value: { requestDevice: () => Promise.reject(new Error("screenshot")) }, configurable: true });
    try { localStorage.clear(); } catch (e) { /* fresh */ }
  });
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: SCALE });
  await page.goto("http://127.0.0.1:8215/mecanum/blocks", { waitUntil: "load" });
  await sleep(1500);
  // (no site menu and no dark title bar: less ink, and they are not part of Blockly)
  await page.evaluate(() => { document.querySelector(".mlk-nav").style.display = "none"; document.querySelector(".page-name").closest("header").style.display = "none"; document.body.style.gridTemplateRows = "auto auto minmax(0, 1fr)"; window.dispatchEvent(new Event("resize")); });
  await sleep(500);
  // a sample program, map 7, the sketch the class uses, a few console lines
  await page.evaluate(() => {
    const example = listLiveExamplePrograms().find((e) => e.name === "Look first");
    addProgram(example.name, example.state);
    const select = document.getElementById("sketchSelect"); select.value = "ir"; select.dispatchEvent(new Event("change"));
    chooseSimulatorMap("gap");
    blockWorkspace.setScale(0.85);
    blockWorkspace.scroll(40, 10);
    clearConsoleLines();
    addConsoleLine("app", 'RUN "Look first" on the simulator.');
    addConsoleLine("simulator", "forward 200 mm   m0,200,0;");
    addConsoleLine("say", "412");
    addConsoleLine("simulator", "turn right 90°   m0,0,90;");
  });
  await sleep(800);
  const parts = {
    robotChip: "#robotChipButton", tabs: "#programTabs", newProgram: "#addProgramButton",
    programMenu: "#programMenuButton", undo: "#undoButton", redo: "#redoButton", run: "#runButton", stop: "#stopButton", runOn: "#runTargetButtons",
    serial: "#connectSerialButton", bluetooth: "#connectBluetoothButton", status: "#connectionStatusChip", sketch: "#sketchSelect",
    slots: "#exportButton", share: "#shareButton", help: "#helpButton", toolbox: ".blocklyToolbox", workspace: "#blocklyDiv",
    zoom: ".blocklyZoom", trash: ".blocklyTrash", mat: "#simulatorCanvas", readout: "#simulatorReadout", task: "#simulatorTask",
    controls: ".simulator-controls", map: "#simulatorMapSelect", speed: "#simulatorSpeedSelect", view: "#simulatorViewSelect",
    bigger: "#simulatorBiggerButton", fullScreen: "#simulatorFullScreenButton", walls: "#simulatorRoomCheckbox", roomWidth: "#simulatorRoomWidthInput",
    back: "#simulatorResetButton", paneTabs: "#paneTabs", console: "#consoleLines", consoleInput: "#consoleSendInput", clear: "#consoleClearButton"
  };
  const boxes = await page.evaluate((parts) => {
    const out = {};
    for (const [name, selector] of Object.entries(parts)) {
      const element = document.querySelector(selector);
      if (!element) { out[name] = null; continue; }
      const r = element.getBoundingClientRect();
      out[name] = { x: r.left, y: r.top, w: r.width, h: r.height };
    }
    // the robot, the lamp-less map's star and a wall, on the mat
    const v = lastSimulatorView, mat = document.getElementById("simulatorCanvas").getBoundingClientRect();
    const toScreen = (r, f) => ({ x: mat.left + v.cssWidth / 2 + (r - v.centreRight) * v.pixelsPerMm, y: mat.top + v.cssHeight / 2 - (f - v.centreForward) * v.pixelsPerMm, w: 0, h: 0 });
    out.robot = toScreen(simulatorWorld.rightMm, simulatorWorld.forwardMm);
    out.star = toScreen(simulatorMap.goal.rightMm, simulatorMap.goal.forwardMm);
    out.wall = toScreen(-700, 0);
    out.sonarLine = toScreen(simulatorWorld.rightMm, simulatorWorld.forwardMm + 400);
    // a block, its dropdown and its number
    const ifBlock = blockWorkspace.getAllBlocks(false).find((b) => b.type === "controls_if");
    const r = ifBlock.getSvgRoot().getBoundingClientRect();
    out.ifBlock = { x: r.left, y: r.top, w: r.width, h: r.height };
    return out;
  }, parts);
  await page.screenshot({ path: path.join(root, "img", "blockly-tour-full.png") });
  const points = { full: { width: WIDTH, height: HEIGHT, boxes } };

  // close-ups: [name, the box to cut (css px)]
  function around(names, pad) {
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    names.forEach((n) => { const b = boxes[n]; left = Math.min(left, b.x); top = Math.min(top, b.y); right = Math.max(right, b.x + b.w); bottom = Math.max(bottom, b.y + b.h); });
    return { x: Math.max(0, Math.floor(left - pad)), y: Math.max(0, Math.floor(top - pad)), width: Math.ceil(right - left + 2 * pad), height: Math.ceil(bottom - top + 2 * pad) };
  }
  const closeUps = {
    runbar: around(["run", "stop", "runOn", "serial", "bluetooth", "status", "sketch", "slots", "share", "help"], 8),
    programbar: around(["robotChip", "tabs", "newProgram", "programMenu", "undo"], 8),
    simulator: around(["mat", "readout", "task", "controls"], 8)
  };
  // The full screenshot holds them all: cut them out of it (a clipped screenshot can come back stale).
  points.closeUps = closeUps;
  // the console with more kinds of lines (a taller window: room for all of them)
  await page.setViewport({ width: WIDTH, height: 1250, deviceScaleFactor: SCALE });
  await sleep(400);
  await page.evaluate(() => {
    clearConsoleLines();
    addConsoleLine("app", "Connected to robot \"Ruby\".");
    addConsoleLine("sent", "m0,200,0;");
    addConsoleLine("robot", "move: done");
    addConsoleLine("simulator", "forward 200 mm   m0,200,0;");
    addConsoleLine("say", "412");
    addConsoleLine("warning", "Caught moving in the dark! (1)");
    addConsoleLine("error", "The robot is not connected.");
    addConsoleLine("say", "★ Made it! Find the gap in 7.4 s.");
    const lines = document.getElementById("consoleLines");
    lines.style.overflow = "visible";
    document.querySelector('[data-pane-body="console"]').style.gridTemplateRows = "auto auto";   // (the command box right under the lines)
    document.querySelector('[data-pane-body="console"]').style.alignContent = "start";
  });
  await sleep(300);
  const consoleBoxes = await page.evaluate(() => {
    const out = {};
    const pane = document.querySelector('[data-pane-body="console"]').getBoundingClientRect();
    const tabs = document.getElementById("paneTabs").getBoundingClientRect();
    const input = document.getElementById("consoleSendForm").getBoundingClientRect();
    out.area = { x: Math.min(pane.left, tabs.left), y: tabs.top, w: Math.max(pane.right, tabs.right) - Math.min(pane.left, tabs.left), h: input.bottom - tabs.top };
    out.lines = Array.from(document.getElementById("consoleLines").children).map((line) => { const r = line.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    for (const [name, selector] of Object.entries({ consoleTab: '[data-pane="console"]', willdoTab: '[data-pane="willdo"]', codeTab: '[data-pane="code"]', input: "#consoleSendInput", send: '#consoleSendForm button[type="submit"]', clear: "#consoleClearButton" })) {
      const r = document.querySelector(selector).getBoundingClientRect(); out[name] = { x: r.left, y: r.top, w: r.width, h: r.height };
    }
    return out;
  });
  await page.screenshot({ path: path.join(root, "img", "blockly-tour-console-full.png") });
  points.console = consoleBoxes;
  points.consoleHeight = 1250;
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: SCALE });
  await sleep(400);
  // the right-click menu on a block
  const ifBox = boxes.ifBlock;
  await page.mouse.click(ifBox.x + 14, ifBox.y + 12, { button: "right" });
  await sleep(500);
  const menuBox = await page.evaluate(() => {
    const menu = document.querySelector(".blocklyContextMenu, .blocklyWidgetDiv .goog-menu, .blocklyMenu");
    if (!menu) return null;
    const r = menu.getBoundingClientRect();
    const box = (el) => { const q = el.getBoundingClientRect(); return { x: q.left, y: q.top, w: q.width, h: q.height }; };
    const ifBlock = blockWorkspace.getAllBlocks(false).find((b) => b.type === "controls_if");
    const sees = blockWorkspace.getAllBlocks(false).find((b) => b.type === "robot_sees_closer");
    const turnBlock = blockWorkspace.getAllBlocks(false).find((b) => b.type === "robot_turn");
    const number = sees.getInputTargetBlock("DISTANCE");
    const gear = ifBlock.getSvgRoot().querySelector(".blocklyIconGroup");
    return { x: r.left, y: r.top, w: r.width, h: r.height,
      items: Array.from(menu.querySelectorAll(".blocklyMenuItem, .goog-menuitem")).map((i) => Object.assign({ text: i.textContent.trim() }, box(i))),
      dropdown: box(sees.getField("SENSOR").getSvgRoot()), number: box(number.getSvgRoot()), gear: gear ? box(gear) : null,
      turnDropdown: box(turnBlock.getField("DIRECTION").getSvgRoot()), turn: box(turnBlock.getSvgRoot()), ifBlock: box(ifBlock.getSvgRoot()) };
  });
  await page.screenshot({ path: path.join(root, "img", "blockly-tour-menu-full.png") });
  points.menu = { menu: menuBox, block: ifBox };
  fs.writeFileSync(path.join(__dirname, "blockly-tour-points.json"), JSON.stringify(points, null, 1));
  console.log("errors:", JSON.stringify(errors), "menu:", menuBox ? menuBox.items.map((i) => i.text).join(" | ") : "none");
  await browser.close();
  server.kill();
})().catch((e) => { console.error(e); process.exit(1); });
