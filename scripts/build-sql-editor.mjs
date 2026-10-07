import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = "supabase/sql-editor";
const migrationPattern = /^(\d{14})_([a-z0-9_]+)\.sql$/;

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function entries(directory, optional = false) {
  try {
    if (!lstatSync(directory).isDirectory()) throw new Error(`Expected directory: ${directory}`);
    return readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  } catch (error) {
    if (optional && error.code === "ENOENT") return [];
    throw error;
  }
}

function readFile(root, relative) {
  const file = path.join(root, relative);
  if (!lstatSync(file).isFile()) throw new Error(`Expected regular file: ${relative}`);
  return readFileSync(file);
}

function sourceRecord(source, content) {
  return { source, sha256: sha256(content), bytes: content.length };
}

/** Only reads local canonical files. SQL bytes, transaction boundaries and order are preserved. */
export function planSqlEditor(root = defaultRoot) {
  root = path.resolve(root);
  entries(path.join(root, "supabase"));
  const files = new Map();
  const versions = new Set();
  const installation = [];
  for (const entry of entries(path.join(root, "supabase/migrations"))) {
    if (entry.name.endsWith(".md") && entry.isFile()) continue;
    const match = migrationPattern.exec(entry.name);
    if (!entry.isFile() || !match) throw new Error(`Invalid canonical migration: ${entry.name}`);
    if (versions.has(match[1])) throw new Error(`Duplicate migration version: ${match[1]}`);
    versions.add(match[1]);
    const source = `supabase/migrations/${entry.name}`;
    const content = readFile(root, source);
    if (!content.length) throw new Error(`Empty migration: ${source}`);
    const order = installation.length + 1;
    const output = `installation/${String(order).padStart(3, "0")}_${entry.name}`;
    files.set(output, content);
    installation.push({ order, version: match[1], ...sourceRecord(source, content), file: output });
  }
  if (!installation.length) throw new Error("No canonical migrations found");

  const separate = [];
  for (const [directory, purpose] of [["tests", "validation"], ["manual", "manual"]]) {
    for (const entry of entries(path.join(root, "supabase", directory), true)) {
      if (entry.name.endsWith(".md") && entry.isFile()) continue;
      if (!entry.isFile() || !/^[a-z0-9_-]+\.sql$/.test(entry.name)) throw new Error(`Invalid separate SQL file: ${directory}/${entry.name}`);
      const source = `supabase/${directory}/${entry.name}`;
      const content = readFile(root, source);
      if (!/\brollback;\s*$/i.test(content.toString("utf8"))) {
        throw new Error(`Separate manual/validation file must end with explicit ROLLBACK;: ${source}`);
      }
      separate.push({ purpose, ...sourceRecord(source, content) });
    }
  }
  const manifest = {
    formatVersion: 1,
    purpose: "Manual SQL Editor preparation only; no SQL executed or application history recorded.",
    hashAlgorithm: "sha256",
    hashInput: "Exact canonical file bytes; repository text files use LF.",
    installation,
    separate,
  };
  files.set("manifest.json", Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`));
  files.set("README.md", Buffer.from([
    "# Pacote para aplicação manual no SQL Editor",
    "",
    "Gerado por `node scripts/build-sql-editor.mjs`. Não editar cópias; altere as migrations canônicas e gere novamente.",
    "Antes de usar: `node scripts/build-sql-editor.mjs --check`. Esse comando verifica arquivos/hashes; não consulta nem altera banco.",
    "Este pacote é a alternativa manual à aplicação supervisionada autorizada na [OP-009](../../docs/implementation/decisoes-operacionais.md#op-009--conexão-pessoal-e-aplicação-supervisionada). Conferir o histórico e o estado do destino antes de selecionar arquivos pendentes; não reaplicar migrations já confirmadas.",
    "",
    "## Instalação",
    "",
    "No projeto pessoal novo e dedicado, revisar e executar manualmente um arquivo completo por vez, na ordem abaixo. Conferir sucesso antes do próximo arquivo.",
    "Cada arquivo preserva exatamente o SQL e as transações da migration original. Falha interrompe a sequência; não continuar após erro.",
    "",
    ...installation.map((record) => `${record.order}. [${record.file}](${record.file}) — versão ${record.version}`),
    "",
    "A migration inicial recusa reexecução e destinos com contas/objetos preexistentes por preflight. Este pacote não faz instalação incremental nem detecta migrations já aplicadas.",
    "O operador registra externamente versão, hash, destino e resultado. O manifest é integridade local; não é histórico de aplicação do Supabase.",
    "",
    "## Validação e bootstrap separados",
    "",
    "Os arquivos abaixo não estão na instalação. Consultar os pré-requisitos em [supabase/README.md](../README.md) antes de qualquer execução manual.",
    "Todos terminam com ROLLBACK explícito. O bootstrap fornecido é uma simulação; persistir o primeiro master exige decisão manual após conferir o UUID.",
    "",
    ...separate.map((record) => `- [${record.source}](../${record.source.slice("supabase/".length)}) — ${record.purpose === "validation" ? "asserção manual" : "operação manual separada"}`),
    "",
    "Nenhum SQL é aplicado por este gerador. RLS, Auth, concorrência e grants efetivos exigem evidência de execução autorizada e registrada; a integridade do pacote não atesta esses resultados. Consulte [o registro operacional](../../docs/implementation/decisoes-operacionais.md) para o estado vigente.",
    "",
  ].join("\n")));
  return { root, manifest, files };
}

function outputFiles(directory, prefix = "") {
  return entries(directory, true).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return outputFiles(path.join(directory, entry.name), relative);
    if (!entry.isFile()) throw new Error(`Unexpected non-regular output: ${relative}`);
    return [relative];
  });
}

export function buildSqlEditor({ root = defaultRoot, check = false } = {}) {
  const plan = planSqlEditor(root);
  const directory = path.join(plan.root, outputDirectory);
  const existing = outputFiles(directory);
  const unexpected = existing.filter((file) => !plan.files.has(file));
  const differences = unexpected.map((file) => `Unexpected generated file: ${file}`);
  for (const [file, expected] of plan.files) {
    if (!existing.includes(file)) differences.push(`Missing generated file: ${file}`);
    else if (!readFile(plan.root, `${outputDirectory}/${file}`).equals(expected)) differences.push(`Drift: ${file}`);
  }
  if (check) {
    if (differences.length) throw new Error(`SQL Editor package is stale:\n${differences.join("\n")}\nRun node scripts/build-sql-editor.mjs after reviewing canonical changes.`);
  } else {
    // Never delete unknown or obsolete files automatically; the operator reviews them.
    if (unexpected.length) throw new Error(`Unexpected files require manual review before generation: ${unexpected.join(", ")}`);
    mkdirSync(path.join(directory, "installation"), { recursive: true });
    for (const [file, content] of plan.files) writeFileSync(path.join(directory, file), content);
  }
  return { migrations: plan.manifest.installation.length, separate: plan.manifest.separate.length, files: plan.files.size };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.some((arg) => arg !== "--check") || args.length > 1) throw new Error("Usage: node scripts/build-sql-editor.mjs [--check]");
    const result = buildSqlEditor({ check: args.includes("--check") });
    console.log(`SQL Editor: ${result.migrations} migration(s), ${result.separate} separate manual/validation file(s); ${args.length ? "verified" : "generated"}. No SQL executed.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
