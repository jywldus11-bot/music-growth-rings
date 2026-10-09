// 应用主流程：输入（出生日期 + 可选歌手）→ 双轨叙事 → 结尾（分享 + 承接原型）
// 与 engine 层只通过 generateNarrative() 交互，不 import 其内部模块。

import { generateNarrative } from '../engine/generate.js';
import { renderRing } from './ring.js';
import { getConfig, saveConfig, isConfigured } from '../llm/adapter.js';

const state = {
  artistId: null,             // null = 不选歌手，只看我的音乐人生
  birthYear: 2001,
  birthMonth: null,
  birthDay: null,
  persona: null,
  artist: null,
  output: null,
  ringCtrl: null,
  scrollHandler: null,
  copy: {},
  templates: {},
  calendar: null
};

const DATA_BASE = '../data'; // 相对 src/index.html 解析

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
  const artists = ['jay_chou', 'bigbang'];
  state.artistMap = {};
  for (const id of artists) {
    state.artistMap[id] = await loadJson(`${DATA_BASE}/artists/${id}.json`);
  }
  bindInputScreen();
  updateLlmBadge();
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

  // 生日路径：月/日（可选）
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
  monthSel.addEventListener('change', () => (state.birthMonth = monthSel.value ? Number(monthSel.value) : null));
  daySel.addEventListener('change', () => (state.birthDay = daySel.value ? Number(daySel.value) : null));

  document.querySelectorAll('.artist-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.artist-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.artistId = card.dataset.artist;
    });
  });

  document.getElementById('btn-no-artist').addEventListener('click', () => {
    document.querySelectorAll('.artist-card').forEach(c => c.classList.remove('selected'));
    state.artistId = null;
  });

  document.getElementById('btn-start').addEventListener('click', startGeneration);
  document.getElementById('btn-llm').addEventListener('click', openLlmModal);
  document.getElementById('btn-llm-save').addEventListener('click', saveLlmConfig);
  document.getElementById('btn-llm-close').addEventListener('click', closeLlmModal);
}

function currentLevel() {
  const p = new URLSearchParams(location.search).get('level');
  if (p === '3') return 'L3';
  if (p === '2') return 'L2';
  return state.persona?.level || 'L1';
}

// 画像选择：优先跟歌手；不选歌手时按出生年兜底（Demo 仅有两份画像）
async function pickPersona(level) {
  if (level === 'L3') return null;
  if (level === 'L2') return loadJson(`${DATA_BASE}/personas/persona_p3_mid.json`);
  if (state.artistId) {
    const pid = state.artistId === 'jay_chou' ? 'persona_p1_jay' : 'persona_p2_bigbang';
    return loadJson(`${DATA_BASE}/personas/${pid}.json`);
  }
  if (state.birthYear === 2001) return loadJson(`${DATA_BASE}/personas/persona_p1_jay.json`);
  if (state.birthYear === 1999) return loadJson(`${DATA_BASE}/personas/persona_p2_bigbang.json`);
  return null;
}

