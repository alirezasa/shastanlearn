# انتقال به وب‌اپلیکیشن «sharepoint - learn» و دامنه‌ی shastan.local

| | |
|--|--|
| وب‌اپلیکیشن | `sharepoint - learn` — `http://srv-shpfront:2028/` |
| نشانی عمومی (AAM) | `https://learn.shastan.ir` |
| دامنه‌ی کاربران | `shastan.local` (NetBIOS معمولاً `SHASTAN`) |
| ورود | **فقط حساب ویندوز** (بدون ثبت‌نام و بدون صفحه‌ی ورود اختصاصی) |

داده‌ها (لیست‌ها، کتابخانه‌ها و اسناد) با **ShareGate** منتقل می‌شوند؛ صفحات، مستر پیج، سرویس، مجوزها و تنظیمات را
`Initialize-KBMigratedSite.ps1` می‌سازد.

## سطح دسترسی محتوا

| محتوا | چه کسی می‌بیند |
|-------|----------------|
| **عمومی** | همه — حتی بدون ورود |
| **اختصاصی** | فقط افراد و گروه‌هایی که در پنل ← ویرایش محتوا ← «افراد و گروه‌های مجاز» انتخاب شده‌اند، به‌علاوه‌ی `KB-Admins` و `KB-HR` |

- انتخاب افراد: جست‌وجوی نام، نام کاربری یا **گروه AD** (مثلاً `SHASTAN\Managers`) یا گروه شیرپوینت.
  دکمه‌ی «همه‌ی کاربران دامنه (KB-Readers)» محتوا را برای همه‌ی کاربران واردشده باز می‌کند.
- این انتخاب به‌صورت **مجوز Read روی همان آیتم** در شیرپوینت ذخیره می‌شود (ارث‌بری مجوز آن آیتم قطع می‌شود).
  پس عضویت گروه‌های AD را خود شیرپوینت بررسی می‌کند و پیوست‌های محتوا هم محافظت می‌شوند.
- عمومی کردن دوباره‌ی محتوا مجوز آیتم را به حالت ارثی برمی‌گرداند.
- کاربری که وارد شده ولی دسترسی ندارد، پیام «دسترسی به این محتوا به شما داده نشده است» را می‌بیند و آن محتوا در
  فهرست‌ها، جست‌وجو و صفحه‌ی اصلی برایش نمایش داده نمی‌شود.
- تغییر مجوز حداکثر پس از ۲ دقیقه (کش هر کاربر) در همه‌ی سرورهای وب دیده می‌شود؛ روی سروری که ذخیره انجام شده بلافاصله.
- عضویت تازه در یک گروه AD پس از ورود دوباره‌ی کاربر (تازه شدن توکن او) اثر می‌کند.

## ۱. پیش‌نیازها

- [ ] Site Collection در ریشه‌ی وب‌اپلیکیشن `sharepoint - learn` ساخته شده است (`http://srv-shpfront:2028/`).
- [ ] Alternate Access Mapping: `http://srv-shpfront:2028` و `https://learn.shastan.ir` (گواهی SSL روی Binding سایت IIS).
- [ ] احراز هویت وب‌اپلیکیشن روی همه‌ی Zoneها **Windows (NTLM یا Kerberos)** است.
- [ ] سرورهای شیرپوینت دامنه‌ی `shastan.local` را می‌شناسند (عضو دامنه یا Trust):
      ```powershell
      nltest /dsgetdc:shastan.local
      (Get-ADDomain shastan.local).NetBIOSName      # نام کوتاه دامنه برای kb.config.json
      ```
- [ ] گروه‌های `KB-Admins` و `KB-HR` در `shastan.local` ساخته شده‌اند (Security Group).

## ۲. انتقال با ShareGate

| منتقل کنید | منتقل نکنید (اسکریپت می‌سازد) |
|------------|-------------------------------|
| `KnowledgeContent` (با پیوست‌ها)، `DocLib`، `KBCategories`، `KBComments`، `KBReactions`، `KBSettings`، `KBAuditLog` | `KBPages`، `KBPanel`، `KBAssets`، `kb.master`، مجوزها و گروه‌های سایت |

`KBRegistrations` دیگر لازم نیست (ثبت‌نام خاموش است)؛ انتقال آن ضرری هم ندارد.

تنظیمات پیشنهادی ShareGate: حفظ Created/Modified/Author/Editor، **User & Group Mapping** حساب‌های دامنه‌ی قدیم به
`SHASTAN\...`، و کپی در لیست خالی (برای حفظ شناسه‌ی آیتم‌ها؛ اسکریپت تغییر شناسه را تشخیص و با `-SourceSiteUrl` اصلاح می‌کند).

## ۳. kb.config.json

