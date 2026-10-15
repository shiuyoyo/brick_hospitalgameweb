import React from 'react';

const COLORS = { red: '#fb6669', yellow: '#ffd568', blue: '#70bbf5', green: '#55dca4' };
const SHAPES = ['hexagon', 'rect', 'triangle', 'square', 'circle'];

function Shape({ type, fill }) {
  const common = { fill, stroke: '#9aa9bd', strokeWidth: 3 };
  return <svg viewBox="0 0 100 100" aria-hidden="true">
    {type === 'circle' ? <circle cx="50" cy="50" r="38" {...common} /> :
      type === 'triangle' ? <polygon points="50,9 91,84 9,84" {...common} /> :
      type === 'hexagon' ? <polygon points="50,8 84,28 84,72 50,92 16,72 16,28" {...common} /> :
      type === 'rect' ? <rect x="24" y="8" width="52" height="84" rx="9" {...common} /> :
      <rect x="12" y="12" width="76" height="76" rx="9" {...common} />}
  </svg>;
}

export default function LiveGameBoard({ action, status }) {
  if (!action) return <div className="live-board-empty">配對後開始遊戲，圖案會在這裡同步顯示。</div>;
  const payload = action.payload || {};
  const game = payload.gameLayout || action.game_key || 'multi_color';
  const rawIndex = Number(payload.activeIndex ?? payload.currentIndex ?? payload.progress ?? 0);
  const total = game === 'thin_circle' ? 30 : 15;
  const active = Number.isFinite(rawIndex) ? Math.max(0, Math.floor(rawIndex)) % total : 0;
  const shapeGame = game.startsWith('shapes');
  const ended = status === 'ended' || payload.ended === true || action.action_type === 'end';
  return <section className="live-board" aria-label="積木即時遊戲畫面">
    <div className="live-board-heading"><strong>{action.level_name || (shapeGame ? '圖形關卡' : game === 'thin_circle' ? '細圓關卡' : '圓柱關卡')}</strong><span>{ended ? '本局已完成' : `第 ${active + 1} 個位置 / 共 ${total} 個`}</span></div>
    <div className={`live-board-grid ${game === 'thin_circle' ? 'thin' : ''}`}>
      {Array.from({ length: total }, (_, index) => {
        const item = payload.items?.[index] || payload.items?.[index % (payload.items?.length || 1)] || {};
        const highlighted = !ended && index === active;
        const fill = highlighted ? (COLORS[item.color] || item.color || '#fb6669') : '#ffffff';
        return <div key={index} className={`live-board-cell ${highlighted ? 'active' : ''}`}>
          {shapeGame ? <Shape type={item.type || SHAPES[index % 5]} fill={fill} /> : <span className="live-board-circle" style={{ background: fill }} />}
        </div>;
      })}
    </div>
    <div className="live-board-foot">{ended ? '等待下一次訓練' : '圖案依平板目前位置即時更新'} · 分數 {payload.score ?? 0} · 錯誤 {payload.mistakes ?? 0}</div>
  </section>;
}
