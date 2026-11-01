# Gnosis skills

syntaxHighlight 日常开发使用的 20 个 skills，按需安装和组合。

## 安装

```sh
npx skills add syntaxHighlight/gnosis --list
npx skills add syntaxHighlight/gnosis --skill clean-workspace present-report --agent codex
```

`grill-with-docs` 依赖 `grill-me`，选择安装时请一起列出：

```sh
npx skills add syntaxHighlight/gnosis --skill grill-me grill-with-docs --agent codex
```

## 技能

| 分类 | 技能 |
| --- | --- |
| [项目接入](skills/setup/) | `setup-project` |
| [规划](skills/planning/) | `grill-me`、`grill-with-docs`、`to-spec`、`to-tickets`、`improve-codebase-architecture` |
| [执行](skills/execution/) | `implement`、`diagnosing-bugs` |
| [维护](skills/maintenance/) | `maintain-tasks`、`recover-work`、`clean-workspace`、`maintain-docs`、`improve-skills`、`review-code-design` |
| [表达](skills/presentation/) | `humanizer`、`present-report` |
| [基础方法](skills/foundations/) | `codebase-design`、`domain-modeling`、`tdd`、`code-review` |

技能沿用项目已有约定，无需先初始化。新建本地任务默认放在 `issues/`，报告放在 `reports/`。

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
