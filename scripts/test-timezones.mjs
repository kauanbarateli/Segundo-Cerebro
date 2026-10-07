import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const vitest = fileURLToPath(new URL("../node_modules/vitest/vitest.mjs", import.meta.url));
for (const timezone of ["UTC", "America/Sao_Paulo"]) {
  console.log(`\nVerificando regras e contratos com TZ=${timezone}`);
  const result = spawnSync(process.execPath, [vitest, "run"], {
    stdio: "inherit", env: { ...process.env, TZ: timezone }, windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
