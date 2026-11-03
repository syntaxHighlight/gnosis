---
name: setup-project
description: 为项目建立统一 Gnosis 约定，验证配置与本地工单，或预览并迁移既有 tracker。
---

先检查项目现有 `AGENTS.md` / `CLAUDE.md`、工单说明、术语与 ADR、`issues/`、`.scratch/` 和 `.gnosis/project.json`。用户请求项目接入时，默认提出迁移到统一 Gnosis 模式的方案；用户只请求校验或局部配置时按其范围处理。迁移确认前继续尊重现有规则，普通分析可先于 setup 开始。

## 接入步骤

1. 盘点任务系统、分类与分诊语义、文档位置、验证入口和 Git 交付约定。读取实际记录与命令，标明未知项。
2. 给出统一目标配置和迁移差异。默认位置见下文；有必须保留的稳定外链、外部系统或项目约束时，保留实际位置并在配置中明确映射。术语与 ADR 的含义保持可追溯。
3. 将需要用户决定的迁移、已有改动处理和交付偏好集中呈现。已确认的选择直接复用，配置说明与操作授权分别记录。
4. 在确认范围内迁移并建立发现入口。tracker 使用下面的预览与应用流程；术语表、ADR 和其他文档按路径、标识、状态与入链映射进行人工迁移，现有 CLI 只处理 tracker。验证目标内容和引用后切换权威入口，源记录的归档或删除按已确认方案执行。
5. 核对配置与真实入口一致，报告已完成接入、实际验证及待人工处理项。

新项目没有约定时，采用统一 Gnosis 模式：本地 `issues/`、`GLOSSARY.md`、`docs/adr/`、`specs/` 和 `reports/`，记录项目实际验证入口与 Git 交付模式/base；只创建本次需要的文件和目录。已有 GitHub、GitLab 或其他 tracker 时沿用它，记录实际操作方式与字段映射；CLI 只校验配置与本地文件，不访问远程。迁移、切换 tracker 与新建配置是不同操作。

完整接入时保留已有扩展字段，写入 `.gnosis/project.json` 作为统一发现入口。旧项目和单项分析可以暂时缺少配置，已有 v1 配置继续兼容。

```json
{
  "version": 1,
  "mode": "gnosis",
  "tracker": { "type": "local", "path": "issues" },
  "glossary": "GLOSSARY.md",
  "adr": "docs/adr",
  "specs": "specs",
  "reports": "reports",
  "verification": { "commands": ["npm run verify"] },
  "git": { "mode": "delivery", "base": "main" }
}
```

示例命令与 base 必须换成核实过的项目值；尚无验证入口时记录空命令列表并说明缺口。新项目推荐 `git.mode: delivery`，按用户任务或已确认规则授权的完整交付流程执行；也可选 `manual`，每次按具体授权操作。模式不强制分支策略；小修可沿用当前分支，中大型工作按规模、风险与并行情况选择分支或 worktree。配置只记录选择，不授予凭据、远程写入、提交、推送或发布权限。旧版仅有 `version`、`tracker`、`reports` 的配置继续有效，新增字段均可省略；保留已有未知扩展字段。所有位置相对项目根且位于项目内。

远程配置使用 `tracker: { "type": "remote", "provider": "github", "project": "owner/repo", "mapping": { "status": { "todo": "Todo", "done": "Done" }, "category": { "bug": "bug", "enhancement": "enhancement" }, "triage": { "needs-triage": "needs-triage", "needs-info": "needs-info", "ready-for-agent": "ready-for-agent", "ready-for-human": "ready-for-human", "wontfix": "wontfix" } } }`。各映射将标准值映射到实际远程字段值或标签；映射可按需列出，同一字段内不能多值映射到同一远程值。一次 triage 只能有一个明确值，替换它时移除同组旧标签，保留其他标签。不要根据 Git remote 推断或创建远程项目。

本地工单是带 YAML frontmatter 的 Markdown：`id`、`title`、`status`、`depends_on` 必填，`parent`、`category`、`triage` 可选；ID 和引用均为字符串。执行状态为 `todo | in-progress | blocked | done | cancelled`；`category` 为 `bug | enhancement`；`triage` 为 `needs-triage | needs-info | ready-for-agent | ready-for-human | wontfix`。三类字段独立，不能把 triage 当成执行状态或从多个标签猜测当前值；旧记录无需补填可选字段。`parent` 表示归属，可省略或为 `null`；`depends_on` 表示前置条件，只有 `done` 满足依赖，`cancelled` 需要重新决策。父任务不因子任务全部完成而自动完成。

准备运行环境后，执行 `node scripts/tracker.mjs config <项目根绝对路径>` 校验配置。本地记录采用 Gnosis schema 或已迁移到该格式时，再执行 `node scripts/tracker.mjs check <项目根绝对路径>`。检查唯一 ID、字段格式、依赖与 parent 引用、依赖环与父子归属环（分别检查）。配置也会检查。没有配置时默认扫描项目根的 `issues/`；远程配置需用其原生工具验证真实记录，`config` 通过不代表远程已验证。工具不执行 `verification.commands`。

请求是否缺信息、适合代理执行或需要人工判断由 triage 判断；`to-tickets` 负责拆分，`maintain-tasks` 负责创建、合并、更新任务记录与维护状态；本工具只验证 YAML 和配置约束。勾选 tickets/spec 的完成项或设为 `done` 之前，逐项核对可观察验收条件和证据；结构校验通过不代表功能完成。

沿用 Matt Pocock、旧版 frontmatter tracker 或其他既有格式时，使用其原生检查方式；没有工具就核对相应格式的状态和引用。不能把新检查器不支持的字段当成旧记录错误，也不能为通过检查隐式迁移。只调整报告位置等配置时，不要求改变 tracker。迁移中的未知值需澄清后映射。

迁移时先读 [references/migration.md](references/migration.md)，运行不带 `--apply` 的预览，检查路径、状态、ID 和引用映射，处理所有错误。向用户展示具体源、目标、状态转换及未解决项，获得迁移的明确确认后，才运行同一命令加 `--apply`。预览失败不允许写入；复杂引用可明确停止自动迁移，不能宣称全面支持。

完成条件是本次需要的配置可发现，保留的项目约束与迁移后规则一致，涉及的记录按实际格式完成核对。迁移还需新格式检查通过并验证目标与引用，之后按用户已确认的 tracker 选择更新配置；报告修改位置、验证结果与仍需人工处理的事项。既有 `AGENTS.md` / `CLAUDE.md` 只在需要补充发现入口或修正迁移后失效规则时局部修改。

## 本地工具的运行环境

只有需要运行检查或迁移工具时，才由代理准备环境。确认 Node.js 20+ 和 npm 可用；在本技能目录检查本地 `yaml` 依赖是否已按锁文件安装。已就绪则直接使用，缺失或版本不匹配时，由代理在该目录运行 `npm ci --ignore-scripts`，再用 `node scripts/tracker.mjs --help` 确认工具可运行。不要在用户项目中添加该依赖，也不要每次调用都重新安装。

准备过程遵循当前环境的写入和联网权限。缺少 Node.js、目录不可写或安装失败时，说明具体阻碍；不要自行安装系统运行时，也不能将未执行的检查报告为通过。普通配置和文档工作可以继续。
