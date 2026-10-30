# 本地检查与迁移

运行前由代理按 [技能入口](../SKILL.md) 准备 Node.js 20+ 和锁定的 `yaml` 依赖；无需用户手动进入技能目录安装。`node scripts/tracker.mjs --help` 查看参数，`npm test` 运行行为测试。命令输出 JSON；退出码 0 表示通过，1 表示存在错误。

## 检查

```sh
node scripts/tracker.mjs check /absolute/project
node scripts/tracker.mjs check /absolute/project --tracker work/issues
```

`--tracker` 显式覆盖配置中的路径。没有配置时用 `issues`。扫描所有 `.md`（排除 `spec.md` 与 `_originals/` 归档），不读取旧工具的派生索引。最小工单：

```markdown
---
id: "01"
title: 实现登录
status: todo
depends_on: []
---
正文和评论按项目约定维护。
```

`parent` 可省略或为 `null`，字符串值必须是一个已有工单 ID。`depends_on` 必须显式给出列表。检查器检测重复 ID、缺失引用，并分别检查依赖环与 parent 归属环。parent 不自动生成依赖；两类边的混合调度风险由具体项目规则判断。检查器不自动更改状态，也不判断某个 done 工单是否真正完成验收。

## 预览来源

Matt Pocock 的源指向单个 `.scratch/<feature>`，包含 `spec.md` 与 `issues/*.md`：

```sh
node scripts/tracker.mjs migrate --source /absolute/project/.scratch/login --target /absolute/project/migrated-login --format scratch
```

支持原版 `to-tickets` 的 `# NN: 标题`、`**Status:** 值`、`**Blocked by:** NN, NN` 文本模板，亦支持已有标准 frontmatter。文件名前缀须与标题编号一致，保留前导零。无依赖可写 `None` 或模板中的 `None (can start immediately)`。含标题、混合链接或不能唯一识别的依赖会阻塞，需先在人审副本中明确编号；CLI 不推断标题对应哪个工单。缺少状态或依赖行也会阻塞。

旧版 frontmatter tracker 的源指向包含 `issues/` 的目录：

```sh
node scripts/tracker.mjs migrate --source /absolute/old-project --target /absolute/project/imported --format legacy
```

按真实模板将正整数 `id` / `deps` / `parent` 转成字符串 ID / `depends_on` / 可选 `parent`；`null` parent 省略。保留 `issues/done/`、`issues/wontfix/` 相对路径，不移动和重新编号。状态 `wontfix` 映射为 `cancelled`；已有标准状态保持。`review`、`ready-for-agent`、`claimed`、`resolved` 等不等于标准状态，由用户明确决定后用 JSON 对象映射，例如：

```json
{ "ready-for-agent": "todo", "review": "in-progress" }
```

源状态必须是非空字符串；数组、null 和对象等不会隐式转换。映射必须是普通 JSON 对象，键非空，值为标准状态字符串。将此对象存为文件，再附加 `--map /absolute/state-map.json`。映射仅表达该次迁移决定，不能据此推断其他项目。重复字段、未知状态、重复 ID、缺失依赖、循环、歧义均阻塞 apply。

## 保留范围与引用

只采集源目录中的 `issues/` 树，以及根层的 `spec.md` 和 `map.md`（若有）；不迁移项目代码、Git 历史和其他根文件。旧版 `todo.yaml`、`dependencies.dot` 等同目录文件只是保留的旧派生快照，后续工作以 Markdown frontmatter 为准。

目标保留采集文件的相对布局。frontmatter 重新序列化，正文和评论原样保留；原版文本工单的全文成为新 frontmatter 下的正文，因此旧 `Status:` 行属于来源记录，后续状态以 frontmatter 为准。所有采集文件的原始字节额外存入 `_originals/<原相对路径>`。`migration.json` 包含源目标、原始 SHA-256、路径映射、状态映射和标准 ID / 引用列表。

简单行内 Markdown 本地链接必须指向采集范围内存在的文件，布局保持后目标可验证。绝对外部 HTTP(S)/mailto 链接保留，不联网验证。绝对本地链接（含 Windows、file URL 和编码后的形式）会固定指向旧源，因此阻塞。wiki、HTML 标签（包括 video、object 等资源标签，普通 HTML 注释保留）、引用式链接、嵌套方括号标签（含图片外层链接）、本地锚点和复杂带空格链接保守阻塞。扫描器可能对代码示例中的链接报错；它不是通用 Markdown 引用解析器。正文中裸工单号、纯文本路径及 YAML 附加字段的自定义引用仅原样保留，需在人工审查时确认；不能把通过该检查器描述为“所有引用已验证”。

## 确认后应用

展示预览的所有映射与限制，获得用户针对本次具体源目标和状态转换的明确迁移确认，再为预览命令加 `--apply`。CLI 的显式参数是技术开关，不替代技能工作流中的确认。

源目标必须互不嵌套，目标必须尚不存在且其父目录存在。CLI 拒绝路径上的符号链接（检查项目配置时 reports 路径也遵循此规则；包括系统别名；macOS 临时路径请用 `/private/tmp` 或真实路径）、源树符号链接、保留路径冲突与覆盖。

CLI 在目标父目录的临时目录中写入并逐字节校验，检查迁移工单，再核对源是否变化，独占创建目标后发布。失败时清理暂存；若发布途中系统失败，可能留下部分目标，会明确报告，源文件不删除或覆盖。该工具不提供针对并发恶意替换目录的文件系统事务保证，应在目录未被其他进程改写时执行。

成功后再运行：

```sh
node scripts/tracker.mjs check /absolute/project --tracker imported/issues
```

检查归档、spec 与正文，确认 `migration.json`。然后 agent 可按照已确认的 tracker 选择，将 `.gnosis/project.json` 的 `tracker.path` 改为 `imported/issues`；CLI 自身不切换配置。保留原来源，用户另行决定何时归档。`--apply` 返回失败时不切换配置，也不宣称迁移完成。
