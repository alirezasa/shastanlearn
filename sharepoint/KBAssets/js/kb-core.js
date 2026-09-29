/* =====================================================================
   پایگاه دانش شستان — هسته (ابزارها، تاریخ شمسی، امن‌سازی HTML، لایه‌ی داده)
   بدون وابستگی و بدون نیاز به build؛ روی مرورگرهای Chrome/Edge/Firefox جدید اجرا می‌شود.
   منبع داده:
     - در شیرپوینت: هندلر سمت سرور  /_layouts/15/KB/KBApi.ashx  (+ REST برای بارگذاری فایل در پنل)
     - در پیش‌نمایش محلی: window.KB_MOCK_API  (preview/kb-mock.js)
   ===================================================================== */
(function (window, document) {
  'use strict';

  var KB = window.KB = window.KB || {};

  /* ------------------------------------------------------------------ پیکربندی */
  var spCtx = window._spPageContextInfo || null;
  var MOCK = !!window.KB_MOCK_API;
  var site = (function () {
    if (typeof window.KB_SITE === 'string' && window.KB_SITE.indexOf('{{') < 0) return window.KB_SITE.replace(/\/$/, '');
    if (spCtx && spCtx.webServerRelativeUrl) return spCtx.webServerRelativeUrl.replace(/\/$/, '');
    var m = location.pathname.match(/^(.*?)\/(KBPages|KBPanel)\//i);
    return m ? m[1] : '';
  })();

  KB.config = {
    mock: MOCK,
    site: site,
    handler: site + '/_layouts/15/KB/KBApi.ashx',
    pageSize: 12,
    pages: MOCK
      ? { home: 'index.html', browse: 'browse.html', content: 'content.html', panel: 'panel.html' }
      : { home: site + '/KBPages/index.aspx', browse: site + '/KBPages/browse.aspx', content: site + '/KBPages/content.aspx', panel: site + '/KBPanel/panel.aspx' }
  };

  KB.url = function (page, params) {
    var base = KB.config.pages[page] || page;
    var q = [];
    if (params) {
      Object.keys(params).forEach(function (k) {
        var v = params[k];
        if (v === undefined || v === null || v === '' || v === false) return;
        q.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
      });
    }
    return base + (q.length ? (base.indexOf('?') < 0 ? '?' : '&') + q.join('&') : '');
  };
  KB.contentUrl = function (id) { return KB.url('content', { id: id }); };
  KB.loginUrl = function () {
    if (MOCK) return '#login';
    return site + '/_layouts/15/Authenticate.aspx?Source=' + encodeURIComponent(location.pathname + location.search + location.hash);
  };
  KB.logoutUrl = function () { return MOCK ? '#logout' : site + '/_layouts/15/SignOut.aspx'; };

  /* ------------------------------------------------------------------ HTML امن */
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"'`]/g, function (c) { return ESC[c]; }); }
  function Raw(s) { this.s = s; }
  Raw.prototype.toString = function () { return this.s; };
  function raw(s) { return new Raw(String(s == null ? '' : s)); }
  function render(v) {
    if (v == null || v === false || v === true) return '';
    if (v instanceof Raw) return v.s;
    if (Array.isArray(v)) return v.map(render).join('');
    return esc(v);
  }
  /** قالب HTML با escape خودکار همه‌ی مقادیر (جلوگیری از XSS) */
  function html(strings) {
    var out = '';
    for (var i = 0; i < strings.length; i++) {
      out += strings[i];
      if (i + 1 < arguments.length) out += render(arguments[i + 1]);
    }
    return new Raw(out);
  }

  /* ------------------------------------------------------------------ DOM */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function mount(el, content) { if (el) el.innerHTML = render(content); return el; }
  function on(root, event, selector, handler) {
    root.addEventListener(event, function (e) {
      var t = e.target && e.target.closest ? e.target.closest(selector) : null;
      if (t && root.contains(t)) handler.call(t, e, t);
    });
  }
  function icon(name, cls) {
    var body = (window.KB_ICONS || {})[name] || (window.KB_ICONS || {})['circle-dot'] || '';
    return raw('<svg class="kb-ico ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>');
  }
  function debounce(fn, ms) {
    var t;
    return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms || 250); };
  }
  function qs(name) { return new URLSearchParams(location.search).get(name); }
  function setQs(params, push) {
    var u = new URL(location.href);
    Object.keys(params).forEach(function (k) {
      var v = params[k];
      if (v === '' || v == null || v === false || (k === 'page' && Number(v) === 1)) u.searchParams.delete(k);
      else u.searchParams.set(k, v);
    });
    history[push ? 'pushState' : 'replaceState'](null, '', u);
  }

  /* ------------------------------------------------------------------ ذخیره‌ی محلی (ایمن) */
  function store(kind) {
    var s = null;
    try { s = window[kind === 'session' ? 'sessionStorage' : 'localStorage']; s.setItem('kb.t', '1'); s.removeItem('kb.t'); } catch (e) { s = null; }
    var mem = {};
    return {
      get: function (k) { try { var v = s ? s.getItem(k) : mem[k]; return v == null ? null : JSON.parse(v); } catch (e) { return null; } },
      set: function (k, v) { try { var j = JSON.stringify(v); if (s) s.setItem(k, j); else mem[k] = j; } catch (e) { /* پر بودن حافظه */ } },
      remove: function (k) { try { if (s) s.removeItem(k); else delete mem[k]; } catch (e) { /* */ } }
    };
  }

  /* ------------------------------------------------------------------ اعداد و تاریخ */
  var FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  function faDigits(s) { return String(s == null ? '' : s).replace(/\d/g, function (d) { return FA_DIGITS[d]; }); }
  function faNum(n) { if (n == null || n === '' || isNaN(n)) return '۰'; return Number(n).toLocaleString('fa-IR'); }
  function compact(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return faDigits((n / 1e6).toFixed(1).replace(/\.0$/, '')) + ' میلیون';
    if (n >= 1e4) return faDigits(Math.round(n / 1e3)) + ' هزار';
    return faNum(n);
  }
  function validDate(d) { return d && !isNaN(new Date(d).getTime()); }
  var fmtLong = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: 'long', day: 'numeric' });
  var fmtShort = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' });
  var fmtTime = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', hour12: false });
  function fmtDate(d) { return validDate(d) ? fmtLong.format(new Date(d)) : '—'; }
  function fmtDateShort(d) { return validDate(d) ? fmtShort.format(new Date(d)) : '—'; }
  function fmtDateTime(d) { return validDate(d) ? fmtShort.format(new Date(d)) + ' — ' + fmtTime.format(new Date(d)) : '—'; }
  function relTime(d) {
    if (!validDate(d)) return '';
    var diff = (Date.now() - new Date(d).getTime()) / 1000;
    if (diff < 0) return fmtDate(d);
    if (diff < 60) return 'لحظاتی پیش';
    if (diff < 3600) return faNum(Math.floor(diff / 60)) + ' دقیقه پیش';
    if (diff < 86400) return faNum(Math.floor(diff / 3600)) + ' ساعت پیش';
    if (diff < 86400 * 7) return faNum(Math.floor(diff / 86400)) + ' روز پیش';
    return fmtDate(d);
  }
  function fileSize(b) {
    b = Number(b) || 0;
    if (b < 1024) return faNum(b) + ' بایت';
    if (b < 1048576) return faDigits((b / 1024).toFixed(0)) + ' کیلوبایت';
    if (b < 1073741824) return faDigits((b / 1048576).toFixed(1).replace(/\.0$/, '')) + ' مگابایت';
    return faDigits((b / 1073741824).toFixed(2)) + ' گیگابایت';
  }

  /* تقویم جلالی (الگوریتم jalaali-js، مجوز MIT) */
  var BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  function div(a, b) { return ~~(a / b); }
  function mod(a, b) { return a - ~~(a / b) * b; }
  function jalCal(jy) {
    var gy = jy + 621, leapJ = -14, jp = BREAKS[0], jump = 0, i, jm, n, leapG, march, leap;
    for (i = 1; i < BREAKS.length; i += 1) {
      jm = BREAKS[i]; jump = jm - jp;
      if (jy < jm) break;
      leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
      jp = jm;
    }
    n = jy - jp;
    leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
    leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    march = 20 + leapJ - leapG;
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;
    return { leap: leap, gy: gy, march: march };
  }
  function g2d(gy, gm, gd) {
    var d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
    return d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  }
  function d2g(jdn) {
    var j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    var i = div(mod(j, 1461), 4) * 5 + 308;
    var gd = div(mod(i, 153), 5) + 1, gm = mod(div(i, 153), 12) + 1;
    return { gy: div(j, 1461) - 100100 + div(8 - gm, 6), gm: gm, gd: gd };
  }
  function j2d(jy, jm, jd) { var r = jalCal(jy); return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1; }
  function d2j(jdn) {
    var gy = d2g(jdn).gy, jy = gy - 621, r = jalCal(jy), k = jdn - g2d(gy, 3, r.march);
    if (k >= 0) {
      if (k <= 185) return { jy: jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
      k -= 186;
    } else { jy -= 1; k += 179; if (r.leap === 1) k += 1; }
    return { jy: jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
  }
  var jalali = {
    MONTHS: ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'],
    WEEKDAYS: ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'],
    from: function (date) { var d = new Date(date); return d2j(g2d(d.getFullYear(), d.getMonth() + 1, d.getDate())); },
    to: function (jy, jm, jd) { var g = d2g(j2d(jy, jm, jd)); return new Date(g.gy, g.gm - 1, g.gd); },
    monthLength: function (jy, jm) { return jm <= 6 ? 31 : jm <= 11 ? 30 : (jalCal(jy).leap === 0 ? 30 : 29); },
    weekday: function (date) { return (new Date(date).getDay() + 1) % 7; }
  };

  /* ------------------------------------------------------------------ متن فارسی */
  function normalizeFa(s) {
    return String(s == null ? '' : s)
      .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[ۀة]/g, 'ه').replace(/[أإآ]/g, 'ا')
      .replace(/[ً-ٰٟ]/g, '').replace(/‌/g, ' ')
      .replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); })
      .replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); })
      .toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function stripHtml(h) {
    var d = document.createElement('div');
    d.innerHTML = String(h || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ');
    return (d.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function readingMinutes(htmlText) {
    var words = stripHtml(htmlText).split(' ').filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }
  function initials(name) {
    var p = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '؟';
    return p[0].charAt(0) + (p.length > 1 ? ' ' + p[p.length - 1].charAt(0) : '');
  }
  function splitTags(v) {
    if (Array.isArray(v)) return v;
    return String(v || '').split(/[,،;؛#\n]+/).map(function (t) { return t.trim(); }).filter(Boolean);
  }

  /* ------------------------------------------------------------------ نوع محتوا / وضعیت */
  var TYPES = [
    { key: 'article', label: 'مقاله', icon: 'file-text', color: '#0284c7', aliases: ['article', 'مقاله', 'متن', 'نوشته', 'blog'] },
    { key: 'video', label: 'ویدیو', icon: 'play-circle', color: '#c22c2c', aliases: ['video', 'ویدیو', 'ویدئو', 'فیلم', 'کلیپ'] },
    { key: 'podcast', label: 'پادکست', icon: 'headphones', color: '#7c3aed', aliases: ['podcast', 'audio', 'پادکست', 'صوت', 'صوتی', 'فایل صوتی'] },
    { key: 'gallery', label: 'گزارش تصویری', icon: 'images', color: '#d97706', aliases: ['gallery', 'photo', 'گالری', 'گالری تصاویر', 'گزارش تصویری', 'تصویر', 'عکس'] },
    { key: 'report', label: 'گزارش', icon: 'chart', color: '#0d9488', aliases: ['report', 'گزارش'] },
    { key: 'guide', label: 'راهنما و آموزش', icon: 'book-open', color: '#008000', aliases: ['guide', 'tutorial', 'how-to', 'راهنما', 'آموزش', 'راهنما و آموزش', 'دستورالعمل'] },
    { key: 'document', label: 'سند و فایل', icon: 'file', color: '#475569', aliases: ['document', 'doc', 'file', 'سند', 'فایل', 'سند و فایل', 'کتاب', 'جزوه'] },
    { key: 'news', label: 'خبر', icon: 'newspaper', color: '#ea580c', aliases: ['news', 'خبر', 'اخبار'] },
    { key: 'infographic', label: 'اینفوگرافیک', icon: 'chart-pie', color: '#db2777', aliases: ['infographic', 'اینفوگرافیک', 'اینفوگرافی'] },
    { key: 'faq', label: 'پرسش و پاسخ', icon: 'help', color: '#4f46e5', aliases: ['faq', 'q&a', 'پرسش و پاسخ', 'پرسش', 'سوال', 'سؤالات متداول'] }
  ];
  var typeIndex = {};
  TYPES.forEach(function (t) { t.aliases.forEach(function (a) { typeIndex[normalizeFa(a)] = t; }); });
  /** اطلاعات نمایشی یک نوع محتوا از روی مقدار ذخیره‌شده (فارسی یا انگلیسی) */
  function typeMeta(value) {
    var t = typeIndex[normalizeFa(value)];
    if (t) return { key: t.key, label: value && !/^[a-z\s-]+$/i.test(value) ? value : t.label, icon: t.icon, color: t.color, value: value };
    return { key: 'other', label: value || 'محتوا', icon: 'file-text', color: '#008000', value: value || '' };
  }
  var PALETTE = ['#008000', '#0284c7', '#c22c2c', '#7c3aed', '#d97706', '#0d9488', '#db2777', '#4f46e5', '#ea580c', '#475569'];
  function colorFor(text) {
    var h = 0, s = String(text || '');
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return PALETTE[h % PALETTE.length];
  }
  var STATUS = { Published: 'منتشرشده', Draft: 'پیش‌نویس', Archived: 'بایگانی', Scheduled: 'زمان‌بندی‌شده' };
  var VISIBILITY = { Public: 'عمومی', Private: 'ویژه‌ی کارکنان' };
  var ROLES = { anonymous: 'مهمان', reader: 'کاربر سازمانی', hr: 'مدیر محتوا (منابع انسانی)', admin: 'مدیر سامانه' };
  function isMediaUrl(u, kind) {
    var ext = String(u || '').split('?')[0].split('#')[0].split('.').pop().toLowerCase();
    var map = { video: ['mp4', 'webm', 'ogv', 'mov', 'm4v'], audio: ['mp3', 'm4a', 'wav', 'ogg', 'oga', 'aac', 'weba'], image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif'] };
    if (kind) return map[kind].indexOf(ext) >= 0;
    for (var k in map) if (map[k].indexOf(ext) >= 0) return k;
    return null;
  }
  /** نام فایل از روی نشانی (برای هندلر: پارامتر name) */
  function fileNameOf(u) {
    u = String(u || '');
    var m = u.match(/[?&]name=([^&#]+)/);
    if (m) { try { return decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch (e) { return m[1]; } }
    var last = u.split('?')[0].split('#')[0].split('/').pop();
    try { return decodeURIComponent(last); } catch (e) { return last; }
  }
  var FILE_KINDS = {
    pdf: { icon: 'file-text', color: '#dc2626' }, doc: { icon: 'file-text', color: '#2563eb' }, docx: { icon: 'file-text', color: '#2563eb' },
    xls: { icon: 'file-sheet', color: '#16a34a' }, xlsx: { icon: 'file-sheet', color: '#16a34a' }, csv: { icon: 'file-sheet', color: '#16a34a' },
    ppt: { icon: 'file', color: '#ea580c' }, pptx: { icon: 'file', color: '#ea580c' },
    zip: { icon: 'file-archive', color: '#a16207' }, rar: { icon: 'file-archive', color: '#a16207' }, '7z': { icon: 'file-archive', color: '#a16207' },
    txt: { icon: 'file-text', color: '#475569' }
  };
  function fileKind(name) {
    var ext = String(name || '').split('.').pop().toLowerCase();
    var media = isMediaUrl(name);
    if (media === 'video') return { icon: 'file-video', color: '#c22c2c', ext: ext };
    if (media === 'audio') return { icon: 'file-audio', color: '#7c3aed', ext: ext };
    if (media === 'image') return { icon: 'file-image', color: '#0d9488', ext: ext };
    var k = FILE_KINDS[ext] || { icon: 'file', color: '#475569' };
    return { icon: k.icon, color: k.color, ext: ext };
  }

  /* ------------------------------------------------------------------ امن‌سازی HTML محتوا */
  var ALLOWED = {
    p: 1, br: 1, hr: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1, strong: 1, b: 1, em: 1, i: 1, u: 1, s: 1, strike: 1, del: 1, ins: 1, mark: 1, small: 1, sub: 1, sup: 1,
    span: 1, div: 1, blockquote: 1, pre: 1, code: 1, ul: 1, ol: 1, li: 1, dl: 1, dt: 1, dd: 1, a: 1, img: 1, figure: 1, figcaption: 1,
    table: 1, thead: 1, tbody: 1, tfoot: 1, tr: 1, th: 1, td: 1, caption: 1, colgroup: 1, col: 1, video: 1, audio: 1, source: 1, font: 1, center: 1, section: 1, article: 1
  };
  var DROP_WITH_CONTENT = { script: 1, style: 1, iframe: 1, object: 1, embed: 1, form: 1, input: 1, button: 1, textarea: 1, select: 1, noscript: 1, template: 1, link: 1, meta: 1, base: 1, svg: 1, math: 1 };
  var ATTRS = { href: 1, src: 1, alt: 1, title: 1, width: 1, height: 1, colspan: 1, rowspan: 1, align: 1, dir: 1, class: 1, style: 1, target: 1, controls: 1, poster: 1, type: 1, 'data-type': 1, 'data-caption': 1, start: 1, color: 1 };
  var SAFE_STYLE = /^(text-align|direction|color|background-color|font-weight|font-style|text-decoration|width|max-width|height|margin(-left|-right|-top|-bottom)?|padding(-left|-right|-top|-bottom)?|border(-collapse)?|vertical-align|float|list-style-type)$/i;
  function safeUrl(u, isSrc) {
    u = String(u || '').trim();
    if (!u) return '';
    if (/^(javascript|vbscript|data):/i.test(u.replace(/[\s\u0000-\u001f]/g, ''))) {
      return isSrc && /^data:image\/(png|jpe?g|gif|webp)[;,]|^data:image\/svg\+xml[;,]/i.test(u) ? u : '';
    }
    return u;
  }
  function cleanNode(node) {
    var children = Array.prototype.slice.call(node.childNodes);
    children.forEach(function (ch) {
      if (ch.nodeType === 8) { ch.remove(); return; }
      if (ch.nodeType !== 1) return;
      var tag = ch.tagName.toLowerCase();
      if (DROP_WITH_CONTENT[tag]) { ch.remove(); return; }
      if (!ALLOWED[tag]) { cleanNode(ch); while (ch.firstChild) ch.parentNode.insertBefore(ch.firstChild, ch); ch.remove(); return; }
      Array.prototype.slice.call(ch.attributes).forEach(function (a) {
        var n = a.name.toLowerCase();
        if (!ATTRS[n] || /^on/i.test(n)) { ch.removeAttribute(a.name); return; }
        if (n === 'href' || n === 'src' || n === 'poster') {
          var v = safeUrl(a.value, n !== 'href');
          if (v) ch.setAttribute(a.name, v); else ch.removeAttribute(a.name);
        } else if (n === 'style') {
          var kept = a.value.split(';').map(function (d) { return d.trim(); }).filter(function (d) {
            var p = d.split(':')[0].trim();
            return p && SAFE_STYLE.test(p) && !/url\s*\(|expression|javascript/i.test(d);
          });
          if (kept.length) ch.setAttribute('style', kept.join('; ')); else ch.removeAttribute('style');
        } else if (n === 'class') {
          var cls = a.value.split(/\s+/).filter(function (c) { return /^kb-/.test(c); }).join(' ');
          if (cls) ch.setAttribute('class', cls); else ch.removeAttribute('class');
        }
      });
      if (tag === 'a') {
        var href = ch.getAttribute('href') || '';
        if (/^https?:\/\//i.test(href) && href.indexOf(location.host) < 0) { ch.setAttribute('target', '_blank'); ch.setAttribute('rel', 'noopener noreferrer'); }
        else ch.removeAttribute('target');
      }
      cleanNode(ch);
    });
  }
  /** HTML ورودی (متن محتوا) → HTML امن. متن ساده (بدون تگ) به پاراگراف تبدیل می‌شود. */
  function sanitizeHtml(input) {
    var s = String(input || '');
    if (!/<[a-z][\s\S]*>/i.test(s)) {
      return s.split(/\n{2,}|\r\n\r\n/).map(function (p) { return p.trim() ? '<p>' + esc(p.trim()).replace(/\n/g, '<br>') + '</p>' : ''; }).join('');
    }
    var doc = new DOMParser().parseFromString('<div>' + s + '</div>', 'text/html');
    var root = doc.body.firstChild;
    // پوشش ExternalClass فیلد Rich Text شیرپوینت
    while (root.childNodes.length === 1 && root.firstChild.nodeType === 1 && /ExternalClass/i.test(root.firstChild.className || '')) root = root.firstChild;
    cleanNode(root);
    return root.innerHTML;
  }

  /* ------------------------------------------------------------------ HTTP */
  function httpError(status, message, extra) {
    var e = new Error(message || 'خطای ارتباط با سرور (' + status + ')');
    e.status = status;
    if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; });
    return e;
  }
  function parseJson(res) {
    return res.text().then(function (t) {
      var j = null;
      try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
      if (!res.ok || (j && j.ok === false)) {
        var msg = (j && (j.message || (j.error && j.error.message && j.error.message.value) || (j['odata.error'] && j['odata.error'].message.value))) || '';
        if (!msg && res.status === 401) msg = 'برای این کار باید وارد سامانه شوید.';
        if (!msg && res.status === 403) msg = 'دسترسی لازم برای این کار را ندارید.';
        throw httpError(res.status, msg, j ? { code: j.code, field: j.field } : null);
      }
      return j;
    });
  }
  /** فراخوانی هندلر پایگاه دانش */
  function callHandler(action, params, body) {
    var q = ['action=' + encodeURIComponent(action)];
    Object.keys(params || {}).forEach(function (k) {
      var v = params[k];
      if (v === undefined || v === null || v === '') return;
      q.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    var url = KB.config.handler + '?' + q.join('&');
    var opt = { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: { Accept: 'application/json', 'X-KB-Request': '1' } };
    if (body) { opt.headers['Content-Type'] = 'application/json; charset=utf-8'; opt.body = JSON.stringify(body); }
    if (!body) url += '&_=' + Date.now();
    return fetch(url, opt).then(parseJson);
  }

  /* REST شیرپوینت (فقط در پنل؛ بارگذاری و حذف فایل‌ها با مجوز خود کاربر) */
  var digest = null;
  function getDigest() {
    if (digest && digest.expires > Date.now()) return Promise.resolve(digest.value);
    return fetch(site + '/_api/contextinfo', { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json;odata=nometadata' } })
      .then(parseJson).then(function (j) {
        digest = { value: j.FormDigestValue, expires: Date.now() + (j.FormDigestTimeoutSeconds - 60) * 1000 };
        return digest.value;
      });
  }
  function rest(path, opt) {
    opt = opt || {};
    var headers = { Accept: 'application/json;odata=nometadata' };
    Object.keys(opt.headers || {}).forEach(function (k) { headers[k] = opt.headers[k]; });
    var p = opt.method && opt.method !== 'GET' ? getDigest() : Promise.resolve(null);
    return p.then(function (d) {
      if (d) headers['X-RequestDigest'] = d;
      return fetch(site + path, { method: opt.method || 'GET', credentials: 'same-origin', headers: headers, body: opt.body });
    }).then(parseJson);
  }
  /** ارسال فایل با گزارش پیشرفت (XHR) */
  function restUpload(path, file, onProgress) {
    return getDigest().then(function (d) {
      return new Promise(function (resolve, reject) {
        var x = new XMLHttpRequest();
        x.open('POST', site + path, true);
        x.withCredentials = true;
        x.setRequestHeader('Accept', 'application/json;odata=nometadata');
        x.setRequestHeader('X-RequestDigest', d);
        if (x.upload && onProgress) x.upload.onprogress = function (e) { if (e.lengthComputable) onProgress(e.loaded / e.total); };
        x.onload = function () {
          var j = null;
          try { j = x.responseText ? JSON.parse(x.responseText) : null; } catch (e) { j = null; }
          if (x.status >= 200 && x.status < 300) resolve(j);
          else {
            var msg = j && ((j['odata.error'] && j['odata.error'].message.value) || (j.error && j.error.message && j.error.message.value));
            if (x.status === 413 || /maximum|size/i.test(msg || '')) msg = 'حجم فایل بیش از حد مجاز شیرپوینت است.';
            reject(httpError(x.status, msg || 'بارگذاری ناموفق بود (' + x.status + ')'));
          }
        };
        x.onerror = function () { reject(httpError(0, 'ارتباط با سرور قطع شد.')); };
        x.send(file);
      });
    });
  }
  var spPath = function (u) { return String(u).replace(/'/g, "''"); };
  /** نام امن فایل برای شیرپوینت */
  function safeFileName(name) {
    var n = String(name || 'file').replace(/[~#%&*{}\\:<>?/+|"']/g, '_').replace(/\s+/g, ' ').replace(/^\.+/, '').trim();
    var dot = n.lastIndexOf('.');
    var base = dot > 0 ? n.slice(0, dot) : n, ext = dot > 0 ? n.slice(dot) : '';
    if (base.length > 90) base = base.slice(0, 90);
    return (base || 'file') + ext.toLowerCase();
  }

  /* ------------------------------------------------------------------ لایه‌ی داده (شیرپوینت) */
  var meta = null; // admin-meta (نام لیست محتوا و نشانی کتابخانه‌ی رسانه)
  function adminMeta() {
    if (meta) return Promise.resolve(meta);
    return callHandler('admin-meta').then(function (m) { meta = m; return m; });
  }
  function listPath() { return '/_api/web/lists/getbytitle(\'' + encodeURIComponent(spPath(meta.contentList)) + '\')'; }

  var spApi = {
    bootstrap: function () { return callHandler('bootstrap'); },
    list: function (p) { return callHandler('list', p); },
    get: function (id, o) { return callHandler('get', { id: id, preview: o && o.preview ? 1 : '' }); },
    view: function (id) { return callHandler('view', {}, { id: id }).catch(function () { return null; }); },
    react: function (id, kind) { return callHandler('react', {}, { id: id, kind: kind }); },
    comments: function (id) { return callHandler('comments', { id: id }); },
    addComment: function (id, body, parentId) { return callHandler('comment', {}, { id: id, body: body, parentId: parentId || 0 }); },
    deleteComment: function (cid) { return callHandler('comment-delete', {}, { id: cid }); },

    adminDashboard: function () { return callHandler('admin-dashboard'); },
    adminList: function (p) { return callHandler('admin-list', p); },
    adminGet: function (id) { return callHandler('admin-get', { id: id }); },
    adminSave: function (data) { return callHandler('admin-save', {}, data); },
    adminStatus: function (ids, status, extra) {
      var b = { ids: ids };
      if (status) b.status = status;
      Object.keys(extra || {}).forEach(function (k) { b[k] = extra[k]; });
      return callHandler('admin-status', {}, b);
    },
    adminDelete: function (ids) { return callHandler('admin-delete', {}, { ids: ids }); },
    adminDuplicate: function (id) { return callHandler('admin-duplicate', {}, { id: id }); },
    adminComments: function (p) { return callHandler('admin-comments', p); },
    adminCommentStatus: function (ids, status) { return callHandler('admin-comment-status', {}, { ids: ids, status: status }); },
    adminCommentDelete: function (ids) { return callHandler('admin-comment-delete', {}, { ids: ids }); },
    adminCategories: function () { return callHandler('admin-categories'); },
    adminCategorySave: function (c) { return callHandler('admin-category-save', {}, c); },
    adminCategoryDelete: function (id) { return callHandler('admin-category-delete', {}, { id: id }); },
    adminAuthors: function () { return callHandler('admin-authors'); },
    adminMeta: adminMeta,
    adminSettings: function () { return callHandler('admin-settings'); },
    adminSettingsSave: function (v) { return callHandler('admin-settings-save', {}, { settings: v }); },
    adminAudit: function (p) { return callHandler('admin-audit', p); },

    uploadAttachment: function (itemId, file, onProgress) {
      return adminMeta().then(function () {
        var name = safeFileName(file.name);
        return restUpload(listPath() + '/items(' + Number(itemId) + ')/AttachmentFiles/add(FileName=\'' + encodeURIComponent(spPath(name)) + '\')', file, onProgress)
          .then(function (j) { return { name: (j && j.FileName) || name, url: (j && j.ServerRelativeUrl) || '', size: file.size }; });
      });
    },
    deleteAttachment: function (itemId, name) {
      return adminMeta().then(function () {
        return rest(listPath() + '/items(' + Number(itemId) + ')/AttachmentFiles/getByFileName(\'' + encodeURIComponent(spPath(name)) + '\')', { method: 'POST', headers: { 'X-HTTP-Method': 'DELETE' } });
      });
    },
    mediaList: function (folderUrl) {
      return adminMeta().then(function (m) {
        var url = folderUrl || m.mediaUrl;
        var path = '/_api/web/GetFolderByServerRelativeUrl(\'' + encodeURIComponent(spPath(url)) + '\')';
        return Promise.all([
          rest(path + '?$select=Name,ServerRelativeUrl'),
          rest(path + '/Folders?$select=Name,ServerRelativeUrl,ItemCount,TimeLastModified'),
          rest(path + '/Files?$select=Name,ServerRelativeUrl,Length,TimeLastModified,TimeCreated&$top=2000')
        ]).then(function (r) {
          return {
            root: m.mediaUrl, folder: { name: r[0].Name, url: r[0].ServerRelativeUrl },
            folders: (r[1].value || []).filter(function (f) { return f.Name !== 'Forms' && f.Name.charAt(0) !== '_'; })
              .map(function (f) { return { name: f.Name, url: f.ServerRelativeUrl, count: f.ItemCount, modified: f.TimeLastModified }; }),
            files: (r[2].value || []).map(function (f) { return { name: f.Name, url: f.ServerRelativeUrl, size: Number(f.Length), modified: f.TimeLastModified }; })
          };
        });
      });
    },
    mediaUpload: function (folderUrl, file, onProgress) {
      return adminMeta().then(function (m) {
        var folder = folderUrl || m.mediaUrl;
        var name = safeFileName(file.name);
        var path = '/_api/web/GetFolderByServerRelativeUrl(\'' + encodeURIComponent(spPath(folder)) + '\')/Files/add(url=\'' + encodeURIComponent(spPath(name)) + '\',overwrite=false)?$select=Name,ServerRelativeUrl,Length';
        return restUpload(path, file, onProgress).catch(function (e) {
          if (e.status !== 400 && e.status !== 409 && e.status !== 500) throw e;
          // فایل هم‌نام وجود دارد → نام یکتا
          var dot = name.lastIndexOf('.');
          name = (dot > 0 ? name.slice(0, dot) : name) + '-' + Date.now().toString(36) + (dot > 0 ? name.slice(dot) : '');
          path = '/_api/web/GetFolderByServerRelativeUrl(\'' + encodeURIComponent(spPath(folder)) + '\')/Files/add(url=\'' + encodeURIComponent(spPath(name)) + '\',overwrite=false)?$select=Name,ServerRelativeUrl,Length';
          return restUpload(path, file, onProgress);
        }).then(function (j) { return { name: j.Name, url: j.ServerRelativeUrl, size: Number(j.Length) || file.size, modified: new Date().toISOString() }; });
      });
    },
    mediaDelete: function (url) {
      return rest('/_api/web/GetFileByServerRelativeUrl(\'' + encodeURIComponent(spPath(url)) + '\')/recycle()', { method: 'POST' });
    },
    mediaCreateFolder: function (parentUrl, name) {
      var clean = safeFileName(name).replace(/\./g, '_');
      return rest('/_api/web/folders/add(\'' + encodeURIComponent(spPath(parentUrl + '/' + clean)) + '\')', { method: 'POST' });
    },
    /** کپی یک فایل عمومی (کتابخانه‌ی رسانه) به پیوست‌های محتوا — برای محتوای خصوصی */
    copyToAttachment: function (itemId, url) {
      return fetch(url, { credentials: 'same-origin' }).then(function (r) {
        if (!r.ok) throw httpError(r.status, 'دریافت فایل ناموفق بود: ' + fileNameOf(url));
        return r.blob();
      }).then(function (blob) {
        var f = new File([blob], fileNameOf(url), { type: blob.type });
        return spApi.uploadAttachment(itemId, f);
      });
    }
  };

  KB.api = MOCK ? window.KB_MOCK_API : spApi;

  /* ------------------------------------------------------------------ خروجی */
  KB.util = {
    esc: esc, html: html, raw: raw, render: render, $: $, $$: $$, mount: mount, on: on, icon: icon, debounce: debounce, qs: qs, setQs: setQs,
    store: store, faNum: faNum, faDigits: faDigits, compact: compact, fmtDate: fmtDate, fmtDateShort: fmtDateShort, fmtDateTime: fmtDateTime,
    relTime: relTime, fileSize: fileSize, validDate: validDate, jalali: jalali, normalizeFa: normalizeFa, stripHtml: stripHtml,
    readingMinutes: readingMinutes, initials: initials, splitTags: splitTags, typeMeta: typeMeta, colorFor: colorFor, isMediaUrl: isMediaUrl,
    fileNameOf: fileNameOf, fileKind: fileKind, sanitizeHtml: sanitizeHtml, safeFileName: safeFileName, safeUrl: safeUrl
  };
  KB.TYPES = TYPES;
  KB.STATUS = STATUS;
  KB.VISIBILITY = VISIBILITY;
  KB.ROLES = ROLES;
  KB.local = store('local');
  KB.session = store('session');
})(window, document);
