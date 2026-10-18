import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const root = path.resolve(__dirname, '../..');
export const serverRoot = path.join(root, 'server');
export const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function sourceIdentity() {
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
  const status = git('status','--porcelain','--untracked-files=normal');
  const files = [...new Set(git('ls-files','--cached','--others','--exclude-standard').split('\n'))]
    .filter(f => /\.(tsx?|prisma|sql|ya?ml)$/.test(f) || /(^|\/)(package(-lock)?\.json|README\.md|\.gitignore)$/.test(f)).sort();
  const hashes = files.map(file => [file,createHash('sha256').update(readFileSync(path.join(root,file))).digest('hex')]);
  return { commit: git('rev-parse','HEAD'), dirty: !!status, trackedDiffSha256: digest(git('diff','HEAD')), sourceTreeSha256: digest(hashes), sourceFileCount: files.length,
    sourceHashScope: 'Tracked and nonignored TypeScript, Prisma, SQL, YAML, package manifests, README and gitignore files, sorted by path; evidence JSON and secrets are excluded.',
    warning: status ? 'Working tree contains changes; commit this implementation before recording final submission evidence.' : null };
}
export function saveEvidence(kind: string, report: unknown) {
  const dir = path.join(root, 'evidence', 'runs', `${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,8)}`);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${kind}.json`);
  writeFileSync(file, JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), source: sourceIdentity(), report }, null, 2) + '\n', { flag: 'wx' });
  console.log(`Evidence saved: ${path.relative(root,file)}`);
  return file;
}
