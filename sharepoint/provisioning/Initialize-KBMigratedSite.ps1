<#
.SYNOPSIS
  راه‌اندازی پایگاه دانش روی وب‌اپلیکیشن/دامنه‌ی جدید، بعد از انتقال لیست‌ها و کتابخانه‌ها با ShareGate.

.DESCRIPTION
  پیش‌نیاز: سایت مقصد (مثلاً https://learn.shastan.ir) ساخته شده، Alternate Access Mapping تنظیم شده و
  لیست‌ها/کتابخانه‌ها (KnowledgeContent، DocLib، KBCategories، KBComments، KBReactions، KBSettings، KBAuditLog،
  KBRegistrations) با ShareGate منتقل شده‌اند. kb.config.json را قبل از اجرا با نشانی و دامنه‌ی جدید پر کنید.

  کارها (همه idempotent؛ اجرای دوباره ضرری ندارد):
    1. Install-KBPortal.ps1 : ستون‌ها، گروه‌ها، مجوزها، دسترسی ناشناس Zone (خودکار از AAM)، صفحه‌ی خانه
    2. تنظیمات دامنه در KBSettings (ADDomain، ADContainer، ADUpnSuffix، ADGroup) از kb.config.json «بازنویسی» می‌شود
       و نشانی‌های قدیمی به LegacyHosts اضافه می‌شوند
    3. نشانی‌های مطلق قدیمی (srv-shp-web، learn.shastangroup.ir، ...) در تصویر، رسانه، تصویر نویسنده و متن محتوا
       به نشانی جدید/نسبی تبدیل می‌شوند
    4. بررسی شناسه‌ها: اگر ShareGate شناسه‌ی آیتم‌ها (ID) را عوض کرده باشد، نظرها، پسندها و پیوست‌های داخل متن
       به محتوای اشتباه وصل می‌شوند. با -SourceSiteUrl (سایت قدیمی روی همین فارم) شناسه‌ها با «عنوان + تاریخ ایجاد»
       تطبیق داده و اصلاح می‌شوند.
    5. (اختیاری) -OldDomain/-NewDomain : حساب کاربران در نظرها و پسندها از دامنه‌ی قدیم به جدید
       (مثلاً ad\ali → shastan\ali) و گزارش/حذف اعضای دامنه‌ی قدیم از گروه‌های KB
    6. Install-KBLayouts.ps1 و Deploy-KBFiles.ps1 (صفحات، مستر پیج، CSS/JS) و آزمون Test-KBAnonymous.ps1

.EXAMPLE
  .\Initialize-KBMigratedSite.ps1 -WhatIfOnly           # فقط گزارش؛ هیچ تغییری اعمال نمی‌شود
  .\Initialize-KBMigratedSite.ps1
  .\Initialize-KBMigratedSite.ps1 -SourceSiteUrl http://srv-shp-web -OldDomain AD -NewDomain SHASTAN
#>
[CmdletBinding()]
param(
  [string]$ConfigPath = (Join-Path $PSScriptRoot 'kb.config.json'),
  # نام‌های میزبان قدیمی؛ پیش‌فرض: LegacyHosts در kb.config.json
  [string[]]$OldHosts,
  # سایت قدیمی (روی همین فارم) برای تطبیق شناسه‌ها؛ اگر در دسترس نیست خالی بگذارید
  [string]$SourceSiteUrl,
  # وقتی سایت قدیم در فارم دیگری است: نگاشت دستی شناسه‌ی قدیم → جدید محتوا، مثلاً @{ 5 = 3; 7 = 4 }
  [hashtable]$IdMap,
  # نام NetBIOS دامنه‌ی قدیم و جدید برای تبدیل حساب کاربران (مثلاً AD و SHASTAN)
  [string]$OldDomain,
  [string]$NewDomain,
  # بدون پرسش ادامه بده حتی اگر لیست محتوا خالی است (نصب تازه، بدون انتقال داده)
  [switch]$AllowEmpty,
  # اعضای دامنه‌ی قدیم از گروه‌های KB-Admins / KB-HR / KB-Readers حذف شوند (فقط با -OldDomain)
  [switch]$RemoveOldMembers,
  # محتوای اختصاصیِ بدون مخاطب به این گروه/کاربر مجوز مشاهده بگیرد (مثلاً KB-Readers = همه‌ی کاربران دامنه، یا SHASTAN\Managers)
  [string]$GrantExistingPrivateTo,
  [switch]$SkipInstall,
  [switch]$SkipDeploy,
  [switch]$WhatIfOnly
)

$ErrorActionPreference = 'Stop'
if (-not (Get-PSSnapin Microsoft.SharePoint.PowerShell -ErrorAction SilentlyContinue)) { Add-PSSnapin Microsoft.SharePoint.PowerShell }
function Write-Step([string]$m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Write-Ok([string]$m) { Write-Host "    [OK] $m" -ForegroundColor Green }
function Write-Note([string]$m) { Write-Host "    [!] $m" -ForegroundColor Yellow }
. (Join-Path $PSScriptRoot 'KBCommon.ps1')

$config = Get-Content $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
$apply = -not $WhatIfOnly

# ---------------------------------------------------------------- ۰. بررسی مقصد
Write-Step 'سایت مقصد'
$web = Get-SPWeb $config.SiteUrl
$webApp = $web.Site.WebApplication
$zone = Resolve-KBZone $webApp $config
Write-Host "    سایت: $($web.Url)   Web Application: $($webApp.Name) ($($webApp.Url))   Zone: $zone"
if ($config.WebApplicationName -and $webApp.Name -ne $config.WebApplicationName) {
  Write-Note "نام وب‌اپلیکیشن «$($webApp.Name)» است، نه «$($config.WebApplicationName)»؛ SiteUrl را بررسی کنید."
}
Write-Host '    Alternate Access Mapping:'
Show-KBAlternateUrls $webApp
$siteUri = [Uri]([string]$config.SiteUrl)
$newBase = if ($config.PublicUrl) { ([Uri]([string]$config.PublicUrl)).GetLeftPart([UriPartial]::Authority) } else { $siteUri.GetLeftPart([UriPartial]::Authority) }
$aamHosts = @($webApp.AlternateUrls | Where-Object { $_.Uri } | ForEach-Object { $_.Uri.Host.ToLower() })
if ($aamHosts -notcontains $siteUri.Host.ToLower()) { Write-Note "میزبان $($siteUri.Host) در AAM این وب‌اپلیکیشن نیست؛ ابتدا AAM را اصلاح کنید." }
if ($config.PublicUrl -and $aamHosts -notcontains ([Uri]([string]$config.PublicUrl)).Host.ToLower()) { Write-Note "نشانی عمومی $($config.PublicUrl) در AAM این وب‌اپلیکیشن نیست." }

if (-not $OldHosts) { $OldHosts = @($config.LegacyHosts) }
$OldHosts = @($OldHosts | Where-Object { $_ } | ForEach-Object { ([string]$_).Trim().ToLower() } |
  Where-Object { $_ -and $aamHosts -notcontains $_ } | Select-Object -Unique)
Write-Host "    نشانی‌های قدیمی: $(if ($OldHosts) { $OldHosts -join ', ' } else { '(هیچ)' })"

# داده هنوز منتقل نشده؟ اگر ستون‌ها قبل از ShareGate ساخته شوند، ShareGate ستون‌های قدیمی را کنار آن‌ها می‌سازد
# و داده در ستون‌هایی می‌نشیند که سامانه نمی‌خواند.
$probe = $web.Lists.TryGetList($config.ContentList)
$isEmpty = (-not $probe) -or ($probe.ItemCount -eq 0)
if ($isEmpty) {
  Write-Host ''
  Write-Note "لیست $($config.ContentList) $(if ($probe) { 'خالی است' } else { 'وجود ندارد' })؛ یعنی داده‌ها هنوز با ShareGate منتقل نشده‌اند."
  Write-Note 'ترتیب درست: اول ShareGate (همه‌ی لیست‌ها و DocLib)، بعد همین اسکریپت. اگر نصب تازه بدون انتقال داده است، -AllowEmpty بزنید.'
  if (-not $WhatIfOnly -and -not $AllowEmpty) {
    $answer = Read-Host 'با وجود این ادامه می‌دهید؟ (y/n)'
    if ($answer -notmatch '^(y|yes|بله)$') { $web.Dispose(); Write-Host 'متوقف شد؛ تغییری اعمال نشد.' -ForegroundColor Yellow; return }
  }
}
$web.Dispose()

# ---------------------------------------------------------------- ۱. نصب ساختار
if (-not $SkipInstall) {
  Write-Step 'Install-KBPortal.ps1'
  & (Join-Path $PSScriptRoot 'Install-KBPortal.ps1') -ConfigPath $ConfigPath -WhatIfOnly:$WhatIfOnly
}

$web = Get-SPWeb $config.SiteUrl
$web.AllowUnsafeUpdates = $true
$settingsList = $web.Lists.TryGetList('KBSettings')
$contentList = $web.Lists.TryGetList($config.ContentList)
if (-not $settingsList -or -not $contentList) {
  if ($WhatIfOnly) { Write-Note "لیست KBSettings یا $($config.ContentList) هنوز وجود ندارد؛ بقیه‌ی بررسی‌ها بعد از اجرای واقعی ممکن است."; return }
  throw "لیست KBSettings یا $($config.ContentList) در $($web.Url) یافت نشد."
}

function Get-Items($list, [string]$viewFields) {
  $q = New-Object Microsoft.SharePoint.SPQuery
  $q.ViewAttributes = "Scope='Recursive'"
  $q.RowLimit = 2000
  if ($viewFields) { $q.ViewFields = $viewFields; $q.ViewFieldsOnly = $false }
  do {
    $items = $list.GetItems($q)
    foreach ($it in $items) { $it }
    $q.ListItemCollectionPosition = $items.ListItemCollectionPosition
  } while ($q.ListItemCollectionPosition)
}
function Get-Setting([string]$key) {
  foreach ($it in $settingsList.Items) { if ([string]$it['Title'] -eq $key) { return $it } }
  return $null
}
function Set-SettingValue([string]$key, [string]$value) {
  $it = Get-Setting $key
  $old = if ($it) { [string]$it['Value'] } else { $null }
  if ($old -eq $value) { return }
  Write-Host ("    {0,-14} {1}  →  {2}" -f $key, $(if ($null -eq $old) { '(ندارد)' } else { $old }), $value)
  if (-not $apply) { return }
  if (-not $it) { $it = $settingsList.AddItem(); $it['Title'] = $key }
  $it['Value'] = $value
  $it.Update()
}

# ---------------------------------------------------------------- ۲. تنظیمات دامنه
Write-Step 'تنظیمات دامنه و Active Directory در KBSettings'
$reg = $config.Registration
if ($reg) {
  Set-SettingValue 'ADDomain' ([string]$reg.ADDomain)
  Set-SettingValue 'ADContainer' ([string]$reg.ADContainer)
  Set-SettingValue 'ADUpnSuffix' ([string]$reg.ADUpnSuffix)
  Set-SettingValue 'ADGroup' ([string]$reg.ADGroup)
  Set-SettingValue 'RegistrationEnabled' ([string]$reg.Enabled).ToLower()
}
if ($config.AutoSignIn) { Set-SettingValue 'AutoSignIn' ([string]$config.AutoSignIn) }
$legacy = @()
$cur = Get-Setting 'LegacyHosts'
if ($cur) { $legacy += ([string]$cur['Value']) -split '[,;\s]+' }
$legacy += $OldHosts
$legacy = @($legacy | Where-Object { $_ } | ForEach-Object { $_.Trim().ToLower() } | Where-Object { $aamHosts -notcontains $_ } | Select-Object -Unique)
if ($legacy) { Set-SettingValue 'LegacyHosts' ($legacy -join ', ') }
Write-Ok 'تنظیمات دامنه'

# ---------------------------------------------------------------- ۴ (الف). نگاشت شناسه‌ها
$fieldMap = @{}
$fm = Get-Setting 'FieldMap'
if ($fm -and [string]$fm['Value']) { ($fm['Value'] | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $fieldMap[$_.Name] = [string]$_.Value } }
function F([string]$logical, [string]$fallback) { if ($fieldMap[$logical]) { $fieldMap[$logical] } else { $fallback } }

function Key-Of($it) {
  $created = ([DateTime]$it['Created']).ToUniversalTime().ToString('yyyyMMddHHmm')
  return ([string]$it['Title']).Trim().ToLower() + '|' + $created
}

$cidMap = @{}         # شناسه‌ی قدیم محتوا → شناسه‌ی جدید
$commentMap = @{}    # شناسه‌ی قدیم نظر → شناسه‌ی جدید
Write-Step 'بررسی شناسه‌های محتوا'
$newItems = @(Get-Items $contentList)
$newIds = @{}
foreach ($it in $newItems) { $newIds[$it.ID] = $true }
Write-Host "    $($newItems.Count) محتوا در $($config.ContentList)"

if ($SourceSiteUrl) {
  $src = Get-SPWeb $SourceSiteUrl
  if ($src.ServerRelativeUrl.TrimEnd('/') -ne $web.ServerRelativeUrl.TrimEnd('/')) {
    Write-Note "مسیر سایت قدیم ($($src.ServerRelativeUrl)) و جدید ($($web.ServerRelativeUrl)) یکی نیست؛ پیوندهای نسبی داخل متن را بررسی کنید."
  }
  $srcList = $src.Lists.TryGetList($config.ContentList)
  if (-not $srcList) { throw "لیست $($config.ContentList) در $SourceSiteUrl یافت نشد." }
  $byKey = @{}
  foreach ($it in $newItems) { $k = Key-Of $it; if ($byKey.ContainsKey($k)) { $byKey[$k] = -1 } else { $byKey[$k] = $it.ID } }
  $byTitle = @{}
  foreach ($it in $newItems) { $t = ([string]$it['Title']).Trim().ToLower(); if ($byTitle.ContainsKey($t)) { $byTitle[$t] = -1 } else { $byTitle[$t] = $it.ID } }
  $unmatched = 0
  foreach ($old in (Get-Items $srcList)) {
    $k = Key-Of $old
    $nid = if ($byKey.ContainsKey($k) -and $byKey[$k] -gt 0) { $byKey[$k] } else {
      $t = ([string]$old['Title']).Trim().ToLower()
      if ($byTitle.ContainsKey($t) -and $byTitle[$t] -gt 0) { $byTitle[$t] } else { 0 }
    }
    if ($nid -gt 0) { if ($nid -ne $old.ID) { $cidMap[$old.ID] = $nid } } else { $unmatched++ }
  }
  if ($unmatched) { Write-Note "$unmatched محتوای سایت قدیم در مقصد پیدا نشد (حذف‌شده یا عنوان تکراری)." }

  $srcComments = $src.Lists.TryGetList('KBComments')
  $dstComments = $web.Lists.TryGetList('KBComments')
  if ($srcComments -and $dstComments) {
    $ck = @{}
    foreach ($c in (Get-Items $dstComments)) {
      $k = ([string]$c['AuthorLogin']).ToLower() + '|' + ([DateTime]$c['Created']).ToUniversalTime().ToString('yyyyMMddHHmmss')
      if ($ck.ContainsKey($k)) { $ck[$k] = -1 } else { $ck[$k] = $c.ID }
    }
    foreach ($c in (Get-Items $srcComments)) {
      $k = ([string]$c['AuthorLogin']).ToLower() + '|' + ([DateTime]$c['Created']).ToUniversalTime().ToString('yyyyMMddHHmmss')
      if ($ck.ContainsKey($k) -and $ck[$k] -gt 0 -and $ck[$k] -ne $c.ID) { $commentMap[$c.ID] = $ck[$k] }
    }
  }
  $src.Dispose()
  if ($cidMap.Count -or $commentMap.Count) { Write-Note "شناسه‌ی $($cidMap.Count) محتوا و $($commentMap.Count) نظر در مقصد تغییر کرده است؛ ارجاع‌ها اصلاح می‌شوند." }
  else { Write-Ok 'شناسه‌ها با سایت قدیم یکسان است' }
} else {
  # بدون سایت قدیم: ارجاع‌های بی‌صاحب و ناهمخوانی عنوان پسندها نشانه‌ی تغییر شناسه است
  $orphans = 0; $mismatch = 0; $orphanRows = @()
  $titles = @{}
  foreach ($it in $newItems) { $titles[$it.ID] = ([string]$it['Title']).Trim() }
  foreach ($name in @('KBComments', 'KBReactions', 'KBAuditLog')) {
    $l = $web.Lists.TryGetList($name)
    if (-not $l) { continue }
    foreach ($r in (Get-Items $l)) {
      $cid = [int]$r['ContentId']
      if ($cid -gt 0 -and -not $newIds.ContainsKey($cid)) {
        $orphans++
        $orphanRows += ("      {0,-12} #{1,-5} ContentId={2,-5} {3,-10} {4}" -f $name, $r.ID, $cid, [string]$r['Action'], [string]$r['Title'])
      }
      elseif ($name -eq 'KBReactions' -and $cid -gt 0 -and [string]$r['Title'] -and ([string]$r['Title']).Trim() -ne $titles[$cid]) { $mismatch++ }
    }
  }
  if ($orphans -or $mismatch) {
    Write-Note "$orphans ارجاع به محتوای ناموجود و $mismatch پسند با عنوان ناهمخوان پیدا شد."
    $orphanRows | ForEach-Object { Write-Host $_ }
    Write-Note 'اگر این‌ها مربوط به محتوای حذف‌شده‌ی قبلی‌اند (مثلاً Delete در KBAuditLog) مشکلی نیست.'
    Write-Note 'اگر ShareGate شماره‌ها را عوض کرده: سایت قدیم روی همین فارم → -SourceSiteUrl؛ روی فارم دیگر → -IdMap @{ قدیم = جدید }'
  } else { Write-Ok 'نشانه‌ای از تغییر شناسه‌ها دیده نشد' }
}

if ($IdMap -and $IdMap.Count) {
  foreach ($k in $IdMap.Keys) { if ([int]$k -ne [int]$IdMap[$k]) { $cidMap[[int]$k] = [int]$IdMap[$k] } }
  Write-Note "نگاشت دستی شناسه‌ها: $(($cidMap.Keys | Sort-Object | ForEach-Object { "$_→$($cidMap[$_])" }) -join '، ')"
}
function Map-Id([int]$id) { if ($cidMap.ContainsKey($id)) { return [int]$cidMap[$id] } return $id }

# ---------------------------------------------------------------- ۳ و ۴ (ب). بازنویسی نشانی‌ها و پیوست‌ها در محتوا
Write-Step "نشانی‌های قدیمی در $($config.ContentList)"
$hostRx = if ($OldHosts) { '(?i)https?://(?:' + (($OldHosts | ForEach-Object { [regex]::Escape($_) }) -join '|') + ')(?::\d+)?(?=/)' } else { $null }
$listRoot = $contentList.RootFolder.ServerRelativeUrl.TrimEnd('/')
$attRx = '(?i)(' + [regex]::Escape($listRoot) + '/Attachments/)(\d+)(?=/)'
# نشانی لیست محتوا در سایت قدیم (مثلاً /Lists/KnowledgeContent2) اگر با مقصد فرق دارد → نشانی لیست مقصد
$oldListRoots = @($config.LegacyContentListUrls | Where-Object { $_ } | ForEach-Object { '/' + ([string]$_).Trim().Trim('/') } |
  Where-Object { $_ -ine $listRoot } | Select-Object -Unique)
$pathRx = if ($oldListRoots) { '(?i)(?:' + (($oldListRoots | ForEach-Object { [regex]::Escape($_) }) -join '|') + ')(?=/)' } else { $null }
Write-Host "    نشانی لیست محتوا در مقصد: $listRoot$(if ($oldListRoots) { '   (نشانی‌های قدیمی که تبدیل می‌شوند: ' + ($oldListRoots -join ', ') + ')' })"

function Fix-Text([string]$s) {
  if ([string]::IsNullOrEmpty($s)) { return $s }
  $r = $s
  if ($hostRx) { $r = [regex]::Replace($r, $hostRx, '') }
  if ($pathRx) { $r = [regex]::Replace($r, $pathRx, $listRoot) }
  if ($cidMap.Count) { $r = [regex]::Replace($r, $attRx, { param($m) $m.Groups[1].Value + (Map-Id ([int]$m.Groups[2].Value)) }) }
  return $r
}
function Fix-Url([string]$s) {
  if ([string]::IsNullOrEmpty($s)) { return $s }
  $r = $s
  if ($hostRx) { $r = [regex]::Replace($r, $hostRx, $newBase) }
  if ($pathRx) { $r = [regex]::Replace($r, $pathRx, $listRoot) }
  if ($cidMap.Count) { $r = [regex]::Replace($r, $attRx, { param($m) $m.Groups[1].Value + (Map-Id ([int]$m.Groups[2].Value)) }) }
  return $r
}

$textFields = @('Summary', 'Body', 'AuthorBio') | ForEach-Object { F $_ $_ } | Where-Object { $contentList.Fields.ContainsFieldWithStaticName($_) }
$urlFields = @('ThumbnailUrl', 'AuthorImageUrl', 'MediaUrl') | ForEach-Object { F $_ $_ } | Where-Object { $contentList.Fields.ContainsFieldWithStaticName($_) }
$changedItems = 0
foreach ($it in $newItems) {
  $dirty = $false
  foreach ($f in $textFields) {
    $v = [string]$it[$f]
    $n = Fix-Text $v
    if ($n -ne $v) { if ($apply) { $it[$f] = $n }; $dirty = $true }
  }
  foreach ($f in $urlFields) {
    $field = $contentList.Fields.GetFieldByInternalName($f)
    $v = [string]$it[$f]
    if (-not $v) { continue }
    if ($field.Type -eq [Microsoft.SharePoint.SPFieldType]::URL) {
      $uv = New-Object Microsoft.SharePoint.SPFieldUrlValue($v)
      $nu = Fix-Url $uv.Url
      if ($nu -ne $uv.Url) {
        if ($apply) { $uv.Url = $nu; $it[$f] = $uv }
        $dirty = $true
      }
    } else {
      $n = Fix-Text $v
      if ($n -ne $v) { if ($apply) { $it[$f] = $n }; $dirty = $true }
    }
  }
  if ($dirty) {
    $changedItems++
    Write-Host "    #$($it.ID) $($it.Title)"
    if ($apply) { $it.SystemUpdate($false) }
  }
}
Write-Ok "$changedItems محتوا $(if ($apply) { 'اصلاح شد' } else { 'نیاز به اصلاح دارد' })"

# ---------------------------------------------------------------- ۴ (ج) و ۵. ارجاع‌ها و حساب کاربران
$loginRx = $null
if ($OldDomain -and $NewDomain) { $loginRx = '(?i)^((?:i:0#\.w\|)?)' + [regex]::Escape($OldDomain) + '\\' }
function Fix-Login([string]$s, [bool]$lower) {
  if (-not $loginRx -or [string]::IsNullOrEmpty($s)) { return $s }
  $r = [regex]::Replace($s, $loginRx, { param($m) $m.Groups[1].Value + $NewDomain + '\' })
  if ($lower) { $r = $r.ToLower() }
  return $r
}

Write-Step 'نظرها، پسندها و گزارش فعالیت'
foreach ($spec in @(
    @{ List = 'KBComments'; Login = 'AuthorLogin'; Lower = $false },
    @{ List = 'KBReactions'; Login = 'UserKey'; Lower = $true },
    @{ List = 'KBAuditLog'; Login = $null; Lower = $false })) {
  $l = $web.Lists.TryGetList($spec.List)
  if (-not $l) { Write-Note "$($spec.List) وجود ندارد"; continue }
  $n = 0
  foreach ($r in (Get-Items $l)) {
    $dirty = $false
    $cid = [int]$r['ContentId']
    $ncid = Map-Id $cid
    if ($ncid -ne $cid) { if ($apply) { $r['ContentId'] = $ncid }; $dirty = $true }
    if ($spec.List -eq 'KBComments') {
      $parentId = [int]$r['ParentId']
      if ($parentId -gt 0 -and $commentMap.ContainsKey($parentId)) { if ($apply) { $r['ParentId'] = [int]$commentMap[$parentId] }; $dirty = $true }
    }
    if ($spec.Login) {
      $v = [string]$r[$spec.Login]
      $nv = Fix-Login $v $spec.Lower
      if ($nv -ne $v) { if ($apply) { $r[$spec.Login] = $nv }; $dirty = $true }
    }
    if ($dirty) { $n++; if ($apply) { $r.SystemUpdate($false) } }
  }
  Write-Ok "$($spec.List): $n مورد $(if ($apply) { 'اصلاح شد' } else { 'نیاز به اصلاح دارد' })"
}

# ---------------------------------------------------------------- محتوای اختصاصی بدون مخاطب
Write-Step 'محتوای اختصاصی'
$visField = F 'Visibility' 'Visibility'
$reader = $web.RoleDefinitions.GetByType([Microsoft.SharePoint.SPRoleType]::Reader)
$grantTo = $null
if ($GrantExistingPrivateTo) {
  $grantTo = $web.SiteGroups | Where-Object { $_.Name -eq $GrantExistingPrivateTo }
  if (-not $grantTo) { $grantTo = $web.EnsureUser($GrantExistingPrivateTo) }
}
$noAudience = 0; $granted = 0
foreach ($it in (Get-Items $contentList)) {
  $v = ([string]$it[$visField]).Trim().ToLower()
  if ($v -in @('public', 'عمومی')) { continue }
  if ($it.HasUniqueRoleAssignments) { continue }
  $noAudience++
  if ($grantTo -and $apply) {
    $it.BreakRoleInheritance($true)
    $ra = New-Object Microsoft.SharePoint.SPRoleAssignment($grantTo)
    $ra.RoleDefinitionBindings.Add($reader)
    $it.RoleAssignments.Add($ra)
    $granted++
  }
}
if ($granted) { Write-Ok "$granted محتوای اختصاصی به «$GrantExistingPrivateTo» مجوز مشاهده گرفت" }
elseif ($noAudience) { Write-Note "$noAudience محتوای اختصاصی هنوز مخاطب ندارد و فقط مدیران آن را می‌بینند؛ از پنل ← ویرایش ← «افراد و گروه‌های مجاز» یا -GrantExistingPrivateTo KB-Readers" }
else { Write-Ok 'همه‌ی محتواهای اختصاصی مخاطب دارند' }

if ($OldDomain) {
  Write-Step "اعضای دامنه‌ی قدیم ($OldDomain) در گروه‌های پایگاه دانش"
  $memberRx = '(?i)(^|\|)' + [regex]::Escape($OldDomain) + '\\'
  foreach ($gname in @('KB-Admins', 'KB-HR', 'KB-Readers')) {
    $g = $web.SiteGroups | Where-Object { $_.Name -eq $gname }
    if (-not $g) { continue }
    foreach ($u in @($g.Users)) {
      if ($u.LoginName -match $memberRx) {
        if ($RemoveOldMembers -and $apply) { $g.RemoveUser($u); Write-Ok "$gname ← حذف $($u.LoginName)" }
        else { Write-Note "$gname : $($u.LoginName)  (برای حذف: -RemoveOldMembers)" }
      }
    }
  }
}
$web.Dispose()

if ($WhatIfOnly) { Write-Host ''; Write-Note 'حالت WhatIfOnly: تغییری اعمال نشد.'; return }

# ---------------------------------------------------------------- ۶. سرویس، صفحات و آزمون
if (-not $SkipDeploy) {
  Write-Step 'Install-KBLayouts.ps1 (این سرور)'
  & (Join-Path $PSScriptRoot 'Install-KBLayouts.ps1')
  Write-Step 'Deploy-KBFiles.ps1'
  & (Join-Path $PSScriptRoot 'Deploy-KBFiles.ps1') -ConfigPath $ConfigPath
  Write-Step 'Test-KBAnonymous.ps1'
  try { & (Join-Path $PSScriptRoot 'Test-KBAnonymous.ps1') -ConfigPath $ConfigPath } catch { Write-Note "آزمون: $($_.Exception.Message)" }
}

Write-Host "`nراه‌اندازی سایت جدید کامل شد: $($config.SiteUrl)" -ForegroundColor Green
Write-Host '  - Install-KBLayouts.ps1 را روی سایر سرورهای وب (WFE) هم اجرا کنید.' -ForegroundColor Yellow
Write-Host '  - اگر سایت پیش از این اسکریپت باز شده بود، روی سرورهای وب iisreset /noforce بزنید تا تنظیمات کش‌شده تازه شوند.' -ForegroundColor Yellow
Write-Host '  - ورود کاربران با حساب ویندوز shastan.local است؛ برای ورود بی‌صدا نشانی سایت را در Local Intranet مرورگرها بگذارید (docs/04 بخش ۵).' -ForegroundColor Yellow
