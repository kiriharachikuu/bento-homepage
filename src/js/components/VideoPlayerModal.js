/**
 * B 站视频播放弹窗（单例）
 * 点击视频卡片时打开，内嵌 B 站 newplayer 样式播放器（通过本站代理绕过 X-Frame-Options）
 */

let overlayEl = null;
let modalEl = null;
let isOpen = false;
let escHandler = null;

/** 确保弹窗 DOM 已创建（懒创建，全局唯一） */
function ensureModal() {
  if (modalEl) return;

  overlayEl = document.createElement('div');
  overlayEl.className = 'fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center opacity-0 pointer-events-none transition-opacity duration-300';
  overlayEl.style.zIndex = '9999';

  modalEl = document.createElement('div');
  modalEl.className = 'bg-card rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden transform scale-95 opacity-0 transition-all duration-300';
  modalEl.style.zIndex = '10000';

  modalEl.innerHTML = `
    <div class="px-5 py-3 border-b flex justify-between items-center">
      <h2 class="text-lg font-bold truncate" id="video-player-title">视频播放</h2>
      <button type="button" class="video-player-close p-1.5 rounded-full hover:bg-gray-100 transition-colors" style="color: var(--gray-600);">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    <div class="px-4 py-3" id="video-player-content"></div>
  `;

  overlayEl.appendChild(modalEl);
  document.body.appendChild(overlayEl);

  // 关闭按钮
  const closeBtn = modalEl.querySelector('.video-player-close');
  if (closeBtn) closeBtn.addEventListener('click', closePlayer);

  // 点击遮罩关闭
  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) closePlayer();
  });

  // ESC 关闭
  escHandler = (e) => {
    if (e.key === 'Escape' && isOpen) closePlayer();
  };
  document.addEventListener('keydown', escHandler);
}

/**
 * 从视频链接中提取 BV 号
 * @param {string} url
 * @returns {string|null}
 */
export function extractBvid(url) {
  const matched = /(BV[0-9A-Za-z]{10})/.exec(String(url || ''));
  return matched ? matched[1] : null;
}

/**
 * 打开视频播放弹窗
 * @param {Object} options
 * @param {string} options.bvid - BV 号
 * @param {string} [options.title] - 弹窗标题
 */
export function openVideoPlayer({ bvid, title = '视频播放' }) {
  if (!bvid) return;
  ensureModal();

  // 通过本站 /api/bili-player 代理 B 站 newplayer 播放器页面
  // 后端会移除 X-Frame-Options，使 iframe 可以正常嵌入 newplayer 样式的播放器
  const playerUrl = `/api/bili-player?bvid=${bvid}&page=1&autoplay=1`;

  const titleEl = modalEl.querySelector('#video-player-title');
  const contentEl = modalEl.querySelector('#video-player-content');

  if (titleEl) titleEl.textContent = title;
  if (contentEl) {
    contentEl.innerHTML = `
      <div class="relative w-full" style="padding-top: 56.25%;">
        <iframe
          src="${playerUrl}"
          class="absolute inset-0 w-full h-full rounded-lg"
          frameborder="0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowfullscreen
          scrolling="no">
        </iframe>
      </div>
    `;
  }

  // 显示
  overlayEl.classList.remove('opacity-0', 'pointer-events-none');
  modalEl.classList.remove('scale-95', 'opacity-0');
  modalEl.classList.add('scale-100', 'opacity-100');
  isOpen = true;
  document.body.style.overflow = 'hidden';
}

/**
 * 关闭视频播放弹窗（停止播放）
 */
export function closePlayer() {
  if (!modalEl) return;

  // 清空 iframe 停止播放
  const iframe = modalEl.querySelector('iframe');
  if (iframe) {
    iframe.src = 'about:blank';
  }

  // 隐藏
  overlayEl.classList.add('opacity-0', 'pointer-events-none');
  modalEl.classList.add('scale-95', 'opacity-0');
  modalEl.classList.remove('scale-100', 'opacity-100');
  isOpen = false;
  document.body.style.overflow = 'auto';
}
