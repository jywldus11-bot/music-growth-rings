// 模板文案兜底 v3：主句（templates.json）+ 歌词引用层 + 认知留白层
// 设计原则：
// 1. 留白式共鸣：写"这个年纪普遍在经历什么"，不写"你怎么了"（诊断式断言）
// 2. 歌词引用来自画像/年表数据中人工精修的极短摘录（≤1句），非 LLM 生成
// 3. 序章合并：相遇前事件一句话讲完，杜绝"你还没遇到他"逐年复读

// 人生阶段库：按年龄匹配（公开的普遍人生节点，非个体情绪判断）
const STAGES = [
  { max: 9,  text: '那还是耳机里放着动画片主题曲的年纪' },
  { max: 12, text: '小学，很多人口袋里还没有自己的耳机' },
  { max: 15, text: '十三四岁，耳机是口袋里的第一个秘密' },
  { max: 18, text: '高中，题海和随身听此消彼长' },
  { max: 19, text: '十八岁，很多人在换一座城市，也在换一副耳机' },
  { max: 22, text: '大学，歌单开始替日记本干活' },
  { max: 23, text: '毕业那年，歌单比行李更先安顿下来' },
  { max: 26, text: '初入社会的头几年，通勤耳机是每天最安静的半小时' },
  { max: 999, text: '工作以后，老歌成了最快的回家路' }
];

export function lifeStage(age) {
  const s = STAGES.find(s => age <= s.max);
  return s ? s.text : '';
}

let templateIdx = 0;
function pick(arr) {
  const t = arr[templateIdx % arr.length];
  templateIdx++;
  return t;
}

function fill(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''));
}

// 歌词引用层：有则引，无则不硬凑
function lyricLine(personal) {
  const l = personal?.lyric;
  return l ? `“${l}”。` : '';
}

// 认知留白层：画像里的人工精修认知句优先，缺失时回退人生阶段句
function insightLine(node) {
  const ins = node.personal?.insight;
  if (ins) return ins;
  const stage = lifeStage(node.age);
  return stage ? `${stage}。` : '';
}

// 序章文案：相遇前事件一句话讲完
function buildPrologue(node, templates) {
  const evts = node.prologueEvents;
  const first = evts[0];
  const a = node.age;
  const opener = a === 0
    ? `${first.year}年，${first.event}——那年你刚出生。`
    : a < 0
      ? `${first.year}年，${first.event}——那时你还没出生。`
      : `你${a}岁那年，${first.event}。`;
  // 精选后续高权重事件（过滤 low），优先展示专辑/作品名
  const names = evts.slice(1)
    .filter(e => e.weight !== 'low')
    .slice(0, 3)
    .map(e => {
      const m = String(e.event || '').match(/《[^》]+》/);
      return m ? m[0] : e.event;
    });
  const mid = names.length ? `之后${names.join('')}接连问世。` : '';
  return `${opener}${mid}${templates.prologue_closer}`;
}

// 生日路径文案：出生日匹配 / 出生年背景 / 时代编年
function fmtEntries(list) {
  return list.map(e => `${e.artist}的${e.title}`).join('、');
}

function buildBirthDay(node) {
  const m = node.birthMatch;
  const b = m.birth;
  if (m.level === 'day') {
    return `${b.year}年${b.month}月${b.day}日，你出生的那一天——${fmtEntries(m.matched)}发行。这些歌，和你同一天来到这个世界。`;
  }
  if (m.level === 'month') {
    return `你出生前后那阵子，${fmtEntries(m.matched)}正在发行——它们和襁褓里的你，几乎前后脚问世。`;
  }
  return `${b.year}年，你来了。`;
}

function buildBirthYear(node) {
  const ctx = node.yearContext || [];
  if (!ctx.length) {
    return '你出生那年，音乐世界正在酝酿一些后来才被听见的事——往下翻，年轮会替你数。';
  }
  return `你出生那年，大家的耳机里放着：${fmtEntries(ctx)}。`;
}

function buildEra(node) {
  const e = node.eraEntry;
  if (!e) return `${node.year}年`;
  const who = e.kind === '事件' ? e.title : `${e.artist}的${e.title}`;
  const tail = e.note ? `（${e.note}）` : '';
  return `${node.year}年，${who}${tail}那年你${node.age}岁。`;
}

// —— 双轨结构化输出 ——
// me（我的音乐人生）：出生那天的歌 / 逐年听歌数据（歌曲+次数+歌词+认知句）/ 出生年时代背景 / 时代编年
// him（他的音乐人生）：序章 / 里程碑事件 / 空白期
// UI 层按 me/him 渲染左右双轨；text 为合并句（结尾金句与 LLM 校验回退用）

