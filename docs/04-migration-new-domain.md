# انتقال به وب‌اپلیکیشن جدید و دامنه‌ی shastan.ir

> سایت جدید: `https://learn.shastan.ir` — دامنه‌ی AD: `shastan.local` (NetBIOS معمولاً `SHASTAN`).
> داده‌ها (لیست‌ها، کتابخانه‌ها و اسناد) با **ShareGate** منتقل می‌شوند؛ صفحات، مستر پیج، سرویس، مجوزها و تنظیمات را
> اسکریپت `Initialize-KBMigratedSite.ps1` می‌سازد.

## ۱. پیش‌نیازها

- [ ] وب‌اپلیکیشن جدید و یک Site Collection در **ریشه‌ی** آن (`https://learn.shastan.ir/`) ساخته شده است.
      اگر سایت در مسیر دیگری است (مثلاً `/sites/kb`)، `SiteUrl` را همان نشانی کامل بگذارید.
- [ ] Alternate Access Mapping تنظیم شده و گواهی SSL روی Binding سایت در IIS (همه‌ی سرورهای وب) نصب است.
- [ ] سرورهای شیرپوینت دامنه‌ی `shastan.local` را می‌شناسند (عضو همان دامنه یا Trust دوطرفه)؛ آزمون:
      ```powershell
      nltest /dsgetdc:shastan.local
      (Get-ADDomain shastan.local).NetBIOSName     # نام کوتاه دامنه؛ در kb.config.json استفاده می‌شود
      ```
- [ ] گروه‌های `KB-Admins` و `KB-HR` در `shastan.local` ساخته شده‌اند (نوع Security).
- [ ] حسابی که اسکریپت را اجرا می‌کند روی سایت جدید Full Control دارد (اسکریپت در غیر این صورت راه رفع را چاپ می‌کند).

## ۲. انتقال با ShareGate

| انتقال بدهید | توضیح |
|--------------|-------|
| `KnowledgeContent` | با پیوست‌ها (Attachments) و نسخه‌ها |
| `DocLib` | کتابخانه‌ی رسانه |
| `KBCategories`، `KBComments`، `KBReactions`، `KBSettings`، `KBAuditLog`، `KBRegistrations` | داده‌های پایگاه دانش |

| انتقال **ندهید** (اسکریپت می‌سازد) | |
|-----------------------------------|--|
| `KBPages`، `KBPanel`، `KBAssets`، `kb.master` در Master Page Gallery | با `Deploy-KBFiles.ps1` از روی همین بسته ساخته می‌شوند |
| مجوزها و گروه‌های سایت | `Install-KBPortal.ps1` گروه‌ها و مجوزهای اختصاصی را دوباره تنظیم می‌کند |

تنظیمات پیشنهادی ShareGate:
- **حفظ تاریخ ایجاد/ویرایش و نویسنده** (Created، Modified، Author، Editor) — تطبیق شناسه‌ها با تاریخ ایجاد انجام می‌شود.
- **User & Group Mapping:** حساب‌های دامنه‌ی قدیم را به حساب‌های `SHASTAN\...` نگاشت کنید.
- لیست‌ها را در مقصد **خالی** کپی کنید (یا بگذارید ShareGate بسازد) تا شانس حفظ شناسه‌ی آیتم‌ها (ID) بیشتر باشد.
  اگر شناسه‌ها عوض شوند، نظرها و پسندها به محتوای اشتباه وصل می‌شوند؛ اسکریپت این را تشخیص می‌دهد و با `-SourceSiteUrl` اصلاح می‌کند.

> **درخواست‌های ثبت‌نامِ در انتظار:** رمز عبور این درخواست‌ها با MachineKey وب‌اپلیکیشن قدیم رمزنگاری شده است و در
> وب‌اپلیکیشن جدید باز نمی‌شود («رمزگشایی ممکن نشد»). یا پیش از انتقال آن‌ها را بررسی کنید، یا از کاربر بخواهید دوباره
> ثبت‌نام کند، یا کلیدهای `machineKey` (`validationKey`/`decryptionKey`) وب‌اپلیکیشن قدیم را با `Set-SPMachineKey` روی
> وب‌اپلیکیشن جدید بگذارید.

## ۳. اجرای اسکریپت

پوشه‌ی `sharepoint` را روی سرور شیرپوینت کپی کنید (مثلاً `C:\Deploy\kb`) و `provisioning\kb.config.json` را بررسی کنید:

```json
{
  "SiteUrl": "https://learn.shastan.ir",
  "Zone": "Auto",
  "AdminsMembers": ["SHASTAN\\KB-Admins"],
  "HRMembers": ["SHASTAN\\KB-HR"],
  "ReadersMembers": ["c:0(.s|true"],
  "Registration": {
    "Enabled": true,
    "ADMode": "Manual",
    "ADDomain": "shastan.local",
    "ADContainer": "OU=KB Users,DC=shastan,DC=local",
    "ADUpnSuffix": "shastan.local",
    "ADGroup": ""
  },
  "LegacyHosts": ["srv-shp-web", "learn.shastangroup.ir", "testlearn.shastangroup.ir"]
}
```

