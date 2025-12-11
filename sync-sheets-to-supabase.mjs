// Sync Google Sheets CSV -> Supabase (apps, user_apps)
// Requirements: Node 18+ (built-in fetch), @supabase/supabase-js
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SHEETS_USERS_URL=... SHEETS_APPS_URL=... node sync-sheets-to-supabase.mjs

import { createClient } from "@supabase/supabase-js";

const env = process.env;
const SUPABASE_URL = env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || "";
const SHEETS_USERS_URL = env.SHEETS_USERS_URL || ""; // email, app_no, allowed, editor
const SHEETS_APPS_URL = env.SHEETS_APPS_URL || ""; // app_no, label, url

const required = [
  ["SUPABASE_URL", SUPABASE_URL],
  ["SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY],
  ["SHEETS_USERS_URL", SHEETS_USERS_URL],
  ["SHEETS_APPS_URL", SHEETS_APPS_URL],
];
const missing = required.filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error("Missing env:", missing.join(", "));
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const normalizeEmail = (val = "") => val.replace(/[\u200B-\u200D\uFEFF]/g, "").trim().toLowerCase();
const yes = new Set(["true", "1", "yes", "y", "ok", "allow"]);

const parseCsvLine = (line) => {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
};

const parseCsv = (text) => {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const obj = {};
    headers.forEach((h, i) => obj[h] = cols[i] ?? "");
    return obj;
  });
};

async function fetchCsv(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Fetch failed ${resp.status}: ${url}`);
  return resp.text();
}

async function main() {
  console.log("Fetching sheets...");
  const [usersText, appsText] = await Promise.all([
    fetchCsv(SHEETS_USERS_URL),
    fetchCsv(SHEETS_APPS_URL),
  ]);

  const usersRows = parseCsv(usersText)
    .flatMap(({ email = "", app_no = "", allowed = "", editor = "" }) => {
      const emailNorm = normalizeEmail(email);
      const allowedFlag = yes.has((allowed || "").toLowerCase());
      const editorFlag = yes.has((editor || "").toLowerCase());
      const appNos = (app_no || "")
        .split(/[,\s]+/)
        .map((v) => v.trim())
        .filter(Boolean);
      return appNos.map((no) => ({ email: emailNorm, app_no: no, allowed: allowedFlag, editor: editorFlag }));
    })
    .filter((r) => r.email && r.app_no);

  const appRows = parseCsv(appsText)
    .map(({ app_no = "", label = "", url = "" }) => ({
      app_no: (app_no || "").trim(),
      label: (label || "").trim(),
      url: (url || "").trim(),
    }))
    .filter((r) => r.app_no && r.label && r.url);

  console.log(`Upserting apps (${appRows.length})...`);
  const { error: appErr } = await supabase
    .from("apps")
    .upsert(appRows, { onConflict: "app_no" });
  if (appErr) throw appErr;

  console.log(`Upserting user_apps (${usersRows.length})...`);
  const { error: uaErr } = await supabase
    .from("user_apps")
    .upsert(usersRows, { onConflict: "email,app_no" });
  if (uaErr) throw uaErr;

  console.log("Sync done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
