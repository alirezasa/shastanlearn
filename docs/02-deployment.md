# راهنمای گام‌به‌گام استقرار پایگاه دانش روی SharePoint Server 2019

> آدرس: `http://srv-shp-web` (پورت ۸۰) — کاربران در `ad.shastangroup.ir`.
> همه‌ی لیست‌ها، ستون‌ها، گروه‌ها و مجوزها **با اسکریپت** ساخته می‌شوند و اجرای دوباره‌ی اسکریپت‌ها بی‌خطر است.
> لیست `KnowledgeContent` و کتابخانه‌ی `DocLib` موجود حفظ می‌شوند؛ فقط ستون‌های لازم به آن‌ها اضافه می‌شود.

---

## ۰. خلاصه

| گام | کجا | کار |
|-----|-----|-----|
| ۱ | Active Directory | ساخت دو گروه `KB-HR` و `KB-Admins` |
| ۲ | سرور شیرپوینت | کپی پوشه‌ی `sharepoint` و تکمیل `kb.config.json` |
| ۳ | سرور شیرپوینت | `Install-KBPortal.ps1 -WhatIfOnly` و بررسی نگاشت ستون‌ها |
| ۴ | سرور شیرپوینت | `Install-KBPortal.ps1` — لیست‌ها، ستون‌ها، گروه‌ها، مجوزها |
| ۵ | **همه‌ی** سرورهای وب | `Install-KBLayouts.ps1` — سرویس `KBApi.ashx` |
| ۶ | سرور شیرپوینت | `Deploy-KBFiles.ps1` — مستر پیج، صفحات، CSS/JS |
| ۷ | سرور + مرورگر | `Test-KBAnonymous.ps1` و تست با سه نوع کاربر |

---

## ۱. گروه‌های Active Directory

| گروه AD | اعضا | نقش |
|---------|------|-----|
| `KB-HR` | کارشناسان منابع انسانی که محتوا را مدیریت می‌کنند | پنل مدیریت محتوا |
| `KB-Admins` | مدیران سامانه (IT) | دسترسی کامل + تنظیمات + گزارش فعالیت |

- همه‌ی کاربران دامنه بعد از ورود خودکار «کارمند» هستند (مقدار `c:0(.s|true` در config)؛ گروه جدا لازم نیست.
- افزودن/حذف کاربر بعدها فقط در AD انجام می‌شود. پس از تغییر عضویت، کاربر یک‌بار خارج و وارد شود.
- نام گروه‌ها آزاد است؛ در `kb.config.json` همان نام را بنویسید.

## ۲. آماده‌سازی روی سرور

پوشه‌ی **`sharepoint`** از این مخزن را روی سرور شیرپوینت کپی کنید (مثلاً `C:\Deploy\kb`). ساختار:

```
C:\Deploy\kb\
  provisioning\   kb.config.json · Install-KBPortal.ps1 · Install-KBLayouts.ps1 · Deploy-KBFiles.ps1 · Test-KBAnonymous.ps1
  masterpage\     kb.master
  KBPages\        index.aspx · browse.aspx · content.aspx
  KBPanel\        panel.aspx
  KBAssets\       css · js · fonts · img
  layouts\KB\     KBApi.ashx
```

فایل **`provisioning\kb.config.json`** را با Notepad باز کنید (با کدگذاری UTF-8 ذخیره شود):

```json
{
  "SiteUrl": "http://srv-shp-web",
  "Zone": "Default",
  "EnableAnonymousOnWebApplication": true,
  "EnableLockdownMode": true,
  "SetWelcomePage": true,
  "ContentList": "KnowledgeContent",
  "MediaLibrary": "DocLib",
  "AdminsMembers": ["AD.SHASTANGROUP.IR\\KB-Admins"],
  "HRMembers": ["AD.SHASTANGROUP.IR\\KB-HR"],
  "ReadersMembers": ["c:0(.s|true"],
  "ExistingItemsStatus": "Published",
  "ExistingItemsVisibility": "Public",
  "DefaultVisibility": "Public",
  "Categories": [ { "Title": "منابع انسانی", "Icon": "users", "Color": "#008000", "Description": "…" } ],
  "SiteTitle": "پایگاه دانش شستان",
  "CommentModeration": "Post",
  "NotifyEmails": ""
}
```

