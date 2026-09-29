/* =====================================================================
   پایگاه دانش شستان — پنل مدیریت محتوا (منابع انسانی و مدیر سامانه)
   مسیرها (hash):
     #/                داشبورد
     #/content         مدیریت محتوا
     #/edit/new        افزودن محتوا          #/edit/12   ویرایش
     #/media           کتابخانه‌ی رسانه (DocLib)
     #/comments        مدیریت نظرات
     #/categories      دسته‌بندی‌ها
     #/settings        تنظیمات (فقط مدیر سامانه)
     #/audit           گزارش فعالیت (فقط مدیر سامانه)
   امنیت واقعی در سرور (KBApi.ashx و مجوزهای شیرپوینت) اعمال می‌شود؛ این رابط فقط از آن پیروی می‌کند.
   ===================================================================== */
(function (window, document) {
  'use strict';
  var KB = window.KB;
  var U = KB.util, ui = KB.ui, html = U.html, raw = U.raw, icon = U.icon;
  var api = KB.api;

  var main, side, meta = null, leaveGuard = null, pendingCount = 0;
  var ICON_CHOICES = ['folder', 'book-open', 'graduation', 'briefcase', 'users', 'user', 'cpu', 'monitor', 'database', 'shield-check', 'heart-pulse', 'hard-hat', 'factory',
    'leaf', 'handshake', 'scale', 'megaphone', 'target', 'rocket', 'award', 'zap', 'wrench', 'puzzle', 'layers', 'compass', 'lightbulb', 'chart', 'chart-pie', 'hand-coins',
    'landmark', 'building', 'newspaper', 'help', 'star', 'globe', 'git-branch', 'activity', 'list-checks', 'calendar', 'mail'];
  var COLORS = ['#008000', '#0284c7', '#c22c2c', '#7c3aed', '#d97706', '#0d9488', '#db2777', '#4f46e5', '#ea580c', '#475569', '#0891b2', '#65a30d'];
  var ACTIONS = { Create: 'ایجاد', Update: 'ویرایش', Publish: 'انتشار', Unpublish: 'خارج کردن از انتشار', Archive: 'بایگانی', Delete: 'حذف', Duplicate: 'کپی',
    Status: 'تغییر وضعیت', CommentApprove: 'تأیید نظر', CommentHide: 'مخفی کردن نظر', CommentDelete: 'حذف نظر', CategorySave: 'ذخیره‌ی دسته', CategoryDelete: 'حذف دسته', Settings: 'تغییر تنظیمات', Visibility: 'تغییر سطح دسترسی', Featured: 'تغییر ویژه' };

  function statusOf(it) {
    if (it.status === 'Published' && it.publishAt && new Date(it.publishAt) > new Date()) return 'Scheduled';
    return it.status || 'Draft';
  }
  function statusBadge(it) { var s = statusOf(it); return html`<span class="kb-status kb-status-${s}">${KB.STATUS[s] || s}</span>`; }
  function visBadge(v) { return v === 'Public' ? html`<span class="kb-badge kb-badge-brand">${icon('globe')}عمومی</span>` : html`<span class="kb-badge kb-badge-private">${icon('lock')}کارکنان</span>`; }
  function thumbSmall(it) { return html`<span class="kb-row-thumb">${it.thumb ? html`<img class="kb-img" src="${it.thumb}" alt="" loading="lazy" data-type="${it.type || ''}">` : ui.placeholder(it)}</span>`; }
  function err(e) { ui.toast((e && e.message) || 'خطا', 'error'); }
  function loadingBox() { return html`<div class="kb-card kb-card-pad"><div class="kb-skel" style="height:24px;width:40%"></div><div class="kb-skel kb-skel-line"></div><div class="kb-skel kb-skel-line" style="width:70%"></div><div class="kb-skel" style="height:220px;margin-top:14px"></div></div>`; }
  function head(title, ic, sub, actions) {
    return html`<div class="kb-panel-head"><div class="kb-row"><button type="button" class="kb-btn kb-btn-ghost kb-btn-icon kb-panel-menu" data-side-open aria-label="منوی پنل">${icon('menu')}</button><div><h1>${icon(ic)}${title}</h1>${sub ? html`<p>${sub}</p>` : ''}</div></div><div class="kb-row kb-wrap">${actions || ''}</div></div>`;
  }

  /* ==================================================================== چارچوب پنل */
  function renderSide(route) {
    var u = KB.state.user;
    var links = [
      ['', 'dashboard', 'داشبورد'], ['content', 'library', 'همه‌ی محتوا'], ['edit/new', 'plus', 'افزودن محتوا'], ['media', 'images', 'کتابخانه‌ی رسانه'],
      ['comments', 'messages', 'نظرات'], ['categories', 'folder-open', 'دسته‌بندی‌ها']
    ];
    var adminLinks = [['settings', 'settings', 'تنظیمات سامانه'], ['audit', 'history', 'گزارش فعالیت']];
    function link(l) {
      var active = route === l[0] || (l[0] === 'content' && route.indexOf('edit/') === 0 && route !== 'edit/new');
      return html`<a class="kb-side-link ${active ? 'is-active' : ''}" href="#/${l[0]}">${icon(l[1])}${l[2]}${l[0] === 'comments' && pendingCount ? html`<span class="kb-badge">${U.faNum(pendingCount)}</span>` : ''}</a>`;
    }
    U.mount(side, html`
      <div class="kb-panel-user">${ui.avatar(u.name)}<div class="kb-grow"><b>${u.name}</b><span>${KB.ROLES[u.role]}</span></div></div>
      ${links.map(link)}
      ${KB.can.admin() ? html`<div class="kb-side-title">مدیر سامانه</div>${adminLinks.map(link)}${!KB.config.mock ? html`<a class="kb-side-link" href="${KB.config.site}/_layouts/15/settings.aspx" target="_blank" rel="noopener">${icon('external')}تنظیمات شیرپوینت</a><a class="kb-side-link" href="${KB.config.site}/_layouts/15/user.aspx" target="_blank" rel="noopener">${icon('users')}کاربران و دسترسی‌ها</a>` : ''}` : ''}
      <div class="kb-side-title">میان‌بر</div>
      <a class="kb-side-link" href="${KB.url('home')}" target="_blank" rel="noopener">${icon('home')}مشاهده‌ی سایت</a>`);
  }
  function route() {
    var h = location.hash.replace(/^#\/?/, '');
    var q = h.indexOf('?');
    return { path: q >= 0 ? h.slice(0, q) : h, params: new URLSearchParams(q >= 0 ? h.slice(q + 1) : '') };
  }
  var lastHash = location.hash;
  function navigate() {
    if (leaveGuard && location.hash !== lastHash) {
      var target = location.hash;
      history.replaceState(null, '', lastHash || '#/');
      ui.confirm('تغییرات ذخیره‌نشده از بین می‌رود. ادامه می‌دهید؟', { danger: true, ok: 'بله، خروج' }).then(function (ok) {
        if (ok) { leaveGuard = null; location.hash = target; }
      });
      return;
    }
    lastHash = location.hash;
    var r = route();
    side.classList.remove('is-open');
    var bd = document.querySelector('#kb-app .kb-panel-backdrop'); if (bd) bd.remove();
    renderSide(r.path);
    window.scrollTo(0, 0);
    var p = r.path;
    if (p === '' || p === 'dashboard') return dashboard();
    if (p === 'content') return contentList(r.params);
    if (p.indexOf('edit/') === 0) return editor(p.slice(5));
    if (p === 'media') return mediaPage();
    if (p === 'comments') return commentsPage(r.params);
    if (p === 'categories') return categoriesPage();
    if (p === 'settings' && KB.can.admin()) return settingsPage();
    if (p === 'audit' && KB.can.admin()) return auditPage();
    U.mount(main, ui.empty('help', 'صفحه یافت نشد', '', html`<a class="kb-btn kb-btn-brand" href="#/">داشبورد</a>`));
  }

  function init(el) {
    document.title = 'پنل مدیریت محتوا | ' + KB.setting('SiteTitle', 'پایگاه دانش شستان');
    if (KB.state.user.anonymous) {
      U.mount(el, html`<div class="kb-container" style="padding-top:40px">${ui.empty('lock', 'ابتدا وارد شوید', 'پنل مدیریت محتوا فقط برای کاربران منابع انسانی و مدیران سامانه است.', html`<a class="kb-btn kb-btn-brand" href="${KB.loginUrl()}" data-kb-login>${icon('log-in')}ورود</a>`)}</div>`);
      return;
    }
    if (!KB.can.manage()) {
      U.mount(el, html`<div class="kb-container" style="padding-top:40px">${ui.empty('shield-check', 'دسترسی ندارید', 'برای مدیریت محتوا باید عضو گروه منابع انسانی (KB-HR) یا مدیران سامانه (KB-Admins) باشید. با مدیر سامانه تماس بگیرید.', html`<a class="kb-btn kb-btn-brand" href="${KB.url('home')}">${icon('home')}بازگشت به پایگاه دانش</a>`)}</div>`);
      return;
    }
    U.mount(el, html`<div class="kb-panel"><aside class="kb-panel-side" id="kb-panel-side" aria-label="منوی پنل"></aside><div class="kb-panel-main" id="kb-panel-main"></div></div>`);
    main = document.getElementById('kb-panel-main');
    side = document.getElementById('kb-panel-side');
    U.on(el, 'click', '[data-side-open]', function () {
      side.classList.add('is-open');
      var bd = document.createElement('div'); bd.className = 'kb-drawer-backdrop kb-panel-backdrop'; bd.style.zIndex = 95;
      bd.addEventListener('click', function () { side.classList.remove('is-open'); bd.remove(); });
      document.getElementById('kb-app').appendChild(bd);
    });
    window.addEventListener('hashchange', navigate);
    window.addEventListener('beforeunload', function (e) { if (leaveGuard) { e.preventDefault(); e.returnValue = ''; } });
    api.adminMeta().then(function (m) { meta = m; pendingCount = m.pendingComments || 0; navigate(); }).catch(function (e) { U.mount(main, ui.errorBox(e)); });
  }

  /* ==================================================================== داشبورد */
  function dashboard() {
    U.mount(main, html`${head('داشبورد', 'dashboard', 'نمای کلی وضعیت پایگاه دانش', html`<a class="kb-btn kb-btn-brand" href="#/edit/new">${icon('plus')}محتوای جدید</a>`)}${loadingBox()}`);
    api.adminDashboard().then(function (d) {
      pendingCount = d.comments.pending;
      renderSide('');
      var c = d.counts;
      function bars(obj, meta2) {
        var rows = Object.keys(obj).map(function (k) { return { k: k, v: obj[k] }; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 8);
        var max = Math.max.apply(null, rows.map(function (r) { return r.v; }).concat([1]));
        return rows.length ? html`<div class="kb-bars">${rows.map(function (r) { var m = meta2(r.k); return html`<div class="kb-bar-row"><span class="kb-row" style="min-width:0">${icon(m.icon, 'kb-ico-sm')}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.label}</span></span><span class="kb-bar"><i style="width:${(r.v / max * 100).toFixed(1)}%;--b:${m.color}"></i></span><b>${U.faNum(r.v)}</b></div>`; })}</div>` : ui.empty('chart', 'داده‌ای نیست');
      }
      U.mount(main, html`${head('داشبورد', 'dashboard', 'سلام ' + KB.state.user.name + '؛ نمای کلی وضعیت پایگاه دانش', html`<a class="kb-btn kb-btn-ghost" href="#/media">${icon('cloud-upload')}بارگذاری رسانه</a><a class="kb-btn kb-btn-brand" href="#/edit/new">${icon('plus')}محتوای جدید</a>`)}
        <div class="kb-stats">
          ${stat('library', 'کل محتوا', c.total, '#0284c7', '#/content')}
          ${stat('check-check', 'منتشرشده', c.published, '#008000', '#/content?status=Published')}
          ${stat('pencil', 'پیش‌نویس', c.draft, '#64748b', '#/content?status=Draft')}
          ${stat('calendar-clock', 'زمان‌بندی‌شده', c.scheduled, '#2563eb', '#/content?status=Scheduled')}
          ${stat('lock', 'ویژه‌ی کارکنان', c.private, '#c2410c', '#/content?vis=Private')}
          ${stat('eye', 'مجموع بازدید', d.views, '#0d9488')}
          ${stat('heart', 'مجموع پسند', d.likes, '#c22c2c')}
          ${stat('messages', 'نظرات در انتظار', d.comments.pending, '#d97706', '#/comments')}
        </div>
        <div class="kb-dash-grid">
          <div class="kb-table-card">
            <div class="kb-panel-box-head">${icon('flame')}پربازدیدترین محتوا<a class="kb-more" href="#/content?sort=views">همه</a></div>
            <div class="kb-table-scroll"><table class="kb-table"><thead><tr><th>عنوان</th><th>بازدید</th><th>پسند</th><th>نظر</th></tr></thead><tbody>
              ${d.top.length ? d.top.map(function (it) { return html`<tr><td class="kb-td-title"><div class="kb-row-title">${thumbSmall(it)}<div><a href="#/edit/${it.id}">${it.title}</a><small>${U.typeMeta(it.type).label}${it.category ? ' • ' + it.category : ''}</small></div></div></td><td>${U.faNum(it.views)}</td><td>${U.faNum(it.likes)}</td><td>${U.faNum(it.comments)}</td></tr>`; })
                : html`<tr><td colspan="4">${ui.empty('inbox', 'هنوز محتوایی منتشر نشده')}</td></tr>`}
            </tbody></table></div>
          </div>
          <div>
            <div class="kb-panel-box"><div class="kb-panel-box-head">${icon('message')}آخرین نظرات<a class="kb-more" href="#/comments">مدیریت</a></div><div class="kb-panel-box-body">
              ${d.recentComments.length ? d.recentComments.map(function (cm) { return html`<div class="kb-comment" style="padding:10px 0">${ui.avatar(cm.author)}<div class="kb-comment-body"><div class="kb-comment-head"><b>${cm.author}</b>${cm.status !== 'Approved' ? html`<span class="kb-status kb-status-${cm.status}">${cm.status === 'Pending' ? 'در انتظار' : 'مخفی'}</span>` : ''}<time>${U.relTime(cm.date)}</time></div><div class="kb-comment-text kb-clamp-2" style="font-size:13.5px">${cm.body}</div><a class="kb-more" style="font-size:12px" href="${KB.contentUrl(cm.contentId)}#kb-comments" target="_blank" rel="noopener">${cm.contentTitle}</a></div></div>`; }) : html`<p class="kb-muted">نظری ثبت نشده است.</p>`}
            </div></div>
            <div class="kb-panel-box"><div class="kb-panel-box-head">${icon('chart-pie')}محتوا بر اساس نوع</div><div class="kb-panel-box-body">${bars(d.byType, function (k) { var t = U.typeMeta(k); return { icon: t.icon, label: t.label, color: t.color }; })}</div></div>
            <div class="kb-panel-box"><div class="kb-panel-box-head">${icon('folder-open')}محتوا بر اساس دسته</div><div class="kb-panel-box-body">${bars(d.byCategory, function (k) { var ct = KB.cat(k); return { icon: ct.icon, label: ct.title, color: ct.color }; })}</div></div>
          </div>
        </div>
        <div class="kb-table-card" style="margin-top:18px"><div class="kb-panel-box-head">${icon('history')}آخرین تغییرات<a class="kb-more" href="#/content?sort=modified">همه</a></div>
          <div class="kb-table-scroll"><table class="kb-table"><thead><tr><th>عنوان</th><th>وضعیت</th><th>دسترسی</th><th>آخرین تغییر</th><th></th></tr></thead><tbody>
          ${d.recent.map(function (it) { return html`<tr><td class="kb-td-title"><div class="kb-row-title">${thumbSmall(it)}<div><a href="#/edit/${it.id}">${it.title}</a><small>${it.editor ? it.editor + ' • ' : ''}${U.typeMeta(it.type).label}</small></div></div></td><td>${statusBadge(it)}</td><td>${visBadge(it.visibility)}</td><td title="${U.fmtDateTime(it.modified)}">${U.relTime(it.modified)}</td><td><a class="kb-btn kb-btn-ghost kb-btn-sm" href="#/edit/${it.id}">${icon('pencil')}ویرایش</a></td></tr>`; })}
          </tbody></table></div></div>`);
    }).catch(function (e) { U.mount(main, ui.errorBox(e)); });
  }
  function stat(ic, label, value, color, href) {
    var inner = html`<span class="kb-stat-icon">${icon(ic)}</span><span><b>${U.faNum(value)}</b><span>${label}</span></span>`;
    return href ? html`<a class="kb-stat" style="--s:${color}" href="${href}">${inner}</a>` : html`<div class="kb-stat" style="--s:${color}">${inner}</div>`;
  }

  /* ==================================================================== فهرست محتوا */
  function contentList(params) {
    var st = { status: params.get('status') || '', vis: params.get('vis') || '', type: '', cat: '', q: '', sort: params.get('sort') || 'modified', page: 1, size: 20 };
    var selected = [];
    U.mount(main, html`${head('مدیریت محتوا', 'library', 'جستجو، فیلتر، ویرایش و انتشار همه‌ی محتواهای پایگاه دانش', html`<a class="kb-btn kb-btn-brand" href="#/edit/new">${icon('plus')}محتوای جدید</a>`)}
      <div class="kb-table-card">
        <div class="kb-status-tabs" role="tablist" id="kb-st-tabs"></div>
        <div class="kb-table-tools">
          <div class="kb-toolbar-search" style="min-width:200px">${icon('search')}<input class="kb-input" type="search" placeholder="جستجو در عنوان، خلاصه، برچسب، نویسنده…" data-q aria-label="جستجو"></div>
          <select class="kb-select" data-type style="width:auto" aria-label="نوع"><option value="">همه‌ی انواع</option>${(meta.types || []).map(function (t) { return html`<option value="${t}">${U.typeMeta(t).label}</option>`; })}</select>
          <select class="kb-select" data-cat style="width:auto" aria-label="دسته"><option value="">همه‌ی دسته‌ها</option>${(KB.state.categories || []).map(function (c) { return html`<option value="${c.title}">${c.title}</option>`; })}</select>
          <select class="kb-select" data-vis style="width:auto" aria-label="دسترسی"><option value="">همه‌ی سطوح</option><option value="Public">عمومی</option><option value="Private">ویژه‌ی کارکنان</option></select>
          <select class="kb-select" data-sort style="width:auto" aria-label="مرتب‌سازی">
            <option value="modified">آخرین تغییر</option><option value="new">تاریخ انتشار (جدید)</option><option value="old">تاریخ انتشار (قدیم)</option><option value="views">بازدید</option><option value="likes">پسند</option><option value="comments">نظر</option><option value="title">عنوان</option>
          </select>
        </div>
        <div class="kb-bulk" id="kb-bulk" hidden></div>
        <div class="kb-table-scroll" id="kb-table">${raw('<div style="padding:16px"><div class="kb-skel" style="height:300px"></div></div>')}</div>
        <div class="kb-table-foot" id="kb-table-foot"></div>
      </div>`);
    U.$('[data-vis]', main).value = st.vis;
    U.$('[data-sort]', main).value = st.sort;
    var tabsEl = U.$('#kb-st-tabs'), table = U.$('#kb-table'), foot = U.$('#kb-table-foot'), bulk = U.$('#kb-bulk'), seq = 0, rows = [];

    function drawTabs(counts) {
      var tabs = [['', 'همه', counts.all], ['Published', 'منتشرشده', counts.Published], ['Draft', 'پیش‌نویس', counts.Draft], ['Scheduled', 'زمان‌بندی‌شده', counts.Scheduled], ['Archived', 'بایگانی', counts.Archived]];
      U.mount(tabsEl, tabs.map(function (t) { return html`<button type="button" role="tab" aria-selected="${st.status === t[0]}" data-status="${t[0]}">${t[1]}<small>${U.faNum(t[2] || 0)}</small></button>`; }));
    }
    function drawBulk() {
      selected = selected.filter(function (id) { return rows.some(function (r) { return r.id === id; }); });
      bulk.hidden = !selected.length;
      if (!selected.length) return;
      U.mount(bulk, html`<b>${U.faNum(selected.length)} مورد انتخاب شد:</b>
        <button type="button" class="kb-btn kb-btn-ghost kb-btn-sm" data-bulk="Published">${icon('check')}انتشار</button>
        <button type="button" class="kb-btn kb-btn-ghost kb-btn-sm" data-bulk="Draft">${icon('pencil')}پیش‌نویس</button>
        <button type="button" class="kb-btn kb-btn-ghost kb-btn-sm" data-bulk="Archived">${icon('archive')}بایگانی</button>
        <button type="button" class="kb-btn kb-btn-ghost kb-btn-sm" data-bulk-vis="Public">${icon('globe')}عمومی</button>
        <button type="button" class="kb-btn kb-btn-ghost kb-btn-sm" data-bulk-vis="Private">${icon('lock')}ویژه‌ی کارکنان</button>
        <button type="button" class="kb-btn kb-btn-danger kb-btn-sm" data-bulk-del>${icon('trash')}حذف</button>
        <button type="button" class="kb-btn kb-btn-link kb-btn-sm" data-bulk-clear>لغو انتخاب</button>`);
    }
    function load() {
      var my = ++seq;
      table.style.opacity = '.55';
      api.adminList({ q: st.q, status: st.status, vis: st.vis, type: st.type, cat: st.cat, sort: st.sort, page: st.page, size: st.size }).then(function (r) {
        if (my !== seq) return;
        table.style.opacity = '';
        rows = r.items;
        drawTabs(r.counts);
        U.mount(table, rows.length ? html`<table class="kb-table"><thead><tr>
            <th style="width:36px"><label class="kb-check"><input type="checkbox" data-all aria-label="انتخاب همه"></label></th>
            <th>عنوان</th><th>وضعیت</th><th>دسترسی</th><th>نویسنده</th><th>انتشار</th><th title="بازدید / پسند / نظر">آمار</th><th></th></tr></thead><tbody>
          ${rows.map(function (it) {
            var sel = selected.indexOf(it.id) >= 0;
            return html`<tr class="${sel ? 'is-selected' : ''}">
              <td><label class="kb-check"><input type="checkbox" data-sel="${it.id}" ${sel ? raw('checked') : ''} aria-label="انتخاب"></label></td>
              <td class="kb-td-title"><div class="kb-row-title">${thumbSmall(it)}<div><a href="#/edit/${it.id}">${it.title || '(بدون عنوان)'}</a><small>${it.featured ? html`${icon('star', 'kb-ico-sm')} ` : ''}${U.typeMeta(it.type).label}${it.category ? ' • ' + it.category : ''}${it.attachmentsCount ? html` • ${icon('paperclip', 'kb-ico-sm')}${U.faNum(it.attachmentsCount)}` : ''}</small></div></div></td>
              <td>${statusBadge(it)}</td><td>${visBadge(it.visibility)}</td>
              <td style="white-space:nowrap">${it.author && it.author.name || '—'}</td>
              <td style="white-space:nowrap" title="${U.fmtDateTime(it.publishAt || it.created)}">${U.fmtDateShort(it.publishAt || it.created)}</td>
              <td style="white-space:nowrap"><span class="kb-meta"><span>${icon('eye')}${U.compact(it.views)}</span><span>${icon('heart')}${U.faNum(it.likes)}</span><span>${icon('message')}${U.faNum(it.comments)}</span></span></td>
              <td style="white-space:nowrap"><div class="kb-row">
                <a class="kb-btn kb-btn-ghost kb-btn-icon kb-btn-sm" href="#/edit/${it.id}" title="ویرایش">${icon('pencil')}</a>
                <a class="kb-btn kb-btn-ghost kb-btn-icon kb-btn-sm" href="${KB.url('content', { id: it.id, preview: 1 })}" target="_blank" rel="noopener" title="مشاهده">${icon('eye')}</a>
                <div class="kb-nav-item"><button type="button" class="kb-btn kb-btn-ghost kb-btn-icon kb-btn-sm" data-kb-dd aria-controls="kb-row-${it.id}" aria-expanded="false" title="بیشتر">${icon('more-v')}</button>
                  <div class="kb-dropdown kb-dropdown-end" id="kb-row-${it.id}" hidden>
                    ${it.status !== 'Published' ? html`<button type="button" class="kb-dropdown-item" data-row="Published" data-id="${it.id}">${icon('check')}انتشار</button>` : html`<button type="button" class="kb-dropdown-item" data-row="Draft" data-id="${it.id}">${icon('eye-off')}خارج کردن از انتشار</button>`}
                    <button type="button" class="kb-dropdown-item" data-row-feat="${it.featured ? 0 : 1}" data-id="${it.id}">${icon('star')}${it.featured ? 'حذف از ویژه‌ها' : 'افزودن به ویژه‌ها'}</button>
                    <button type="button" class="kb-dropdown-item" data-row-dup="${it.id}">${icon('copy')}ایجاد کپی</button>
                    ${it.status !== 'Archived' ? html`<button type="button" class="kb-dropdown-item" data-row="Archived" data-id="${it.id}">${icon('archive')}بایگانی</button>` : ''}
                    <div class="kb-dropdown-sep"></div>
                    <button type="button" class="kb-dropdown-item" data-row-del="${it.id}" style="color:#c22c2c">${icon('trash')}حذف</button>
                  </div></div>
              </div></td></tr>`;
          })}</tbody></table>`
          : ui.empty('search', 'محتوایی با این شرایط یافت نشد', '', html`<a class="kb-btn kb-btn-brand" href="#/edit/new">${icon('plus')}افزودن محتوا</a>`));
        U.mount(foot, html`<span>${U.faNum(r.total)} مورد</span>${ui.pager(r.page, r.pages)}`);
        drawBulk();
      }).catch(function (e) { table.style.opacity = ''; U.mount(table, ui.errorBox(e)); });
    }
    function refreshAfter(p, msg) { return p.then(function () { ui.toast(msg); selected = []; load(); }).catch(err); }
    U.on(tabsEl, 'click', '[data-status]', function (e, b) { st.status = b.getAttribute('data-status'); st.page = 1; load(); });
    U.$('[data-q]', main).addEventListener('input', U.debounce(function () { st.q = this.value.trim(); st.page = 1; load(); }, 350));
    ['type', 'cat', 'vis', 'sort'].forEach(function (k) { U.$('[data-' + k + ']', main).addEventListener('change', function () { st[k] = this.value; st.page = 1; load(); }); });
    ui.bindPager(foot, function (p) { st.page = p; load(); });
    U.on(table, 'change', '[data-all]', function (e, c) { selected = c.checked ? rows.map(function (r) { return r.id; }) : []; U.$$('[data-sel]', table).forEach(function (x) { x.checked = c.checked; x.closest('tr').classList.toggle('is-selected', c.checked); }); drawBulk(); });
    U.on(table, 'change', '[data-sel]', function (e, c) {
      var id = Number(c.getAttribute('data-sel'));
      selected = selected.filter(function (x) { return x !== id; });
      if (c.checked) selected.push(id);
      c.closest('tr').classList.toggle('is-selected', c.checked);
      drawBulk();
    });
    U.on(bulk, 'click', '[data-bulk]', function (e, b) { refreshAfter(api.adminStatus(selected, b.getAttribute('data-bulk')), 'وضعیت ' + U.faNum(selected.length) + ' مورد تغییر کرد.'); });
    U.on(bulk, 'click', '[data-bulk-vis]', function (e, b) {
      var v = b.getAttribute('data-bulk-vis');
      ui.confirm('سطح دسترسی ' + U.faNum(selected.length) + ' مورد «' + KB.VISIBILITY[v] + '» شود؟', { detail: v === 'Public' ? 'این محتواها بدون ورود برای همه قابل مشاهده می‌شوند.' : '' }).then(function (ok) {
        if (ok) refreshAfter(api.adminStatus(selected, null, { visibility: v }), 'سطح دسترسی به‌روز شد.');
      });
    });
    U.on(bulk, 'click', '[data-bulk-del]', function () {
      ui.confirm('حذف ' + U.faNum(selected.length) + ' محتوا؟', { danger: true, ok: 'حذف', detail: 'موارد حذف‌شده به سطل بازیافت شیرپوینت منتقل می‌شوند و مدیر سامانه می‌تواند آن‌ها را بازگرداند.' }).then(function (ok) {
        if (ok) refreshAfter(api.adminDelete(selected), 'حذف شد.');
      });
    });
    U.on(bulk, 'click', '[data-bulk-clear]', function () { selected = []; U.$$('[data-sel],[data-all]', table).forEach(function (x) { x.checked = false; }); U.$$('tr.is-selected', table).forEach(function (x) { x.classList.remove('is-selected'); }); drawBulk(); });
    U.on(table, 'click', '[data-row]', function (e, b) { refreshAfter(api.adminStatus([Number(b.getAttribute('data-id'))], b.getAttribute('data-row')), 'وضعیت تغییر کرد.'); });
    U.on(table, 'click', '[data-row-feat]', function (e, b) { refreshAfter(api.adminStatus([Number(b.getAttribute('data-id'))], null, { featured: b.getAttribute('data-row-feat') === '1' }), 'به‌روز شد.'); });
    U.on(table, 'click', '[data-row-dup]', function (e, b) {
      api.adminDuplicate(Number(b.getAttribute('data-row-dup'))).then(function (r) { ui.toast('کپی به‌صورت پیش‌نویس ساخته شد.'); location.hash = '#/edit/' + r.item.id; }).catch(err);
    });
    U.on(table, 'click', '[data-row-del]', function (e, b) {
      ui.confirm('این محتوا حذف شود؟', { danger: true, ok: 'حذف', detail: 'به سطل بازیافت شیرپوینت منتقل می‌شود.' }).then(function (ok) { if (ok) refreshAfter(api.adminDelete([Number(b.getAttribute('data-row-del'))]), 'حذف شد.'); });
    });
    load();
  }
  /* ==================================================================== ویرایشگر محتوا */
  function editor(idPart) {
    var isNew = idPart === 'new';
    var id = isNew ? 0 : Number(idPart);
    U.mount(main, loadingBox());
    var load = isNew ? Promise.resolve(null) : api.adminGet(id);
    Promise.all([load, api.adminAuthors().catch(function () { return { items: [] }; })]).then(function (r) {
      drawEditor(r[0], r[1].items || []);
    }).catch(function (e) { U.mount(main, e.status === 404 ? ui.empty('search', 'محتوا یافت نشد', '', html`<a class="kb-btn kb-btn-brand" href="#/content">بازگشت</a>`) : ui.errorBox(e)); });
  }

  function drawEditor(item, authors) {
    var isNew = !item;
    var draftKey = 'kb.draft.new';
    var restore = isNew ? KB.local.get(draftKey) : null;
    var it = item || {
      id: 0, title: '', summary: '', body: '', type: (meta.types || [])[0] || 'مقاله', category: '', tags: [], status: 'Draft', visibility: meta.defaultVisibility || 'Public',
      publishAt: null, featured: false, allowComments: true, thumb: '', media: '', minutes: null, author: { name: KB.state.user.name, bio: '', image: '' }, attachments: []
    };
    var state = {
      id: it.id, attachments: (it.attachments || []).slice(), tags: (it.tags || []).slice(), thumb: it.rawThumb != null ? it.rawThumb : it.thumb || '', media: it.rawMedia != null ? it.rawMedia : it.media || '',
      authorImage: (it.author && (it.author.rawImage != null ? it.author.rawImage : it.author.image)) || '', publishAt: it.publishAt, minutesAuto: !it.minutes, dirty: false
    };
    var typeChoices = (meta.types || []).slice();
    if (it.type && typeChoices.indexOf(it.type) < 0) typeChoices.push(it.type);
    var catChoices = (KB.state.categories || []).map(function (c) { return c.title; });
    (meta.categoryChoices || []).forEach(function (c) { if (catChoices.indexOf(c) < 0) catChoices.push(c); });
    if (it.category && catChoices.indexOf(it.category) < 0) catChoices.push(it.category);

    U.mount(main, html`
      ${head(isNew ? 'افزودن محتوای جدید' : 'ویرایش محتوا', isNew ? 'plus' : 'pencil', isNew ? 'پس از تکمیل، ذخیره یا منتشر کنید' : html`شناسه‌ی ${U.faNum(it.id)} — آخرین تغییر ${U.relTime(it.modified)}${it.editor ? ' توسط ' + it.editor : ''}`,
        html`<a class="kb-btn kb-btn-ghost" href="#/content">${icon('arrow-right')}بازگشت</a>${!isNew ? html`<a class="kb-btn kb-btn-ghost" href="${KB.url('content', { id: it.id, preview: 1 })}" target="_blank" rel="noopener">${icon('eye')}پیش‌نمایش</a>` : ''}`)}
      ${restore ? html`<div class="kb-alert kb-alert-warn" style="margin-bottom:16px" id="kb-restore">${icon('history')}<span class="kb-grow">یک پیش‌نویس ذخیره‌نشده از ${U.relTime(restore.at)} در این مرورگر وجود دارد.</span><button type="button" class="kb-btn kb-btn-ghost kb-btn-sm" data-restore>بازیابی</button><button type="button" class="kb-btn kb-btn-link kb-btn-sm" data-discard>نادیده گرفتن</button></div>` : ''}
      <form class="kb-editor-grid" id="kb-edit-form" novalidate>
        <div style="min-width:0">
          <div class="kb-panel-box"><div class="kb-panel-box-body">
            <label class="kb-sr" for="f-title">عنوان</label>
            <input id="f-title" class="kb-input kb-title-input" name="title" maxlength="255" placeholder="عنوان محتوا را بنویسید…" value="${it.title}" required>
            <div class="kb-field" style="margin-top:10px;margin-bottom:0"><label class="kb-label" for="f-summary">خلاصه <small>(در کارت‌ها و نتایج جستجو نمایش داده می‌شود؛ حداکثر ۳۰۰ نویسه پیشنهاد می‌شود)</small></label>
              <textarea id="f-summary" class="kb-textarea" name="summary" rows="3" maxlength="1000" style="min-height:70px">${it.summary}</textarea><span class="kb-hint" data-sum-count></span></div>
          </div></div>
          <div id="kb-rte-host"></div>
          <div class="kb-panel-box" style="margin-top:16px">
            <div class="kb-panel-box-head"><span class="kb-row">${icon('paperclip')}پیوست‌ها و فایل‌های اختصاصی این محتوا</span><span class="kb-hint" style="margin:0">دسترسی به پیوست‌ها تابع سطح دسترسی همین محتواست</span></div>
            <div class="kb-panel-box-body">
              <div class="kb-drop" id="kb-att-drop" tabindex="0" role="button">${icon('cloud-upload')}<div><b>فایل‌ها را اینجا رها کنید</b> یا برای انتخاب کلیک کنید</div><small>PDF، Word، Excel، PowerPoint، تصویر، ویدیو، صوت و فایل فشرده</small></div>
              <input type="file" id="kb-att-input" multiple hidden>
              <div class="kb-upload-list" id="kb-att-list"></div>
            </div>
          </div>
        </div>
        <div>
          <div class="kb-panel-box">
            <div class="kb-panel-box-head">${icon('send')}انتشار</div>
            <div class="kb-panel-box-body">
              <div class="kb-field"><label class="kb-label" for="f-status">وضعیت</label>
                <select id="f-status" class="kb-select" name="status">${[['Draft', 'پیش‌نویس'], ['Published', 'منتشرشده'], ['Archived', 'بایگانی']].map(function (o) { return html`<option value="${o[0]}" ${it.status === o[0] ? raw('selected') : ''}>${o[1]}</option>`; })}</select></div>
              <div class="kb-field"><span class="kb-label">سطح دسترسی</span>
                <div class="kb-segment" style="display:flex" data-vis>
                  <button type="button" data-v="Public" aria-pressed="${it.visibility === 'Public'}" style="flex:1">${icon('globe')}عمومی</button>
                  <button type="button" data-v="Private" aria-pressed="${it.visibility !== 'Public'}" style="flex:1">${icon('lock')}ویژه‌ی کارکنان</button>
                </div><span class="kb-hint" data-vis-hint></span></div>
              <div class="kb-field"><label class="kb-label" for="f-date">زمان انتشار <small>(خالی = همین حالا)</small></label><div id="kb-date-host"></div></div>
              <div class="kb-field"><label class="kb-switch"><input type="checkbox" name="featured" ${it.featured ? raw('checked') : ''}><span class="kb-switch-track"></span>نمایش در بخش ویژه‌ی صفحه‌ی اصلی</label></div>
              <div class="kb-field"><label class="kb-switch"><input type="checkbox" name="allowComments" ${it.allowComments !== false ? raw('checked') : ''}><span class="kb-switch-track"></span>امکان ثبت نظر</label></div>
              ${!isNew ? html`<div style="border-top:1px solid #eef0f3;padding-top:10px;margin-top:4px">
                <div class="kb-kv"><span>بازدید</span><b>${U.faNum(it.views)}</b></div><div class="kb-kv"><span>پسند</span><b>${U.faNum(it.likes)}</b></div><div class="kb-kv"><span>نظر</span><b>${U.faNum(it.comments)}</b></div>
                <div class="kb-kv"><span>ایجاد</span><b>${U.fmtDateTime(it.created)}</b></div>${it.createdBy ? html`<div class="kb-kv"><span>ایجادکننده</span><b>${it.createdBy}</b></div>` : ''}</div>` : ''}
            </div>
            <div class="kb-publish-actions">
              <button type="submit" class="kb-btn kb-btn-brand" data-save="publish">${icon('send')}<span data-publish-label>${it.status === 'Published' ? 'به‌روزرسانی' : 'انتشار'}</span></button>
              <button type="button" class="kb-btn kb-btn-ghost" data-save="draft">${icon('save')}ذخیره پیش‌نویس</button>
              ${!isNew ? html`<div class="kb-nav-item"><button type="button" class="kb-btn kb-btn-ghost kb-btn-icon" data-kb-dd aria-controls="kb-ed-more" aria-expanded="false" aria-label="بیشتر">${icon('more-v')}</button>
                <div class="kb-dropdown kb-dropdown-end" id="kb-ed-more" hidden style="bottom:calc(100% + 8px);top:auto">
                  <button type="button" class="kb-dropdown-item" data-ed="dup">${icon('copy')}ایجاد کپی</button>
                  <a class="kb-dropdown-item" href="${KB.contentUrl(it.id)}" target="_blank" rel="noopener">${icon('external')}صفحه‌ی عمومی</a>
                  <div class="kb-dropdown-sep"></div>
                  <button type="button" class="kb-dropdown-item" data-ed="del" style="color:#c22c2c">${icon('trash')}حذف</button>
                </div></div>` : ''}
            </div>
          </div>
          <div class="kb-panel-box"><div class="kb-panel-box-head">${icon('folder-open')}طبقه‌بندی</div><div class="kb-panel-box-body">
            <div class="kb-field"><label class="kb-label" for="f-type">نوع محتوا</label>
              <select id="f-type" class="kb-select" name="type">${typeChoices.map(function (t) { return html`<option value="${t}" ${t === it.type ? raw('selected') : ''}>${U.typeMeta(t).label}${U.typeMeta(t).label !== t ? ' (' + t + ')' : ''}</option>`; })}</select></div>
            <div class="kb-field"><label class="kb-label" for="f-cat">دسته‌بندی</label>
              <div class="kb-row"><select id="f-cat" class="kb-select" name="category"><option value="">— بدون دسته —</option>${catChoices.map(function (c) { return html`<option value="${c}" ${c === it.category ? raw('selected') : ''}>${c}</option>`; })}</select>
              <button type="button" class="kb-btn kb-btn-ghost kb-btn-icon" data-new-cat title="دسته‌ی جدید" aria-label="دسته‌ی جدید">${icon('plus')}</button></div></div>
            <div class="kb-field"><label class="kb-label" for="f-tag">برچسب‌ها <small>(Enter یا ویرگول)</small></label>
              <div class="kb-autocomplete"><div class="kb-tags-input" id="kb-tags"><input id="f-tag" autocomplete="off" placeholder="افزودن برچسب…"></div><div class="kb-suggest" hidden id="kb-tag-suggest"></div></div></div>
          </div></div>
          <div class="kb-panel-box"><div class="kb-panel-box-head">${icon('image')}تصویر شاخص</div><div class="kb-panel-box-body">
            <div class="kb-thumb-picker" id="kb-thumb" tabindex="0" role="button" aria-label="انتخاب تصویر شاخص"></div>
            <span class="kb-hint">نسبت ۱۶:۹ (مثلاً ۱۲۰۰×۶۷۵ پیکسل). برای محتوای ویدیو/پادکست به‌عنوان کاور هم استفاده می‌شود.</span>
          </div></div>
          <div class="kb-panel-box"><div class="kb-panel-box-head">${icon('play-circle')}رسانه‌ی اصلی <small class="kb-muted" style="font-weight:400">(ویدیو یا صوت)</small></div><div class="kb-panel-box-body">
            <div id="kb-media-main"></div>
          </div></div>
          <div class="kb-panel-box"><div class="kb-panel-box-head">${icon('user')}نویسنده</div><div class="kb-panel-box-body">
            <div class="kb-field kb-autocomplete"><label class="kb-label" for="f-author">نام نویسنده</label>
              <input id="f-author" class="kb-input" name="authorName" value="${it.author && it.author.name || ''}" autocomplete="off" maxlength="255">
              <div class="kb-suggest" hidden id="kb-author-suggest"></div></div>
            <div class="kb-field"><label class="kb-label" for="f-bio">معرفی کوتاه</label><textarea id="f-bio" class="kb-textarea" name="authorBio" rows="2" style="min-height:60px">${it.author && it.author.bio || ''}</textarea></div>
            <div class="kb-row"><span id="kb-author-img"></span><button type="button" class="kb-btn kb-btn-ghost kb-btn-sm" data-author-img>${icon('image')}تصویر نویسنده</button></div>
          </div></div>
          <div class="kb-panel-box"><div class="kb-panel-box-head">${icon('clock')}زمان مطالعه</div><div class="kb-panel-box-body">
            <div class="kb-row"><input class="kb-input" type="number" min="1" max="600" name="minutes" style="width:100px" value="${it.minutes || ''}" aria-label="دقیقه"><span>دقیقه</span>
            <label class="kb-check" style="margin-right:auto"><input type="checkbox" data-min-auto ${state.minutesAuto ? raw('checked') : ''}>محاسبه‌ی خودکار</label></div>
          </div></div>
        </div>
      </form>`);

    var form = U.$('#kb-edit-form');
    function markDirty() {
      state.dirty = true;
      leaveGuard = true;
      if (isNew) saveLocal();
    }
    var saveLocal = U.debounce(function () {
      if (!isNew || state.id) return;
      KB.local.set(draftKey, { at: new Date().toISOString(), data: collect() });
    }, 1500);

    // ویرایشگر
    var rte = KB.editor.create(U.$('#kb-rte-host'), {
      value: it.body,
      onChange: function () { markDirty(); autoMinutes(); },
      pickMedia: function (kind) { return pickFile(kind === 'image' ? 'image' : kind === 'media' ? 'media' : 'any'); },
      onPasteFiles: function (files) { uploadAttachments(files, true); }
    });
    function autoMinutes() { if (state.minutesAuto) form.elements.minutes.value = U.readingMinutes(rte.getHTML()); }
    if (state.minutesAuto) autoMinutes();

    // تاریخ انتشار
    var datePicker = jalaliPicker(U.$('#kb-date-host'), state.publishAt, function (v) { state.publishAt = v; markDirty(); updatePublishLabel(); });

    // سطح دسترسی
    var visibility = it.visibility === 'Public' ? 'Public' : 'Private';
    function drawVisHint() {
      U.$('[data-vis-hint]', form).textContent = visibility === 'Public'
        ? 'همه، حتی بدون ورود، این محتوا را می‌بینند.'
        : 'فقط کاربرانی که با حساب سازمانی وارد شده‌اند می‌بینند؛ پیوست‌ها هم محافظت می‌شوند.';
    }
    drawVisHint();
    U.on(form, 'click', '[data-vis] button', function (e, b) {
      visibility = b.getAttribute('data-v');
      U.$$('[data-vis] button', form).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      drawVisHint(); markDirty();
    });
    function updatePublishLabel() {
      var s = form.elements.status.value;
      var future = state.publishAt && new Date(state.publishAt) > new Date();
      var lbl = U.$('[data-publish-label]', form);
      if (lbl) lbl.textContent = future ? 'زمان‌بندی انتشار' : s === 'Published' && !isNew ? 'به‌روزرسانی' : 'انتشار';
    }
    form.elements.status.addEventListener('change', function () { markDirty(); updatePublishLabel(); });
    updatePublishLabel();

    // شمارنده‌ی خلاصه
    var sumCount = function () { var n = form.elements.summary.value.length; U.$('[data-sum-count]', form).textContent = U.faNum(n) + ' نویسه' + (n > 300 ? ' — بهتر است کوتاه‌تر باشد' : ''); };
    form.elements.summary.addEventListener('input', sumCount); sumCount();
    form.addEventListener('input', function (e) { if (!e.target.closest('.kb-rte')) markDirty(); });
    form.elements.minutes.addEventListener('input', function () { state.minutesAuto = false; U.$('[data-min-auto]', form).checked = false; });
    U.$('[data-min-auto]', form).addEventListener('change', function () { state.minutesAuto = this.checked; autoMinutes(); });

    // برچسب‌ها
    var tagsBox = U.$('#kb-tags'), tagInput = U.$('#f-tag'), tagSuggest = U.$('#kb-tag-suggest');
    function drawTags() {
      U.$$('.kb-chip-x', tagsBox).forEach(function (x) { x.remove(); });
      state.tags.forEach(function (t, i) {
        var s = document.createElement('span');
        s.className = 'kb-chip-x';
        U.mount(s, html`#${t}<button type="button" data-rm-tag="${i}" aria-label="حذف برچسب">${icon('x', 'kb-ico-sm')}</button>`);
        tagsBox.insertBefore(s, tagInput);
      });
    }
    function addTag(t) {
      t = String(t || '').replace(/^#/, '').trim();
      if (t && state.tags.indexOf(t) < 0 && state.tags.length < 20) { state.tags.push(t); drawTags(); markDirty(); }
      tagInput.value = ''; tagSuggest.hidden = true;
    }
    drawTags();
    tagsBox.addEventListener('click', function (e) { var b = e.target.closest('[data-rm-tag]'); if (b) { state.tags.splice(Number(b.getAttribute('data-rm-tag')), 1); drawTags(); markDirty(); } else tagInput.focus(); });
    tagInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ',' || e.key === '،') { e.preventDefault(); addTag(tagInput.value); }
      else if (e.key === 'Backspace' && !tagInput.value && state.tags.length) { state.tags.pop(); drawTags(); markDirty(); }
    });
    tagInput.addEventListener('input', function () {
      var q = U.normalizeFa(tagInput.value);
      var list = (KB.state.tags || []).map(function (t) { return t.tag; }).filter(function (t) { return q && U.normalizeFa(t).indexOf(q) >= 0 && state.tags.indexOf(t) < 0; }).slice(0, 8);
      U.mount(tagSuggest, list.map(function (t) { return html`<button type="button" class="kb-suggest-item" style="width:100%" data-tag="${t}">#${t}</button>`; }));
      tagSuggest.hidden = !list.length;
    });
    tagInput.addEventListener('blur', function () { setTimeout(function () { if (tagInput.value.trim()) addTag(tagInput.value); tagSuggest.hidden = true; }, 200); });
    U.on(tagSuggest, 'mousedown', '[data-tag]', function (e, b) { e.preventDefault(); addTag(b.getAttribute('data-tag')); });

    // نویسنده (تکمیل خودکار از نویسندگان قبلی)
    var authorInput = form.elements.authorName, authorSuggest = U.$('#kb-author-suggest');
    authorInput.addEventListener('input', function () {
      var q = U.normalizeFa(authorInput.value);
      var list = authors.filter(function (a) { return !q || U.normalizeFa(a.name).indexOf(q) >= 0; }).slice(0, 6);
      U.mount(authorSuggest, list.map(function (a, i) { return html`<button type="button" class="kb-suggest-item" style="width:100%" data-author="${i}">${ui.avatar(a.name, a.image)}<span class="kb-grow">${a.name}<small>${U.faNum(a.count)} محتوا</small></span></button>`; }));
      authorSuggest.hidden = !list.length;
      authorSuggest._list = list;
    });
    authorInput.addEventListener('blur', function () { setTimeout(function () { authorSuggest.hidden = true; }, 200); });
    U.on(authorSuggest, 'mousedown', '[data-author]', function (e, b) {
      e.preventDefault();
      var a = authorSuggest._list[Number(b.getAttribute('data-author'))];
      authorInput.value = a.name;
      if (a.bio) form.elements.authorBio.value = a.bio;
      if (a.image) { state.authorImage = a.image; drawAuthorImg(); }
      authorSuggest.hidden = true; markDirty();
    });
    function drawAuthorImg() {
      U.mount(U.$('#kb-author-img'), state.authorImage ? html`<span class="kb-row">${ui.avatar('', state.authorImage)}<button type="button" class="kb-btn kb-btn-link kb-btn-sm" data-author-img-rm>حذف</button></span>` : ui.avatar(authorInput.value));
    }
    drawAuthorImg();
    U.on(form, 'click', '[data-author-img]', function () { pickFile('image').then(function (f) { if (f) { state.authorImage = f.url; drawAuthorImg(); markDirty(); } }); });
    U.on(form, 'click', '[data-author-img-rm]', function () { state.authorImage = ''; drawAuthorImg(); markDirty(); });

    // دسته‌ی جدید
    U.on(form, 'click', '[data-new-cat]', function () {
      editCategory(null).then(function (c) {
        if (!c) return;
        var sel = form.elements.category;
        if (!sel.querySelector('option[value="' + CSS.escape(c.title) + '"]')) sel.insertAdjacentHTML('beforeend', String(html`<option value="${c.title}">${c.title}</option>`));
        sel.value = c.title; markDirty();
      });
    });

    // تصویر شاخص
    var thumbEl = U.$('#kb-thumb');
    function drawThumb() {
      U.mount(thumbEl, state.thumb
        ? html`<img src="${previewUrl(state.thumb)}" alt=""><span class="kb-thumb-actions"><button type="button" class="kb-btn kb-btn-white kb-btn-sm" data-thumb-change>${icon('refresh')}تغییر</button><button type="button" class="kb-btn kb-btn-danger kb-btn-sm" data-thumb-rm>${icon('trash')}</button></span>`
        : html`<span>${icon('image', 'kb-ico-lg')}<br>انتخاب از کتابخانه یا بارگذاری تصویر</span>`);
    }
    drawThumb();
    function chooseThumb() { pickFile('image').then(function (f) { if (f) { state.thumb = f.url; drawThumb(); markDirty(); } }); }
    thumbEl.addEventListener('click', function (e) { if (e.target.closest('[data-thumb-rm]')) { e.stopPropagation(); state.thumb = ''; drawThumb(); markDirty(); return; } chooseThumb(); });
    thumbEl.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseThumb(); } });

    // رسانه‌ی اصلی
    var mediaEl = U.$('#kb-media-main');
    function drawMedia() {
      var k = U.isMediaUrl(U.fileNameOf(state.media));
      U.mount(mediaEl, state.media
        ? html`${k === 'video' ? html`<video src="${previewUrl(state.media)}" controls preload="metadata" style="width:100%;border-radius:10px;background:#000"></video>` : k === 'audio' ? html`<audio src="${previewUrl(state.media)}" controls style="width:100%"></audio>` : ''}
          <div class="kb-row" style="margin-top:8px"><span class="kb-grow kb-hint" style="margin:0;direction:ltr;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${state.media}">${U.fileNameOf(state.media)}</span><button type="button" class="kb-btn kb-btn-ghost kb-btn-sm" data-media-change>تغییر</button><button type="button" class="kb-btn kb-btn-danger kb-btn-sm" data-media-rm>${icon('trash')}</button></div>`
        : html`<button type="button" class="kb-btn kb-btn-ghost" style="width:100%" data-media-change>${icon('play-circle')}انتخاب ویدیو یا فایل صوتی</button><span class="kb-hint">در بالای صفحه‌ی محتوا به‌جای تصویر شاخص پخش می‌شود. ویدیو و صوت داخل متن را از نوار ابزار ویرایشگر درج کنید.</span>`);
    }
    drawMedia();
    U.on(mediaEl, 'click', '[data-media-change]', function () { pickFile('media').then(function (f) { if (f) { state.media = f.url; drawMedia(); markDirty(); } }); });
    U.on(mediaEl, 'click', '[data-media-rm]', function () { state.media = ''; drawMedia(); markDirty(); });

    // پیوست‌ها
    var attList = U.$('#kb-att-list'), attInput = U.$('#kb-att-input'), attDrop = U.$('#kb-att-drop');
    function drawAttachments() {
      U.mount(attList, state.attachments.map(function (a) {
        var k = U.fileKind(a.name), media = U.isMediaUrl(a.name);
        return html`<div class="kb-upload-item"><span class="kb-file-icon" style="--f:${k.color};width:36px;height:36px">${icon(k.icon)}</span>
          <span class="kb-grow"><b title="${a.name}">${a.name}</b><span class="kb-muted">${a.size ? U.fileSize(a.size) : ''}</span></span>
          <button type="button" class="kb-btn kb-btn-ghost kb-btn-sm" data-att-insert="${a.name}" title="درج در متن">${icon('plus')}درج در متن</button>
          ${media === 'image' ? html`<button type="button" class="kb-btn kb-btn-ghost kb-btn-icon kb-btn-sm" data-att-thumb="${a.name}" title="تصویر شاخص">${icon('image')}</button>` : ''}
          ${media === 'video' || media === 'audio' ? html`<button type="button" class="kb-btn kb-btn-ghost kb-btn-icon kb-btn-sm" data-att-media="${a.name}" title="رسانه‌ی اصلی">${icon('play-circle')}</button>` : ''}
          <a class="kb-btn kb-btn-ghost kb-btn-icon kb-btn-sm" href="${a.url}" target="_blank" rel="noopener" title="دریافت">${icon('download')}</a>
          <button type="button" class="kb-btn kb-btn-danger kb-btn-icon kb-btn-sm" data-att-del="${a.name}" title="حذف">${icon('trash')}</button></div>`;
      }));
    }
    drawAttachments();
    function attByName(n) { return state.attachments.filter(function (a) { return a.name === n; })[0]; }
    U.on(attList, 'click', '[data-att-insert]', function (e, b) { var a = attByName(b.getAttribute('data-att-insert')); rte.insertFile({ url: a.rawUrl || a.url, name: a.name }, U.isMediaUrl(a.name) ? 'media' : 'any'); });
    U.on(attList, 'click', '[data-att-thumb]', function (e, b) { var a = attByName(b.getAttribute('data-att-thumb')); state.thumb = a.rawUrl || a.url; drawThumb(); markDirty(); ui.toast('تصویر شاخص تنظیم شد.'); });
    U.on(attList, 'click', '[data-att-media]', function (e, b) { var a = attByName(b.getAttribute('data-att-media')); state.media = a.rawUrl || a.url; drawMedia(); markDirty(); ui.toast('رسانه‌ی اصلی تنظیم شد.'); });
    U.on(attList, 'click', '[data-att-del]', function (e, b) {
      var name = b.getAttribute('data-att-del');
      ui.confirm('پیوست «' + name + '» حذف شود؟', { danger: true, ok: 'حذف', detail: 'اگر این فایل در متن یا به‌عنوان تصویر شاخص استفاده شده، آن بخش نمایش داده نخواهد شد.' }).then(function (ok) {
        if (!ok) return;
        api.deleteAttachment(state.id, name).then(function () {
          state.attachments = state.attachments.filter(function (a) { return a.name !== name; });
          drawAttachments(); ui.toast('پیوست حذف شد.');
        }).catch(err);
      });
    });
    attDrop.addEventListener('click', function () { attInput.click(); });
    attDrop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); attInput.click(); } });
    attInput.addEventListener('change', function () { uploadAttachments(Array.prototype.slice.call(attInput.files)); attInput.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) { attDrop.addEventListener(ev, function (e) { e.preventDefault(); attDrop.classList.add('is-over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { attDrop.addEventListener(ev, function (e) { e.preventDefault(); attDrop.classList.remove('is-over'); }); });
    attDrop.addEventListener('drop', function (e) { uploadAttachments(Array.prototype.slice.call(e.dataTransfer.files)); });

    /** پیوست به محتوای ذخیره‌نشده ممکن نیست؛ ابتدا پیش‌نویس ذخیره می‌شود */
    function ensureSaved() {
      if (state.id) return Promise.resolve(state.id);
      if (!form.elements.title.value.trim()) { form.elements.title.value = 'پیش‌نویس بدون عنوان'; }
      ui.toast('برای افزودن پیوست، محتوا به‌صورت پیش‌نویس ذخیره شد.');
      return save('draft', true).then(function () { return state.id; });
    }
    function uploadAttachments(files, insertIntoBody) {
      if (!files.length) return Promise.resolve([]);
      var tooBig = files.filter(function (f) { return meta.maxUploadMb && f.size > meta.maxUploadMb * 1048576; });
      if (tooBig.length) { ui.toast('حجم «' + tooBig[0].name + '» بیش از ' + U.faNum(meta.maxUploadMb) + ' مگابایت است.', 'error'); files = files.filter(function (f) { return tooBig.indexOf(f) < 0; }); }
      return ensureSaved().then(function (itemId) {
        var jobs = files.map(function (f) {
          var row = document.createElement('div');
          row.className = 'kb-upload-item';
          U.mount(row, html`${icon('loader', 'kb-spin')}<span class="kb-grow"><b>${f.name}</b><span class="kb-upload-bar"><i></i></span></span><span class="kb-muted">${U.fileSize(f.size)}</span>`);
          attList.appendChild(row);
          return api.uploadAttachment(itemId, f, function (p) { row.querySelector('.kb-upload-bar > i').style.width = (p * 100) + '%'; }).then(function (a) {
            row.remove();
            var att = { name: a.name, size: a.size || f.size, url: a.url, rawUrl: a.url };
            state.attachments = state.attachments.filter(function (x) { return x.name !== att.name; }).concat([att]);
            drawAttachments();
            if (insertIntoBody) rte.insertFile({ url: att.rawUrl, name: att.name }, U.isMediaUrl(att.name) ? 'media' : 'any');
            return att;
          }).catch(function (e) { row.classList.add('is-error'); U.mount(row.querySelector('.kb-grow'), html`<b>${f.name}</b><span class="kb-error">${e.message}</span>`); return null; });
        });
        return Promise.all(jobs).then(function (r) { var ok = r.filter(Boolean).length; if (ok) ui.toast(U.faNum(ok) + ' فایل پیوست شد.'); return r.filter(Boolean); });
      }).catch(err);
    }

    /** انتخاب فایل: کتابخانه‌ی رسانه (عمومی) / پیوست‌های همین محتوا / نشانی */
    function pickFile(kind) {
      return new Promise(function (resolve) {
        var chosen = null;
        var m = ui.modal({
          title: kind === 'image' ? 'انتخاب تصویر' : kind === 'media' ? 'انتخاب ویدیو یا صوت' : 'انتخاب فایل', icon: 'images', size: 'xl',
          body: html`<div class="kb-segment" data-src style="margin-bottom:14px">
              <button type="button" data-v="lib" aria-pressed="true">${icon('images')}کتابخانه‌ی رسانه (عمومی)</button>
              <button type="button" data-v="att" aria-pressed="false">${icon('lock')}پیوست‌های این محتوا</button>
              <button type="button" data-v="url" aria-pressed="false">${icon('link')}نشانی</button></div>
            <div data-pane></div>`,
          onClose: function () { resolve(chosen); }
        });
        var pane = U.$('[data-pane]', m.el);
        function show(src) {
          U.$$('[data-src] button', m.el).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === src)); });
          if (src === 'lib') {
            U.mount(pane, visibility === 'Private' ? html`<div class="kb-alert kb-alert-warn" style="margin-bottom:12px">${icon('alert')}<span>این محتوا «ویژه‌ی کارکنان» است، اما فایل‌های کتابخانه‌ی رسانه برای همه قابل دریافت‌اند. برای فایل‌های محرمانه از «پیوست‌های این محتوا» استفاده کنید.</span></div><div data-lib></div>` : html`<div data-lib></div>`);
            mediaBrowser(U.$('[data-lib]', pane), { pick: kind, onPick: function (f) { chosen = f; m.close(); } });
          } else if (src === 'att') {
            var list = state.attachments.filter(function (a) { var k = U.isMediaUrl(a.name); return kind === 'any' || (kind === 'image' ? k === 'image' : k === 'video' || k === 'audio'); });
            U.mount(pane, html`<div class="kb-drop" data-att-up>${icon('cloud-upload')}<div><b>بارگذاری فایل جدید به‌عنوان پیوست</b></div><small>دسترسی به این فایل‌ها مانند خود محتوا کنترل می‌شود</small></div><input type="file" hidden data-att-file ${kind === 'image' ? raw('accept="image/*"') : kind === 'media' ? raw('accept="video/*,audio/*"') : ''}>
              <div class="kb-media-grid" style="margin-top:14px">${list.map(function (a) {
                var k = U.isMediaUrl(a.name);
                return html`<div class="kb-media-item" data-pick-att="${a.name}" tabindex="0"><div class="kb-media-prev">${k === 'image' ? html`<img src="${a.url}" alt="" loading="lazy">` : icon(U.fileKind(a.name).icon)}</div><div class="kb-media-info"><b>${a.name}</b><span>${U.fileSize(a.size)}</span></div></div>`;
              })}</div>${!list.length ? html`<p class="kb-muted" style="text-align:center;padding:10px">فایل مناسبی پیوست نشده است.</p>` : ''}`);
            U.$('[data-att-up]', pane).addEventListener('click', function () { U.$('[data-att-file]', pane).click(); });
            U.$('[data-att-file]', pane).addEventListener('change', function () {
              var files = Array.prototype.slice.call(this.files);
              uploadAttachments(files).then(function (atts) { if (atts && atts[0]) { chosen = { url: atts[0].rawUrl || atts[0].url, name: atts[0].name }; m.close(); } });
            });
            U.on(pane, 'click', '[data-pick-att]', function (e, b) { var a = attByName(b.getAttribute('data-pick-att')); chosen = { url: a.rawUrl || a.url, name: a.name }; m.close(); });
          } else {
            U.mount(pane, html`<form data-url-form><label class="kb-label" for="kb-pick-url">نشانی فایل</label><input id="kb-pick-url" class="kb-input kb-input-ltr" placeholder="/DocLib/video.mp4 یا http://…" autofocus>
              <span class="kb-hint">نشانی نسبی فایل‌های همین شیرپوینت پیشنهاد می‌شود. شبکه‌ی داخلی ممکن است به اینترنت دسترسی نداشته باشد.</span>
              <label class="kb-label" for="kb-pick-title" style="margin-top:12px">عنوان (اختیاری)</label><input id="kb-pick-title" class="kb-input">
              <button type="submit" class="kb-btn kb-btn-brand" style="margin-top:14px">${icon('check')}درج</button></form>`);
            U.$('[data-url-form]', pane).addEventListener('submit', function (e) {
              e.preventDefault();
              var u = U.safeUrl(U.$('#kb-pick-url', pane).value);
              if (!u) return;
              chosen = { url: u, name: U.fileNameOf(u), title: U.$('#kb-pick-title', pane).value.trim() };
              m.close();
            });
          }
        }
        U.on(m.el, 'click', '[data-src] button', function (e, b) { show(b.getAttribute('data-v')); });
        show(visibility === 'Private' && state.attachments.length ? 'att' : 'lib');
      });
    }

    function collect() {
      return {
        id: state.id || 0,
        title: form.elements.title.value.trim(),
        summary: form.elements.summary.value.trim(),
        body: rte.getHTML(),
        type: form.elements.type.value,
        category: form.elements.category.value,
        tags: state.tags.slice(),
        status: form.elements.status.value,
        visibility: visibility,
        publishAt: state.publishAt || null,
        featured: form.elements.featured.checked,
        allowComments: form.elements.allowComments.checked,
        thumb: state.thumb,
        media: state.media,
        minutes: Number(form.elements.minutes.value) || null,
        authorName: form.elements.authorName.value.trim(),
        authorBio: form.elements.authorBio.value.trim(),
        authorImage: state.authorImage
      };
    }
    function validate(d) {
      var bad = null;
      if (!d.title) bad = [form.elements.title, 'عنوان را وارد کنید.'];
      else if (d.status === 'Published' && !U.stripHtml(d.body) && !d.media && !state.attachments.length) bad = [null, 'متن محتوا خالی است؛ متن، رسانه یا پیوست اضافه کنید.'];
      if (bad) { if (bad[0]) { bad[0].setAttribute('aria-invalid', 'true'); bad[0].focus(); } ui.toast(bad[1], 'error'); return false; }
      form.elements.title.removeAttribute('aria-invalid');
      return true;
    }
    /** نشانی‌های کتابخانه‌ی عمومی رسانه که در محتوای خصوصی استفاده شده‌اند */
    function publicFilesIn(d) {
      var root = (meta.mediaUrl || '').toLowerCase();
      if (!root) return [];
      var urls = [];
      var consider = function (u) {
        if (!u) return;
        var path = u.replace(/^https?:\/\/[^/]+/i, '');
        if (path.toLowerCase().indexOf(root + '/') === 0 && urls.indexOf(u) < 0) urls.push(u);
      };
      [d.thumb, d.media, d.authorImage].forEach(consider);
      var box = document.createElement('div'); box.innerHTML = d.body;
      U.$$('[src], [href]', box).forEach(function (x) { consider(x.getAttribute('src') || x.getAttribute('href')); });
      return urls;
    }
    function movePublicFiles(urls, removeOriginals) {
      var chain = Promise.resolve();
      urls.forEach(function (u) {
        chain = chain.then(function () {
          return api.copyToAttachment(state.id, u).then(function (a) {
            var att = { name: a.name, size: a.size, url: a.url, rawUrl: a.url };
            state.attachments = state.attachments.filter(function (x) { return x.name !== att.name; }).concat([att]);
            rte.replaceUrl(u, att.rawUrl);
            if (state.thumb === u) state.thumb = att.rawUrl;
            if (state.media === u) state.media = att.rawUrl;
            if (state.authorImage === u) state.authorImage = att.rawUrl;
            if (removeOriginals) return api.mediaDelete(u.replace(/^https?:\/\/[^/]+/i, '')).catch(function () { /* شاید در محتوای دیگری هم استفاده شده */ });
          });
        });
      });
      return chain.then(function () { drawAttachments(); drawThumb(); drawMedia(); drawAuthorImg(); });
    }

    var saving = false;
    function save(mode, silent) {
      if (saving) return Promise.reject(new Error('در حال ذخیره…'));
      var d = collect();
      if (mode === 'draft') d.status = 'Draft';
      else if (mode === 'publish' && d.status !== 'Archived') d.status = 'Published';
      if (!validate(d)) return Promise.reject(new Error('اطلاعات ناقص است'));
      saving = true;
      var btns = U.$$('[data-save]', form);
      var btn = mode === 'draft' ? btns[1] : btns[0];
      if (!silent) ui.busy(btn, true);
      return api.adminSave(d).then(function (r) {
        var wasNew = !state.id;
        state.id = r.item.id;
        form.elements.status.value = r.item.status;
        updatePublishLabel();
        state.dirty = false; leaveGuard = null;
        KB.local.remove(draftKey);
        if (wasNew) { history.replaceState(null, '', '#/edit/' + state.id); lastHash = location.hash; }
        var urls = d.visibility === 'Private' ? publicFilesIn(collect()) : [];
        if (!silent) ui.toast(r.item.status === 'Published' ? (r.item.publishAt && new Date(r.item.publishAt) > new Date() ? 'انتشار زمان‌بندی شد.' : 'محتوا منتشر شد.') : 'ذخیره شد.');
        if (urls.length && !silent) return askMove(urls).then(function () { return r; });
        return r;
      }).catch(function (e) { err(e); throw e; }).then(function (r) {
        saving = false; if (!silent) ui.busy(btn, false);
        isNew = false;
        updatePublishLabel();
        return r;
      }, function (e) { saving = false; if (!silent) ui.busy(btn, false); throw e; });
    }
    function askMove(urls) {
      return new Promise(function (resolve) {
        var m = ui.modal({
          title: 'فایل‌های عمومی در محتوای ویژه‌ی کارکنان', icon: 'alert',
          body: html`<p style="line-height:2">این محتوا «ویژه‌ی کارکنان» است، اما ${U.faNum(urls.length)} فایل از کتابخانه‌ی عمومی رسانه در آن استفاده شده که <b>بدون ورود هم قابل دریافت است</b>:</p>
            <ul style="margin:10px 0;padding-right:18px;list-style:disc;direction:ltr;text-align:right">${urls.map(function (u) { return html`<li>${U.fileNameOf(u)}</li>`; })}</ul>
            <p style="line-height:2">پیشنهاد می‌شود این فایل‌ها به پیوست‌های همین محتوا منتقل شوند تا فقط کارکنان به آن‌ها دسترسی داشته باشند.</p>
            <label class="kb-check" style="margin-top:8px"><input type="checkbox" data-rm checked>حذف نسخه‌ی عمومی از کتابخانه‌ی رسانه</label>`,
          foot: html`<button type="button" class="kb-btn kb-btn-brand" data-move>${icon('lock')}انتقال به پیوست‌ها و ذخیره</button><button type="button" class="kb-btn kb-btn-ghost" data-kb-close>فعلاً نه</button>`,
          onClose: function () { resolve(); }
        });
        m.el.querySelector('[data-move]').addEventListener('click', function () {
          var b = this; ui.busy(b, true);
          movePublicFiles(urls, m.el.querySelector('[data-rm]').checked).then(function () {
            return api.adminSave(collect());
          }).then(function () { ui.toast('فایل‌ها منتقل و محتوا ذخیره شد.'); m.close(); }).catch(function (e) { ui.busy(b, false); err(e); });
        });
      });
    }
    form.addEventListener('submit', function (e) { e.preventDefault(); save('publish').catch(function () { /* پیام داده شد */ }); });
    U.on(form, 'click', '[data-save="draft"]', function () { save('draft').catch(function () { /* */ }); });
    document.addEventListener('keydown', function onKey(e) {
      if (!document.body.contains(form)) { document.removeEventListener('keydown', onKey); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(form.elements.status.value === 'Published' ? 'publish' : 'draft').catch(function () { /* */ }); }
    });
    U.on(form, 'click', '[data-ed="dup"]', function () { api.adminDuplicate(state.id).then(function (r) { leaveGuard = null; ui.toast('کپی ساخته شد.'); location.hash = '#/edit/' + r.item.id; }).catch(err); });
    U.on(form, 'click', '[data-ed="del"]', function () {
      ui.confirm('این محتوا حذف شود؟', { danger: true, ok: 'حذف', detail: 'به سطل بازیافت شیرپوینت منتقل می‌شود.' }).then(function (ok) {
        if (ok) api.adminDelete([state.id]).then(function () { leaveGuard = null; ui.toast('حذف شد.'); location.hash = '#/content'; }).catch(err);
      });
    });
    var restoreBox = U.$('#kb-restore');
    if (restoreBox) {
      U.on(restoreBox, 'click', '[data-restore]', function () {
        var d = restore.data;
        form.elements.title.value = d.title || ''; form.elements.summary.value = d.summary || ''; rte.setHTML(d.body || '');
        if (d.type) form.elements.type.value = d.type; if (d.category) form.elements.category.value = d.category;
        state.tags = d.tags || []; drawTags(); state.thumb = d.thumb || ''; drawThumb(); state.media = d.media || ''; drawMedia();
        form.elements.authorName.value = d.authorName || ''; form.elements.authorBio.value = d.authorBio || ''; state.authorImage = d.authorImage || ''; drawAuthorImg();
        visibility = d.visibility || visibility; U.$$('[data-vis] button', form).forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-v') === visibility)); }); drawVisHint();
        restoreBox.remove(); markDirty(); sumCount();
      });
      U.on(restoreBox, 'click', '[data-discard]', function () { KB.local.remove(draftKey); restoreBox.remove(); });
    }
    datePicker.set(state.publishAt);
    if (isNew) form.elements.title.focus();
  }

  /** نشانی قابل نمایش در پنل (پیوست‌ها با نشانی مستقیم برای مدیر محتوا قابل دریافت است) */
  function previewUrl(u) { return u; }

  /* ------------------------------------------------------------------ انتخابگر تاریخ و ساعت شمسی */
  function jalaliPicker(host, value, onChange) {
    var J = U.jalali, val = value ? new Date(value) : null, view = null;
    U.mount(host, html`<div class="kb-autocomplete"><div class="kb-row">
        <button type="button" class="kb-input" data-open style="text-align:right;display:flex;align-items:center;gap:8px" id="f-date">${icon('calendar', 'kb-muted')}<span data-label></span></button>
        <input class="kb-input" type="time" data-time style="width:110px" aria-label="ساعت">
        <button type="button" class="kb-btn kb-btn-ghost kb-btn-icon" data-clear title="انتشار فوری" aria-label="پاک کردن">${icon('x')}</button></div>
      <div class="kb-suggest" data-cal hidden style="padding:10px;width:290px;left:auto"></div></div>`);
    var label = U.$('[data-label]', host), time = U.$('[data-time]', host), cal = U.$('[data-cal]', host);
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function draw() {
      label.textContent = val ? U.fmtDate(val) : 'همین حالا (انتشار فوری)';
      time.value = val ? pad(val.getHours()) + ':' + pad(val.getMinutes()) : '';
      time.disabled = !val;
    }
    function emit() { onChange(val ? val.toISOString() : null); draw(); }
    function drawCal() {
      var first = J.to(view.jy, view.jm, 1), len = J.monthLength(view.jy, view.jm), start = J.weekday(first);
      var sel = val ? J.from(val) : null, today = J.from(new Date());
      var cells = [];
      for (var i = 0; i < start; i++) cells.push(html`<span></span>`);
      for (var d = 1; d <= len; d++) {
        var isSel = sel && sel.jy === view.jy && sel.jm === view.jm && sel.jd === d;
        var isToday = today.jy === view.jy && today.jm === view.jm && today.jd === d;
        cells.push(html`<button type="button" data-d="${d}" style="height:34px;border-radius:9px;font-size:13px;${isSel ? 'background:#008000;color:#fff;font-weight:700' : isToday ? 'box-shadow:inset 0 0 0 1px #008000' : ''}">${U.faNum(d)}</button>`);
      }
      U.mount(cal, html`<div class="kb-row" style="justify-content:space-between;margin-bottom:8px">
          <button type="button" class="kb-btn kb-btn-ghost kb-btn-icon kb-btn-sm" data-m="-1" aria-label="ماه قبل">${icon('chevron-right')}</button>
          <b>${J.MONTHS[view.jm - 1]} ${U.faDigits(view.jy)}</b>
          <button type="button" class="kb-btn kb-btn-ghost kb-btn-icon kb-btn-sm" data-m="1" aria-label="ماه بعد">${icon('chevron-left')}</button></div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;text-align:center;font-size:12px;color:#6b7280;margin-bottom:4px">${J.WEEKDAYS.map(function (w) { return html`<span>${w}</span>`; })}</div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">${cells}</div>
        <div class="kb-row" style="justify-content:space-between;margin-top:8px"><button type="button" class="kb-btn kb-btn-link kb-btn-sm" data-today>امروز</button><button type="button" class="kb-btn kb-btn-link kb-btn-sm" data-close-cal>بستن</button></div>`);
    }
    U.$('[data-open]', host).addEventListener('click', function () {
      var base = J.from(val || new Date());
      view = { jy: base.jy, jm: base.jm };
      drawCal(); cal.hidden = !cal.hidden;
    });
    U.on(cal, 'click', '[data-m]', function (e, b) {
      view.jm += Number(b.getAttribute('data-m'));
      if (view.jm < 1) { view.jm = 12; view.jy--; } if (view.jm > 12) { view.jm = 1; view.jy++; }
      drawCal();
    });
    U.on(cal, 'click', '[data-d]', function (e, b) {
      var g = J.to(view.jy, view.jm, Number(b.getAttribute('data-d')));
      var h = val ? val.getHours() : 8, mi = val ? val.getMinutes() : 0;
      g.setHours(h, mi, 0, 0);
      val = g; emit(); cal.hidden = true;
    });
    U.on(cal, 'click', '[data-today]', function () { var n = new Date(); n.setSeconds(0, 0); val = n; emit(); cal.hidden = true; });
    U.on(cal, 'click', '[data-close-cal]', function () { cal.hidden = true; });
    time.addEventListener('change', function () {
      if (!val || !time.value) return;
      var p = time.value.split(':');
      val = new Date(val); val.setHours(Number(p[0]), Number(p[1]), 0, 0); emit();
    });
    U.$('[data-clear]', host).addEventListener('click', function () { val = null; emit(); });
    document.addEventListener('click', function (e) { if (!host.contains(e.target)) cal.hidden = true; });
    draw();
    return { set: function (v) { val = v ? new Date(v) : null; draw(); } };
  }

  /* ==================================================================== کتابخانه‌ی رسانه */
  function mediaPage() {
    U.mount(main, html`${head('کتابخانه‌ی رسانه', 'images', 'تصاویر، ویدیوها، فایل‌های صوتی و اسناد عمومی (' + (meta.mediaTitle || 'DocLib') + ')')}
      <div class="kb-alert" style="margin-bottom:16px">${icon('info')}<span>فایل‌های این کتابخانه <b>برای همه، حتی بدون ورود</b>، قابل مشاهده‌اند. فایل‌های محرمانه را به‌صورت «پیوست» در همان محتوای ویژه‌ی کارکنان بارگذاری کنید.</span></div>
      <div id="kb-media"></div>`);
    mediaBrowser(U.$('#kb-media'), {});
  }

  /** مرورگر کتابخانه‌ی رسانه؛ opts.pick = 'image' | 'media' | 'any' برای حالت انتخاب */
  function mediaBrowser(host, opts) {
    var st = { folder: null, root: null, filter: opts.pick === 'image' ? 'image' : opts.pick === 'media' ? 'media' : '', q: '', data: null, selected: null };
    U.mount(host, html`<div class="kb-table-card">
      <div class="kb-table-tools">
        <nav class="kb-breadcrumb" style="margin:0;flex:1" data-crumbs></nav>
        <div class="kb-toolbar-search" style="flex:0 1 220px;min-width:160px">${icon('search')}<input class="kb-input" type="search" placeholder="جستجوی نام فایل" data-mq aria-label="جستجو"></div>
        <select class="kb-select" data-mf style="width:auto" aria-label="نوع فایل"><option value="">همه‌ی فایل‌ها</option><option value="image">تصویر</option><option value="media">ویدیو و صوت</option><option value="video">ویدیو</option><option value="audio">صوت</option><option value="doc">اسناد</option></select>
        <button type="button" class="kb-btn kb-btn-ghost" data-mfolder>${icon('folder-plus')}پوشه</button>
        <button type="button" class="kb-btn kb-btn-brand" data-mup>${icon('cloud-upload')}بارگذاری</button>
        <input type="file" multiple hidden data-mfile>
      </div>
      <div style="padding:14px">
        <div class="kb-upload-list" data-mqueue style="margin:0 0 12px"></div>
        <div class="kb-media-layout" data-mlayout><div data-mgrid>${raw('<div class="kb-skel" style="height:260px"></div>')}</div><aside data-mdetail hidden></aside></div>
      </div></div>`);
    U.$('[data-mf]', host).value = st.filter;
    var grid = U.$('[data-mgrid]', host), detail = U.$('[data-mdetail]', host), queue = U.$('[data-mqueue]', host), fileInput = U.$('[data-mfile]', host);

    function kindOf(name) { var k = U.isMediaUrl(name); return k || 'doc'; }
    function match(f) {
      var k = kindOf(f.name);
      if (st.filter === 'media' && k !== 'video' && k !== 'audio') return false;
      if (st.filter && st.filter !== 'media' && k !== st.filter) return false;
      if (st.q && U.normalizeFa(f.name).indexOf(U.normalizeFa(st.q)) < 0) return false;
      return true;
    }
    function crumbs() {
      var rootUrl = st.data.root, cur = st.data.folder.url;
      var parts = cur.slice(rootUrl.length).split('/').filter(Boolean);
      var acc = rootUrl;
      U.mount(U.$('[data-crumbs]', host), html`<a href="#" data-go="${rootUrl}">${icon('images', 'kb-ico-sm')} ${meta.mediaTitle || 'کتابخانه‌ی رسانه'}</a>${parts.map(function (p) { acc += '/' + p; return html`${icon('chevron-left')}<a href="#" data-go="${acc}">${p}</a>`; })}`);
    }
    function drawGrid() {
      var d = st.data;
      var files = d.files.filter(match).sort(function (a, b) { return new Date(b.modified) - new Date(a.modified); });
      var folders = st.q ? [] : d.folders;
      U.mount(grid, folders.length || files.length ? html`<div class="kb-media-grid">
        ${d.folder.url !== d.root ? html`<div class="kb-media-item kb-media-folder" data-go="${d.folder.url.slice(0, d.folder.url.lastIndexOf('/'))}" tabindex="0"><div class="kb-media-prev">${icon('arrow-right')}</div><div class="kb-media-info"><b>بازگشت</b><span>پوشه‌ی بالاتر</span></div></div>` : ''}
        ${folders.map(function (f) { return html`<div class="kb-media-item kb-media-folder" data-go="${f.url}" tabindex="0"><div class="kb-media-prev">${icon('folder')}</div><div class="kb-media-info"><b>${f.name}</b><span>${U.faNum(f.count)} مورد</span></div></div>`; })}
        ${files.map(function (f) {
          var k = kindOf(f.name), fk = U.fileKind(f.name);
          return html`<div class="kb-media-item ${st.selected && st.selected.url === f.url ? 'is-selected' : ''}" data-file="${f.url}" tabindex="0">
            <div class="kb-media-prev">${k === 'image' ? html`<img src="${f.url}" alt="" loading="lazy">` : html`<span style="color:${fk.color}">${icon(fk.icon)}</span>`}${k === 'video' || k === 'audio' ? html`<span class="kb-badge kb-badge-dark">${k === 'video' ? 'ویدیو' : 'صوت'}</span>` : ''}</div>
            <div class="kb-media-actions">
              <button type="button" class="kb-btn kb-btn-icon kb-btn-sm" data-copy="${f.url}" title="کپی نشانی" aria-label="کپی نشانی">${icon('link')}</button>
              <button type="button" class="kb-btn kb-btn-icon kb-btn-sm" data-mdel="${f.url}" title="حذف" aria-label="حذف" style="color:#c22c2c">${icon('trash')}</button>
            </div>
            <div class="kb-media-info"><b title="${f.name}">${f.name}</b><span>${U.fileSize(f.size)} • ${U.fmtDateShort(f.modified)}</span></div></div>`;
        })}</div>` : ui.empty('images', 'پوشه خالی است', 'فایل‌ها را با دکمه‌ی «بارگذاری» یا کشیدن و رها کردن اضافه کنید.'));
      crumbs();
    }
    function drawDetail() {
      var f = st.selected;
      U.$('[data-mlayout]', host).classList.toggle('has-detail', !!f);
      detail.hidden = !f;
      if (!f) return;
      var k = kindOf(f.name);
      var abs = location.origin + f.url;
      U.mount(detail, html`<div class="kb-panel-box kb-media-detail" style="position:sticky;top:80px"><div class="kb-panel-box-head">جزئیات فایل<button type="button" class="kb-btn kb-btn-ghost kb-btn-icon kb-btn-sm" data-close-detail aria-label="بستن">${icon('x')}</button></div><div class="kb-panel-box-body">
        ${k === 'image' ? html`<img src="${f.url}" alt="">` : k === 'video' ? html`<video src="${f.url}" controls preload="metadata"></video>` : k === 'audio' ? html`<audio src="${f.url}" controls style="width:100%"></audio>` : html`<div class="kb-empty-icon">${icon(U.fileKind(f.name).icon)}</div>`}
        <div style="margin-top:12px"><div class="kb-kv"><span>نام</span><b style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:170px" title="${f.name}">${f.name}</b></div><div class="kb-kv"><span>حجم</span><b>${U.fileSize(f.size)}</b></div><div class="kb-kv"><span>تاریخ</span><b>${U.fmtDateTime(f.modified)}</b></div></div>
        <label class="kb-label" style="margin-top:10px" for="kb-furl">نشانی</label><input id="kb-furl" class="kb-input kb-input-ltr" readonly value="${abs}" onfocus="this.select()">
        <div class="kb-row kb-wrap" style="margin-top:12px">
          ${opts.pick ? html`<button type="button" class="kb-btn kb-btn-brand" data-choose>${icon('check')}انتخاب</button>` : ''}
          <button type="button" class="kb-btn kb-btn-ghost kb-btn-sm" data-copy="${f.url}">${icon('copy')}کپی نشانی</button>
          <a class="kb-btn kb-btn-ghost kb-btn-sm" href="${f.url}" target="_blank" rel="noopener">${icon('external')}باز کردن</a>
          <button type="button" class="kb-btn kb-btn-danger kb-btn-sm" data-mdel="${f.url}">${icon('trash')}حذف</button>
        </div></div></div>`);
    }
    function load(folder) {
      grid.style.opacity = '.55';
      return api.mediaList(folder).then(function (d) {
        grid.style.opacity = '';
        st.data = d; st.folder = d.folder.url; st.root = d.root;
        drawGrid();
      }).catch(function (e) { grid.style.opacity = ''; U.mount(grid, ui.errorBox(e)); });
    }
    function upload(files) {
      var accepted = files.filter(function (f) {
        if (opts.pick === 'image' && !/^image\//.test(f.type)) return false;
        if (meta.maxUploadMb && f.size > meta.maxUploadMb * 1048576) { ui.toast('حجم «' + f.name + '» بیش از حد مجاز است.', 'error'); return false; }
        return true;
      });
      var last = null;
      var jobs = accepted.map(function (f) {
        var row = document.createElement('div');
        row.className = 'kb-upload-item';
        U.mount(row, html`${icon('loader', 'kb-spin')}<span class="kb-grow"><b>${f.name}</b><span class="kb-upload-bar"><i></i></span></span><span class="kb-muted">${U.fileSize(f.size)}</span>`);
        queue.appendChild(row);
        return api.mediaUpload(st.folder, f, function (p) { row.querySelector('.kb-upload-bar > i').style.width = (p * 100) + '%'; })
          .then(function (res) { row.remove(); last = res; return res; })
          .catch(function (e) { row.classList.add('is-error'); U.mount(row.querySelector('.kb-grow'), html`<b>${f.name}</b><span class="kb-error">${e.message}</span>`); });
      });
      Promise.all(jobs).then(function (r) {
        var ok = r.filter(Boolean).length;
        if (ok) ui.toast(U.faNum(ok) + ' فایل بارگذاری شد.');
        return load(st.folder).then(function () {
          if (last && opts.pick && ok === 1) { st.selected = st.data.files.filter(function (x) { return x.url === last.url; })[0] || last; drawGrid(); drawDetail(); }
        });
      });
    }
    U.on(host, 'click', '[data-go]', function (e, b) { e.preventDefault(); st.selected = null; drawDetail(); load(b.getAttribute('data-go')); });
    U.on(host, 'keydown', '[data-go], [data-file]', function (e, b) { if (e.key === 'Enter') b.click(); });
    U.on(grid, 'click', '[data-file]', function (e, b) {
      if (e.target.closest('.kb-media-actions')) return;
      st.selected = st.data.files.filter(function (x) { return x.url === b.getAttribute('data-file'); })[0];
      U.$$('.kb-media-item', grid).forEach(function (x) { x.classList.toggle('is-selected', x === b); });
      drawDetail();
    });
    U.on(grid, 'dblclick', '[data-file]', function (e, b) {
      if (!opts.pick) return;
      var f = st.data.files.filter(function (x) { return x.url === b.getAttribute('data-file'); })[0];
      if (f) opts.onPick({ url: f.url, name: f.name });
    });
    U.on(detail, 'click', '[data-choose]', function () { opts.onPick({ url: st.selected.url, name: st.selected.name }); });
    U.on(detail, 'click', '[data-close-detail]', function () { st.selected = null; drawDetail(); U.$$('.kb-media-item', grid).forEach(function (x) { x.classList.remove('is-selected'); }); });
    U.on(host, 'click', '[data-copy]', function (e, b) {
      var u = location.origin + b.getAttribute('data-copy');
      var t = document.createElement('textarea'); t.value = u; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); ui.toast('نشانی کپی شد.'); } catch (x) { ui.toast(u); }
      t.remove();
    });
    U.on(host, 'click', '[data-mdel]', function (e, b) {
      var u = b.getAttribute('data-mdel');
      ui.confirm('فایل «' + U.fileNameOf(u) + '» حذف شود؟', { danger: true, ok: 'حذف', detail: 'اگر این فایل در محتوایی استفاده شده باشد، در آن محتوا نمایش داده نمی‌شود. فایل به سطل بازیافت می‌رود.' }).then(function (ok) {
        if (!ok) return;
        api.mediaDelete(u).then(function () { ui.toast('فایل حذف شد.'); st.selected = null; drawDetail(); load(st.folder); }).catch(err);
      });
    });
    U.$('[data-mup]', host).addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () { upload(Array.prototype.slice.call(fileInput.files)); fileInput.value = ''; });
    if (opts.pick === 'image') fileInput.setAttribute('accept', 'image/*');
    if (opts.pick === 'media') fileInput.setAttribute('accept', 'video/*,audio/*');
    U.$('[data-mfolder]', host).addEventListener('click', function () {
      ui.prompt('پوشه‌ی جدید', 'نام پوشه (مثلاً: 1405-آموزش)', '').then(function (n) {
        if (n) api.mediaCreateFolder(st.folder, n).then(function () { ui.toast('پوشه ساخته شد.'); load(st.folder); }).catch(err);
      });
    });
    U.$('[data-mq]', host).addEventListener('input', U.debounce(function () { st.q = this.value.trim(); if (st.data) drawGrid(); }, 200));
    U.$('[data-mf]', host).addEventListener('change', function () { st.filter = this.value; if (st.data) drawGrid(); });
    var zone = U.$('[data-mlayout]', host);
    ['dragenter', 'dragover'].forEach(function (ev) { zone.addEventListener(ev, function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') >= 0) { e.preventDefault(); zone.style.outline = '3px dashed #008000'; zone.style.outlineOffset = '4px'; } }); });
    ['dragleave', 'drop'].forEach(function (ev) { zone.addEventListener(ev, function () { zone.style.outline = ''; }); });
    zone.addEventListener('drop', function (e) { if (e.dataTransfer.files.length) { e.preventDefault(); upload(Array.prototype.slice.call(e.dataTransfer.files)); } });
    load(null);
  }

  /* ==================================================================== نظرات */
  function commentsPage(params) {
    var st = { status: params.get('status') || 'Pending', q: '', page: 1 };
    var selected = [];
    U.mount(main, html`${head('مدیریت نظرات', 'messages', 'تأیید، پاسخ، مخفی کردن و حذف نظرات کاربران', KB.can.admin() ? html`<a class="kb-btn kb-btn-ghost" href="#/settings">${icon('settings')}تنظیمات نظرات</a>` : '')}
      <div class="kb-table-card"><div class="kb-status-tabs" data-ctabs></div>
        <div class="kb-table-tools"><div class="kb-toolbar-search" style="min-width:220px">${icon('search')}<input class="kb-input" type="search" data-cq placeholder="جستجو در متن، نویسنده یا عنوان محتوا" aria-label="جستجو"></div></div>
        <div class="kb-bulk" data-cbulk hidden></div>
        <div data-clist></div><div class="kb-table-foot" data-cfoot></div></div>`);
    var list = U.$('[data-clist]', main), foot = U.$('[data-cfoot]', main), tabs = U.$('[data-ctabs]', main), bulk = U.$('[data-cbulk]', main), rows = [];
    function drawBulk() {
      bulk.hidden = !selected.length;
      if (selected.length) U.mount(bulk, html`<b>${U.faNum(selected.length)} نظر:</b><button type="button" class="kb-btn kb-btn-ghost kb-btn-sm" data-cb="Approved">${icon('check')}تأیید</button><button type="button" class="kb-btn kb-btn-ghost kb-btn-sm" data-cb="Hidden">${icon('eye-off')}مخفی</button><button type="button" class="kb-btn kb-btn-danger kb-btn-sm" data-cb-del>${icon('trash')}حذف</button>`);
    }
    function load() {
      list.style.opacity = '.55';
      api.adminComments({ status: st.status, q: st.q, page: st.page, size: 20 }).then(function (r) {
        list.style.opacity = '';
        rows = r.items; selected = [];
        pendingCount = r.counts.Pending || 0; renderSide('comments');
        U.mount(tabs, [['Pending', 'در انتظار تأیید'], ['Approved', 'تأییدشده'], ['Hidden', 'مخفی'], ['', 'همه']].map(function (t) { return html`<button type="button" role="tab" aria-selected="${st.status === t[0]}" data-cs="${t[0]}">${t[1]}<small>${U.faNum(t[0] ? r.counts[t[0]] || 0 : r.counts.all || 0)}</small></button>`; }));
        U.mount(list, rows.length ? html`<div class="kb-table-scroll"><table class="kb-table"><thead><tr><th style="width:36px"><label class="kb-check"><input type="checkbox" data-call aria-label="انتخاب همه"></label></th><th>نویسنده</th><th>نظر</th><th>وضعیت</th><th></th></tr></thead><tbody>
          ${rows.map(function (c) {
            return html`<tr><td><label class="kb-check"><input type="checkbox" data-csel="${c.id}" aria-label="انتخاب"></label></td>
              <td style="white-space:nowrap"><div class="kb-row">${ui.avatar(c.author)}<div><b>${c.author}</b>${c.isStaff ? html` <span class="kb-badge kb-badge-brand">تیم محتوا</span>` : ''}<div class="kb-hint" style="margin:0" title="${U.fmtDateTime(c.date)}">${U.relTime(c.date)}</div></div></div></td>
              <td style="min-width:320px"><div class="kb-comment-text" style="margin:0;font-size:13.5px">${c.body}</div>
                <a class="kb-more" style="font-size:12px" href="${KB.contentUrl(c.contentId)}#kb-c-${c.id}" target="_blank" rel="noopener">${icon('file-text', 'kb-ico-sm')}${c.contentTitle}</a>${c.parentId ? html` <span class="kb-badge">پاسخ</span>` : ''}</td>
              <td><span class="kb-status kb-status-${c.status}">${c.status === 'Pending' ? 'در انتظار' : c.status === 'Approved' ? 'تأییدشده' : 'مخفی'}</span></td>
              <td style="white-space:nowrap"><div class="kb-row">
                ${c.status !== 'Approved' ? html`<button type="button" class="kb-btn kb-btn-ghost kb-btn-sm" data-c1="Approved" data-id="${c.id}">${icon('check')}تأیید</button>` : html`<button type="button" class="kb-btn kb-btn-ghost kb-btn-sm" data-c1="Hidden" data-id="${c.id}">${icon('eye-off')}مخفی</button>`}
                <button type="button" class="kb-btn kb-btn-ghost kb-btn-sm" data-creply="${c.id}">${icon('reply')}پاسخ</button>
                <button type="button" class="kb-btn kb-btn-danger kb-btn-icon kb-btn-sm" data-cdel="${c.id}" aria-label="حذف">${icon('trash')}</button></div></td></tr>`;
          })}</tbody></table></div>` : ui.empty('messages', st.status === 'Pending' ? 'نظری در انتظار تأیید نیست' : 'نظری یافت نشد'));
        U.mount(foot, html`<span>${U.faNum(r.total)} نظر</span>${ui.pager(r.page, r.pages)}`);
        drawBulk();
      }).catch(function (e) { list.style.opacity = ''; U.mount(list, ui.errorBox(e)); });
    }
    function act(p, msg) { p.then(function () { ui.toast(msg); load(); }).catch(err); }
    U.on(tabs, 'click', '[data-cs]', function (e, b) { st.status = b.getAttribute('data-cs'); st.page = 1; load(); });
    U.$('[data-cq]', main).addEventListener('input', U.debounce(function () { st.q = this.value.trim(); st.page = 1; load(); }, 350));
    ui.bindPager(foot, function (p) { st.page = p; load(); });
    U.on(list, 'change', '[data-call]', function (e, c) { selected = c.checked ? rows.map(function (r) { return r.id; }) : []; U.$$('[data-csel]', list).forEach(function (x) { x.checked = c.checked; }); drawBulk(); });
    U.on(list, 'change', '[data-csel]', function (e, c) { var id = Number(c.getAttribute('data-csel')); selected = selected.filter(function (x) { return x !== id; }); if (c.checked) selected.push(id); drawBulk(); });
    U.on(bulk, 'click', '[data-cb]', function (e, b) { act(api.adminCommentStatus(selected, b.getAttribute('data-cb')), 'وضعیت نظرات تغییر کرد.'); });
    U.on(bulk, 'click', '[data-cb-del]', function () { ui.confirm('حذف ' + U.faNum(selected.length) + ' نظر؟', { danger: true, ok: 'حذف' }).then(function (ok) { if (ok) act(api.adminCommentDelete(selected), 'حذف شد.'); }); });
    U.on(list, 'click', '[data-c1]', function (e, b) { act(api.adminCommentStatus([Number(b.getAttribute('data-id'))], b.getAttribute('data-c1')), 'به‌روز شد.'); });
    U.on(list, 'click', '[data-cdel]', function (e, b) { ui.confirm('این نظر حذف شود؟', { danger: true, ok: 'حذف' }).then(function (ok) { if (ok) act(api.adminCommentDelete([Number(b.getAttribute('data-cdel'))]), 'حذف شد.'); }); });
    U.on(list, 'click', '[data-creply]', function (e, b) {
      var c = rows.filter(function (x) { return x.id === Number(b.getAttribute('data-creply')); })[0];
      var m = ui.modal({
        title: 'پاسخ به ' + c.author, icon: 'reply',
        body: html`<blockquote class="kb-alert" style="margin-bottom:12px;white-space:pre-line">${c.body}</blockquote><label class="kb-label" for="kb-reply">پاسخ شما (با نشان «تیم محتوا» نمایش داده می‌شود)</label><textarea id="kb-reply" class="kb-textarea" rows="4" autofocus></textarea>
          ${c.status !== 'Approved' ? html`<label class="kb-check" style="margin-top:10px"><input type="checkbox" data-approve checked>نظر اصلی هم تأیید شود</label>` : ''}`,
        foot: html`<button type="button" class="kb-btn kb-btn-brand" data-send>${icon('send')}ارسال پاسخ</button><button type="button" class="kb-btn kb-btn-ghost" data-kb-close>انصراف</button>`
      });
      m.el.querySelector('[data-send]').addEventListener('click', function () {
        var text = U.$('#kb-reply', m.el).value.trim();
        if (!text) return;
        var ap = m.el.querySelector('[data-approve]');
        var b2 = this; ui.busy(b2, true);
        (ap && ap.checked ? api.adminCommentStatus([c.id], 'Approved') : Promise.resolve())
          .then(function () { return api.addComment(c.contentId, text, c.parentId || c.id); })
          .then(function () { m.close(); ui.toast('پاسخ ثبت شد.'); load(); }).catch(function (e) { ui.busy(b2, false); err(e); });
      });
    });
    load();
  }

  /* ==================================================================== دسته‌بندی‌ها */
  function editCategory(c) {
    return new Promise(function (resolve) {
      var cur = c || { id: 0, title: '', description: '', icon: 'folder', color: '#008000', sort: ((KB.state.categories || []).length + 1) * 10, active: true };
      var m = ui.modal({
        title: c ? 'ویرایش دسته' : 'دسته‌ی جدید', icon: 'folder-open', size: 'lg',
        body: html`<form data-cf>
          <div style="display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
            <div class="kb-field"><label class="kb-label" for="c-title">عنوان</label><input id="c-title" class="kb-input" name="title" value="${cur.title}" required maxlength="120" autofocus>${c && c.count ? html`<span class="kb-hint">با تغییر عنوان، ${U.faNum(c.count)} محتوای این دسته هم به‌روز می‌شود.</span>` : ''}</div>
            <div class="kb-field"><label class="kb-label" for="c-sort">ترتیب نمایش</label><input id="c-sort" class="kb-input" type="number" name="sort" value="${cur.sort}"></div>
          </div>
          <div class="kb-field"><label class="kb-label" for="c-desc">توضیح کوتاه</label><textarea id="c-desc" class="kb-textarea" name="description" rows="2" style="min-height:60px">${cur.description}</textarea></div>
          <div class="kb-field"><span class="kb-label">آیکن</span><div class="kb-row kb-wrap" data-icons>${ICON_CHOICES.map(function (ic) { return html`<button type="button" class="kb-btn kb-btn-icon kb-btn-ghost ${ic === cur.icon ? 'is-on-brand' : ''}" data-ic="${ic}" title="${ic}" aria-label="${ic}">${icon(ic)}</button>`; })}</div></div>
          <div class="kb-field"><span class="kb-label">رنگ</span><div class="kb-row kb-wrap" data-colors>${COLORS.map(function (col) { return html`<button type="button" data-col="${col}" aria-label="${col}" style="width:32px;height:32px;border-radius:10px;background:${col};${col === cur.color ? 'box-shadow:0 0 0 3px #fff,0 0 0 5px ' + col : ''}"></button>`; })}</div></div>
          <label class="kb-switch"><input type="checkbox" name="active" ${cur.active ? raw('checked') : ''}><span class="kb-switch-track"></span>فعال (نمایش در سایت)</label>
        </form>`,
        foot: html`<button type="button" class="kb-btn kb-btn-brand" data-ok>${icon('save')}ذخیره</button><button type="button" class="kb-btn kb-btn-ghost" data-kb-close>انصراف</button>`,
        onClose: function (v) { resolve(v || null); }
      });
      var f = m.el.querySelector('[data-cf]');
      U.on(f, 'click', '[data-ic]', function (e, b) { cur.icon = b.getAttribute('data-ic'); U.$$('[data-ic]', f).forEach(function (x) { x.classList.toggle('is-on-brand', x === b); }); });
      U.on(f, 'click', '[data-col]', function (e, b) { cur.color = b.getAttribute('data-col'); U.$$('[data-col]', f).forEach(function (x) { var col = x.getAttribute('data-col'); x.style.boxShadow = x === b ? '0 0 0 3px #fff,0 0 0 5px ' + col : ''; }); });
      function submit(e) {
        if (e) e.preventDefault();
        var title = f.elements.title.value.trim();
        if (!title) { f.elements.title.setAttribute('aria-invalid', 'true'); f.elements.title.focus(); return; }
        var data = { id: cur.id, title: title, description: f.elements.description.value.trim(), icon: cur.icon, color: cur.color, sort: Number(f.elements.sort.value) || 0, active: f.elements.active.checked, oldTitle: c ? c.title : '' };
        var b = m.el.querySelector('[data-ok]'); ui.busy(b, true);
        api.adminCategorySave(data).then(function (r) {
          var saved = r.item;
          var list = KB.state.categories || (KB.state.categories = []);
          var i = list.map(function (x) { return x.id; }).indexOf(saved.id);
          if (i >= 0) list[i] = Object.assign({}, list[i], saved); else list.push(saved);
          ui.toast('دسته ذخیره شد.'); m.close(saved);
        }).catch(function (e2) { ui.busy(b, false); err(e2); });
      }
      m.el.querySelector('[data-ok]').addEventListener('click', submit);
      f.addEventListener('submit', submit);
    });
  }
  function categoriesPage() {
    U.mount(main, html`${head('دسته‌بندی‌ها', 'folder-open', 'موضوعات پایگاه دانش؛ آیکن و رنگ هر دسته در صفحه‌ی اصلی و منو نمایش داده می‌شود', html`<button type="button" class="kb-btn kb-btn-brand" data-cnew>${icon('plus')}دسته‌ی جدید</button>`)}<div data-cats>${loadingBox()}</div>`);
    var box = U.$('[data-cats]', main);
    function load() {
      api.adminCategories().then(function (r) {
        var items = r.items;
        KB.state.categories = items.map(function (c) { return { id: c.id, title: c.title, icon: c.icon, color: c.color, description: c.description, count: c.count, sort: c.sort, active: c.active }; });
        U.mount(box, items.length ? html`<div class="kb-table-card"><div class="kb-table-scroll"><table class="kb-table"><thead><tr><th>دسته</th><th>توضیح</th><th>محتوا</th><th>ترتیب</th><th>وضعیت</th><th></th></tr></thead><tbody>
          ${items.map(function (c) {
            return html`<tr><td style="white-space:nowrap"><div class="kb-row"><span class="kb-cat-icon" style="--c:${c.color};width:38px;height:38px;border-radius:11px;display:grid;place-items:center;color:${c.color};background:#f3f5f7">${icon(c.icon)}</span><b>${c.title}</b>${!c.id ? html`<span class="kb-badge kb-badge-amber" title="این مقدار در محتوا استفاده شده ولی در لیست دسته‌ها تعریف نشده">تعریف‌نشده</span>` : ''}</div></td>
              <td class="kb-muted" style="min-width:200px">${c.description}</td><td><a class="kb-more" href="#/content">${U.faNum(c.count)}</a></td><td>${U.faNum(c.sort)}</td>
              <td>${c.active ? html`<span class="kb-status kb-status-Published">فعال</span>` : html`<span class="kb-status kb-status-Draft">غیرفعال</span>`}</td>
              <td style="white-space:nowrap"><button type="button" class="kb-btn kb-btn-ghost kb-btn-sm" data-cedit="${c.title}">${icon('pencil')}${c.id ? 'ویرایش' : 'تعریف'}</button>
                ${c.id ? html`<button type="button" class="kb-btn kb-btn-danger kb-btn-icon kb-btn-sm" data-cdel="${c.id}" aria-label="حذف">${icon('trash')}</button>` : ''}</td></tr>`;
          })}</tbody></table></div></div>` : ui.empty('folder-open', 'هنوز دسته‌ای تعریف نشده', '', html`<button type="button" class="kb-btn kb-btn-brand" data-cnew>${icon('plus')}دسته‌ی جدید</button>`));
        box._items = items;
      }).catch(function (e) { U.mount(box, ui.errorBox(e)); });
    }
    U.on(main, 'click', '[data-cnew]', function () { editCategory(null).then(function (c) { if (c) load(); }); });
    U.on(box, 'click', '[data-cedit]', function (e, b) {
      var c = box._items.filter(function (x) { return x.title === b.getAttribute('data-cedit'); })[0];
      editCategory(c.id ? c : Object.assign({}, c, { id: 0 })).then(function (r) { if (r) load(); });
    });
    U.on(box, 'click', '[data-cdel]', function (e, b) {
      var c = box._items.filter(function (x) { return x.id === Number(b.getAttribute('data-cdel')); })[0];
      ui.confirm('دسته‌ی «' + c.title + '» حذف شود؟', { danger: true, ok: 'حذف', detail: c.count ? 'این دسته در ' + U.faNum(c.count) + ' محتوا استفاده شده و قابل حذف نیست؛ ابتدا محتواها را به دسته‌ی دیگری منتقل یا دسته را غیرفعال کنید.' : '' }).then(function (ok) {
        if (ok) api.adminCategoryDelete(c.id).then(function () { ui.toast('حذف شد.'); load(); }).catch(err);
      });
    });
    load();
  }

  /* ==================================================================== تنظیمات (مدیر سامانه) */
  var SETTINGS = [
    ['SiteTitle', 'عنوان سامانه', 'text', 'در هدر، فوتر و عنوان صفحات'],
    ['SiteSubtitle', 'زیرعنوان', 'text', ''],
    ['HeroTitle', 'تیتر صفحه‌ی اصلی', 'text', ''],
    ['HeroText', 'متن معرفی صفحه‌ی اصلی', 'textarea', ''],
    ['FooterText', 'متن فوتر', 'textarea', ''],
    ['Copyright', 'نام دارنده‌ی حقوق', 'text', ''],
    ['CommentsEnabled', 'نظرات', 'select:true=فعال|false=غیرفعال در کل سامانه', ''],
    ['CommentModeration', 'انتشار نظرات', 'select:Post=بلافاصله منتشر شود (مدیر محتوا می‌تواند مخفی کند)|Pre=پس از تأیید مدیر محتوا منتشر شود', ''],
    ['NotifyEmails', 'ایمیل اطلاع‌رسانی نظرات جدید', 'text', 'چند نشانی را با ویرگول جدا کنید. Outgoing E-mail شیرپوینت باید تنظیم باشد.'],
    ['DefaultVisibility', 'سطح دسترسی پیش‌فرض محتوای جدید', 'select:Public=عمومی|Private=ویژه‌ی کارکنان', '']
  ];
  function settingsPage() {
    U.mount(main, html`${head('تنظیمات سامانه', 'settings', 'متن‌ها و رفتار عمومی پایگاه دانش')}${loadingBox()}`);
    api.adminSettings().then(function (r) {
      var s = r.settings || {};
      U.mount(main, html`${head('تنظیمات سامانه', 'settings', 'متن‌ها و رفتار عمومی پایگاه دانش')}
        <form class="kb-panel-box" data-sf style="max-width:860px"><div class="kb-panel-box-body">
          ${SETTINGS.map(function (d) {
            var v = s[d[0]] == null ? '' : s[d[0]];
            var input;
            if (d[2] === 'textarea') input = html`<textarea id="s-${d[0]}" class="kb-textarea" name="${d[0]}" rows="3">${v}</textarea>`;
            else if (d[2].indexOf('select:') === 0) input = html`<select id="s-${d[0]}" class="kb-select" name="${d[0]}">${d[2].slice(7).split('|').map(function (o) { var p = o.split('='); return html`<option value="${p[0]}" ${String(v) === p[0] ? raw('selected') : ''}>${p[1]}</option>`; })}</select>`;
            else input = html`<input id="s-${d[0]}" class="kb-input" name="${d[0]}" value="${v}">`;
            return html`<div class="kb-field"><label class="kb-label" for="s-${d[0]}">${d[1]}</label>${input}${d[3] ? html`<span class="kb-hint">${d[3]}</span>` : ''}</div>`;
          })}
        </div><div class="kb-publish-actions"><button type="submit" class="kb-btn kb-btn-brand" style="flex:0">${icon('save')}ذخیره‌ی تنظیمات</button></div></form>
        <div class="kb-panel-box" style="max-width:860px"><div class="kb-panel-box-head">${icon('info')}اطلاعات فنی</div><div class="kb-panel-box-body">
          <div class="kb-kv"><span>لیست محتوا</span><b>${meta.contentList}</b></div>
          <div class="kb-kv"><span>کتابخانه‌ی رسانه</span><b style="direction:ltr">${meta.mediaUrl}</b></div>
          <div class="kb-kv"><span>نسخه‌ی سرویس</span><b style="direction:ltr">${meta.version || ''}</b></div>
          <p class="kb-hint">گروه‌ها: KB-Admins (مدیر سامانه)، KB-HR (منابع انسانی/مدیر محتوا). اعضا از طریق گروه‌های Active Directory تعیین می‌شوند.</p>
        </div></div>`);
      U.$('[data-sf]', main).addEventListener('submit', function (e) {
        e.preventDefault();
        var out = {};
        SETTINGS.forEach(function (d) { out[d[0]] = this.elements[d[0]].value.trim(); }, this);
        var b = this.querySelector('[type=submit]'); ui.busy(b, true);
        api.adminSettingsSave(out).then(function () {
          ui.busy(b, false); ui.toast('تنظیمات ذخیره شد.');
          Object.keys(out).forEach(function (k) { KB.state.settings[k] = out[k]; });
        }).catch(function (e2) { ui.busy(b, false); err(e2); });
      });
    }).catch(function (e) { U.mount(main, ui.errorBox(e)); });
  }

  /* ==================================================================== گزارش فعالیت */
  function auditPage() {
    var st = { page: 1, q: '' };
    U.mount(main, html`${head('گزارش فعالیت', 'history', 'سابقه‌ی تغییرات محتوا، نظرات و تنظیمات')}
      <div class="kb-table-card"><div class="kb-table-tools"><div class="kb-toolbar-search" style="min-width:220px">${icon('search')}<input class="kb-input" type="search" data-aq placeholder="جستجوی کاربر، عملیات یا عنوان" aria-label="جستجو"></div></div><div data-alist></div><div class="kb-table-foot" data-afoot></div></div>`);
    var list = U.$('[data-alist]', main), foot = U.$('[data-afoot]', main);
    function load() {
      api.adminAudit({ page: st.page, size: 30, q: st.q }).then(function (r) {
        U.mount(list, r.items.length ? html`<div class="kb-table-scroll"><table class="kb-table"><thead><tr><th>زمان</th><th>کاربر</th><th>عملیات</th><th>مورد</th><th>توضیحات</th></tr></thead><tbody>
          ${r.items.map(function (a) { return html`<tr><td style="white-space:nowrap" title="${U.fmtDateTime(a.date)}">${U.fmtDateTime(a.date)}</td><td style="white-space:nowrap">${a.actor}</td><td><span class="kb-badge">${ACTIONS[a.action] || a.action}</span></td>
            <td>${a.contentId ? html`<a class="kb-more" href="#/edit/${a.contentId}">${a.title || '#' + a.contentId}</a>` : a.title}</td><td class="kb-muted" style="min-width:200px">${a.details}</td></tr>`; })}
          </tbody></table></div>` : ui.empty('history', 'سابقه‌ای ثبت نشده'));
        U.mount(foot, html`<span>${U.faNum(r.total)} رویداد</span>${ui.pager(r.page, r.pages)}`);
      }).catch(function (e) { U.mount(list, ui.errorBox(e)); });
    }
    ui.bindPager(foot, function (p) { st.page = p; load(); });
    U.$('[data-aq]', main).addEventListener('input', U.debounce(function () { st.q = this.value.trim(); st.page = 1; load(); }, 350));
    load();
  }

  KB.pages.panel = { init: init };
})(window, document);
