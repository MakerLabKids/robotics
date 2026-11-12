// layout-e2e: the Blockly page's layout on a laptop and a phone, driven with a real mouse and
// touch: drag the splitter beside the panel (wider, then shut = hidden), its button, the
// splitter between the simulator and the console (taller, shut = hidden, Show again),
// double-click to reset, More room, the phone drawer (drag it taller, fill the screen, drag
// it shut), the program tabs keeping room on a phone, and every size surviving a reload.
// node scripts/mecanum-sim/layout-e2e.js
const path = require("path");
const { spawn } = require("child_process");
const puppeteer = require(path.join(__dirname, "..", "node_modules", "puppeteer"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = "8219";
const server = spawn("node", [path.join(__dirname, "..", "serve.js"), port], { cwd: path.join(__dirname, ".."), stdio: "ignore" });

let failures = 0;
function check(ok, what, detail) {
  if (!ok) failures++;
  console.log((ok ? "ok   " : "FAIL ") + what + (detail !== undefined ? ": " + detail : ""));
}

async function box(page, selector) {
  return page.evaluate((s) => {
    const e = document.querySelector(s);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, shown: r.width > 0 && r.height > 0 && getComputedStyle(e).display !== "none" };
  }, selector);
}

async function drag(page, selector, dx, dy, where) {
  const b = await box(page, selector);
  const x = b.x + (where ? where.x : b.w / 2), y = b.y + (where ? where.y : b.h / 2);
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x + dx * i / 8, y + dy * i / 8);
  await page.mouse.up();
  await sleep(300);
}

async function laptop(browser) {
  const page = await browser.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
  await page.setViewport({ width: 1366, height: 768 });
  await page.goto("http://127.0.0.1:" + port + "/mecanum/blocks", { waitUntil: "load" });
  await sleep(1500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* fresh */ } });
  await page.reload({ waitUntil: "load" });
  await sleep(1500);

  const title = await box(page, ".site-bar");
  check(!title.shown, "laptop 1366 x 768: the title row makes room by itself");
  const tabs = await box(page, "#paneTabs");
  check(tabs.shown && tabs.y + tabs.h < 768 - 60, "the console is on screen under the simulator", Math.round(tabs.y));
  const mat0 = await box(page, "#simulatorCanvas");
  check(mat0.h >= 150, "the simulator mat has room", Math.round(mat0.h));

  const panel0 = await box(page, "#sidePanel");
  await drag(page, "#sideSplitter", -200, 0, { x: 6, y: 300 });
  const panel1 = await box(page, "#sidePanel");
  check(Math.abs(panel1.w - (panel0.w + 200)) < 8, "dragging the splitter left widens the panel", Math.round(panel0.w) + " -> " + Math.round(panel1.w));
  const blocks1 = await box(page, "#blocklyArea");
  const svg1 = await page.evaluate(() => document.querySelector("#blocklyDiv svg.blocklySvg").getBoundingClientRect().width);
  check(Math.abs(svg1 - blocks1.w) < 3, "Blockly follows the new width", Math.round(svg1) + " / " + Math.round(blocks1.w));

  await page.click("#sidePanelToggleButton");
  await sleep(300);
  const hidden = await box(page, "#sidePanel");
  const blocksWide = await box(page, "#blocklyArea");
  check(!hidden.shown && blocksWide.w > 1366 - 160 - 20, "the splitter's button hides the panel: the blocks get the room", Math.round(blocksWide.w));
  await page.click("#sidePanelToggleButton");
  await sleep(300);
  const back = await box(page, "#sidePanel");
  check(back.shown && Math.abs(back.w - panel1.w) < 8, "and shows it again at the dragged width", Math.round(back.w));

  await drag(page, "#sideSplitter", 2000, 0, { x: 6, y: 300 });
  check(!(await box(page, "#sidePanel")).shown, "dragged shut, the panel hides");
  await drag(page, "#sideSplitter", -380, 0, { x: 6, y: 300 });
  const reopened = await box(page, "#sidePanel");
  check(reopened.shown && reopened.w > 300, "dragged out again, it comes back", Math.round(reopened.w));

  const matA = await box(page, "#simulatorCanvas");
  await drag(page, "#simSplitter", 0, -60, { x: 30, y: 7 });
  const matB = await box(page, "#simulatorCanvas");
  check(matB.h < matA.h - 40, "dragging the middle splitter up makes the mat shorter", Math.round(matA.h) + " -> " + Math.round(matB.h));
  const consoleB = await box(page, "#consoleLines");
  await drag(page, "#simSplitter", 0, 2000, { x: 30, y: 7 });
  const tabsC = await box(page, "#paneTabs");
  check(tabsC.shown && tabsC.y + tabsC.h <= 768, "dragged all the way down, the console's tabs stay on screen", Math.round(tabsC.y));
  await drag(page, "#simSplitter", 0, -2000, { x: 30, y: 7 });
  check(!(await box(page, "#simulatorSection")).shown, "dragged all the way up, the simulator hides");
  const consoleD = await box(page, "#consoleLines");
  check(consoleD.h > consoleB.h + 150, "and the console gets the room", Math.round(consoleB.h) + " -> " + Math.round(consoleD.h));
  check((await page.$eval("#simulatorToggleButton", (b) => b.textContent)).includes("Show"), "the splitter's button now says Show simulator");
  await page.click("#simulatorToggleButton");
  await sleep(300);
  check((await box(page, "#simulatorSection")).shown, "Show simulator brings it back");

  await page.click("#moreRoomButton");
  await sleep(300);
  const nav = await box(page, ".mlk-nav");
  const programBar = await box(page, ".program-bar");
  check(!nav.shown && programBar.y < 5, "More room hides the site menu", Math.round(programBar.y));

  // sizes survive a reload
  const before = await box(page, "#sidePanel");
  const matBefore = await box(page, "#simulatorCanvas");
  await page.reload({ waitUntil: "load" });
  await sleep(1500);
  const after = await box(page, "#sidePanel");
  const matAfter = await box(page, "#simulatorCanvas");
  check(Math.abs(after.w - before.w) < 4 && Math.abs(matAfter.h - matBefore.h) < 4 && !(await box(page, ".mlk-nav")).shown,
    "after a reload: the same width, mat and More room", Math.round(after.w) + " x " + Math.round(matAfter.h));

  // double-click puts things back
  const s = await box(page, "#sideSplitter");
  await page.mouse.click(s.x + 6, s.y + 300, { clickCount: 2 });
  await sleep(300);
  check(Math.abs((await box(page, "#sidePanel")).w - 360) < 4, "double-click on the splitter: the page's own width", Math.round((await box(page, "#sidePanel")).w));

  // Bigger still works, and a drag takes over from it
  await page.click("#simulatorBiggerButton");
  await sleep(400);
  const big = await box(page, "#sidePanel");
  check(big.w > 600, "Bigger makes the panel wide", Math.round(big.w));
  await drag(page, "#sideSplitter", 150, 0, { x: 6, y: 300 });
  check((await page.$eval("#simulatorBiggerButton", (b) => b.textContent)) === "Bigger", "a drag after Bigger: the button says Bigger again");

  check(errors.length === 0, "laptop: no page errors", JSON.stringify(errors));
  await page.close();
}

