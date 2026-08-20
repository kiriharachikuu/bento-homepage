#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
B 站视频抓取 + CMS 后台导入脚本（方案 C 备用）

用法：
  1. 安装依赖： pip install requests
  2. 修改下面 CONFIG 区域的配置
  3. 运行： python bili_sync_import.py

功能：
  - 用你的 B 站 Cookie 抓取指定 UID 的投稿视频列表
  - 登录 CMS 后台获取管理员会话
  - 调用 /api/admin/videos/import 接口导入视频数据
  - 导入成功后生成版本快照，可在后台版本历史中回滚

注意：
  - 脚本会覆盖 CMS 里的"同步视频"列表，但不会影响手动添加的条目
  - 建议先在测试环境跑通再用到生产
  - B 站接口和风控策略随时可能变，脚本可能需要随时间调整
"""

import json
import time
import sys
import requests

# ============================================================
# CONFIG - 请根据实际情况修改
# ============================================================

# B 站配置
BILIBILI_MID = "28826850"          # B 站 UID
BILIBILI_COOKIE = ""               # 你的 B 站登录态 Cookie（字符串，形如 "SESSDATA=xxx; bili_jct=yyy; buvid3=zzz"）
MAX_VIDEOS = 50                    # 最多抓取多少条

# CMS 后台配置
CMS_BASE_URL = "https://你的域名.com"   # 你的网站地址，不要带末尾斜杠
CMS_USERNAME = ""                       # 管理员用户名
CMS_PASSWORD = ""                       # 管理员密码

# 来源标记（会出现在后台版本备注和操作日志里）
IMPORT_SOURCE = "python_script"

# ============================================================
# 以下是脚本逻辑，一般不需要改
# ============================================================

BILIBILI_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/126.0.0.0 Safari/537.36"
)


def fetch_bilibili_videos(mid: str, cookie: str, max_count: int = 50):
    """
    从 B 站 wbi 签名接口抓取投稿视频列表。
    返回规范化后的视频数组。
    """
    print(f"[B 站] 开始抓取 UID={mid} 的视频（最多 {max_count} 条）...")

    session = requests.Session()
    session.headers.update({
        "User-Agent": BILIBILI_UA,
        "Referer": f"https://space.bilibili.com/{mid}/upload/video",
        "Cookie": cookie,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9",
    })

    # 第一步：从 nav 接口拿 wbi keys（img_key / sub_key）
    try:
        nav_resp = session.get("https://api.bilibili.com/x/web-interface/nav", timeout=10)
        nav_data = nav_resp.json()
        if nav_data.get("code") != 0:
            raise RuntimeError(f"nav 接口错误：code={nav_data.get('code')}, msg={nav_data.get('message')}")
        wbi_img = nav_data["data"]["wbi_img"]
        img_url = wbi_img["img_url"]
        sub_url = wbi_img["sub_url"]
        img_key = img_url.split("/")[-1].split(".")[0]
        sub_key = sub_url.split("/")[-1].split(".")[0]
        print(f"[B 站] 获取 wbi key 成功")
    except Exception as e:
        raise RuntimeError(f"获取 wbi key 失败：{e}")

    # 第二步：计算 mixin_key（打乱表）
    MIXIN_KEY_ENC_TAB = [
        46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
        27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
        37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
        22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52
    ]
    raw_key = img_key + sub_key
    mixin_key = "".join(raw_key[n] for n in MIXIN_KEY_ENC_TAB)[:32]

    # 第三步：构造 wbi 签名参数
    import hashlib
    import urllib.parse

    params = {
        "mid": mid,
        "pn": "1",
        "ps": str(max_count),
        "order": "pubdate",
        "platform": "web",
        "web_location": "1550101",
        "wts": str(int(time.time())),
    }
    # 过滤 !'()* 字符
    filtered = {k: str(v).replace("'", "").replace("!", "")
                .replace("(", "").replace(")", "").replace("*", "")
                for k, v in params.items()}
    # 按 key 排序，URL 编码拼接
    sorted_keys = sorted(filtered.keys())
    query = "&".join(f"{k}={urllib.parse.quote(filtered[k], safe='')}" for k in sorted_keys)
    w_rid = hashlib.md5((query + mixin_key).encode("utf-8")).hexdigest()

    # 第四步：请求接口
    url = f"https://api.bilibili.com/x/space/wbi/arc/search?{query}&w_rid={w_rid}"
    try:
        resp = session.get(url, timeout=15)
        data = resp.json()
    except Exception as e:
        raise RuntimeError(f"请求视频列表接口失败：{e}")

    if data.get("code") != 0:
        raise RuntimeError(
            f"视频列表接口错误：code={data.get('code')}, msg={data.get('message')}"
        )

    vlist = data.get("data", {}).get("list", {}).get("vlist", [])
    if not vlist:
        raise RuntimeError("视频列表为空")

    # 规范化
    result = []
    for item in vlist:
        bvid = item.get("bvid", "")
        title = item.get("title", "")
        if not bvid or not title:
            continue
        cover = item.get("pic", "")
        if cover.startswith("//"):
            cover = "https:" + cover

        # created 是秒级时间戳
        created = item.get("created", 0)
        pubdate = created * 1000 if created else int(time.time() * 1000)

        # 时长：B 站 vlist 的 length 是 "mm:ss" 字符串，转成秒数
        length_str = str(item.get("length", "0:0") or "0:0")
        try:
            parts = length_str.split(":")
            if len(parts) == 2:
                duration = int(parts[0]) * 60 + int(parts[1])
            elif len(parts) == 3:
                duration = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
            else:
                duration = int(length_str)
        except (ValueError, TypeError):
            duration = 0

        result.append({
            "bvid": bvid,
            "title": title[:200],
            "description": str(item.get("description", ""))[:500],
            "cover": cover,
            "duration": duration,
            "pubdate": pubdate,
            "tname": str(item.get("tname", ""))[:50],
            "play": int(item.get("play", 0) or 0),
            "videoReview": bool(item.get("isCooperation", False)),
        })

    print(f"[B 站] 抓取成功，共 {len(result)} 条视频")
    return result


def cms_login(base_url: str, username: str, password: str) -> requests.Session:
    """
    登录 CMS 后台，返回带会话的 requests.Session。
    """
    print(f"[CMS] 登录后台：{base_url}")
    session = requests.Session()
    session.headers.update({
        "User-Agent": BILIBILI_UA,
        "X-Requested-With": "XMLHttpRequest",
    })

    try:
        resp = session.post(
            f"{base_url}/api/auth/login",
            json={"username": username, "password": password},
            timeout=10,
        )
        data = resp.json()
    except Exception as e:
        raise RuntimeError(f"登录请求失败：{e}")

    if not data.get("ok"):
        raise RuntimeError(f"登录失败：{data.get('message', data)}")

    print("[CMS] 登录成功")
    return session


def cms_import_videos(session: requests.Session, base_url: str, videos: list, source_label: str):
    """
    调用 CMS 导入接口写入视频数据。
    """
    print(f"[CMS] 导入 {len(videos)} 条视频...")
    try:
        resp = session.post(
            f"{base_url}/api/admin/videos/import",
            json={
                "videos": videos,
                "source": source_label,
            },
            timeout=15,
        )
        data = resp.json()
    except Exception as e:
        raise RuntimeError(f"导入请求失败：{e}")

    if resp.status_code != 200 or not data.get("ok"):
        raise RuntimeError(f"导入失败：HTTP {resp.status}，{data}")

    print(f"[CMS] 导入成功：{data.get('count')} 条，跳过 {data.get('skipped', 0)} 条")
    print(f"[CMS] 版本 ID：{data.get('versionId')}")
    return data


def main():
    # 校验配置
    if not BILIBILI_COOKIE:
        print("错误：请先配置 BILIBILI_COOKIE", file=sys.stderr)
        sys.exit(1)
    if not CMS_USERNAME or not CMS_PASSWORD:
        print("错误：请先配置 CMS_USERNAME 和 CMS_PASSWORD", file=sys.stderr)
        sys.exit(1)
    if not CMS_BASE_URL or CMS_BASE_URL.endswith("/"):
        print("错误：CMS_BASE_URL 不能为空且不要带末尾斜杠", file=sys.stderr)
        sys.exit(1)

    try:
        # 1. 从 B 站抓取
        videos = fetch_bilibili_videos(BILIBILI_MID, BILIBILI_COOKIE, MAX_VIDEOS)

        # 2. 登录 CMS
        cms_session = cms_login(CMS_BASE_URL, CMS_USERNAME, CMS_PASSWORD)

        # 3. 导入
        result = cms_import_videos(cms_session, CMS_BASE_URL, videos, IMPORT_SOURCE)

        print("\n✅ 全部完成！")
        print(f"   导入条数：{result.get('count')}")
        print(f"   数据来源：{result.get('source')}")
        print(f"   版本快照：{result.get('versionId')}")

    except Exception as e:
        print(f"\n❌ 失败：{e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
