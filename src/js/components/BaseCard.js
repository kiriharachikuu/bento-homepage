/**
 * 通用卡片基类
 */
export class BaseCard {
  /**
   * 构造函数
   * @param {Object} config - 卡片配置
   * @param {string} config.id - 卡片ID
   * @param {string} config.title - 卡片标题
   * @param {string} config.classes - 卡片CSS类
   */
  constructor(config) {
    this.config = {
      id: 'card',
      title: '',
      classes: '',
      ...config
    };
  }

  /**
   * 渲染卡片
   * @returns {string} 卡片HTML字符串
   */
  render() {
    const { id, classes } = this.config;
    return `
      <div id="${id}" class="draggable-card bg-card rounded-2xl p-6 shadow-lg ${classes}" draggable="true">
        ${this.getContent()}
      </div>
    `;
  }

  /**
   * 获取卡片内容（子类需要重写此方法）
   * @returns {string} 卡片内容HTML
   */
  getContent() {
    return '';
  }
}