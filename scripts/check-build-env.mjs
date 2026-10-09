import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { diagnoseAuthEnvironment } from "./check-auth-env.mjs";

/** Build input is the hosting process environment, never a local env file. */
export async function checkBuildEnvironment(environment = process.env) {
  const mode = environment.APP_MODE ?? "demo";
  if (mode !== "demo" && mode !== "supabase") {
    return { ready: false, errors: ["APP_MODE: Modo inválido; use demo ou supabase."] };
  }
  if (mode === "demo") return { ready: true, errors: [] };

  // npm prebuild can run before Next sets NODE_ENV. Apply the same production
  // Auth policy now so a connected deployment cannot publish a broken login.
  const report = await diagnoseAuthEnvironment({ ...environment, NODE_ENV: "production" });
  return { ready: report.ready, errors: report.errors };
}

async function main() {
  if (process.argv.length !== 2) throw new Error();
  const report = await checkBuildEnvironment();
  console.log(JSON.stringify(report));
  process.exitCode = report.ready ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error(JSON.stringify({ ready: false, errors: ["Validação de Auth no build indisponível; confira as dependências e execute sem argumentos. Detalhes foram omitidos."] }));
    process.exitCode = 1;
  });
}
