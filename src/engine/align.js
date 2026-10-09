// 年份对齐器：把个人线锚点与歌手线事件对齐成叙事节点
// 纯函数，无副作用，可独立验证。

/**
 * @param {object|null} persona  data/personas/*.json（L3 时为 null）
 * @param {object} artist        data/artists/*.json
 * @param {number} birthYear
 * @returns {Array<{year, age, personal, artistEvent, kind}>}
 *   kind: 'join' | 'cross' | 'personal_only' | 'artist_only' | 'gap'
 */
export function align(persona, artist, birthYear) {
  const currentYear = new Date().getFullYear();
  // 白名单过滤：verified !== true 的事件一律丢弃（数据纪律 #1）
  const milestones = (artist.milestones || []).filter(m => m.verified === true);

  const gapRange = findGapRange(milestones);
  const personalByYear = new Map();
  if (persona && Array.isArray(persona.stats)) {
    for (const s of persona.stats) personalByYear.set(s.year, s);
  }

  const joinYear = persona ? persona.platform_join_year : null;
  const nodes = [];

  // 序章合并：相遇年之前的歌手事件合并为单一 prologue 节点，
  // 避免逐年输出"你还没遇到他"式复读文案（文案质量红线）
  const prologueEvents = joinYear
    ? milestones.filter(m => m.year < joinYear && m.year >= birthYear)
    : [];
  const prologueYears = new Set(prologueEvents.map(m => m.year));

  // 收集所有有意义的年份（序章年份除外，由 prologue 节点统一承载）
  const years = new Set([
    ...[...personalByYear.keys()].filter(y => !prologueYears.has(y)),
    ...milestones.map(m => m.year).filter(y => !prologueYears.has(y)),
    ...(joinYear ? [joinYear] : [])
  ]);

  for (const year of [...years].sort((a, b) => a - b)) {
    if (year < birthYear || year > currentYear) continue;
    const personal = personalByYear.get(year) || null;
    const artistEvent = milestones.find(m => m.year === year) || null;
    const inGap = gapRange && year > gapRange.start && year < gapRange.end;

    let kind;
    if (artistEvent && artistEvent.type === 'gap') kind = 'gap';
    else if (personal && artistEvent) kind = 'cross';
    // 空白期内有个人数据的年份保留个人叙事（+空白期后缀），不用通用留白句吞掉
    else if (personal) kind = 'personal_only';
    else if (artistEvent) kind = 'artist_only';
    else kind = 'join'; // joinYear 命中但当年无歌手事件时也走 personal 模板

    if (kind === 'join' && !personal && !artistEvent) continue; // 无内容年份不生成节点

    nodes.push({
      year,
      age: year - birthYear,
      personal,
      artistEvent,
      kind,
      inGap
    });
  }

  // 插入序章节点（排在相遇年之前的第一个有内容节点位置）
  if (prologueEvents.length) {
    const first = prologueEvents[0];
    const prologueNode = {
      year: first.year,
      age: first.year - birthYear,
      personal: null,
      artistEvent: first,
      prologueEvents,
      kind: 'prologue',
      inGap: false
    };
    const insertAt = nodes.findIndex(n => n.year > first.year);
    if (insertAt === -1) nodes.push(prologueNode);
    else nodes.splice(insertAt, 0, prologueNode);
  }
  return nodes;
}

function findGapRange(milestones) {
  const gaps = milestones.filter(m => m.type === 'gap').sort((a, b) => a.year - b.year);
  if (gaps.length < 2) return null;
  return { start: gaps[0].year, end: gaps[gaps.length - 1].year };
}
