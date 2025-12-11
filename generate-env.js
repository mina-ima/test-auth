// Simple generator to create env.js from process.env (preferred) or env.local (fallback)
// Usage: node generate-env.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Very small .env parser (no dependencies): supports KEY=VALUE lines, ignores blanks/comments.
 */
function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const result = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    result[key] = value;
  }
  return result;
}

let SUPABASE_URL = process.env.SUPABASE_URL || "";
let SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  const envPath = path.resolve(__dirname, "env.local");
  if (fs.existsSync(envPath)) {
    const parsed = parseEnvFile(envPath);
    SUPABASE_URL = SUPABASE_URL || parsed.SUPABASE_URL || "";
    SUPABASE_ANON_KEY = SUPABASE_ANON_KEY || parsed.SUPABASE_ANON_KEY || "";
  }
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("SUPABASE_URL or SUPABASE_ANON_KEY missing. Set env vars or env.local.");
  process.exit(1);
}

const envObject = { SUPABASE_URL, SUPABASE_ANON_KEY };
const output = `window.__ENV__=${JSON.stringify(envObject)};`;
fs.writeFileSync(path.resolve(__dirname, "env.js"), output, "utf8");
console.log("env.js generated successfully.");
