---
name: discover-workflow
description: 根据目标、当前阶段和缺失信息发现适合的技能与下一步流程。用户不确定该用什么技能，或模型需要选择研究、访谈、实验、实现、审查与交接路径时使用。
---

# 发现下一步流程

先判断用户希望得到什么结果、当前已有何种材料、哪类不确定性阻止推进，以及实际可用的技能。按需查看安装清单和相关技能的 `SKILL.md`，确认真实职责、依赖和完成条件后再推荐。技能名称相似不足以认定功能等价。

## 选择入口

| 当前需要 | 优先寻找的技能 |
| --- | --- |
| 统一项目约定、迁移现有 tracker | `setup-project` |
| 判断原始请求是否成立或就绪 | `triage` |
| 澄清目标、行为和设计取舍 | `grill-me`，需要同步术语和决定时 `grill-with-docs` |
| 外部事实或候选证据不足 | `research` |
| 运行结果才能回答设计问题 | `prototype` |
| 共识需要形成验收契约，或成熟规格需要拆成交付任务 | `to-spec` |
| 已有任务记录需要整理 | `maintain-tasks` |
| 开始实现明确工作 | `implement`，测试先行时配合 `tdd` |
| 解释异常或性能退化 | `diagnosing-bugs` |
| 寻找整体架构改进方向 | `improve-codebase-architecture` |
| 比较模块接口与职责方案 | `codebase-design` |
| 审查变更或专项设计问题 | `code-review`、`review-code-design` |
| 更换会话或接手中断现场 | 交接前 `handoff`，接手后 `recover-work` |
| 清理无用文件、将未提交修改分组提交，或 squash 等整理提交历史 | `clean-workspace`，按请求和授权选择分支 |
| 维护文档或呈现复杂结果 | 按目标选择 `maintain-docs`、`present-report` |
| 代理流程出现反复失败 | `improve-skills` |
| 选择或集成 Cloudflare 产品 | `cloudflare` |
| 构建 Workers 应用 | 按项目与框架选择 `nextjs-on-cloudflare`、`wrangler`、`workers-best-practices` |
| 查找 Cloudflare API 或准备 CLI 工作流 | `cf-cli`；已有 Wrangler 配置时用 `wrangler` |
| Durable Objects 状态管理 | `durable-objects` |
| 构建 AI Agents（Cloudflare SDK） | `agents-sdk` |
| Sandbox 应用开发 | `sandbox-stable`、`sandbox-next`、`sandbox-migrate-to-next` |
| Bot 验证（Turnstile） | `turnstile-spin` |
| 零信任网络 | `cloudflare-one`、`cloudflare-one-migrations` |
| 网站性能审计或优化 | `web-perf` |
| 诊断性能回归 | `diagnosing-bugs` |
| Email 集成 | `cloudflare-email-service` |
| Basin/K2 数据流 | `basin`、`k2` |
| Gateway Workers | `gateway-workers` |
| Workers 性能分析 | `workers-profiling` |

上表覆盖通用工作流和 Cloudflare 等领域入口；领域技能可能依赖特定产品或技术栈（如 Next.js），不一定随本技能安装。查找特定领域技能时，可在实际可用的技能清单中搜索产品名或技术栈名称。

这张表提供方向，实际安装技能及用户已有流程优先。领域术语和架构决定需要澄清时使用 `domain-modeling`。必需技能缺失时说明具体缺口及可行替代，安装操作遵循用户的安装意图和权限。

## 推荐并衔接

默认推荐最有价值的下一步，说明它会消除什么不确定性、需要哪些输入、得到什么结果，以及完成后何时切换流程。仅在真实分歧影响路径时给出少量备选。已有可用规格、工单、实验或决定直接复用，依当前缺口进入相应阶段。

模型可在明确目标和授权下调用选定技能继续执行。用户只请求建议时交付推荐；下一步需要产品决定或额外权限时，先整理具体选项与材料再交给用户。可并行的研究或审查交给有范围的独立代理，持续维护的目标通过规格和任务引用传递。

推荐的技能实际可用、适合当前缺口，且下一步输入、产物和切换条件已经清楚时，流程发现完成。
