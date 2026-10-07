import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = "0.1.6";
const skillScripts = path.join(root, ".agents", "skills", "impeccable", "scripts");
const declaredVersion = readFileSync(path.join(skillScripts, "VERSION"), "utf8").trim();
if (declaredVersion !== version) throw new Error(`Engine Impeccable inesperado: ${declaredVersion}; esperado ${version}. Revise o portão antes de atualizar.`);

// Local default stays inside ignored work/. CI supplies runner.temp; no home writes.
const cache = path.resolve(process.env.IMPECCABLE_HOME ?? path.join(root, "work", "impeccable-cache"));
const windows = process.platform === "win32";
const binary = path.join(cache, "bin", version, windows ? "impeccable.exe" : "impeccable");
const launcher = path.join(skillScripts, windows ? "impeccable.cmd" : "impeccable");
const environment = { ...process.env, IMPECCABLE_HOME: cache };
// Prefer the task's versioned cache over unrelated home/PATH installations.
if (existsSync(binary)) environment.IMPECCABLE_BIN = binary;

function launch(args) {
  // Every argument is a constant below; do not accept interpolated shell arguments.
  const result = windows
    ? spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `""${launcher}" ${args.join(" ")}"`], {
      cwd: root, env: environment, encoding: "utf8", windowsHide: true, windowsVerbatimArguments: true,
      timeout: 180_000, maxBuffer: 8 * 1024 * 1024,
    })
    : spawnSync("sh", [launcher, ...args], {
      cwd: root, env: environment, encoding: "utf8", timeout: 180_000, maxBuffer: 8 * 1024 * 1024,
    });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`Impeccable interrompido: ${result.signal}`);
  if (result.stderr) process.stderr.write(result.stderr);
  return result;
}

const probe = launch(["engine-probe"]);
if (probe.status !== 0 || probe.stdout.trim() !== `impeccable-engine ${version}`) {
  throw new Error(`Não foi possível confirmar o engine ${version}. Resposta: ${probe.stdout.trim() || "vazia"}; código ${probe.status}.`);
}

const scan = launch(["detect", "src", "--json"]);
let findings;
try { findings = JSON.parse(scan.stdout); } catch { throw new Error("O detector não retornou JSON válido; a análise não pode ser considerada aprovada."); }
if (!Array.isArray(findings)) throw new Error("Formato inesperado no relatório Impeccable; esperado array de achados.");

const reportDirectory = path.join(root, "work", "impeccable-reports");
mkdirSync(reportDirectory, { recursive: true });
writeFileSync(path.join(reportDirectory, "detect-src.json"), `${JSON.stringify({
  engine: version, target: "src", exitCode: scan.status, findings,
}, null, 2)}\n`);
if (scan.status !== 0) {
  process.stderr.write(`${JSON.stringify(findings, null, 2)}\n`);
  throw new Error(scan.status === 2
    ? "Impeccable encontrou problemas primários. Corrija ou revise cada achado em contexto; o CI não adiciona supressões."
    : `A análise Impeccable falhou operacionalmente (código ${scan.status}).`);
}

// The pinned engine reserves exit 2 for primary findings; advisories never block.
// Keep all advisories in the artifact rather than globally hiding their rules.
console.log(`Impeccable engine ${version}: src aprovado; ${findings.length} registro(s) no relatório completo.`);
