// 主题配置文件 - 存储夜间模式配色方案

/**
 * 主题配置
 * - light: 浅色主题配色
 * - dark: 深色主题配色
 */
export const themeConfig = {
  // 浅色主题配色
  light: {
    bgColor: '#f9fafb',
    textColor: '#111827',
    cardBg: '#ffffff',
    cardSelected: '#fafafa',
    cardHover: '#f3f4f6',
    borderColor: '#e5e7eb',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    linkColor: '#3b82f6',
    linkHover: '#2563eb',
    gray100: '#f3f4f6',
    gray200: '#e5e7eb',
    gray600: '#4b5563',
    gray700: '#374151',
    gray800: '#1f2937',
    textSelected: '#111827',
    textNormal: '#374151',
    backdropBlur: 'rgba(255, 255, 255, 0.3)'
  },
  
  // 深色主题配色
  dark: {
    bgColor: '#171717', // 夜间模式背景色设置为rgb(23 23 23)
    textColor: '#f8fafc',
    cardBg: '#2d2d2d',
    cardSelected: '#383838',
    cardHover: '#334155',
    borderColor: '#334155',
    shadowColor: 'rgba(0, 0, 0, 0.6)',
    linkColor: '#60a5fa',
    linkHover: '#3b82f6',
    gray100: '#1e293b',
    gray200: '#3e3e3e',
    gray600: '#cbd5e1',
    gray700: '#e2e8f0',
    gray800: '#f8fafc',
    textSelected: '#ffffff',
    textNormal: '#f8fafc',
    backdropBlur: 'rgba(0, 0, 0, 0.35)'
  }
};
