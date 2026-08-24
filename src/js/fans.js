/**
 * 粉丝数工具函数
 * 供 FollowerCard 等组件按需调用，不再自动执行
 */

/**
 * 格式化粉丝数（支持 K/W 简化显示，保留1位小数）
 * @param {number} count - 粉丝数量
 * @returns {string} 格式化后的粉丝数字符串
 */
export function formatFanCount(count) {
  if (count >= 10000) {
    return (count / 10000).toFixed(1) + "W";
  } else if (count >= 1000) {
    return (count / 1000).toFixed(1) + "K";
  } else {
    return count.toString();
  }
}

/**
 * 更新单个元素的粉丝数
 * @param {string} elementId - 目标 DOM 元素 ID
 * @param {string} apiUrl - 粉丝数 API 地址
 */
export async function updateSingleFanCount(elementId, apiUrl) {
  const targetElement = document.getElementById(elementId);
  if (!targetElement) {
    console.warn(`未找到ID为 ${elementId} 的元素`);
    return;
  }

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`请求失败：${response.status}`);
    }

    const data = await response.json();
    if (data.count === undefined || data.count === null) {
      throw new Error("API 返回数据中未找到 count 字段");
    }

    // 格式化并更新内容
    const formattedCount = formatFanCount(Number(data.count));
    targetElement.textContent = formattedCount;
    console.log(`ID: ${elementId} 粉丝数更新成功：`, formattedCount);

  } catch (error) {
    console.error(`ID: ${elementId} 更新失败：`, error.message);
  }
}

/**
 * 批量更新所有带 data-fan-api 属性的元素
 * 从 DOM 中动态发现，不依赖硬编码配置
 */
export async function updateAllFanCounts() {
  const elements = document.querySelectorAll('[data-fan-api]');
  const promises = [];
  elements.forEach(el => {
    const apiUrl = el.getAttribute('data-fan-api');
    const id = el.id;
    if (id && apiUrl) {
      promises.push(updateSingleFanCount(id, apiUrl));
    }
  });
  await Promise.all(promises);
}

export default { formatFanCount, updateSingleFanCount, updateAllFanCounts };
