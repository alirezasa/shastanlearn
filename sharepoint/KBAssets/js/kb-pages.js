/* =====================================================================
   پایگاه دانش شستان — صفحات عمومی: خانه، مرور/جستجو، نمایش محتوا
   ===================================================================== */
(function (window, document) {
  'use strict';
  var KB = window.KB;
  var U = KB.util, ui = KB.ui, html = U.html, raw = U.raw, icon = U.icon;

  function typeValue(key) {
    var t = (KB.state.types || []).filter(function (x) { return U.typeMeta(x.value).key === key; })[0];
    return t ? t.value : null;
  }
  function requireLogin(text) {
    var m = ui.modal({
      title: 'ورود لازم است', icon: 'lock',
      body: html`<p style="font-size:15px;line-height:2">${text || 'برای این کار ابتدا با حساب سازمانی وارد شوید.'}</p>`,
      foot: html`<a class="kb-btn kb-btn-brand" href="${KB.loginUrl()}" data-kb-login>${icon('log-in')}ورود کارکنان</a><button type="button" class="kb-btn kb-btn-ghost" data-kb-close>بعداً</button>`
    });
    return m;
  }
  KB.requireLogin = requireLogin;

  /* ==================================================================== خانه */
  var home = {};
  home.init = function (el) {
    var s = KB.state, st = s.stats || {};
    var videoType = typeValue('video');
    var tags = (s.tags || []).slice(0, 8);
    var cats = (s.categories || []).filter(function (c) { return c.count > 0; });
    U.mount(el, html`
      <section class="kb-hero">
        <div class="kb-container kb-hero-inner">
          <h1>${KB.setting('HeroTitle', 'هر آنچه برای رشد و یادگیری لازم دارید')}</h1>
          <p>${KB.setting('HeroText', 'مقالات، ویدیوها، پادکست‌ها و راهنماهای سازمانی شستان را جستجو کنید، بیاموزید و تجربه‌های خود را به اشتراک بگذارید.')}</p>
          <form class="kb-hero-search" role="search" id="kb-hero-search">
            ${icon('search')}<input type="search" placeholder="چه چیزی می‌خواهید یاد بگیرید؟ (مثلاً: ارزیابی عملکرد)" aria-label="جستجو در پایگاه دانش" autocomplete="off">
            <button type="submit" class="kb-btn kb-btn-brand">جستجو</button>
          </form>
          ${tags.length ? html`<div class="kb-hero-tags"><span style="opacity:.8">جستجوهای پرتکرار:</span>${tags.map(function (t) { return html`<a href="${KB.url('browse', { tag: t.tag })}">#${t.tag}</a>`; })}</div>` : ''}
          <div class="kb-hero-stats">
            <div class="kb-hero-stat">${icon('library')}<div><b>${U.faNum(st.total)}</b><span>محتوای منتشرشده</span></div></div>
            <div class="kb-hero-stat">${icon('folder-open')}<div><b>${U.faNum(cats.length)}</b><span>دسته‌بندی موضوعی</span></div></div>
            <div class="kb-hero-stat">${icon('eye')}<div><b>${U.compact(st.views)}</b><span>بازدید</span></div></div>
            ${st.videos ? html`<div class="kb-hero-stat">${icon('play-circle')}<div><b>${U.faNum(st.videos)}</b><span>ویدیو و پادکست</span></div></div>` : ''}
          </div>
        </div>
      </section>
      <div class="kb-container">
        <section class="kb-featured" id="kb-featured">${raw('<div class="kb-skel" style="min-height:380px;border-radius:20px"></div><div class="kb-skel" style="min-height:380px;border-radius:20px"></div>')}</section>

        <section class="kb-section">
          <div class="kb-section-head">
            <div><h2 class="kb-section-title">${icon('sparkles')}تازه‌ترین محتوا</h2><p class="kb-section-sub">آخرین مطالب منتشرشده در پایگاه دانش</p></div>
            <a class="kb-more" href="${KB.url('browse')}">مشاهده‌ی همه ${icon('arrow-left', 'kb-ico-sm')}</a>
          </div>
          <div class="kb-tabs" role="tablist" id="kb-latest-tabs">
            <button type="button" class="kb-tab" role="tab" aria-selected="true" data-type="">همه <small>${U.faNum(st.total)}</small></button>
            ${(s.types || []).map(function (t) { var m = U.typeMeta(t.value); return html`<button type="button" class="kb-tab" role="tab" aria-selected="false" data-type="${t.value}">${icon(m.icon, 'kb-ico-sm')}${m.label} <small>${U.faNum(t.count)}</small></button>`; })}
          </div>
          <div id="kb-latest" style="margin-top:16px">${ui.skeletonCards(8)}</div>
        </section>

        ${cats.length ? html`<section class="kb-section">
          <div class="kb-section-head"><div><h2 class="kb-section-title">${icon('folder-open')}دسته‌بندی‌های موضوعی</h2><p class="kb-section-sub">محتوا را بر اساس موضوع مرور کنید</p></div></div>
          <div class="kb-cats">${cats.map(function (c) {
            return html`<a class="kb-cat" href="${KB.url('browse', { cat: c.title })}" style="--c:${c.color}"><span class="kb-cat-icon">${icon(c.icon)}</span><span><b>${c.title}</b><span>${U.faNum(c.count)} محتوا</span></span></a>`;
          })}</div>
        </section>` : ''}

        ${videoType ? html`<section class="kb-section">
          <div class="kb-section-head"><div><h2 class="kb-section-title">${icon('play-circle')}ویدیوهای آموزشی</h2><p class="kb-section-sub">آموزش‌ها و گزارش‌های تصویری</p></div><a class="kb-more" href="${KB.url('browse', { type: videoType })}">همه‌ی ویدیوها ${icon('arrow-left', 'kb-ico-sm')}</a></div>
          <div id="kb-videos">${ui.skeletonCards(4)}</div>
        </section>` : ''}

        ${s.user.anonymous ? html`<section class="kb-section"><div class="kb-cta">
          <span class="kb-cta-icon">${icon('lock')}</span>
          <div class="kb-grow"><h3>محتوای ویژه‌ی کارکنان${st.privateCount ? html` (${U.faNum(st.privateCount)} مورد)` : ''}</h3><p>بخشی از دانش سازمانی فقط برای کارکنان منتشر شده است. با نام کاربری و رمز عبور شبکه (ad.shastangroup.ir) وارد شوید.</p></div>
          <a class="kb-btn kb-btn-white kb-btn-lg" href="${KB.loginUrl()}" data-kb-login>${icon('log-in')}ورود کارکنان</a>
        </div></section>` : ''}

        <section class="kb-section" style="display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">
          <div class="kb-card kb-card-pad"><h3 class="kb-box-title"><span class="kb-row">${icon('flame')}پربازدیدترین‌ها</span><a class="kb-more" href="${KB.url('browse', { sort: 'views' })}">همه</a></h3><div id="kb-popular">${raw('<div class="kb-skel" style="height:280px"></div>')}</div></div>
          <div class="kb-card kb-card-pad"><h3 class="kb-box-title"><span class="kb-row">${icon('heart')}محبوب‌ترین‌ها</span><a class="kb-more" href="${KB.url('browse', { sort: 'likes' })}">همه</a></h3><div id="kb-liked">${raw('<div class="kb-skel" style="height:280px"></div>')}</div></div>
        </section>
      </div>`);

    ui.bindSearch(document.getElementById('kb-hero-search'));

    // ویژه‌ها
    KB.api.list({ featured: 1, size: 7, sort: 'new' }).then(function (r) {
      var items = r.items;
      if (items.length < 4) {
        return KB.api.list({ size: 7, sort: 'new' }).then(function (r2) {
          var ids = items.map(function (x) { return x.id; });
          return items.concat(r2.items.filter(function (x) { return ids.indexOf(x.id) < 0; })).slice(0, 7);
        });
      }
      return items;
    }).then(function (items) { renderFeatured(document.getElementById('kb-featured'), items); })
      .catch(function (e) { U.mount(document.getElementById('kb-featured'), ui.errorBox(e)); });

    // تازه‌ترین‌ها با تب نوع
    var latest = document.getElementById('kb-latest');
    function loadLatest(type) {
      U.mount(latest, ui.skeletonCards(8));
      KB.api.list({ type: type, size: 8, sort: 'new' }).then(function (r) {
        U.mount(latest, r.items.length ? ui.cards(r.items) : ui.empty('inbox', 'هنوز محتوایی منتشر نشده است', KB.can.manage() ? 'از پنل مدیریت محتوا اولین مطلب را منتشر کنید.' : ''));
      }).catch(function (e) { U.mount(latest, ui.errorBox(e)); });
    }
    U.on(document.getElementById('kb-latest-tabs'), 'click', '.kb-tab', function (e, b) {
      U.$$('.kb-tab', b.parentNode).forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
      loadLatest(b.getAttribute('data-type'));
    });
    loadLatest('');

    if (videoType) {
      KB.api.list({ type: videoType, size: 4, sort: 'new' }).then(function (r) { U.mount(document.getElementById('kb-videos'), ui.cards(r.items)); })
        .catch(function (e) { U.mount(document.getElementById('kb-videos'), ui.errorBox(e)); });
    }
    KB.api.list({ sort: 'views', size: 5 }).then(function (r) { U.mount(document.getElementById('kb-popular'), r.items.length ? ui.rankList(r.items, 'views') : ui.empty('flame', 'موردی نیست')); });
    KB.api.list({ sort: 'likes', size: 5 }).then(function (r) { U.mount(document.getElementById('kb-liked'), r.items.length ? ui.rankList(r.items, 'likes') : ui.empty('heart', 'موردی نیست')); });
  };

  function renderFeatured(box, items) {
    if (!items.length) { box.style.display = 'none'; return; }
    var slides = items.slice(0, 4), side = items.slice(4, 7);
    if (side.length < 3 && items.length > 3) side = items.slice(-3);
    U.mount(box, html`
      <div class="kb-slider" id="kb-slider" aria-roledescription="carousel">
        <div class="kb-slides">${slides.map(function (it) {
          return html`<a class="kb-slide" href="${KB.contentUrl(it.id)}">
            ${it.thumb ? html`<img class="kb-img" src="${it.thumb}" alt="" data-type="${it.type || ''}">` : ui.placeholder(it)}
            <div class="kb-slide-cap">
              <div class="kb-row kb-wrap">${ui.typeBadge(it.type)}${it.visibility === 'Private' ? html`<span class="kb-badge kb-badge-dark">${icon('lock')}ویژه‌ی کارکنان</span>` : ''}${it.category ? html`<span class="kb-badge kb-badge-dark">${it.category}</span>` : ''}</div>
              <h2>${it.title}</h2>${it.summary ? html`<p class="kb-clamp-2">${it.summary}</p>` : ''}
              <div class="kb-meta"><span>${icon('calendar')}${U.fmtDate(it.publishAt || it.created)}</span><span>${icon('eye')}${U.compact(it.views)}</span>${it.author && it.author.name ? html`<span>${icon('user')}${it.author.name}</span>` : ''}</div>
            </div></a>`;
        })}</div>
        ${slides.length > 1 ? html`<button type="button" class="kb-slider-nav prev" aria-label="قبلی">${icon('chevron-right')}</button><button type="button" class="kb-slider-nav next" aria-label="بعدی">${icon('chevron-left')}</button><div class="kb-dots">${slides.map(function (x, i) { return html`<button type="button" class="kb-dot ${i === 0 ? 'is-active' : ''}" data-i="${i}" aria-label="اسلاید ${U.faNum(i + 1)}"></button>`; })}</div>` : ''}
      </div>
      <div class="kb-feat-side">${side.map(function (it) {
        return html`<article class="kb-feat-mini">${ui.thumb(it)}<div class="kb-grow"><h3 class="kb-clamp-2"><a class="kb-post-stretch" href="${KB.contentUrl(it.id)}">${it.title}</a></h3>${ui.meta(it)}</div></article>`;
      })}</div>`);
    var slider = document.getElementById('kb-slider');
    var track = slider.querySelector('.kb-slides'), n = slides.length, i = 0, timer = null;
    function go(k) {
      i = (k + n) % n;
      track.style.transform = 'translateX(' + (i * 100) + '%)';
      U.$$('.kb-dot', slider).forEach(function (d, j) { d.classList.toggle('is-active', j === i); });
    }
    function start() { stop(); if (n > 1) timer = setInterval(function () { go(i + 1); }, 6000); }
    function stop() { clearInterval(timer); }
    U.on(slider, 'click', '.kb-slider-nav', function (e, b) { e.preventDefault(); go(i + (b.classList.contains('next') ? 1 : -1)); start(); });
    U.on(slider, 'click', '.kb-dot', function (e, b) { e.preventDefault(); go(Number(b.getAttribute('data-i'))); start(); });
    slider.addEventListener('mouseenter', stop);
    slider.addEventListener('mouseleave', start);
    var x0 = null;
    slider.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; stop(); }, { passive: true });
    slider.addEventListener('touchend', function (e) { if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) go(i + (dx > 0 ? 1 : -1)); x0 = null; start(); });
    start();
  }

  /* ==================================================================== مرور و جستجو */
  var browse = {};
  var SORTS = [['new', 'جدیدترین'], ['views', 'پربازدیدترین'], ['likes', 'محبوب‌ترین'], ['comments', 'پربحث‌ترین'], ['old', 'قدیمی‌ترین'], ['title', 'عنوان (الفبا)']];
  browse.init = function (el) {
    var st = {
      q: U.qs('q') || '', type: U.qs('type') || '', cat: U.qs('cat') || '', tag: U.qs('tag') || '', author: U.qs('author') || '',
      vis: U.qs('vis') || '', saved: U.qs('saved') === '1', sort: U.qs('sort') || '', page: Number(U.qs('page')) || 1,
      view: KB.local.get('kb.view') || 'grid'
    };
    if (!st.sort) st.sort = st.q ? 'relevance' : 'new';

    function title() {
      if (st.saved) return { icon: 'bookmark', text: 'ذخیره‌شده‌های من', sub: 'محتواهایی که برای مطالعه‌ی بعدی نشان کرده‌اید' };
      if (st.cat) { var c = KB.cat(st.cat); return { icon: c.icon, text: c.title, sub: c.description || 'محتوای دسته‌ی «' + c.title + '»' }; }
      if (st.type) { var t = U.typeMeta(st.type); return { icon: t.icon, text: t.label, sub: 'همه‌ی ' + t.label + '‌های پایگاه دانش' }; }
      if (st.tag) return { icon: 'tag', text: '#' + st.tag, sub: 'محتوای دارای برچسب «' + st.tag + '»' };
      if (st.author) return { icon: 'user', text: st.author, sub: 'محتوای منتشرشده از این نویسنده' };
      if (st.q) return { icon: 'search', text: 'نتایج جستجو', sub: 'برای «' + st.q + '»' };
      return { icon: 'library', text: 'همه‌ی محتوا', sub: 'مرور و جستجو در همه‌ی مطالب پایگاه دانش' };
    }
    var h = title();
    document.title = h.text + ' | ' + KB.setting('SiteTitle', 'پایگاه دانش شستان');
    U.mount(el, html`
      <div class="kb-page-head"><div class="kb-container">
        <nav class="kb-breadcrumb" aria-label="مسیر"><a href="${KB.url('home')}">خانه</a>${icon('chevron-left')}<span>${h.text}</span></nav>
        <h1>${icon(h.icon)}${h.text}</h1><p>${h.sub}</p>
      </div></div>
      <div class="kb-container kb-browse">
        <aside class="kb-filters" id="kb-filters" aria-label="فیلترها"></aside>
        <div>
          <div class="kb-toolbar">
            <form class="kb-toolbar-search" role="search" id="kb-browse-search">${icon('search')}<input class="kb-input" type="search" placeholder="جستجو در عنوان، متن، برچسب و نویسنده…" value="${st.q}" aria-label="جستجو" autocomplete="off"></form>
            <select class="kb-select" id="kb-sort" style="width:auto" aria-label="مرتب‌سازی">
              ${st.q ? html`<option value="relevance">مرتبط‌ترین</option>` : ''}
              ${SORTS.map(function (o) { return html`<option value="${o[0]}" ${o[0] === st.sort ? raw('selected') : ''}>${o[1]}</option>`; })}
            </select>
            <div class="kb-segment" role="group" aria-label="نحوه‌ی نمایش">
              <button type="button" data-view="grid" aria-pressed="${st.view === 'grid'}" title="شبکه‌ای">${icon('grid')}</button>
              <button type="button" data-view="list" aria-pressed="${st.view === 'list'}" title="فهرستی">${icon('list')}</button>
            </div>
            <button type="button" class="kb-btn kb-btn-ghost kb-filters-toggle" id="kb-filters-open">${icon('sliders')}فیلترها</button>
          </div>
          <div class="kb-active-filters" id="kb-active"></div>
          <p class="kb-result-count kb-muted" id="kb-count" style="margin-bottom:12px"></p>
          <div id="kb-results">${ui.skeletonCards(9)}</div>
          <div id="kb-pager"></div>
        </div>
      </div>`);
    if (st.sort === 'relevance' && !st.q) st.sort = 'new';
    U.$('#kb-sort').value = st.sort;

    var results = U.$('#kb-results'), filters = U.$('#kb-filters'), seq = 0;
    function sync(push) {
      U.setQs({ q: st.q, type: st.type, cat: st.cat, tag: st.tag, author: st.author, vis: st.vis, saved: st.saved ? 1 : '', sort: st.sort === 'new' || st.sort === 'relevance' ? '' : st.sort, page: st.page }, push);
    }
    function renderFilters(facets) {
      var types = facets && facets.types || [], cats = facets && facets.categories || [];
      function list(items, key, cur, meta) {
        return html`<div class="kb-filter-list">
          <button type="button" class="${!cur ? 'is-active' : ''}" data-f="${key}" data-v=""><span class="kb-row">${icon('layers', 'kb-ico-sm')}همه</span></button>
          ${items.map(function (x) {
            var m = meta(x.value);
            return html`<button type="button" class="${cur === x.value ? 'is-active' : ''}" data-f="${key}" data-v="${x.value}"><span class="kb-row">${icon(m.icon, 'kb-ico-sm')}${m.label}</span><span class="kb-count">${U.faNum(x.count)}</span></button>`;
          })}</div>`;
      }
      U.mount(filters, html`
        <div class="kb-row kb-filters-close" style="justify-content:space-between;margin-bottom:12px"><b>فیلترها</b><button type="button" class="kb-btn kb-btn-ghost kb-btn-sm" data-close-filters>${icon('check')}اعمال</button></div>
        <div class="kb-card"><h3 class="kb-box-title">نوع محتوا</h3>${list(types, 'type', st.type, function (v) { return U.typeMeta(v); })}</div>
        ${cats.length ? html`<div class="kb-card"><h3 class="kb-box-title">دسته‌بندی</h3>${list(cats, 'cat', st.cat, function (v) { var c = KB.cat(v); return { icon: c.icon, label: c.title }; })}</div>` : ''}
        ${KB.can.login() ? html`<div class="kb-card"><h3 class="kb-box-title">سطح دسترسی</h3><div class="kb-filter-list">
          ${[['', 'همه', 'layers'], ['Public', 'عمومی', 'globe'], ['Private', 'ویژه‌ی کارکنان', 'lock']].map(function (o) { return html`<button type="button" class="${st.vis === o[0] ? 'is-active' : ''}" data-f="vis" data-v="${o[0]}"><span class="kb-row">${icon(o[2], 'kb-ico-sm')}${o[1]}</span></button>`; })}
          <button type="button" class="${st.saved ? 'is-active' : ''}" data-f="saved" data-v="${st.saved ? '' : '1'}"><span class="kb-row">${icon('bookmark', 'kb-ico-sm')}فقط ذخیره‌شده‌ها</span></button>
        </div></div>` : ''}
        ${(KB.state.tags || []).length ? html`<div class="kb-card"><h3 class="kb-box-title">برچسب‌های پرکاربرد</h3><div class="kb-row kb-wrap">${KB.state.tags.slice(0, 24).map(function (t) {
          return html`<button type="button" class="kb-tag ${st.tag === t.tag ? 'is-active' : ''}" data-f="tag" data-v="${st.tag === t.tag ? '' : t.tag}">#${t.tag} <span class="kb-tag-count">${U.faNum(t.count)}</span></button>`;
        })}</div></div>` : ''}`);
    }
    function renderActive() {
      var chips = [];
      if (st.q) chips.push(['q', 'جستجو: ' + st.q]);
      if (st.type) chips.push(['type', 'نوع: ' + U.typeMeta(st.type).label]);
      if (st.cat) chips.push(['cat', 'دسته: ' + st.cat]);
      if (st.tag) chips.push(['tag', '#' + st.tag]);
      if (st.author) chips.push(['author', 'نویسنده: ' + st.author]);
      if (st.vis) chips.push(['vis', KB.VISIBILITY[st.vis]]);
      if (st.saved) chips.push(['saved', 'ذخیره‌شده‌ها']);
      U.mount(U.$('#kb-active'), chips.length ? html`${chips.map(function (c) { return html`<span class="kb-chip-x">${c[1]}<button type="button" data-clear="${c[0]}" aria-label="حذف فیلتر">${icon('x', 'kb-ico-sm')}</button></span>`; })}
        ${chips.length > 1 ? html`<button type="button" class="kb-btn kb-btn-link kb-btn-sm" data-clear="all">پاک کردن همه</button>` : ''}` : '');
    }
    function load() {
      renderActive();
      if (st.saved && KB.state.user.anonymous) {
        U.mount(results, ui.empty('bookmark', 'برای دیدن ذخیره‌شده‌ها وارد شوید', 'فهرست ذخیره‌شده‌ها مخصوص هر کاربر است.', html`<a class="kb-btn kb-btn-brand" href="${KB.loginUrl()}" data-kb-login>${icon('log-in')}ورود کارکنان</a>`));
        U.$('#kb-count').textContent = '';
        return;
      }
      var my = ++seq;
      U.mount(results, ui.skeletonCards(9));
      KB.api.list({ q: st.q, type: st.type, cat: st.cat, tag: st.tag, author: st.author, vis: st.vis, saved: st.saved ? 1 : '', sort: st.sort, page: st.page, size: KB.config.pageSize })
        .then(function (r) {
          if (my !== seq) return;
          st.page = r.page;
          U.mount(U.$('#kb-count'), html`${U.faNum(r.total)} محتوا یافت شد${r.pages > 1 ? html` — صفحه‌ی ${U.faNum(r.page)} از ${U.faNum(r.pages)}` : ''}`);
          U.mount(results, r.items.length ? ui.cards(r.items, st.view)
            : ui.empty(st.saved ? 'bookmark' : 'search', st.saved ? 'هنوز محتوایی ذخیره نکرده‌اید' : 'نتیجه‌ای یافت نشد', st.saved ? 'با دکمه‌ی «ذخیره» در صفحه‌ی هر محتوا، آن را به این فهرست اضافه کنید.' : 'عبارت دیگری را جستجو کنید یا فیلترها را کم کنید.',
              html`<a class="kb-btn kb-btn-ghost" href="${KB.url('browse')}">${icon('library')}همه‌ی محتوا</a>`));
          U.mount(U.$('#kb-pager'), ui.pager(r.page, r.pages));
          renderFilters(r.facets);
          sync();
        }).catch(function (e) { if (my === seq) U.mount(results, ui.errorBox(e, true)); });
    }
    ui.bindPager(U.$('#kb-pager'), function (p) { st.page = p; load(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    U.on(el, 'click', '[data-retry], [data-kb-retry]', load);
    U.on(filters, 'click', '[data-f]', function (e, b) {
      var f = b.getAttribute('data-f'), v = b.getAttribute('data-v');
      if (f === 'saved') st.saved = v === '1'; else st[f] = v;
      st.page = 1;
      load();
    });
    U.on(filters, 'click', '[data-close-filters]', function () { filters.classList.remove('is-open'); document.documentElement.style.overflow = ''; });
    U.$('#kb-filters-open').addEventListener('click', function () { filters.classList.add('is-open'); document.documentElement.style.overflow = 'hidden'; });
    U.on(U.$('#kb-active'), 'click', '[data-clear]', function (e, b) {
      var k = b.getAttribute('data-clear');
      if (k === 'all') { st.q = st.type = st.cat = st.tag = st.author = st.vis = ''; st.saved = false; U.$('#kb-browse-search input').value = ''; }
      else if (k === 'saved') st.saved = false;
      else { st[k] = ''; if (k === 'q') U.$('#kb-browse-search input').value = ''; }
      if (!st.q && st.sort === 'relevance') st.sort = 'new';
      st.page = 1;
      load();
    });
    U.$('#kb-sort').addEventListener('change', function () { st.sort = this.value; st.page = 1; load(); });
    U.on(el, 'click', '[data-view]', function (e, b) {
      st.view = b.getAttribute('data-view');
      KB.local.set('kb.view', st.view);
      U.$$('[data-view]', el).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      var grid = results.querySelector('.kb-grid, .kb-list');
      if (grid) grid.className = st.view === 'list' ? 'kb-list' : 'kb-grid';
    });
    var searchInput = U.$('#kb-browse-search input');
    var runSearch = U.debounce(function () {
      var v = searchInput.value.trim();
      if (v === st.q) return;
      var had = !!st.q;
      st.q = v; st.page = 1;
      if (v && !had) st.sort = 'relevance';
      if (!v && st.sort === 'relevance') st.sort = 'new';
      var sel = U.$('#kb-sort');
      if (v && !sel.querySelector('option[value=relevance]')) sel.insertAdjacentHTML('afterbegin', '<option value="relevance">مرتبط‌ترین</option>');
      sel.value = st.sort;
      load();
    }, 400);
    searchInput.addEventListener('input', runSearch);
    U.$('#kb-browse-search').addEventListener('submit', function (e) { e.preventDefault(); runSearch(); });
    window.addEventListener('popstate', function () { location.reload(); });
    load();
  };

  /* ==================================================================== نمایش محتوا */
  var content = {};

  /** HTML امن + تبدیل لینک رسانه به پخش‌کننده، جدول‌ها، تصاویر و سرفصل‌ها */
  function renderBody(item) {
    var box = document.createElement('div');
    box.innerHTML = U.sanitizeHtml(item.body || '');
    // لینک به فایل ویدیو/صوت که به‌تنهایی در یک پاراگراف آمده (یا داخل .kb-embed) → پخش‌کننده
    U.$$('a[href]', box).forEach(function (a) {
      var href = a.getAttribute('href');
      var kind = U.isMediaUrl(U.fileNameOf(href));
      if (kind !== 'video' && kind !== 'audio') return;
      var block = a.closest('.kb-embed') || a.parentNode;
      var alone = block && block !== box && block.textContent.trim() === a.textContent.trim() && block.querySelectorAll('a').length === 1;
      if (!alone && !a.closest('.kb-embed')) return;
      var title = a.textContent.trim();
      if (title === href || /^https?:|^\//.test(title)) title = '';
      var fig = document.createElement('figure');
      fig.className = 'kb-embed';
      fig.innerHTML = String(kind === 'video'
        ? html`<video controls preload="metadata" src="${href}"></video>${title ? html`<figcaption class="kb-embed-caption">${title}</figcaption>` : ''}`
        : html`<div class="kb-audio"><span class="kb-audio-icon">${icon('headphones')}</span><div class="kb-grow">${title ? html`<b>${title}</b>` : ''}<audio controls preload="metadata" src="${href}"></audio></div></div>`);
      (block === box ? a : block).replaceWith(fig);
    });
    U.$$('video', box).forEach(function (v) { v.setAttribute('controls', ''); v.setAttribute('preload', 'metadata'); if (!v.closest('.kb-embed')) { var f = document.createElement('figure'); f.className = 'kb-embed'; v.replaceWith(f); f.appendChild(v); } });
    U.$$('audio', box).forEach(function (a) { a.setAttribute('controls', ''); a.style.width = '100%'; });
    U.$$('table', box).forEach(function (t) { if (!t.parentNode.classList.contains('kb-table-wrap')) { var w = document.createElement('div'); w.className = 'kb-table-wrap'; t.replaceWith(w); w.appendChild(t); } });
    U.$$('img', box).forEach(function (img) { img.setAttribute('loading', 'lazy'); img.classList.add('kb-img'); if (!img.getAttribute('alt')) img.setAttribute('alt', ''); img.removeAttribute('width'); img.removeAttribute('height'); });
    var toc = [];
    U.$$('h2, h3', box).forEach(function (hd, i) {
      if (!hd.textContent.trim()) return;
      hd.id = 'kb-h-' + (i + 1);
      toc.push({ id: hd.id, text: hd.textContent.trim(), sub: hd.tagName === 'H3' });
    });
    return { html: box.innerHTML, toc: toc };
  }

  function mediaBlock(item) {
    var kind = U.isMediaUrl(U.fileNameOf(item.media));
    if (item.media && kind === 'video') return html`<div class="kb-article-media"><video controls preload="metadata" src="${item.media}" ${item.thumb ? raw('poster="' + U.esc(item.thumb) + '"') : ''}></video></div>`;
    if (item.media && kind === 'audio') {
      return html`<div class="kb-article-media" style="background:none"><div class="kb-audio" style="padding:18px">
        ${item.thumb ? html`<img src="${item.thumb}" alt="" style="width:88px;height:88px;border-radius:14px;object-fit:cover">` : html`<span class="kb-audio-icon">${icon('headphones')}</span>`}
        <div class="kb-grow"><b>${item.title}</b><audio controls preload="metadata" src="${item.media}"></audio></div></div></div>`;
    }
    if (item.thumb) return html`<figure class="kb-article-media"><img class="kb-img" src="${item.thumb}" alt="${item.title}" data-lightbox="cover"></figure>`;
    return '';
  }

  content.init = function (el) {
    var id = Number(U.qs('id'));
    var preview = U.qs('preview') === '1';
    if (!id) { U.mount(el, html`<div class="kb-container">${ui.empty('help', 'محتوا مشخص نشده است', '', html`<a class="kb-btn kb-btn-brand" href="${KB.url('browse')}">مرور محتوا</a>`)}</div>`); return; }
    U.mount(el, html`<div class="kb-container kb-article-wrap"><div class="kb-article" style="padding:32px"><div class="kb-skel" style="height:34px;width:60%"></div><div class="kb-skel kb-skel-line" style="width:90%;margin-top:18px"></div><div class="kb-skel" style="height:360px;margin-top:22px"></div><div class="kb-skel kb-skel-line"></div><div class="kb-skel kb-skel-line" style="width:80%"></div></div><div class="kb-skel" style="height:300px;border-radius:14px"></div></div>`);
    KB.api.get(id, { preview: preview }).then(function (item) { draw(el, item, preview); }).catch(function (e) {
      if (e.status === 401 || e.code === 'login') {
        U.mount(el, html`<div class="kb-container" style="padding-top:28px"><div class="kb-article kb-lock-screen">
          <div class="kb-empty-icon">${icon('lock')}</div><h2 style="font-size:20px">این محتوا ویژه‌ی کارکنان است</h2>
          <p class="kb-muted" style="margin:8px auto 20px;max-width:460px">برای مطالعه‌ی این مطلب با نام کاربری و رمز عبور شبکه‌ی سازمان (ad.shastangroup.ir) وارد شوید.</p>
          <a class="kb-btn kb-btn-brand kb-btn-lg" href="${KB.loginUrl()}" data-kb-login>${icon('log-in')}ورود کارکنان</a>
          <p style="margin-top:14px"><a class="kb-more" href="${KB.url('browse')}">مشاهده‌ی محتوای عمومی</a></p></div></div>`);
      } else if (e.status === 404) {
        U.mount(el, html`<div class="kb-container" style="padding-top:28px">${ui.empty('search', 'محتوا یافت نشد', 'ممکن است این مطلب حذف یا از حالت انتشار خارج شده باشد.', html`<a class="kb-btn kb-btn-brand" href="${KB.url('browse')}">${icon('library')}مرور همه‌ی محتوا</a>`)}</div>`);
      } else U.mount(el, html`<div class="kb-container" style="padding-top:28px">${ui.errorBox(e)}</div>`);
    });
  };

  function draw(el, item, preview) {
    var cat = item.category ? KB.cat(item.category) : null;
    var body = renderBody(item);
    var size = KB.local.get('kb.fontsize') || '';
    var viewer = item.viewer || {};
    document.title = item.title + ' | ' + KB.setting('SiteTitle', 'پایگاه دانش شستان');
    var notLive = item.status !== 'Published' || (item.publishAt && new Date(item.publishAt) > new Date());
    U.mount(el, html`
      <div class="kb-progress" id="kb-progress"></div>
      <div class="kb-container">
        ${preview || notLive ? html`<div class="kb-alert kb-alert-warn" style="margin-top:18px">${icon('eye')}<span>پیش‌نمایش — این محتوا ${item.status === 'Draft' ? 'پیش‌نویس است' : item.status === 'Archived' ? 'بایگانی شده است' : 'برای ' + U.fmtDateTime(item.publishAt) + ' زمان‌بندی شده است'} و برای کاربران نمایش داده نمی‌شود.</span></div>` : ''}
        <div class="kb-article-wrap">
          <div style="min-width:0">
            <article class="kb-article">
              <header class="kb-article-head">
                <nav class="kb-breadcrumb" aria-label="مسیر"><a href="${KB.url('home')}">خانه</a>${icon('chevron-left')}<a href="${KB.url('browse', { type: item.type })}">${U.typeMeta(item.type).label}</a>${cat ? html`${icon('chevron-left')}<a href="${KB.url('browse', { cat: cat.title })}">${cat.title}</a>` : ''}</nav>
                <div class="kb-row kb-wrap">${ui.typeBadge(item.type)}${item.visibility === 'Private' ? html`<span class="kb-badge kb-badge-private">${icon('lock')}ویژه‌ی کارکنان</span>` : html`<span class="kb-badge kb-badge-brand">${icon('globe')}عمومی</span>`}${item.featured ? html`<span class="kb-badge kb-badge-amber">${icon('star')}ویژه</span>` : ''}</div>
                <h1 class="kb-article-title">${item.title}</h1>
                ${item.summary ? html`<p class="kb-article-lead">${item.summary}</p>` : ''}
                <div class="kb-article-meta">
                  ${item.author && item.author.name ? html`<a href="${KB.url('browse', { author: item.author.name })}">${ui.authorMini(item.author)}</a>` : ''}
                  <span>${icon('calendar')}${U.fmtDate(item.publishAt || item.created)}</span>
                  ${item.minutes ? html`<span>${icon('clock')}${U.faNum(item.minutes)} دقیقه مطالعه</span>` : ''}
                  <span>${icon('eye')}${U.faNum(item.views)} بازدید</span>
                  ${viewer.canEdit ? html`<a class="kb-btn kb-btn-ghost kb-btn-sm" style="margin-right:auto" href="${KB.url('panel')}#/edit/${item.id}">${icon('pencil')}ویرایش</a>` : ''}
                </div>
              </header>
              ${mediaBlock(item)}
              <div class="kb-article-body">
                <div class="kb-prose ${size}" id="kb-prose">${raw(body.html)}</div>
                ${item.tags && item.tags.length ? html`<div class="kb-row kb-wrap" style="margin-top:26px">${icon('tags', 'kb-muted')}${item.tags.map(function (t) { return html`<a class="kb-tag" href="${KB.url('browse', { tag: t })}">#${t}</a>`; })}</div>` : ''}
                ${item.attachments && item.attachments.length ? html`<section style="margin-top:28px"><h2 class="kb-box-title">${icon('paperclip')}فایل‌های پیوست (${U.faNum(item.attachments.length)})</h2>
                  <div class="kb-files">${item.attachments.map(function (f) {
                    var k = U.fileKind(f.name);
                    return html`<a class="kb-file" href="${f.url}${f.url.indexOf('?') < 0 ? '?' : '&'}dl=1" download="${f.name}"><span class="kb-file-icon" style="--f:${k.color}">${icon(k.icon)}<small>${k.ext}</small></span><span class="kb-grow"><b title="${f.name}">${f.name}</b><span>${U.fileSize(f.size)}</span></span>${icon('download', 'kb-muted')}</a>`;
                  })}</div></section>` : ''}
              </div>
              <div class="kb-actions">
                <button type="button" class="kb-btn kb-btn-ghost kb-like ${viewer.liked ? 'is-active' : ''}" data-act="like" aria-pressed="${!!viewer.liked}">${icon('heart')}<span>پسندیدم</span><b data-likes>${U.faNum(item.likes)}</b></button>
                <button type="button" class="kb-btn kb-btn-ghost kb-bookmark ${viewer.bookmarked ? 'is-on-brand' : ''}" data-act="bookmark" aria-pressed="${!!viewer.bookmarked}">${icon(viewer.bookmarked ? 'bookmark-check' : 'bookmark')}<span>${viewer.bookmarked ? 'ذخیره شد' : 'ذخیره برای بعد'}</span></button>
                <a class="kb-btn kb-btn-ghost" href="#kb-comments">${icon('message')}<span>نظرات</span><b data-comments>${U.faNum(item.comments)}</b></a>
                <span class="kb-grow"></span>
                <div class="kb-nav-item">
                  <button type="button" class="kb-btn kb-btn-ghost" data-kb-dd aria-controls="kb-dd-share" aria-expanded="false">${icon('share')}اشتراک‌گذاری</button>
                  <div class="kb-dropdown kb-dropdown-end" id="kb-dd-share" hidden style="bottom:calc(100% + 8px);top:auto">
                    <button type="button" class="kb-dropdown-item" data-act="copy">${icon('link')}کپی پیوند</button>
                    <a class="kb-dropdown-item" href="mailto:?subject=${encodeURIComponent(item.title)}&body=${encodeURIComponent(item.title + '\n' + location.href)}">${icon('mail')}ارسال با ایمیل</a>
                    <button type="button" class="kb-dropdown-item" data-act="print">${icon('printer')}چاپ / PDF</button>
                  </div>
                </div>
                <div class="kb-segment" role="group" aria-label="اندازه‌ی متن">
                  <button type="button" data-size="is-sm" aria-pressed="${size === 'is-sm'}" title="متن کوچک">آ</button>
                  <button type="button" data-size="" aria-pressed="${!size}" title="متن معمولی" style="font-size:15px">آ</button>
                  <button type="button" data-size="is-lg" aria-pressed="${size === 'is-lg'}" title="متن بزرگ" style="font-size:18px">آ</button>
                </div>
              </div>
              ${item.author && (item.author.bio || item.author.image) ? html`<div style="padding:0 32px 24px" class="kb-author-wrap"><div class="kb-author">
                ${item.author.image ? html`<img class="kb-author-img kb-img" src="${item.author.image}" alt="${item.author.name}">` : html`<span class="kb-author-img">${U.initials(item.author.name)}</span>`}
                <div><small>درباره‌ی نویسنده</small><h4>${item.author.name}</h4>${item.author.bio ? html`<p>${item.author.bio}</p>` : ''}
                  <a class="kb-more" style="margin-top:6px" href="${KB.url('browse', { author: item.author.name })}">سایر مطالب این نویسنده ${icon('arrow-left', 'kb-ico-sm')}</a></div>
              </div></div>` : ''}
              <section class="kb-comments" id="kb-comments" aria-label="نظرات"></section>
            </article>
            ${item.related && item.related.length ? html`<section class="kb-section kb-related" style="padding-top:32px"><div class="kb-section-head"><h2 class="kb-section-title">${icon('layers')}مطالب مرتبط</h2></div>${ui.cards(item.related.slice(0, 3))}</section>` : ''}
          </div>
          <aside class="kb-aside">
            <div class="kb-sticky">
              ${body.toc.length > 1 ? html`<div class="kb-card kb-card-pad"><h3 class="kb-box-title">${icon('list')}فهرست مطالب</h3><nav class="kb-toc" id="kb-toc">${body.toc.map(function (t) { return html`<a href="#${t.id}" class="${t.sub ? 'is-sub' : ''}">${t.text}</a>`; })}</nav></div>` : ''}
              <div class="kb-card kb-card-pad" style="${body.toc.length > 1 ? 'margin-top:18px' : ''}">
                <h3 class="kb-box-title">${icon('info')}مشخصات</h3>
                <div class="kb-kv"><span>نوع</span><b>${U.typeMeta(item.type).label}</b></div>
                ${cat ? html`<div class="kb-kv"><span>دسته</span><b><a href="${KB.url('browse', { cat: cat.title })}">${cat.title}</a></b></div>` : ''}
                <div class="kb-kv"><span>تاریخ انتشار</span><b>${U.fmtDate(item.publishAt || item.created)}</b></div>
                ${item.modified ? html`<div class="kb-kv"><span>آخرین به‌روزرسانی</span><b>${U.fmtDate(item.modified)}</b></div>` : ''}
                <div class="kb-kv"><span>بازدید</span><b>${U.faNum(item.views)}</b></div>
                <div class="kb-kv"><span>دسترسی</span><b>${KB.VISIBILITY[item.visibility] || ''}</b></div>
              </div>
              ${item.related && item.related.length > 3 ? html`<div class="kb-card kb-card-pad" style="margin-top:18px"><h3 class="kb-box-title">${icon('sparkles')}پیشنهاد مطالعه</h3>${ui.rankList(item.related.slice(3, 7), 'views')}</div>` : ''}
            </div>
          </aside>
        </div>
      </div>`);

    var prose = U.$('#kb-prose');
    // لایت‌باکس تصاویر
    var imgs = U.$$('img', prose).concat(U.$$('[data-lightbox] ', el).filter(function (x) { return x.tagName === 'IMG'; }));
    U.on(el, 'click', '#kb-prose img, img[data-lightbox]', function (e, img) {
      var list = imgs.filter(function (x) { return !x.dataset.failed; }).map(function (x) { return { src: x.currentSrc || x.src, alt: x.alt }; });
      ui.lightbox(list, Math.max(0, imgs.indexOf(img)));
    });
    // نوار پیشرفت مطالعه و فهرست مطالب
    var bar = U.$('#kb-progress');
    var article = el.querySelector('.kb-article');
    var tocLinks = U.$$('#kb-toc a');
    var heads = tocLinks.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
    function onScroll() {
      var r = article.getBoundingClientRect();
      var total = r.height - window.innerHeight;
      var p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 1;
      bar.style.width = (p * 100) + '%';
      var cur = -1;
      heads.forEach(function (hd, i) { if (hd && hd.getBoundingClientRect().top < 120) cur = i; });
      tocLinks.forEach(function (a, i) { a.classList.toggle('is-active', i === cur); });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    U.on(el, 'click', '#kb-toc a', function (e, a) {
      e.preventDefault();
      var t = document.getElementById(a.getAttribute('href').slice(1));
      if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
    });

    // اقدامات
    U.on(el, 'click', '[data-act]', function (e, b) {
      var act = b.getAttribute('data-act');
      if (act === 'like' || act === 'bookmark') {
        if (!KB.can.login()) { requireLogin(act === 'like' ? 'برای پسندیدن محتوا با حساب سازمانی وارد شوید.' : 'برای ذخیره‌ی محتوا و مطالعه‌ی بعدی وارد شوید.'); return; }
        b.disabled = true;
        KB.api.react(item.id, act === 'like' ? 'Like' : 'Bookmark').then(function (r) {
          b.setAttribute('aria-pressed', String(r.active));
          if (act === 'like') { b.classList.toggle('is-active', r.active); b.querySelector('[data-likes]').textContent = U.faNum(r.count); }
          else {
            b.classList.toggle('is-on-brand', r.active);
            U.mount(b, html`${icon(r.active ? 'bookmark-check' : 'bookmark')}<span>${r.active ? 'ذخیره شد' : 'ذخیره برای بعد'}</span>`);
            ui.toast(r.active ? 'به «ذخیره‌شده‌های من» اضافه شد.' : 'از ذخیره‌شده‌ها حذف شد.');
          }
        }).catch(function (err) { ui.toast(err.message, 'error'); }).then(function () { b.disabled = false; });
      } else if (act === 'copy') {
        var done = function () { ui.toast('پیوند کپی شد.'); };
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(location.href).then(done, fallback); else fallback();
        function fallback() { var t = document.createElement('textarea'); t.value = location.href; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (x) { ui.toast('امکان کپی وجود ندارد.', 'error'); } t.remove(); }
      } else if (act === 'print') window.print();
    });
    U.on(el, 'click', '[data-size]', function (e, b) {
      var s = b.getAttribute('data-size');
      prose.className = 'kb-prose ' + s;
      KB.local.set('kb.fontsize', s);
      U.$$('[data-size]', el).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    });

    if (!preview && item.status === 'Published') {
      var key = 'kb.viewed.' + item.id;
      if (!KB.session.get(key)) { KB.session.set(key, 1); setTimeout(function () { KB.api.view(item.id); }, 1500); }
    }
    initComments(U.$('#kb-comments'), item);
    if (location.hash && location.hash.length > 1) { var t = document.getElementById(location.hash.slice(1)); if (t) setTimeout(function () { t.scrollIntoView(); }, 200); }
  }

  /* ------------------------------------------------------------------ نظرات */
  function initComments(box, item) {
    var data = null, replyTo = 0;
    function statusBadge(c) {
      if (c.status === 'Pending') return html`<span class="kb-badge kb-badge-amber">در انتظار تأیید</span>`;
      if (c.status === 'Hidden') return html`<span class="kb-badge kb-badge-accent">مخفی</span>`;
      return '';
    }
    function one(c, isReply) {
      var replies = isReply ? [] : data.items.filter(function (r) { return r.parentId === c.id; });
      return html`<div class="kb-comment ${c.isStaff ? 'is-staff' : ''} ${c.status !== 'Approved' ? 'is-pending' : ''}" id="kb-c-${c.id}">
        ${ui.avatar(c.author)}
        <div class="kb-comment-body">
          <div class="kb-comment-head"><b>${c.author}</b>${c.isStaff ? html`<span class="kb-badge kb-badge-brand">${icon('badge-check')}تیم محتوا</span>` : ''}${statusBadge(c)}<time datetime="${c.date}" title="${U.fmtDateTime(c.date)}">${U.relTime(c.date)}</time></div>
          <div class="kb-comment-text">${c.body}</div>
          <div class="kb-comment-actions">
            ${!isReply && data.canComment ? html`<button type="button" data-reply="${c.id}">${icon('reply', 'kb-ico-sm')}پاسخ</button>` : ''}
            ${KB.can.manage() && c.status !== 'Approved' ? html`<button type="button" data-mod="Approved" data-id="${c.id}">${icon('check', 'kb-ico-sm')}تأیید</button>` : ''}
            ${KB.can.manage() && c.status === 'Approved' ? html`<button type="button" data-mod="Hidden" data-id="${c.id}">${icon('eye-off', 'kb-ico-sm')}مخفی کردن</button>` : ''}
            ${c.canDelete ? html`<button type="button" data-del="${c.id}">${icon('trash', 'kb-ico-sm')}حذف</button>` : ''}
          </div>
          <div data-reply-slot="${c.id}"></div>
          ${replies.length ? html`<div class="kb-replies">${replies.map(function (r) { return one(r, true); })}</div>` : ''}
        </div>
      </div>`;
    }
    function form(parentId) {
      return html`<div class="kb-comment-form">${ui.avatar(KB.state.user.name)}<form data-comment-form="${parentId || 0}">
        <label class="kb-sr" for="kb-cmt-${parentId || 0}">متن نظر</label>
        <textarea class="kb-textarea" id="kb-cmt-${parentId || 0}" maxlength="3000" rows="${parentId ? 2 : 3}" placeholder="${parentId ? 'پاسخ شما…' : 'دیدگاه، پرسش یا تجربه‌ی خود را درباره‌ی این مطلب بنویسید…'}" required></textarea>
        <div class="kb-row" style="margin-top:8px;justify-content:space-between"><span class="kb-hint">${data.moderation === 'Pre' && !KB.can.manage() ? 'نظر شما پس از تأیید تیم محتوا نمایش داده می‌شود.' : 'با نام «' + KB.state.user.name + '» منتشر می‌شود.'}</span>
          <span class="kb-row">${parentId ? html`<button type="button" class="kb-btn kb-btn-ghost kb-btn-sm" data-cancel-reply>انصراف</button>` : ''}<button type="submit" class="kb-btn kb-btn-brand kb-btn-sm">${icon('send')}${parentId ? 'ارسال پاسخ' : 'ثبت نظر'}</button></span></div>
      </form></div>`;
    }
    function draw() {
      var top = data.items.filter(function (c) { return !c.parentId || !data.items.some(function (p) { return p.id === c.parentId; }); })
        .sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
      var count = data.items.filter(function (c) { return c.status === 'Approved'; }).length;
      U.mount(box, html`<h2 class="kb-box-title" style="font-size:18px">${icon('messages')}نظرات کاربران <span class="kb-badge">${U.faNum(count)}</span></h2>
        ${!data.allowComments ? html`<div class="kb-alert">${icon('info')}<span>ثبت نظر برای این محتوا غیرفعال است.</span></div>`
          : KB.state.user.anonymous ? html`<div class="kb-login-box">${icon('message', 'kb-ico-lg kb-muted')}<span class="kb-grow">برای ثبت نظر و پرسش با حساب سازمانی وارد شوید.</span><a class="kb-btn kb-btn-brand kb-btn-sm" href="${KB.loginUrl()}" data-kb-login>${icon('log-in')}ورود</a></div>`
            : form(0)}
        ${top.length ? html`<div>${top.map(function (c) { return one(c, false); })}</div>` : html`<p class="kb-muted" style="padding:10px 0">${data.allowComments ? 'هنوز نظری ثبت نشده است؛ اولین نفر باشید.' : ''}</p>`}`);
      var counter = document.querySelector('#kb-app [data-comments]');
      if (counter) counter.textContent = U.faNum(count);
    }
    function load() {
      KB.api.comments(item.id).then(function (d) { data = d; draw(); }).catch(function (e) { U.mount(box, ui.errorBox(e)); });
    }
    U.on(box, 'submit', '[data-comment-form]', function (e, f) {
      e.preventDefault();
      var ta = f.querySelector('textarea'), btn = f.querySelector('[type=submit]');
      var text = ta.value.trim();
      if (text.length < 2) { ta.setAttribute('aria-invalid', 'true'); ta.focus(); return; }
      ui.busy(btn, true);
      KB.api.addComment(item.id, text, Number(f.getAttribute('data-comment-form')) || 0).then(function (r) {
        ui.toast(r.pending ? 'نظر شما ثبت شد و پس از تأیید نمایش داده می‌شود.' : 'نظر شما منتشر شد.');
        replyTo = 0;
        load();
      }).catch(function (err) { ui.busy(btn, false); ui.toast(err.message, 'error'); });
    });
    U.on(box, 'click', '[data-reply]', function (e, b) {
      var id = Number(b.getAttribute('data-reply'));
      U.$$('[data-reply-slot]', box).forEach(function (s) { s.innerHTML = ''; });
      if (replyTo === id) { replyTo = 0; return; }
      replyTo = id;
      var slot = box.querySelector('[data-reply-slot="' + id + '"]');
      U.mount(slot, form(id));
      slot.querySelector('textarea').focus();
    });
    U.on(box, 'click', '[data-cancel-reply]', function () { replyTo = 0; U.$$('[data-reply-slot]', box).forEach(function (s) { s.innerHTML = ''; }); });
    U.on(box, 'click', '[data-del]', function (e, b) {
      ui.confirm('این نظر حذف شود؟', { danger: true, ok: 'حذف' }).then(function (ok) {
        if (!ok) return;
        KB.api.deleteComment(Number(b.getAttribute('data-del'))).then(function () { ui.toast('نظر حذف شد.'); load(); }).catch(function (err) { ui.toast(err.message, 'error'); });
      });
    });
    U.on(box, 'click', '[data-mod]', function (e, b) {
      KB.api.adminCommentStatus([Number(b.getAttribute('data-id'))], b.getAttribute('data-mod')).then(function () { ui.toast('وضعیت نظر به‌روز شد.'); load(); }).catch(function (err) { ui.toast(err.message, 'error'); });
    });
    load();
  }

  KB.pages.home = home;
  KB.pages.browse = browse;
  KB.pages.content = content;
  KB.renderBody = renderBody;
})(window, document);
