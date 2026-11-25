# 品质文档复核证据包（2026-11-25）

本目录用于复核三份品质文档：[体验标准 v1](../../../experience-standard-v1.md)、[现状差距清单](../../../quality-gap-audit-20261125.md)、[品质验证任务表](../../../quality-slice-plan-v1.md)。内容包括复核时实际执行的命令、截图和探针脚本。

## 1. 基线与环境

| 项 | 值 |
|---|---|
| 仓库 / 分支 | `GOD-OF-PPT/chenyaun-v2`，从 `main @ 86e2dc0` 拉出 `codex/docs-quality-review`；复核开始时工作树干净，与 `origin/main` 一致 |
| 入口 | `web/public/playable-v2.html`，SHA-256 `0401b19cdfb16da0068a31df4afc340e956b1421e544bb77a22de76ee75495cf`（`build:check` 确认与 `src/` 逐字节一致） |
| 浏览器 | Google Chrome 158.0.8127.36，headless，Ubuntu 24.04 VM，**软件渲染**，因此不作性能结论 |
| 视口 / 上下文 | 1440×900；每个脚本使用独立的 `browser.newContext()`，不读取任何真实玩家存档 |
| 入口方式 | 静态 HTTP（`tests/e2e/lib/harness.mjs` 的 `startStaticServer`）。本轮**未**测 `file://` 直开 |
| 输入 | 鼠标点击、按住、键盘 WASD/Space/右键，均为真实输入事件；没有调用调试接口修改状态 |

> [!NOTE]
> 原差距清单的证据（E01–E08）基于 `426c03af`（PR #15）及其未提交改动。复核时 main 已领先 84 个提交（PR #16–#37）。原文记录的 SHA-256 `2AE81CFB…` 与任何已提交版本都对不上。所以下面的 R 系列证据用来取代 E01–E05，作为当前 main 的现状依据。

## 2. 实际执行的命令

| 命令 | 结果 | 说明 |
|---|---|---|
| `npm ci` | 成功 | 安装 `playwright-core@1.65.1` |
| `npm run build:check` | PASS | 8 758 135 字节，115 张 WebP，11 个 ESM 模块，16 个运行期模块 |
| `npm run test:unit` | 43/43 PASS | 9 个测试文件 |
| `npm run art:manifest:check` | PASS | 115 项内联资产，11 项磁盘文件 |
| `npm run test:e2e -- --report /tmp/e2e-report.json` | **69/70**，失败 1 项：`E2E-T1-15` | 失败信息：`Defeating stage 0 boss must open #story-dialogue-bar for clear_stage0 cutscene`。这次全量运行与下面的截图脚本**同时执行**，机器有负载 |
| `npm run test:e2e -- --filter E2E-T1-15`（连续 3 次） | 3/3 PASS | 怀疑是对负载敏感的时序抖动，但尚未证实。原始失败照实保留，要求在 CI 或空载机器上复测 |
| `npm run test:regression -- --report /tmp/regression-report.json` | **91/91 PASS**，运行期错误 0 | 耗时约 651 秒，详见 §5 |

## 3. 截图证据（R 系列）

| 编号 | 文件 | 前置与输入 | 支持的判断 | 限制 |
|---|---|---|---|---|
| R01 | [r01-opening-field.webp](r01-opening-field.webp) | 新开局，逐句点“继续”读完开场 | 破庙开局：沈清禾站立并有地圈，无莲台；入道 1/4 提示“WASD 走位 · 左键连挥 3 剑” | 静态一帧 |
| R02 | [r02-first-clear-overlap.webp](r02-first-clear-overlap.webp) | 移动加左键连点、右键、空格，约 3–5 秒清场 | 同一帧内同时出现：4 行大字横幅、伤害数字、两张玉莲台选择卡、对白栏、连击评级“太虚剑神 S ×23”、悬赏完成提示；惊鸿剑诀莲台与沈清禾在画面上重叠 | 单次样本 |
| R03 | [r03-hub-float-leak.webp](r03-hub-float-leak.webp) | 在 R02 状态下点“洞府” | 破庙战斗的浮字（“六象觉醒”“破势失衡”、伤害数字）被带进洞府；连击面板也保留着；洞府教练条已改为“洞府最短整备” | 浮字残留的持续时间未计时 |
| R04 | [r04-death-recap.webp](r04-death-recap.webp) | 新开局后**原地按住左键、不移动、不闪避** | 战斗 5.4 秒后死亡（受击 5 次，承伤 135）。随后出现复盘弹窗：致死来源、数据提示、三项需主动选择的恢复方式，并注明“所有战利品均已保全” | 单次样本，不能据此判断难度 |
| R05 | [r05-post-rescue-dialogue.webp](r05-post-rescue-dialogue.webp) | 清场后对白自动弹出 | 对白弹出时焦点自动落在 `#btn-dlg-next`（见探针 3） | — |
| R06 | [r06-prologue-dialogue.webp](r06-prologue-dialogue.webp) | 新开局第一屏 | 开场卷轴与对白栏，暂停期间的画面层级 | — |

