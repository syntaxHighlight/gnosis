# 任务追踪约定

先读取项目已有说明和实际任务记录。可选配置 `.gnosis/project.json` 记录项目选择，不复制 skill 流程；旧配置继续有效。新建统一 Gnosis 约定时可记录：

```json
{
  "version": 1,
  "mode": "gnosis",
  "tracker": { "type": "local", "path": "issues" },
  "glossary": "GLOSSARY.md",
  "adr": "docs/adr",
  "specs": "specs",
  "reports": "reports",
  "verification": { "commands": [] },
  "git": { "mode": "delivery", "base": "main" }
}
```

新增字段可省略，路径相对项目根且位于项目内；验证命令和 Git base 须按项目核实，空命令列表表示尚未记录验证入口。`git.mode` 为 `delivery` 或 `manual`，记录完整交付或按具体授权操作的选择；分支与 worktree 按工作规模、风险和协作情况判断。配置不授予访问、凭据使用、提交、推送或发布权限。配置缺失时可继续分析和对话交付；写入目的地有实质歧义时才询问。不要根据 Git remote 自动创建远程任务。

远程 tracker 使用 `type: "remote"`、非空 `provider` 和 `project`，可用 `mapping.status`、`mapping.category`、`mapping.triage` 分别把下述标准字段值映射到实际远程状态、字段值或标签。例如 `"triage": { "needs-info": "needs-info", "ready-for-agent": "ready-for-agent" }`。同一字段内映射值不能重复；未映射值由具体项目明确处理，不能猜测。一次 triage 只保留一个明确值，替换时移除该组旧标签，保留其他标签。配置校验不访问远程，也不代表远程记录已通过检查。

新建本地 tracker 使用持久目录 `issues/`。每项 Markdown 任务有 YAML frontmatter，例如：

```yaml
---
id: task-001
title: 保存用户选择
status: todo
category: enhancement
triage: ready-for-agent
depends_on: []
parent: null
---
```

正文保存目标、必要上下文、可观察的验收条件、验证办法及必要的进展证据，篇幅按任务决定；这些是内容要求，不是必须逐项填写的栏目。规格和公共完成标准、状态含义集中维护，工单引用可访问的具体位置并保留独有条件，无需逐票复制。汇总列表只说明各项差异，公共规则说明一次即可。

`id` 是稳定且唯一的字符串；`depends_on` 是任务 ID 列表；`parent` 是可选的目标归属 ID，不能把归属关系当成前置条件。执行状态 `status` 为 `todo`、`in-progress`、`blocked`、`done`、`cancelled`。可选 `category` 为 `bug | enhancement`；可选 `triage` 为 `needs-triage | needs-info | ready-for-agent | ready-for-human | wontfix`。三类字段独立，不用多个标签推断一个值；旧记录无需补填可选字段。`wontfix` 是 triage 决定，执行状态是否转为 `cancelled` 仍需按已授权决定记录。依赖通常须 `done` 才满足；取消并不自动解除下游依赖，应重新判断要求。

triage 负责判断请求的完整性、类别与下一步执行方；`to-tickets` 负责拆分，`maintain-tasks` 负责创建、合并、更新任务记录与维护状态；工具负责 YAML、字段和引用校验。工具不代替判断，不以结构通过证明功能已验收。

读取时核对当前任务及判断所需的关联记录，不为查阅一张票审计整个 tracker。更新时检查本次变化可能影响的引用、依赖环和父子关系环，状态变化须有实际证据；必要时沿关联关系扩大检查。全量核对用于明确的 tracker 检查或整理任务。将 tickets/spec 的 checkbox 勾选或任务设为 `done` 前，逐项对应可观察验收条件与验证证据；未验证项保持开放并说明原因。子任务完成不自动使父任务 `done`，父任务还需满足自身验收条件。受阻时说明原因和解除条件，可以继续其他独立任务。不要通过删除阻塞关系或改变状态掩盖尚未完成的工作。

现有 `.scratch/<feature>/spec.md` 和 `issues/` 可能是正式 tracker。使用旧格式时遵循原配置；只有用户授权迁移才转换，预览映射并保留正文、评论、引用和状态语义。`setup-project` 若可用，提供校验与迁移工具；工具缺失时仍可人工核对小规模任务，不能伪称执行过工具验证。

任务维护不自动启动实现或授权外部关闭、提交和发布。完成记录有历史价值时可归档；有持续用途时保留，无用且经过核实才进入清理。
