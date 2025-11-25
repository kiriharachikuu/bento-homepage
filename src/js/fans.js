	  // 配置列表：key = 元素ID，value = 对应账号的API地址
	  const fanConfig = {
	    "bilibili": "https://bili-count-api.chikuu.top/api/count?vmid=28826850",
	    "netease": "https://api.swo.moe/stats/neteasemusic/379188047",
		"weibo": "https://api.swo.moe/stats/weibo/5574382615",
	  };
	  
	  // 格式化粉丝数（支持 K/W 简化显示，保留1位小数）
	  function formatFanCount(count) {
	    if (count >= 10000) {
	      return (count / 10000).toFixed(1) + "W";
	    } else if (count >= 1000) {
	      return (count / 1000).toFixed(1) + "K";
	    } else {
	      return count.toString();
	    }
	  }
	  
	  // 单个元素的粉丝数更新逻辑
	  async function updateSingleFanCount(elementId, apiUrl) {
	    const targetElement = document.getElementById(elementId);
	    if (!targetElement) {
	      console.error(`未找到ID为 ${elementId} 的元素`);
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
	      // 失败时保留原有内容，不影响页面显示
	    }
	  }
	  
	  // 批量更新所有配置的粉丝数
	  async function updateAllFanCounts() {
	    // 遍历配置列表，逐个更新
	    for (const [elementId, apiUrl] of Object.entries(fanConfig)) {
	      await updateSingleFanCount(elementId, apiUrl);
	    }
	  }
	  
	  // 页面加载完成后执行
	  if (document.readyState === "loading") {
	    document.addEventListener("DOMContentLoaded", updateAllFanCounts);
	  } else {
	    updateAllFanCounts();
	  }
	  
	  // 可选：定时刷新（每5分钟更新一次，单位：毫秒）
	  // setInterval(updateAllFanCounts, 5 * 60 * 1000);