import { lstat, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseEnv } from "node:util";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_ORIGIN = "https://rishenjoikgmfubmnfiu.supabase.co";
const NAMES = ["APP_MODE", "APP_URL", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "AUTH_RATE_LIMIT_SECRET", "AUTH_STATE_SECRET"];
let configurationModule;

async function loadConfigurationModule() {
  // Reuse the actual pure validator without importing an Auth client or Next.
  // TypeScript is already a project dependency; no generated file is written.
  configurationModule ??= (async () => {
    const { transpileModule, ModuleKind, ScriptTarget } = await import("typescript");
    const source = await readFile(new URL("../src/lib/auth/config.ts", import.meta.url), "utf8");
    const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 } });
    return import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`);
  })();
  return configurationModule;
}

function validOrigin(value, production) {
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return !url.username && !url.password && !url.search && !url.hash && url.pathname === "/" &&
      (url.protocol === "https:" || (url.protocol === "http:" && local && !production));
  } catch { return false; }
}

/** Return only allowlisted names, booleans and fixed messages, never input values. */
export async function diagnoseAuthEnvironment(environment) {
  const { getAppMode, readAuthConfiguration } = await loadConfigurationModule();
  const value = (name) => typeof environment[name] === "string" ? environment[name].trim() : "";
  const checks = {};
  function check(name, valid, message) {
    const present = value(name) !== "";
    checks[name] = { present, valid: Boolean(valid), error: valid ? null : present ? message : "Configuração ausente." };
  }
  let modeValid = true, supabaseMode = false;
  try { supabaseMode = getAppMode(environment) === "supabase"; } catch { modeValid = false; }
  const production = environment.NODE_ENV === "production";
  check("APP_MODE", modeValid, "Modo inválido; use demo ou supabase.");
  check("APP_URL", validOrigin(value("APP_URL"), production), "Origin inválida; use HTTPS ou localhost HTTP somente fora de produção, sem caminho, credenciais, query ou fragmento.");
  let personalProject = false;
  try { personalProject = validOrigin(value("SUPABASE_URL"), production) && new URL(value("SUPABASE_URL")).origin === PROJECT_ORIGIN; } catch { /* No input values in diagnostics. */ }
  check("SUPABASE_URL", personalProject, "Origin diferente do projeto pessoal autorizado ou formato inválido.");
  check("SUPABASE_PUBLISHABLE_KEY", /^sb_publishable_[A-Za-z0-9_-]+$/.test(value("SUPABASE_PUBLISHABLE_KEY")), "Formato inválido; exige chave publishable atual.");
  check("SUPABASE_SECRET_KEY", /^sb_secret_[A-Za-z0-9_-]+$/.test(value("SUPABASE_SECRET_KEY")), "Formato inválido; exige chave secret atual.");
  for (const name of ["AUTH_RATE_LIMIT_SECRET", "AUTH_STATE_SECRET"]) {
    check(name, Buffer.byteLength(value(name), "utf8") >= 32, "Exige pelo menos 32 bytes UTF-8 após remover espaços externos.");
  }
  const secrets = ["AUTH_RATE_LIMIT_SECRET", "AUTH_STATE_SECRET", "SUPABASE_SECRET_KEY"].map(value);
  const distinctSecrets = secrets.every(Boolean) && new Set(secrets).size === secrets.length;
  const serverOnly = NAMES.every((name) => environment[`NEXT_PUBLIC_${name}`] === undefined);
  let runtimeConfigurationValid = false;
  try {
    // Inspect a copy to check preparation even in demo. No process/file mutation
    // or client creation: this function only validates configuration strings.
    readAuthConfiguration({ ...environment, APP_MODE: "supabase" });
    runtimeConfigurationValid = true;
  } catch { /* The runtime error must not be printed, even if it changes later. */ }
  const configurationValid = modeValid && Object.values(checks).every((entry) => entry.valid) &&
    distinctSecrets && serverOnly && runtimeConfigurationValid;
  const errors = Object.entries(checks).filter(([, entry]) => !entry.valid).map(([name, entry]) => `${name}: ${entry.error}`);
  if (!distinctSecrets) errors.push("AUTH_RATE_LIMIT_SECRET, AUTH_STATE_SECRET e SUPABASE_SECRET_KEY devem estar presentes e ser distintos.");
  if (!serverOnly) errors.push("Remova os aliases NEXT_PUBLIC_* das configurações de Auth; use somente nomes server-only.");
  if (!runtimeConfigurationValid && Object.values(checks).every((entry) => entry.valid) && distinctSecrets) errors.push("Configuração recusada pelo validador atual de Auth.");
  return { ready: configurationValid, configurationValid, supabaseMode, authEnabled: configurationValid && supabaseMode, production, checks, distinctSecrets, serverOnly, runtimeConfigurationValid, errors };
}

/** Only this repository's .env.local is considered; never search other files. */
export async function checkAuthEnvironment({ root = ROOT, environment = process.env } = {}) {
  const source = { present: false, loaded: false, valid: true, error: null };
  let fileEnvironment = {};
  try {
    const path = join(root, ".env.local");
    const stat = await lstat(path);
    source.present = true;
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error();
    const parsed = parseEnv(await readFile(path, "utf8"));
    // Next expands $references in env files. Refuse ambiguous input instead of
    // approving different secret bytes; process environment stays literal.
    if (NAMES.concat("NODE_ENV").some((name) => parsed[name]?.includes("$"))) {
      source.valid = false;
      source.error = "Expansão de variáveis em .env.local não é aceita neste diagnóstico; forneça valores literais pelo ambiente do processo.";
    } else {
      fileEnvironment = parsed;
      source.loaded = true;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      source.valid = false;
      source.error = "Não foi possível ler .env.local como arquivo regular; conteúdo e detalhes do erro foram omitidos.";
    }
  }
  const merged = { ...fileEnvironment };
  for (const [name, value] of Object.entries(environment)) if (value !== undefined) merged[name] = value;
  const report = await diagnoseAuthEnvironment(merged);
  if (!source.valid) { report.ready = false; report.configurationValid = false; report.authEnabled = false; report.errors.unshift(source.error); }
  return { ...report, sources: { processEnvironment: true, envLocal: source } };
}

async function main() {
  if (process.argv.length > 2) throw new Error();
  const report = await checkAuthEnvironment();
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.ready ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error(JSON.stringify({ ready: false, error: "Diagnóstico local indisponível; confira as dependências e execute sem argumentos. Detalhes foram omitidos." }));
    process.exitCode = 1;
  });
}
