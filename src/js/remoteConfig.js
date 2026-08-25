import siteConfig from './config.js';

// 远程配置在 localStorage 中的缓存键
const STORAGE_KEY = 'cms_site_config_v1';

/**
 * 带超时的 fetch（AbortController 实现超时控制）
 * @param {string} url - 请求地址
 * @param {number} timeoutMs - 超时时间（毫秒）
 * @returns {Promise<Object>} 解析后的 JSON 数据
 */
async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`请求 ${url} 失败：HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 读取本地缓存的远程配置（内容损坏时删除缓存）
 * @returns {Object|null} 缓存的配置对象，无缓存或损坏时返回 null
 */
function readCachedConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const cached = JSON.parse(raw);
    if (cached && typeof cached === 'object') {
      return cached;
    }
    // 非对象内容视为损坏，删除缓存
    localStorage.removeItem(STORAGE_KEY);
    return null;
  } catch (e) {
    // JSON 解析失败视为损坏，删除缓存
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

/**
 * 将远程配置写入本地缓存（写入失败不影响主流程）
 * @param {Object} remote - 远程配置对象
 */
function saveCachedConfig(remote) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
  } catch (e) {
    // 隐私模式等场景下写入可能失败，静默忽略
  }
}

/**
 * 将远程配置原地合并到静态 siteConfig（保持对象引用不变，各组件已持有该引用）
 * @param {Object} remote - /api/config 返回的配置对象
 */
export function applyRemoteConfig(remote) {
  if (!remote || typeof remote !== 'object') {
    return;
  }

  // 对象字段：逐 key 浅拷贝合并（remote 缺的 key 保留静态值）
  const objectKeys = ['site', 'user', 'socialLinks', 'musicPlayer', 'beian'];
  objectKeys.forEach((key) => {
    const remoteValue = remote[key];
    if (remoteValue && typeof remoteValue === 'object' && !Array.isArray(remoteValue)) {
      Object.assign(siteConfig[key], remoteValue);
    }
  });

  // 标量字段：remote 提供时直接覆盖
  if (remote.contactText !== undefined) {
    siteConfig.contactText = remote.contactText;
  }
  if (remote.contactButtonLink !== undefined) {
    siteConfig.contactButtonLink = remote.contactButtonLink;
  }

  // 视频列表：远程提供非空数组时整体替换
  if (Array.isArray(remote.videos) && remote.videos.length > 0) {
    siteConfig.videos = remote.videos;
  }

  // 卡片配置：远程提供非空数组时整体替换（为空数组或 undefined 时保持静态默认，由 CardManager 兜底）
  if (Array.isArray(remote.cards) && remote.cards.length > 0) {
    siteConfig.cards = remote.cards;
  }

  // 留言板配置：远程提供对象时整体替换
  if (remote.comments && typeof remote.comments === 'object' && !Array.isArray(remote.comments)) {
    siteConfig.comments = remote.comments;
  }

  // 副作用：更新页面标题
  if (siteConfig.site && siteConfig.site.title) {
    document.title = siteConfig.site.title;
  }

  // 副作用：更新 meta description
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription && siteConfig.site && siteConfig.site.description) {
    metaDescription.setAttribute('content', siteConfig.site.description);
  }

  // 副作用：更新 favicon
  const faviconLink = document.querySelector('link[rel="icon"]');
  if (faviconLink && siteConfig.site && siteConfig.site.favicon) {
    faviconLink.setAttribute('href', siteConfig.site.favicon);
  }
}

/**
 * 初始化远程配置
 * - 有本地缓存：立即同步应用并返回，随后异步后台刷新最新配置，内容有变化时回调 onUpdate
 * - 无本地缓存：等待远程接口（最长 2 秒），成功则应用并缓存，失败则静默使用静态默认配置
 * @param {Function} onUpdate - 后台刷新发现配置变化后的回调（用于触发页面重渲染）
 */
export async function initRemoteConfig(onUpdate) {
  const cached = readCachedConfig();

  if (cached) {
    // 有缓存：同步应用后立即返回，保证首屏直接使用缓存配置渲染
    applyRemoteConfig(cached);

    // 异步后台刷新最新配置（不阻塞返回），与缓存内容不同时写缓存并触发重渲染
    (async () => {
      try {
        const remote = await fetchWithTimeout('/api/config', 2000);
        if (JSON.stringify(remote) !== JSON.stringify(cached)) {
          saveCachedConfig(remote);
          applyRemoteConfig(remote);
          if (typeof onUpdate === 'function') {
            onUpdate();
          }
        }
      } catch (e) {
        // 后台刷新失败不影响当前页面展示，静默忽略
      }
    })();
    return;
  }

  // 无缓存：等待远程配置（最长 2 秒），失败则保持静态默认配置
  try {
    const remote = await fetchWithTimeout('/api/config', 2000);
    saveCachedConfig(remote);
    applyRemoteConfig(remote);
  } catch (e) {
    console.warn('拉取远程配置失败，已使用静态默认配置', e);
  }
}