| کلید | توضیح |
|------|-------|
| `SiteUrl` | آدرس سایتی که `KnowledgeContent` در آن است. اگر زیرسایت است، آدرس کامل زیرسایت |
| `EnableAnonymousOnWebApplication` | دسترسی ناشناس روی Zone وب‌اپلیکیشن (لازم برای کاربران بدون ورود). سایت‌های دیگر این وب‌اپلیکیشن تا خودشان فعال نکنند ناشناس نمی‌شوند |
| `EnableLockdownMode` | کاربر ناشناس به فرم‌ها و نمای لیست‌ها دسترسی نداشته باشد (پیشنهاد: `true`) |
| `SetWelcomePage` | صفحه‌ی خانه‌ی سایت = `KBPages/index.aspx`. اگر سایت صفحه‌ی خانه‌ی دیگری دارد و نمی‌خواهید عوض شود: `false` (پایگاه دانش در `/KBPages/index.aspx` در دسترس است) |
| `AdminsMembers` / `HRMembers` | گروه‌های AD به شکل `DOMAIN\Group` (بک‌اسلش در JSON دوتایی نوشته می‌شود). نام کامل دامنه‌ی سرور خودکار به NetBIOS تبدیل می‌شود |
| `ExistingItemsStatus` / `ExistingItemsVisibility` | وضعیت و سطح دسترسی آیتم‌های **موجود** که این ستون‌ها را ندارند (فقط یک‌بار مقداردهی می‌شود). اگر همه‌ی محتوای فعلی محرمانه است: `"Private"` |
| `DefaultVisibility` | پیش‌فرض محتوای جدید در پنل |
| `Categories` | دسته‌های اولیه؛ `Icon` یکی از: users، graduation، cpu، lightbulb، hard-hat، target، briefcase، shield-check، book-open، chart، building، … |
| `CommentModeration` | `Post` = نظر بلافاصله منتشر شود (HR می‌تواند مخفی کند) · `Pre` = پس از تأیید HR |
| `NotifyEmails` | ایمیل اطلاع‌رسانی نظرات در انتظار (Outgoing E-mail شیرپوینت باید تنظیم باشد) |

## ۳. بررسی پیش از نصب

در **SharePoint Management Shell** (Run as administrator):

```powershell
cd C:\Deploy\kb\provisioning
Set-ExecutionPolicy -Scope Process Bypass
.\Install-KBPortal.ps1 -WhatIfOnly
```

خروجی «نگاشت ستون‌ها» را بررسی کنید؛ مثلاً:

```
    Title            ← Title (عنوان, Text)
    Summary          ← Summary (Summary, Note)
    ContentType      ← ContentType0 (ContentType, Choice)
    Visibility       ← [جدید] KBVisibility
    Status           ← [جدید] KBStatus
```

اگر ستونی اشتباه پیدا شد یا ستون موجودی «[جدید]» تشخیص داده شد، پیش از نصب اطلاع دهید.

> اگر پیام «دسترسی Full Control ندارد» آمد، همان دستوری را که اسکریپت چاپ می‌کند اجرا کنید (Farm Admin بودن کافی نیست).

## ۴. نصب لیست‌ها، ستون‌ها و مجوزها

```powershell
.\Install-KBPortal.ps1
```

آنچه انجام می‌شود:

