import { readdir, readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { pathToFileURL } from "node:url";

// Defense in depth alongside server-only and dependency-cruiser. This signature
// scan is not a general secret detector; never print matched credential values.
export function authBundleFindings(source) {
  const rules = [
    ["privileged-key", /sb_secret_[A-Za-z0-9_-]+/],
    ["server-environment", /SUPABASE_SECRET_KEY|AUTH_STATE_SECRET|AUTH_RATE_LIMIT_SECRET/],
    ["auth-sdk", /GoTrueClient|SupabaseAuthClient|@supabase\/(?:supabase-js|auth-js|ssr)/],
    ["auth-token-storage", /["'](?:access_token|refresh_token)["']\s*[:=]/],
    ["literal-jwt", /eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}/],
  ];
  return rules.filter(([, expression]) => expression.test(source)).map(([name]) => name);
}

async function main() {
  const root = resolve(".next/static"), violations = [];
  let count = 0;
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && /\.js(?:\.map)?$/.test(entry.name)) {
        count++;
        for (const rule of authBundleFindings(await readFile(path, "utf8"))) violations.push(`${relative(root, path)}: ${rule}`);
      }
    }
  }
  await visit(root);
  if (!count) throw new Error("Nenhum bundle encontrado. Execute o build antes da varredura.");
  if (violations.length) throw new Error(`Fronteira de autenticação violada:\n${violations.join("\n")}`);
  console.log(`Auth: ${count} bundles públicos verificados, sem assinaturas de SDK, tokens ou segredos do servidor.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
