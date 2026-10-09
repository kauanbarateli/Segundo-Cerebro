import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
/** Signature gate only; output contains rule and filename, never matched bytes. */
export function secretFindings(source) {
  // Fixtures are exact literals, never exempt arbitrary credentials by prefix.
  const safeFixtures = new Set(["sb_secret_fake_only_for_test", "sb_secret_fake_test_only", "sb_secret_example", "sb_secret_offline_fixture"]);
  return [
    ["private-key", /-----BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/\r\n]{40,}/],
    ["github-token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{60,}\b/],
    ["google-client-secret", /\bGOCSPX-[A-Za-z0-9_-]{25,}\b/],
    ["supabase-secret", { test: value => [...value.matchAll(/\bsb_secret_[A-Za-z0-9_-]{24,}\b/g)].some(match => !safeFixtures.has(match[0])) }],
    ["aws-access-key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ].filter(([, expression]) => expression.test(source)).map(([name]) => name);
}
function main() {
  const paths = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" }).split("\0").filter(Boolean);
  const findings = []; let count = 0;
  for (const path of paths) {
    if (/\.(?:png|jpe?g|webp|ico|woff2?|pdf|mp4|zip|gz)$/i.test(path) || !statSync(path).isFile()) continue;
    const bytes = readFileSync(path); if (bytes.includes(0)) continue;
    count++; for (const rule of secretFindings(bytes.toString("utf8"))) findings.push(`${path}: ${rule}`);
  }
  if (findings.length) throw new Error("Assinaturas de credenciais detectadas:\n" + findings.join("\n"));
  console.log(`Segredos: ${count} arquivos versionáveis verificados; nenhum valor foi impresso.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
