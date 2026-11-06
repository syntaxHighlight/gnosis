import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { check, checkConfig, migrate } from '../scripts/tracker.mjs';

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'gnosis-tracker-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const source = path.join(dir, 'source'), target = path.join(dir, 'target');
  fs.mkdirSync(path.join(source, 'issues'), { recursive: true });
  const write = (p, value) => { fs.mkdirSync(path.dirname(path.join(source, p)), { recursive: true }); fs.writeFileSync(path.join(source, p), value); };
  return { dir, source, target, write };
}
const issue = (id, status = 'todo', deps = '[]', extra = '') => `---\nid: ${id}\ntitle: Test ${id}\nstatus: ${status}\ndepends_on: ${deps}\n${extra}---\nBody\n<!-- comment: preserved -->\n`;

test('check validates dependencies, parent references, duplicate ids and cycles', t => {
  const f = fixture(t);
  f.write('issues/a.md', issue('a', 'todo', '[b]'));
  f.write('issues/b.md', issue('b'));
  assert.equal(check(f.source).ok, true);
  f.write('issues/b.md', issue('b', 'todo', '[a]', 'parent: missing\n'));
  const errors = check(f.source).errors.join('\n');
  assert.match(errors, /循环引用/); assert.match(errors, /缺失 id missing/);
  f.write('issues/c.md', issue('a'));
  assert.match(check(f.source).errors.join('\n'), /重复 id/);
});
test('malformed YAML and noncanonical states are errors', t => {
  const f = fixture(t);
  f.write('issues/a.md', '---\nid: a\nid: b\n---\n');
  assert.equal(check(f.source).ok, false);
  f.write('issues/a.md', issue('a', 'unknown'));
  assert.match(check(f.source).errors.join('\n'), /未知 status/);
});
test('default migration previews without writes; apply preserves bodies, originals, spec and references', t => {
  const f = fixture(t);
  const raw = issue('a', 'wontfix') + '\n[Spec](../spec.md)\n';
  f.write('issues/a.md', raw); f.write('spec.md', '# Original spec\n\n[Issue](issues/a.md)\n');
  const options = { ...f, format: 'scratch' };
  const preview = migrate(options);
  assert.equal(preview.ok, true); assert.equal(preview.applied, false); assert.equal(fs.existsSync(f.target), false);
  assert.match(preview.limitations.join('\n'), /独立迁移暂存根.*不配置或接入项目/);
  const result = migrate({ ...options, apply: true });
  assert.equal(result.applied, true);
  assert.equal(fs.readFileSync(path.join(f.source, 'issues/a.md'), 'utf8'), raw);
  assert.equal(fs.readFileSync(path.join(f.target, '_originals/issues/a.md'), 'utf8'), raw);
  const migrated = fs.readFileSync(path.join(f.target, 'issues/a.md'), 'utf8');
  assert.match(migrated, /status: cancelled/);
  assert.equal(migrated.split('---\n')[2], raw.split('---\n')[2]);
  assert.equal(fs.readFileSync(path.join(f.target, 'spec.md'), 'utf8'), fs.readFileSync(path.join(f.source, 'spec.md'), 'utf8'));
  assert.equal(result.states[0].from, 'wontfix');
  assert.equal(check(f.target).ok, true);
  assert.equal(fs.existsSync(path.join(f.target, '.gnosis/project.json')), false);
  assert.throws(() => migrate({ ...options, apply: true }), /目标已存在/);
});
test('unknown state blocks apply until an explicit mapping is supplied', t => {
  const f = fixture(t); f.write('issues/a.md', issue('a', 'waiting'));
  const options = { ...f, format: 'legacy', apply: true };
  assert.equal(migrate(options).ok, false); assert.equal(fs.existsSync(f.target), false);
  assert.equal(migrate({ ...options, mapping: { waiting: 'blocked' } }).applied, true);
});
test('missing links and complex reference forms block writes', t => {
  const f = fixture(t); f.write('issues/a.md', issue('a') + '[external file](../../other.md)\n');
  const options = { ...f, format: 'legacy', apply: true };
  assert.match(migrate(options).errors.join('\n'), /未保留引用/);
  assert.equal(fs.existsSync(f.target), false);
  f.write('issues/a.md', issue('a') + '[spec][ref]\n\n[ref]: ../spec.md\n');
  assert.equal(migrate(options).ok, false);
});
test('symlinks, nested targets, collisions and escaping config are rejected', t => {
  const f = fixture(t); f.write('issues/a.md', issue('a'));
  assert.throws(() => migrate({ ...f, target: path.join(f.source, 'new'), format: 'legacy' }), /嵌套/);
  fs.symlinkSync(f.source, path.join(f.dir, 'alias'));
  assert.throws(() => migrate({ ...f, source: path.join(f.dir, 'alias'), format: 'legacy' }), /符号链接/);
  fs.symlinkSync(path.join(f.source, 'issues/a.md'), path.join(f.source, 'issues/link.md'));
  assert.throws(() => migrate({ ...f, format: 'legacy' }), /符号链接/);
  fs.unlinkSync(path.join(f.source, 'issues/link.md'));
  f.write('.gnosis/project.json', JSON.stringify({ version: 1, tracker: { type: 'local', path: '../outside' } }));
  assert.throws(() => check(f.source), /tracker.path.*固定.*issues/);
  fs.unlinkSync(path.join(f.source, '.gnosis/project.json'));
  f.write('issues/_originals/secret.md', 'collision');
  assert.throws(() => migrate({ ...f, format: 'legacy' }), /保留路径/);
});
test('project artifact paths are fixed and nonstandard configuration never moves files', t => {
  const f = fixture(t);
  const raw = issue('a');
  f.write('custom/a.md', raw);
  const config = { version: 1, tracker: { type: 'local', path: 'issues' } };
  for (const [field, value] of [['tracker.path', 'custom'], ['reports', 'custom'], ['specs', 'custom'], ['glossary', 'custom.md'], ['adr', 'custom']]) {
    const invalid = field === 'tracker.path' ? { ...config, tracker: { type: 'local', path: value } } : { ...config, [field]: value };
    const text = JSON.stringify(invalid);
    f.write('.gnosis/project.json', text);
    assert.throws(() => checkConfig(f.source), /固定/, field);
    assert.throws(() => check(f.source, 'issues'), /固定/, field);
    assert.equal(fs.readFileSync(path.join(f.source, '.gnosis/project.json'), 'utf8'), text);
    assert.equal(fs.readFileSync(path.join(f.source, 'custom/a.md'), 'utf8'), raw);
    assert.equal(fs.existsSync(path.join(f.source, 'issues/a.md')), false);
  }
  f.write('issues/a.md', raw);
  for (const tracker of [{ type: 'local' }, { type: 'local', path: 'issues' }, { type: 'local', path: './issues/' }]) {
    f.write('.gnosis/project.json', JSON.stringify({ ...config, tracker }));
    assert.equal(check(f.source).count, 1);
  }
  const equivalent = { ...config, specs: './specs/', reports: 'reports/', glossary: './GLOSSARY.md', adr: './docs/adr/' };
  f.write('.gnosis/project.json', JSON.stringify(equivalent));
  assert.deepEqual(checkConfig(f.source).config, equivalent);
  for (const [field, value] of [['tracker.path', null], ['reports', ''], ['specs', null], ['glossary', 3], ['adr', []]]) {
    f.write('.gnosis/project.json', JSON.stringify(field === 'tracker.path' ? { ...config, tracker: { type: 'local', path: value } } : { ...config, [field]: value }));
    assert.throws(() => checkConfig(f.source), /固定/, field);
  }
});
test('tracker CLI and API cannot override the fixed issues directory', t => {
  const f = fixture(t);
  f.write('issues/a.md', issue('a'));
  f.write('custom/b.md', issue('b'));
  assert.throws(() => check(f.source, 'custom'), /固定.*issues/);
  assert.equal(check(f.source).count, 1);
  const script = fileURLToPath(new URL('../scripts/tracker.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script, 'check', f.source, '--tracker', 'custom'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(JSON.parse(result.stderr).errors.join('\n'), /固定.*issues/);
  f.write('.gnosis/project.json', JSON.stringify({ version: 1, tracker: { type: 'local', path: 'custom' } }));
  const configured = spawnSync(process.execPath, [script, 'config', f.source], { encoding: 'utf8' });
  assert.equal(configured.status, 1);
  assert.match(JSON.parse(configured.stderr).errors.join('\n'), /tracker.path.*固定.*issues/);
});

test('real legacy template converts numeric ids, deps, null parent and preserves closed subdirectories', t => {
  const f = fixture(t);
  const legacy = (id, status, parent, deps) => `---\nid: ${id}\ntitle: "Issue ${id}"\nstatus: ${status}\npriority: medium\nmilestone: null\nparent: ${parent}\ndeps: [${deps}]\nlabels: []\ncreated: 2026-10-30\n---\n\n## Context\nOriginal\n## Goal\nShip\n## Acceptance criteria\n- [ ] Pass\n## Verification\nnode --test\n`;
  f.write('issues/done/0001-first.md', legacy(1, 'done', 'null', ''));
  f.write('issues/0002-second.md', legacy(2, 'todo', 'null', '1'));
  f.write('issues/wontfix/0003-third.md', legacy(3, 'wontfix', 'null', ''));
  f.write('code.js', 'must not copy project code');
  const result = migrate({ ...f, format: 'legacy', apply: true });
  assert.equal(result.applied, true);
  assert.equal(check(f.target).count, 3);
  assert.equal(fs.existsSync(path.join(f.target, 'code.js')), false);
  assert.match(fs.readFileSync(path.join(f.target, 'issues/0002-second.md'), 'utf8'), /depends_on:\n  - "1"/);
});
test('real Matt Pocock template preserves full raw markdown and requires explicit triage state choice', t => {
  const f = fixture(t);
  const raw = '# 01: First slice\n\n**What to build:** User flow\n\n**Blocked by:** None (can start immediately)\n\n**Status:** ready-for-agent\n\n- [ ] Works\n\n## Comments\nUser comment\n';
  f.write('spec.md', '# Spec\n'); f.write('issues/01-first.md', raw);
  f.write('issues/02-second.md', '# 02: Second slice\n\n**Blocked by:** 01\n\n**Status:** ready-for-agent\n');
  const options = { ...f, format: 'scratch' };
  assert.equal(migrate({ ...options, apply: true }).applied, false);
  const result = migrate({ ...options, mapping: { 'ready-for-agent': 'todo' }, apply: true });
  assert.equal(result.ok, true);
  assert.equal(fs.readFileSync(path.join(f.target, 'issues/01-first.md'), 'utf8').endsWith(raw), true);
  assert.equal(result.ids[1].depends_on[0], '01');
  assert.equal(check(f.target).ok, true);
});
test('ambiguous scratch blocker and review state fail closed', t => {
  const f = fixture(t); f.write('spec.md', '# Spec\n');
  f.write('issues/01-first.md', '# 01: First\n**Blocked by:** 02: Some title\n**Status:** todo\n');
  assert.match(migrate({ ...f, format: 'scratch', apply: true }).errors.join('\n'), /复杂引用/);
  f.write('issues/01-first.md', issue('a', 'review'));
  assert.equal(migrate({ ...f, format: 'legacy', apply: true }).ok, false);
});
test('parent ownership and dependency cycles are checked separately; null parent is valid', t => {
  const f = fixture(t);
  f.write('issues/a.md', issue('a', 'todo', '[b]', 'parent: null\n'));
  f.write('issues/b.md', issue('b', 'todo', '[]', 'parent: a\n'));
  assert.equal(check(f.source).ok, true);
  f.write('issues/a.md', issue('a', 'todo', '[]', 'parent: b\n'));
  f.write('issues/b.md', issue('b', 'todo', '[]', 'parent: a\n'));
  assert.match(check(f.source).errors.join('\n'), /循环引用/);
});

test('non-UTF8 issue bodies are blocked rather than silently rewritten', t => {
  const f = fixture(t); f.write('issues/a.md', Buffer.concat([Buffer.from(issue('a')), Buffer.from([0xff])]));
  const result = migrate({ ...f, format: 'legacy', apply: true });
  assert.equal(result.applied, false); assert.match(result.errors.join('\n'), /UTF-8/);
  assert.equal(fs.existsSync(f.target), false);
});

test('absolute local links including encoded and Windows forms block apply', t => {
  const f = fixture(t);
  f.write('spec.md', '# Spec\n');
  const absolute = path.join(f.source, 'spec.md');
  const targets = [absolute, encodeURIComponent(absolute), 'C:/old/spec.md', 'C:\\old\\spec.md', '\\\\server\\share\\spec.md', '/root/spec.md', 'file:///old/spec.md'];
  for (const target of targets) {
    f.write('issues/a.md', issue('a') + `[Spec](${target})\n`);
    const result = migrate({ ...f, format: 'legacy', apply: true });
    assert.equal(result.applied, false, target);
    assert.match(result.errors.join('\n'), /绝对本地路径/, target);
    assert.equal(fs.existsSync(f.target), false);
  }
});
test('HTML resources beyond anchors and images are rejected while comments are preserved', t => {
  const f = fixture(t);
  const forms = ['<video src="../spec.md"></video>', '<object data="../spec.md"></object>', '<source srcset="../spec.md">', '<iframe src="../spec.md"></iframe>', '<div style="background:url(../spec.md)">text</div>'];
  for (const html of forms) {
    f.write('issues/a.md', issue('a') + html + '\n');
    const result = migrate({ ...f, format: 'legacy', apply: true });
    assert.equal(result.applied, false, html);
    assert.match(result.errors.join('\n'), /HTML/, html);
    assert.equal(fs.existsSync(f.target), false);
  }
  f.write('issues/a.md', issue('a') + '<!-- ordinary comment -->\n');
  assert.equal(migrate({ ...f, format: 'legacy' }).ok, true);
});

test('nested link labels and image-wrapped links block apply without writes', t => {
  const f = fixture(t);
  f.write('issues/logo.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const forms = ['[See [related] ticket](../outside.md)', '[![Logo](logo.png)](../outside.md)'];
  for (const form of forms) {
    const raw = issue('a') + form + '\n';
    f.write('issues/a.md', raw);
    const result = migrate({ ...f, format: 'legacy', apply: true });
    assert.equal(result.applied, false, form);
    assert.match(result.errors.join('\n'), /嵌套方括号/, form);
    assert.equal(fs.existsSync(f.target), false);
    assert.equal(fs.readFileSync(path.join(f.source, 'issues/a.md'), 'utf8'), raw);
  }
});
test('reports configuration rejects symbolic links outside the project and dangling links', t => {
  const f = fixture(t);
  f.write('issues/a.md', issue('a'));
  f.write('.gnosis/project.json', JSON.stringify({ version: 1, tracker: { type: 'local', path: 'issues' }, reports: 'reports' }));
  const outside = path.join(f.dir, 'outside');
  fs.mkdirSync(outside);
  const reports = path.join(f.source, 'reports');
  fs.symlinkSync(outside, reports);
  assert.throws(() => check(f.source), /符号链接/);
  fs.unlinkSync(reports);
  fs.symlinkSync(path.join(f.dir, 'missing'), reports);
  assert.throws(() => check(f.source), /符号链接/);
  fs.unlinkSync(reports);
  fs.mkdirSync(reports);
  assert.equal(check(f.source).ok, true);
});

test('non-string and empty source states block apply without implicit coercion', t => {
  const f = fixture(t);
  for (const status of ['[done]', 'null', '{state: done}', '""', '"   "']) {
    const raw = issue('a', status);
    f.write('issues/a.md', raw);
    const result = migrate({ ...f, format: 'legacy', mapping: { done: 'done' }, apply: true });
    assert.equal(result.applied, false, status);
    assert.match(result.errors.join('\n'), /源 status 必须是非空字符串/, status);
    assert.equal(fs.existsSync(f.target), false);
    assert.equal(fs.readFileSync(path.join(f.source, 'issues/a.md'), 'utf8'), raw);
  }
});
test('mapping API requires a plain object with nonempty keys and canonical string values', t => {
  const f = fixture(t); f.write('issues/a.md', issue('a', 'waiting'));
  const options = { ...f, format: 'legacy', apply: true };
  for (const mapping of [null, [], new Map(), { '': 'todo' }, { waiting: ['done'] }, { waiting: null }, { waiting: 'review' }]) {
    assert.throws(() => migrate({ ...options, mapping }), /状态映射/);
    assert.equal(fs.existsSync(f.target), false);
  }
  assert.equal(migrate({ ...options, mapping: { waiting: 'blocked' } }).applied, true);
});

test('execution, category and triage are independent; optional fields preserve old records', t => {
  const f = fixture(t);
  f.write('issues/a.md', issue('a', 'in-progress', '[]', 'category: bug\ntriage: ready-for-human\nlabels: [bug, enhancement]\n'));
  assert.equal(check(f.source).ok, true);
  for (const extra of ['category: [bug, enhancement]\n', 'category: feature\n', 'triage: [needs-info, ready-for-agent]\n', 'triage: done\n', 'triage: null\n']) {
    f.write('issues/a.md', issue('a', 'todo', '[]', extra));
    assert.equal(check(f.source).ok, false, extra);
  }
  f.write('issues/a.md', issue('a'));
  assert.equal(check(f.source).ok, true);
});

test('configuration accepts old v1 and validates unified project settings without running commands', t => {
  const f = fixture(t);
  assert.equal(checkConfig(f.source).configured, false);
  const config = {
    version: 1, mode: 'gnosis', tracker: { type: 'local', path: 'issues' },
    glossary: 'GLOSSARY.md', adr: 'docs/adr', specs: 'specs', reports: 'reports',
    verification: { commands: ['touch should-not-exist'] }, git: { mode: 'delivery', base: 'main' },
    custom: { preserved: true },
  };
  f.write('.gnosis/project.json', JSON.stringify(config));
  assert.deepEqual(checkConfig(f.source).config, config);
  assert.equal(fs.existsSync(path.join(f.source, 'should-not-exist')), false);
  for (const patch of [{ mode: 'other' }, { specs: '../escape' }, { adr: '/absolute' }, { glossary: 'C:\\outside.md' }, { verification: { commands: [''] } }, { verification: { commands: 'npm test' } }, { git: { mode: 'branch' } }, { git: { mode: 'manual', base: '' } }]) {
    f.write('.gnosis/project.json', JSON.stringify({ ...config, ...patch }));
    assert.throws(() => checkConfig(f.source), undefined, JSON.stringify(patch));
  }
  f.write('.gnosis/project.json', JSON.stringify({ version: 1, tracker: { type: 'local', path: 'issues' }, reports: 'reports' }));
  assert.equal(checkConfig(f.source).ok, true);
});

test('remote mapping is checked without pretending to validate remote records', t => {
  const f = fixture(t);
  const tracker = { type: 'remote', provider: 'github', project: 'owner/repo', mapping: { status: { todo: 'Todo', done: 'Done' }, category: { bug: 'bug' }, triage: { 'needs-info': 'waiting-for-info', 'ready-for-agent': 'agent-ready' } } };
  const write = value => f.write('.gnosis/project.json', JSON.stringify({ version: 1, tracker: value }));
  write(tracker);
  assert.equal(checkConfig(f.source).ok, true);
  for (const value of ['issues', './issues/']) {
    write({ ...tracker, path: value });
    assert.equal(checkConfig(f.source).ok, true);
  }
  for (const value of ['custom', '', null]) {
    write({ ...tracker, path: value });
    assert.throws(() => checkConfig(f.source), /tracker.path.*固定.*issues/);
  }
  write(tracker);
  assert.throws(() => check(f.source), /远程 tracker/);
  f.write('issues/a.md', issue('a'));
  assert.throws(() => check(f.source, 'copy'), /固定.*issues/);
  assert.equal(check(f.source, 'issues').count, 1);
  for (const patch of [{ provider: '' }, { project: null }, { mapping: [] }, { mapping: { triage: { ready: 'ready' } } }, { mapping: { status: { todo: 'same', done: 'same' } } }, { mapping: { category: { bug: ['bug'] } } }, { mapping: { labels: {} } }]) {
    write({ ...tracker, ...patch });
    assert.throws(() => checkConfig(f.source), undefined, JSON.stringify(patch));
  }
});

test('remote configuration without a local path does not inspect the issues directory', t => {
  const f = fixture(t);
  fs.rmdirSync(path.join(f.source, 'issues'));
  fs.symlinkSync(path.join(f.dir, 'missing'), path.join(f.source, 'issues'));
  const tracker = { type: 'remote', provider: 'github', project: 'owner/repo' };
  f.write('.gnosis/project.json', JSON.stringify({ version: 1, tracker }));
  assert.equal(checkConfig(f.source).ok, true);
  f.write('.gnosis/project.json', JSON.stringify({ version: 1, tracker: { ...tracker, path: 'issues' } }));
  assert.throws(() => checkConfig(f.source), /符号链接/);
});

test('new configured locations reject symlinks even before files exist', t => {
  const f = fixture(t);
  fs.symlinkSync(path.join(f.dir, 'missing'), path.join(f.source, 'docs'));
  f.write('.gnosis/project.json', JSON.stringify({ version: 1, tracker: { type: 'local', path: 'issues' }, adr: 'docs/adr' }));
  assert.throws(() => checkConfig(f.source), /符号链接/);
});

test('explicit migration preserves triage decisions and rejects unknown new values without writing', t => {
  const f = fixture(t);
  const raw = issue('a', 'ready-for-agent', '[]', 'labels: [old-label]\n');
  f.write('issues/a.md', raw);
  const options = { ...f, format: 'legacy', mapping: { 'ready-for-agent': { status: 'todo', category: 'enhancement', triage: 'ready-for-agent' } } };
  const preview = migrate(options);
  assert.deepEqual(preview.states[0], { path: 'issues/a.md', from: 'ready-for-agent', to: 'todo', category: 'enhancement', triage: 'ready-for-agent' });
  assert.equal(fs.existsSync(f.target), false);
  assert.equal(migrate({ ...options, apply: true }).applied, true);
  const output = fs.readFileSync(path.join(f.target, 'issues/a.md'), 'utf8');
  assert.match(output, /triage: ready-for-agent/);
  assert.match(output, /old-label/);
  assert.equal(check(f.target).ok, true);
  assert.equal(fs.readFileSync(path.join(f.source, 'issues/a.md'), 'utf8'), raw);
});

test('unknown category and triage block migration; wontfix keeps its decision', t => {
  const f = fixture(t);
  for (const extra of ['category: unknown\n', 'triage: unknown\n']) {
    const raw = issue('a', 'todo', '[]', extra);
    f.write('issues/a.md', raw);
    const result = migrate({ ...f, format: 'legacy', apply: true });
    assert.equal(result.applied, false);
    assert.match(result.errors.join('\n'), /未知 (category|triage)/);
    assert.equal(fs.existsSync(f.target), false);
    assert.equal(fs.readFileSync(path.join(f.source, 'issues/a.md'), 'utf8'), raw);
  }
  f.write('issues/a.md', issue('a', 'wontfix'));
  assert.equal(migrate({ ...f, format: 'legacy', apply: true }).applied, true);
  assert.match(fs.readFileSync(path.join(f.target, 'issues/a.md'), 'utf8'), /triage: wontfix/);
});
