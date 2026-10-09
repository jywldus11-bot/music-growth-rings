// 生日路径（个人线起点）：出生那天的歌 → 逐年个人数据
// 匹配逻辑：同日发行匹配（仅 precision=day 条目）→ 降级同月 → 降级同年时代背景
// 个人线：有画像 → 逐年个人叙事；无画像 → 时代编年（每年一条 era 条目）

/**
 * 生日匹配：同日 → 同月 → 同年，三级降级
 * @param {object} calendar  data/calendar.json
 * @param {{year,month,day}} birth  出生年月日（month/day 1-12/1-31，可为 null）
 * @returns {{level:'day'|'month'|'none', matched:Array, yearContext:Array}}
 */
export function matchBirthday(calendar, birth) {
  const entries = (calendar.entries || []).filter(e => e.verified === true);
  if (birth.month && birth.day) {
    const exact = entries.filter(e => e.precision === 'day' && e.month === birth.month && e.day === birth.day);
    if (exact.length) return { level: 'day', matched: exact, yearContext: [] };
  }
  if (birth.month) {
    const sameMonth = entries.filter(e =>
      e.month === birth.month &&
      e.year >= birth.year - 1 && e.year <= birth.year + 1 && // 生日前后临近的也算"你出生那阵子"
      !(birth.day && e.precision === 'day' && e.day === birth.day)
    );
    if (sameMonth.length) {
      return { level: 'month', matched: sameMonth.slice(0, 3), yearContext: [] };
    }
  }
  return { level: 'none', matched: [], yearContext: [] };
}

/** 出生年的时代背景条目（排除已匹配的） */
export function birthYearContext(calendar, birth, matchedTitles) {
  const entries = (calendar.entries || []).filter(e =>
    e.verified === true && e.year === birth.year && !matchedTitles.includes(e.title)
  );
  return entries.slice(0, 4);
}

/**
 * 构建生日路径叙事节点
 * @param {object|null} persona  画像（可为 null → L3 时代编年线）
 * @param {object} calendar
 * @param {{year,month,day}} birth
 * @returns {Array} 与 align() 同构的节点数组（kind 新增 birth_day / birth_year / era）
 */
export function buildBirthdayNodes(persona, calendar, birth) {
  const currentYear = new Date().getFullYear();
  const nodes = [];

  const match = matchBirthday(calendar, birth);
  const matchedTitles = match.matched.map(e => e.title);
  const yearCtx = birthYearContext(calendar, birth, matchedTitles);

  // 节点1：出生那天的音乐（无任何匹配时跳过，由时代背景节点开场）
  if (match.level !== 'none') {
    nodes.push({
      year: birth.year,
      age: 0,
      personal: null,
      artistEvent: null,
      birthMatch: { ...match, birth },
      kind: 'birth_day',
      inGap: false
    });
  }

  // 节点2：出生年的时代背景（无匹配且无背景时也保留节点，走通用开场文案）
  if (yearCtx.length || match.level === 'none') {
    nodes.push({
      year: birth.year,
      age: 0,
      personal: null,
      artistEvent: null,
      yearContext: yearCtx,
      kind: 'birth_year',
      inGap: false
    });
  }

  if (persona && Array.isArray(persona.stats) && persona.stats.length) {
    // 有个人数据：个人线叙事 + 相遇锚点
    const joinYear = persona.platform_join_year;
    const sorted = [...persona.stats].sort((a, b) => a.year - b.year);
    for (const s of sorted) {
      if (s.year > currentYear) continue;
      const isJoin = s.year === joinYear;
      nodes.push({
        year: s.year,
        age: s.year - birth.year,
        personal: s,
        artistEvent: null,
        kind: isJoin ? 'join' : 'personal_only',
        inGap: false
      });
    }
  } else {
    // 无个人数据：时代编年（每年一条 era 条目）——拉新落地页形态
    const byYear = new Map();
    for (const e of (calendar.entries || [])) {
      if (e.verified !== true) continue;
      if (e.year <= birth.year || e.year > currentYear) continue;
      if (e.era && !byYear.has(e.year)) byYear.set(e.year, e);
    }
    for (const [year, entry] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
      nodes.push({
        year,
        age: year - birth.year,
        personal: null,
        artistEvent: null,
        eraEntry: entry,
        kind: 'era',
        inGap: false
      });
    }
  }

  return nodes;
}

/**
 * 把"出生那天的歌"附加到统一节点序列的出生年行（双轨模式用）：
 * 有匹配 → node.birthMatch；无论是否命中 → 附上出生年时代背景（node.yearContext）。
 * 出生年没有现成节点时（歌手所有里程碑都晚于出生年）新建 birth_solo 节点。
 * @param {Array} nodes  align() 输出（会被原地修改）
 * @param {object} calendar
 * @param {{year,month,day}} birth
 * @returns {Array} 同一数组引用
 */
export function attachBirthRow(nodes, calendar, birth) {
  const match = matchBirthday(calendar, birth);
  const matchedTitles = match.matched.map(e => e.title);
  const yctx = birthYearContext(calendar, birth, matchedTitles);

  let node = nodes.find(n => n.year === birth.year);
  if (!node) {
    node = {
      year: birth.year,
      age: 0,
      personal: null,
      artistEvent: null,
      kind: 'birth_solo',
      inGap: false
    };
    const at = nodes.findIndex(n => n.year > birth.year);
    if (at === -1) nodes.push(node);
    else nodes.splice(at, 0, node);
  }
  if (match.level !== 'none') node.birthMatch = { ...match, birth };
  node.yearContext = yctx.slice(0, 3);
  return nodes;
}
