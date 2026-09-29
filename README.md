# پایگاه دانش شستان

پایگاه دانش سازمانی روی **SharePoint Server 2019 (On-Premises)** — `http://srv-shp-web`

| کاربر | چه می‌بیند / چه می‌کند |
|-------|------------------------|
| **عمومی** (بدون ورود) | محتوای «عمومی» منتشرشده: مقاله، ویدیو، پادکست، راهنما، گزارش، فایل‌های پیوست |
| **کارمند** (ورود با حساب `ad.shastangroup.ir`) | + محتوای «ویژه‌ی کارکنان»، پسند، ذخیره برای بعد، ثبت نظر و پاسخ |
| **منابع انسانی** (گروه `KB-HR`) | + پنل مدیریت محتوا: ویرایشگر حرفه‌ای، زمان‌بندی انتشار، کتابخانه‌ی رسانه، پیوست‌ها، دسته‌ها، تأیید نظرات |
| **مدیر سامانه** (گروه `KB-Admins`) | + دسترسی کامل، تنظیمات سامانه، گزارش فعالیت |

داده‌ها در لیست موجود **`KnowledgeContent`** و رسانه‌ها در کتابخانه‌ی **`DocLib`** می‌مانند.

## مستندات

| سند | محتوا |
|-----|-------|
| [`docs/01-review-and-design.md`](docs/01-review-and-design.md) | بررسی قالب اولیه، معماری، نقش‌ها و مجوزها، لیست‌ها و ستون‌ها، امکانات صفحات و پنل |
| [`docs/02-deployment.md`](docs/02-deployment.md) | **راهنمای گام‌به‌گام نصب روی شیرپوینت**، تست و رفع اشکال |

## نصب سریع

پوشه‌ی `sharepoint` را روی سرور شیرپوینت کپی کنید (مثلاً `C:\Deploy\kb`)، `provisioning\kb.config.json` را تکمیل کنید و در
**SharePoint Management Shell** (Run as administrator):

```powershell
cd C:\Deploy\kb\provisioning
Set-ExecutionPolicy -Scope Process Bypass
.\Install-KBPortal.ps1 -WhatIfOnly   # بررسی نگاشت ستون‌های KnowledgeContent
.\Install-KBPortal.ps1               # لیست‌ها، ستون‌ها، گروه‌ها، مجوزها
.\Install-KBLayouts.ps1              # سرویس KBApi.ashx — روی همه‌ی سرورهای وب
.\Deploy-KBFiles.ps1                 # مستر پیج، صفحات، CSS/JS
.\Test-KBAnonymous.ps1               # بررسی دسترسی‌ها
```

برای استقرار **Node.js یا Build لازم نیست**؛ پوشه‌ی `sharepoint` همان بسته‌ی نهایی است.

## ساختار

```
sharepoint/                    ← بسته‌ی استقرار
  provisioning/                اسکریپت‌های PowerShell + kb.config.json
  masterpage/kb.master         مستر پیج (فقط صفحات پایگاه دانش)
  KBPages/                     index.aspx · browse.aspx · content.aspx
  KBPanel/panel.aspx           پنل مدیریت محتوا
  KBAssets/                    css/kb.css · js/*.js · fonts · img
  layouts/KB/KBApi.ashx        سرویس سمت سرور (C#)
preview/                       پیش‌نمایش محلی با داده‌ی نمایشی (بدون شیرپوینت)
tools/                         serve.mjs · gen-icons.mjs · handler-check (بررسی کامپایل C#)
docs/                          مستندات
_original/                     قالب اولیه برای مقایسه
```

## پیش‌نمایش محلی (اختیاری، برای توسعه)

```bash
node tools/serve.mjs          # http://localhost:8080/preview/index.html
```
نوار پایین صفحه نقش نمایشی را عوض می‌کند (مهمان، کارمند، منابع انسانی، مدیر). داده‌ها در localStorage مرورگر هستند.

## بررسی کیفیت کد

```bash
for f in sharepoint/KBAssets/js/*.js preview/*.js; do node --check "$f"; done   # نحو JavaScript
bash tools/handler-check/check.sh                                                # کامپایل KBApi.ashx با قواعد C# 5 (نیاز: mono)
```
