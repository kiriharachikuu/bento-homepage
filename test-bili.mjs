import { writeFileSync } from 'fs';

async function test() {
  const out = [];

  out.push('=== 测试 1: 获取 buvid3 ===');
  const res = await fetch('https://api.bilibili.com/x/frontend/finger/spi', {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'referer': 'https://www.bilibili.com/'
    }
  });
  const data = await res.json();
  out.push('code: ' + data.code);
  out.push('buvid3: ' + (data.data?.b_3 || 'N/A'));
  out.push('buvid4: ' + (data.data?.b_4 || 'N/A'));
  out.push('');

  out.push('=== 测试 2: 抓取 newplayer.html ===');
  const res2 = await fetch('https://www.bilibili.com/blackboard/newplayer.html?crossDomain=true&bvid=BV1PgXLBjEkP&as_wide=1&page=0&autoplay=1&poster=1', {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'referer': 'https://www.bilibili.com/'
    }
  });
  out.push('status: ' + res2.status);
  out.push('x-frame-options: ' + res2.headers.get('x-frame-options'));
  out.push('content-type: ' + res2.headers.get('content-type'));
  const html = await res2.text();
  out.push('html length: ' + html.length);
  out.push('has </head>: ' + html.includes('</head>'));
  out.push('has </body>: ' + html.includes('</body>'));
  
  const apiMatch = html.match(/api\.bilibili\.com[^"'\s]*/g);
  out.push('api.bilibili.com refs: ' + (apiMatch ? apiMatch.length : 0));

  out.push('');
  out.push('=== 测试 3: 用 buvid3 调 playurl 接口 ===');
  const buvid = data.data?.b_3;
  if (buvid) {
    // 先拿 cid
    const cidRes = await fetch('https://api.bilibili.com/x/web-interface/view?bvid=BV1PgXLBjEkP', {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'referer': 'https://www.bilibili.com/',
        'cookie': 'buvid3=' + buvid
      }
    });
    const cidData = await cidRes.json();
    const cid = cidData.data?.cid;
    out.push('cid: ' + cid);

    if (cid) {
      const res3 = await fetch('https://api.bilibili.com/x/player/playurl?bvid=BV1PgXLBjEkP&cid=' + cid + '&qn=116&fnval=4048&fourk=1', {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'referer': 'https://www.bilibili.com/',
          'cookie': 'buvid3=' + buvid + '; buvid_fp_plain=undefined; CURRENT_FNVAL=4048; CURRENT_QUALITY=116'
        }
      });
      const playData = await res3.json();
      out.push('playurl code: ' + playData.code);
      out.push('playurl message: ' + playData.message);
      if (playData.data?.durl) {
        out.push('durl count: ' + playData.data.durl.length);
        out.push('durl[0] size: ' + Math.round(playData.data.durl[0].size / 1024 / 1024) + 'MB');
      } else if (playData.data?.dash) {
        const vids = playData.data.dash.video || [];
        out.push('dash video qualities: ' + vids.map(v => v.id + 'p').join(', '));
      }
    }
  } else {
    out.push('跳过（无 buvid3）');
  }

  writeFileSync('test-result.txt', out.join('\n'), 'utf-8');
  console.log(out.join('\n'));
}

test().catch(e => { console.error('error:', e.message); process.exit(1); });
