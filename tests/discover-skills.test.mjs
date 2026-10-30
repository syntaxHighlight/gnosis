import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { discoverSkills } from '../scripts/discover-skills.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gnosis-discovery-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
async function skill(root, relative) {
  const dir = path.join(root, relative);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'SKILL.md'), '---\nname: example\n---\n');
  return dir;
}
test('discovers flat and nested skills, preserving skill boundaries', async t => {
  const root = await fixture(t);
  const a = await skill(root, 'planning/one');
  const b = await skill(root, 'two');
  await skill(a, 'references/embedded');
  await skill(root, '.hidden/ignored');
  await skill(root, 'node_modules/ignored');
  assert.deepEqual(await discoverSkills(root), [{ name: 'one', dir: a }, { name: 'two', dir: b }]);
});
test('rejects duplicate installation names across groups', async t => {
  const root = await fixture(t);
  await skill(root, 'first/same');
  await skill(root, 'second/same');
  await assert.rejects(discoverSkills(root), /Duplicate skill directory name/);
});
test('rejects empty trees and symlinked groups', async t => {
  const root = await fixture(t);
  await assert.rejects(discoverSkills(root), /No skills found/);
  await fs.symlink(root, path.join(root, 'loop'));
  await assert.rejects(discoverSkills(root), /Symlink/);
});