- `SHASTAN` را با خروجی `NetBIOSName` بخش ۱ جایگزین کنید.
- `Zone: "Auto"` یعنی Zone از روی AAM و `SiteUrl` پیدا می‌شود (برای `https://learn.shastan.ir` همان Zone ای که در AAM تعریف کرده‌اید).
- `ADUpnSuffix` اگر کاربران با `user@shastan.ir` وارد می‌شوند (UPN Suffix اضافه در AD Domains and Trusts)، `shastan.ir` بگذارید.

در **SharePoint Management Shell** (Run as administrator):

```powershell
cd C:\Deploy\kb\provisioning
Set-ExecutionPolicy -Scope Process Bypass

# ۱) فقط گزارش — هیچ تغییری نمی‌دهد
.\Initialize-KBMigratedSite.ps1 -WhatIfOnly

# ۲) اجرای واقعی
.\Initialize-KBMigratedSite.ps1

# اگر سایت قدیم روی همین فارم در دسترس است (برای تطبیق شناسه‌ها و تبدیل حساب کاربران در نظرها/پسندها):
.\Initialize-KBMigratedSite.ps1 -SourceSiteUrl http://srv-shp-web -OldDomain AD -NewDomain SHASTAN
# حذف اعضای دامنه‌ی قدیم از گروه‌های KB-* (بعد از اطمینان):
.\Initialize-KBMigratedSite.ps1 -SkipInstall -SkipDeploy -OldDomain AD -RemoveOldMembers
```

| پارامتر | کار |
|---------|-----|
| `-WhatIfOnly` | فقط گزارش: نگاشت ستون‌ها، تنظیماتی که عوض می‌شوند، محتواهایی که نشانی قدیمی دارند، نشانه‌های تغییر شناسه |
| `-SourceSiteUrl` | سایت قدیم (روی همین فارم)؛ شناسه‌ی محتوا با «عنوان + تاریخ ایجاد» و شناسه‌ی نظر با «حساب + تاریخ» تطبیق داده می‌شود و `ContentId`/`ParentId` در نظرها، پسندها، گزارش فعالیت و نشانی پیوست‌های داخل متن اصلاح می‌شود |
| `-OldDomain` / `-NewDomain` | NetBIOS دامنه‌ی قدیم و جدید؛ `i:0#.w\|ad\ali` ← `i:0#.w\|shastan\ali` در نظرها و پسندها (تا کاربر پسندها و نظرهای قبلی‌اش را ببیند) |
| `-RemoveOldMembers` | اعضای دامنه‌ی قدیم را از `KB-Admins`/`KB-HR`/`KB-Readers` حذف می‌کند (بدون آن فقط گزارش می‌دهد) |
| `-OldHosts` | نشانی‌های قدیمی (پیش‌فرض: `LegacyHosts` در kb.config.json) |
| `-SkipInstall` / `-SkipDeploy` | اجرا نکردن `Install-KBPortal.ps1` / اجرا نکردن `Install-KBLayouts.ps1` + `Deploy-KBFiles.ps1` + آزمون |

اسکریپت به‌ترتیب:
1. `Install-KBPortal.ps1` — ستون‌ها، گروه‌ها، مجوز اختصاصی لیست‌ها (مجوزهای کپی‌شده توسط ShareGate جایگزین می‌شوند)، دسترسی ناشناس Zone، صفحه‌ی خانه.
2. تنظیمات `ADDomain`، `ADContainer`، `ADUpnSuffix`، `ADGroup` در `KBSettings` را از kb.config.json **بازنویسی** می‌کند
   (مقدار کپی‌شده از سایت قدیم دامنه‌ی قبلی را داشت) و نشانی‌های قدیمی را در `LegacyHosts` ثبت می‌کند.
3. نشانی‌های مطلق قدیمی در تصویر شاخص، رسانه، تصویر نویسنده، خلاصه و متن محتوا را به نشانی جدید/نسبی تبدیل می‌کند
   (`SystemUpdate`؛ تاریخ ویرایش و ویرایشگر تغییر نمی‌کند).
4. شناسه‌ها و حساب کاربران را بررسی/اصلاح می‌کند (بالا).
5. `Install-KBLayouts.ps1` (روی همین سرور)، `Deploy-KBFiles.ps1` و `Test-KBAnonymous.ps1`.

بعد از آن:
```powershell
# روی سایر سرورهای وب (WFE) فارم
.\Install-KBLayouts.ps1
```

> حتی اگر نشانی قدیمی جایی باقی بماند، سرویس `KBApi.ashx` هر نشانی مطلق روی میزبان‌های AAM همین وب‌اپلیکیشن و
> `LegacyHosts` را نسبی نمایش می‌دهد (پنل ← تنظیمات سامانه ← «نشانی‌های قدیمی سامانه»).

