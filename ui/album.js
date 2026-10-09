// 黑胶唱片视觉（Demo 阶段的专辑视觉替身）
// 正式产品：替换为平台 CDN 专辑封面图 URL（QQ音乐曲库资源），此处用 SVG 黑胶规避版权依赖
export function albumDisc(name, year, hue = '#BA7517', spin = true) {
  const safe = String(name || '').slice(0, 7);
  const cls = spin ? 'album-disc spin' : 'album-disc';
  return `<svg viewBox="0 0 120 120" class="${cls}" role="img" aria-label="${name || ''}">
    <circle cx="60" cy="60" r="58" fill="#26221B"/>
    <circle cx="60" cy="60" r="53" fill="none" stroke="#3A342A" stroke-width="0.8"/>
    <circle cx="60" cy="60" r="46" fill="none" stroke="#3A342A" stroke-width="0.6"/>
    <circle cx="60" cy="60" r="40" fill="none" stroke="#312B22" stroke-width="0.5"/>
    <circle cx="60" cy="60" r="30" fill="${hue}"/>
    <circle cx="60" cy="60" r="30" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="1"/>
    <text x="60" y="55" text-anchor="middle" font-size="9.5" fill="#FFF8E7" font-weight="500">${safe}</text>
    <text x="60" y="69" text-anchor="middle" font-size="8" fill="#F5EBD8">${year}</text>
    <circle cx="60" cy="60" r="3.2" fill="#26221B"/>
    <circle cx="60" cy="60" r="3.2" fill="none" stroke="#F5EBD8" stroke-width="0.6"/>
  </svg>`;
}
