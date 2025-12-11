// Simple generator to create env.js from env.local (not committed to git)
// Usage: node generate-env.js
const fs = require("fs");
const path = require("path");

const envPath = path.resolve(__dirname, "env.local");
if (!fs.existsSync(envPath)) {
  console.error("env.local not found. Please create env.local with SUPABASE_URL and SUPABASE_ANON_KEY.");
  process.exit(1);
}

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

const parsed = parseEnvFile(envPath);
const SUPABASE_URL = parsed.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = parsed.SUPABASE_ANON_KEY || "";
// Service key, sheet URLs are intentionally NOT exposed to the client.

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("SUPABASE_URL or SUPABASE_ANON_KEY missing in env.local.");
  process.exit(1);
}

const envObject = { SUPABASE_URL, SUPABASE_ANON_KEY };
const output = `window.__ENV__=${JSON.stringify(envObject)};`;
fs.writeFileSync(path.resolve(__dirname, "env.js"), output, "utf8");
console.log("env.js generated successfully.");
