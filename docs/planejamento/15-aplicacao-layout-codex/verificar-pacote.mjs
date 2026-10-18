// Verificação do pacote documental; não executa a aplicação nem acessa a rede.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const base = dirname(fileURLToPath(import.meta.url));
const repo = resolve(base, '../../..');
const failures = [];
const read = (path) => readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
const json = (path) => JSON.parse(read(path));
const list = (dir) => readdirSync(dir).flatMap((name) => {
  const path = resolve(dir, name);
  return statSync(path).isDirectory() ? list(path) : [path];
});
const localPath = (path) => relative(base, path).split(sep).join('/');
const manifest = json(resolve(base, 'manifest.json'));
const actual = list(base).map(localPath).filter((p) => p !== 'manifest.json').sort();
const expected = manifest.files.map((f) => f.path).sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push('Inventário diferente do manifesto.');
for (const file of manifest.files) {
  const path = resolve(base, file.path);
  if (!path.startsWith(base + sep)) throw new Error('Caminho fora do pacote.');
  if (!existsSync(path)) { failures.push(`Arquivo ausente: ${file.path}`); continue; }
  const bytes = readFileSync(path);
  const sha = createHash('sha256').update(bytes).digest('hex');
  if (sha !== file.sha256 || bytes.length !== file.bytes) failures.push(`Integridade: ${file.path}`);
}

let links = 0;
for (const path of list(base).filter((p) => p.endsWith('.md'))) {
  const text = read(path).replace(/```[\s\S]*?```/g, '');
  for (const match of text.matchAll(/\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1].replace(/^<|>$/g, '').split('#')[0];
    if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
    if (/^(?:file:|[A-Za-z]:)/.test(target)) { failures.push(`Link não portátil: ${localPath(path)}`); continue; }
    links++;
    if (!existsSync(resolve(dirname(path), decodeURIComponent(target)))) failures.push(`Link ausente em ${localPath(path)}: ${target}`);
  }
}

const original = json(resolve(repo, 'design-system/tokens/tokens.json'));
const snapshot = json(resolve(base, 'prototipo/design-system/tokens.json'));
const css = read(resolve(base, 'prototipo/design-system/colors.css'));
let exactTokens = 0;
const contrast = [];
const luminance = (hex) => hex.slice(1).match(/../g).map((v) => parseInt(v, 16) / 255)
  .map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
  .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
const ratio = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
for (const theme of ['light', 'dark']) {
  const colors = original.color[theme];
  const block = css.match(theme === 'light' ? /:root \{([^}]+)\}/ : /:root\[data-theme=dark\] \{([^}]+)\}/)?.[1] ?? '';
  if (JSON.stringify(colors) !== JSON.stringify(snapshot.color[theme])) failures.push(`JSON cromático divergente: ${theme}`);
  for (const [key, value] of Object.entries(colors)) {
    if (!block.includes(`--${key}: ${value};`)) failures.push(`CSS cromático divergente: ${theme}/${key}`);
    exactTokens++;
  }
  const pairs = ['ink', 'ink-muted', 'ink-subtle', 'success-ink', 'danger-ink', 'warning-ink', 'info-ink', 'work-ink', 'personal-ink', 'fin-ink']
    .flatMap((fg) => ['canvas', 'surface', 'surface-muted', 'surface-hover'].map((bg) => [fg, bg]));
  pairs.push(['accent-ink', 'accent'], ['ink-inverse', 'surface-inverse'], ['inverse-muted', 'surface-inverse'], ['canvas', 'danger-ink']);
  for (const [fg, bg] of pairs) {
    const value = ratio(colors[fg], colors[bg]);
    contrast.push(value);
    if (value < 4.5) failures.push(`Contraste textual: ${theme}/${fg}/${bg} = ${value}`);
  }
}
let scripts = 0;
for (const name of ['core.js', 'calendar.js', 'life.js', 'navigation.js', 'onboarding.js', 'app.js']) {
  const result = spawnSync(process.execPath, ['--check', resolve(base, 'prototipo', name)], { encoding: 'utf8' });
  if (result.status !== 0) failures.push(`Sintaxe: ${name}: ${result.stderr || result.error}`);
  scripts++;
}
console.log(JSON.stringify({ files: expected.length, relativeLinks: links, exactTokens, textContrastPairs: contrast.length,
  minimumTextContrast: Math.min(...contrast), scripts, failures }, null, 2));
if (failures.length) process.exitCode = 1;
