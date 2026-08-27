/**
 * Grid 布局辅助：确保每个网格单元是正方形（行高 = 列宽）
 * 通过 CSS 变量 --cell-size 控制行高
 * 动态读取 grid-template-columns 计算列数，适配响应式断点
 */

export function initGridSizing() {
  const grid = document.querySelector('.grid-container');
  if (!grid) return;

  let rafId = null;

  function getColumnCount() {
    const style = getComputedStyle(grid);
    const template = style.gridTemplateColumns;
    if (!template || template === 'none') return 4;
    // gridTemplateColumns 的值类似 "100px 100px 100px 100px"，按空格切分计数
    const cols = template.split(/\s+/).filter(s => s && s !== 'none');
    return cols.length || 4;
  }

  function update() {
    rafId = null;
    const columns = getColumnCount();
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

  // 窗口大小变化时重新计算（响应式断点切换列数时也会触发）
  window.addEventListener('resize', scheduleUpdate);

  // 字体加载后可能影响尺寸，重新计算一次
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(scheduleUpdate);
  }

  // 监听列数变化（orientationchange 或媒体查询切换可能导致列数变化）
  // resize 已经覆盖了大部分场景，这里额外监听方向变化
  window.addEventListener('orientationchange', scheduleUpdate);
}
