// maps-e2e: runs a solution on each Blockly simulator map, built from the subroutine
// toolbox (toolboxExampleState in mecanum/blocks.html), with the maps' random choices
// pinned, and checks that every run reaches the star. Also checks that lazy programs
// do not (they bump the wall or the door). node scripts/mecanum-sim/maps-e2e.js
const path = require("path");
const { spawn } = require("child_process");
const puppeteer = require(path.join(__dirname, "..", "node_modules", "puppeteer"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = "8218";
const server = spawn("node", [path.join(__dirname, "..", "serve.js"), port], { cwd: path.join(__dirname, ".."), stdio: "ignore" });

// [map id, Math.random values for the build, main program (in page terms), seconds allowed]
const CASES = [
  ["box", [], "drive:270:450|drive:0:1200|drive:90:450", 30],
  ["hallway", [], "drive:0:1450|drive:90:650|drive:180:1450|drive:90:650|drive:0:1450", 60],
  ["wall", [0.2], "call:creep to wall:100,45", 40],
  ["wall", [0.9], "call:creep to wall:100,45", 40],
  ["tile", [0.5], "call:go until dark tile", 40],
  ["tile", [0.0], "call:go until dark tile", 40],
  ["light", [0.1], "repeat:12:call:face the light;drive:0:150", 60],
  ["light", [0.8], "repeat:12:call:face the light;drive:0:150", 60],
  ["gap", [0.8], "call:go until wall|call:slide right until gap:500,30|drive:0:1050", 60],
  ["door", [0.3, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], "call:creep to wall:80,40|call:wait until clear:200,30|drive:0:1500", 60],
  ["redlight", [], "call:go on green:2500,100,20", 120],
  ["maze", [0.1], "maze", 200],
  ["maze", [0.5], "maze", 200],
  ["maze", [0.9], "maze", 200],
  ["door", [0.9], "drive:0:1800", 40, "lazy"],
  ["wall", [0.5], "drive:0:2500", 40, "lazy"]
];

(async () => {
  await sleep(700);
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
  page.on("dialog", (d) => d.dismiss());
  await page.setViewport({ width: 1300, height: 900 });
  await page.goto("http://127.0.0.1:" + port + "/mecanum/blocks", { waitUntil: "load" });
  await sleep(1500);
  let failures = 0;
  for (const [mapId, randoms, main, seconds, lazy] of CASES) {
    await page.evaluate((mapId, randoms, main) => {
      chooseSimulatorMap(mapId);
      const state = toolboxExampleState();
      const params = {}; state.blocks.blocks.forEach((b) => { if (b.fields && b.fields.NAME) params[b.fields.NAME] = (b.extraState && b.extraState.params || []).map((p) => p.name); });
      const num = (v) => ({ shadow: { type: "math_number", fields: { NUM: Number(v) } } });
      function step(text) {
        const parts = text.split(":");
        if (parts[0] === "drive") return { type: "robot_drive", fields: { DIRECTION: parts[1] }, inputs: { DISTANCE: num(parts[2]) } };
        if (parts[0] === "turn") return { type: "robot_turn", fields: { DIRECTION: parts[1] }, inputs: { ANGLE: num(parts[2]) } };
        if (parts[0] === "call") {
          const values = parts[2] ? parts[2].split(",") : [];
          const block = { type: "procedures_callnoreturn", extraState: { name: parts[1], params: params[parts[1]] }, inputs: {} };
          values.forEach((v, i) => { block.inputs["ARG" + i] = { block: { type: "math_number", fields: { NUM: Number(v) } } }; });
          return block;
        }
        if (parts[0] === "repeat") { return { type: "controls_repeat_ext", inputs: { TIMES: num(parts[1]), DO: { block: chain(parts.slice(2).join(":").split(";").map(step)) } } }; }
        throw new Error("step " + text);
      }
      function chain(list) { for (let i = list.length - 2; i >= 0; i--) list[i].next = { block: list[i + 1] }; return list[0]; }
      let body;
      if (main === "maze") {
        // the right-hand rule, one cell at a time: right if open, else ahead, else left, else back
        const closer = { type: "robot_sees_closer", fields: { SENSOR: "sonar" }, inputs: { DISTANCE: num(500) } };
        const c = () => JSON.parse(JSON.stringify(closer));
        body = [{ type: "controls_repeat_ext", inputs: { TIMES: num(14), DO: { block: chain([
          step("turn:1:90"),
          { type: "controls_if", inputs: { IF0: { block: c() }, DO0: { block: chain([step("turn:-1:90"),
            { type: "controls_if", inputs: { IF0: { block: c() }, DO0: { block: chain([step("turn:-1:90"),
              { type: "controls_if", inputs: { IF0: { block: c() }, DO0: { block: step("turn:-1:90") } } }]) } } }]) } } },
          step("drive:0:800")
        ]) } } }];
      } else {
        body = main.split("|").map(step);
      }
      state.blocks.blocks[0] = { type: "robot_start", x: 600, y: 0, next: { block: chain(body) } };
      addProgram("Test " + mapId, state);
      const sp = document.getElementById("simulatorSpeedSelect"); sp.value = "60"; sp.dispatchEvent(new Event("change"));
      clearConsoleLines();
      const queue = randoms.slice();
      const realRandom = Math.random;
      Math.random = () => (queue.length ? queue.shift() : realRandom());
      document.getElementById("runButton").click();
      Math.random = realRandom;
    }, mapId, randoms, main);
    const started = Date.now();
    while (Date.now() - started < seconds * 1000) {
      await sleep(250);
      if (await page.evaluate(() => activeRun === null)) break;
    }
    const stillRunning = await page.evaluate(() => activeRun !== null);
    if (stillRunning) await page.evaluate(() => document.getElementById("stopButton").click());
    const text = await page.evaluate(() => document.getElementById("consoleLines").innerText);
    const made = (text.match(/★[^\n]*/) || [""])[0];
    const caught = (text.match(/Caught[^\n]*/g) || []).length;
    const bumps = (text.match(/bumped the wall|pushing against the wall/g) || []).length;
    const ok = lazy ? !made && bumps > 0 : Boolean(made);
    if (!ok) failures++;
    console.log((ok ? "ok   " : "FAIL ") + (lazy ? "(lazy, must not make it) " : "") + mapId + " " + JSON.stringify(randoms.slice(0, 1)) + ": " + (made || "no star") + (stillRunning ? " (still running, stopped)" : "") + (caught ? ", caught x" + caught : "") + (bumps ? ", bump lines " + bumps : ""));
    if (!ok) console.log(text.split("\n").slice(-6).join("\n   "));
  }
  console.log("errors:", JSON.stringify(errors), "failures:", failures);
  await browser.close();
  server.kill();
  process.exit(failures || errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
