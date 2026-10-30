#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseDocument, stringify } from 'yaml';

const statuses = new Set(['todo', 'in-progress', 'blocked', 'done', 'cancelled']);
const fail = message => { throw new Error(message); };
const inside = (root, p) => p === root || p.startsWith(root + path.sep);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function safePath(p) {
  const absolute = path.resolve(p);
  let current = path.parse(absolute).root;
  for (const segment of absolute.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (fs.existsSync(current) || (() => { try { return fs.lstatSync(current).isSymbolicLink(); } catch { return false; } })()) {
      if (fs.lstatSync(current).isSymbolicLink()) fail(`禁止符号链接: ${current}`);
    }
  }
  return absolute;
}
function files(root) {
  const output = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) fail(`禁止符号链接: ${p}`);
      if (entry.isDirectory()) walk(p);
      else if (entry.isFile()) output.push(p);
      else fail(`不支持的文件类型: ${p}`);
    }
  };
  walk(root);
  return output.sort();
}
function frontmatter(text, file) {
  const match = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) fail(`${file}: 缺少 YAML frontmatter`);
  const doc = parseDocument(match[1], { uniqueKeys: true });
  if (doc.errors.length) fail(`${file}: ${doc.errors.map(e => e.message).join('; ')}`);
  const data = doc.toJS({ maxAliasCount: 50 });
  if (!data || Array.isArray(data) || typeof data !== 'object') fail(`${file}: frontmatter 必须是映射`);
  return { data, body: text.slice(match[0].length) };
}
function validate(records) {
  const errors = [], byId = new Map();
  for (const { data: d, file } of records) {
    const err = message => errors.push(`${file}: ${message}`);
    if (typeof d.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(d.id)) err('id 必须是非空安全字符串');
    else if (byId.has(d.id)) err(`重复 id ${d.id}`);
    else byId.set(d.id, { data: d, file });
    if (typeof d.title !== 'string' || !d.title.trim()) err('title 必须是非空字符串');
    if (!statuses.has(d.status)) err(`未知 status ${JSON.stringify(d.status)}`);
    if (!Array.isArray(d.depends_on) || d.depends_on.some(x => typeof x !== 'string') || new Set(d.depends_on).size !== d.depends_on.length) err('depends_on 必须是不重复字符串列表');
    if (d.parent !== undefined && d.parent !== null && typeof d.parent !== 'string') err('parent 必须是字符串或 null');
  }
  for (const { data: d, file } of records) {
    for (const id of [...(Array.isArray(d.depends_on) ? d.depends_on : []), ...(typeof d.parent === 'string' ? [d.parent] : [])]) {
      if (!byId.has(id)) errors.push(`${file}: 引用缺失 id ${id}`);
    }
  }
  // Parent records ownership; dependency scheduling is checked separately.
  for (const kind of ['depends_on', 'parent']) {
    const active = new Set(), visited = new Set();
    function visit(id, trail) {
      if (active.has(id)) { errors.push(`循环引用 (${kind}): ${[...trail, id].join(' -> ')}`); return; }
      if (visited.has(id)) return;
      visited.add(id); active.add(id);
      const d = byId.get(id)?.data;
      const edges = kind === 'parent' ? (typeof d?.parent === 'string' ? [d.parent] : []) : (Array.isArray(d?.depends_on) ? d.depends_on : []);
      for (const edge of edges) visit(edge, [...trail, id]);
      active.delete(id);
    }
    for (const id of byId.keys()) visit(id, []);
  }
  return errors;
}
export function check(root, trackerOverride) {
  root = safePath(root);
  let tracker = trackerOverride || 'issues';
  const configPath = path.join(root, '.gnosis/project.json');
  if (fs.existsSync(configPath)) {
    safePath(configPath);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.version !== 1 || config.tracker?.type !== 'local' || typeof config.tracker.path !== 'string') fail('不支持的 .gnosis/project.json 配置');
    tracker = trackerOverride || config.tracker.path;
    if (config.reports !== undefined && (typeof config.reports !== 'string' || !config.reports.trim() || path.isAbsolute(config.reports) || !inside(root, path.resolve(root, config.reports)))) fail('reports 必须位于项目内');
    if (config.reports !== undefined) safePath(path.resolve(root, config.reports));
  }
  if (path.isAbsolute(tracker) || !tracker.trim()) fail('tracker 必须是非空项目相对路径');
  const dir = safePath(path.resolve(root, tracker));
  if (!inside(root, dir)) fail('tracker 必须位于项目内');
  const records = [], errors = [];
  for (const file of files(dir).filter(p => p.endsWith('.md') && !path.relative(dir, p).split(path.sep).includes('_originals') && path.basename(p) !== 'spec.md')) {
    try { records.push({ ...frontmatter(fs.readFileSync(file, 'utf8'), file), file }); }
    catch (e) { errors.push(e.message); }
  }
  return { ok: errors.length === 0 && validate(records).length === 0, count: records.length, errors: [...errors, ...validate(records)] };
}

