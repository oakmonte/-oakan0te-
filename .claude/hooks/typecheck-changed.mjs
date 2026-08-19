#!/usr/bin/env node
// Stop hook: run `tsc --noEmit`, but only when TypeScript actually changed.
//
// Why not PostToolUse: a full typecheck on this repo takes ~56s. Running it
// after every edit would add minutes per turn and would fire on intermediate
// states of a multi-file change, which are legitimately broken mid-refactor.
//
// Configured with asyncRewake, so the turn ends immediately and this runs in
// the background. Exit 2 wakes the model with the errors; exit 0 is silent.

import { execFileSync, execSync } from "node:child_process";

const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const run = (cmd) => execSync(cmd, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

let changed = "";
try {
  // --porcelain covers modified AND untracked, so a brand-new route counts.
  changed = run(`git status --porcelain -- "*.ts" "*.tsx"`).trim();
} catch {
  process.exit(0); // not a git repo, or git unavailable: nothing to gate on
}

if (!changed) process.exit(0);

try {
  execFileSync(process.execPath, ["node_modules/typescript/bin/tsc", "--noEmit"], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (err) {
  const output = `${err.stdout ?? ""}${err.stderr ?? ""}`.trim();
  if (!output) process.exit(0);
  const lines = output.split("\n");
  const shown = lines.slice(0, 20).join("\n");
  process.stdout.write(
    `bun run typecheck is failing after these changes:\n\n${shown}` +
      (lines.length > 20 ? `\n…and ${lines.length - 20} more lines.` : "") +
      `\n\nFix these before considering the work done.`,
  );
  process.exit(2);
}

process.exit(0);