截图由 PNG 用 Pillow 转成 WebP（quality 78），只作为评审证据，**不是游戏美术资产**，不进入 `art-manifest`。SHA-256 如下：

```
4e57ea5b6e733f89f6964364ba4eb681e73d5e855f2b72ea9f4191872aa06560  r01-opening-field.webp
e20e5f9c92e6c9a9801c6487e339733903fad462bb4e8ae1ceafd8a469f59bd9  r02-first-clear-overlap.webp
d4267f831dd8cbecbaa3f6c562db2782cfd97b3a142589bf0e8a8d80a4e3fc4f  r03-hub-float-leak.webp
4fdacd834b0a3b99330105074712ad53707fe002fb394ad936fcd00511397325  r04-death-recap.webp
5a49ed4bb547a6a817e015c61f904b0f08333267320e22308d194469dd0f3437  r05-post-rescue-dialogue.webp
0d5481c33d6bb854fa472691d37d6aa4022840a8dfd0f3ac1ab7390431b17997  r06-prologue-dialogue.webp
```

## 4. 探针结果

脚本在 [scripts/](scripts/) 下，原始输出是 `r-*.json`。复现命令：`node docs/analysis/validation/quality-review-20261125/scripts/<脚本> <输出目录>`。

| 探针 | 观察 | 结论 |
|---|---|---|
| capture：DOM 字号统计（[r-capture-log.json](r-capture-log.json)） | 破庙战斗画面上带直接文本的可见元素，10 px 有 9 个、11 px 有 16 个、12 px 有 12 个；洞府 10 px 有 20 个、11 px 有 23 个。任务描述、境界、技能键名都在 10–11 px | 与 UX-04 的 16/14 px 目标差距**已证实**。对比度未测 |
| probe2：原地按住左键 | 5.4 秒（战斗计时）后死亡，评级 C。复盘显示“危招命中前未触发识破/凝时” | 一个反例：按住左键不动**不是**开局的稳定最优解。但这也说明首战没有在致命威胁前教会闪避，见 UX-05 |
| probe2：死亡弹窗打开时点击“洞府” | 点击被弹窗拦下（超时），刷新后回到破庙，灵石不变（65） | 符合“主动选择”与“不重复发放” |
| probe3：清场后立刻按 Space（“一闪”键） | 对白从沈清禾一句**跳到**顾长青下一句；焦点在 `#btn-dlg-next` 上 | **差距已证实**：战斗键会推进剧情。连按闪避的玩家可能跳过对白 |
| probe3：清场后点击空白画布 | 对白不变 | 画布点击不会推进对白 |
| probe3：玉莲台选择未完成时点击“洞府” | 允许离开，进入洞府，对白关闭 | 选择是否保留、何时再次提供，**仍未知**，需要专项测试 |

## 5. 回归套件

`npm run test:regression -- --report /tmp/regression-report.json`，在 `main @ 86e2dc0` 构建产物上执行：

```
Total: 91 | Executed: 91 | Passed: 91 | Failed: 0 | Error: 0 | Skipped: 0 | RuntimeErrors: 0 | Duration: 650678ms
```

退出码 0。覆盖范围包括 Q4–Q6、R3、T5（M7b 存档竞争、多标签页、焦点归位）等既有门禁。这只说明**已有断言**没有回退，不覆盖本轮新发现的 GAP-15～22。报告 JSON 没有提交，按命令可以复现。

## 6. 本轮未覆盖

`file://` 直开、真实 GPU 帧时间、声音试听、精英战、玉莲台之后的完整首卷、旧档续玩/写入失败/多标签页的实机复测（这些由 E2E Tier 2 自动覆盖，见 §2），以及外部试玩。