async function startGeneration() {
  const level = currentLevel();
  state.artist = state.artistId ? state.artistMap[state.artistId] : null;
  state.persona = await pickPersona(level);

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

// ---------- Screen 3: 双轨叙事（我的音乐人生 × 他的音乐人生） ----------
function buildNarrativeScreen() {
  const { results, nodes } = state.output;
  const artistName = state.artist?.artist_name || null;

  const badgeHim = document.getElementById('tl-badge-him');
  if (artistName) {
    badgeHim.style.display = '';
    badgeHim.textContent = `他的音乐人生 · ${artistName}`;
  } else {
    badgeHim.style.display = 'none';
  }

  state.ringCtrl = renderRing(document.getElementById('narrative-ring'), nodes, state.birthYear, {
    joinYear: state.persona?.platform_join_year || null
  });

  const tl = document.getElementById('timeline');
  tl.innerHTML = results
    .map((r, i) => buildRow(r, nodes[i], artistName))
    .join('');

  const rows = [...tl.querySelectorAll('.tl-row')];
  const rowTops = rows.map(row => row.getBoundingClientRect().top + window.scrollY);

  // 滚动驱动：年轮随阅读进度生长 + 当前行高亮
  if (state.scrollHandler) window.removeEventListener('scroll', state.scrollHandler);
  state.scrollHandler = () => {
    const probe = window.scrollY + window.innerHeight * 0.45;
    let idx = 0;
    rowTops.forEach((top, i) => { if (top + 80 < probe) idx = i; });
    state.ringCtrl && state.ringCtrl.setProgress(Math.min(idx, rows.length - 1));
    rows.forEach((row, i) => row.classList.toggle('now', i === idx));
  };
  window.addEventListener('scroll', state.scrollHandler, { passive: true });
  state.scrollHandler();

  // 入场渐显
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('vis'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    rows.forEach(r => io.observe(r));
  } else {
    rows.forEach(r => r.classList.add('vis'));
  }

  document.getElementById('btn-tl-done').onclick = buildEndingScreen;
}

function ageText(age) {
  if (age === 0) return '出生';
  if (age < 0) return '';
  return age + '岁';
}

function buildRow(r, node, artistName) {
  const spine = `<div class="tl-spine"><div class="tl-year">${node.year}</div><div class="tl-age">${ageText(node.age)}</div></div>`;

  // LLM 模式或双轨皆空：整行通栏文案
  if (!r.me && !r.him) {
    return `<div class="tl-row">
      ${spine}
      <div class="tl-cell band"><div class="tl-chip neutral">那年</div><div class="tl-band-text">${r.text}</div></div>
    </div>`;
  }

  // 我的音乐人生（左轨）
  let meCell = '';
  if (r.me) {
    if (r.me.type === 'birth') {
      meCell = `<div class="tl-cell me"><div class="tl-chip">我的 · 出生那天</div><div class="tl-me-text">${r.me.text}</div></div>`;
    } else if (r.me.type === 'context') {
      meCell = `<div class="tl-cell me"><div class="tl-chip">我的 · 出生那年</div><div class="tl-me-text">${r.me.text}</div></div>`;
    } else if (r.me.type === 'era') {
      meCell = `<div class="tl-cell me"><div class="tl-chip">我的 · 时代</div><div class="tl-me-text">${r.me.text}</div></div>`;
    } else {
      const joinBadge = r.me.type === 'join'
        ? `<div class="tl-join-flag">♫ 这一年，你遇见了QQ音乐</div>` : '';
      const song = r.me.song
        ? `<div class="tl-song">《${r.me.song}》<span class="tl-plays">循环 ${r.me.plays} 次</span></div>` : '';
      const lyric = r.me.lyric ? `<div class="tl-lyric">“${r.me.lyric}”</div>` : '';
      const insight = r.me.insight ? `<div class="tl-insight">${r.me.insight}</div>` : '';
      meCell = `<div class="tl-cell me"><div class="tl-chip">我的${node.kind === 'join' ? ' · 起点' : ''}</div>${joinBadge}${song}${lyric}${insight}</div>`;
    }
  }

  // 他的音乐人生（右轨）
  let himCell = '';
  if (r.him) {
    if (r.him.type === 'prologue') {
      himCell = `<div class="tl-cell him"><div class="tl-chip">他的 · 相遇之前</div><div class="tl-him-text">${r.him.text}</div></div>`;
    } else if (r.him.type === 'gap') {
      himCell = `<div class="tl-cell him gap"><div class="tl-chip">他的 · 空白期</div><div class="tl-him-text">${r.him.text}</div></div>`;
    } else {
      // 同一首歌（我年度歌曲=他当年作品）时歌词只引一次，避免左右重复
      const dup = r.me && r.me.lyric && r.him.lyric === r.me.lyric;
      const lyric = r.him.lyric && !dup ? `<div class="tl-lyric">“${r.him.lyric}”</div>` : '';
      himCell = `<div class="tl-cell him"><div class="tl-chip">他的${artistName ? ' · ' + artistName : ''}</div><div class="tl-him-text">${r.him.event}</div>${lyric}</div>`;
    }
  }

  // 单轨占满内容区，双轨各占一列
  const meOnly = meCell && !himCell;
  const himOnly = himCell && !meCell;
  if (meOnly) meCell = meCell.replace('tl-cell me"', 'tl-cell me only"');
  if (himOnly) himCell = himCell.replace('tl-cell him"', 'tl-cell him only"');

  return `<div class="tl-row">${spine}${meCell}${himCell}</div>`;
}

// ---------- Screen 4: 结尾 ----------
function buildEndingScreen() {
  const { endingQuote, mode, nodes } = state.output;
  const overlap = 72 + (state.persona ? state.persona.stats.length * 2 : 0);

  document.getElementById('ending-quote').textContent = endingQuote || state.copy.ending_pool[0];
  const who = state.artist
    ? `${state.artist.artist_name} × ${state.birthYear} 年出生的你`
    : `我的音乐人生 × ${state.birthYear} 年出生的你`;
  document.getElementById('ending-sub').textContent =
    `${who} · ${state.copy.level_badge[currentLevel()]} · ${mode === 'llm' ? state.copy.llm_mode_llm : state.copy.llm_mode_template}`;

  renderRing(document.getElementById('ending-ring'), nodes, state.birthYear, {
    joinYear: state.persona?.platform_join_year || null
  });

  document.getElementById('ending-group-card').innerHTML = `
    <div class="card">
      <div class="card-title">${state.copy.group_card_title}</div>
      <div class="card-body">${state.copy.group_card_reason}</div>
    </div>
    <div class="card">
      <div class="card-title">${state.copy.room_card_title}</div>
      <div class="card-body">${state.copy.room_card_reason.replace('{overlap}', overlap)}</div>
    </div>`;

  document.getElementById('btn-share').onclick = exportCard;
  document.getElementById('btn-restart').onclick = () => showScreen('screen-input');
  showScreen('screen-ending');
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
    a.download = `音乐年轮-${state.birthYear}.png`;
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
    <text x="375" y="140" text-anchor="middle" font-size="30" fill="#444441">音乐年轮</text>
    <text x="375" y="180" text-anchor="middle" font-size="16" fill="#888780">${esc(who)}</text>
    <line x1="280" y1="220" x2="470" y2="220" stroke="#B4B2A9" stroke-width="1"/>
    <text x="375" y="360" text-anchor="middle" font-size="26" fill="#2C2C2A">${esc(quote)}</text>
    <text x="375" y="920" text-anchor="middle" font-size="14" fill="#888780">QQ音乐 · 音乐年轮</text>
    <text x="375" y="945" text-anchor="middle" font-size="11" fill="#B4B2A9">内容由 AI 生成</text>
  </svg>`;
}

// ---------- LLM 设置 ----------
function openLlmModal() {
  const c = getConfig() || {};
  document.getElementById('llm-baseurl').value = c.baseUrl || '';
  document.getElementById('llm-model').value = c.model || '';
  document.getElementById('llm-apikey').value = c.apiKey || '';
  document.getElementById('llm-modal').classList.add('show');
}
function closeLlmModal() {
  document.getElementById('llm-modal').classList.remove('show');
}
function saveLlmConfig() {
  saveConfig({
    baseUrl: document.getElementById('llm-baseurl').value.trim(),
    model: document.getElementById('llm-model').value.trim(),
    apiKey: document.getElementById('llm-apikey').value.trim()
  });
  updateLlmBadge();
  closeLlmModal();
}
function updateLlmBadge() {
  document.getElementById('llm-badge').textContent = isConfigured()
    ? state.copy.llm_mode_llm
    : state.copy.llm_mode_template;
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
