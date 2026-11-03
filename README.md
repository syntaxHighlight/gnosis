# Gnosis skills

syntaxHighlight 日常开发使用的 25 个 skills，按需安装和组合。

## 安装

```sh
npx skills add syntaxHighlight/gnosis --list
npx skills add syntaxHighlight/gnosis --skill clean-workspace present-report --agent codex
```

`grill-with-docs` 依赖 `grill-me` 和 `domain-modeling`，选择安装时一起列出。

```sh
npx skills add syntaxHighlight/gnosis --skill grill-me grill-with-docs domain-modeling --agent codex
```

## 技能

| 分类 | 技能 |
| --- | --- |
| [项目接入](skills/setup/) | `setup-project`、`discover-workflow` |
| [规划](skills/planning/) | `grill-me`、`grill-with-docs`、`to-spec`、`to-tickets`、`improve-codebase-architecture`、`triage`、`prototype`、`research` |
| [执行](skills/execution/) | `implement`、`diagnosing-bugs` |
| [维护](skills/maintenance/) | `maintain-tasks`、`recover-work`、`handoff`、`clean-workspace`、`maintain-docs`、`improve-skills`、`review-code-design` |
| [表达](skills/presentation/) | `humanizer`、`present-report` |
| [基础方法](skills/foundations/) | `codebase-design`、`domain-modeling`、`tdd`、`code-review` |

`setup-project` 建立统一的 Gnosis 项目约定，并为已有项目提供可审阅的迁移方案。本地任务默认放在 `issues/`，术语表为 `GLOSSARY.md`，ADR 放在 `docs/adr/`，规格和报告分别放在 `specs/`、`reports/`。配置记录分诊映射、验证入口和交付偏好，实际操作遵循任务授权。尚未接入的项目可先分析，再在需要迁移时完成 setup。

`discover-workflow` 根据当前目标和阶段查找适合的技能。每条流程有默认步骤、可选分支和完成条件，模型根据实际证据选择路径。分诊、拆票、记录维护及文档同步分别由对应技能负责。

## 开发

```sh
npm ci --prefix skills/setup/setup-project --ignore-scripts
npm run build
npm run verify
```

共用规则在 `shared/` 修改，构建生成的技能参考文件需一并提交。职责划分和验收场景见 [设计说明](docs/design.md)。

## 来源与许可

本项目采用 [MIT 许可证](LICENSE)。

- [mattpocock/skills](https://github.com/mattpocock/skills)：© 2026 Matt Pocock，[MIT](licenses/mattpocock-skills-MIT.txt)。
- [Humanizer](https://github.com/blader/humanizer)：© 2025 Siqi Chen，[MIT](licenses/humanizer-MIT.txt)。
- 本地任务工具依赖 [yaml 2.9.0](https://github.com/eemeli/yaml/tree/v2.9.0)（ISC），版权与许可声明随 npm 包提供。
