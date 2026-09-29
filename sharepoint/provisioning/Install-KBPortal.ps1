<#
.SYNOPSIS
  نصب و پیکربندی پایگاه دانش شستان روی SharePoint Server 2019.

.DESCRIPTION
  روی سرور شیرپوینت در «SharePoint Management Shell» (Run as Administrator) با حسابی که روی سایت
  Full Control دارد اجرا شود. اسکریپت idempotent است: اجرای مجدد چیزی را حذف نمی‌کند و فقط موارد جاافتاده را
  اضافه یا اصلاح می‌کند. لیست KnowledgeContent و کتابخانه‌ی DocLib موجود حفظ می‌شوند و فقط ستون‌های لازم
  به آن‌ها اضافه می‌شود.

  کارها:
    1. Web Application: دسترسی ناشناس روی Zone
    2. Featureها: خاموش کردن MDS، روشن کردن Lockdown Mode
    3. سطح دسترسی «KB Editor» و گروه‌های KB-Admins / KB-HR / KB-Readers
    4. ستون‌های لیست محتوا (نگاشت ستون‌های موجود + ساخت ستون‌های جدید) و قطع دسترسی مستقیم کاربران
    5. لیست‌های KBCategories، KBComments، KBReactions، KBSettings، KBAuditLog
    6. کتابخانه‌های KBPages (عمومی)، KBPanel (فقط کاربران واردشده)، KBAssets و تنظیم DocLib
    7. داده‌های پایه (تنظیمات، دسته‌ها) و وضعیت محتوای موجود
    8. صفحه‌ی خانه‌ی سایت

.EXAMPLE
  .\Install-KBPortal.ps1 -WhatIfOnly     # فقط بررسی ورودی‌ها و نمایش نگاشت ستون‌ها
  .\Install-KBPortal.ps1
#>
[CmdletBinding()]
param(
  [string]$ConfigPath = (Join-Path $PSScriptRoot 'kb.config.json'),
  [switch]$WhatIfOnly
)

$ErrorActionPreference = 'Stop'
if (-not (Get-PSSnapin Microsoft.SharePoint.PowerShell -ErrorAction SilentlyContinue)) {
  Add-PSSnapin Microsoft.SharePoint.PowerShell
}