```json
{
  "SiteUrl": "http://srv-shpfront:2028",
  "PublicUrl": "https://learn.shastan.ir",
  "WebApplicationName": "sharepoint - learn",
  "Zone": "Auto",
  "AdminsMembers": ["SHASTAN\\KB-Admins"],
  "HRMembers": ["SHASTAN\\KB-HR"],
  "ReadersMembers": ["c:0(.s|true"],
  "AutoSignIn": "Internal",
  "Registration": { "Enabled": false, ... },
  "LegacyHosts": ["srv-shp-web", "learn.shastangroup.ir", "testlearn.shastangroup.ir"]
}
```

| کلید | توضیح |
|------|-------|
| `SiteUrl` | نشانی داخلی سایت؛ اسکریپت‌ها روی سرور با این نشانی کار می‌کنند |
| `PublicUrl` | نشانی عمومی؛ نشانی‌های قدیمی داخل محتوا به این تبدیل می‌شوند |
| `Zone: "Auto"` | دسترسی ناشناس (برای محتوای عمومی) روی **همه‌ی Zoneهای** این وب‌اپلیکیشن فعال می‌شود |
| `SHASTAN\...` | با خروجی `NetBIOSName` بخش ۱ جایگزین کنید |
| `ReadersMembers` | `KB-Readers` = همه‌ی کاربران واردشده؛ فقط برای «همه‌ی کاربران دامنه» در مخاطبان محتوای اختصاصی استفاده می‌شود |
| `AutoSignIn` | `Internal` = کاربر ناشناس از شبکه‌ی داخلی (IP خصوصی) خودکار با حساب ویندوز وارد می‌شود؛ `Always` = همیشه؛ `Off` = خاموش |
| `Registration.Enabled` | `false` = دکمه‌ی ثبت‌نام و منوی «ثبت‌نام کاربران» پنهان است |

## ۴. اجرای اسکریپت

پوشه‌ی `sharepoint` را روی سرور شیرپوینت کپی کنید (مثلاً `C:\Deploy\kb`) و در **SharePoint Management Shell**
(Run as administrator):

```powershell
cd C:\Deploy\kb\provisioning
Set-ExecutionPolicy -Scope Process Bypass

.\Initialize-KBMigratedSite.ps1 -WhatIfOnly        # ۱) فقط گزارش
.\Initialize-KBMigratedSite.ps1                    # ۲) اجرای واقعی
```

اختیاری:
```powershell
# سایت قدیم روی همین فارم در دسترس است: تطبیق شناسه‌ها + تبدیل حساب کاربران در نظرها/پسندها
.\Initialize-KBMigratedSite.ps1 -SkipDeploy -SourceSiteUrl http://srv-shp-web -OldDomain AD -NewDomain SHASTAN

# محتواهای اختصاصیِ قبلی (که قبلاً برای همه‌ی کارکنان بودند) برای همه‌ی کاربران دامنه باز بمانند:
.\Initialize-KBMigratedSite.ps1 -SkipInstall -SkipDeploy -GrantExistingPrivateTo KB-Readers
#   یا فقط برای یک گروه AD:  -GrantExistingPrivateTo 'SHASTAN\Managers'

# حذف اعضای دامنه‌ی قدیم از گروه‌های KB-*:
.\Initialize-KBMigratedSite.ps1 -SkipInstall -SkipDeploy -OldDomain AD -RemoveOldMembers
```

روی سایر سرورهای وب (WFE) فارم: `.\Install-KBLayouts.ps1`

| پارامتر | کار |
|---------|-----|
| `-WhatIfOnly` | فقط گزارش؛ هیچ تغییری نمی‌دهد |
| `-SourceSiteUrl` | سایت قدیم برای تطبیق شناسه‌ی محتوا («عنوان + تاریخ ایجاد») و نظرها، و اصلاح ارجاع‌ها و پیوست‌های داخل متن |
| `-OldDomain` / `-NewDomain` | تبدیل `i:0#.w\|ad\ali` ← `i:0#.w\|shastan\ali` در نظرها و پسندها |
| `-GrantExistingPrivateTo` | محتوای اختصاصیِ بدون مخاطب به این گروه/کاربر مجوز مشاهده بگیرد |
| `-RemoveOldMembers` | حذف اعضای دامنه‌ی قدیم از گروه‌های KB-* (با `-OldDomain`) |
| `-SkipInstall` / `-SkipDeploy` | اجرا نکردن Install-KBPortal / اجرا نکردن Install-KBLayouts + Deploy-KBFiles + آزمون |

