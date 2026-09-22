#!/usr/bin/env node
// PreToolUse/Edit|Write hook: refuse hand-edits to generated Supabase types.
//
// All three of these are replaced wholesale by the type generator, so an edit
// here survives exactly until the next regeneration and then vanishes — taking
// whatever fix it encoded with it. They're eslint-ignored for the same reason.
// CLAUDE.md says "generated, don't edit"; this makes that non-negotiable.
//
// One exception: src/lib/integrations/my-supabase/types.ts is the one path
// that's actually regenerable in this session, via the Supabase connector's
// generate_typescript_types against the real project. The PostToolUse matcher
// keys on the operation (mcp__.*__generate_typescript_types) rather than one
// server name, because the same tool is exposed under a different prefix
// depending on how Supabase is connected -- it was pinned to
// mcp__supabase__ and silently stopped firing when the connection moved. That MCP
// call's PostToolUse hook (mark-types-generated.mjs) drops a short-lived
// sentinel; a write to just that path is allowed through if the sentinel is
// present and fresh, and the sentinel is consumed (deleted) either way so it
// only ever covers the one write immediately after a real regeneration. The
// other two paths belong to Lovable's separate managed project — there's no
// tool here that can regenerate those, so they stay permanently blocked.

import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const GENERATED = [
  "src/integrations/supabase/types.ts",
  "src/lib/integrations/supabase/types.ts",
  "src/lib/integrations/my-supabase/types.ts",
];

const REGENERATABLE_PATH = "src/lib/integrations/my-supabase/types.ts";
const SENTINEL_PATH = join(tmpdir(), "oakmonte-my-supabase-types-gen-allowed");
const SENTINEL_MAX_AGE_MS = 5 * 60 * 1000;

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let filePath = "";
  try {
    filePath = JSON.parse(raw)?.tool_input?.file_path ?? "";
  } catch {
    process.exit(0);
  }

  const normalized = filePath.replace(/\\/g, "/");
  const hit = GENERATED.find((g) => normalized.endsWith(g));
  if (!hit) process.exit(0);

  if (hit === REGENERATABLE_PATH && existsSync(SENTINEL_PATH)) {
    const generatedAt = Number(readFileSync(SENTINEL_PATH, "utf8"));
    const fresh = Number.isFinite(generatedAt) && Date.now() - generatedAt <= SENTINEL_MAX_AGE_MS;
    rmSync(SENTINEL_PATH, { force: true });
    if (fresh) process.exit(0);
  }

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          `Blocked: ${hit} is generated and gets replaced wholesale — an edit here is lost at the ` +
          `next regeneration. Change the database schema instead, then regenerate with ` +
          `mcp__supabase__generate_typescript_types and write the full file.`,
      },
    }),
  );
  process.exit(0);
});
