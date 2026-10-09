// QQ音乐真实歌单接入：公开接口（无需登录）拉取用户分享的歌单
// 链路：u.y.qq.com/cgi-bin/musicu.fcg (JSONP 跨域) + zzb 签名
// 接口：music.srfDissInfo.aiDissInfo / uniform_get_Dissinfo
// 数据：每首歌含 time_public（发行日期）→ 按发行年份映射到用户年龄轴，构成"音乐年轮"

// ---------- MD5（标准实现，UTF-8 输入 → 32 位小写 hex） ----------
function md5(input) {
  const bytes = utf8Bytes(input);
  const len = bytes.length;
  const padded = (len + 8) >> 6;
  const total = (padded + 1) << 4;
  const words = new Array(total).fill(0);
  for (let i = 0; i < len; i++) words[i >> 2] |= bytes[i] << ((i % 4) * 8);
  words[len >> 2] |= 0x80 << ((len % 4) * 8);
  words[total - 2] = len << 3;
  words[total - 1] = len >>> 29;

  let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
  const K = [
    -680876936, -389564586, 606105819, -1044525330, -176418897, 1200080426,
    -1473231341, -45705983, 1770035416, -1958414417, -42063, -1990404162,
    1804603682, -40341101, -1502002290, 1236535329, -165796510, -1069501632,
    643717713, -373897302, -701558691, 38016083, -660478335, -405537848,
    568446438, -1019803690, -187363961, 1163531501, -1444681467, -51403784,
    1735328473, -1926607734, -378558, -2022574463, 1839030562, -35309556,
    -1530992060, 1272893353, -155497632, -1094730640, 681279174, -358537222,
    -722521979, 76029189, -640364487, -421815835, 530742520, -995338651,
    -198630844, 1126891415, -1416354905, -57434055, 1700485571, -1894986606,
    -1051523, -2054922799, 1873313359, -30611744, -1560198380, 1309151649,
    -145523070, -1120210379, 718787259, -343485551
  ];
  const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];

  for (let i = 0; i < total; i += 16) {
    const oldA = a, oldB = b, oldC = c, oldD = d;
    for (let j = 0; j < 64; j++) {
      let f, g;
      if (j < 16) { f = (b & c) | (~b & d); g = j; }
      else if (j < 32) { f = (d & b) | (~d & c); g = (5 * j + 1) % 16; }
      else if (j < 48) { f = b ^ c ^ d; g = (3 * j + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * j) % 16; }
      const tmp = d;
      d = c; c = b;
      const x = (a + f + K[j] + words[i + g]) | 0;
      b = (b + ((x << S[j % 4]) | (x >>> (32 - S[j % 4])))) | 0;
      a = tmp;
    }
    a = (a + oldA) | 0; b = (b + oldB) | 0; c = (c + oldC) | 0; d = (d + oldD) | 0;
  }

  const hex = n => {
    let out = '';
    for (let i = 0; i < 4; i++) out += ((n >>> (i * 8)) & 0xff).toString(16).padStart(2, '0');
    return out;
  };
  return hex(a) + hex(b) + hex(c) + hex(d);
}

function utf8Bytes(str) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      const c2 = str.charCodeAt(++i);
      c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
      out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

// ---------- zzb 签名（QQ音乐 web 端 musicu.fcg 请求签名） ----------
function zzbSign(text) {
  const h = md5(text).toUpperCase();
  const t1 = [21, 4, 9, 26, 16, 20, 27, 30].map(i => h[i]).join('');
  const t3 = [18, 11, 3, 2, 1, 7, 6, 25].map(i => h[i]).join('');
  const L1 = [212, 45, 80, 68, 195, 163, 163, 203, 157, 220, 254, 91, 204, 79, 104, 6];
  const ls2 = [];
  for (let i = 0; i < 16; i++) {
    const x1 = parseInt(h[i * 2], 16), x2 = parseInt(h[i * 2 + 1], 16);
    ls2.push(((x1 * 16) ^ x2) ^ L1[i]);
  }
  const T = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  const ls3 = [];
  for (let i = 0; i < 6; i++) {
    if (i === 5) ls3.push(T[ls2[15] >> 2], T[(ls2[15] & 3) << 4]);
    else ls3.push(
      T[ls2[i * 3] >> 2],
      T[(ls2[i * 3 + 1] >> 4) ^ ((ls2[i * 3] & 3) << 4)],
      T[(ls2[i * 3 + 2] >> 6) ^ ((ls2[i * 3 + 1] & 15) << 2)],
      T[63 & ls2[i * 3 + 2]]
    );
  }
  const t2 = ls3.join('').replace(/[\\/+=]/g, '');
  return ('zzb' + t1 + t2 + t3).toLowerCase();
}

