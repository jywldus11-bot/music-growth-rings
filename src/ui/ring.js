// 年轮可视化 v2：木质年轮 + 生长动画（随叙事进度逐年长出）+ 平台锚点标记
// 个人事件=珊瑚色，歌手事件=蓝色，交织年份=琥珀色放大节点，空白期=灰色

export function renderRing(container, nodes, birthYear, opts = {}) {
  const currentYear = new Date().getFullYear();
  const span = Math.max(currentYear - birthYear, 1);
  const size = 640;
  const cx = size / 2;
  const cy = size / 2;
  const r0 = 40;
  const maxR = size / 2 - 46;
  const step = (maxR - r0) / span;
  const qqBorn = opts.qqBorn || 2005; // QQ音乐诞生年（公开事实）
  const joinYear = opts.joinYear || null;

  // 木质色调：内浅外深，像真实树干截面
  const wood = t => {
    const c1 = [235, 230, 216];
    const c2 = [172, 152, 112];
    const c = c1.map((v, i) => Math.round(v + (c2[i] - v) * t));
    return `rgb(${c.join(',')})`;
  };

  let svg = `<svg viewBox="0 0 ${size} ${size}" role="img" class="ring-svg"><title>音乐年轮</title>`;

  // 年轮环：逐年一圈
  for (let y = 0; y <= span; y++) {
    const year = birthYear + y;
    const r = r0 + y * step;
    const major = year % 5 === 0;
    svg += `<circle class="ring-yr" data-year="${year}" cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="none" stroke="${wood(y / span)}" stroke-width="${major ? 1.6 : 0.8}"/>`;
  }

  // 中心树心
  svg += `<circle cx="${cx}" cy="${cy}" r="${(r0 - 8).toFixed(1)}" fill="#AC9870"/>`;
  svg += `<circle cx="${cx}" cy="${cy}" r="${(r0 - 8).toFixed(1)}" fill="none" stroke="#8A7452" stroke-width="1"/>`;
  svg += `<text x="${cx}" y="${cy - 3}" text-anchor="middle" font-size="13" fill="#FFF8E7" font-weight="600">${birthYear}</text>`;
  svg += `<text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="9" fill="#EFE6D2">出生</text>`;

  // 平台锚点标记（固定角度，避免与事件节点重叠）
  const markAngle = -Math.PI / 2 + 0.45;
  const marker = (year, label, color) => {
    const y = year - birthYear;
    if (y < 1 || y > span) return;
    const r = r0 + y * step;
    const x = cx + r * Math.cos(markAngle);
    const yy = cy + r * Math.sin(markAngle);
    svg += `<g class="ring-yr" data-year="${year}">
      <circle cx="${x.toFixed(1)}" cy="${yy.toFixed(1)}" r="4.5" fill="${color}" stroke="#fff" stroke-width="1.2"/>
      <text x="${x.toFixed(1)}" y="${(yy - 11).toFixed(1)}" text-anchor="middle" font-size="10" fill="${color}" font-weight="600">${label}</text>
    </g>`;
  };
  marker(qqBorn, 'QQ音乐诞生', '#185FA5');
  if (joinYear && joinYear !== qqBorn) marker(joinYear, '你们相遇', '#993C1D');

  // 事件节点
  nodes.forEach((node, i) => {
    const idx = node.year - birthYear;
    const r = r0 + Math.min(Math.max(idx, 0), span) * step;
    const month = node.artistEvent?.month || node.personal?.month || 6;
    const angle = (month / 12) * Math.PI * 2 - Math.PI / 2 + (i % 5) * 0.12;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    const c =
      node.kind === 'cross' ? '#BA7517' : node.kind === 'gap' ? '#B4B2A9' : node.personal ? '#993C1D' : '#185FA5';
    const big = node.kind === 'cross' ? 7.5 : 5;
    svg += `<g class="ring-node ring-yr" data-year="${node.year}" data-idx="${i}" style="cursor:pointer">
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${big}" fill="${c}" stroke="#fff" stroke-width="1.5">
        <title>${node.year}：${node.artistEvent?.event || node.personal?.top_song || node.eraEntry?.title || node.birthMatch?.level ? node.artistEvent?.event || node.personal?.top_song || node.eraEntry?.title || '出生那天的音乐' : ''}</title>
      </circle>
    </g>`;
  });

  svg += `</svg>`;
  container.innerHTML = svg;

  container.querySelectorAll('.ring-node').forEach(el => {
    el.addEventListener('click', () => opts.onNodeClick && opts.onNodeClick(Number(el.dataset.idx)));
  });

  // 生长进度控制：叙事推进到第 i 年时，年轮长到那一年
  function setProgress(i) {
    const year = i >= 0 && nodes[i] ? nodes[i].year : birthYear;
    container.querySelectorAll('.ring-yr').forEach(el => {
      const y = Number(el.dataset.year);
      el.classList.toggle('grown', y <= year + 1);
    });
  }
  setProgress(nodes.length - 1);
  return { setProgress };
}
