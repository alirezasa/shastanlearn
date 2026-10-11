# ثبت‌نام کاربران و صفحه‌ی ورود اختصاصی

> این راهنما مکمل [`02-deployment.md`](02-deployment.md) است. سایت: `https://testlearn.shastangroup.ir`، دامنه: `ad.shastangroup.ir`.

---

## ۱. چه چیزی اضافه شد

| بخش | نشانی | توضیح |
|-----|-------|-------|
| صفحه‌ی ثبت‌نام | `/KBPages/register.aspx` | نام، نام خانوادگی، نام کاربری، رمز عبور (+ تکرار)، شماره‌ی همراه، نام شرکت (اختیاری)، کد امنیتی؛ برگه‌ی «پیگیری درخواست» با نام کاربری + همراه |
| صفحه‌ی ورود اختصاصی | `/_layouts/15/KB/login.aspx` | ورود با نام کاربری و رمز AD (Forms + LDAP)، پیوند ثبت‌نام، «ورود خودکار در شبکه‌ی داخلی» (Windows) |
| پنل مدیریت ← ثبت‌نام کاربران | `KBPanel/panel.aspx#/registrations` | فقط مدیر سامانه: تأیید و ایجاد حساب در AD، یا ایجاد دستی با دستور آماده‌ی PowerShell، رد با دلیل |
| لیست `KBRegistrations` | — | درخواست‌ها؛ فقط گروه KB-Admins دسترسی دارد |
| تنظیمات سامانه ← ثبت‌نام و AD | — | روشن/خاموش ثبت‌نام، حالت ایجاد حساب، دامنه، OU، پسوند UPN، گروه |

### چرخه‌ی درخواست

```
ثبت‌نام (Pending) ──┬── «تأیید و ایجاد حساب» (حالت خودکار) ─────────────► Created
                    ├── «تأیید» (حالت دستی) → Approved → ساخت حساب در AD → «ثبت شد در AD» ► Created
                    └── «رد» (با دلیل؛ در صفحه‌ی پیگیری نمایش داده می‌شود) ──────────► Rejected
```

### امنیت

- فرم ثبت‌نام: کد امنیتی یک‌بارمصرف (۱۵ دقیقه)، فیلد تله برای ربات، حداکثر ۵ درخواست در ساعت برای هر IP.
- اعتبارسنجی سمت سرور: نام کاربری `^[a-z][a-z0-9._-]{2,19}$` (همان sAMAccountName)، تکراری نبودن در درخواست‌ها و در AD،
  رمز عبور مطابق Password Complexity پیش‌فرض AD (۸ نویسه، سه نوع از چهار نوع، شامل نام کاربری یا نام نباشد)، همراه `09xxxxxxxxx`.
- رمز عبور با **MachineKey** شیرپوینت رمزنگاری می‌شود (در همه‌ی سرورهای فارم یکسان است)، در فرم‌ها و نماهای لیست
  نمایش داده نمی‌شود و **پس از ایجاد حساب یا رد درخواست پاک می‌شود**. نمایش آن به مدیر (برای ساخت دستی) در گزارش فعالیت ثبت می‌شود.
- ایمیل اطلاع‌رسانی درخواست جدید به نشانی‌های `NotifyEmails` (تنظیمات سامانه).

---

## ۲. نصب

```powershell
cd C:\Deploy\kb\provisioning
.\Install-KBPortal.ps1      # لیست KBRegistrations و تنظیمات ثبت‌نام
.\Install-KBLayouts.ps1     # KBApi.ashx و login.aspx — روی همه‌ی سرورهای وب
.\Deploy-KBFiles.ps1        # register.aspx، CSS و JS
```

تنظیمات اولیه از بخش `Registration` فایل `kb.config.json` خوانده می‌شود (فقط اگر قبلاً از پنل تنظیم نشده باشد):

```json
"Registration": {
  "Enabled": true,
  "ADMode": "Manual",
  "ADDomain": "ad.shastangroup.ir",
  "ADContainer": "OU=KB Users,DC=ad,DC=shastangroup,DC=ir",
  "ADUpnSuffix": "ad.shastangroup.ir",
  "ADGroup": ""
}
```
بعداً همه را از **پنل ← تنظیمات سامانه ← ثبت‌نام کاربران و Active Directory** تغییر دهید.

---

## ۳. ایجاد حساب در Active Directory

### حالت دستی (پیش‌فرض — بدون هیچ تنظیم اضافه در AD)
1. پنل ← **ثبت‌نام کاربران** ← «ایجاد دستی» روی درخواست.
2. مشخصات و **دستور آماده‌ی PowerShell** (`New-ADUser` + `Add-ADGroupMember`) نمایش داده می‌شود؛ «کپی دستور» و اجرا روی سروری که
   ماژول ActiveDirectory دارد. رمز عبور هنگام اجرا پرسیده می‌شود؛ رمزی که کاربر انتخاب کرده با «نمایش» دیده می‌شود.
