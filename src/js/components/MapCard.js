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
    // 确保地图容器已渲染
    const mapContainer = document.getElementById('amap-container');
    if (!mapContainer) return;

    // 初始化地图
    const map = new AMap.Map('amap-container', {
      zoom: 15,
      center: [120.20056, 30.18523],
      resizeEnable: true,
      zoomEnable: true,
      dragEnable: true
    });

    const customIcon = new AMap.Icon({
      size: new AMap.Size(36, 36),
      image: '/img/map.png',
      imageSize: new AMap.Size(36, 36),
      anchor: 'bottom-center'
    });

    const marker = new AMap.Marker({
      position: [120.20056, 30.18523],
      title: '浙江杭州',
      icon: customIcon,
      zIndex: 100
    });

    map.add(marker);

    const infoWindow = new AMap.InfoWindow({
      content: '<div style="padding: 8px 12px; font-size: 0.9rem;">我的位置：浙江杭州</div>',
      offset: new AMap.Pixel(0, -40)
    });

    marker.on('click', () => {
      infoWindow.open(map, marker.getPosition());
    });

    // 隐藏底部版权信息
    const copyright = document.querySelector('.amap-copyright');
    if (copyright) {
      copyright.style.display = 'none';
    }
  }
}