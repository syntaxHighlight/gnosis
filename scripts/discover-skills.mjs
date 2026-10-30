import fs from 'node:fs/promises';
import path from 'node:path';

// Stop at a skill boundary: bundled resources are not separate skills.
export async function discoverSkills(root) {
  const found = [];
  const names = new Set();
  async function visit(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    if (entries.some(e => e.name === 'SKILL.md' && e.isFile())) {
      const name = path.basename(dir);
      if (names.has(name)) throw new Error('Duplicate skill directory name: ' + name);
      names.add(name);
      found.push({ name, dir });
      return;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      if (entry.isSymbolicLink()) throw new Error('Symlink in skill tree: ' + path.join(dir, entry.name));
      if (entry.isDirectory()) await visit(path.join(dir, entry.name));
    }
  }
  await visit(root);
  if (!found.length) throw new Error('No skills found in ' + root);
  return found;
}
