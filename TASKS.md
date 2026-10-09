# 开发任务清单（截至 2026-10-09 提交）

> AI 助手工作方式：从上到下逐项执行，完成一项勾选一项，不要跳步。
> 每完成一个 Phase 提交一次 git commit。

## 运行方式（Quick Start）

```bash
cd growth-rings
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000/src/index.html
# 降级路径测试：URL 加 ?level=1 / ?level=2 / ?level=3
```

## 已完成的脚手架（2026-10-04，待人工 review）

- [x] `data/templates.json` 模板兜底库 + `data/copy.json` 界面文案
- [x] `src/engine/`（align / validate / fallback / generate）+ `src/llm/adapter.js`
- [x] `src/ui/`（app / ring）+ `src/index.html` + `src/css/style.css`（四屏原型：输入→等待→叙事→结尾）
- [x] 引擎无浏览器端到端测试通过：L1 交织 / L3 纯歌手线 / 情绪诊断拦截 / 编造年份拦截 / BIGBANG 空白期留白
- 注：LLM 生成路径已实现未实测（需配置 API）；模板模式可直接演示。年表已核对，仅 `verified: true` 进入生成；成员个人专辑保留为 `verified: false`。

## Phase 0 · 数据（10.5）

- [x] 逐条核对 `data/artists/jay_chou.json` 全部事件（对照QQ音乐歌手页/权威百科），核对通过的置 `verified: true`，有误的修正
- [x] 逐条核对 `data/artists/bigbang.json`（含演唱会信息核实官方渠道），同上
- [x] 补充第3个画像：L2 中量数据用户（写 `data/personas/persona_p3_mid.json`，只有近3年数据，验证降级路径）
- [x] 创建 `data/templates.json` 模板兜底库（按 narrative-engine-prompt.md 第5节，每类≥10条）
- [x] 创建 `data/copy.json`（界面文案集中管理）

## Phase 1 · 叙事引擎（10.6）

- [ ] `src/engine/align.js`：年份对齐器（persona.stats × artist milestones，纯函数）
- [ ] `src/llm/adapter.js`：LLM API 适配层（OpenAI 兼容协议，密钥读环境变量 `LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL`）
- [ ] `src/engine/generate.js`：注入白名单事件调 LLM（System Prompt 用 docs/narrative-engine-prompt.md 第2节原文）
- [ ] `src/engine/validate.js`：事实校验器（回匹配 + 情绪诊断禁用词表）
- [ ] `src/engine/fallback.js`：重生成≤3次 → 模板兜底
- [ ] 缓存：key = md5(artist_id + birth_year + persona_id)，localStorage 即可
- [ ] 验收：两个 persona 各生成一次，全部文案通过校验器；LLM 断网时模板模式完整可跑

## Phase 2 · 前端（10.7）

- [ ] `src/ui/`：输入页（年份滚轮 + 歌手选择，默认猜测年份）
- [ ] 生成等待页（年轮生长动画，约3秒，掩盖等待）
- [ ] 年轮可视化：同心圆环逐年点亮，个人事件/歌手事件分色系，交汇年份节点放大，点击单年看详情
- [ ] 逐年叙事浏览（滑动推进，每屏一句文案+年份）
- [ ] 结尾金句页：全程最扎心一句 + 年轮全貌 + 双出口（分享/进组）
- [ ] 三级降级切换：URL 参数 `?level=1|2|3` 手动触发
- [ ] 验收：PRD 验收项 A1（15秒内出首条叙事）、A5（L3 路径完整）

## Phase 3 · 传播与承接（10.8）

- [ ] 分享卡片生成（年轮图+金句，canvas 导出图片）
- [ ] 落地页：未登录可见纯歌手线版（L3），底部注册引导
- [ ] 承接层原型：结尾页展示"同类人小组推荐卡"（确定性标签：同年入坑/同歌手/同龄段）+ 共听房间入口卡，点击展示推荐理由（原型即可，不做实时通信）
- [ ] 验收：A6（微信环境打开落地页正常）、A7（入口可点击且展示推荐理由）

## Phase 4 · 测试与提交（10.9）

- [ ] 真机测试：iOS Safari + 微信内置浏览器 + Android Chrome
- [ ] 用户测试：5名目标用户，只问一句"你会截图发朋友圈吗"（验收 A8：≥4人肯定）
- [ ] 修复阻塞问题
- [ ] 提交作品

## 常见坑（AI 助手注意）

1. fetch 本地 JSON 在 file:// 协议下会被浏览器拦截 → 用 `python3 -m http.server` 起本地服务测试
2. 微信内置浏览器对 canvas.toDataURL 有兼容性问题 → 分享卡片优先用 svg 序列化方案
3. 年表 JSON 修改后必须同步更新 docs/PRD.md 6.3 节示例
4. 任何情况下不得把 `verified: false` 的事件放进生成流程，不得硬编码 API 密钥
