// 应用主流程：输入（出生日期 + 可选歌手）→ 双轨叙事 → 结尾（分享 + 承接原型）
// 与 engine 层只通过 generateNarrative() 交互，不 import 其内部模块。

import { generateNarrative } from '../engine/generate.js';
import { extractPlaylistId, fetchQQPlaylist, buildPlaylistPersona, searchPlaylists } from './qqmusic.js';

const state = {
  artistId: null,             // null = 不选歌手，只看我的音乐人生
  birthYear: 2001,
  birthMonth: null,
  birthDay: null,
  persona: null,
  artist: null,
  playlist: null,             // 已连接的真实歌单 {id,title,songs}
  output: null,
  ringCtrl: null,
  scrollHandler: null,
  copy: {},
  templates: {},
  calendar: null
};

const DATA_BASE = new URL('../data', import.meta.url).pathname; // 按脚本位置动态解析，兼容本地根目录与 GitHub Pages 子路径

// ---------- 数据加载 ----------
async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error('load fail: ' + path);
  return res.json();
}

async function bootstrap() {
  state.copy = await loadJson(`${DATA_BASE}/copy.json`);
  state.templates = await loadJson(`${DATA_BASE}/templates.json`);
  state.calendar = await loadJson(`${DATA_BASE}/calendar.json`);
  bindInputScreen();
  document.getElementById('btn-to-input').addEventListener('click', () => showScreen('screen-input'));
}