اسکریپت به‌ترتیب: ساختار و مجوزها (`Install-KBPortal.ps1`؛ دسترسی ناشناس همه‌ی Zoneها)، بازنویسی تنظیمات دامنه و
خاموش کردن ثبت‌نام در `KBSettings`، تبدیل نشانی‌های قدیمی داخل محتوا، بررسی شناسه‌ها، گزارش محتوای اختصاصیِ بدون مخاطب،
و در پایان `Install-KBLayouts.ps1` + `Deploy-KBFiles.ps1` + `Test-KBAnonymous.ps1`.

> **صفحه‌ی ورود اختصاصی (FBA) را فعال نکنید** — `Set-KBFormsAuth.ps1` را روی این وب‌اپلیکیشن اجرا نکنید.

## ۵. ورود بی‌صدا با حساب ویندوز

سایت برای کاربر ناشناسِ شبکه‌ی داخلی یک‌بار در هر نشست به `/_layouts/15/Authenticate.aspx` می‌رود؛ اگر مرورگر نشانی
را در **Local Intranet** بداند، با حساب ویندوز بدون پرسیدن رمز وارد می‌شود. با Group Policy روی رایانه‌های دامنه:

`User/Computer Configuration > Administrative Templates > Windows Components > Internet Explorer > Internet Control Panel > Security Page > Site to Zone Assignment List`

| Value name | Value |
|------------|-------|
| `https://learn.shastan.ir` | `1` |
| `http://srv-shpfront:2028` | `1` |

(Edge و Chrome روی ویندوز از همین تنظیم استفاده می‌کنند. Firefox: `network.automatic-ntlm-auth.trusted-uris`.)

- اگر سایت پشت Reverse Proxy منتشر می‌شود، Proxy باید هدر `X-Forwarded-For` را بفرستد؛ وگرنه همه‌ی درخواست‌ها
  «داخلی» دیده می‌شوند و کاربر بیرونی هم پنجره‌ی ورود می‌بیند. در آن حالت `AutoSignIn` را `Off` کنید
  (پنل ← تنظیمات سامانه ← ورود کاربران).
- بعد از «خروج» در همان نشست ورود خودکار تکرار نمی‌شود. برای آزمون بدون ورود: `?noauto=1` در انتهای نشانی.

## ۶. نشانی قدیم

روی سایت IIS نشانی قدیم (`learn.shastangroup.ir`) یک HTTP Redirect دائمی (301) به `https://learn.shastan.ir` بگذارید.

## ۷. آزمون

- [ ] InPrivate روی رایانه‌ی بیرون از دامنه (یا `?noauto=1`): صفحه‌ی خانه، محتوای عمومی، تصویرها و پیوست‌ها بدون ورود؛
      محتوای اختصاصی دیده نمی‌شود و نشانی مستقیم آن «این محتوا اختصاصی است» نشان می‌دهد.
- [ ] رایانه‌ی عضو دامنه: بدون پرسیدن رمز وارد می‌شود (نام کاربر در هدر).
- [ ] مدیر ← پنل ← یک محتوا را «اختصاصی» کنید و یک کاربر یا گروه AD را اضافه کنید ← آن کاربر محتوا را می‌بیند،
      کاربر دیگر پیام «دسترسی داده نشده» را می‌بیند.
- [ ] همان محتوا را «عمومی» کنید ← همه می‌بینند.
- [ ] دکمه‌ی «ثبت‌نام» در هدر نیست.

## ۸. رفع اشکال

| نشانه | علت / راه |
|-------|-----------|
| `Cannot find an SPSite object` | `SiteUrl` (`http://srv-shpfront:2028`) در AAM نیست یا Site Collection ریشه ساخته نشده |
| «نام وب‌اپلیکیشن … است، نه sharepoint - learn» | `SiteUrl` به وب‌اپلیکیشن دیگری اشاره می‌کند |
| کاربر دامنه هر بار پنجره‌ی نام کاربری می‌بیند | نشانی در Local Intranet مرورگر نیست (بخش ۵) |
| کاربر بیرونی پنجره‌ی نام کاربری می‌بیند | Reverse Proxy هدر `X-Forwarded-For` را نمی‌فرستد؛ `AutoSignIn = Off` |
| «این افراد یا گروه‌ها پیدا نشدند» هنگام ذخیره | حساب در `shastan.local` نیست یا سرور به دامنه دسترسی ندارد |
| جست‌وجوی افراد نتیجه ندارد | People Picker وب‌اپلیکیشن به `shastan.local` دسترسی ندارد (`Set-SPSite`/`peoplepicker-searchadforests` در stsadm) |
| کاربری که به گروه AD اضافه شده هنوز دسترسی ندارد | خروج و ورود دوباره (تازه شدن توکن) |
| نظرها زیر محتوای اشتباه | شناسه‌ها عوض شده‌اند: `-SourceSiteUrl` |
| تنظیمات جدید دیده نمی‌شود | `iisreset /noforce` |
