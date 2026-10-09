// 叙事生成编排：对齐 → LLM（可选）→ 事实校验 → 模板兜底 → 缓存
// 与 UI 层的唯一接口：generateNarrative()

import { align } from './align.js';
import { buildBirthdayNodes, attachBirthRow } from './birthday.js';
import { validateText } from './validate.js';
import { applyTemplates, pickEndingQuote } from './fallback.js';
import { isConfigured, chat } from '../llm/adapter.js';

// System Prompt 与 docs/narrative-engine-prompt.md 第2节保持一致，修改须同步文档
const SYSTEM_PROMPT = `你是一位音乐情感文案作者，为QQ音乐"音乐年轮"功能生成叙事。

铁律：
1. 你只能使用 <FACTS> 标签内提供的事实（用户听歌数据与歌手年表事件），严禁使用你自己记忆中的任何歌手信息、年份、作品或奖项。
2. 禁止对用户情绪下诊断性结论（如"你失恋了""你很孤独""你抑郁"）。只做留白式表达：陈述行为，留下情绪空间。
3. 每句文案必须同时包含个人锚点与歌手事件的可指认要素（年份/歌名/事件名，至少其二）。
4. 若歌手事件 type=gap（空白期），只用留白句式，禁止解释空白原因。
5. 组合类歌手叙事主体只能是组合名，禁止展开成员个人叙事。
6. 输出 JSON：{"texts": [{"year": 2001, "text": "..."}]}，每条不超过60字。

写作基调示例（对齐这种手感）：
- "13岁那年你注册了QQ音乐，《晴天》听了67次——那年他刚发《叶惠美》。"
- "你的大学四年，他们恰好不在。2022年《Still Life》回来时，你毕业了。"
- "那年《告白气球》你循环了410次。有些歌单，只有自己懂。"

反例（出现即判 fail）：
- "那年你失恋了，循环《说好不哭》217次。"（情绪诊断）
- "2022年他时隔六年带着新专回归，击败众多对手登顶。"（使用未注入的记忆）`;

function userPrompt(nodes, artist, persona, birthYear) {
  const birthNode = nodes.find(n => n.birthMatch);
  const facts = {
    user: {
      birth_year: birthYear,
      platform_join_year: persona?.platform_join_year ?? null
    },
    birth_match: birthNode
      ? { birth: birthNode.birthMatch.birth, level: birthNode.birthMatch.level, matched: birthNode.birthMatch.matched }
      : null,
    personal_stats: nodes.map(n => n.personal).filter(Boolean),
    artist_events: nodes.map(n => n.artistEvent).filter(Boolean),
    prologue_events: nodes.filter(n => n.kind === 'prologue')
      .flatMap(n => n.prologueEvents || [])
  };
  return `<FACTS>\n歌手：${artist.artist_name}\n${JSON.stringify(facts, null, 2)}\n</FACTS>\n\n为以下年份各生成一条双线交织文案：${nodes.map(n => n.year).join(', ')}\n注意：第一个节点是序章（相遇之前的年份合并），请用一句话概括这些事件，不要逐年展开。出生年节点如含 birth_match，请把"出生那天发行的歌曲"写进该年文案。`;
}

// 缓存 key：artist_id(或solo) + 出生年月日 + persona_id + 个人数据年份数
function cacheKey(artist, birthYear, persona, birth) {
  const raw = `${artist?.artist_id || 'solo'}|${birthYear}|${birth?.month || 0}-${birth?.day || 0}|${persona?.persona_id || 'none'}|${persona?.stats?.length || 0}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = ((h << 5) - h + raw.charCodeAt(i)) | 0;
  return 'gr_cache_' + Math.abs(h);
}

/**
 * 统一双轨入口：
 *   选了歌手 → 我的音乐人生（出生那天的歌 + 个人数据）× 他的音乐人生（歌手年表）同屏对照
 *   不选歌手 → 只走我的音乐人生（个人线；无数据时降级为时代编年）
 * @param {object} opts {persona, artist, calendar, birth:{year,month,day}, birthYear, templates}
 * @returns {Promise<{mode:'llm'|'template', path:'artist'|'solo', results, endingQuote, nodes}>}
 */
export async function generateNarrative(opts) {
  const { persona, artist, calendar, birthYear, templates } = opts;
  const birth = opts.birth || { year: birthYear, month: null, day: null };

  // 节点装配：个人线出生行 + 歌手线年表
  let nodes;
  if (artist) {
    nodes = align(persona, artist, birthYear);
    if (calendar) attachBirthRow(nodes, calendar, birth);
  } else {
    nodes = buildBirthdayNodes(persona, calendar, birth);
  }

  const key = cacheKey(artist, birthYear, persona, birth);
  const cached = sessionStorage.getItem(key);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch { /* ignore broken cache */ }
  }

  let mode = 'template';
  let results = null;

  if (isConfigured() && artist) {
    for (let attempt = 0; attempt < 3 && !results; attempt++) {
      try {
        const llmTexts = await chat(SYSTEM_PROMPT, userPrompt(nodes, artist, persona, birthYear));
        const merged = mergeAndValidate(llmTexts, nodes);
        if (merged) results = merged;
      } catch (e) {
        console.warn('[growth-rings] LLM attempt failed:', e.message);
      }
    }
  }

  if (!results) results = applyTemplates(nodes, templates, persona);
  else mode = 'llm';

  const endingQuote = pickEndingQuote(results, nodes);
  const output = { mode, path: artist ? 'artist' : 'solo', results, endingQuote, nodes };
  try {
    sessionStorage.setItem(key, JSON.stringify(output));
  } catch { /* storage full, ignore */ }
  return output;
}

/** LLM 输出逐条校验：任何一条 fail 则整体弃用（保证零编造） */
function mergeAndValidate(llmTexts, nodes) {
  const byYear = new Map(llmTexts.map(t => [Number(t.year), t.text]));
  const out = [];
  for (const node of nodes) {
    const text = byYear.get(node.year);
    if (!text) return null;
    const v = validateText(text, node);
    if (!v.pass) {
      console.warn('[growth-rings] validate fail:', v.reason, text);
      return null;
    }
    out.push({ year: node.year, text, kind: node.kind });
  }
  return out;
}