// ---------- Screen 1: 输入 ----------
function bindInputScreen() {
  const yearSel = document.getElementById('year-select');
  for (let y = 2012; y >= 1970; y--) {
    const o = document.createElement('option');
    o.value = y;
    o.textContent = y + ' 年';
    if (y === 2001) o.selected = true;
    yearSel.appendChild(o);
  }
  yearSel.addEventListener('change', () => (state.birthYear = Number(yearSel.value)));

  // 生日路径：月/日（必填）
  const monthSel = document.getElementById('month-select');
  const daySel = document.getElementById('day-select');
  for (let m = 1; m <= 12; m++) {
    const o = document.createElement('option');
    o.value = m;
    o.textContent = m + ' 月';
    monthSel.appendChild(o);
  }
  for (let d = 1; d <= 31; d++) {
    const o = document.createElement('option');
    o.value = d;
    o.textContent = d + ' 日';
    daySel.appendChild(o);
  }

  const updateBirthState = () => {
    state.birthMonth = monthSel.value ? Number(monthSel.value) : null;
    state.birthDay = daySel.value ? Number(daySel.value) : null;
    const complete = state.birthMonth && state.birthDay;
    document.getElementById('btn-start').disabled = !complete;
    document.getElementById('birth-error').hidden = !!complete;
  };
  monthSel.addEventListener('change', updateBirthState);
  daySel.addEventListener('change', updateBirthState);
  updateBirthState();

  document.getElementById('btn-start').addEventListener('click', startGeneration);

  // QQ音乐 登录 / 注册（Demo 模拟）
  const btnLogin = document.getElementById('btn-login');
  const loginDone = document.getElementById('login-done');
  btnLogin.addEventListener('click', () => {
    if (btnLogin.disabled) return;
    btnLogin.disabled = true;
    btnLogin.textContent = '正在连接……';
    setTimeout(() => {
      btnLogin.hidden = true;
      loginDone.hidden = false;
      state.loggedIn = true;
      document.getElementById('login-brand-sub').textContent = '已连接，正在为你生成专属音乐人生';
    }, 1200);
  });

  // 真实歌单连接（公开接口，无需登录）：搜索歌单名 / 粘贴链接或ID
  const plInput = document.getElementById('pl-link-input');
  const plBtn = document.getElementById('btn-pl-link');
  const plDone = document.getElementById('pl-link-done');
  const plNote = document.getElementById('pl-link-note');
  const plResults = document.getElementById('pl-search-results');

  const fmtPlays = n => {
    if (n >= 1e8) return (n / 1e8).toFixed(1).replace(/\.0$/, '') + '亿';
    if (n >= 1e4) return (n / 1e4).toFixed(1).replace(/\.0$/, '') + '万';
    return String(n);
  };

  const connectPlaylist = async () => {
    const raw = plInput.value.trim();
    if (!raw) {
      plInput.classList.add('err');
      plNote.textContent = '先输入歌单名（或粘贴分享链接）再点搜索。';
      return;
    }
    plInput.classList.remove('err');
    const id = extractPlaylistId(raw);
    if (id) { await connectById(id); return; }
    await doSearch(raw);
  };

  const doSearch = async keyword => {
    plBtn.disabled = true;
    plBtn.textContent = '搜索中';
    plNote.textContent = '正在搜索QQ音乐歌单……';
    plResults.innerHTML = '';
    try {
      const hits = await searchPlaylists(keyword);
      if (!hits.length) {
        plNote.textContent = '没有搜到这个歌单——换个关键词试试，或直接粘贴歌单链接/ID。';
        return;
      }
      plNote.textContent = '点一个你常听的歌单进行连接：';
      plResults.innerHTML = hits.map(p => `
        <button class="pl-hit" data-id="${p.id}">
          <span class="pl-hit-name">${p.title}</span>
          <span class="pl-hit-meta">${p.creator || 'QQ音乐用户'}${p.songCount ? ' · ' + p.songCount + '首' : ''}${p.listens ? ' · ' + fmtPlays(p.listens) + '次播放' : ''}</span>
        </button>`).join('');
      plResults.querySelectorAll('.pl-hit').forEach(btn => {
        btn.addEventListener('click', () => connectById(btn.dataset.id));
      });
    } catch (e) {
      plNote.textContent = '搜索失败：' + (e.message || '请稍后再试') + '。也可以粘贴歌单链接或ID。';
    } finally {
      plBtn.disabled = false;
      plBtn.textContent = '搜索';
    }
  };

  const connectById = async id => {
    plBtn.disabled = true;
    plBtn.textContent = '连接中';
    plNote.textContent = '正在读取歌单……';
    plResults.innerHTML = '';
    try {
      const pl = await fetchQQPlaylist(id);
      state.playlist = pl;
      plInput.hidden = true;
      plBtn.hidden = true;
      plNote.textContent = '歌单已连接——下面的生成将使用这些真实的歌。';
      document.getElementById('pl-link-title').textContent = `已连接《${pl.title}》 · ${pl.songs.length}首`;
      plDone.hidden = false;
    } catch (e) {
      plNote.textContent = '连接失败：' + (e.message || '请稍后再试') + '。也可以不连接，直接用示例画像生成。';
    } finally {
      plBtn.disabled = false;
      plBtn.textContent = '搜索';
    }
  };

  plBtn.addEventListener('click', connectPlaylist);
  plInput.addEventListener('keydown', e => { if (e.key === 'Enter') connectPlaylist(); });
  document.getElementById('btn-pl-unlink').addEventListener('click', () => {
    state.playlist = null;
    plDone.hidden = true;
    plResults.innerHTML = '';
    plInput.hidden = false;
    plBtn.hidden = false;
    plBtn.disabled = false;
    plBtn.textContent = '搜索';
    plInput.value = '';
    plNote.textContent = '输入歌单名搜索QQ音乐公开歌单，选一个你常听的；也支持粘贴分享链接或歌单ID。';
  });
}

function currentLevel() {
  const p = new URLSearchParams(location.search).get('level');
  if (p === '3') return 'L3';
  if (p === '2') return 'L2';
  return state.persona?.level || 'L1';
}

// 画像选择：仅根据出生年匹配 Demo 画像（不再选歌手）
async function pickPersona(level) {
  if (level === 'L3') return null;
  if (level === 'L2') return loadJson(`${DATA_BASE}/personas/persona_p3_mid.json`);
  if (state.birthYear === 1999) return loadJson(`${DATA_BASE}/personas/persona_p2_bigbang.json`);
  if (state.birthYear === 2001) return loadJson(`${DATA_BASE}/personas/persona_p1_jay.json`);
  if (state.birthYear < 2000) return loadJson(`${DATA_BASE}/personas/persona_p2_bigbang.json`);
  return loadJson(`${DATA_BASE}/personas/persona_p1_jay.json`);
}