// ---------- musicu.fcg JSONP ----------
function musicu(payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const cb = 'qqmcb_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    const cleanup = () => { try { delete window[cb]; } catch { window[cb] = undefined; } script.remove(); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('请求超时')); }, 15000);
    window[cb] = d => { clearTimeout(timer); cleanup(); resolve(d); };
    script.onerror = () => { clearTimeout(timer); cleanup(); reject(new Error('网络请求失败')); };
    script.src = 'https://u.y.qq.com/cgi-bin/musicu.fcg?callback=' + cb
      + '&data=' + encodeURIComponent(data)
      + '&sign=' + zzbSign(data);
    document.head.appendChild(script);
  });
}

// ---------- 歌单链接解析与拉取 ----------
const hasCJK = s => /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(s || '');

/** 从任意格式的歌单分享链接 / 纯数字中提取歌单 ID */
export function extractPlaylistId(input) {
  if (!input) return null;
  const s = String(input).trim();
  const m = s.match(/(?:[?&]id=|\/playlist\/)(\d{6,})/) || s.match(/^(\d{6,})$/);
  return m ? m[1] : null;
}

/**
 * 拉取公开歌单（无需登录）
 * @returns {{id, title, songs: Array<{name, singer, album, year}>}}
 */
export async function fetchQQPlaylist(id) {
  const payload = {
    comm: { ct: 19, cv: 1845, uin: 0 },
    req_1: {
      module: 'music.srfDissInfo.aiDissInfo',
      method: 'uniform_get_Dissinfo',
      param: { disstid: Number(id), tag: 1, userinfo: 1, song_begin: 0, song_num: 200, orderlist: 1 }
    }
  };
  const d = await musicu(payload);
  const r = d && d.req_1;
  const data = r && r.data;
  if (!r || r.code !== 0 || !data || !Array.isArray(data.songlist) || !data.songlist.length) {
    throw new Error('读取歌单失败：请确认链接为公开歌单');
  }
  const songs = data.songlist.map(s => ({
    name: s.title || s.name || '',
    singer: (s.singer || []).map(x => x.name).join('、'),
    album: (s.album && (s.album.title || s.album.name)) || '',
    year: s.time_public ? Number(String(s.time_public).slice(0, 4)) : null
  })).filter(s => s.name);
  return { id, title: (data.dirinfo && data.dirinfo.title) || '我的歌单', songs };
}

/**
 * 按关键词搜索公开歌单（用户分享不出链接时的主路径）
 * @returns {Array<{id, title, creator, songCount, listens}>}
 */
export async function searchPlaylists(keyword) {
  const payload = {
    comm: { ct: 19, cv: 1845 },
    req_1: {
      method: 'DoSearchForQQMusicDesktop',
      module: 'music.search.SearchCgiService',
      param: { search_type: 3, query: keyword, page_num: 1, num_per_page: 8 }
    }
  };
  const d = await musicu(payload);
  const r = d && d.req_1;
  const list = r && r.data && r.data.body && r.data.body.songlist && r.data.body.songlist.list;
  if (!r || r.code !== 0 || !Array.isArray(list)) throw new Error('搜索失败，请稍后再试');
  return list.map(p => ({
    id: p.dissid,
    title: p.dissname || '未命名歌单',
    creator: (p.creator && p.creator.name) || '',
    songCount: p.song_count != null ? p.song_count : null,
    listens: p.listennum != null ? p.listennum : null
  })).filter(p => p.id && p.title);
}

// ---------- 真实歌单 → 画像（persona 同构，引擎零改动消费） ----------
/**
 * 把用户真实歌单构建成 persona：
 * - stats：按发行年份分桶（time_public → 年龄轴），构成"那年你N岁，《歌》问世"的年轮
 * - milestones：出镜最多的歌手 / 第一首外语歌 / 置顶单曲 / 单曲循环 / 18岁的歌 / 本命年
 *   ——全部来自真实歌曲信号，未覆盖的节点（注册日/综艺/分享等）留空，不编造
 * @returns {object|null} 无法构建（无有效发行年份）时返回 null
 */
