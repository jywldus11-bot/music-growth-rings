// 个人里程碑层：把画像 milestones（第一次们）注入叙事节点
// 事实全部来自画像数据（零编造），文案走模板兜底层，不进 LLM 生成与校验流程。
// 类型清单（13 项用户叙事要素中的 12 个数据节点；出生那天的歌由 birthday.js 承载）：
//   join_date 注册日 / style_explore 风格摸索 / first_follow 第一位关注 /
//   first_foreign 第一首外语歌 / first_wechat_share 第一次分享 /
//   all_time_top 播放最多的歌 / adult_18 18岁的歌 / zodiac 本命年 /
//   first_new_genre 新风格初遇 / variety_show 音乐综艺 /
//   first_loop 第一支单曲循环 / first_chart_top 歌手榜第一次第一

export const MILESTONE_CHIP = {
  join_date: '注册那一天',
  style_explore: '风格摸索',
  first_follow: '第一位关注',
  first_foreign: '第一首外语歌',
  first_wechat_share: '第一次分享',
  all_time_top: '播放最多的歌',
  adult_18: '18岁的歌',
  zodiac: '本命年',
  first_new_genre: '新风格初遇',
  variety_show: '音乐综艺',
  first_loop: '第一支单曲循环',
  first_chart_top: '歌手榜第一次第一'
};

/**
 * 把画像里程碑按年份插入节点序列（同年可多行：数据行在前，里程碑行随后）
 * @param {Array} nodes    align() / buildBirthdayNodes() 输出（会被原地修改）
 * @param {object|null} persona
 * @param {number} birthYear
 * @returns {Array} 同一数组引用
 */
export function attachMilestones(nodes, persona, birthYear) {
  if (!persona || !Array.isArray(persona.milestones) || !persona.milestones.length) return nodes;
  const currentYear = new Date().getFullYear();

  const rows = persona.milestones
    .filter(m => MILESTONE_CHIP[m.type])
    .map(m => ({ ...m, year: m.year || persona.platform_join_year }))
    .filter(m => m.year >= birthYear && m.year <= currentYear)
    .sort((a, b) => a.year - b.year);

  for (const m of rows) {
    let at = nodes.findIndex(n => n.year > m.year);
    const node = {
      year: m.year,
      age: m.year - birthYear,
      personal: null,
      artistEvent: null,
      kind: 'milestone',
      milestone: m,
      inGap: false
    };
    if (at === -1) nodes.push(node);
    else nodes.splice(at, 0, node);
  }
  return nodes;
}
