/**
 * SVG 图标库 — lucide 风格，stroke 线型，24x24 viewBox
 * 使用方式：
 *   import { icon, IconName } from './icons.js';
 *   el.innerHTML = icon('dashboard', { class: 'w-5 h-5' });
 */

const SVG_ATTRS = {
    xmlns: 'http://www.w3.org/2000/svg',
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 2,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round'
};

/** 所有图标路径定义 */
const PATHS = {
    // —— 导航类 ——
    dashboard:
        '<rect x="3" y="3" width="7" height="9" rx="1"/>' +
        '<rect x="14" y="3" width="7" height="5" rx="1"/>' +
        '<rect x="14" y="12" width="7" height="9" rx="1"/>' +
        '<rect x="3" y="16" width="7" height="5" rx="1"/>',

    'edit-3':
        '<path d="M12 20h9"/>' +
        '<path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',

    video:
        '<polygon points="23 7 16 12 23 17 23 7"/>' +
        '<rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>',

    'layout-grid':
        '<rect x="3" y="3" width="7" height="7" rx="1"/>' +
        '<rect x="14" y="3" width="7" height="7" rx="1"/>' +
        '<rect x="3" y="14" width="7" height="7" rx="1"/>' +
        '<rect x="14" y="14" width="7" height="7" rx="1"/>',

    globe:
        '<circle cx="12" cy="12" r="10"/>' +
        '<line x1="2" y1="12" x2="22" y2="12"/>' +
        '<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',

    'file-text':
        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>' +
        '<polyline points="14 2 14 8 20 8"/>' +
        '<line x1="16" y1="13" x2="8" y2="13"/>' +
        '<line x1="16" y1="17" x2="8" y2="17"/>' +
        '<polyline points="10 9 9 9 8 9"/>',

    clock:
        '<circle cx="12" cy="12" r="10"/>' +
        '<polyline points="12 6 12 12 16 14"/>',

    list:
        '<line x1="8" y1="6" x2="21" y2="6"/>' +
        '<line x1="8" y1="12" x2="21" y2="12"/>' +
        '<line x1="8" y1="18" x2="21" y2="18"/>' +
        '<line x1="3" y1="6" x2="3.01" y2="6"/>' +
        '<line x1="3" y1="12" x2="3.01" y2="12"/>' +
        '<line x1="3" y1="18" x2="3.01" y2="18"/>',

    user:
        '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>' +
        '<circle cx="12" cy="7" r="4"/>',

    // —— 操作类 ——
    plus:
        '<line x1="12" y1="5" x2="12" y2="19"/>' +
        '<line x1="5" y1="12" x2="19" y2="12"/>',

    'trash-2':
        '<polyline points="3 6 5 6 21 6"/>' +
        '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
        '<line x1="10" y1="11" x2="10" y2="17"/>' +
        '<line x1="14" y1="11" x2="14" y2="17"/>',

    'drag-handle':
        '<line x1="9" y1="6" x2="9" y2="6.01"/>' +
        '<line x1="9" y1="12" x2="9" y2="12.01"/>' +
        '<line x1="9" y1="18" x2="9" y2="18.01"/>' +
        '<line x1="15" y1="6" x2="15" y2="6.01"/>' +
        '<line x1="15" y1="12" x2="15" y2="12.01"/>' +
        '<line x1="15" y1="18" x2="15" y2="18.01"/>',

    'chevron-down':
        '<polyline points="6 9 12 15 18 9"/>',

    'chevron-right':
        '<polyline points="9 18 15 12 9 6"/>',

    eye:
        '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>' +
        '<circle cx="12" cy="12" r="3"/>',

    save:
        '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>' +
        '<polyline points="17 21 17 13 7 13 7 21"/>' +
        '<polyline points="7 3 7 8 15 8"/>',

    'refresh-cw':
        '<polyline points="23 4 23 10 17 10"/>' +
        '<polyline points="1 20 1 14 7 14"/>' +
        '<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',

    upload:
        '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
        '<polyline points="17 8 12 3 7 8"/>' +
        '<line x1="12" y1="3" x2="12" y2="15"/>',

    image:
        '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>' +
        '<circle cx="8.5" cy="8.5" r="1.5"/>' +
        '<polyline points="21 15 16 10 5 21"/>',

    link:
        '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>' +
        '<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',

    x:
        '<line x1="18" y1="6" x2="6" y2="18"/>' +
        '<line x1="6" y1="6" x2="18" y2="18"/>',

    check:
        '<polyline points="20 6 9 17 4 12"/>',

    // —— 状态 / 提示类 ——
    'alert-circle':
        '<circle cx="12" cy="12" r="10"/>' +
        '<line x1="12" y1="8" x2="12" y2="12"/>' +
        '<line x1="12" y1="16" x2="12.01" y2="16"/>',

    'alert-triangle':
        '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>' +
        '<line x1="12" y1="9" x2="12" y2="13"/>' +
        '<line x1="12" y1="17" x2="12.01" y2="17"/>',

    info:
        '<circle cx="12" cy="12" r="10"/>' +
        '<line x1="12" y1="16" x2="12" y2="12"/>' +
        '<line x1="12" y1="8" x2="12.01" y2="8"/>',

    // —— 内容编辑类 ——
    'type':
        '<polyline points="4 7 4 4 20 4 20 7"/>' +
        '<line x1="9" y1="20" x2="15" y2="20"/>' +
        '<line x1="12" y1="4" x2="12" y2="20"/>',

    'align-left':
        '<line x1="17" y1="10" x2="3" y2="10"/>' +
        '<line x1="21" y1="6" x2="3" y2="6"/>' +
        '<line x1="21" y1="14" x2="3" y2="14"/>' +
        '<line x1="17" y1="18" x2="3" y2="18"/>',

    palette:
        '<circle cx="13.5" cy="6.5" r=".5"/>' +
        '<circle cx="17.5" cy="10.5" r=".5"/>' +
        '<circle cx="8.5" cy="7.5" r=".5"/>' +
        '<circle cx="6.5" cy="12.5" r=".5"/>' +
        '<path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z"/>',

    settings:
        '<circle cx="12" cy="12" r="3"/>' +
        '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',

    'log-out':
        '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>' +
        '<polyline points="16 17 21 12 16 7"/>' +
        '<line x1="21" y1="12" x2="9" y2="12"/>',

    search:
        '<circle cx="11" cy="11" r="8"/>' +
        '<line x1="21" y1="21" x2="16.65" y2="16.65"/>',

    'more-horizontal':
        '<circle cx="12" cy="12" r="1"/>' +
        '<circle cx="19" cy="12" r="1"/>' +
        '<circle cx="5" cy="12" r="1"/>',

    // —— 品牌 logo ——
    logo:
        '<path d="M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z"/>' +
        '<path d="M9 9h6v2H9z"/>' +
        '<path d="M9 13h6v2H9z"/>' +
        '<circle cx="8" cy="6.5" r="1" fill="currentColor" stroke="none"/>' +
        '<circle cx="12" cy="6.5" r="1" fill="currentColor" stroke="none"/>'
};

/**
 * 生成 SVG 图标 HTML 字符串
 * @param {string} name 图标名
 * @param {object} [extraAttrs] 额外属性（如 class、style）
 * @returns {string}
 */
export function icon(name, extraAttrs = {}) {
    const path = PATHS[name];
    if (!path) {
        console.warn(`[icons] 未找到图标：${name}`);
        return '';
    }
    const attrs = { ...SVG_ATTRS, ...extraAttrs };
    const attrStr = Object.entries(attrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ');
    return `<svg ${attrStr}>${path}</svg>`;
}

/** 图标名类型导出（方便 IDE 提示） */
export const IconName = Object.keys(PATHS);

export default { icon, IconName, PATHS };
