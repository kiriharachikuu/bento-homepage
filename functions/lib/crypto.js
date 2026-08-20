/**
 * 加密 / 摘要工具
 * 基于 Web Crypto（SHA-1 / SHA-256 / HMAC / PBKDF2）
 * 以及纯 JS 实现的 MD5（EdgeOne Pages 的 crypto.subtle 不支持 MD5，
 * 而 B 站 wbi 签名依赖 MD5，因此此处内置标准 MD5 算法）
 */

/**
 * 字节数组转十六进制字符串（小写）
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function bytesToHex(bytes) {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += (bytes[i] >>> 4).toString(16);
    hex += (bytes[i] & 0xf).toString(16);
  }
  return hex;
}

/**
 * 十六进制字符串转字节数组
 * @param {string} hex
 * @returns {Uint8Array}
 */
export function hexToBytes(hex) {
  const clean = String(hex).trim().toLowerCase();
  const out = new Uint8Array(clean.length >> 1);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * 字符串转 UTF-8 字节数组
 * @param {string} str
 * @returns {Uint8Array}
 */
export function utf8Bytes(str) {
  return new TextEncoder().encode(String(str));
}

/**
 * 生成指定字节长度的随机十六进制字符串
 * @param {number} [bytes=16] 随机字节数
 * @returns {string} 长度为 bytes*2 的 hex 字符串
 */
export function randomHex(bytes = 16) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return bytesToHex(arr);
}

/**
 * 计算 SHA-256 摘要，返回 hex 字符串
 * @param {string} str
 * @returns {Promise<string>}
 */
export async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', utf8Bytes(str));
  return bytesToHex(new Uint8Array(buf));
}

/**
 * 计算 SHA-1 摘要，返回 hex 字符串
 * @param {string} str
 * @returns {Promise<string>}
 */
export async function sha1Hex(str) {
  const buf = await crypto.subtle.digest('SHA-1', utf8Bytes(str));
  return bytesToHex(new Uint8Array(buf));
}

/**
 * 计算 HMAC-SHA1，返回 hex 字符串
 * @param {string} keyStr HMAC 密钥（按 UTF-8 字节使用）
 * @param {string} msgStr 待签名的消息
 * @returns {Promise<string>}
 */
export async function hmacSha1Hex(keyStr, msgStr) {
  const key = await crypto.subtle.importKey(
    'raw',
    utf8Bytes(keyStr),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, utf8Bytes(msgStr));
  return bytesToHex(new Uint8Array(sig));
}

/**
 * 计算 HMAC-SHA256，返回 hex 字符串（用于 B 站 bili_ticket 签名）
 * @param {string} keyStr HMAC 密钥（按 UTF-8 字节使用）
 * @param {string} msgStr 待签名的消息
 * @returns {Promise<string>}
 */
export async function hmacSha256Hex(keyStr, msgStr) {
  const key = await crypto.subtle.importKey(
    'raw',
    utf8Bytes(keyStr),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, utf8Bytes(msgStr));
  return bytesToHex(new Uint8Array(sig));
}

/**
 * 使用 PBKDF2-SHA256 从密码派生 256bit 散列，返回 hex 字符串
 * @param {string} password 明文密码
 * @param {string} saltHex 盐值（hex 字符串）
 * @param {number} [iterations=100000] 迭代次数
 * @returns {Promise<string>} 64 位 hex 的派生结果
 */
export async function pbkdf2Hash(password, saltHex, iterations = 100000) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    utf8Bytes(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: hexToBytes(saltHex),
      iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

/* ---------------------------------------------------------------- */
/* 以下为纯 JS 实现的标准 MD5 算法（RFC 1321），正确处理 UTF-8 多字节字符 */
/* ---------------------------------------------------------------- */

// 每轮循环左移位数表（共 64 轮，每 16 轮一组）
const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
];

// 常量表：K[i] = floor(abs(sin(i+1)) * 2^32)
const MD5_K = [
  0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
  0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
  0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
  0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
  0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
  0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
  0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
  0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
  0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
  0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
  0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
  0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
  0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
  0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
  0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
  0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
];

/**
 * MD5 核心：对字节数组计算 16 字节摘要
 * @param {Uint8Array} bytes
 * @returns {Uint8Array} 16 字节摘要
 */
function md5Digest(bytes) {
  // 初始化链接变量（MD5 规定的幻数）
  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  // 消息填充：追加 0x80，再用 0x00 补齐到 (56 mod 64) 字节，最后追加 64 位小端比特长度
  const len = bytes.length;
  const bitLen = len * 8;
  const padded = new Uint8Array((((len + 8) >> 6) + 1) * 64);
  padded.set(bytes);
  padded[len] = 0x80;
  // 低 32 位（小端）
  padded[padded.length - 8] = bitLen & 0xff;
  padded[padded.length - 7] = (bitLen >>> 8) & 0xff;
  padded[padded.length - 6] = (bitLen >>> 16) & 0xff;
  padded[padded.length - 5] = (bitLen >>> 24) & 0xff;
  // 高 32 位（小端，仅消息超过 512MB 时非零）
  const bitLenHi = Math.floor(bitLen / 0x100000000);
  padded[padded.length - 4] = bitLenHi & 0xff;
  padded[padded.length - 3] = (bitLenHi >>> 8) & 0xff;
  padded[padded.length - 2] = (bitLenHi >>> 16) & 0xff;
  padded[padded.length - 1] = (bitLenHi >>> 24) & 0xff;

  // 逐个 512bit（64 字节）分组处理
  const M = new Array(16);
  for (let offset = 0; offset < padded.length; offset += 64) {
    // 将分组按小端序拆为 16 个 32 位字
    for (let i = 0; i < 16; i++) {
      const j = offset + i * 4;
      M[i] = padded[j] | (padded[j + 1] << 8) | (padded[j + 2] << 16) | (padded[j + 3] << 24);
    }

    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;

    // 64 轮主循环
    for (let i = 0; i < 64; i++) {
      let F;
      let g;
      if (i < 16) {
        // 第一轮：F = (B and C) or (not B and D)
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        // 第二轮：F = (D and B) or (not D and C)
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        // 第三轮：F = B xor C xor D
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        // 第四轮：F = C xor (B or not D)
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      // 累加：F + A + K[i] + M[g]，结果按 2^32 取模（JS 位运算自动截断为 int32）
      F = (F + A + MD5_K[i] + M[g]) | 0;
      A = D;
      D = C;
      C = B;
      // B = B + 循环左移(F, s)
      B = (B + ((F << MD5_S[i]) | (F >>> (32 - MD5_S[i])))) | 0;
    }

    // 累加到链接变量
    a0 = (a0 + A) | 0;
    b0 = (b0 + B) | 0;
    c0 = (c0 + C) | 0;
    d0 = (d0 + D) | 0;
  }

  // 输出：a0/b0/c0/d0 按小端序拼接为 16 字节摘要
  const out = new Uint8Array(16);
  const words = [a0, b0, c0, d0];
  for (let w = 0; w < 4; w++) {
    const word = words[w];
    const pos = w * 4;
    out[pos] = word & 0xff;
    out[pos + 1] = (word >>> 8) & 0xff;
    out[pos + 2] = (word >>> 16) & 0xff;
    out[pos + 3] = (word >>> 24) & 0xff;
  }
  return out;
}

/**
 * 计算字符串的 MD5（按 UTF-8 字节处理，支持中文等多字节字符）
 * @param {string} str
 * @returns {string} 32 位小写 hex
 */
export function md5Hex(str) {
  return bytesToHex(md5Digest(utf8Bytes(str)));
}
