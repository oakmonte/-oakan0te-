#!/usr/bin/env node
// PreToolUse/Edit|Write hook: refuse hand-edits to generated Supabase types.
//
// All three of these are replaced wholesale by the type generator, so an edit
// here survives exactly until the next regeneration and then vanishes — taking
// whatever fix it encoded with it. They're eslint-ignored for the same reason.
// CLAUDE.md says "generated, don't edit"; this makes that non-negotiable.

const GENERATED = [
  "src/integrations/supabase/types.ts",
  "src/lib/integrations/supabase/types.ts",
  "src/lib/integrations/my-supabase/types.ts",
];

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
