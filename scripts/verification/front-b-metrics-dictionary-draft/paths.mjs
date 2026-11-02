import { isAbsolute, resolve } from 'node:path';

// With the directory installed under scripts/verification/, this resolves the repository root.
// An explicit absolute --repo allows exercising the same tool from an isolated scratch copy.
export function repositoryRoot(toolRoot) {
  const args=process.argv.slice(2);
  if (args.length === 0) return resolve(toolRoot,'../../..');
  if (args.length !== 2 || args[0] !== '--repo' || !isAbsolute(args[1])) throw Error('Expected --repo followed by an absolute repository path');
  return resolve(args[1]);
}