3. «ثبت شد در AD» ← وضعیت «حساب ایجاد شد» و رمز از پایگاه دانش حذف می‌شود.

### حالت خودکار
سرویس پایگاه دانش با **هویت App Pool شیرپوینت** کاربر را می‌سازد؛ این حساب باید فقط روی **یک OU** مجوز داشته باشد.

**الف) حساب App Pool را پیدا کنید**
```powershell
(Get-SPWebApplication "https://testlearn.shastangroup.ir").ApplicationPool.Username
```

**ب) OU مقصد را بسازید** (مثلاً `OU=KB Users,DC=ad,DC=shastangroup,DC=ir`).

**ج) Delegate Control روی همان OU** (Active Directory Users and Computers ← راست‌کلیک روی OU ← Delegate Control ← حساب App Pool):
- ☑ Create, delete, and manage user accounts
- ☑ Reset user passwords and force password change at next logon

یا با دستور (جای `SHASTAN\svc-sp-app` حساب App Pool را بگذارید):
```cmd
dsacls "OU=KB Users,DC=ad,DC=shastangroup,DC=ir" /I:T /G "SHASTAN\svc-sp-app:CCDC;user"
dsacls "OU=KB Users,DC=ad,DC=shastangroup,DC=ir" /I:S /G "SHASTAN\svc-sp-app:CA;Reset Password;user"
dsacls "OU=KB Users,DC=ad,DC=shastangroup,DC=ir" /I:S /G "SHASTAN\svc-sp-app:WP;;user"
```

**د) گروه کاربران جدید (اختیاری)** — اگر `ADGroup` تنظیم شده (مثلاً `KB-Members`)، حساب App Pool باید عضویت آن گروه را تغییر دهد:
```cmd
dsacls "CN=KB-Members,OU=Groups,DC=ad,DC=shastangroup,DC=ir" /G "SHASTAN\svc-sp-app:WP;member"
```

**هـ)** پنل ← تنظیمات سامانه: «ایجاد حساب پس از تأیید» = **خودکار**، دامنه و OU را وارد و ذخیره کنید.
از این پس دکمه‌ی «تأیید و ایجاد حساب» کاربر را با همان رمز انتخابی‌اش می‌سازد (فعال، همراه `mobile`، شرکت `company`، UPN
`user@ad.shastangroup.ir`). اگر خطایی رخ دهد (مثلاً مجوز یا سیاست رمز)، متن خطا کنار درخواست نمایش داده می‌شود و همچنان
می‌توانید «ایجاد دستی» را انتخاب کنید. رمز عبور از طریق Kerberos با رمزنگاری کانال (Sealing) تنظیم می‌شود؛ LDAPS لازم نیست.

---

## ۴. صفحه‌ی ورود اختصاصی (Forms + LDAP)

> **چرا لازم است؟** با احراز هویت Windows، مرورگر خودش پنجره‌ی نام کاربری را نشان می‌دهد و ظاهر آن قابل تغییر نیست.
> برای صفحه‌ی ورود اختصاصی، روی همان Zone ورود **Forms** با `LdapMembershipProvider` (همان AD) فعال می‌شود؛ Windows هم
> برای شبکه‌ی داخلی و Crawl باقی می‌ماند. تا این بخش انجام نشود، ثبت‌نام کار می‌کند و کاربران جدید با پنجره‌ی مرورگر وارد می‌شوند.

### ۴-۱. Providerها
نام‌ها در همه‌ی فایل‌ها یکسان باشد: `KBLdapMember` و `KBLdapRole`. سرور و حساب سرویس فقط‌خواندنی LDAP را جایگزین کنید.

```xml
<add name="KBLdapMember"
     type="Microsoft.Office.Server.Security.LdapMembershipProvider, Microsoft.Office.Server, Version=16.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c"
     server="ad.shastangroup.ir" port="389" useSSL="false"
     connectionUsername="SHASTAN\svc-sp-ldap" connectionPassword="********"
     userDNAttribute="distinguishedName" userNameAttribute="sAMAccountName"
     userContainer="DC=ad,DC=shastangroup,DC=ir" userObjectClass="person"
     userFilter="(&amp;(objectClass=person)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))"
     scope="Subtree" otherRequiredUserAttributes="sn,givenname,cn,mail" />

<add name="KBLdapRole"
     type="Microsoft.Office.Server.Security.LdapRoleProvider, Microsoft.Office.Server, Version=16.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c"
     server="ad.shastangroup.ir" port="389" useSSL="false"
     connectionUsername="SHASTAN\svc-sp-ldap" connectionPassword="********"
     groupContainer="DC=ad,DC=shastangroup,DC=ir" groupNameAttribute="cn" groupNameAlternateSearchAttribute="samAccountName"
     groupMemberAttribute="member" userNameAttribute="sAMAccountName" dnAttribute="distinguishedName"
     groupFilter="(&amp;(objectClass=group))" userFilter="(&amp;(objectClass=person))" scope="Subtree" />
```
`userFilter` حساب‌های غیرفعال را کنار می‌گذارد. اگر LDAPS دارید: `port="636" useSSL="true"`.