## ۴. ورود با صفحه‌ی اختصاصی روی shastan.local (Forms + LDAP)

مراحل همان [`03-registration-and-login.md`](03-registration-and-login.md) بخش ۴ است، این بار روی **وب‌اپلیکیشن جدید**:

1. Providerها را در سه web.config (وب‌اپلیکیشن جدید، Security Token Service، Central Administration) روی همه‌ی سرورهای وب اضافه کنید.
   اگر قبلاً برای دامنه‌ی قدیم در STS و Central Admin اضافه شده‌اند، همان‌ها را ویرایش کنید (نام Providerها یکسان است):
   ```xml
   server="shastan.local"   connectionUsername="SHASTAN\svc-sp-ldap"
   userContainer="DC=shastan,DC=local"   groupContainer="DC=shastan,DC=local"
   ```
   برای محدود کردن ورود به یک OU: `userContainer="OU=Staff,DC=shastan,DC=local"`.
2. ```powershell
   .\Set-KBFormsAuth.ps1 -WhatIfOnly
   .\Set-KBFormsAuth.ps1
   ```
   Zone از AAM پیدا می‌شود؛ `KB-Readers` ← همه‌ی کاربران Forms، `KB-HR`/`KB-Admins` ← Role Claim گروه‌های `KB-HR`/`KB-Admins` در `shastan.local`.
3. کاربران با **نام کاربری `shastan.local`** (فقط `ali.rezaei`، بدون دامنه) و رمز همان حساب وارد می‌شوند.

> اگر STS برای وب‌اپلیکیشن قدیم هم همین Providerها را با دامنه‌ی قدیم استفاده می‌کند، تغییر `server` در STS ورود Forms
> وب‌اپلیکیشن قدیم را هم به `shastan.local` می‌برد (STS در فارم مشترک است). اگر هر دو هم‌زمان لازم‌اند، برای جدید
> Providerهایی با نام دیگر (مثلاً `KBLdapMember2`/`KBLdapRole2`) بسازید و اسکریپت را با
> `-MembershipProvider KBLdapMember2 -RoleProvider KBLdapRole2` اجرا کنید.

## ۵. نشانی قدیم

برای اینکه پیوندهای قدیمی کار کنند، روی سایت IIS نشانی قدیم (`learn.shastangroup.ir`) یک **HTTP Redirect** دائمی (301)
به `https://learn.shastan.ir` بگذارید («Redirect all requests to exact destination» خاموش تا مسیر حفظ شود). نشانی‌های
`content.aspx?cid=…` در صورت حفظ شناسه‌ها همچنان معتبرند.

## ۶. آزمون

- [ ] InPrivate: `https://learn.shastan.ir` ← صفحه‌ی خانه، محتوای عمومی، تصویرها و پیوست‌ها بدون ورود.
- [ ] ورود با حساب `shastan.local` ← محتوای «ویژه‌ی کارکنان»، پسندها و نظرهای قبلی کاربر.
- [ ] عضو `KB-HR` ← پنل ← ویرایش یک محتوا و بارگذاری تصویر (نشانی تصویر جدید روی `learn.shastan.ir`).
- [ ] مدیر ← پنل ← تنظیمات ← بخش Active Directory مقادیر `shastan.local` را نشان می‌دهد.
- [ ] تعداد نظرهای هر محتوا با سایت قدیم برابر است (اگر نیست: اجرای دوباره با `-SourceSiteUrl`).

## ۷. رفع اشکال

| نشانه | علت / راه |
|-------|-----------|
| `Get-SPWeb : Cannot find an SPSite object` | `SiteUrl` در AAM نیست یا Site Collection در آن نشانی ساخته نشده |
| «نشانی … در Alternate Access Mapping پیدا نشد؛ Zone = Default» | `SiteUrl` را دقیقاً مثل Public URL در AAM بنویسید یا `Zone` را صریح بگذارید |
| افزودن `SHASTAN\KB-Admins` ناموفق | NetBIOS دامنه چیز دیگری است، گروه وجود ندارد یا سرور به `shastan.local` دسترسی ندارد (`nltest`) |
| نظرها زیر محتوای اشتباه | شناسه‌ها عوض شده‌اند: `-SourceSiteUrl` |
| تصویر یا پیوست باز نمی‌شود | نشانی میزبانی دیگر در متن مانده: آن را به `LegacyHosts` اضافه و اسکریپت را دوباره با `-SkipInstall -SkipDeploy` اجرا کنید |
| تنظیمات جدید دیده نمی‌شود | سایت پیش از اسکریپت باز شده و تنظیمات در حافظه‌ی سرور مانده: `iisreset /noforce` |
| «رمزگشایی ممکن نشد» در ثبت‌نام‌های قدیمی | MachineKey متفاوت (بخش ۲) |
