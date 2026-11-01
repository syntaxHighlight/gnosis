import fs from 'node:fs/promises';
import path from 'node:path';
import { discoverSkills } from './discover-skills.mjs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'skills/setup/setup-project/package.json'));
const { parseDocument } = require('yaml');
let count = 0;
const errors = [];
async function walk(dir) {
  const result = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isSymbolicLink()) errors.push(`Symlink in package: ${p}`);
    else if (e.isDirectory()) result.push(...await walk(p));
    else result.push(p);
  }
  return result;
}
for (const { name, dir } of await discoverSkills(path.join(root, 'skills'))) {
  const body = await fs.readFile(path.join(dir, 'SKILL.md'), 'utf8');
  const match = body.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) { errors.push(`${name}: missing frontmatter`); continue; }
  const doc = parseDocument(match[1]);
  const data = doc.toJSON();
  if (doc.errors.length || data?.name !== name || !/^[a-z0-9-]{1,64}$/.test(name) || typeof data?.description !== 'string' || !data.description.trim()) errors.push(`${name}: invalid metadata`);
  for (const file of await walk(dir)) {
    if (!file.endsWith('.md')) continue;
    const source = await fs.readFile(file, 'utf8');
    const prose = source.replace(/```[^\n]*\n[\s\S]*?```/g, '');
    for (const link of prose.matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
      const href = link[1];
      if (/^(?:[a-z]+:|#)/i.test(href)) continue;
      const target = path.resolve(path.dirname(file), decodeURIComponent(href.split('#')[0]));
      if (!target.startsWith(dir + path.sep)) errors.push(`${file}: reference escapes installed skill: ${href}`);
      else if (!(await fs.stat(target).catch(() => null))) errors.push(`${file}: missing ${href}`);
    }
  }
  count++;
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`${count} skill packages validated.`);
