import fs from 'node:fs/promises';
import path from 'node:path';
import { discoverSkills } from './discover-skills.mjs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
let failures = 0;
for (const { name: skillName, dir } of await discoverSkills(path.join(root, 'skills'))) {
  const text = await fs.readFile(path.join(dir, 'SKILL.md'), 'utf8');
  for (const name of ['artifacts', 'tracker', 'defensive-design', 'handoff', 'writing-for-agents']) {
    if (!text.includes(`references/${name}.md`)) continue;
    const content = await fs.readFile(path.join(root, 'shared', `${name}.md`), 'utf8');
    const target = path.join(dir, 'references', `${name}.md`);
    if (check) {
      const actual = await fs.readFile(target, 'utf8').catch(e => { if (e.code === 'ENOENT') return null; throw e; });
      if (actual !== content) { console.error(`Out of sync: ${skillName}/references/${name}.md`); failures++; }
    } else {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content);
    }
  }
}
if (failures) process.exitCode = 1;
else console.log(check ? 'Shared references match.' : 'Shared references synchronized.');
