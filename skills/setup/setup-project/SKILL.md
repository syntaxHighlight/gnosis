---
name: setup-project
description: 为项目约定工单与报告位置，检查本地 Markdown 工单，或预览并迁移 Matt Pocock 和 旧版 frontmatter tracker 本地工单。
---

先检查项目现有 `AGENTS.md` / `CLAUDE.md`、工单说明、`issues/`、`.scratch/` 和 `.gnosis/project.json`。已有项目约定优先；普通开发任务不要求先运行本技能。

新项目没有约定时，采用本地 `issues/` 和 `reports/`；只创建本次需要的目录。已有 GitHub、GitLab 或其他 tracker 时沿用它，记录其实际操作方式；本技能的 CLI 只处理本地文件。迁移、切换 tracker 与新建配置是不同操作。

配置是可选的。需要让工具发现非默认路径时，保留已有字段，写入 `.gnosis/project.json`：

```json
{
  "version": 1,
  "tracker": { "type": "local", "path": "issues" },
  "reports": "reports"
}
```

路径相对于项目根，位于项目内。本地工单是带 YAML frontmatter 的 Markdown：`id`、`title`、`status`、`depends_on` 必填，`parent` 可选；ID 和引用均为字符串。状态为 `todo | in-progress | blocked | done | cancelled`。`parent` 表示归属，可省略或为 `null`；`depends_on` 表示前置条件，只有 `done` 满足依赖，`cancelled` 需要重新决策。

本地记录采用 Gnosis schema 或已迁移到该格式时，准备运行环境后执行 `node scripts/tracker.mjs check <项目根绝对路径>`。检查唯一 ID、字段格式、依赖与 parent 引用、依赖环与父子归属环（分别检查）。配置也会检查。没有配置时默认扫描项目根的 `issues/`。

沿用 Matt Pocock、旧版 frontmatter tracker 或其他既有格式时，使用其原生检查方式；没有工具就核对相应格式的状态和引用。不能把新检查器不支持的字段当成旧记录错误，也不能为通过检查隐式迁移。只调整报告位置等配置时，不要求改变 tracker。迁移中的未知值需澄清后映射。

迁移时先读 [references/migration.md](references/migration.md)，运行不带 `--apply` 的预览，检查路径、状态、ID 和引用映射，处理所有错误。向用户展示具体源、目标、状态转换及未解决项，获得迁移的明确确认后，才运行同一命令加 `--apply`。预览失败不允许写入；复杂引用可明确停止自动迁移，不能宣称全面支持。

完成条件：本次需要的配置可发现、现有项目规则得到保留，涉及的任务记录按其实际格式完成核对。迁移还需新格式检查通过并验证目标与归档，之后再按用户已确认的 tracker 选择更新配置；报告修改位置、验证结果与仍需人工处理的事项。既有 `AGENTS.md` / `CLAUDE.md` 只在需要补充发现入口时局部修改；不要求为简单约定创建额外文档。

## 本地工具的运行环境

只有需要运行检查或迁移工具时，才由代理准备环境。确认 Node.js 20+ 和 npm 可用；在本技能目录检查本地 `yaml` 依赖是否已按锁文件安装。已就绪则直接使用，缺失或版本不匹配时，由代理在该目录运行 `npm ci --ignore-scripts`，再用 `node scripts/tracker.mjs --help` 确认工具可运行。不要在用户项目中添加该依赖，也不要每次调用都重新安装。

准备过程遵循当前环境的写入和联网权限。缺少 Node.js、目录不可写或安装失败时，说明具体阻碍；不要自行安装系统运行时，也不能将未执行的检查报告为通过。普通配置和文档工作可以继续。
