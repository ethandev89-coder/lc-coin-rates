// 天堂經典版 全服天幣幣值（DD373）— 書籤程式
// 用法：在電腦版 Chrome／Edge 打開 www.dd373.com 任一頁，按書籤列的「全服幣值」，會自動跑全部伺服器。
// 幣值 = 買 5,000 萬天幣的加權均價（從最便宜的掛單往上買，不看起售）；幣商 = 幣值 − 50。
// 安裝頁 index.html 做出的書籤：放在網站上時是「每次從網站載入這個檔」（改這個檔＝大家自動更新），
// 直接用本機檔案打開時是「整段程式碼塞進書籤」（改了要重新拖一次）。
function lcAllRates() {
  'use strict';
  var HOME = 'https://www.dd373.com/s-q0kacj-khkbh6-s9gju1-0-0-0-7mp223-0-0-0-0-0-1-0-0-0.html';
  if (location.hostname !== 'www.dd373.com') { location.href = HOME; return; }

  var SERVERS = [
    ['s9gju1', '天神宙斯', '天神'], ['jkf6hn', '太陽神阿波羅', '太陽神'], ['mqnn8g', '水蛇許德拉', '水蛇'],
    ['tx17vd', '冥王黑帝斯', '冥王'], ['5wmdmv', '火神赫發斯特斯', '火神'], ['h6s7hd', '收獲女神蒂蜜特', '收獲女神'],
    ['f8kbht', '蛇髮女墨杜沙', '蛇髮'], ['8vfqka', '半人馬涅索斯', '半人馬'], ['7ge16s', '愛神邱比特', '愛神'],
    ['tmmbgw', '勝利女神雅典娜', '雅典娜'], ['sksdr8', '美神維納斯', '美神'], ['r72q3v', '天后海拉', '天后'],
    ['11w878', '戰神馬爾斯', '戰神'], ['3wfqbb', '月亮女神阿緹蜜斯', '月亮女神'], ['6n4mk7', '海神波塞頓', '海神'],
    ['8k682m', '牛人彌諾陶洛斯', '牛人'], ['a9hjb6', '泰坦女神瑞亞', '泰坦'], ['hppe3n', '地獄犬刻耳柏洛斯', '地獄犬'],
    ['16ae95', '獨眼巨人庫克羅普斯', '獨眼巨人'], ['3uecnq', '獅子涅墨亞', '獅子'], ['prr508', '飛馬珀伽索斯', '飛馬'],
    ['9twa8c', '公牛克里特', '公牛']
  ];
  var TARGET = 5000;             // 買多少萬天幣來算均價
  var SPREAD = 50;               // 幣商價差
  var GAP = 3000;                // 每次請求間隔（毫秒），別調太快
  var KEY_FX = 'lcAllRates.fx', KEY_LAST = 'lcAllRates.last', KEY_MAIN = 'lcAllRates.main';

  var old = document.getElementById('lc-allrates-host');
  if (old) {
    if (old.__running) { old.style.display = ''; return; }
    old.remove();
  }

  // 這一頁上如果有新伺服器（不在上面清單裡），也一起抓
  var known = {};
  SERVERS.forEach(function (s) { known[s[0]] = 1; });
  Array.prototype.forEach.call(document.querySelectorAll('a[href]'), function (a) {
    var m = (a.getAttribute('href') || '').match(/s-q0kacj-c-7mp223-khkbh6-([a-z0-9]{6})\.html/);
    var t = (a.textContent || '').trim();
    if (m && !known[m[1]] && /^[一-鿿]{2,12}$/.test(t) && t.indexOf('登') < 0) {
      known[m[1]] = 1; SERVERS.push([m[1], t, t]);
    }
  });

  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function stamp(t) {
    var d = new Date(t), p = function (x) { return (x < 10 ? '0' : '') + x; };
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function pageUrl(code, p) { return '/s-q0kacj-khkbh6-' + code + '-0-0-0-7mp223-0-0-0-0-0-' + p + '-0-0-0.html'; }

  function parse(html) {
    var d = new DOMParser().parseFromString(html, 'text/html');
    var items = d.querySelectorAll('.goods-list-item'), rows = [];
    Array.prototype.forEach.call(items, function (e) {
      var s = e.textContent.replace(/\s+/g, ' ');
      var u = s.match(/1万金=([\d.]+)元/);
      var q = s.match(/起售：\s*([\d.]+)万金\s*库存：\s*([\d.]+)万金/);
      if (u && q) rows.push({ u: +u[1], min: +q[1], stock: +q[2] });
    });
    var m = d.body && d.body.textContent.match(/为您找到\s*(\d+)\s*条/);
    return {
      rows: rows, items: items.length, total: m ? +m[1] : null,
      waf: !items.length && /CF_APP_WAF|waf-nc|验证您是真人/.test(html)
    };
  }

  // 從最便宜的掛單往上買到 5,000 萬（只算庫存 ≥ 50 萬、單價 0.5–8 元/萬 的掛單，排除怪單）
  function calc(rows) {
    var k = rows.filter(function (r) { return r.stock >= 50 && r.u >= 0.5 && r.u <= 8; })
      .sort(function (a, b) { return a.u - b.u; });
    var need = TARGET, q = 0, c = 0, big = 0;
    for (var i = 0; i < k.length && need > 0; i++) {
      var t = Math.min(need, k[i].stock);
      q += t; c += t * k[i].u; need -= t; big = Math.max(big, t);
    }
    return { avg: q ? c / q : null, filled: q, big: big };
  }

  var fx = +load(KEY_FX, 4.941) || 4.941;
  var MAIN = load(KEY_MAIN, 's9gju1');   // 「我的伺服器」，表格裡標黃
  var prev = load(KEY_LAST, null);       // 上一次的結果，拿來算漲跌
  var results = {}, running = false, stopFlag = false, msg = '', ended = null;

  var host = document.createElement('div');
  host.id = 'lc-allrates-host';
  host.style.cssText = 'position:fixed;top:0;right:0;z-index:2147483647;';
  document.documentElement.appendChild(host);
  var root = host.attachShadow({ mode: 'open' });
  root.innerHTML =
    '<style>' +
    ':host{all:initial}' +
    '.p{position:fixed;top:12px;right:12px;width:min(470px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;' +
    'background:#fff;color:#1d1d1f;border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.28);' +
    'font:13px/1.45 "Microsoft JhengHei","PingFang TC","Segoe UI",sans-serif;}' +
    '.hd{position:sticky;top:0;background:#fff;padding:14px 16px 10px;border-bottom:1px solid #e5e5ea;z-index:1}' +
    '.t{font-size:17px;font-weight:700;display:flex;align-items:center;gap:8px}' +
    '.t span{flex:1}.x{border:0;background:#f2f2f7;border-radius:50%;width:28px;height:28px;font-size:16px;cursor:pointer;color:#555}' +
    '.sub{color:#6e6e73;font-size:12px;margin-top:2px}' +
    '.row{display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap}' +
    '.row label{color:#6e6e73;font-size:12px}' +
    'input,select{padding:4px 6px;border:1px solid #d2d2d7;border-radius:6px;font:inherit;background:#fff;color:#1d1d1f}input{width:68px}' +
    'a{color:#0066cc;font-size:12px;text-decoration:none}' +
    '.b{border:0;border-radius:8px;padding:6px 12px;font:inherit;font-weight:600;cursor:pointer;background:#0071e3;color:#fff}' +
    '.b.s{background:#f2f2f7;color:#1d1d1f}.b:disabled{opacity:.45;cursor:default}' +
    '.st{margin-top:8px;font-size:12px;color:#6e6e73}.st.w{color:#b25000;font-weight:600}' +
    '.bar{height:3px;background:#e5e5ea;border-radius:2px;margin-top:6px;overflow:hidden}.bar i{display:block;height:100%;background:#0071e3;width:0}' +
    'table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}' +
    'th{font-size:11px;color:#6e6e73;font-weight:600;text-align:right;padding:8px 6px;border-bottom:1px solid #e5e5ea;position:sticky;top:0;background:#fff}' +
    'td{text-align:right;padding:6px;border-bottom:1px solid #f2f2f7;white-space:nowrap}' +
    'th:nth-child(2),td:nth-child(2){text-align:left}td:first-child,th:first-child{color:#8e8e93;width:22px}' +
    'td.v{font-weight:700}tr.m td{background:#fff8e1}tr.m td.n{font-weight:700}' +
    '.note{display:block;font-size:11px;color:#8e8e93;font-weight:400}' +
    '.up{color:#d70015}.dn{color:#248a3d}.z{color:#8e8e93}' +
    '.ft{padding:10px 16px 14px;color:#8e8e93;font-size:11px;line-height:1.6}' +
    '</style>' +
    '<div class="p"><div class="hd">' +
    '<div class="t"><span>全服天幣幣值</span><button class="x" title="關閉">×</button></div>' +
    '<div class="sub">DD373 掛單・買 5,000 萬天幣的加權均價</div>' +
    '<div class="row"><label>我的伺服器</label><select class="mine"></select>' +
    '<label>人民幣匯率</label><input class="fx" type="number" step="0.001" min="1" max="20">' +
    '<a href="https://rate.bot.com.tw/xrt?Lang=zh-TW" target="_blank" rel="noopener">查臺銀</a></div>' +
    '<div class="row"><button class="b go">開始</button><button class="b s cp" disabled>複製</button></div>' +
    '<div class="st"></div><div class="bar"><i></i></div></div>' +
    '<table><thead><tr><th>#</th><th>伺服器</th><th>幣值</th><th>幣商</th><th>100萬</th><th>跟上次</th></tr></thead><tbody></tbody></table>' +
    '<div class="ft">幣值＝天幣/元；幣商＝幣值 − 50（找幣商買的實際價）；100萬＝用幣商價換算台幣。' +
    '跟上次：<span class="up">▲紅＝天幣變便宜</span>、<span class="dn">▼綠＝變貴</span>。每次請求間隔 3 秒，全部約 1～2 分鐘。</div></div>';

  var $ = function (s) { return root.querySelector(s); };
  $('.mine').innerHTML = SERVERS.map(function (s) {
    return '<option value="' + esc(s[0]) + '"' + (s[0] === MAIN ? ' selected' : '') + '>' + esc(s[2]) + '</option>';
  }).join('');
  $('.mine').addEventListener('change', function () { MAIN = this.value; save(KEY_MAIN, MAIN); render(); });
  $('.fx').value = fx;
  $('.fx').addEventListener('input', function () {
    var v = +this.value;
    if (v > 1 && v < 20) { fx = v; save(KEY_FX, v); render(); }
  });
  $('.x').addEventListener('click', function () { stopFlag = true; host.remove(); });
  $('.go').addEventListener('click', function () { if (running) { stopFlag = true; } else { run(); } });
  $('.cp').addEventListener('click', copy);

  function table() {
    var list = [];
    SERVERS.forEach(function (s) {
      var r = results[s[0]];
      if (!r) return;
      var c = calc(r.rows);
      if (!c.avg) { list.push({ s: s, err: r.err || '沒有掛單' }); return; }
      var rate = 10000 / (fx * c.avg), dealer = rate - SPREAD;
      var p = prev && prev.avg && prev.avg[s[0]];
      list.push({
        s: s, avg: c.avg, rate: rate, dealer: dealer, per100: 1e6 / dealer,
        chg: p ? p / c.avg - 1 : null, filled: c.filled, bigPct: c.big / c.filled
      });
    });
    list.sort(function (a, b) { return (b.rate || 0) - (a.rate || 0); });
    return list;
  }

  function render() {
    var list = table(), html = '', rank = 0;
    list.forEach(function (x) {
      var main = x.s[0] === MAIN ? ' class="m"' : '';
      if (x.err) {
        html += '<tr' + main + '><td></td><td class="n">' + esc(x.s[2]) + '<span class="note">' + esc(x.err) + '</span></td><td>—</td><td>—</td><td>—</td><td>—</td></tr>';
        return;
      }
      rank++;
      var notes = [];
      if (x.filled < TARGET) notes.push('掛單只有 ' + fmt(x.filled) + ' 萬');
      if (x.bigPct >= 0.8) notes.push('一筆大單佔 ' + Math.round(x.bigPct * 100) + '%');
      var chg = '<span class="z">—</span>';
      if (x.chg !== null) {
        var pct = (x.chg * 100).toFixed(1);
        chg = Math.abs(x.chg) < 0.0005 ? '<span class="z">0.0%</span>'
          : x.chg > 0 ? '<span class="up">▲ ' + pct + '%</span>' : '<span class="dn">▼ ' + pct.replace('-', '') + '%</span>';
      }
      html += '<tr' + main + '><td>' + rank + '</td><td class="n">' + esc(x.s[2]) +
        (notes.length ? '<span class="note">' + esc(notes.join('・')) + '</span>' : '') + '</td>' +
        '<td class="v">' + fmt(x.rate) + '</td><td>' + fmt(x.dealer) + '</td><td>NT$' + fmt(x.per100) + '</td><td>' + chg + '</td></tr>';
    });
    $('tbody').innerHTML = html;
    var done = Object.keys(results).length;
    $('.bar i').style.width = (done / SERVERS.length * 100) + '%';
    var st = $('.st');
    st.className = 'st' + (/驗證|失敗/.test(msg) ? ' w' : '');
    st.textContent = msg + (prev && prev.t ? '（跟上次 ' + stamp(prev.t) + ' 比）' : '');
    $('.go').textContent = running ? '停止' : (done ? '重新抓' : '開始');
    $('.cp').disabled = running || !done;
  }

  function copy() {
    var list = table(), n = 0;
    var lines = ['全服天幣幣值 ' + stamp(ended || Date.now()) + '（DD373 買 5,000 萬均價，人民幣 ' + fx + '）'];
    list.forEach(function (x) {
      if (x.err) return;
      n++;
      lines.push(n + '. ' + x.s[2] + ' 1:' + fmt(x.rate) + '（幣商 1:' + fmt(x.dealer) + '，100萬≈NT$' + fmt(x.per100) + '）');
    });
    var text = lines.join('\n');
    var ok = function () { var b = $('.cp'); b.textContent = '已複製'; setTimeout(function () { b.textContent = '複製'; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, function () { window.prompt('複製下面文字：', text); });
    } else { window.prompt('複製下面文字：', text); }
  }

  async function run() {
    running = true; host.__running = true; stopFlag = false; results = {}; ended = null;
    var reqs = 0, blocked = false, failed = 0;
    for (var i = 0; i < SERVERS.length; i++) {
      if (stopFlag) break;
      var s = SERVERS[i];
      msg = '抓取中 ' + (i + 1) + '/' + SERVERS.length + '：' + s[2];
      render();
      var rows = [], total = null, err = null;
      for (var p = 1; p <= 5; p++) {
        if (reqs++ > 0) await sleep(GAP);
        if (stopFlag) break;
        var res;
        try {
          var resp = await fetch(pageUrl(s[0], p), { credentials: 'include', cache: 'no-store' });
          res = parse(await resp.text());
          if (!resp.ok && !res.items) { err = '讀取失敗（' + resp.status + '）'; break; }
        } catch (e) { err = '連線失敗'; break; }
        if (res.waf) { blocked = true; break; }
        if (total === null) total = res.total;
        rows = rows.concat(res.rows);
        var cum = rows.reduce(function (a, r) { return a + r.stock; }, 0);
        if (res.items < 20 || cum >= TARGET) break;
      }
      if (blocked || (stopFlag && !rows.length)) break;
      if (err) failed++;
      results[s[0]] = { rows: rows, total: total, err: err };
    }
    running = false; host.__running = false; ended = Date.now();
    var done = Object.keys(results).length;
    if (blocked) msg = 'DD373 跳出真人驗證，已停在第 ' + (done + 1) + ' 服。請重新整理這頁、自己完成驗證，再按一次書籤。';
    else if (stopFlag) msg = '已停止，抓到 ' + done + '/' + SERVERS.length + ' 服（' + stamp(ended) + '）';
    else msg = '完成 ' + done + ' 服' + (failed ? '，' + failed + ' 服讀取失敗' : '') + '（' + stamp(ended) + '）';
    var avg = {};
    for (var code in results) { var c = calc(results[code].rows); if (c.avg) avg[code] = c.avg; }
    var shownPrev = prev;
    if (Object.keys(avg).length) save(KEY_LAST, { t: ended, avg: Object.assign({}, prev && prev.avg, avg) });
    render();
    prev = load(KEY_LAST, shownPrev);   // 下次重新抓時，跟這次比
  }

  render();
  run();
}

// 書籤從網站載入這個檔時才自動開始（安裝頁自己載入時不會跑）
if (window.__lcAllRatesGo) { window.__lcAllRatesGo = false; lcAllRates(); }