async function phone(browser) {
  const page = await browser.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto("http://127.0.0.1:" + port + "/mecanum/blocks", { waitUntil: "load" });
  await sleep(1500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* fresh */ } });
  await page.reload({ waitUntil: "load" });
  await sleep(1500);

  const tabs = await box(page, "#programTabs");
  check(tabs.w > 300, "phone: the program tabs have a row of their own", Math.round(tabs.w));
  const bar = await box(page, ".program-bar");
  check(bar.h < 110, "phone: the buttons above the tabs fit on one row", Math.round(bar.h));

  await page.tap('#paneTabs button[data-pane="simulator"]');
  await sleep(400);
  const drawer0 = await box(page, "#sidePanel");
  const mat0 = await box(page, "#simulatorCanvas");
  check(drawer0.h > 300 && mat0.shown, "phone: the Simulator tab opens the drawer", Math.round(drawer0.h));

  const handle = await box(page, "#drawerHandle");
  const cdp = await page.target().createCDPSession();
  async function touchDrag(x, y, dy) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let i = 1; i <= 8; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + dy * i / 8 }] }); await sleep(16); }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await sleep(400);
  }
  await touchDrag(handle.x + handle.w / 2, handle.y + handle.h / 2, -150);
  const drawer1 = await box(page, "#sidePanel");
  const mat1 = await box(page, "#simulatorCanvas");
  check(drawer1.h > drawer0.h + 120, "phone: a finger drags the drawer taller", Math.round(drawer0.h) + " -> " + Math.round(drawer1.h));
  check(mat1.h > mat0.h + 100, "and the mat grows with it", Math.round(mat0.h) + " -> " + Math.round(mat1.h));

  const blocksBefore = await box(page, "#blocklyArea");
  await page.tap("#drawerMaximizeButton");
  await sleep(400);
  const blocksGone = await box(page, "#blocklyArea");
  check(blocksGone.h < 5, "phone: the fill-the-screen button covers the blocks", Math.round(blocksGone.h));
  await page.tap("#drawerMaximizeButton");
  await sleep(400);
  const blocksBack = await box(page, "#blocklyArea");
  check(Math.abs(blocksBack.h - blocksBefore.h) < 6 && blocksBack.h > 30, "and again gives them back", Math.round(blocksBack.h));

  const handle2 = await box(page, "#drawerHandle");
  await touchDrag(handle2.x + handle2.w / 2, handle2.y + handle2.h / 2, 830 - (handle2.y + handle2.h / 2));   // (a finger stays on the screen)
  const closed = await box(page, "#sidePanel");
  check(closed.h < 60 && !(await box(page, "#drawerHandle")).shown, "phone: dragged down, the drawer closes to its tabs", Math.round(closed.h));
  await sleep(1000);   // (a tap right after a touch reads as a double-tap and gets no click)
  await page.tap('#paneTabs button[data-pane="console"]');
  await sleep(400);
  const reopened = await box(page, "#sidePanel");
  check(Math.abs(reopened.h - drawer1.h) < 6, "the Console tab opens it at the dragged height", Math.round(reopened.h));

  check(errors.length === 0, "phone: no page errors", JSON.stringify(errors));
  await page.close();
}

async function sideways(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true });
  await page.goto("http://127.0.0.1:" + port + "/mecanum/blocks", { waitUntil: "load" });
  await sleep(1500);
  const nav = await box(page, ".mlk-nav");
  const blocks = await box(page, "#blocklyArea");
  check(!nav.shown && blocks.h > 190, "phone on its side: the site menu makes room by itself", Math.round(blocks.h));
  await page.close();
}

(async () => {
  await sleep(700);
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  try {
    await laptop(browser);
    await phone(browser);
    await sideways(browser);
  } catch (e) {
    failures++;
    console.log("FAIL " + (e.stack || e));
  }
  console.log(failures ? failures + " failed" : "all layout checks pass");
  await browser.close();
  server.kill();
  process.exit(failures ? 1 : 0);
})();
