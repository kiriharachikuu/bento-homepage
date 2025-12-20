import { BaseCard } from './BaseCard.js';

/**
 * 地图卡片
 */
export class MapCard extends BaseCard {
  /**
   * 构造函数
   * @param {Object} config - 卡片配置
   */
  constructor(config) {
    super({
      id: 'map-card',
      classes: 'bg-white rounded-2xl p-6 shadow-lg fade-in',
      ...config
    });
  }

  /**
   * 获取卡片内容
   * @returns {string} 卡片内容HTML
   */
  getContent() {
    return `
      <div class="bg-gray-200 border-2 border-dashed rounded-xl w-full h-64 mb-4">
        <div id="amap-container" style="width: 100%; height: 16rem; border-radius: 8px; overflow: hidden; border: none;"></div>
      </div>
      <div class="flex justify-between items-center">
        <div class="flex items-center">
          <div class="bg-gray-500 rounded-xl w-8 h-8 mr-2 flex items-center justify-center p-1">
            <i class="fa-solid fa-map-pin text-white" style="font-size: 100%;"></i>
          </div>
          <span>我现在所在</span>
        </div>
        <button class="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
      </div>
    `;
  }

  /**
   * 初始化地图
   */
  initMap() {
    console.log('开始初始化地图...');
    
    // 确保地图容器已渲染
    const mapContainer = document.getElementById('amap-container');
    if (!mapContainer) {
      console.error('地图容器未找到');
      return;
    }
    
    console.log('地图容器找到:', mapContainer);
    
    // 确保地图容器有正确的尺寸
    const containerRect = mapContainer.getBoundingClientRect();
    console.log('地图容器尺寸:', containerRect.width, 'x', containerRect.height);
    
    // 如果容器高度为0，手动设置高度
    if (containerRect.height === 0) {
      console.warn('地图容器高度为0，手动设置高度');
      mapContainer.style.height = '256px'; // 设置一个固定高度
      console.log('手动设置后容器高度:', mapContainer.offsetHeight);
    }

    // 检查AMap是否已加载
    if (!window.AMap) {
      console.error('AMap API未加载');
      return;
    }

    console.log('AMap API已加载:', !!window.AMap);

    try {
      // 初始化地图
      const map = new AMap.Map('amap-container', {
        zoom: 15,
        center: [120.20056, 30.18523],
        resizeEnable: true,
        zoomEnable: true,
        dragEnable: true,
        pitchEnable: false,
        rotateEnable: false
      });

      console.log('地图实例创建成功:', map);

      // 添加事件监听，确保地图加载完成
      map.on('complete', () => {
        console.log('地图加载完成');
      });

      // 添加地图加载失败事件监听
      map.on('error', (error) => {
        console.error('地图加载失败:', error);
      });

      // 使用默认图标，避免自定义图标加载问题
      const marker = new AMap.Marker({
        position: [120.20056, 30.18523],
        title: '浙江杭州',
        zIndex: 100
      });

      map.add(marker);
      console.log('地图标记添加成功');

      const infoWindow = new AMap.InfoWindow({
        content: '<div style="padding: 8px 12px; font-size: 0.9rem;">我的位置：浙江杭州</div>',
        offset: new AMap.Pixel(0, -40)
      });

      marker.on('click', () => {
        infoWindow.open(map, marker.getPosition());
      });

      // 隐藏底部版权信息
      setTimeout(() => {
        const copyright = document.querySelector('.amap-copyright');
        if (copyright) {
          copyright.style.display = 'none';
        }
      }, 500);

      console.log('地图初始化完成');
    } catch (error) {
      console.error('地图初始化过程中发生错误:', error);
      // 添加错误信息到页面，方便调试
      mapContainer.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666; font-size: 14px;">地图加载失败: ${error.message}</div>`;
    }
  }
}