export function buildPlaylistPersona(playlist, birth) {
  const birthYear = birth.year;
  const now = new Date().getFullYear();
  const all = playlist.songs;
  const songs = all.filter(s => s.year && s.year >= birthYear && s.year <= now);
  if (!songs.length) return null;

  const clamp = y => Math.min(now, Math.max(birthYear, y || birthYear));
  const milestones = [];

  // 出镜最多的歌手（真实频次）
  const freq = new Map();
  for (const s of all) if (s.singer) freq.set(s.singer, (freq.get(s.singer) || 0) + 1);
  let topArtist = null, topCount = 0;
  for (const [artist, n] of freq) if (n > topCount) { topArtist = artist; topCount = n; }
  if (topArtist) {
    const earliest = songs.filter(s => s.singer === topArtist).sort((a, b) => a.year - b.year)[0];
    milestones.push({
      type: 'first_follow', artist: topArtist, year: earliest ? earliest.year : birthYear,
      chip: '出镜最多的歌手',
      text: `你的歌单里，${topArtist}出现了${topCount}次——起点这个词，有时比终点重要。`
    });
  }

  // 第一首外语歌（歌名/歌手均不含中日韩文字，取发行最早）
  const foreigns = songs.filter(s => !hasCJK(s.name) && !hasCJK(s.singer));
  if (foreigns.length) {
    const f = foreigns.sort((a, b) => a.year - b.year)[0];
    milestones.push({
      type: 'first_foreign', year: f.year, song: f.name,
      text: `你收藏的第一首外语歌是《${f.name}》——听不懂的那部分，旋律替它说了。`
    });
  }

  // 歌单置顶（第一位）
  const top1 = all[0];
  if (top1) {
    milestones.push({
      type: 'all_time_top', year: clamp(top1.year), song: top1.name, chip: '歌单置顶',
      text: `你的歌单第一位，是《${top1.name}》——排第一这件事，本身就是理由。`
    });
  }

  // 单曲循环（第二位）
  const loop = all[1] || all[0];
  if (loop) {
    milestones.push({
      type: 'first_loop', year: clamp(loop.year), song: loop.name,
      text: `《${loop.name}》，是你很早就放进歌单的那首——循环，是最诚实的喜欢。`
    });
  }

  // 18岁的歌（发行年 = 出生年+18，±2 年内就近）
  const y18 = birthYear + 18;
  const near18 = [...songs].sort((a, b) => Math.abs(a.year - y18) - Math.abs(b.year - y18))[0];
  if (near18 && Math.abs(near18.year - y18) <= 2) {
    milestones.push({
      type: 'adult_18', year: y18, song: near18.name,
      text: near18.year === y18
        ? `18岁那年，《${near18.name}》问世——成年这件事，有时是一首歌先替你说了。`
        : `18岁前后，《${near18.name}》问世——成年这件事，有时是一首歌先替你说了。`
    });
  }

  // 本命年（24 → 36 → 12 岁，就近匹配；避开已被置顶/循环用过的歌，减少重复）
  const used = new Set([all[0] && all[0].name, all[1] && all[1].name].filter(Boolean));
  for (const zy of [birthYear + 24, birthYear + 36, birthYear + 12]) {
    if (zy > now) continue;
    const pool = songs.filter(s => !used.has(s.name));
    const z = [...(pool.length ? pool : songs)].sort((a, b) => Math.abs(a.year - zy) - Math.abs(b.year - zy))[0];
    if (z && Math.abs(z.year - zy) <= 2) {
      milestones.push({
        type: 'zodiac', year: zy, song: z.name,
        text: `${zy - birthYear}岁本命年，《${z.name}》陪你过这一年——十二年一轮回，歌单长出一圈年轮。`
      });
      break;
    }
  }

  // 年轮行：按发行年份分桶（超过 8 行时均匀抽稀，保留首尾）
  const byYear = new Map();
  for (const s of songs) {
    if (!byYear.has(s.year)) byYear.set(s.year, []);
    byYear.get(s.year).push(s);
  }
  let stats = [...byYear.keys()].sort((a, b) => a - b).map(y => {
    const list = byYear.get(y);
    const s = list[0];
    const age = y - birthYear;
    return {
      year: y,
      top_artist: s.singer,
      top_song: s.name,
      plays: null,
      lyric: '',
      note: '',
      text: list.length > 1
        ? `那年你${age}岁，《${s.name}》等${list.length}首歌问世——后来，它们都住进了你的歌单。`
        : `那年你${age}岁，《${s.name}》刚刚问世——后来，它住进了你的歌单。`
    };
  });
  if (stats.length > 8) {
    const picked = [];
    const step = (stats.length - 1) / 7;
    for (let i = 0; i < 8; i++) picked.push(stats[Math.round(i * step)]);
    stats = picked;
  }

  return {
    persona_id: 'playlist_' + playlist.id,
    persona_name: playlist.title,
    level: 'L1',
    mode: 'playlist',
    birth_year: birthYear,
    playlist_title: playlist.title,
    playlist_count: all.length,
    milestones,
    stats
  };
}
