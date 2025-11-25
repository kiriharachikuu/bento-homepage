import siteConfig from './config.js';

/**
 * 格式化粉丝数显示
 * @param {number} count - 粉丝数量
 * @returns {string} 格式化后的粉丝数字符串
 */
function formatFanCount(count) {
  if (count >= 10000) {
    return (count / 10000).toFixed(1) + "W";
  } else if (count >= 1000) {
    return (count / 1000).toFixed(1) + "K";
  } else {
    return count.toString();
  }
}

/**
 * 更新单个平台的粉丝数
 * @param {string} platform - 平台名称
 * @param {string} apiUrl - API地址
 */
async function updateSingleFanCount(platform, apiUrl) {
  const element = document.getElementById(platform);
  if (!element) {
    console.warn(`未找到ID为 ${platform} 的元素`);
    return;
  }

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`请求失败：${response.status}`);
    }

    const data = await response.json();
    if (data.count !== undefined) {
      element.textContent = formatFanCount(Number(data.count));
    }
  } catch (error) {
    console.error(`更新 ${platform} 粉丝数失败:`, error);
  }
}

/**
 * 更新所有社交媒体平台的粉丝数
 */
async function updateAllFanCounts() {
  const fanApis = siteConfig.fanApis;
  
  // 使用 Promise.all 并行更新所有平台的粉丝数
  const updatePromises = Object.entries(fanApis).map(
    ([platform, apiUrl]) => updateSingleFanCount(platform, apiUrl)
  );
  
  await Promise.all(updatePromises);
}

/**
 * 初始化网站内容
 */
function initSite() {
  // 更新网页标题
  document.title = siteConfig.site.title;
  
  // 更新favicon
  updateFavicon();
}

/**
 * 更新网站图标
 */
function updateFavicon() {
  let favicon = document.querySelector("link[rel='shortcut icon']");
  if (favicon) {
    favicon.href = siteConfig.site.favicon;
  }
}

// 页面加载完成后初始化
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSite);
} else {
  initSite();
}

// 每5分钟更新一次粉丝数
setInterval(updateAllFanCounts, 5 * 60 * 1000);

export { 
  initSite, 
  updateAllFanCounts, 
  updateSingleFanCount, 
  formatFanCount 
};