function buildMe(node, templates, v) {
  if (node.birthMatch) {
    return { type: 'birth', text: buildBirthDay(node) };
  }
  if (node.personal) {
    const insight = insightLine(node);
    return {
      type: node.kind === 'join' ? 'join' : 'stat',
      song: node.personal.top_song || '',
      plays: node.personal.plays ?? '',
      lyric: node.personal.lyric || '',
      insight,
      text: fill(pick(templates.personal_only), v) + insight
    };
  }
  if (node.kind === 'era') {
    return { type: 'era', text: buildEra(node) };
  }
  if (node.yearContext) {
    return { type: 'context', text: buildBirthYear(node) };
  }
  if (node.kind === 'birth_solo') {
    return { type: 'context', text: buildBirthYear(node) };
  }
  return null;
}

function buildHim(node, templates, v) {
  if (node.kind === 'prologue') {
    return { type: 'prologue', text: buildPrologue(node, templates) };
  }
  if (node.kind === 'gap') {
    return { type: 'gap', text: fill(pick(templates.gap_event), v) };
  }
  if (node.artistEvent) {
    const lyric = node.artistEvent.lyric || '';
    return {
      type: 'event',
      event: node.artistEvent.event,
      lyric,
      text: `${node.artistEvent.event}。` + (lyric ? `“${lyric}”。` : '')
    };
  }
  return null;
}

/**
 * @param {Array} nodes  align() / buildBirthdayNodes() 输出
 * @param {object} templates  data/templates.json
 * @param {object|null} persona  当前画像（用于 joinYear 与"已相遇"措辞选择）
 * @returns {Array<{year, text, stage, kind, song, me, him}>}
 */
export function applyTemplates(nodes, templates, persona) {
  templateIdx = 0;
  return nodes.map(node => {
    const v = {
      year: node.year,
      age: node.age,
      song: node.personal?.top_song || '',
      plays: node.personal?.plays ?? '',
      artistEvent: node.artistEvent?.event || '',
      joinYear: persona?.platform_join_year || '',
      lyric: lyricLine(node.personal || node.artistEvent),
      insight: insightLine(node)
    };
    let text;
    switch (node.kind) {
      case 'prologue':
        text = buildPrologue(node, templates);
        break;
      case 'join':
        if (node.personal) {
          // 相遇年有个人数据：相遇句 + 该年个人叙事
          text = `${v.age}岁那年，你遇见了QQ音乐。` + fill(pick(templates.personal_only), v) + v.insight;
        } else {
          text = node.artistEvent
            ? fill(pick(templates.join), v)
            : fill(pick(templates.join_solo || templates.join), v);
        }
        break;
      case 'cross':
        text = fill(pick(templates.cross), v) + v.insight;
        break;
      case 'personal_only':
        text = fill(pick(templates.personal_only), v) + v.insight;
        if (node.inGap) text += templates.gap_suffix || '';
        break;
      case 'artist_only':
        // 已相遇（有画像但当年无个人数据）用带钩子的版本；L3 纯歌手线用平实版本
        text = fill(pick(persona
          ? (templates.artist_only_known || templates.artist_only)
          : templates.artist_only), v);
        break;
      case 'gap':
        text = fill(pick(templates.gap_event), v);
        break;
      case 'birth_day':
        text = buildBirthDay(node);
        break;
      case 'birth_year':
        text = buildBirthYear(node);
        break;
      case 'era':
        text = buildEra(node);
        break;
      default:
        text = v.year + '年';
    }
    // 年龄措辞润色：0岁 → 刚出生
    text = text.replace(/那年你0岁/g, '那年你刚出生');
    return {
      year: node.year,
      text,
      stage: lifeStage(node.age),
      kind: node.kind,
      song: node.personal?.top_song || node.artistEvent?.song || null,
      me: buildMe(node, templates, v),
      him: buildHim(node, templates, v)
    };
  });
}

/** 结尾金句：优先取播放次数最高的交织年份 */
export function pickEndingQuote(results, nodes) {
  let best = null;
  results.forEach((r, i) => {
    const n = nodes[i];
    if (!n) return;
    const score = (n.kind === 'cross' ? 1000 : 0) + (n.personal?.plays || 0);
    if (!best || score > best.score) best = { score, text: r.text };
  });
  return best ? best.text : '';
}
