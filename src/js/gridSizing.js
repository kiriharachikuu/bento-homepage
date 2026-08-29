/**
 * Grid 布局辅助：确保每个网格单元是正方形（行高 = 列宽）
 * 通过 CSS 变量 --cell-size 控制行高
 * 动态读取 grid-template-columns 计算列数，适配响应式断点
 *
 * 同时负责移动端卡片尺寸切换（如音乐播放器在移动端横置为 2 列宽）
 */

let currentLayoutMode = null; // 'mobile' | 'tablet' | 'desktop'

export function initGridSizing(onLayoutChange) {
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

  /**
   * 根据当前列数切换卡片的响应式尺寸
   * 例如：音乐播放器在手机端（2列）是 2×1，在桌面端（3-4列）是 1×2
   */
  function applyResponsiveCardSizes(columns) {
    let mode;
    if (columns <= 2) mode = 'mobile';
    else if (columns === 3) mode = 'tablet';
    else mode = 'desktop';

    if (mode === currentLayoutMode) return false;
    currentLayoutMode = mode;

    // 音乐播放器卡片：桌面 1×2，移动端 2×1
    const musicCard = document.querySelector('#music-player-card.draggable-card');
    if (musicCard) {
      if (mode === 'mobile') {
        musicCard.classList.remove('row-span-2');
        musicCard.classList.add('col-span-2');
      } else {
        musicCard.classList.remove('col-span-2');
        musicCard.classList.add('row-span-2');
      }
    }

    return true; // 尺寸发生了变化
  }

  function update() {
    rafId = null;
    const columns = getColumnCount();
    const gridWidth = grid.clientWidth;
    const gap = 16; // 1rem = 16px，与 CSS 中 gap: 1rem 一致
    const totalGap = gap * (columns - 1);
    const cellSize = (gridWidth - totalGap) / columns;
    grid.style.setProperty('--cell-size', `${cellSize}px`);

    // 切换响应式卡片尺寸
    const sizeChanged = applyResponsiveCardSizes(columns);
    if (sizeChanged && typeof onLayoutChange === 'function') {
      onLayoutChange();
    }
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
