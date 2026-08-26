#!/usr/bin/env node
// PostToolUse/mcp__supabase__generate_typescript_types hook: drops a short-lived
// sentinel that block-generated-edits.mjs will accept as proof the very next
// write to src/lib/integrations/my-supabase/types.ts is a real regeneration,
// not a hand-edit. Single-use and time-boxed — see block-generated-edits.mjs
// for how it's consumed.

import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SENTINEL_PATH = join(tmpdir(), "oakmonte-my-supabase-types-gen-allowed");

writeFileSync(SENTINEL_PATH, String(Date.now()));
process.exit(0);