async function startGeneration() {
  // 出生年月日未选全：不允许进入下一屏
  if (!state.birthMonth || !state.birthDay) {
    document.getElementById('birth-error').hidden = false;
    document.getElementById('month-select').focus();
    return;
  }
  const level = currentLevel();
  state.artist = null;
  // 已连接真实歌单 → 从真实歌曲构建画像；否则回退预置画像
  let persona = null;
  if (state.playlist) {
    persona = buildPlaylistPersona(state.playlist, { year: state.birthYear, month: state.birthMonth, day: state.birthDay });
  }
  if (!persona) persona = await pickPersona(level);
  state.persona = persona;

  showScreen('screen-loading');
  const t0 = Date.now();
  try {
    state.output = await generateNarrative({
      persona: state.persona,
      artist: state.artist,
      calendar: state.calendar,
      birthYear: state.birthYear,
      birth: { year: state.birthYear, month: state.birthMonth, day: state.birthDay },
      templates: state.templates
    });
  } catch (e) {
    alert('生成失败：' + e.message + '\n（提示：请用本地 HTTP 服务打开，而非 file://）');
    showScreen('screen-input');
    return;
  }
  // 等待动画至少 2.4s，掩盖生成
  const wait = Math.max(0, 2400 - (Date.now() - t0));
  setTimeout(() => {
    buildNarrativeScreen();
    showScreen('screen-narrative');
  }, wait);
}

// ---------- Screen 3: 音乐汇总歌单（我的音乐人生） ----------
// 文案一句一行：按句号/问号/感叹号切分（兼容不支持 lookbehind 的浏览器）
function oneSentencePerLine(t) {
  if (!t) return '';
  const parts = t.split(/([。！？])/);
  let out = '';
  for (let i = 0; i < parts.length; i += 2) {
    const s = (parts[i] + (parts[i + 1] || '')).trim();
    if (s) out += (out ? '<br>' : '') + s;
  }
  return out;
}

function buildNarrativeScreen() {
  const { results, nodes } = state.output;
  const artistName = state.artist?.artist_name || null;

  document.getElementById('pl-cover-year').textContent = state.birthYear;
  if (state.persona && state.persona.mode === 'playlist') {
    document.getElementById('pl-title').textContent = `你的这些年，都在你的歌里`;
    document.getElementById('pl-sub').textContent =
      `${state.birthYear}年出生 · 来自你的QQ音乐歌单《${state.persona.playlist_title}》 · ${state.persona.playlist_count}首歌`;
  } else {
    document.getElementById('pl-title').textContent = artistName
      ? `你的这些年 × ${artistName}`
      : '你的这些年，都在歌里';
    document.getElementById('pl-sub').textContent =
      `${state.birthYear}年出生 · ${state.copy.level_badge[currentLevel()]}`;
  }

  const rows = results
    .map((r, i) => ({ r, node: nodes[i] }))
    .filter(x => x.r.me && x.node);

  let no = 0;
  const items = rows.map(({ r, node }) => {
    const me = r.me;
    const year = node.year;
    const m = node.milestone || {};

    if (me.type === 'milestone' || me.type === 'birth' || me.type === 'context' || me.type === 'era') {
      no++;
      const chip = me.chip
        || (me.type === 'birth' ? '出生那一天' : me.type === 'era' ? '时代背景' : '出生那一年');
      const song = m.song || (me.text.match(/《([^》]+)》/) || [])[1] || null;
      return { no, chip, year, title: song || chip, sub: me.text, plays: m.plays || null, hasSong: !!song };
    }
    if (me.type === 'stat' || me.type === 'join') {
      no++;
      return {
        no, chip: me.type === 'join' ? '相遇QQ音乐' : '年度最热',
        year, title: me.song || '那一年', sub: me.insight || '', plays: me.plays || null, hasSong: !!me.song
      };
    }
    return null;
  }).filter(Boolean);

  document.getElementById('pl-list').innerHTML = items.map(it => `
    <div class="pl-row">
      <div class="pl-no">${String(it.no).padStart(2, '0')}</div>
      <div class="pl-info">
        <div class="pl-name">${it.hasSong ? `《${it.title}》` : it.title}</div>
        <div class="pl-chip">${it.chip}</div>
        <div class="pl-sub-line">${oneSentencePerLine(it.sub)}</div>
      </div>
      <div class="pl-side">
        ${it.plays ? `<span class="pl-plays">循环 ${it.plays} 次</span>` : ''}
        <span class="pl-year">${it.year}</span>
      </div>
    </div>`).join('');

  document.getElementById('pl-footer').textContent =
    `共 ${items.length} 首 · ${state.birthYear}年${state.birthMonth}月${state.birthDay}日出生的你`;
  document.getElementById('btn-tl-done').onclick = buildEndingScreen;

  // 逐行渐显
  const els = [...document.querySelectorAll('.pl-row')];
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('vis'); io.unobserve(e.target); } });
    }, { threshold: 0.1 });
    els.forEach(r => io.observe(r));
  } else {
    els.forEach(r => r.classList.add('vis'));
  }
}