- **Web Application:** دسترسی ناشناس روی Zone Default.
- **Feature:** خاموش شدن MDS، روشن شدن Lockdown Mode.
- **سطح دسترسی** `KB Editor` و **گروه‌ها** `KB-Admins` (Full Control)، `KB-HR`، `KB-Readers` (Read روی سایت).
- **`KnowledgeContent`:** ستون‌های جدید (`KBVisibility`، `KBStatus`، `KBTags`، `KBMediaUrl`، `KBLikes`، `KBCommentsCount`،
  `KBAllowComments` و هر ستون جاافتاده)، فعال شدن پیوست و نسخه‌بندی، **حذف دسترسی گروه‌های دیگر سایت و ناشناس**
  (فقط KB-HR، KB-Admins و مالکان سایت). کاربران محتوا را فقط از طریق صفحات پایگاه دانش می‌بینند.
- **لیست‌های جدید:** `KBCategories`، `KBComments`، `KBReactions`، `KBSettings`، `KBAuditLog`.
- **کتابخانه‌ها:** `KBPages` و `KBAssets` (عمومی)، `KBPanel` (بدون ناشناس)، `DocLib` (عمومی + ویرایش KB-HR).
- **داده‌های پایه:** تنظیمات، نگاشت ستون‌ها (`FieldMap`)، دسته‌ها، وضعیت محتوای موجود.

> ⚠️ **`DocLib` عمومی می‌شود:** هر فایلی که اکنون در آن است بدون ورود قابل دریافت خواهد بود. فایل‌های محرمانه را
> پیش از نصب به کتابخانه‌ی دیگری منتقل کنید یا بعداً به‌صورت پیوست محتوای خصوصی بارگذاری کنید.

## ۵. نصب سرویس (روی همه‌ی سرورهای وب)

```powershell
.\Install-KBLayouts.ps1
```
`KBApi.ashx` را در `…\16\TEMPLATE\LAYOUTS\KB\` کپی می‌کند (`http://srv-shp-web/_layouts/15/KB/KBApi.ashx`).
Visual Studio، WSP یا IISReset لازم نیست؛ ASP.NET در اولین درخواست کامپایل می‌کند.
اگر فارم چند سرور وب (WFE) دارد، پوشه‌ی `sharepoint` را روی هرکدام کپی و همین اسکریپت را اجرا کنید.

## ۶. استقرار قالب و صفحات

```powershell
.\Deploy-KBFiles.ps1
```
مستر پیج `kb.master`، صفحات `KBPages` و `KBPanel` و فایل‌های `KBAssets` را بارگذاری می‌کند.
بعد از هر به‌روزرسانی کد: `git pull` → کپی پوشه‌ی `sharepoint` → همین اسکریپت (و اگر `layouts` تغییر کرده، گام ۵).

## ۷. تست

```powershell
.\Test-KBAnonymous.ps1
```
صفحه، CSS، سرویس، پنل، نمای لیست و REST را بدون ورود و سپس با حساب فعلی بررسی می‌کند. همه‌ی ردیف‌ها باید ✔ باشند.

### تست دستی

**الف) کاربر عمومی** — پنجره‌ی InPrivate، آدرس `http://srv-shp-web`
- [ ] صفحه‌ی اصلی بدون درخواست نام کاربری باز می‌شود و محتوای «عمومی» دیده می‌شود.
- [ ] محتوای «خصوصی» در فهرست‌ها و جستجو نیست؛ باز کردن پیوند مستقیم آن صفحه‌ی «ویژه‌ی کارکنان — ورود» را نشان می‌دهد.
- [ ] `http://srv-shp-web/Lists/KnowledgeContent/AllItems.aspx` و `http://srv-shp-web/KBPanel/panel.aspx` نام کاربری می‌خواهند.
- [ ] دکمه‌ی «ورود کارکنان» → ورود با حساب دامنه → بازگشت به همان صفحه.

**ب) کارمند** (عضو هیچ گروه KB نیست)
- [ ] محتوای خصوصی دیده می‌شود؛ پسند، ذخیره (منوی کاربر ← ذخیره‌شده‌های من) و ثبت نظر کار می‌کند.
- [ ] منوی «پنل مدیریت محتوا» نمایش داده نمی‌شود؛ باز کردن مستقیم پنل پیام «دسترسی ندارید» می‌دهد.