function sourceIssue(entry, format) {
  const text = entry.bytes.toString('utf8');
  if (!Buffer.from(text).equals(entry.bytes)) fail(entry.relative + ': Markdown 不是可无损解码的 UTF-8');
  if (format === 'legacy' || /^(?:\uFEFF)?---\r?\n/.test(text)) {
    const original = frontmatter(text, entry.relative);
    if (format === 'legacy' && original.data.deps !== undefined) {
      const d = original.data;
      if (d.depends_on !== undefined) fail(entry.relative + ': deps 与 depends_on 同时存在，有歧义');
      if (!Number.isSafeInteger(d.id) || d.id < 1 || !Array.isArray(d.deps) || d.deps.some(x => !Number.isSafeInteger(x) || x < 1) || (d.parent !== null && (!Number.isSafeInteger(d.parent) || d.parent < 1))) fail(entry.relative + ': 旧版 id/deps/parent 格式不合法');
      original.sourceId = d.id;
      original.data = { ...d, id: String(d.id), depends_on: d.deps.map(String) };
      delete original.data.deps;
      if (d.parent === null) delete original.data.parent;
      else original.data.parent = String(d.parent);
    }
    return original;
  }
  const headings = [...text.matchAll(/^# ([0-9]+): (.+)\r?$/gm)];
  const statuses = [...text.matchAll(/^(?:\*\*)?Status:(?:\*\*)?[ \t]*(.+)\r?$/gm)];
  const blockers = [...text.matchAll(/^(?:\*\*)?Blocked by:(?:\*\*)?[ \t]*(.+)\r?$/gm)];
  if (headings.length !== 1 || statuses.length !== 1 || blockers.length !== 1) fail(entry.relative + ': scratch 需要唯一 # NN: 标题、Status: 与 Blocked by: 行');
  const id = headings[0][1], basename = path.basename(entry.relative);
  if (!basename.startsWith(id + '-')) fail(entry.relative + ': 标题编号与文件编号不一致');
  const rawDeps = blockers[0][1].trim();
  let depends_on;
  if (/^None(?: \(can start immediately\))?\.?$/i.test(rawDeps)) depends_on = [];
  else if (/^[0-9]+(?:\s*,\s*[0-9]+)*$/.test(rawDeps)) depends_on = rawDeps.split(',').map(x => x.trim());
  else fail(entry.relative + ': Blocked by 含标题或复杂引用，请先明确编号映射');
  return { data: { id, title: headings[0][2].trim(), status: statuses[0][1].trim(), depends_on }, body: text };
}

function checkLinks(source, entries) {
  const included = new Set(entries.map(e => e.relative));
  const errors = [];
  for (const entry of entries.filter(e => e.relative.endsWith('.md'))) {
    const text = entry.bytes.toString('utf8');
    // Unsupported forms are explicitly blocked; no claim to a full Markdown parser.
    if (/\[[^\]]*\[/.test(text)) errors.push(`${entry.relative}: 嵌套方括号链接需人工核对，当前不支持自动迁移`);
    if (/\[\[[^\]]+\]\]|<\/?[A-Za-z][^>]*>|\[[^\]]+\]:|\]\[[^\]]*\]/i.test(text)) errors.push(`${entry.relative}: wiki/HTML/引用式链接需人工核对，当前不支持自动迁移`);
    for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
      let target = match[1];
      if (/^(https?:|mailto:)/i.test(target)) continue;
      if (target.includes('#')) { errors.push(`${entry.relative}: 本地锚点引用需人工核对 ${target}`); continue; }
      if (/\s|[<>]/.test(target)) { errors.push(`${entry.relative}: 复杂链接需人工核对 ${target}`); continue; }
      try { target = decodeURIComponent(target.split('#')[0].split('?')[0]); } catch { errors.push(`${entry.relative}: 无效 URL 编码`); continue; }
      if (!target) continue;
      if (path.posix.isAbsolute(target) || path.win32.isAbsolute(target) || /^[A-Za-z]:|^file:/i.test(target)) { errors.push(`${entry.relative}: 绝对本地路径引用不能随目标迁移 ${match[1]}`); continue; }
      const resolved = path.resolve(source, path.dirname(entry.relative), target);
      if (!inside(source, resolved) || !included.has(path.relative(source, resolved))) errors.push(`${entry.relative}: 未保留引用 ${match[1]}`);
    }
  }
  return errors;
}
export function migrate({ source, target, format, apply = false, mapping = {} }) {
  if (!mapping || Array.isArray(mapping) || typeof mapping !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(mapping))) fail('状态映射必须是普通 JSON 对象');
  if (Object.entries(mapping).some(([key, value]) => !key.trim() || typeof value !== 'string' || !statuses.has(value))) fail('状态映射键必须是非空字符串，值必须是标准状态字符串');
  source = safePath(source); target = safePath(target);
  if (!['legacy', 'scratch'].includes(format)) fail('format 必须是 legacy 或 scratch');
  if (inside(source, target) || inside(target, source)) fail('源目标必须互不嵌套');
  if (fs.existsSync(target)) fail('目标已存在；迁移不会覆盖');
  const selectedFiles = () => {
    const issueDir = path.join(source, 'issues');
    safePath(issueDir);
    const selected = fs.existsSync(issueDir) ? files(issueDir) : [];
    for (const name of ['spec.md', 'map.md']) {
      const p = path.join(source, name);
      if (fs.existsSync(p)) { safePath(p); selected.push(p); }
    }
    return selected.sort();
  };
  const entries = selectedFiles().map(p => ({ relative: path.relative(source, p), bytes: fs.readFileSync(p) }));
  if (entries.some(e => e.relative.split(path.sep).includes('_originals') || e.relative === 'migration.json')) fail('源文件占用迁移保留路径');
  const errors = [], records = [], output = [], states = [], ids = [], known = { todo: 'todo', 'in-progress': 'in-progress', blocked: 'blocked', done: 'done', cancelled: 'cancelled', wontfix: 'cancelled' };
  const issueEntries = entries.filter(e => /^issues[/\\].+\.md$/.test(e.relative));
  if (!issueEntries.length) errors.push('源目录必须包含 issues/*.md；scratch 模式请指向 .scratch/<feature>');
  if (format === 'scratch' && !entries.some(e => e.relative === 'spec.md')) errors.push('scratch 源缺少 spec.md');
  for (const entry of entries) {
    if (!issueEntries.includes(entry)) { output.push({ ...entry }); continue; }
    try {
      const original = sourceIssue(entry, format);
      const d = original.data;
      // Explicit mapping is the only mechanism for unfamiliar source state names.
      if (typeof d.status !== 'string' || !d.status.trim()) fail(`${entry.relative}: 源 status 必须是非空字符串`);
      const status = Object.hasOwn(mapping, d.status) ? mapping[d.status] : (Object.hasOwn(known, d.status) ? known[d.status] : undefined);
      if (!status || !statuses.has(status)) fail(`${entry.relative}: 未知状态 ${JSON.stringify(d.status)}，请提供显式映射`);
      if (typeof d.id !== 'string' || !Array.isArray(d.depends_on)) fail(`${entry.relative}: 缺少明确 id/depends_on；请先人工建立映射`);
      states.push({ path: entry.relative, from: d.status, to: status });
      ids.push({ path: entry.relative, from: original.sourceId ?? d.id, to: d.id, depends_on: d.depends_on, ...(d.parent === undefined ? {} : { parent: d.parent }) });
      const data = { ...d, status };
      records.push({ data, file: entry.relative });
      output.push({ ...entry, bytes: Buffer.from(`---\n${stringify(data)}---\n${original.body}`) });
    } catch (e) { errors.push(e.message); }
  }
  errors.push(...validate(records), ...checkLinks(source, entries));
  const manifest = {
    version: 1, format, source, target,
    paths: entries.map(e => ({ from: e.relative, to: e.relative, original: path.join('_originals', e.relative), sha256: hash(e.bytes) })),
    states, ids, errors,
    limitations: ['仅验证简单行内 Markdown 文件链接；裸工单号、纯文本路径、自定义元数据引用需人工核对', '外部 URL 原样保留，未联网验证', '仅采集 issues/、spec.md、map.md；旧派生索引只作快照保留'],
  };
  if (!apply || errors.length) return { ok: errors.length === 0, applied: false, ...manifest };
  // Stage and verify every file before publishing; target is never merged.
  const parent = path.dirname(target);
  if (!fs.existsSync(parent)) fail('目标父目录须先存在');
  const stage = fs.mkdtempSync(path.join(parent, '.gnosis-migration-'));
  let reserved = false;
  try {
    const write = (relative, bytes) => {
      bytes = Buffer.from(bytes);
      const p = path.join(stage, relative);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, bytes, { flag: 'wx' });
      if (!fs.readFileSync(p).equals(bytes)) fail(`写入校验失败 ${relative}`);
    };
    for (const e of output) write(e.relative, e.bytes);
    for (const e of entries) write(path.join('_originals', e.relative), e.bytes);
    write('migration.json', JSON.stringify(manifest, null, 2) + '\n');
    const stagedRecords = output.filter(e => issueEntries.some(i => i.relative === e.relative)).map(e => ({ ...frontmatter(fs.readFileSync(path.join(stage, e.relative), 'utf8'), e.relative), file: e.relative }));
    if (validate(stagedRecords).length) fail('迁移输出未通过 tracker 校验');
    // Recheck source bytes and paths immediately before committing the result.
    safePath(source); safePath(target); safePath(parent);
    const current = selectedFiles();
    if (current.length !== entries.length || entries.some(e => !fs.readFileSync(path.join(source, e.relative)).equals(e.bytes))) fail('预览期间源文件变化，请重新预览');
    fs.mkdirSync(target); reserved = true;
    // An exclusive reservation prevents replacing a directory created by another process.
    for (const name of fs.readdirSync(stage)) fs.renameSync(path.join(stage, name), path.join(target, name));
    fs.rmdirSync(stage);
    return { ok: true, applied: true, ...manifest };
  } catch (error) {
    fs.rmSync(stage, { recursive: true, force: true });
    if (reserved) error.message += `；可能留下部分输出，请检查 ${target}，源文件未删除`;
    throw error;
  }
}
function main() {
  const args = process.argv.slice(2), command = args.shift();
  if (!command || command === '--help') {
    console.log('tracker.mjs check <project-root> [--tracker <relative-path>]\ntracker.mjs migrate --source <feature-root> --target <new-directory> --format <scratch|legacy> [--map <json-file>] [--apply]\n默认只预览 JSON；退出码 0=通过，1=错误。安装依赖：在技能目录运行 npm ci。'); return;
  }
  const options = {}, positional = [];
  while (args.length) {
    const arg = args.shift();
    if (arg === '--apply') options.apply = true;
    else if (['--source', '--target', '--format', '--map', '--tracker'].includes(arg)) {
      if (!args.length || args[0].startsWith('--')) fail(`${arg} 缺少值`);
      options[arg.slice(2)] = args.shift();
    } else if (arg.startsWith('-')) fail(`未知选项 ${arg}`);
    else positional.push(arg);
  }
  let result;
  if (command === 'check' && positional.length === 1) result = check(positional[0], options.tracker);
  else if (command === 'migrate' && !positional.length && options.source && options.target) {
    const mapping = options.map ? JSON.parse(fs.readFileSync(safePath(options.map), 'utf8')) : {};
    if (!mapping || Array.isArray(mapping) || typeof mapping !== 'object') fail('状态映射必须是 JSON 对象');
    result = migrate({ ...options, mapping });
  } else fail('参数错误，运行 --help 查看用法');
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (e) { console.error(JSON.stringify({ ok: false, errors: [e.message] })); process.exitCode = 1; }
}
