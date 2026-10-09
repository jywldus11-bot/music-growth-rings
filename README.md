# 音乐年轮（Growth Rings）

> QQ音乐站内 AI 音乐人生叙事引擎 · Build With AI 腾讯音乐高校 AI Hackathon 参赛项目
> 本文件是整个仓库的入口。**如果你是 AI 编程助手（Cursor/Copilot 等），请先完整阅读本文件，再按顺序阅读下方"阅读顺序"。**

## 这个项目是做什么的

用户输入**出生年份**并选择**一位喜爱歌手**（周杰伦 / BIGBANG），系统将用户的听歌历史（个人线）与歌手的生涯年表（歌手线）交织，用 LLM 生成逐年展开的"音乐年轮"叙事（例如："13岁那年你注册了QQ音乐，《七里香》你听了67次——那年他刚拿金曲奖"），最终导向：分享卡片（传播）+ 同类人小组/共听房间入口（承接）。

## 阅读顺序（AI 助手必读）

1. `README.md` —— 本文件，全局地图
2. `docs/PRD.md` —— 完整产品需求文档（功能定义、降级策略、验收标准的唯一事实源）
3. `docs/narrative-engine-prompt.md` —— 叙事引擎的 LLM Prompt 规范（实现生成层时必读）
4. `data/artists/*.json` —— 歌手年表数据（生成引擎的唯一事实输入）
5. `data/personas/*.json` —— Demo 阶段的预置用户画像（模拟个人线数据）
6. `.cursor/rules/growth-rings.mdc` —— 本项目的开发规则（技术选型、代码纪律）
7. `TASKS.md` —— 当前开发任务清单（勾选式，按此推进）

## 目录结构

```
growth-rings/
├── README.md                 # 本文件（入口）
├── TASKS.md                  # 开发任务清单（带 checkbox，供 AI 助手逐项执行）
├── docs/
│   ├── PRD.md                # 产品需求文档（产品事实源）
│   └── narrative-engine-prompt.md   # LLM 叙事生成 Prompt 规范
├── data/
│   ├── artists/
│   │   ├── jay_chou.json     # 周杰伦年表（白名单事件库）
│   │   └── bigbang.json      # BIGBANG 年表（含空白期事件类型）
│   └── personas/
│       ├── persona_p1_jay.json      # 预置画像：周杰伦老用户
│       ├── persona_p2_bigbang.json  # 预置画像：BIGBANG 粉丝
│       └── persona_p3_mid.json      # 预置画像：近3年入驻的 L2 中量用户
├── .cursor/rules/
│   └── growth-rings.mdc      # Cursor 项目规则
└── src/                      # 代码目录（待创建，见 TASKS.md）
```

## 三条不可违反的纪律（对人和 AI 同样生效）

1. **年表白名单制**：`data/artists/*.json` 中 `verified: false` 的事件**禁止**进入生成流程。LLM 生成文案时只准使用注入的事件数据，禁止使用模型自身对歌手生平的记忆。
2. **事实校验**：生成的每句文案中出现的歌名/专辑名/年份/事件名，必须能回溯到注入的白名单数据，否则重生成（最多3次），仍失败则降级到模板文案。
3. **文案纪律**：留白式诗意，禁止诊断式断言。不得输出"那年你失恋了/你很孤独"类情绪判断；正确示例："那年这首歌你循环了217次——有些歌单，只有自己懂。"

## 当前阶段

V1.0 Demo（截止 2026-10-09 提交）。个人线用预置画像模拟，歌手线用真实公开数据，承接层做可点击原型。详细边界见 `docs/PRD.md` 第12章。