function Write-Step([string]$m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Write-Ok([string]$m) { Write-Host "    [OK] $m" -ForegroundColor Green }
function Write-Note([string]$m) { Write-Host "    [!] $m" -ForegroundColor Yellow }

# ---------------------------------------------------------------- ورودی‌ها
$config = Get-Content $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
$web = Get-SPWeb $config.SiteUrl
$site = $web.Site
$webApp = $site.WebApplication
Write-Host "سایت: $($web.Url)   |   Web Application: $($webApp.Url)"

$runAs = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$hasFull = $false
try { $hasFull = $web.DoesUserHavePermissions([Microsoft.SharePoint.SPBasePermissions]::FullMask) } catch { }
if (-not $hasFull) {
  $claim = "i:0#.w|$($runAs.ToLower())"
  throw @"
حساب «$runAs» روی سایت $($web.Url) دسترسی Full Control ندارد (Access denied).
یکی از دو راه زیر را در همین SharePoint Management Shell اجرا کنید و سپس اسکریپت را دوباره اجرا کنید:

  # راه ۱ (پیشنهادی): Full Control از طریق User Policy وب اپلیکیشن
  `$wa = Get-SPWebApplication "$($webApp.Url)"
  `$p = `$wa.Policies.Add("$claim", "KB Installer")
  `$p.PolicyRoleBindings.Add(`$wa.PolicyRoles.GetSpecialRole("FullControl"))
  `$wa.Update()

  # راه ۲: مدیر دوم Site Collection
  Set-SPSite -Identity "$($site.Url)" -SecondaryOwnerAlias "$runAs"
"@
}
Write-Host "حساب اجرا: $runAs (Full Control ✔)"

$contentList = $web.Lists.TryGetList($config.ContentList)
if (-not $contentList) { Write-Note "لیست «$($config.ContentList)» وجود ندارد؛ ساخته می‌شود." }
$mediaLib = $web.Lists.TryGetList($config.MediaLibrary)
if (-not $mediaLib) { Write-Note "کتابخانه‌ی «$($config.MediaLibrary)» وجود ندارد؛ ساخته می‌شود." }

# ---------------------------------------------------------------- نگاشت ستون‌های لیست محتوا
# Key = نام منطقی در کد | Find = نام‌های داخلی یا عنوان‌هایی که ستون موجود با آن شناسایی می‌شود
# New = ستونی که در صورت نبود ساخته می‌شود
$builtInContentType = [Microsoft.SharePoint.SPBuiltInFieldId]::ContentType
$defaultTypes = @('مقاله', 'ویدیو', 'پادکست', 'راهنما و آموزش', 'گزارش', 'گزارش تصویری', 'سند و فایل', 'خبر', 'اینفوگرافیک', 'پرسش و پاسخ')
$fieldSpec = @(
  @{ Key = 'Title'; Find = @('Title'); New = $null },
  @{ Key = 'Summary'; Find = @('Summary', 'KBSummary', 'خلاصه'); New = @{ Name = 'Summary'; Type = 'Note'; Label = 'خلاصه' } },
  @{ Key = 'Body'; Find = @('Body', 'KBBody', 'متن', 'متن محتوا'); New = @{ Name = 'KBBody'; Type = 'Note'; Label = 'متن محتوا' } },
  @{ Key = 'ThumbnailUrl'; Find = @('ThumbnailUrl', 'Thumbnail', 'KBThumbnail', 'تصویر شاخص'); New = @{ Name = 'ThumbnailUrl'; Type = 'Text'; Label = 'نشانی تصویر شاخص' } },
  @{ Key = 'ContentType'; Find = @('ContentType0', 'ContentType1', 'KBType', 'ContentType', 'نوع محتوا'); New = @{ Name = 'KBType'; Type = 'Choice'; Label = 'نوع محتوا'; Choices = $defaultTypes; FillIn = $true } },
  @{ Key = 'Category'; Find = @('Category', 'KBCategory', 'دسته‌بندی', 'دسته'); New = @{ Name = 'KBCategory'; Type = 'Text'; Label = 'دسته‌بندی' } },
  @{ Key = 'Views'; Find = @('Views', 'KBViews', 'بازدید'); New = @{ Name = 'Views'; Type = 'Number'; Label = 'تعداد بازدید'; Default = '0' } },
  @{ Key = 'ReadingMinutes'; Find = @('ReadingMinutes', 'زمان مطالعه'); New = @{ Name = 'ReadingMinutes'; Type = 'Number'; Label = 'زمان مطالعه (دقیقه)' } },
  @{ Key = 'IsFeatured'; Find = @('IsFeatured', 'Featured', 'ویژه'); New = @{ Name = 'IsFeatured'; Type = 'Boolean'; Label = 'ویژه'; Default = '0' } },
  @{ Key = 'AuthorName'; Find = @('AuthorName', 'نام نویسنده'); New = @{ Name = 'AuthorName'; Type = 'Text'; Label = 'نام نویسنده' } },
  @{ Key = 'AuthorBio'; Find = @('AuthorBio', 'معرفی نویسنده'); New = @{ Name = 'AuthorBio'; Type = 'Note'; Label = 'معرفی نویسنده' } },
  @{ Key = 'AuthorImageUrl'; Find = @('AuthorImageUrl', 'تصویر نویسنده'); New = @{ Name = 'AuthorImageUrl'; Type = 'Text'; Label = 'نشانی تصویر نویسنده' } },
  @{ Key = 'PublishAt'; Find = @('PublishAt', 'PublishDate', 'تاریخ انتشار'); New = @{ Name = 'PublishAt'; Type = 'DateTime'; Label = 'زمان انتشار' } },
  @{ Key = 'Visibility'; Find = @('KBVisibility', 'Visibility', 'سطح دسترسی'); New = @{ Name = 'KBVisibility'; Type = 'Choice'; Label = 'سطح دسترسی (Public = عمومی، Private = فقط کارکنان)'; Choices = @('Public', 'Private'); Default = 'Private'; Indexed = $true } },
  @{ Key = 'Status'; Find = @('KBStatus', 'PublishStatus', 'وضعیت انتشار'); New = @{ Name = 'KBStatus'; Type = 'Choice'; Label = 'وضعیت انتشار (Draft / Published / Archived)'; Choices = @('Draft', 'Published', 'Archived'); Default = 'Draft'; Indexed = $true } },
  @{ Key = 'Tags'; Find = @('KBTags', 'Tags', 'برچسب‌ها'); New = @{ Name = 'KBTags'; Type = 'Text'; Label = 'برچسب‌ها' } },
  @{ Key = 'MediaUrl'; Find = @('KBMediaUrl', 'MediaUrl', 'VideoUrl'); New = @{ Name = 'KBMediaUrl'; Type = 'Text'; Label = 'رسانه‌ی اصلی (ویدیو / صوت)' } },
  @{ Key = 'LikesCount'; Find = @('KBLikes', 'LikesCount', 'Likes'); New = @{ Name = 'KBLikes'; Type = 'Number'; Label = 'تعداد پسند'; Default = '0' } },
  @{ Key = 'CommentsCount'; Find = @('KBCommentsCount', 'CommentsCount'); New = @{ Name = 'KBCommentsCount'; Type = 'Number'; Label = 'تعداد نظر'; Default = '0' } },
  @{ Key = 'AllowComments'; Find = @('KBAllowComments', 'AllowComments'); New = @{ Name = 'KBAllowComments'; Type = 'Boolean'; Label = 'امکان ثبت نظر'; Default = '1' } }
)

function Find-ContentField($list, $spec) {
  if (-not $list) { return $null }
  foreach ($name in $spec.Find) {
    foreach ($f in $list.Fields) {
      if ($spec.Key -eq 'ContentType' -and $f.Id -eq $builtInContentType) { continue }
      if ($f.InternalName -ieq $name) { return $f }
    }
  }
  foreach ($name in $spec.Find) {
    foreach ($f in $list.Fields) {
      if ($spec.Key -eq 'ContentType' -and $f.Id -eq $builtInContentType) { continue }
      if ($f.Title -ieq $name -and -not $f.Hidden) { return $f }
    }
  }
  return $null
}

Write-Step "نگاشت ستون‌های لیست $($config.ContentList)"
foreach ($s in $fieldSpec) {
  $f = Find-ContentField $contentList $s
  if ($f) { Write-Host ("    {0,-16} ← {1} ({2}, {3})" -f $s.Key, $f.InternalName, $f.Title, $f.TypeAsString) }
  else { Write-Host ("    {0,-16} ← [جدید] {1}" -f $s.Key, $s.New.Name) -ForegroundColor DarkYellow }
}
foreach ($s in $fieldSpec) {
  $f = Find-ContentField $contentList $s
  if ($f -and $f.TypeAsString -in @('TaxonomyFieldType', 'TaxonomyFieldTypeMulti', 'MultiChoice', 'LookupMulti')) {
    Write-Note "ستون «$($f.Title)» از نوع $($f.TypeAsString) است؛ نمایش آن پشتیبانی می‌شود ولی ویرایش از پنل خطا می‌دهد. نوع Choice یا متن پیشنهاد می‌شود."
  }
}
if ($WhatIfOnly) { Write-Note 'حالت WhatIfOnly: تغییری اعمال نشد.'; return }

# ---------------------------------------------------------------- ۱. Web Application
Write-Step 'تنظیمات Web Application'
$zone = [Microsoft.SharePoint.Administration.SPUrlZone]$config.Zone
$iis = $webApp.IisSettings[$zone]
if (-not $iis.AllowAnonymous) {
  if ($config.EnableAnonymousOnWebApplication) {
    $iis.AllowAnonymous = $true
    $webApp.Update()
    $webApp.ProvisionGlobally()
    Write-Ok "دسترسی ناشناس روی Zone $($config.Zone) فعال شد (سایت‌های دیگر این Web Application تا وقتی خودشان فعال نکنند ناشناس نمی‌شوند)"
  } else {
    Write-Note "دسترسی ناشناس روی Zone $($config.Zone) خاموش است؛ کاربران عمومی بدون ورود صفحات را نمی‌بینند."
  }
} else { Write-Ok 'دسترسی ناشناس Zone فعال است' }
if (-not $webApp.OutboundMailServiceInstance) {
  Write-Note 'Outgoing E-mail تنظیم نشده؛ ایمیل اطلاع‌رسانی نظرات ارسال نمی‌شود (Central Admin > System Settings > Configure outgoing e-mail settings).'
}

# ---------------------------------------------------------------- ۲. Featureها
Write-Step 'Featureها'
if (Get-SPFeature -Web $web.Url -Identity MDSFeature -ErrorAction SilentlyContinue) {
  Disable-SPFeature -Identity MDSFeature -Url $web.Url -Confirm:$false
  Write-Ok 'Minimal Download Strategy خاموش شد'
}
# کاربر ناشناس در این طراحی از REST استفاده نمی‌کند (همه‌ی داده از KBApi.ashx می‌آید)؛ پس Lockdown Mode
# می‌تواند روشن بماند تا کاربر ناشناس به فرم‌ها و نمای لیست‌ها (DispForm، AllItems و ...) دسترسی نداشته باشد.
$lockdown = Get-SPFeature -Site $site.Url -Identity ViewFormPagesLockDown -ErrorAction SilentlyContinue
if ($config.EnableLockdownMode -and -not $lockdown) {
  Enable-SPFeature -Identity ViewFormPagesLockDown -Url $site.Url
  Write-Ok 'Limited-access user permission lockdown mode روشن شد'
} elseif ($lockdown) { Write-Ok 'Lockdown mode روشن است' } else { Write-Note 'Lockdown mode خاموش است' }

# ---------------------------------------------------------------- ۳. سطح دسترسی و گروه‌ها
Write-Step 'سطح دسترسی و گروه‌ها'
$permEditor = [Microsoft.SharePoint.SPBasePermissions]'ViewListItems, AddListItems, EditListItems, DeleteListItems, OpenItems, ViewVersions, DeleteVersions, ViewFormPages, Open, ViewPages, BrowseDirectories, BrowseUserInfo, UseRemoteAPIs, UseClientIntegration, CreateAlerts'
$rdEditor = $web.RoleDefinitions | Where-Object { $_.Name -eq 'KB Editor' }
if (-not $web.HasUniqueRoleDefinitions -and $web.IsRootWeb -eq $false) { Write-Note 'سطوح دسترسی از سایت والد ارث می‌برند؛ «KB Editor» در سایت ریشه ساخته می‌شود.' }
$rdWeb = if ($web.HasUniqueRoleDefinitions -or $web.IsRootWeb) { $web } else { $site.RootWeb }
$rdEditor = $rdWeb.RoleDefinitions | Where-Object { $_.Name -eq 'KB Editor' }
if (-not $rdEditor) {
  $rdEditor = New-Object Microsoft.SharePoint.SPRoleDefinition
  $rdEditor.Name = 'KB Editor'
  $rdEditor.Description = 'پایگاه دانش: ایجاد، ویرایش و حذف محتوا، رسانه و نظرات'
  $rdEditor.BasePermissions = $permEditor
  $rdWeb.RoleDefinitions.Add($rdEditor)
} else { $rdEditor.BasePermissions = $permEditor; $rdEditor.Update() }
$roleEditor = $web.RoleDefinitions['KB Editor']
$roleRead = $web.RoleDefinitions.GetByType([Microsoft.SharePoint.SPRoleType]::Reader)
$roleFull = $web.RoleDefinitions.GetByType([Microsoft.SharePoint.SPRoleType]::Administrator)
Write-Ok 'KB Editor'

function Ensure-Group([string]$name, [string]$description) {
  $g = $web.SiteGroups | Where-Object { $_.Name -eq $name }
  if (-not $g) {
    $owner = if ($web.AssociatedOwnerGroup) { $web.AssociatedOwnerGroup } else { $site.Owner }
    $web.SiteGroups.Add($name, $owner, $null, $description)
    $g = $web.SiteGroups[$name]
  }
  return $g
}
# DOMAIN\name: اگر نام کامل دامنه‌ی خود سرور (مثل AD.SHASTANGROUP.IR) آمده باشد، به نام کوتاه (NetBIOS) تبدیل می‌شود
function Resolve-Login([string]$login) {
  $login = $login.Trim()
  if ($login -match '^([^\\]+)\\(.+)$') {
    $domain = $Matches[1]; $name = $Matches[2]
    if ($env:USERDNSDOMAIN -and $env:USERDOMAIN -and $domain -ieq $env:USERDNSDOMAIN) { return "$($env:USERDOMAIN)\$name" }
  }
  return $login
}
function Add-Members($group, $logins) {
  foreach ($raw in @($logins)) {
    if ([string]::IsNullOrWhiteSpace($raw)) { continue }
    $login = Resolve-Login $raw
    try { $group.AddUser($web.EnsureUser($login)); Write-Ok "$login → $($group.Name)" }
    catch {
      Write-Note "افزودن $login به $($group.Name) ناموفق بود: $($_.Exception.Message)"
      Write-Note "  → آیا گروه در AD وجود دارد و از نوع Security است؟ بررسی: net group `"$($login.Split('\')[-1])`" /domain"
    }
  }
}
function Grant($securable, $principal, $roleDef) {
  if (-not $principal) { return }
  $ra = New-Object Microsoft.SharePoint.SPRoleAssignment($principal)
  $ra.RoleDefinitionBindings.Add($roleDef)
  $securable.RoleAssignments.Add($ra)
}

$gAdmins = Ensure-Group 'KB-Admins' 'مدیران سامانه‌ی پایگاه دانش (دسترسی کامل)'
$gHR = Ensure-Group 'KB-HR' 'منابع انسانی — مدیریت محتوا، رسانه و نظرات پایگاه دانش'
$gReaders = Ensure-Group 'KB-Readers' 'همه‌ی کارکنان واردشده (مشاهده‌ی محتوای عمومی و خصوصی)'
Add-Members $gAdmins $config.AdminsMembers
Add-Members $gHR $config.HRMembers
Add-Members $gReaders $config.ReadersMembers

if (-not $web.HasUniqueRoleAssignments) { $web.BreakRoleInheritance($true) }
Grant $web $gAdmins $roleFull
Grant $web $gHR $roleRead
Grant $web $gReaders $roleRead
$web.AnonymousState = [Microsoft.SharePoint.SPWeb+WebAnonymousState]::Enabled   # «Lists and libraries»
$web.Update()
# کاربر ناشناس باید بتواند سایت را «باز» کند (لازم برای صفحات و سرویس)؛ حق خواندن هیچ لیستی از این مجوز نمی‌آید
$webAnon = [Microsoft.SharePoint.SPBasePermissions]'Open, ViewPages'
$web.AnonymousPermMask64 = [Microsoft.SharePoint.SPBasePermissions]([UInt64]$web.AnonymousPermMask64 -bor [UInt64]$webAnon)
$web.Update()
Write-Ok 'KB-Admins: Full Control | KB-HR و KB-Readers: Read روی سایت | ناشناس: فقط کتابخانه‌های مشخص'

# ---------------------------------------------------------------- ۴ و ۵. لیست‌ها
Write-Step 'لیست‌ها'
$anonView = [Microsoft.SharePoint.SPBasePermissions]'ViewListItems, OpenItems, Open, ViewPages'

function Get-FieldXml($f) {
  $n = $f.Name
  $label = [Security.SecurityElement]::Escape($f.Label)
  $common = "Name='$n' StaticName='$n' DisplayName='$n'"
  switch ($f.Type) {
    'Text' { return "<Field Type='Text' $common MaxLength='255' />" }
    'Note' { return "<Field Type='Note' $common NumLines='8' RichText='FALSE' UnlimitedLengthInDocumentLibrary='TRUE' />" }
    'Number' { $d = if ($null -ne $f.Default) { "<Default>$($f.Default)</Default>" } else { '' }; return "<Field Type='Number' $common Decimals='0'>$d</Field>" }
    'Boolean' { return "<Field Type='Boolean' $common><Default>$($f.Default)</Default></Field>" }
    'DateTime' { return "<Field Type='DateTime' $common Format='DateTime' />" }
    'Choice' {
      $choices = ($f.Choices | ForEach-Object { "<CHOICE>$([Security.SecurityElement]::Escape([string]$_))</CHOICE>" }) -join ''
      $default = if ($f.Default) { "<Default>$([Security.SecurityElement]::Escape([string]$f.Default))</Default>" } else { '' }
      $fill = if ($f.FillIn) { 'TRUE' } else { 'FALSE' }
      return "<Field Type='Choice' $common Format='Dropdown' FillInChoice='$fill'><CHOICES>$choices</CHOICES>$default</Field>"
    }
  }
  throw "نوع ستون ناشناخته: $($f.Type)"
}

function Ensure-Field($list, $f) {
  if ($f.Name -eq 'Title') {
    $t = $list.Fields.GetFieldByInternalName('Title'); if ($f.Label) { $t.Title = $f.Label; $t.Update() }; return $t
  }
  if (-not $list.Fields.ContainsFieldWithStaticName($f.Name)) {
    [void]$list.Fields.AddFieldAsXml((Get-FieldXml $f), $true, [Microsoft.SharePoint.SPAddFieldOptions]::AddFieldInternalNameHint)
    $field = $list.Fields.GetFieldByInternalName($f.Name)
    $field.Title = $f.Label
    $field.Update()
  }
  $field = $list.Fields.GetFieldByInternalName($f.Name)
  # در SP 2019 ویژگی Indexed برخی ستون‌ها فقط‌نوشتنی است؛ بدون خواندن تنظیم می‌شود
  if ($f.Indexed) { try { $field.Indexed = $true; $field.Update() } catch { Write-Note "ایندکس $($f.Name) در $($list.Title): $($_.Exception.Message)" } }
  return $field
}

function Ensure-List([string]$title, [string]$description, [string]$template) {
  $list = $web.Lists.TryGetList($title)
  if (-not $list) {
    $tpl = if ($template -eq 'DocumentLibrary') { [Microsoft.SharePoint.SPListTemplateType]::DocumentLibrary } else { [Microsoft.SharePoint.SPListTemplateType]::GenericList }
    [void]$web.Lists.Add($title, $description, $tpl)
    $list = $web.Lists[$title]
    $list.OnQuickLaunch = $false
    $list.Update()
    Write-Ok "ایجاد شد: $title"
  }
  return $list
}

# مجوز اختصاصی: فقط اعضای مجاز باقی می‌مانند (گروه‌های قدیمی سایت مثل Members/Visitors حذف می‌شوند)
function Set-Exclusive($list, [hashtable]$grants, [bool]$anonymous) {
  if (-not $list.HasUniqueRoleAssignments) { $list.BreakRoleInheritance($true) }
  $keep = @($grants.Keys)
  $owners = $web.AssociatedOwnerGroup
  if ($owners) { $keep += $owners.Name }
  for ($i = $list.RoleAssignments.Count - 1; $i -ge 0; $i--) {
    $m = $list.RoleAssignments[$i].Member
    if ($keep -notcontains $m.Name) { $list.RoleAssignments.Remove($i) }
  }
  foreach ($name in $grants.Keys) {
    $g = $web.SiteGroups[$name]
    $existing = $null
    try { $existing = $list.RoleAssignments.GetAssignmentByPrincipal($g) } catch { }
    if ($existing) {
      $existing.RoleDefinitionBindings.RemoveAll()
      $existing.RoleDefinitionBindings.Add($grants[$name])
      $existing.Update()
    } else { Grant $list $g $grants[$name] }
  }
  if ($owners) { Grant $list $owners $roleFull }
  $list.AnonymousPermMask64 = if ($anonymous) { $anonView } else { [Microsoft.SharePoint.SPBasePermissions]::EmptyMask }
  $list.Update()
}

# --- لیست محتوا
$contentList = Ensure-List $config.ContentList 'محتوای پایگاه دانش' 'GenericList'
$contentList.EnableAttachments = $true
$contentList.EnableVersioning = $true
if ($contentList.MajorVersionLimit -eq 0 -or $contentList.MajorVersionLimit -gt 100) { $contentList.MajorVersionLimit = 50 }
$contentList.Update()
if ($contentList.EnableModeration) { Write-Note "Content Approval روی $($config.ContentList) روشن است؛ پایگاه دانش از ستون «وضعیت انتشار» استفاده می‌کند و این تنظیم لازم نیست." }
$fieldMap = [ordered]@{}
foreach ($s in $fieldSpec) {
  $f = Find-ContentField $contentList $s
  if (-not $f) {
    $f = Ensure-Field $contentList $s.New
    Write-Ok "ستون جدید: $($s.New.Name) ($($s.New.Label))"
  } elseif ($s.New -and $s.New.Indexed) {
    try { $f.Indexed = $true; $f.Update() } catch { }
  }
  $fieldMap[$s.Key] = $f.InternalName
  $view = $contentList.DefaultView
  if ($f.TypeAsString -ne 'Note' -and -not $view.ViewFields.Exists($f.InternalName)) { $view.ViewFields.Add($f); $view.Update() }
}
Set-Exclusive $contentList @{ 'KB-Admins' = $roleFull; 'KB-HR' = $roleEditor } $false
Write-Ok "$($config.ContentList): فقط KB-Admins و KB-HR (کاربران و ناشناس فقط از طریق KBApi.ashx و فقط محتوای منتشرشده)"

# --- لیست‌های کمکی
function Ensure-SimpleList([string]$title, [string]$description, $fields) {
  $l = Ensure-List $title $description 'GenericList'
  foreach ($f in $fields) { [void](Ensure-Field $l $f) }
  $l.EnableVersioning = $false
  $l.Update()
  return $l
}
$catList = Ensure-SimpleList 'KBCategories' 'دسته‌بندی‌های پایگاه دانش' @(
  @{ Name = 'Title'; Label = 'عنوان دسته' },
  @{ Name = 'Icon'; Type = 'Text'; Label = 'آیکن' },
  @{ Name = 'Color'; Type = 'Text'; Label = 'رنگ' },
  @{ Name = 'Description'; Type = 'Note'; Label = 'توضیح' },
  @{ Name = 'SortOrder'; Type = 'Number'; Label = 'ترتیب' },
  @{ Name = 'IsActive'; Type = 'Boolean'; Label = 'فعال'; Default = '1' })
$commentsList = Ensure-SimpleList 'KBComments' 'نظرات کاربران پایگاه دانش' @(
  @{ Name = 'Title'; Label = 'خلاصه' },
  @{ Name = 'ContentId'; Type = 'Number'; Label = 'شناسه‌ی محتوا'; Indexed = $true },
  @{ Name = 'ParentId'; Type = 'Number'; Label = 'پاسخ به'; Default = '0'; Indexed = $true },
  @{ Name = 'Body'; Type = 'Note'; Label = 'متن نظر' },
  @{ Name = 'AuthorName'; Type = 'Text'; Label = 'نام کاربر' },
  @{ Name = 'AuthorLogin'; Type = 'Text'; Label = 'حساب کاربری'; Indexed = $true },
  @{ Name = 'Status'; Type = 'Choice'; Label = 'وضعیت'; Choices = @('Approved', 'Pending', 'Hidden'); Default = 'Approved'; Indexed = $true },
  @{ Name = 'IsStaff'; Type = 'Boolean'; Label = 'پاسخ تیم محتوا'; Default = '0' },
  @{ Name = 'SourceIp'; Type = 'Text'; Label = 'IP' })
$reactionsList = Ensure-SimpleList 'KBReactions' 'پسندها و ذخیره‌های کاربران' @(
  @{ Name = 'Title'; Label = 'عنوان محتوا' },
  @{ Name = 'ContentId'; Type = 'Number'; Label = 'شناسه‌ی محتوا'; Indexed = $true },
  @{ Name = 'UserKey'; Type = 'Text'; Label = 'کاربر'; Indexed = $true },
  @{ Name = 'Kind'; Type = 'Choice'; Label = 'نوع'; Choices = @('Like', 'Bookmark'); Default = 'Like'; Indexed = $true })
$settingsList = Ensure-SimpleList 'KBSettings' 'تنظیمات پایگاه دانش (کلید / مقدار)' @(
  @{ Name = 'Title'; Label = 'کلید' },
  @{ Name = 'Value'; Type = 'Note'; Label = 'مقدار' })
$auditList = Ensure-SimpleList 'KBAuditLog' 'گزارش فعالیت مدیریت محتوا' @(
  @{ Name = 'Title'; Label = 'عنوان' },
  @{ Name = 'Action'; Type = 'Text'; Label = 'عملیات'; Indexed = $true },
  @{ Name = 'ContentId'; Type = 'Number'; Label = 'شناسه‌ی محتوا'; Indexed = $true },
  @{ Name = 'Actor'; Type = 'Text'; Label = 'کاربر' },
  @{ Name = 'Details'; Type = 'Note'; Label = 'توضیحات' })

Set-Exclusive $catList @{ 'KB-Admins' = $roleFull; 'KB-HR' = $roleEditor } $false
Set-Exclusive $commentsList @{ 'KB-Admins' = $roleFull; 'KB-HR' = $roleEditor } $false
Set-Exclusive $reactionsList @{ 'KB-Admins' = $roleFull; 'KB-HR' = $roleRead } $false
Set-Exclusive $settingsList @{ 'KB-Admins' = $roleFull; 'KB-HR' = $roleRead } $false
Set-Exclusive $auditList @{ 'KB-Admins' = $roleFull; 'KB-HR' = $roleRead } $false
Write-Ok 'KBCategories، KBComments، KBReactions، KBSettings، KBAuditLog (بدون دسترسی مستقیم کاربران و ناشناس)'

# ---------------------------------------------------------------- ۶. کتابخانه‌ها
Write-Step 'کتابخانه‌ها'
function Set-Library($lib, [bool]$anonymous, $hrRole) {
  if (-not $lib.HasUniqueRoleAssignments) { $lib.BreakRoleInheritance($true) }
  Grant $lib $gAdmins $roleFull
  if ($hrRole) { Grant $lib $gHR $hrRole }
  $lib.AnonymousPermMask64 = if ($anonymous) { $anonView } else { [Microsoft.SharePoint.SPBasePermissions]::EmptyMask }
  # نسخه‌ی فرعی (پیش‌نویس) و Check-out اجباری باعث می‌شود فایل تازه برای ناشناس دیده نشود
  if ($lib.BaseType -eq [Microsoft.SharePoint.SPBaseType]::DocumentLibrary) { $lib.ForceCheckout = $false; $lib.EnableMinorVersions = $false }
  if ($anonymous -and $lib.EnableModeration) { Write-Note "Content Approval روی $($lib.Title) روشن است؛ فایل‌ها تا تأیید برای ناشناس دیده نمی‌شوند." }
  $lib.Update()
}
$pagesLib = Ensure-List 'KBPages' 'صفحات عمومی پایگاه دانش' 'DocumentLibrary'
$panelLib = Ensure-List 'KBPanel' 'صفحه‌ی پنل مدیریت محتوا (بدون دسترسی ناشناس)' 'DocumentLibrary'
$assetsLib = Ensure-List 'KBAssets' 'فایل‌های قالب پایگاه دانش (CSS، JS، فونت)' 'DocumentLibrary'
$mediaLib = Ensure-List $config.MediaLibrary 'کتابخانه‌ی رسانه‌ی عمومی پایگاه دانش' 'DocumentLibrary'
Set-Library $pagesLib $true $null
Set-Library $panelLib $false $null
Set-Library $assetsLib $true $null
Set-Library $mediaLib $true $roleEditor
Write-Ok 'KBPages و KBAssets: عمومی (فقط مشاهده) | KBPanel: بدون دسترسی ناشناس'
Write-Ok "$($config.MediaLibrary): عمومی (فقط مشاهده) + KB-HR ویرایش — همه‌ی فایل‌های این کتابخانه بدون ورود قابل دریافت‌اند"

$mpg = $site.GetCatalog([Microsoft.SharePoint.SPListTemplateType]::MasterPageCatalog)
if (-not $mpg.HasUniqueRoleAssignments) { $mpg.BreakRoleInheritance($true) }
$mpg.AnonymousPermMask64 = $anonView
$mpg.Update()
if (-not $web.IsRootWeb) {
  $rw = $site.RootWeb
  if ($rw.AnonymousState -eq [Microsoft.SharePoint.SPWeb+WebAnonymousState]::Disabled) { $rw.AnonymousState = [Microsoft.SharePoint.SPWeb+WebAnonymousState]::Enabled }
  $rw.AnonymousPermMask64 = [Microsoft.SharePoint.SPBasePermissions]([UInt64]$rw.AnonymousPermMask64 -bor [UInt64]$webAnon)
  $rw.Update()
  Write-Note 'پایگاه دانش زیرسایت است؛ دسترسی ناشناس سایت ریشه روی «فقط لیست‌ها و کتابخانه‌های مشخص» تنظیم شد تا مستر پیج قابل خواندن باشد.'
}
Write-Ok 'Master Page Gallery: قابل خواندن برای ناشناس'

# ---------------------------------------------------------------- ۷. داده‌های پایه
Write-Step 'داده‌های پایه'
function Find-Item($list, [string]$field, [string]$value) {
  $q = New-Object Microsoft.SharePoint.SPQuery
  $q.Query = "<Where><Eq><FieldRef Name='$field' /><Value Type='Text'>$([Security.SecurityElement]::Escape($value))</Value></Eq></Where>"
  $q.RowLimit = 1
  $r = $list.GetItems($q)
  if ($r.Count) { return $r[0] } else { return $null }
}
function Set-Setting([string]$key, [string]$value, [bool]$overwrite) {
  $it = Find-Item $settingsList 'Title' $key
  if ($it -and -not $overwrite) { return }
  if (-not $it) { $it = $settingsList.AddItem(); $it['Title'] = $key }
  $it['Value'] = $value
  $it.Update()
}
Set-Setting 'ContentList' $config.ContentList $true
Set-Setting 'MediaLibrary' $config.MediaLibrary $true
Set-Setting 'FieldMap' ($fieldMap | ConvertTo-Json -Compress) $true
Set-Setting 'SiteTitle' $config.SiteTitle $false
Set-Setting 'SiteSubtitle' $config.SiteSubtitle $false
Set-Setting 'CommentsEnabled' 'true' $false
Set-Setting 'CommentModeration' $config.CommentModeration $false
Set-Setting 'NotifyEmails' $config.NotifyEmails $false
Set-Setting 'DefaultVisibility' $config.DefaultVisibility $false
Write-Ok 'KBSettings (نگاشت ستون‌ها: FieldMap)'

$i = 0
foreach ($c in $config.Categories) {
  $i++
  if (-not (Find-Item $catList 'Title' $c.Title)) {
    $it = $catList.AddItem()
    $it['Title'] = $c.Title; $it['Icon'] = $c.Icon; $it['Color'] = $c.Color; $it['Description'] = $c.Description
    $it['SortOrder'] = $i * 10; $it['IsActive'] = $true
    $it.Update()
  }
}
Write-Ok "دسته‌بندی‌ها ($($config.Categories.Count))"

# محتوای موجود: وضعیت و سطح دسترسی خالی مقداردهی می‌شود (فقط یک‌بار؛ مقادیر موجود تغییر نمی‌کنند)
$statusField = $fieldMap['Status']; $visField = $fieldMap['Visibility']
$fixed = 0
$q = New-Object Microsoft.SharePoint.SPQuery
$q.ViewAttributes = "Scope='Recursive'"
$q.RowLimit = 1000
do {
  $items = $contentList.GetItems($q)
  foreach ($it in $items) {
    $changed = $false
    if ([string]::IsNullOrEmpty([string]$it[$statusField])) { $it[$statusField] = $config.ExistingItemsStatus; $changed = $true }
    if ([string]::IsNullOrEmpty([string]$it[$visField])) { $it[$visField] = $config.ExistingItemsVisibility; $changed = $true }
    if ($changed) { $it.SystemUpdate($false); $fixed++ }
  }
  $q.ListItemCollectionPosition = $items.ListItemCollectionPosition
} while ($q.ListItemCollectionPosition)
Write-Ok "محتوای موجود: $fixed مورد با وضعیت «$($config.ExistingItemsStatus)» و دسترسی «$($config.ExistingItemsVisibility)» مقداردهی شد"

# ---------------------------------------------------------------- ۸. صفحه‌ی خانه
if ($config.SetWelcomePage) {
  Write-Step 'صفحه‌ی خانه'
  $rootFolder = $web.RootFolder
  $rootFolder.WelcomePage = 'KBPages/index.aspx'
  $rootFolder.Update()
  Write-Ok "صفحه‌ی خانه‌ی $($web.Url) = KBPages/index.aspx"
}

$web.Dispose(); $site.Dispose()
Write-Host "`nنصب کامل شد. گام‌های بعد:  .\Install-KBLayouts.ps1  (روی همه‌ی سرورهای وب)  و  .\Deploy-KBFiles.ps1" -ForegroundColor Green