// 最后页金句排版：按引号识别歌词，歌词单独加手写字体+粗体，其余按逗号/句末分行
function formatQuote(text) {
  if (!text) return '';
  // 把引号后面的句末标点前移到引号内，避免“…”后单独出现一行句号
  text = text.replace(/”([。！？])/g, '$1”');

  // 按“……”把歌词切出来，其余为旁白
  const tokens = [];
  let s = 0;
  while (true) {
    const o = text.indexOf('“', s);
    if (o === -1) { tokens.push({ t: text.slice(s), lyric: false }); break; }
    if (o > s) tokens.push({ t: text.slice(s, o), lyric: false });
    const c = text.indexOf('”', o + 1);
    if (c === -1) { tokens.push({ t: text.slice(o), lyric: false }); break; }
    tokens.push({ t: text.slice(o + 1, c), lyric: true });
    s = c + 1;
  }

  return tokens.map(({ t, lyric }) => {
    const parts = t.split(/([，。！？])/);
    const lines = [];
    let cur = '';
    for (let i = 0; i < parts.length; i += 2) {
      cur += (parts[i] || '') + (parts[i + 1] || '');
      if (parts[i + 1]) { lines.push(cur.trim()); cur = ''; }
    }
    if (cur.trim()) lines.push(cur.trim());

    if (lyric && lines.length) {
      lines[0] = '“' + lines[0];
      lines[lines.length - 1] = lines[lines.length - 1] + '”';
      return lines.map(l => `<span class="lyric-hand">${l}</span>`).join('<br>');
    }
    return lines.join('<br>');
  }).join('<br>');
}

// ---------- Screen 4: QQ音乐 · 推荐音乐小组 ----------
function buildEndingScreen() {
  const { endingQuote } = state.output;

  const rawQuote = endingQuote || state.copy.ending_pool[0];
  document.getElementById('ending-quote').innerHTML = formatQuote(rawQuote);
  const who = state.artist
    ? `${state.artist.artist_name} × ${state.birthYear} 年出生的你`
    : `我的音乐人生 × ${state.birthYear} 年出生的你`;
  document.getElementById('ending-sub').innerHTML =
    `<div class="sub-line">${who}</div>` +
    `<div class="sub-line sub-dim">QQ音乐根据你的歌单，为你找到这些同好</div>`;

  document.getElementById('group-grid').innerHTML = buildGroups().map(g => `
    <div class="group-card">
      <div class="group-head">
        <div class="group-avatar">${g.icon}</div>
        <div class="group-meta">
          <div class="group-name">${g.name}</div>
          <div class="group-tag">${g.tag}</div>
        </div>
      </div>
      <div class="group-desc">${g.desc.split('，').join('，<br>')}</div>
      <button class="group-join">加入小组</button>
    </div>`).join('');

  document.querySelectorAll('.group-join').forEach(btn => {
    btn.addEventListener('click', () => {
      const joined = btn.classList.toggle('joined');
      btn.textContent = joined ? '已加入' : '加入小组';
    });
  });

  document.getElementById('btn-share').onclick = exportCard;
  document.getElementById('btn-restart').onclick = () => showScreen('screen-input');
  showScreen('screen-ending');
}

