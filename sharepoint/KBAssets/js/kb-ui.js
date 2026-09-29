/* =====================================================================
   پایگاه دانش شستان — رابط کاربری مشترک (هدر، فوتر، کارت‌ها، مودال، توست، لایت‌باکس)
   ===================================================================== */
(function (window, document) {
  'use strict';
  var KB = window.KB;
  var U = KB.util, html = U.html, raw = U.raw, icon = U.icon, esc = U.esc;

  var ui = KB.ui = {};

  /* ------------------------------------------------------------------ داده‌های سراسری */
  KB.state = { user: { role: 'anonymous', anonymous: true }, settings: {}, categories: [], types: [], tags: [], stats: {} };
  KB.can = {
    manage: function () { var r = KB.state.user.role; return r === 'hr' || r === 'admin'; },
    admin: function () { return KB.state.user.role === 'admin'; },
    login: function () { return !KB.state.user.anonymous; }
  };
  KB.setting = function (key, fallback) {
    var v = KB.state.settings && KB.state.settings[key];
    return v == null || v === '' ? fallback : v;
  };
  KB.cat = function (title) {
    var found = (KB.state.categories || []).filter(function (c) { return c.title === title; })[0];
    return found || { title: title || 'بدون دسته', icon: 'folder', color: U.colorFor(title), description: '', count: 0 };
  };

  /* ------------------------------------------------------------------ اجزای کوچک */
  ui.avatar = function (name, img, cls) {
    if (img) return html`<span class="kb-avatar ${cls || ''}"><img src="${img}" alt="" loading="lazy" class="kb-img"></span>`;
    return html`<span class="kb-avatar ${cls || ''}" aria-hidden="true">${U.initials(name)}</span>`;
  };
  ui.typeBadge = function (value, soft) {
    var t = U.typeMeta(value);
    return html`<span class="kb-type ${soft ? 'kb-type-soft' : ''}" style="--t:${t.color}">${icon(t.icon)}${t.label}</span>`;
  };
  ui.placeholder = function (item) {
    var t = U.typeMeta(item && item.type);
    return html`<span class="kb-thumb-ph" style="--t:${t.color}">${icon(t.icon)}</span>`;
  };
  ui.thumb = function (item, cls) {
    var t = U.typeMeta(item.type);
    var media = t.key === 'video' || t.key === 'podcast' || U.isMediaUrl(item.media, 'video') || U.isMediaUrl(item.media, 'audio');
    return html`<a class="kb-thumb ${cls || ''}" href="${KB.contentUrl(item.id)}" tabindex="-1" aria-hidden="true">
      ${item.thumb ? html`<img class="kb-img" src="${item.thumb}" alt="" loading="lazy" data-type="${item.type || ''}">` : ui.placeholder(item)}
      ${ui.typeBadge(item.type)}
      <span class="kb-thumb-flags">${item.visibility === 'Private' ? html`<span class="kb-badge kb-badge-dark" title="ویژه‌ی کارکنان">${icon('lock')}</span>` : ''}${item.featured ? html`<span class="kb-badge kb-badge-dark" title="ویژه">${icon('star')}</span>` : ''}</span>
      ${media ? html`<span class="kb-play">${icon('play')}</span>` : ''}
    </a>`;
  };
  ui.authorMini = function (a) {
    if (!a || !a.name) return '';
    return html`<span class="kb-author-mini">${a.image ? html`<img class="kb-img" src="${a.image}" alt="" loading="lazy">` : ui.avatar(a.name)}<span>${a.name}</span></span>`;
  };
  ui.meta = function (item, opts) {
    opts = opts || {};
    return html`<div class="kb-meta">
      <span title="تاریخ انتشار">${icon('calendar')}${U.fmtDate(item.publishAt || item.created)}</span>
      ${item.minutes ? html`<span title="زمان مطالعه">${icon('clock')}${U.faNum(item.minutes)} دقیقه</span>` : ''}
      <span title="بازدید">${icon('eye')}${U.compact(item.views)}</span>
      ${opts.full ? html`<span title="پسند">${icon('heart')}${U.faNum(item.likes)}</span><span title="نظر">${icon('message')}${U.faNum(item.comments)}</span>` : ''}
    </div>`;
  };

  /** کارت محتوا */
  ui.card = function (item) {
    var cat = item.category ? KB.cat(item.category) : null;
    return html`<article class="kb-post">
      ${ui.thumb(item)}
      <div class="kb-post-body">
        ${cat ? html`<a class="kb-post-cat" href="${KB.url('browse', { cat: cat.title })}">${icon(cat.icon, 'kb-ico-sm')}${cat.title}</a>` : ''}
        <h3><a class="kb-post-stretch" href="${KB.contentUrl(item.id)}">${item.title}</a></h3>
        ${item.summary ? html`<p class="kb-clamp-3">${item.summary}</p>` : html`<p></p>`}
        ${ui.meta(item)}
        <div class="kb-row kb-post-foot">
          ${ui.authorMini(item.author)}
          <span class="kb-meta"><span title="پسند">${icon('heart')}${U.faNum(item.likes)}</span><span title="نظر">${icon('message')}${U.faNum(item.comments)}</span></span>
        </div>
      </div>
    </article>`;
  };
  ui.cards = function (items, layout) {
    return html`<div class="${layout === 'list' ? 'kb-list' : 'kb-grid'}">${items.map(ui.card)}</div>`;
  };
  ui.rankList = function (items, metric) {
    return html`<div class="kb-rank">${items.map(function (it, i) {
      return html`<div class="kb-rank-item">
        <span class="kb-rank-num">${U.faNum(i + 1)}</span>
        <a class="kb-rank-thumb" href="${KB.contentUrl(it.id)}" tabindex="-1" aria-hidden="true">${it.thumb ? html`<img class="kb-img" src="${it.thumb}" alt="" loading="lazy" data-type="${it.type || ''}">` : ui.placeholder(it)}</a>
        <div class="kb-grow">
          <a class="kb-rank-title kb-clamp-2" href="${KB.contentUrl(it.id)}">${it.title}</a>
          <div class="kb-meta">${metric === 'likes' ? html`<span>${icon('heart')}${U.faNum(it.likes)} پسند</span>` : html`<span>${icon('eye')}${U.compact(it.views)} بازدید</span>`}<span>${U.typeMeta(it.type).label}</span></div>
        </div>
      </div>`;
    })}</div>`;
  };
  ui.skeletonCards = function (n) {
    var a = [];
    for (var i = 0; i < (n || 6); i++) a.push(html`<div class="kb-skel kb-skel-card"></div>`);
    return html`<div class="kb-grid">${a}</div>`;
  };
  ui.empty = function (ic, title, text, action) {
    return html`<div class="kb-empty"><div class="kb-empty-icon">${icon(ic || 'inbox')}</div><h3>${title}</h3>${text ? html`<p>${text}</p>` : ''}${action || ''}</div>`;
  };
  ui.errorBox = function (e, retry) {
    return html`<div class="kb-empty"><div class="kb-empty-icon" style="background:#fdf2f2;color:#c22c2c">${icon('alert')}</div>
      <h3>بارگذاری انجام نشد</h3><p>${(e && e.message) || 'خطای ناشناخته'}</p>
      ${retry ? html`<button type="button" class="kb-btn kb-btn-ghost" data-kb-retry>${icon('refresh')}تلاش دوباره</button>` : ''}</div>`;
  };
  ui.pager = function (page, pages) {
    if (pages <= 1) return '';
    var nums = [];
    for (var i = 1; i <= pages; i++) {
      if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i);
      else if (nums[nums.length - 1] !== '…') nums.push('…');
    }
    return html`<nav class="kb-pager" aria-label="صفحه‌بندی">
      <button type="button" data-page="${page - 1}" ${page <= 1 ? raw('disabled') : ''} aria-label="صفحه‌ی قبل">${icon('chevron-right')}</button>
      ${nums.map(function (n) { return n === '…' ? html`<span>…</span>` : html`<button type="button" data-page="${n}" ${n === page ? raw('aria-current="page"') : ''}>${U.faNum(n)}</button>`; })}
      <button type="button" data-page="${page + 1}" ${page >= pages ? raw('disabled') : ''} aria-label="صفحه‌ی بعد">${icon('chevron-left')}</button>
    </nav>`;
  };
  ui.bindPager = function (root, cb) {
    U.on(root, 'click', '.kb-pager [data-page]', function (e, b) { e.preventDefault(); if (!b.disabled) cb(Number(b.getAttribute('data-page'))); });
  };

  /* ------------------------------------------------------------------ توست / مودال */
  function app() { return document.getElementById('kb-app') || document.body; }
  ui.toast = function (msg, type) {
    var wrap = document.querySelector('#kb-app .kb-toasts');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'kb-toasts'; wrap.setAttribute('role', 'status'); wrap.setAttribute('aria-live', 'polite'); app().appendChild(wrap); }
    var t = document.createElement('div');
    t.className = 'kb-toast ' + (type === 'error' ? 'is-error' : 'is-ok');
    U.mount(t, html`${icon(type === 'error' ? 'alert' : 'check')}<span>${msg}</span>`);
    wrap.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(function () { t.remove(); }, 320); }, type === 'error' ? 6000 : 3200);
  };
  ui.modal = function (opts) {
    var last = document.activeElement;
    var back = document.createElement('div');
    back.className = 'kb-modal-backdrop';
    U.mount(back, html`<div class="kb-modal ${opts.size ? 'kb-modal-' + opts.size : ''}" role="dialog" aria-modal="true" aria-label="${opts.title}">
      <div class="kb-modal-head"><h3>${opts.icon ? icon(opts.icon) : ''}${opts.title}</h3><button type="button" class="kb-btn kb-btn-soft kb-btn-icon kb-btn-sm" data-kb-close aria-label="بستن">${icon('x')}</button></div>
      <div class="kb-modal-body">${opts.body || ''}</div>
      ${opts.foot ? html`<div class="kb-modal-foot">${opts.foot}</div>` : ''}
    </div>`);
    app().appendChild(back);
    document.documentElement.style.overflow = 'hidden';
    var closed = false;
    function close(val) {
      if (closed) return;
      closed = true;
      back.remove();
      if (!document.querySelector('#kb-app .kb-modal-backdrop')) document.documentElement.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      if (last && last.focus) try { last.focus(); } catch (e) { /* */ }
      if (opts.onClose) opts.onClose(val);
    }
    function onKey(e) { if (e.key === 'Escape' && back === Array.prototype.slice.call(document.querySelectorAll('#kb-app .kb-modal-backdrop')).pop()) close(); }
    document.addEventListener('keydown', onKey);
    back.addEventListener('mousedown', function (e) { if (e.target === back && !opts.sticky) close(); });
    U.on(back, 'click', '[data-kb-close]', function () { close(); });
    var modal = back.firstChild;
    setTimeout(function () { var f = modal.querySelector('[autofocus], input:not([type=hidden]), textarea, select, button.kb-btn-brand'); (f || modal).focus && (f || modal).focus(); }, 30);
    return { el: modal, body: modal.querySelector('.kb-modal-body'), close: close };
  };
  ui.confirm = function (message, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var m = ui.modal({
        title: opts.title || 'تأیید', icon: opts.danger ? 'alert' : 'help',
        body: html`<p style="font-size:15px;line-height:2">${message}</p>${opts.detail ? html`<p class="kb-hint">${opts.detail}</p>` : ''}`,
        foot: html`<button type="button" class="kb-btn ${opts.danger ? 'kb-btn-accent' : 'kb-btn-brand'}" data-ok>${opts.ok || 'تأیید'}</button><button type="button" class="kb-btn kb-btn-ghost" data-kb-close>انصراف</button>`,
        onClose: function (v) { resolve(!!v); }
      });
      m.el.querySelector('[data-ok]').addEventListener('click', function () { m.close(true); });
    });
  };
  ui.prompt = function (title, label, value) {
    return new Promise(function (resolve) {
      var m = ui.modal({
        title: title,
        body: html`<form data-f><label class="kb-label" for="kb-prompt">${label}</label><input id="kb-prompt" class="kb-input" value="${value || ''}" autofocus></form>`,
        foot: html`<button type="button" class="kb-btn kb-btn-brand" data-ok>تأیید</button><button type="button" class="kb-btn kb-btn-ghost" data-kb-close>انصراف</button>`,
        onClose: function (v) { resolve(v == null ? null : v); }
      });
      function ok(e) { if (e) e.preventDefault(); var v = m.el.querySelector('input').value.trim(); if (v) m.close(v); }
      m.el.querySelector('[data-ok]').addEventListener('click', ok);
      m.el.querySelector('[data-f]').addEventListener('submit', ok);
    });
  };
  ui.busy = function (btn, on) {
    if (!btn) return;
    if (on) { btn.classList.add('is-busy'); btn.setAttribute('aria-busy', 'true'); btn.dataset.html = btn.innerHTML; btn.innerHTML = icon('loader', 'kb-spin') + '<span>' + esc(btn.textContent.trim()) + '</span>'; }
    else { btn.classList.remove('is-busy'); btn.removeAttribute('aria-busy'); if (btn.dataset.html) btn.innerHTML = btn.dataset.html; }
  };

  /* ------------------------------------------------------------------ لایت‌باکس تصاویر */
  ui.lightbox = function (images, index) {
    var i = index || 0;
    var box = document.createElement('div');
    box.className = 'kb-lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'نمایش تصویر');
    function draw() {
      var im = images[i];
      U.mount(box, html`<img src="${im.src}" alt="${im.alt || ''}">
        <button type="button" class="kb-btn kb-btn-icon kb-lightbox-close" aria-label="بستن">${icon('x')}</button>
        ${images.length > 1 ? html`<button type="button" class="kb-btn kb-btn-icon kb-lightbox-prev" aria-label="قبلی">${icon('chevron-right')}</button><button type="button" class="kb-btn kb-btn-icon kb-lightbox-next" aria-label="بعدی">${icon('chevron-left')}</button>` : ''}
        <div class="kb-lightbox-cap">${im.alt ? html`${im.alt} — ` : ''}${U.faNum(i + 1)} از ${U.faNum(images.length)}</div>`);
    }
    function go(d) { i = (i + d + images.length) % images.length; draw(); }
    function close() { box.remove(); document.removeEventListener('keydown', key); document.documentElement.style.overflow = ''; }
    function key(e) { if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft') go(1); if (e.key === 'ArrowRight') go(-1); }
    box.addEventListener('click', function (e) {
      if (e.target.closest('.kb-lightbox-prev')) go(-1);
      else if (e.target.closest('.kb-lightbox-next')) go(1);
      else if (e.target.tagName !== 'IMG') close();
    });
    document.addEventListener('keydown', key);
    draw();
    app().appendChild(box);
    document.documentElement.style.overflow = 'hidden';
  };

  /* ------------------------------------------------------------------ منوهای کشویی */
  function closeDropdowns(except) {
    U.$$('#kb-app [data-kb-dd][aria-expanded="true"]').forEach(function (b) {
      if (b === except) return;
      b.setAttribute('aria-expanded', 'false');
      var m = document.getElementById(b.getAttribute('aria-controls'));
      if (m) m.hidden = true;
    });
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('#kb-app [data-kb-dd]');
    if (btn) {
      e.preventDefault();
      var menu = document.getElementById(btn.getAttribute('aria-controls'));
      var open = btn.getAttribute('aria-expanded') !== 'true';
      closeDropdowns(btn);
      btn.setAttribute('aria-expanded', String(open));
      if (menu) menu.hidden = !open;
      return;
    }
    if (!e.target.closest || !e.target.closest('#kb-app .kb-dropdown')) closeDropdowns();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDropdowns(); });

  // تصویر خراب → جای‌گزین
  document.addEventListener('error', function (e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG' || !img.classList.contains('kb-img') || img.dataset.failed) return;
    img.dataset.failed = '1';
    var host = img.parentNode;
    if (host && (host.classList.contains('kb-thumb') || host.classList.contains('kb-rank-thumb') || host.classList.contains('kb-slide') || host.classList.contains('kb-row-thumb'))) {
      var tmp = document.createElement('span');
      tmp.innerHTML = String(ui.placeholder({ type: img.getAttribute('data-type') || '' }));
      host.replaceChild(tmp.firstChild, img);
    } else if (host && host.classList.contains('kb-avatar')) {
      img.remove();
    } else img.style.visibility = 'hidden';
  }, true);

  /* ------------------------------------------------------------------ جستجوی سریع */
  ui.bindSearch = function (form, opts) {
    opts = opts || {};
    var input = form.querySelector('input');
    var box = document.createElement('div');
    box.className = 'kb-suggest';
    box.hidden = true;
    box.setAttribute('role', 'listbox');
    form.appendChild(box);
    var seq = 0, focus = -1;
    function go(q) { location.href = KB.url('browse', { q: q }); }
    function highlight(text, q) {
      var s = esc(text);
      U.normalizeFa(q).split(' ').filter(function (w) { return w.length > 1; }).forEach(function (w) {
        try { s = s.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>'); } catch (e) { /* */ }
      });
      return raw(s);
    }
    var run = U.debounce(function () {
      var q = input.value.trim();
      if (q.length < 2) { box.hidden = true; return; }
      var my = ++seq;
      KB.api.list({ q: q, size: 6 }).then(function (r) {
        if (my !== seq) return;
        focus = -1;
        U.mount(box, r.items.length
          ? html`${r.items.map(function (it) {
            return html`<a class="kb-suggest-item" role="option" href="${KB.contentUrl(it.id)}">
              ${it.thumb ? html`<img class="kb-img" src="${it.thumb}" alt="" loading="lazy">` : html`<span class="kb-suggest-thumb">${ui.placeholder(it)}</span>`}
              <span class="kb-grow"><span class="kb-clamp-2">${highlight(it.title, q)}</span><small>${U.typeMeta(it.type).label}${it.category ? html` • ${it.category}` : ''}</small></span></a>`;
          })}<a class="kb-suggest-all" href="${KB.url('browse', { q: q })}">${icon('search')}مشاهده‌ی همه‌ی ${U.faNum(r.total)} نتیجه</a>`
          : html`<div class="kb-empty" style="padding:18px"><p>نتیجه‌ای برای «${q}» پیدا نشد.</p></div>`);
        box.hidden = false;
      }).catch(function () { box.hidden = true; });
    }, 250);
    input.addEventListener('input', run);
    input.addEventListener('focus', function () { if (box.innerHTML && input.value.trim().length > 1) box.hidden = false; });
    input.addEventListener('keydown', function (e) {
      var items = U.$$('.kb-suggest-item', box);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (box.hidden || !items.length) return;
        e.preventDefault();
        focus = (focus + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach(function (x, i) { x.classList.toggle('is-focus', i === focus); });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (focus >= 0 && items[focus] && !box.hidden) location.href = items[focus].href;
        else if (input.value.trim()) (opts.onSubmit || go)(input.value.trim());
      } else if (e.key === 'Escape') box.hidden = true;
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); if (input.value.trim()) (opts.onSubmit || go)(input.value.trim()); });
    document.addEventListener('click', function (e) { if (!form.contains(e.target)) box.hidden = true; });
  };

  /* ------------------------------------------------------------------ هدر و فوتر */
  function navLinks(page) {
    var types = KB.state.types || [];
    var has = function (key) { return types.filter(function (t) { return U.typeMeta(t.value).key === key; })[0]; };
    var links = [
      { href: KB.url('home'), label: 'خانه', icon: 'home', active: page === 'home' },
      { href: KB.url('browse'), label: 'همه‌ی محتوا', icon: 'library', active: page === 'browse' && !U.qs('type') && !U.qs('saved') && !U.qs('cat') }
    ];
    ['video', 'podcast', 'guide'].forEach(function (k) {
      var t = has(k);
      if (t) links.push({ href: KB.url('browse', { type: t.value }), label: k === 'guide' ? 'راهنماها' : U.typeMeta(t.value).label + 'ها', icon: U.typeMeta(t.value).icon, active: page === 'browse' && U.qs('type') === t.value });
    });
    return links;
  }
  function renderHeader(page) {
    var user = KB.state.user;
    var title = KB.setting('SiteTitle', 'پایگاه دانش شستان');
    var sub = KB.setting('SiteSubtitle', 'دانش سازمانی شستان');
    var cats = (KB.state.categories || []).filter(function (c) { return c.count > 0 || KB.can.manage(); }).slice(0, 12);
    var links = navLinks(page);
    return html`<header class="kb-header" id="kb-header">
      <div class="kb-container kb-header-inner">
        <button type="button" class="kb-btn kb-btn-icon kb-menu-toggle" data-kb-drawer aria-label="منو">${icon('menu')}</button>
        <a class="kb-logo" href="${KB.url('home')}"><span class="kb-logo-mark">${icon('lightbulb')}</span><span><b>${title}</b><small>${sub}</small></span></a>
        <nav class="kb-nav" aria-label="منوی اصلی">
          ${links.slice(0, 2).map(function (l) { return html`<a class="kb-nav-link ${l.active ? 'is-active' : ''}" href="${l.href}">${l.label}</a>`; })}
          ${cats.length ? html`<div class="kb-nav-item">
            <button type="button" class="kb-nav-link ${page === 'browse' && U.qs('cat') ? 'is-active' : ''}" data-kb-dd aria-controls="kb-dd-cats" aria-expanded="false">دسته‌بندی‌ها ${icon('chevron-down', 'kb-ico-sm')}</button>
            <div class="kb-dropdown kb-mega" id="kb-dd-cats" hidden>
              ${cats.map(function (c) {
                return html`<a class="kb-mega-item" href="${KB.url('browse', { cat: c.title })}"><span class="kb-cat-icon" style="--c:${c.color};background:#f3f5f7;color:${c.color};width:38px;height:38px;border-radius:11px;display:grid;place-items:center">${icon(c.icon)}</span><span><b>${c.title}</b><span>${U.faNum(c.count)} محتوا</span></span></a>`;
              })}
            </div>
          </div>` : ''}
          ${links.slice(2).map(function (l) { return html`<a class="kb-nav-link ${l.active ? 'is-active' : ''}" href="${l.href}">${l.label}</a>`; })}
        </nav>
        <form class="kb-header-search" role="search" id="kb-header-search" action="${KB.url('browse')}">
          ${icon('search')}<input type="search" name="q" placeholder="جستجو در پایگاه دانش…" aria-label="جستجو" autocomplete="off" value="${page === 'browse' ? U.qs('q') || '' : ''}">
        </form>
        <div class="kb-header-actions">
          <button type="button" class="kb-btn kb-btn-icon kb-search-toggle" data-kb-search-toggle aria-label="جستجو">${icon('search')}</button>
          ${user.anonymous
            ? html`<a class="kb-btn kb-btn-white kb-btn-sm" href="${KB.loginUrl()}" data-kb-login>${icon('log-in')}<span class="kb-hide-sm">ورود کارکنان</span></a>`
            : html`<div class="kb-nav-item">
              <button type="button" class="kb-user-btn" data-kb-dd aria-controls="kb-dd-user" aria-expanded="false">${ui.avatar(user.name)}<span class="kb-user-name">${user.name}</span>${icon('chevron-down', 'kb-ico-sm')}</button>
              <div class="kb-dropdown kb-dropdown-end" id="kb-dd-user" hidden>
                <div class="kb-dropdown-head"><b>${user.name}</b><span>${KB.ROLES[user.role] || ''}${user.email ? html` — ${user.email}` : ''}</span></div>
                <a class="kb-dropdown-item" href="${KB.url('browse', { saved: 1 })}">${icon('bookmark')}ذخیره‌شده‌های من</a>
                ${KB.can.manage() ? html`<a class="kb-dropdown-item" href="${KB.url('panel')}">${icon('dashboard')}پنل مدیریت محتوا</a><a class="kb-dropdown-item" href="${KB.url('panel')}#/edit/new">${icon('plus')}افزودن محتوای جدید</a>` : ''}
                ${KB.can.admin() && !KB.config.mock ? html`<a class="kb-dropdown-item" href="${KB.config.site}/_layouts/15/settings.aspx">${icon('settings')}تنظیمات سایت شیرپوینت</a>` : ''}
                <div class="kb-dropdown-sep"></div>
                <a class="kb-dropdown-item" href="${KB.logoutUrl()}" data-kb-logout>${icon('log-out')}خروج</a>
              </div>
            </div>`}
        </div>
      </div>
    </header>`;
  }
  function renderDrawer(page) {
    var cats = (KB.state.categories || []).filter(function (c) { return c.count > 0; });
    return html`<div class="kb-drawer-backdrop" data-kb-drawer-close></div>
    <aside class="kb-drawer" aria-label="منو">
      <div class="kb-drawer-head"><b>${KB.setting('SiteTitle', 'پایگاه دانش شستان')}</b><button type="button" class="kb-btn kb-btn-icon kb-btn-light kb-btn-sm" data-kb-drawer-close aria-label="بستن">${icon('x')}</button></div>
      <div class="kb-drawer-body">
        ${navLinks(page).map(function (l) { return html`<a class="kb-drawer-link ${l.active ? 'is-active' : ''}" href="${l.href}">${icon(l.icon)}${l.label}</a>`; })}
        ${KB.can.login() ? html`<a class="kb-drawer-link" href="${KB.url('browse', { saved: 1 })}">${icon('bookmark')}ذخیره‌شده‌های من</a>` : ''}
        ${KB.can.manage() ? html`<a class="kb-drawer-link" href="${KB.url('panel')}">${icon('dashboard')}پنل مدیریت محتوا</a>` : ''}
        ${cats.length ? html`<div class="kb-drawer-title">دسته‌بندی‌ها</div>${cats.map(function (c) { return html`<a class="kb-drawer-link" href="${KB.url('browse', { cat: c.title })}" style="font-weight:400">${icon(c.icon)}${c.title}</a>`; })}` : ''}
        <div class="kb-drawer-title">حساب کاربری</div>
        ${KB.state.user.anonymous
          ? html`<a class="kb-drawer-link" href="${KB.loginUrl()}" data-kb-login>${icon('log-in')}ورود کارکنان</a>`
          : html`<a class="kb-drawer-link" href="${KB.logoutUrl()}" data-kb-logout>${icon('log-out')}خروج (${KB.state.user.name})</a>`}
      </div>
    </aside>`;
  }
  function renderFooter() {
    var year = U.faDigits(U.jalali.from(new Date()).jy);
    var types = (KB.state.types || []).slice(0, 6);
    var cats = (KB.state.categories || []).filter(function (c) { return c.count > 0; }).slice(0, 6);
    return html`<footer class="kb-footer">
      <div class="kb-container kb-footer-grid">
        <div>
          <a class="kb-logo" href="${KB.url('home')}"><span class="kb-logo-mark">${icon('lightbulb')}</span><span><b>${KB.setting('SiteTitle', 'پایگاه دانش شستان')}</b></span></a>
          <p>${KB.setting('FooterText', 'پایگاه دانش سازمانی شستان؛ مرجع مقالات، ویدیوها، راهنماها و تجربه‌های کارکنان. محتوای عمومی برای همه و محتوای ویژه‌ی کارکنان پس از ورود با حساب سازمانی در دسترس است.')}</p>
        </div>
        <div><h4>انواع محتوا</h4><div class="kb-footer-links">${types.map(function (t) { var m = U.typeMeta(t.value); return html`<a href="${KB.url('browse', { type: t.value })}">${icon(m.icon, 'kb-ico-sm')}${m.label} (${U.faNum(t.count)})</a>`; })}</div></div>
        <div><h4>دسته‌بندی‌ها</h4><div class="kb-footer-links">${cats.map(function (c) { return html`<a href="${KB.url('browse', { cat: c.title })}">${icon(c.icon, 'kb-ico-sm')}${c.title}</a>`; })}</div></div>
      </div>
      <div class="kb-container kb-footer-bottom"><span>© ${year} — ${KB.setting('Copyright', 'شرکت سرمایه‌گذاری تجاری شستان')}. تمامی حقوق محفوظ است.</span><span>${KB.can.manage() ? html`<a href="${KB.url('panel')}">${icon('dashboard', 'kb-ico-sm')} پنل مدیریت محتوا</a>` : ''}</span></div>
    </footer>
    <button type="button" class="kb-back-top" aria-label="بازگشت به بالا" data-kb-top>${icon('chevron-up')}</button>`;
  }

  ui.initLayout = function (page) {
    var headerSlot = document.querySelector('#kb-app [data-kb-slot="header"]');
    var footerSlot = document.querySelector('#kb-app [data-kb-slot="footer"]');
    var drawerSlot = document.createElement('div');
    U.mount(headerSlot, renderHeader(page));
    if (footerSlot) U.mount(footerSlot, page === 'panel' ? '' : renderFooter());
    var header = document.getElementById('kb-header');
    var search = document.getElementById('kb-header-search');
    if (search) ui.bindSearch(search);

    var root = document.getElementById('kb-app');
    U.on(root, 'click', '[data-kb-drawer]', function () {
      U.mount(drawerSlot, renderDrawer(page));
      root.appendChild(drawerSlot);
      document.documentElement.style.overflow = 'hidden';
    });
    U.on(root, 'click', '[data-kb-drawer-close]', function () { drawerSlot.remove(); document.documentElement.style.overflow = ''; });
    U.on(root, 'click', '[data-kb-search-toggle]', function () { search.classList.toggle('is-open'); if (search.classList.contains('is-open')) search.querySelector('input').focus(); });
    U.on(root, 'click', '[data-kb-top]', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    if (KB.config.mock) {
      U.on(root, 'click', '[data-kb-login]', function (e) { e.preventDefault(); KB_MOCK_API.setRole('reader'); location.reload(); });
      U.on(root, 'click', '[data-kb-logout]', function (e) { e.preventDefault(); KB_MOCK_API.setRole('anonymous'); location.reload(); });
    }
    var topBtn = root.querySelector('[data-kb-top]');
    var onScroll = function () {
      var y = window.scrollY || document.documentElement.scrollTop;
      if (header) header.classList.toggle('is-scrolled', y > 8);
      if (topBtn) topBtn.classList.toggle('is-visible', y > 700);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  };

  /* ------------------------------------------------------------------ راه‌اندازی */
  KB.pages = KB.pages || {};
  KB.boot = function () {
    var pageEl = document.querySelector('#kb-app [data-kb-page]');
    var page = pageEl ? pageEl.getAttribute('data-kb-page') : 'home';
    var main = document.getElementById('kb-main') || pageEl;
    KB.api.bootstrap().then(function (b) {
      KB.state = b;
      KB.state.user = b.user || { role: 'anonymous', anonymous: true };
      document.title = (document.title && document.title.indexOf('|') < 0 ? document.title + ' | ' : '') + KB.setting('SiteTitle', 'پایگاه دانش شستان');
      ui.initLayout(page);
      var mod = KB.pages[page];
      if (mod) return mod.init(pageEl || main);
    }).catch(function (e) {
      console.error('[kb]', e);
      var slot = document.querySelector('#kb-app [data-kb-slot="header"]');
      if (slot && !slot.innerHTML.trim()) U.mount(slot, html`<header class="kb-header"><div class="kb-container kb-header-inner"><a class="kb-logo" href="${KB.url('home')}"><span class="kb-logo-mark">${icon('lightbulb')}</span><b>پایگاه دانش</b></a></div></header>`);
      U.mount(pageEl || main, html`<div class="kb-container" style="padding-top:40px">${ui.errorBox({ message: (e && e.message) || 'خطا' })}
        <p class="kb-hint" style="text-align:center">اگر مدیر سامانه هستید: نصب هندلر <code>/_layouts/15/KB/KBApi.ashx</code> (اسکریپت Install-KBLayouts.ps1) و اجرای Install-KBPortal.ps1 را بررسی کنید.</p></div>`);
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { KB.boot(); });
  else setTimeout(KB.boot, 0);
})(window, document);
