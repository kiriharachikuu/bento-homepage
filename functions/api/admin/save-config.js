/**
 * POST /api/admin/save-config
 * 保存站点配置：按模块净化后整体替换对应顶层 key，
 * 并创建版本快照与操作日志。
 * 请求体：{ modules: { site?, user?, socialLinks?, contactText?, contactButtonLink?, musicPlayer?, beian?, videoSync? }, note?: string }
 */
import { json, error, runHandler } from '../../lib/response.js';
import { assertKV } from '../../lib/kv.js';
import { requireAuth, getClientIp } from '../../lib/session.js';
import { writeLog, LOG_ACTIONS } from '../../lib/logger.js';
import { createVersion } from '../../lib/version.js';
import { getSiteConfig, saveSiteConfig } from '../../lib/videos.js';

/** 对象类型模块（字段结构见 lib/defaultConfig.js 的 DEFAULT_SITE_CONFIG） */
const OBJECT_MODULES = ['site', 'user', 'socialLinks', 'musicPlayer', 'beian', 'videoSync'];
/** 字符串值模块 */
const STRING_MODULES = ['contactText', 'contactButtonLink'];
/** 全部已知模块名 */
const KNOWN_MODULES = new Set([...OBJECT_MODULES, ...STRING_MODULES]);

/** 常规字段长度上限（字符，约 100KB） */
const FIELD_LIMIT = 100 * 1024;
/** 富文本字段长度上限（字符，约 200KB） */
const RICH_TEXT_LIMIT = 200 * 1024;
/** 允许富文本长度的字段名 */
const RICH_TEXT_FIELDS = new Set(['learnMoreContent', 'description', 'contactText']);

/**
 * 判断是否为普通对象（非 null、非数组）
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 字段值强制转字符串并按上限截断
 * @param {string} key 字段名
 * @param {*} value 字段值
 * @returns {string}
 */
function toStringField(key, value) {
  const limit = RICH_TEXT_FIELDS.has(key) ? RICH_TEXT_LIMIT : FIELD_LIMIT;
  return String(value).slice(0, limit);
}

/**
 * 净化对象类型模块：字段值强制 String() 截断，特定字段做类型规范化
 * @param {string} name 模块名
 * @param {object} mod 提交的模块对象
 * @returns {object}
 */
function sanitizeObjectModule(name, mod) {
  const out = {};
  for (const [key, raw] of Object.entries(mod)) {
    if (raw === null || raw === undefined) continue;
    out[key] = toStringField(key, raw);
  }
  if (name === 'beian') {
    // enabled 规范化为布尔值
    out.enabled = mod.enabled === true || mod.enabled === 'true';
  }
  if (name === 'videoSync') {
    // mid 规范化为字符串
    if (mod.mid !== undefined && mod.mid !== null) {
      out.mid = String(mod.mid).slice(0, 100);
    }
    // maxCount 规范化为整数并限制在 5~100
    if (mod.maxCount !== undefined && mod.maxCount !== null) {
      const n = Number(mod.maxCount);
      if (Number.isFinite(n)) {
        out.maxCount = Math.min(Math.max(Math.trunc(n), 5), 100);
      } else {
        // 非法值不落库，读取配置时由默认值兜底
        delete out.maxCount;
      }
    }
  }
  return out;
}

export function onRequestPost(context) {
  return runHandler(async () => {
    const auth = await requireAuth(context);
    if (!auth.ok) return auth.response;

    const kv = assertKV();

    // 解析请求体
    let body;
    try {
      body = await context.request.json();
    } catch {
      return error(400, 'BAD_REQUEST', '请求体不是合法的 JSON');
    }

    const modules = body && body.modules;
    if (!isPlainObject(modules)) {
      return error(400, 'BAD_REQUEST', 'modules 必须为非空对象');
    }

    // 逐模块净化：未知 key 忽略；对象模块只接受对象，字符串模块只接受字符串
    const sanitized = {};
    const changedModules = [];
    for (const key of Object.keys(modules)) {
      if (!KNOWN_MODULES.has(key)) continue;
      const value = modules[key];
      if (STRING_MODULES.includes(key)) {
        if (typeof value !== 'string') continue;
        sanitized[key] = toStringField(key, value);
      } else if (isPlainObject(value)) {
        sanitized[key] = sanitizeObjectModule(key, value);
      } else {
        continue;
      }
      changedModules.push(key);
    }

    if (changedModules.length === 0) {
      return error(400, 'BAD_REQUEST', '未提交任何有效的配置模块');
    }

    // 读取当前配置，逐模块替换对应顶层 key 后保存
    const current = await getSiteConfig(kv);
    for (const key of changedModules) {
      current[key] = sanitized[key];
    }
    await saveSiteConfig(kv, current);

    // 创建版本快照（note 缺省时按变更模块生成）
    const rawNote = typeof body.note === 'string' ? body.note.trim() : '';
    const note = rawNote || `更新 ${changedModules.join('、')}`;
    await createVersion(kv, { username: auth.session.username, note, modules: changedModules });

    // 记录操作日志
    await writeLog(kv, {
      username: auth.session.username,
      action: LOG_ACTIONS.SAVE_CONFIG,
      target: changedModules.join(','),
      summary: rawNote || `更新模块：${changedModules.join('、')}`,
      ip: getClientIp(context.request)
    });

    return json({ ok: true, config: current });
  });
}