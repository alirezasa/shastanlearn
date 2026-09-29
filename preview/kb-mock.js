/* =====================================================================
   پیش‌نمایش محلی پایگاه دانش (بدون شیرپوینت)
   همان رابط KBApi.ashx را با داده‌ی نمایشی در localStorage شبیه‌سازی می‌کند.
   فقط برای توسعه و نمایش؛ در بسته‌ی شیرپوینت بارگذاری نمی‌شود.
   ===================================================================== */
(function (window) {
  'use strict';
  var KEY = 'kb.mock.v3';
  var ROLE_KEY = 'kb.mock.role';
  var MEDIA_ROOT = '/DocLib';
  var NOW = Date.now();
  var DAY = 86400000;

  function svgImage(seed, a, b, iconName) {
    var paths = (window.KB_ICONS || {})[iconName] || '';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient></defs>' +
      '<rect width="1200" height="675" fill="url(#g)"/>' +
      '<circle cx="' + (180 + seed * 37 % 300) + '" cy="' + (140 + seed * 53 % 200) + '" r="' + (160 + seed * 17 % 120) + '" fill="#fff" opacity=".08"/>' +
      '<circle cx="' + (900 + seed * 23 % 200) + '" cy="' + (520 - seed * 11 % 160) + '" r="' + (220 + seed * 13 % 90) + '" fill="#000" opacity=".08"/>' +
      '<g transform="translate(480 218) scale(10)" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" opacity=".9">' + paths + '</g></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  function avatarImg(text, color) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="' + color + '"/><text x="80" y="104" font-size="72" text-anchor="middle" fill="#fff" font-family="Tahoma">' + text + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function seed() {
    var cats = [
      { id: 1, title: 'منابع انسانی', icon: 'users', color: '#008000', description: 'قوانین، فرایندها و خدمات منابع انسانی', sort: 10, active: true },
      { id: 2, title: 'فناوری اطلاعات', icon: 'cpu', color: '#0284c7', description: 'راهنمای سامانه‌ها، امنیت اطلاعات و ابزارهای دیجیتال', sort: 20, active: true },
      { id: 3, title: 'مدیریت دانش', icon: 'lightbulb', color: '#d97706', description: 'تجربه‌ها، درس‌آموخته‌ها و مستندسازی دانش', sort: 30, active: true },
      { id: 4, title: 'آموزش و توسعه', icon: 'graduation', color: '#7c3aed', description: 'دوره‌ها، کارگاه‌ها و مسیرهای یادگیری', sort: 40, active: true },
      { id: 5, title: 'ایمنی و سلامت', icon: 'hard-hat', color: '#c22c2c', description: 'HSE، ایمنی محیط کار و سلامت کارکنان', sort: 50, active: true },
      { id: 6, title: 'رهبری و مدیریت', icon: 'target', color: '#0d9488', description: 'مهارت‌های مدیریتی و رهبری تیم', sort: 60, active: true }
    ];
    var authors = [
      { name: 'مریم احمدی', bio: 'کارشناس ارشد مدیریت دانش و نویسنده‌ی حوزه‌ی فناوری سازمانی.', image: avatarImg('م', '#0284c7') },
      { name: 'رضا کریمی', bio: 'مدیر آموزش و توسعه‌ی منابع انسانی با ۱۵ سال سابقه.', image: avatarImg('ر', '#008000') },
      { name: 'سارا موسوی', bio: 'مشاور منابع انسانی و مجری پادکست «گفتگوهای سازمانی».', image: avatarImg('س', '#7c3aed') },
      { name: 'علی رضایی', bio: 'کارشناس امنیت اطلاعات واحد فناوری اطلاعات.', image: '' },
      { name: 'تیم رسانه', bio: 'روابط عمومی و رسانه‌ی شرکت سرمایه‌گذاری تجاری شستان.', image: avatarImg('ت', '#c22c2c') }
    ];
    var body = function (topic) {
      return '<p>' + topic + ' یکی از موضوعات کلیدی برای موفقیت سازمان‌هاست. در این مطلب مهم‌ترین نکات، تجربه‌ها و گام‌های عملی را مرور می‌کنیم تا بتوانید آن را در واحد خود به‌کار بگیرید.</p>' +
        '<h2>چرا اهمیت دارد؟</h2><p>سازمان‌های پیشرو تصمیمات خود را بر پایه‌ی داده و تجربه‌ی مستند می‌گیرند. ایجاد فرهنگ یادگیری نیازمند زیرساخت، آموزش و تعهد مدیریت ارشد است.</p>' +
        '<blockquote>«دانشی که به اشتراک گذاشته نشود، با رفتن افراد از سازمان خارج می‌شود.»</blockquote>' +
        '<h2>گام‌های اجرایی</h2><ol><li>شناسایی نیازها و ذی‌نفعان</li><li>تدوین برنامه‌ی زمان‌بندی‌شده</li><li>اجرای آزمایشی و دریافت بازخورد</li><li>استقرار کامل و پایش شاخص‌ها</li></ol>' +
        '<h3>نکات تکمیلی</h3><ul><li>اتوماسیون فرایندهای تکراری</li><li>یکپارچه‌سازی سامانه‌ها</li><li>آموزش مستمر کارکنان</li></ul>' +
        '<p><img src="' + svgImage(7, '#0f766e', '#134e4a', 'chart') + '" alt="نمودار نمونه"></p>' +
        '<h2>جدول مقایسه</h2><table><thead><tr><th>شاخص</th><th>پیش از اجرا</th><th>پس از اجرا</th></tr></thead><tbody><tr><td>زمان پاسخ‌گویی</td><td>۴ روز</td><td>۱ روز</td></tr><tr><td>رضایت کارکنان</td><td>۶۲٪</td><td>۸۷٪</td></tr></tbody></table>' +
        '<h2>جمع‌بندی</h2><p>موفقیت در این مسیر به تعادل میان فناوری، فرایند و انسان بستگی دارد. پرسش‌ها و تجربه‌های خود را در بخش نظرات با ما در میان بگذارید.</p>';
    };
    var defs = [
      ['راهنمای جامع ارزیابی عملکرد سالانه ۱۴۰۵', 'مراحل، زمان‌بندی و فرم‌های ارزیابی عملکرد کارکنان و نقش مدیران در گفت‌وگوی بازخورد.', 'راهنما', 'منابع انسانی', ['ارزیابی عملکرد', 'مدیران', 'فرایند'], 'Public', true, 1, '#006400', '#0a5f2a', 'list-checks'],
      ['آینده‌ی تحول دیجیتال در سازمان‌ها', 'نگاهی به مسیر دیجیتالی‌شدن فرایندها و نقش داده در تصمیم‌گیری مدیران.', 'مقاله', 'فناوری اطلاعات', ['تحول دیجیتال', 'داده'], 'Public', true, 0, '#0c4a6e', '#0284c7', 'rocket'],
      ['کارگاه مدیریت دانش: از تجربه تا دارایی', 'ویدیوی کامل کارگاه تبدیل دانش ضمنی کارکنان به دارایی سازمانی.', 'ویدیو', 'مدیریت دانش', ['مدیریت دانش', 'کارگاه'], 'Public', true, 0, '#7f1d1d', '#c22c2c', 'play-circle'],
      ['پادکست رهبری سازمانی — قسمت ۱۲', 'گفتگو با مدیران درباره‌ی چالش‌های رهبری در دوران تغییر.', 'پادکست', 'رهبری و مدیریت', ['رهبری', 'پادکست'], 'Public', false, 2, '#4c1d95', '#7c3aed', 'headphones'],
      ['آیین‌نامه‌ی مرخصی و ماموریت کارکنان', 'متن کامل آیین‌نامه، انواع مرخصی و نحوه‌ی ثبت درخواست در سامانه.', 'سند و فایل', 'منابع انسانی', ['مرخصی', 'آیین‌نامه'], 'Private', true, 1, '#1e3a8a', '#2563eb', 'file-text'],
      ['گزارش تصویری همایش سالانه‌ی شستان', 'مرور لحظات کلیدی همایش و سخنرانی‌های شاخص امسال.', 'گزارش تصویری', 'مدیریت دانش', ['همایش', 'رویداد'], 'Public', false, 4, '#78350f', '#d97706', 'images'],
      ['۱۰ نکته‌ی امنیت اطلاعات برای همه‌ی کارکنان', 'از رمز عبور قوی تا شناسایی ایمیل‌های فیشینگ؛ نکاتی که هر روز به کار می‌آید.', 'مقاله', 'فناوری اطلاعات', ['امنیت اطلاعات', 'فیشینگ'], 'Public', false, 3, '#111827', '#374151', 'shield-check'],
      ['دستورالعمل ایمنی کار در ارتفاع', 'الزامات، تجهیزات حفاظت فردی و چک‌لیست پیش از شروع کار.', 'راهنما', 'ایمنی و سلامت', ['ایمنی', 'HSE'], 'Private', false, 1, '#991b1b', '#dc2626', 'hard-hat'],
      ['آموزش کار با سامانه‌ی حضور و غیاب جدید', 'ویدیوی گام‌به‌گام ثبت تردد، درخواست مرخصی ساعتی و مشاهده‌ی کارکرد.', 'ویدیو', 'فناوری اطلاعات', ['آموزش', 'سامانه'], 'Private', false, 1, '#064e3b', '#059669', 'monitor'],
      ['مسیر شغلی و شایستگی‌های کلیدی', 'معرفی نقشه‌ی شایستگی و مسیرهای رشد شغلی در هلدینگ.', 'مقاله', 'آموزش و توسعه', ['مسیر شغلی', 'شایستگی'], 'Public', false, 1, '#312e81', '#4f46e5', 'graduation'],
      ['پرسش‌های متداول بیمه‌ی تکمیلی', 'پاسخ به رایج‌ترین پرسش‌ها درباره‌ی پوشش‌ها، مدارک و بازپرداخت.', 'پرسش و پاسخ', 'منابع انسانی', ['بیمه', 'رفاهی'], 'Private', false, 2, '#155e75', '#0891b2', 'help'],
      ['اینفوگرافیک: ارزش‌های سازمانی شستان', 'ارزش‌ها و رفتارهای مورد انتظار در یک نگاه.', 'اینفوگرافیک', 'رهبری و مدیریت', ['فرهنگ سازمانی', 'ارزش‌ها'], 'Public', false, 0, '#831843', '#db2777', 'chart-pie'],
      ['تجربه‌ی موفق کاهش مصرف انرژی در واحد تولید', 'درس‌آموخته‌های پروژه‌ی بهینه‌سازی مصرف انرژی و نتایج آن.', 'گزارش', 'مدیریت دانش', ['درس‌آموخته', 'انرژی'], 'Public', false, 0, '#134e4a', '#0d9488', 'zap'],
      ['برنامه‌ی دوره‌های آموزشی نیمه‌ی دوم سال', 'فهرست دوره‌ها، زمان‌بندی و نحوه‌ی ثبت‌نام.', 'خبر', 'آموزش و توسعه', ['آموزش', 'دوره'], 'Public', false, 0, '#7c2d12', '#ea580c', 'calendar'],
      ['مهارت بازخورد دادن مؤثر به همکاران', 'چارچوب SBI و تمرین‌های عملی برای گفت‌وگوهای سازنده.', 'مقاله', 'رهبری و مدیریت', ['بازخورد', 'مهارت نرم'], 'Public', false, 2, '#14532d', '#16a34a', 'message'],
      ['پیش‌نویس: سیاست کار ترکیبی (هیبرید)', 'در حال تدوین — منتشر نشده.', 'مقاله', 'منابع انسانی', ['کار ترکیبی'], 'Private', false, 1, '#334155', '#64748b', 'building']
    ];
    var items = defs.map(function (d, i) {
      var id = i + 1;
      var age = (i * 2.3 + 1) * DAY;
      var a = authors[d[7]];
      var isDraft = i === 15;
      return {
        id: id, title: d[0], summary: d[1], body: body(d[0]), type: d[2], category: d[3], tags: d[4], visibility: d[5], featured: d[6],
        status: isDraft ? 'Draft' : 'Published', publishAt: new Date(NOW - age).toISOString(), created: new Date(NOW - age - DAY).toISOString(), modified: new Date(NOW - age + 3600000).toISOString(),
        thumb: svgImage(id, d[8], d[9], d[10]), media: d[2] === 'ویدیو' ? MEDIA_ROOT + '/videos/sample-' + id + '.mp4' : d[2] === 'پادکست' ? MEDIA_ROOT + '/audio/episode-12.mp3' : '',
        minutes: 3 + (i * 3) % 12, views: Math.round(1800 / (i + 1) + (i * 137) % 400), likes: Math.round(90 / (i + 1) + (i * 7) % 20), comments: 0,
        allowComments: true, author: { name: a.name, bio: a.bio, image: a.image }, attachments: i === 0 || i === 4 ? [{ name: i === 0 ? 'فرم-ارزیابی-عملکرد.pdf' : 'آیین-نامه-مرخصی.docx', size: 482133, url: '#' }] : [],
        createdBy: 'منابع انسانی', editor: 'منابع انسانی'
      };
    });
    items.push({
      id: 17, title: 'اطلاعیه‌ی زمان‌بندی‌شده: جشنواره‌ی ایده‌های نو', summary: 'این محتوا برای آینده زمان‌بندی شده است.', body: '<p>به زودی…</p>', type: 'خبر', category: 'مدیریت دانش', tags: ['ایده'],
      visibility: 'Public', featured: false, status: 'Published', publishAt: new Date(NOW + 3 * DAY).toISOString(), created: new Date(NOW).toISOString(), modified: new Date(NOW).toISOString(),
      thumb: svgImage(17, '#1e40af', '#3b82f6', 'sparkles'), media: '', minutes: 1, views: 0, likes: 0, comments: 0, allowComments: true, author: { name: 'تیم رسانه', bio: '', image: '' }, attachments: [], createdBy: 'منابع انسانی', editor: 'منابع انسانی'
    });
    var comments = [
      { id: 1, contentId: 1, parentId: 0, body: 'ممنون از راهنمای کامل. آیا فرم خودارزیابی هم باید تا پایان ماه ارسال شود؟', author: 'حسین نادری', login: 'user1', date: new Date(NOW - 2 * DAY).toISOString(), status: 'Approved', isStaff: false },
      { id: 2, contentId: 1, parentId: 1, body: 'بله، مهلت ارسال فرم خودارزیابی ۲۵ آبان است.', author: 'منابع انسانی', login: 'hr', date: new Date(NOW - 1.5 * DAY).toISOString(), status: 'Approved', isStaff: true },
      { id: 3, contentId: 2, parentId: 0, body: 'مطلب بسیار مفیدی بود؛ ای کاش نمونه‌های داخلی بیشتری هم اضافه شود.', author: 'نرگس صالحی', login: 'user2', date: new Date(NOW - DAY).toISOString(), status: 'Approved', isStaff: false },
      { id: 4, contentId: 3, parentId: 0, body: 'فایل ارائه‌ی کارگاه را هم قرار دهید لطفاً.', author: 'امید فرهادی', login: 'user3', date: new Date(NOW - 3600000 * 5).toISOString(), status: 'Pending', isStaff: false },
      { id: 5, contentId: 7, parentId: 0, body: 'نکته‌ی ۶ درباره‌ی ایمیل‌های جعلی خیلی کاربردی بود.', author: 'کاربر نمونه', login: 'demo', date: new Date(NOW - 3600000 * 30).toISOString(), status: 'Approved', isStaff: false }
    ];
    var media = [
      { name: 'banner-annual-meeting.svg', url: MEDIA_ROOT + '/banner-annual-meeting.svg', data: svgImage(21, '#78350f', '#d97706', 'images'), size: 184220, modified: new Date(NOW - 5 * DAY).toISOString() },
      { name: 'cover-digital.svg', url: MEDIA_ROOT + '/cover-digital.svg', data: svgImage(22, '#0c4a6e', '#0284c7', 'rocket'), size: 92311, modified: new Date(NOW - 8 * DAY).toISOString() },
      { name: 'team-photo.svg', url: MEDIA_ROOT + '/team-photo.svg', data: svgImage(23, '#14532d', '#16a34a', 'users'), size: 120400, modified: new Date(NOW - 12 * DAY).toISOString() },
      { name: 'sample-3.mp4', url: MEDIA_ROOT + '/videos/sample-3.mp4', size: 48211002, modified: new Date(NOW - 3 * DAY).toISOString() },
      { name: 'episode-12.mp3', url: MEDIA_ROOT + '/audio/episode-12.mp3', size: 18222000, modified: new Date(NOW - 4 * DAY).toISOString() },
      { name: 'org-chart-1405.pdf', url: MEDIA_ROOT + '/org-chart-1405.pdf', size: 823444, modified: new Date(NOW - 20 * DAY).toISOString() }
    ];
    var folders = [MEDIA_ROOT + '/videos', MEDIA_ROOT + '/audio'];
    var reactions = [{ contentId: 1, user: 'demo', kind: 'Like' }, { contentId: 2, user: 'demo', kind: 'Bookmark' }];
    var db = {
      items: items, comments: comments, cats: cats, media: media, folders: folders, reactions: reactions, nextId: 18, nextComment: 6, nextCat: 7,
      settings: {
        SiteTitle: 'پایگاه دانش شستان', SiteSubtitle: 'شرکت سرمایه‌گذاری تجاری شستان', HeroTitle: 'هر آنچه برای رشد و یادگیری لازم دارید',
        HeroText: 'مقالات، ویدیوها، پادکست‌ها و راهنماهای سازمانی شستان را جستجو کنید، بیاموزید و تجربه‌های خود را به اشتراک بگذارید.',
        FooterText: '', Copyright: 'شرکت سرمایه‌گذاری تجاری شستان', CommentsEnabled: 'true', CommentModeration: 'Post', NotifyEmails: 'hr@shastan.ir', DefaultVisibility: 'Public'
      },
      audit: [{ date: new Date(NOW - DAY).toISOString(), actor: 'منابع انسانی', action: 'Publish', contentId: 1, title: defs[0][0], details: '' }]
    };
    db.items.forEach(function (it) { it.comments = comments.filter(function (c) { return c.contentId === it.id && c.status === 'Approved'; }).length; });
    return db;
  }

  var db;
  try { db = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { db = null; }
  if (!db) db = seed();
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* حجم زیاد تصاویر */ } }
  function role() { try { return localStorage.getItem(ROLE_KEY) || 'hr'; } catch (e) { return 'hr'; } }
  var USERS = {
    anonymous: null,
    reader: { name: 'کاربر نمونه', email: 'demo@shastangroup.ir', login: 'demo', role: 'reader' },
    hr: { name: 'منابع انسانی', email: 'hr@shastangroup.ir', login: 'hr', role: 'hr' },
    admin: { name: 'مدیر سامانه', email: 'admin@shastangroup.ir', login: 'admin', role: 'admin' }
  };
  function me() { return USERS[role()] || null; }
  function isManager() { var u = me(); return !!u && (u.role === 'hr' || u.role === 'admin'); }
  function delay(v) { return new Promise(function (r) { setTimeout(function () { r(JSON.parse(JSON.stringify(v))); }, 120 + Math.random() * 180); }); }
  function fail(status, message, code) { var e = new Error(message); e.status = status; e.code = code; return new Promise(function (r, j) { setTimeout(function () { j(e); }, 150); }); }

  function norm(s) { return window.KB.util.normalizeFa(s); }
  function live(it) { return it.status === 'Published' && (!it.publishAt || new Date(it.publishAt) <= new Date()); }
  function visible(it) { return live(it) && (it.visibility === 'Public' || !!me()); }
  function mediaUrl(u) { var f = db.media.filter(function (m) { return m.url === u; })[0]; return f && f.data ? f.data : u; }
  function summary(it) {
    return {
      id: it.id, title: it.title, summary: it.summary, thumb: mediaUrl(it.thumb), media: it.media, type: it.type, category: it.category, tags: it.tags, views: it.views, likes: it.likes,
      comments: it.comments, minutes: it.minutes, featured: it.featured, visibility: it.visibility, status: it.status, publishAt: it.publishAt, created: it.created, modified: it.modified,
      author: { name: it.author.name, image: mediaUrl(it.author.image) }, attachmentsCount: (it.attachments || []).length, editor: it.editor
    };
  }
  function score(it, words) {
    var t = norm(it.title), tg = norm((it.tags || []).join(' ')), s = norm(it.summary), b = norm(window.KB.util.stripHtml(it.body)), o = norm([it.category, it.type, it.author.name].join(' '));
    var total = 0;
    for (var i = 0; i < words.length; i++) {
      var w = words[i], sc = 0;
      if (t.indexOf(w) >= 0) sc += 6; if (tg.indexOf(w) >= 0) sc += 4; if (s.indexOf(w) >= 0) sc += 2; if (o.indexOf(w) >= 0) sc += 2; if (b.indexOf(w) >= 0) sc += 1;
      if (!sc) return 0;
      total += sc;
    }
    return total;
  }
  var SORTS = {
    'new': function (a, b) { return new Date(b.publishAt || b.created) - new Date(a.publishAt || a.created); },
    old: function (a, b) { return new Date(a.publishAt || a.created) - new Date(b.publishAt || b.created); },
    views: function (a, b) { return b.views - a.views; },
    likes: function (a, b) { return b.likes - a.likes || b.views - a.views; },
    comments: function (a, b) { return b.comments - a.comments; },
    title: function (a, b) { return String(a.title).localeCompare(String(b.title), 'fa'); },
    modified: function (a, b) { return new Date(b.modified) - new Date(a.modified); }
  };
  function query(source, p, admin) {
    var q = norm(p.q || ''), words = q.split(' ').filter(Boolean);
    var items = source.slice(), scores = {};
    if (words.length) items = items.filter(function (it) { var s = score(it, words); scores[it.id] = s; return s > 0; });
    if (p.saved) { var u = me(); var ids = db.reactions.filter(function (r) { return u && r.user === u.login && r.kind === 'Bookmark'; }).map(function (r) { return r.contentId; }); items = items.filter(function (it) { return ids.indexOf(it.id) >= 0; }); }
    if (p.vis) items = items.filter(function (it) { return it.visibility === p.vis; });
    var facetBase = items;
    if (p.type) items = items.filter(function (it) { return it.type === p.type; });
    if (p.cat) items = items.filter(function (it) { return it.category === p.cat; });
    if (p.tag) items = items.filter(function (it) { return (it.tags || []).indexOf(p.tag) >= 0; });
    if (p.author) items = items.filter(function (it) { return it.author.name === p.author; });
    if (p.featured) items = items.filter(function (it) { return it.featured; });
    if (p.exclude) items = items.filter(function (it) { return it.id !== Number(p.exclude); });
    if (admin && p.status) items = items.filter(function (it) { return p.status === 'Scheduled' ? it.status === 'Published' && new Date(it.publishAt) > new Date() : p.status === 'Published' ? live(it) : it.status === p.status; });
    var sort = p.sort === 'relevance' && words.length ? function (a, b) { return scores[b.id] - scores[a.id]; } : SORTS[p.sort] || SORTS['new'];
    items.sort(sort);
    var size = Math.min(100, Number(p.size) || 12), total = items.length, pages = Math.max(1, Math.ceil(total / size)), page = Math.min(Math.max(1, Number(p.page) || 1), pages);
    function facet(key) {
      var m = {};
      facetBase.forEach(function (it) {
        if (key === 'type' && p.cat && it.category !== p.cat) return;
        if (key === 'category' && p.type && it.type !== p.type) return;
        if (it[key]) m[it[key]] = (m[it[key]] || 0) + 1;
      });
      return Object.keys(m).map(function (k) { return { value: k, count: m[k] }; }).sort(function (a, b) { return b.count - a.count; });
    }
    return { items: items.slice((page - 1) * size, page * size).map(summary), total: total, page: page, pages: pages, facets: { types: facet('type'), categories: facet('category') } };
  }
  function recountComments(id) {
    var it = db.items.filter(function (x) { return x.id === id; })[0];
    if (it) it.comments = db.comments.filter(function (c) { return c.contentId === id && c.status === 'Approved'; }).length;
  }
  function audit(action, it, details) { db.audit.unshift({ date: new Date().toISOString(), actor: me() ? me().name : '', action: action, contentId: it ? it.id : 0, title: it ? it.title : '', details: details || '' }); }
  function find(id) { return db.items.filter(function (x) { return x.id === Number(id); })[0]; }
  function adminItem(it) {
    var s = summary(it);
    s.body = it.body; s.allowComments = it.allowComments; s.rawThumb = it.thumb; s.rawMedia = it.media;
    s.author = { name: it.author.name, bio: it.author.bio, image: mediaUrl(it.author.image), rawImage: it.author.image };
    s.attachments = (it.attachments || []).map(function (a) { return { name: a.name, size: a.size, url: a.url, rawUrl: a.url }; });
    s.createdBy = it.createdBy;
    return s;
  }
  function page(list, p) {
    var size = Number(p.size) || 20, total = list.length, pages = Math.max(1, Math.ceil(total / size)), pg = Math.min(Math.max(1, Number(p.page) || 1), pages);
    return { items: list.slice((pg - 1) * size, pg * size), total: total, page: pg, pages: pages };
  }
  function needManager() { return isManager() ? null : fail(403, 'دسترسی لازم برای این کار را ندارید.'); }
  function fileToUrl(file) {
    return new Promise(function (resolve) {
      if (file.size > 1.5 * 1048576) { resolve(URL.createObjectURL(file)); return; }
      var r = new FileReader(); r.onload = function () { resolve(r.result); }; r.readAsDataURL(file);
    });
  }
  function fakeProgress(onProgress) {
    return new Promise(function (resolve) {
      var p = 0;
      var t = setInterval(function () { p += 0.25; if (onProgress) onProgress(Math.min(1, p)); if (p >= 1) { clearInterval(t); resolve(); } }, 120);
    });
  }

  var api = {
    setRole: function (r) { try { localStorage.setItem(ROLE_KEY, r); } catch (e) { /* */ } },
    reset: function () { localStorage.removeItem(KEY); },
    bootstrap: function () {
      var u = me();
      var vis = db.items.filter(visible);
      var catCount = {}, typeCount = {}, tagCount = {};
      vis.forEach(function (it) {
        if (it.category) catCount[it.category] = (catCount[it.category] || 0) + 1;
        typeCount[it.type] = (typeCount[it.type] || 0) + 1;
        (it.tags || []).forEach(function (t) { tagCount[t] = (tagCount[t] || 0) + 1; });
      });
      var cats = db.cats.filter(function (c) { return c.active; }).map(function (c) { return { id: c.id, title: c.title, icon: c.icon, color: c.color, description: c.description, sort: c.sort, count: catCount[c.title] || 0 }; });
      return delay({
        user: u ? { anonymous: false, name: u.name, email: u.email, login: u.login, role: u.role } : { anonymous: true, role: 'anonymous' },
        settings: db.settings,
        categories: cats.sort(function (a, b) { return a.sort - b.sort; }),
        types: Object.keys(typeCount).map(function (k) { return { value: k, count: typeCount[k] }; }).sort(function (a, b) { return b.count - a.count; }),
        tags: Object.keys(tagCount).map(function (k) { return { tag: k, count: tagCount[k] }; }).sort(function (a, b) { return b.count - a.count; }).slice(0, 30),
        stats: {
          total: vis.length, views: vis.reduce(function (s, it) { return s + it.views; }, 0),
          videos: vis.filter(function (it) { return /ویدیو|پادکست/.test(it.type); }).length,
          privateCount: u ? 0 : db.items.filter(function (it) { return live(it) && it.visibility === 'Private'; }).length
        }
      });
    },
    list: function (p) { return delay(query(db.items.filter(visible), p || {}, false)); },
    get: function (id, o) {
      var it = find(id);
      var u = me();
      if (!it) return fail(404, 'محتوا یافت نشد.');
      var canEdit = isManager();
      if (!live(it) && !(o && o.preview && canEdit)) return fail(404, 'محتوا یافت نشد.');
      if (it.visibility !== 'Public' && !u) return fail(401, 'این محتوا ویژه‌ی کارکنان است.', 'login');
      var full = summary(it);
      full.body = it.body; full.allowComments = it.allowComments; full.author = { name: it.author.name, bio: it.author.bio, image: mediaUrl(it.author.image) };
      full.attachments = (it.attachments || []).map(function (a) { return { name: a.name, size: a.size, url: a.url }; });
      full.viewer = {
        liked: !!u && db.reactions.some(function (r) { return r.contentId === it.id && r.user === u.login && r.kind === 'Like'; }),
        bookmarked: !!u && db.reactions.some(function (r) { return r.contentId === it.id && r.user === u.login && r.kind === 'Bookmark'; }),
        canEdit: canEdit
      };
      full.related = db.items.filter(function (x) { return x.id !== it.id && visible(x); }).map(function (x) {
        var sc = (x.category === it.category ? 3 : 0) + (x.tags || []).filter(function (t) { return (it.tags || []).indexOf(t) >= 0; }).length * 2 + (x.type === it.type ? 1 : 0);
        return { x: x, sc: sc };
      }).filter(function (r) { return r.sc > 0; }).sort(function (a, b) { return b.sc - a.sc || b.x.views - a.x.views; }).slice(0, 7).map(function (r) { return summary(r.x); });
      return delay(full);
    },
    view: function (id) { var it = find(id); if (it) { it.views++; persist(); } return delay({ ok: true }); },
    react: function (id, kind) {
      var u = me();
      if (!u) return fail(401, 'برای این کار وارد شوید.', 'login');
      var it = find(id);
      var ex = db.reactions.filter(function (r) { return r.contentId === it.id && r.user === u.login && r.kind === kind; })[0];
      if (ex) db.reactions.splice(db.reactions.indexOf(ex), 1); else db.reactions.push({ contentId: it.id, user: u.login, kind: kind });
      if (kind === 'Like') it.likes = Math.max(0, it.likes + (ex ? -1 : 1));
      persist();
      return delay({ active: !ex, count: kind === 'Like' ? it.likes : 0 });
    },
    comments: function (id) {
      var u = me(), mgr = isManager();
      var it = find(id);
      var items = db.comments.filter(function (c) { return c.contentId === Number(id) && (c.status === 'Approved' || mgr || (u && c.login === u.login && c.status === 'Pending')); })
        .map(function (c) { return { id: c.id, parentId: c.parentId, body: c.body, author: c.author, date: c.date, status: c.status, isStaff: c.isStaff, canDelete: mgr || (!!u && c.login === u.login) }; });
      var enabled = db.settings.CommentsEnabled !== 'false' && it.allowComments !== false;
      return delay({ items: items, allowComments: enabled, canComment: enabled && !!u, moderation: db.settings.CommentModeration });
    },
    addComment: function (id, body, parentId) {
      var u = me();
      if (!u) return fail(401, 'برای ثبت نظر وارد شوید.', 'login');
      if (!body || body.trim().length < 2) return fail(400, 'متن نظر خیلی کوتاه است.');
      var pending = db.settings.CommentModeration === 'Pre' && !isManager();
      var c = { id: db.nextComment++, contentId: Number(id), parentId: Number(parentId) || 0, body: body.trim(), author: u.name, login: u.login, date: new Date().toISOString(), status: pending ? 'Pending' : 'Approved', isStaff: isManager() };
      db.comments.push(c); recountComments(Number(id)); persist();
      return delay({ ok: true, pending: pending, comment: c });
    },
    deleteComment: function (cid) {
      var u = me(); var c = db.comments.filter(function (x) { return x.id === Number(cid); })[0];
      if (!c) return fail(404, 'نظر یافت نشد.');
      if (!isManager() && !(u && c.login === u.login)) return fail(403, 'اجازه‌ی حذف این نظر را ندارید.');
      db.comments = db.comments.filter(function (x) { return x.id !== c.id && x.parentId !== c.id; }); recountComments(c.contentId); persist();
      return delay({ ok: true });
    },

    adminMeta: function () {
      return needManager() || delay({
        contentList: 'KnowledgeContent', mediaUrl: MEDIA_ROOT, mediaTitle: 'DocLib', types: ['مقاله', 'ویدیو', 'پادکست', 'راهنما', 'گزارش', 'گزارش تصویری', 'سند و فایل', 'خبر', 'اینفوگرافیک', 'پرسش و پاسخ'],
        categoryChoices: [], defaultVisibility: db.settings.DefaultVisibility, maxUploadMb: 250, pendingComments: db.comments.filter(function (c) { return c.status === 'Pending'; }).length, version: 'preview'
      });
    },
    adminDashboard: function () {
      var d = needManager(); if (d) return d;
      var all = db.items, now = new Date();
      var byType = {}, byCat = {};
      all.forEach(function (it) { byType[it.type] = (byType[it.type] || 0) + 1; if (it.category) byCat[it.category] = (byCat[it.category] || 0) + 1; });
      return delay({
        counts: {
          total: all.length, published: all.filter(live).length, draft: all.filter(function (x) { return x.status === 'Draft'; }).length,
          scheduled: all.filter(function (x) { return x.status === 'Published' && new Date(x.publishAt) > now; }).length, archived: all.filter(function (x) { return x.status === 'Archived'; }).length,
          'private': all.filter(function (x) { return x.visibility === 'Private'; }).length, 'public': all.filter(function (x) { return x.visibility === 'Public'; }).length
        },
        views: all.reduce(function (s, x) { return s + x.views; }, 0), likes: all.reduce(function (s, x) { return s + x.likes; }, 0),
        comments: { total: db.comments.length, pending: db.comments.filter(function (c) { return c.status === 'Pending'; }).length },
        top: all.filter(live).sort(SORTS.views).slice(0, 6).map(summary),
        recent: all.slice().sort(SORTS.modified).slice(0, 6).map(summary),
        recentComments: db.comments.slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); }).slice(0, 5).map(function (c) { return { id: c.id, contentId: c.contentId, contentTitle: (find(c.contentId) || {}).title, author: c.author, body: c.body, date: c.date, status: c.status }; }),
        byType: byType, byCategory: byCat
      });
    },
    adminList: function (p) {
      var d = needManager(); if (d) return d;
      p = p || {};
      var r = query(db.items, p, true);
      var now = new Date();
      r.counts = { all: db.items.length, Published: db.items.filter(live).length, Draft: db.items.filter(function (x) { return x.status === 'Draft'; }).length, Scheduled: db.items.filter(function (x) { return x.status === 'Published' && new Date(x.publishAt) > now; }).length, Archived: db.items.filter(function (x) { return x.status === 'Archived'; }).length };
      return delay(r);
    },
    adminGet: function (id) { var d = needManager(); if (d) return d; var it = find(id); return it ? delay(adminItem(it)) : fail(404, 'محتوا یافت نشد.'); },
    adminSave: function (data) {
      var d = needManager(); if (d) return d;
      if (!data.title) return fail(400, 'عنوان الزامی است.');
      var it = data.id ? find(data.id) : null;
      var isNew = !it;
      if (isNew) { it = { id: db.nextId++, created: new Date().toISOString(), views: 0, likes: 0, comments: 0, attachments: [], createdBy: me().name }; db.items.push(it); }
      var wasPublished = it.status === 'Published';
      ['title', 'summary', 'body', 'type', 'category', 'tags', 'status', 'visibility', 'featured', 'allowComments', 'thumb', 'media', 'minutes'].forEach(function (k) { if (k in data) it[k] = data[k]; });
      it.publishAt = data.publishAt || (data.status === 'Published' && !it.publishAt ? new Date().toISOString() : it.publishAt || null);
      it.author = { name: data.authorName, bio: data.authorBio, image: data.authorImage };
      it.modified = new Date().toISOString(); it.editor = me().name;
      audit(isNew ? 'Create' : it.status === 'Published' && !wasPublished ? 'Publish' : 'Update', it);
      persist();
      return delay({ ok: true, item: adminItem(it) });
    },
    adminStatus: function (ids, status, extra) {
      var d = needManager(); if (d) return d;
      ids.forEach(function (id) {
        var it = find(id); if (!it) return;
        if (status) { it.status = status; if (status === 'Published' && !it.publishAt) it.publishAt = new Date().toISOString(); audit(status === 'Published' ? 'Publish' : status === 'Archived' ? 'Archive' : 'Unpublish', it); }
        if (extra && 'visibility' in extra) { it.visibility = extra.visibility; audit('Visibility', it, extra.visibility); }
        if (extra && 'featured' in extra) { it.featured = !!extra.featured; audit('Featured', it); }
        it.modified = new Date().toISOString(); it.editor = me().name;
      });
      persist();
      return delay({ ok: true });
    },
    adminDelete: function (ids) {
      var d = needManager(); if (d) return d;
      ids.forEach(function (id) { var it = find(id); if (it) audit('Delete', it); });
      db.items = db.items.filter(function (x) { return ids.indexOf(x.id) < 0; }); persist();
      return delay({ ok: true });
    },
    adminDuplicate: function (id) {
      var d = needManager(); if (d) return d;
      var src = find(id);
      var copy = JSON.parse(JSON.stringify(src));
      copy.id = db.nextId++; copy.title = src.title + ' (کپی)'; copy.status = 'Draft'; copy.views = copy.likes = copy.comments = 0; copy.attachments = []; copy.created = copy.modified = new Date().toISOString(); copy.featured = false;
      db.items.push(copy); audit('Duplicate', copy, 'از #' + src.id); persist();
      return delay({ ok: true, item: adminItem(copy) });
    },
    adminComments: function (p) {
      var d = needManager(); if (d) return d;
      var q = norm(p.q || '');
      var list = db.comments.filter(function (c) {
        if (p.status && c.status !== p.status) return false;
        if (q) { var it = find(c.contentId) || {}; if (norm(c.body + ' ' + c.author + ' ' + (it.title || '')).indexOf(q) < 0) return false; }
        return true;
      }).sort(function (a, b) { return new Date(b.date) - new Date(a.date); })
        .map(function (c) { return { id: c.id, contentId: c.contentId, contentTitle: (find(c.contentId) || {}).title || '(حذف‌شده)', parentId: c.parentId, body: c.body, author: c.author, date: c.date, status: c.status, isStaff: c.isStaff }; });
      var r = page(list, p);
      r.counts = { all: db.comments.length };
      ['Pending', 'Approved', 'Hidden'].forEach(function (s) { r.counts[s] = db.comments.filter(function (c) { return c.status === s; }).length; });
      return delay(r);
    },
    adminCommentStatus: function (ids, status) {
      var d = needManager(); if (d) return d;
      db.comments.forEach(function (c) { if (ids.indexOf(c.id) >= 0) { c.status = status; recountComments(c.contentId); } });
      audit(status === 'Approved' ? 'CommentApprove' : 'CommentHide', null, U(ids.length) + ' نظر'); persist();
      return delay({ ok: true });
    },
    adminCommentDelete: function (ids) {
      var d = needManager(); if (d) return d;
      var affected = db.comments.filter(function (c) { return ids.indexOf(c.id) >= 0; });
      db.comments = db.comments.filter(function (c) { return ids.indexOf(c.id) < 0 && ids.indexOf(c.parentId) < 0; });
      affected.forEach(function (c) { recountComments(c.contentId); });
      audit('CommentDelete', null, U(ids.length) + ' نظر'); persist();
      return delay({ ok: true });
    },
    adminCategories: function () {
      var d = needManager(); if (d) return d;
      var counts = {};
      db.items.forEach(function (it) { if (it.category) counts[it.category] = (counts[it.category] || 0) + 1; });
      var items = db.cats.map(function (c) { return Object.assign({}, c, { count: counts[c.title] || 0 }); });
      Object.keys(counts).forEach(function (t) { if (!db.cats.some(function (c) { return c.title === t; })) items.push({ id: 0, title: t, description: '', icon: 'folder', color: '#475569', sort: 999, active: true, count: counts[t] }); });
      return delay({ items: items.sort(function (a, b) { return a.sort - b.sort; }) });
    },
    adminCategorySave: function (c) {
      var d = needManager(); if (d) return d;
      if (db.cats.some(function (x) { return x.title === c.title && x.id !== c.id; })) return fail(400, 'دسته‌ای با این عنوان وجود دارد.');
      var cur = c.id ? db.cats.filter(function (x) { return x.id === c.id; })[0] : null;
      if (!cur) { cur = { id: db.nextCat++ }; db.cats.push(cur); }
      var old = c.oldTitle || cur.title;
      ['title', 'description', 'icon', 'color', 'sort', 'active'].forEach(function (k) { cur[k] = c[k]; });
      if (old && old !== c.title) db.items.forEach(function (it) { if (it.category === old) it.category = c.title; });
      audit('CategorySave', null, c.title); persist();
      return delay({ ok: true, item: Object.assign({ count: db.items.filter(function (it) { return it.category === cur.title; }).length }, cur) });
    },
    adminCategoryDelete: function (id) {
      var d = needManager(); if (d) return d;
      var c = db.cats.filter(function (x) { return x.id === Number(id); })[0];
      if (db.items.some(function (it) { return it.category === c.title; })) return fail(400, 'این دسته در محتوا استفاده شده است.');
      db.cats = db.cats.filter(function (x) { return x !== c; }); audit('CategoryDelete', null, c.title); persist();
      return delay({ ok: true });
    },
    adminAuthors: function () {
      var d = needManager(); if (d) return d;
      var m = {};
      db.items.forEach(function (it) { var a = it.author || {}; if (!a.name) return; m[a.name] = m[a.name] || { name: a.name, bio: a.bio, image: a.image, count: 0 }; m[a.name].count++; if (a.bio) m[a.name].bio = a.bio; if (a.image) m[a.name].image = a.image; });
      return delay({ items: Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.count - a.count; }) });
    },
    adminSettings: function () { return me() && me().role === 'admin' ? delay({ settings: db.settings }) : fail(403, 'فقط مدیر سامانه'); },
    adminSettingsSave: function (v) {
      if (!me() || me().role !== 'admin') return fail(403, 'فقط مدیر سامانه');
      Object.keys(v).forEach(function (k) { db.settings[k] = v[k]; }); audit('Settings', null, Object.keys(v).join('، ')); persist();
      return delay({ ok: true });
    },
    adminAudit: function (p) {
      if (!me() || me().role !== 'admin') return fail(403, 'فقط مدیر سامانه');
      var q = norm(p.q || '');
      return delay(page(db.audit.filter(function (a) { return !q || norm([a.actor, a.action, a.title, a.details].join(' ')).indexOf(q) >= 0; }), p));
    },

    uploadAttachment: function (itemId, file, onProgress) {
      return Promise.all([fakeProgress(onProgress), fileToUrl(file)]).then(function (r) {
        var it = find(itemId);
        var name = window.KB.util.safeFileName(file.name);
        it.attachments = (it.attachments || []).filter(function (a) { return a.name !== name; }).concat([{ name: name, size: file.size, url: r[1] }]);
        persist();
        return { name: name, url: r[1], size: file.size };
      });
    },
    deleteAttachment: function (itemId, name) { var it = find(itemId); it.attachments = it.attachments.filter(function (a) { return a.name !== name; }); persist(); return delay({ ok: true }); },
    mediaList: function (folder) {
      folder = folder || MEDIA_ROOT;
      var files = db.media.filter(function (m) { return m.url.slice(0, m.url.lastIndexOf('/')) === folder; }).map(function (m) { return { name: m.name, url: m.data || m.url, size: m.size, modified: m.modified, path: m.url }; });
      var folders = db.folders.filter(function (f) { return f.slice(0, f.lastIndexOf('/')) === folder; }).map(function (f) { return { name: f.split('/').pop(), url: f, count: db.media.filter(function (m) { return m.url.indexOf(f + '/') === 0; }).length }; });
      return delay({ root: MEDIA_ROOT, folder: { name: folder.split('/').pop(), url: folder }, folders: folders, files: files });
    },
    mediaUpload: function (folder, file, onProgress) {
      return Promise.all([fakeProgress(onProgress), fileToUrl(file)]).then(function (r) {
        var name = window.KB.util.safeFileName(file.name);
        var entry = { name: name, url: (folder || MEDIA_ROOT) + '/' + name, data: r[1], size: file.size, modified: new Date().toISOString() };
        db.media = db.media.filter(function (m) { return m.url !== entry.url; }).concat([entry]);
        persist();
        return { name: name, url: r[1], size: file.size, modified: entry.modified };
      });
    },
    mediaDelete: function (url) { db.media = db.media.filter(function (m) { return m.url !== url && m.data !== url; }); persist(); return delay({ ok: true }); },
    mediaCreateFolder: function (parent, name) { db.folders.push(parent + '/' + window.KB.util.safeFileName(name)); persist(); return delay({ ok: true }); },
    copyToAttachment: function (itemId, url) {
      var m = db.media.filter(function (x) { return x.url === url || x.data === url; })[0];
      var it = find(itemId);
      var att = { name: m ? m.name : window.KB.util.fileNameOf(url), size: m ? m.size : 0, url: m && m.data ? m.data : url };
      it.attachments = (it.attachments || []).filter(function (a) { return a.name !== att.name; }).concat([att]);
      persist();
      return delay(att);
    }
  };
  function U(n) { return Number(n).toLocaleString('fa-IR'); }
  window.KB_MOCK_API = api;

  // نوار انتخاب نقش برای نمایش
  document.addEventListener('DOMContentLoaded', function () {
    var app = document.getElementById('kb-app');
    if (!app) return;
    var bar = document.createElement('div');
    bar.className = 'kb-demo-bar';
    bar.innerHTML = '<span>پیش‌نمایش — نقش:</span><select aria-label="نقش نمایشی">' +
      [['anonymous', 'مهمان (بدون ورود)'], ['reader', 'کارمند (واردشده)'], ['hr', 'منابع انسانی'], ['admin', 'مدیر سامانه']].map(function (r) { return '<option value="' + r[0] + '"' + (role() === r[0] ? ' selected' : '') + '>' + r[1] + '</option>'; }).join('') +
      '</select><button type="button" title="بازگردانی داده‌های نمایشی">بازنشانی</button>';
    app.appendChild(bar);
    bar.querySelector('select').addEventListener('change', function () { api.setRole(this.value); location.reload(); });
    bar.querySelector('button').addEventListener('click', function () { api.reset(); location.reload(); });
  });
})(window);
