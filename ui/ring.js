// 年轮可视化 v3：把「年轮」的隐喻画清楚
// 1) 不完美圆环（木质抖动）→ 一眼看出是树干截面
// 2) 每 5 年一圈刻度 + 年份标注 → 「一圈=一年」不言自明
// 3) 第 1 圈用 QQ绿 → 呼应「从1开始」
// 4) 径向裂纹 + 树心 → 木材质感
// 个人事件=珊瑚色，歌手事件=蓝色，交织年份=琥珀色放大节点，空白期=灰色

export function renderRing(container, nodes, birthYear, opts = {}) {
  const currentYear = new Date().getFullYear();
  const span = Math.max(currentYear - birthYear, 1);
  const size = 640;
  const cx = size / 2;
  const cy = size / 2;
  const r0 = 42;
  const maxR = size / 2 - 50;
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

  // 有机不完美圆环：真实年轮不是正圆
  const ringPath = (r, phase, amp) => {
    const N = 96;
    let d = '';
    for (let k = 0; k <= N; k++) {
      const th = (k / N) * Math.PI * 2;
      const rr = r + amp * Math.sin(3 * th + phase) + amp * 0.55 * Math.sin(7 * th + phase * 2.3);
      const x = cx + rr * Math.cos(th);
      const y = cy + rr * Math.sin(th);
      d += (k === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return d + ' Z';
  };

  let svg = `<svg viewBox="0 0 ${size} ${size}" role="img" class="ring-svg"><title>音乐年轮</title>`;

  // 木质底色圆盘（浅木色，让年轮立在"树干"上）
  svg += `<circle cx="${cx}" cy="${cy}" r="${maxR + 14}" fill="rgb(243,238,224)"/>`;
  svg += `<circle cx="${cx}" cy="${cy}" r="${maxR + 14}" fill="none" stroke="#D8CFB4" stroke-width="1"/>`;

  // 径向裂纹（木材细节）
  [0.55, 2.35, 4.25].forEach((a, i) => {
    const inner = r0 - 4 + i * 6;
    const x1 = cx + inner * Math.cos(a), y1 = cy + inner * Math.sin(a);
    const x2 = cx + (maxR + 6) * Math.cos(a), y2 = cy + (maxR + 6) * Math.sin(a);
    svg += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgba(138,116,82,.3)" stroke-width=".8"/>`;
  });

  // 年轮环：逐年一圈（有机抖动）
  for (let y = 0; y <= span; y++) {
    const year = birthYear + y;
    const r = r0 + y * step;
    const major = year % 5 === 0;
    const amp = 1.1 + y * 0.06; // 越外圈越不规则
    const phase = y * 1.7;
    const first = y === 0;
    svg += `<path class="ring-yr" data-year="${year}" d="${ringPath(r, phase, amp)}" fill="none"
      stroke="${first ? '#31C27C' : wood(y / span)}" stroke-width="${first ? 2 : major ? 1.6 : 0.8}"
      ${first ? `style="stroke:#31C27C"` : ''}/>`;
  }

  // 每 5 年：顶部刻度 + 年份数字（树轮年代学式读法）
  for (let y = 5; y <= span; y += 5) {
    const year = birthYear + y;
    const r = r0 + y * step;
    svg += `<g class="ring-yr" data-year="${year}">
      <line x1="${cx}" y1="${(cy - r - 4).toFixed(1)}" x2="${cx}" y2="${(cy - r + 4).toFixed(1)}" stroke="#8A7452" stroke-width="1"/>
      <text x="${cx}" y="${(cy - r - 9).toFixed(1)}" text-anchor="middle" font-size="11" fill="#8A7452" font-weight="600">${year}</text>
    </g>`;
  }

  // 第 1 圈标注（呼应「从1开始」）
  {
    const a = -2.28; // 左上对角，避开顶部刻度
    const lx = cx + (r0 + 14) * Math.cos(a);
    const ly = cy + (r0 + 14) * Math.sin(a);
    svg += `<g class="ring-yr" data-year="${birthYear}">
      <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" font-size="11" fill="#1E9E63" font-weight="700">第1圈</text>
    </g>`;
  }

  // 中心树心
  svg += `<circle cx="${cx}" cy="${cy}" r="${(r0 - 12).toFixed(1)}" fill="#AC9870"/>`;
  svg += `<circle cx="${cx}" cy="${cy}" r="${(r0 - 12).toFixed(1)}" fill="none" stroke="#8A7452" stroke-width="1"/>`;
  svg += `<text x="${cx}" y="${cy - 3}" text-anchor="middle" font-size="13" fill="#FFF8E7" font-weight="600">${birthYear}</text>`;
  svg += `<text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="9" fill="#EFE6D2">出生</text>`;

  // 平台锚点标记（固定角度，避免与顶部刻度重叠）
  const markAngle = -Math.PI / 2 + 0.5;
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
