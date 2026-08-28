// 测试 B 站不同 playurl 接口返回的画质

const TEST_BVID = 'BV1q8jn6cEo8';

async function getVideoInfo(bvid) {
  const res = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'referer': 'https://www.bilibili.com/',
    }
  });
  const d = await res.json();
  return d.data ? { aid: d.data.aid, cid: d.data.cid, title: d.data.title } : null;
}

async function generateBuvid() {
  const res = await fetch('https://api.bilibili.com/x/frontend/finger/spi', {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'referer': 'https://www.bilibili.com/'
    }
  });
  const data = await res.json();
  if (data?.data?.b_3) return { buvid3: data.data.b_3, buvid4: data.data.b_4 || '' };
  return null;
}

async function testPlayurl(label, url, cookie) {
  console.log(`\n=== ${label} ===`);
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'referer': 'https://www.bilibili.com/',
      'cookie': cookie || '',
    }
  });
  const data = await res.json();
  console.log('code:', data.code, 'msg:', data.message);
  if (data.code !== 0) return;
  
  if (data.data?.dash?.video) {
    console.log('dash 视频流:');
    data.data.dash.video.forEach(v => {
      console.log(`  id=${String(v.id).padStart(4)} ${v.width}x${v.height}  ${v.codecs}`);
    });
  } else if (data.data?.durl) {
    console.log('durl 格式 quality:', data.data.durl[0]?.quality);
  } else {
    console.log('无视频流数据，data keys:', Object.keys(data.data).slice(0, 10));
  }
  
  if (data.data?.accept_quality) {
    console.log('accept_quality:', data.data.accept_quality.join(', '));
  }
  if (data.data?.quality) {
    console.log('quality:', data.data.quality);
  }
}

async function run() {
  const vinfo = await getVideoInfo(TEST_BVID);
  if (!vinfo) { console.log('获取视频信息失败'); return; }
  console.log('视频:', vinfo.title, `aid=${vinfo.aid} cid=${vinfo.cid}`);
  
  const buvid = await generateBuvid();
  const baseCookie = `buvid3=${buvid.buvid3}; buvid4=${buvid.buvid4}; CURRENT_FNVAL=4048; CURRENT_QUALITY=116`;
  
  // 测试各种 playurl 接口
  const { aid, cid } = vinfo;
  
  // 1. 旧版 playurl
  await testPlayurl(
    '旧版 playurl (qn=64 fnval=0)',
    `https://api.bilibili.com/x/player/playurl?avid=${aid}&cid=${cid}&qn=64&fnval=0&fnver=0&fourk=0`,
    baseCookie
  );
  
  // 2. 旧版 playurl + fnval=16 (dash)
  await testPlayurl(
    '旧版 playurl (qn=80 fnval=16 dash)',
    `https://api.bilibili.com/x/player/playurl?avid=${aid}&cid=${cid}&qn=80&fnval=16&fnver=0&fourk=1`,
    baseCookie
  );
  
  // 3. wbi/v2 (不带 wbi 签名试试)
  await testPlayurl(
    'wbi/v2 (qn=116 fnval=4048)',
    `https://api.bilibili.com/x/player/wbi/v2?aid=${aid}&cid=${cid}&qn=116&fnval=4048&fnver=0&fourk=1`,
    baseCookie
  );
  
  // 4. 试试 web 版 playurl
  await testPlayurl(
    'pgc/player/web/playurl',
    `https://api.bilibili.com/pgc/player/web/playurl?avid=${aid}&cid=${cid}&qn=116&fnval=4048&fourk=1`,
    baseCookie
  );
}

run();