**ج) منابع انسانی** (عضو `KB-HR`)
- [ ] منوی کاربر ← پنل مدیریت محتوا ← «افزودن محتوا»: متن، تصویر از کتابخانه‌ی رسانه، ویدیو و یک PDF پیوست ← «انتشار».
- [ ] محتوا در صفحه‌ی اصلی و جستجو دیده شود؛ پیوست دانلود شود؛ ویدیو پخش و جلو/عقب برود.
- [ ] همان محتوا را «ویژه‌ی کارکنان» کنید ← در پنجره‌ی InPrivate دیگر دیده نشود.
- [ ] زمان انتشار را فردا بگذارید ← تا آن زمان فقط در پنل (برچسب «زمان‌بندی‌شده») دیده شود.
- [ ] بخش نظرات: تأیید/مخفی/پاسخ.

**د) مدیر سامانه** (عضو `KB-Admins`)
- [ ] تنظیمات سامانه (عنوان، متن صفحه‌ی اصلی، نظرات با تأیید) و گزارش فعالیت.

## ۸. رفع اشکال

| نشانه | علت محتمل |
|-------|-----------|
| کاربر عمومی پنجره‌ی نام کاربری می‌بیند | دسترسی ناشناس روی Zone یا کتابخانه‌های `KBPages`/`KBAssets` یا Master Page Gallery خاموش است؛ `Install-KBPortal.ps1` را دوباره اجرا کنید |
| صفحه بدون ظاهر (بدون CSS) | `Deploy-KBFiles.ps1` اجرا نشده یا `KBAssets` برای ناشناس قابل خواندن نیست |
| «بارگذاری انجام نشد» روی صفحه | سرویس نصب نشده (`Install-KBLayouts.ps1` روی همه‌ی سرورهای وب) یا لیست `KBSettings` نیست (`Install-KBPortal.ps1`). آدرس `http://srv-shp-web/_layouts/15/KB/KBApi.ashx?action=bootstrap` را مستقیم باز کنید تا پیام خطا دیده شود |
| خطای کامپایل در آدرس بالا | متن خطا را بفرستید؛ لاگ ULS با دسته‌ی `ShastanKB` |
| متن فارسی صفحات به‌هم‌ریخته است | فایل‌ها بدون BOM بارگذاری شده‌اند؛ `Deploy-KBFiles.ps1` این را خودکار اصلاح می‌کند (دستی بارگذاری نکنید) |
| HR منوی پنل را نمی‌بیند | کاربر عضو گروه AD نیست، گروه AD در `KB-HR` نیست، یا از قبل وارد شده بوده؛ خروج و ورود دوباره |
| ستون «نوع» یا «دسته» خالی نمایش داده می‌شود | نوع ستون Managed Metadata یا چندمقداری است؛ به Choice یا متن تغییر دهید |
| بارگذاری ویدیو بزرگ خطا می‌دهد | Central Admin ← Manage Web Applications ← General Settings ← Maximum Upload Size |
| ایمیل نظرات ارسال نمی‌شود | Outgoing E-mail تنظیم نیست یا `NotifyEmails` خالی است |
| تغییرات تا یک دقیقه دیده نمی‌شود | فهرست محتوای منتشرشده ۶۰ ثانیه در حافظه‌ی سرور است (ذخیره از پنل آن را فوراً پاک می‌کند؛ ویرایش مستقیم در لیست شیرپوینت تا ۶۰ ثانیه طول می‌کشد) |

## ۹. انتشار روی اینترنت (آینده)

- HTTPS اجباری، Reverse Proxy/WAF جلوی سرور.
- ورود با صفحه‌ی اختصاصی: FBA با `LdapMembershipProvider` روی همان AD — همان روش سکوی فناوری
  (`shastano/docs/02-authentication-fba-ldap.md`). در این حالت به `KB-Readers` مقدار `c:0(.s|forms:<provider>` و به
  گروه‌های KB معادل Role Claim گروه‌های AD اضافه می‌شود. کد صفحات و سرویس تغییری لازم ندارد.