### ۴-۲. سه web.config (روی **همه‌ی** سرورهای وب؛ قبل از تغییر نسخه‌ی پشتیبان بگیرید)

| فایل | محل | کجا اضافه شود |
|------|-----|---------------|
| وب‌اپلیکیشن | `C:\inetpub\wwwroot\wss\VirtualDirectories\<پورت یا نام سایت>\web.config` | داخل `<membership><providers>` و `<roleManager><providers>` موجود (پیش‌فرض‌های `i` و `c` را تغییر ندهید) |
| Security Token Service | `…\16\WebServices\SecurityToken\web.config` | قبل از `</configuration>`: `<system.web><membership><providers>…</providers></membership><roleManager enabled="true"><providers>…</providers></roleManager></system.web>` |
| Central Administration | `C:\inetpub\wwwroot\wss\VirtualDirectories\<پورت CA>\web.config` | مانند وب‌اپلیکیشن (برای People Picker) |

### ۴-۳. فعال‌سازی
```powershell
.\Set-KBFormsAuth.ps1 -WhatIfOnly    # بررسی Providerها و نمایش برنامه
.\Set-KBFormsAuth.ps1
```
- Zone: Windows (NTLM) + Forms (`KBLdapMember` / `KBLdapRole`)، صفحه‌ی ورود `/_layouts/15/KB/login.aspx`.
- `KB-Readers` ← همه‌ی کاربران Forms (`c:0(.s|forms:kbldapmember`)؛ `KB-HR` و `KB-Admins` ← گروه‌های AD متناظر به‌صورت Role Claim.
- دکمه‌ی «ورود» سایت به `Authenticate.aspx` می‌رود و شیرپوینت خودش به صفحه‌ی ورود اختصاصی هدایت می‌کند.

> **نکته:** کاربر Forms (`i:0#.f|kbldapmember|a.rezaei`) و همان کاربر با Windows (`i:0#.w|shastan\a.rezaei`) از دید شیرپوینت دو
> هویت جدا هستند؛ پسندها و ذخیره‌های آن‌ها جداست ولی مجوزها از طریق گروه‌ها به هر دو داده می‌شود. ترجیحاً همه از صفحه‌ی ورود اختصاصی وارد شوند.

---

## ۵. تست

- [ ] InPrivate ← هدر: «ثبت‌نام» ← فرم را با کد امنیتی اشتباه بفرستید (خطا) و سپس درست (کد پیگیری `R-1405-xxxx`).
- [ ] برگه‌ی «پیگیری درخواست» با نام کاربری + همراه ← «در انتظار بررسی».
- [ ] مدیر سامانه ← پنل ← ثبت‌نام کاربران (عدد کنار منو) ← «ایجاد دستی» یا «تأیید و ایجاد حساب».
- [ ] کاربر جدید در OU ساخته شده، فعال است و `mobile` / `company` دارد.
- [ ] کاربر جدید با همان رمز وارد می‌شود و محتوای «ویژه‌ی کارکنان» را می‌بیند.
- [ ] رد درخواست با دلیل ← دلیل در صفحه‌ی پیگیری دیده می‌شود.
- [ ] `.\Test-KBAnonymous.ps1` (ردیف «صفحه‌ی ورود اختصاصی» فقط پس از بخش ۴ سبز می‌شود).

## ۶. رفع اشکال

| نشانه | علت |
|-------|-----|
| دکمه‌ی «ثبت‌نام» در هدر نیست | تنظیمات سامانه ← ثبت‌نام کاربر جدید = فعال؛ یا Install-KBPortal.ps1 اجرا نشده |
| «لیست KBRegistrations یافت نشد» | Install-KBPortal.ps1 را دوباره اجرا کنید |
| «اجازه‌ی این کار را در OU ندارد» | Delegate Control (بخش ۳-ج) برای حساب App Pool انجام نشده یا روی OU دیگری است |
| «رمز عبور با سیاست رمز دامنه سازگار نیست» | Password Policy دامنه سخت‌گیرانه‌تر از پیش‌فرض است (طول بیشتر یا تاریخچه)؛ درخواست را رد کنید تا کاربر رمز دیگری انتخاب کند |
| «OU مقصد یافت نشد» | مسیر DN در تنظیمات (ADContainer) دقیق نیست |
| «رمزگشایی ممکن نشد» | MachineKey سرورهای وب یکسان نیست: `Update-SPMachineKey` / `Set-SPMachineKey` روی وب‌اپلیکیشن |
| صفحه‌ی ورود: «نام کاربری یا رمز نادرست» برای کاربر درست | Provider در web.config وب‌اپلیکیشن **و** STS یکسان نیست، یا حساب LDAP / سرور اشتباه است؛ لاگ ULS |
