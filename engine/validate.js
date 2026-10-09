// 事实校验器：生成文案必须能回溯到注入的白名单数据（数据纪律 #2/#3）

const BANNED_WORDS = ['失恋', '抑郁', '孤独', '崩溃', '分手', '出轨', '去世', '去世了', '自杀'];

/**
 * 校验单条文案
 * @param {string} text
 * @param {object} node  align() 输出的节点（含注入的 personal / artistEvent）
 * @returns {{pass: boolean, reason?: string}}
 */
export function validateText(text, node) {
  if (!text || typeof text !== 'string') return { pass: false, reason: 'empty' };
  if (text.length > 80) return { pass: false, reason: 'too_long' };

  for (const w of BANNED_WORDS) {
    if (text.includes(w)) return { pass: false, reason: 'banned_word:' + w };
  }

  // 年份校验：文案中出现的 4 位年份必须等于节点年份
  const yearsInText = text.match(/\d{4}/g) || [];
  for (const y of yearsInText) {
    if (Number(y) !== node.year) return { pass: false, reason: 'bad_year:' + y };
  }

  // 实体校验：书名号/引号内的歌名必须存在于注入数据
  const quoted = text.match(/[《「"]([^》」"]+)[》"]/g) || [];
  const allowed = collectEntities(node);
  for (const q of quoted) {
    const name = q.replace(/[《》「"]/g, '');
    if (!allowed.some(a => a.includes(name))) return { pass: false, reason: 'bad_entity:' + name };
  }

  return { pass: true };
}

function collectEntities(node) {
  const out = [];
  if (node.personal) {
    if (node.personal.top_song) out.push(node.personal.top_song);
    if (node.personal.top_artist) out.push(node.personal.top_artist);
  }
  if (node.artistEvent) {
    out.push(node.artistEvent.event || '');
    if (node.artistEvent.song) out.push(node.artistEvent.song);
    if (node.artistEvent.detail) out.push(node.artistEvent.detail);
  }
  // 序章节点：相遇前的全部事件都进入白名单
  if (node.prologueEvents) {
    for (const e of node.prologueEvents) {
      out.push(e.event || '');
      if (e.song) out.push(e.song);
    }
  }
  return out.map(s => String(s));
}
