# 叙事引擎 Prompt 规范（实现 `src/engine/` 时必读）

本文档定义 LLM 叙事生成的输入、Prompt 模板、校验规则与兜底策略。产品背景见 `docs/PRD.md`，数据结构见 `data/` 目录。

## 1. 生成管线

```
persona.stats（个人线）
  + artist.milestones（歌手线，仅 verified=true）
        ↓
年份对齐器 align(persona, artist) → [{year, personal, artist_event}]
        ↓
逐节点调 LLM（或一次批量）
        ↓
事实校验器 validate(text, injected) → pass | fail
        ↓
fail → 重生成（≤3次）→ 仍失败 → 模板文案兜底
        ↓
输出 [{year, text, personal, artist_event}]
```

## 2. System Prompt 模板（固定，不得修改语义）

```
你是一位音乐情感文案作者，为QQ音乐"音乐年轮"功能生成叙事。

铁律：
1. 你只能使用 <FACTS> 标签内提供的事实（用户听歌数据与歌手年表事件），
   严禁使用你自己记忆中的任何歌手信息、年份、作品或奖项。
2. 禁止对用户情绪下诊断性结论（如"你失恋了""你很孤独""你抑郁"）。
   只做留白式表达：陈述行为，留下情绪空间。
3. 每句文案必须同时包含个人锚点与歌手事件的可指认要素
   （年份/歌名/事件名，至少其二），让用户能认出"这是我"。
4. 若歌手事件 type=gap（空白期），只用留白句式，禁止解释空白原因。
5. 组合类歌手（type=group）叙事主体只能是组合名，禁止展开成员个人叙事。
6. 输出 JSON：{"texts": [{"year": 2001, "text": "..."}]}，每条不超过60字。

写作基调示例（对齐这种手感）：
- "13岁那年你注册了QQ音乐，《晴天》听了67次——那年他刚发《叶惠美》。"
- "你的大学四年，他们恰好不在。2022年《Still Life》回来时，你毕业了。"
- "那年《告白气球》你循环了410次。有些歌单，只有自己懂。"

反例（出现即判 fail）：
- "那年你失恋了，循环《说好不哭》217次。"（情绪诊断）
- "2022年他时隔六年带着新专回归，击败众多对手登顶。"（使用未注入的记忆）
```

## 3. User Prompt 模板

```
<FACTS>
用户：{birth_year}年出生，{platform_join_year}年注册QQ音乐
个人线锚点：{JSON: persona.stats}
歌手线事件：{JSON: 对齐后逐年的 artist milestones，仅 verified=true}
</FACTS>

为以下年份各生成一条双线交织文案：{years}
```

## 4. 事实校验器规则（`src/engine/validate.js`）

对每条生成文案：

1. 提取文案中的：年份数字、书名号/引号内文本、事件关键词；
2. 逐一回匹配到该年注入的 `personal` 与 `artist_event` 字段；
3. 任何无法回溯的实体（歌名/专辑/奖项/年份）→ fail；
4. 命中禁用词表（"失恋/抑郁/孤独/崩溃"等情绪诊断词）→ fail。

## 5. 模板兜底库（`data/templates.json`）

按事件类型预置，LLM 失败/不可用时填充：

- `join`: "{age}岁那年，你遇见了QQ音乐。那一年，{artist_event}。"
- `top_song`: "{year}年，《{song}》你循环了{plays}次。同一年，{artist_event}。"
- `gap`: "{years}年，你在这里听了{n}年歌，他们恰好不在。"
- `return`: "{year}年他们回来的时候，你{user_context}。"
- `fallback`: "{year}年，你的年度歌曲是《{song}》。"

## 6. 三级降级（URL 参数 `?level=1|2|3` 可强制切换）

| 级别 | 输入 | 行为 |
|---|---|---|
| L1 | persona.level="L1" | 完整双线交织 |
| L2 | persona 只有部分年份数据 | 空白年份仅注入歌手事件，文案走"你还没遇到他的那些年"句式 |
| L3 | 无 persona（未登录/新用户） | 纯歌手线编年史："从{birth_year}年起，他的每一年" |

## 7. 缓存

缓存 key = md5(artist_id + birth_year + persona_id)。命中直接返回，不重复调用 LLM。