// 从画像数据推导推荐小组（全部基于真实数据，不编造成员数）
function buildGroups() {
  const groups = [];
  const artistName = state.artist?.artist_name;
  const ms = state.persona?.milestones || [];
  const find = t => ms.find(m => m.type === t);

  if (artistName) {
    groups.push({
      icon: '♫', name: `${artistName}·听友会`, tag: '本命歌手',
      desc: '和你一样，这些年一直把他放在歌单里的人。'
    });
  }
  groups.push({
    icon: '★', name: `${state.birthYear}年出生联盟`, tag: '同龄同好',
    desc: '同年出生的人，童年的BGM天然重合。'
  });
  const top = find('all_time_top') || find('first_loop');
  if (top) {
    groups.push({
      icon: '↻', name: '单曲循环研究所', tag: '循环控',
      desc: top.plays
        ? `《${top.song}》被你循环了 ${top.plays} 次，这里的人都懂。`
        : `《${top.song}》被你放在了歌单最前排，这里的人都懂这种循环。`
    });
  }
  const foreign = find('first_foreign');
  if (foreign) {
    groups.push({
      icon: '◐', name: '外语歌探索小组', tag: '新声音',
      desc: `从《${foreign.song}》开始听外语歌的人，都在这个小组。`
    });
  } else {
    const genre = find('first_new_genre');
    if (genre) {
      groups.push({
        icon: '◐', name: '新风格实验室', tag: '尝鲜派',
        desc: `你第一次接触的${genre.genre || '新风格'}，在这里有一群同好。`
      });
    }
  }
  const follow = find('first_chart_top') || find('first_follow');
  if (follow && follow.artist && groups.length < 4) {
    groups.push({
      icon: '♥', name: `${follow.artist}·粉丝团`, tag: '歌手榜',
      desc: '第一个登上你歌手榜的人，他的粉丝群在等你。'
    });
  }
  return groups.slice(0, 4);
}

// 分享卡片：SVG 序列化 → canvas → PNG（规避微信 canvas.toDataURL 部分兼容问题：先走 svg 路径）
function exportCard() {
  const quote = document.getElementById('ending-quote').textContent;
  const svg = buildCardSvg(quote);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 750;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#F1EFE8';
    ctx.fillRect(0, 0, 750, 1000);
    ctx.drawImage(img, 0, 0, 750, 1000);
    URL.revokeObjectURL(url);
    const a = document.createElement('a');
    a.download = `音乐歌单-${state.birthYear}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };
  img.onerror = () => window.open(url); // 兜底：直接打开 svg
  img.src = url;
}

function buildCardSvg(quote) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const who = state.artist
    ? `${state.artist.artist_name} × ${state.birthYear} 年出生的你`
    : `我的音乐人生 × ${state.birthYear} 年出生的你`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="750" height="1000" viewBox="0 0 750 1000">
    <rect width="750" height="1000" fill="#F1EFE8"/>
    <text x="375" y="140" text-anchor="middle" font-size="30" fill="#444441">音乐歌单</text>
    <text x="375" y="180" text-anchor="middle" font-size="16" fill="#888780">${esc(who)}</text>
    <line x1="280" y1="220" x2="470" y2="220" stroke="#B4B2A9" stroke-width="1"/>
    <text x="375" y="360" text-anchor="middle" font-size="26" fill="#2C2C2A">${esc(quote)}</text>
    <text x="375" y="920" text-anchor="middle" font-size="14" fill="#888780">QQ音乐 · 音乐歌单</text>
    <text x="375" y="945" text-anchor="middle" font-size="11" fill="#B4B2A9">内容由 AI 生成</text>
  </svg>`;
}

// ---------- Screen 切换 ----------
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

bootstrap().catch(e => {
  document.body.innerHTML = `<div style="padding:40px;text-align:center;color:#993C1D">
    数据加载失败：${e.message}<br><br>请用本地服务打开：<code>python3 -m http.server</code>
  </div>`;
});
