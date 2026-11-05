// Every edit to a versioned file bumps its build number. This checks that it did:
// a sketch (#define FIRMWARE_VERSION "0.10.83") or a page (a version in its
// <title>) that differs from the last commit must also carry a different
// version, and the four sketches that share the motion engine must agree.
//
//   node scripts/check-version-bump.js            the working tree against HEAD
//   node scripts/check-version-bump.js --staged   the index against HEAD (the pre-commit hook)
//   node scripts/check-version-bump.js --base <rev>   against another commit
//
// Build-number bumps only (0.10.82 -> 0.10.83). A new minor or major line is
// reported as a warning, not a failure: it is allowed, but only when the user
// asked for it (see CLAUDE.md), so look twice. A file with no version in it
// (index.html, holonomic.html) is not checked. New files pass.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const staged = args.includes('--staged');
const baseIndex = args.indexOf('--base');
const base = baseIndex >= 0 ? args[baseIndex + 1] : 'HEAD';

function git(argv) {
  return execFileSync('git', argv, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });   // (a new file: git's complaint stays quiet)
}

function committed(file, rev) {
  try {
    return git(['show', rev + ':' + file]);
  } catch (e) {
    return null;   // not in that commit: a new file
  }
}

function current(file) {
  if (staged) return committed(file, '');          // ":path" is the index
  const full = path.join(root, file);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
}

function versionOf(file, text) {
  if (text === null) return null;
  const m = file.endsWith('.ino')
    ? /#define FIRMWARE_VERSION "(\d+\.\d+\.\d+)"/.exec(text)
    : /<title>[^<]*?(\d+\.\d+\.\d+) - Maker Lab Kids<\/title>/.exec(text);
  return m ? m[1] : null;
}

function listFiles() {
  // every tracked (or staged) .ino and .html, except the archive and vendor copies
  const out = git(['ls-files', '--', '*.ino', '*.html']).split('\n').filter(Boolean);
  return out.filter((f) => !f.startsWith('archive/') && !f.startsWith('vendor/') && !f.startsWith('mecanum/v/'));
}

const failures = [];
const warnings = [];
const sketchVersions = {};

for (const file of listFiles()) {
  const before = committed(file, base);
  const now = current(file);
  if (now === null) continue;                       // deleted, or not staged
  const newVersion = versionOf(file, now);
  if (file.endsWith('.ino')) {
    if (!newVersion) { failures.push(file + ': no FIRMWARE_VERSION'); continue; }
    sketchVersions[file] = newVersion;
    const banner = /^\/\/ \S+\.ino\s+\(v(\d+\.\d+\.\d+)/.exec(now);
    if (banner && banner[1] !== newVersion) failures.push(file + ': the header comment says v' + banner[1] + ' but FIRMWARE_VERSION is ' + newVersion);
  }
  if (!newVersion) continue;                        // a page without a version in its title
  if (before === null || before === now) continue;  // new, or unchanged
  const oldVersion = versionOf(file, before);
  if (!oldVersion) continue;
  if (oldVersion === newVersion) {
    failures.push(file + ': edited but still ' + newVersion + ' (bump the build number)');
    continue;
  }
  const o = oldVersion.split('.').map(Number), n = newVersion.split('.').map(Number);
  if (o[0] !== n[0] || o[1] !== n[1]) {
    warnings.push(file + ': ' + oldVersion + ' -> ' + newVersion + ' starts a new line (only with the user\'s say-so)');
  } else if (n[2] <= o[2]) {
    failures.push(file + ': ' + oldVersion + ' -> ' + newVersion + ' goes backwards');
  } else if (n[2] !== o[2] + 1) {
    warnings.push(file + ': ' + oldVersion + ' -> ' + newVersion + ' skips builds');
  }
}

// the four sketches that share the motion engine move together (rename.ino has its own line)
const shared = Object.entries(sketchVersions).filter(([f]) => /^(ir|programming|mecanum_holonomic|calibration)\//.test(f));
if (new Set(shared.map(([, v]) => v)).size > 1) {
  failures.push('the shared sketches disagree: ' + shared.map(([f, v]) => f + ' ' + v).join(', '));
}

for (const w of warnings) console.log('WARN ' + w);
for (const f of failures) console.log('FAIL ' + f);
if (failures.length) {
  console.log(failures.length + ' version problem' + (failures.length > 1 ? 's' : '') + ' (' + (staged ? 'staged' : 'working tree') + ' vs ' + base + ')');
  process.exit(1);
}
console.log('versions ok: every edited sketch or page carries a new build number (' + (staged ? 'staged' : 'working tree') + ' vs ' + base + ')');
