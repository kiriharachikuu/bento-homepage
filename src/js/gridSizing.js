/**
 * Grid 布局辅助：确保每个网格单元是正方形（行高 = 列宽）
 * 通过 CSS 变量 --cell-size 控制行高
 */

export function initGridSizing() {
  const grid = document.querySelector('.grid-container');
  if (!grid) return;

  let rafId = null;

  function update() {
    rafId = null;
    const columns = 4;
    const gridWidth = grid.clientWidth;
    const gap = 16; // 1rem = 16px，与 CSS 中 gap: 1rem 一致
    const totalGap = gap * (columns - 1);
    const cellSize = (gridWidth - totalGap) / columns;
    grid.style.setProperty('--cell-size', `${cellSize}px`);
  }

  function scheduleUpdate() {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(update);
  }

  // 初始计算
  update();

  // 窗口大小变化时重新计算
  window.addEventListener('resize', scheduleUpdate);

  // 字体加载后可能影响尺寸，重新计算一次
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(scheduleUpdate);
  }
}
