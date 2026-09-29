<#
.SYNOPSIS
  بارگذاری مستر پیج، صفحات و فایل‌های قالب پایگاه دانش در سایت شیرپوینت.

.DESCRIPTION
  از داخل پوشه‌ی sharepoint\provisioning اجرا شود. هر بار که قالب یا کدها تغییر کرد، همین اسکریپت را دوباره اجرا کنید.
    ..\masterpage\kb.master   → /_catalogs/masterpage/kb.master   (Site Collection)
    ..\KBPages\*.aspx         → /KBPages          (عمومی)
    ..\KBPanel\*.aspx         → /KBPanel          (فقط کاربران واردشده)
    ..\KBAssets\**            → /KBAssets         (CSS، JS، فونت، تصویر)
  در فایل‌های .master و .aspx عبارت {{site}} با مسیر سایت و {{v}} با نسخه (برای شکستن Cache مرورگر) جایگزین
  و با UTF-8 همراه BOM ذخیره می‌شوند (بدون BOM، ASP.NET متن فارسی را خراب نمایش می‌دهد).
#>
[CmdletBinding()]
param([string]$ConfigPath = (Join-Path $PSScriptRoot 'kb.config.json'))

$ErrorActionPreference = 'Stop'
if (-not (Get-PSSnapin Microsoft.SharePoint.PowerShell -ErrorAction SilentlyContinue)) {
  Add-PSSnapin Microsoft.SharePoint.PowerShell
}
$config = Get-Content $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
$package = Split-Path $PSScriptRoot -Parent
$web = Get-SPWeb $config.SiteUrl
$site = $web.Site
$webRel = $web.ServerRelativeUrl.TrimEnd('/')
$siteRel = $site.ServerRelativeUrl.TrimEnd('/')
$version = Get-Date -Format 'yyyyMMddHHmm'

$runAs = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$hasFull = $false
try { $hasFull = $web.DoesUserHavePermissions([Microsoft.SharePoint.SPBasePermissions]::FullMask) } catch { }
if (-not $hasFull) { throw "حساب «$runAs» روی $($web.Url) دسترسی Full Control ندارد؛ راهنمای رفع در خروجی Install-KBPortal.ps1 آمده است." }
foreach ($lib in @('KBPages', 'KBPanel', 'KBAssets')) {
  if (-not $web.Lists.TryGetList($lib)) { throw "کتابخانه‌ی $lib وجود ندارد؛ ابتدا Install-KBPortal.ps1 را اجرا کنید." }
}

$utf8Bom = New-Object System.Text.UTF8Encoding($true)
function Get-Bytes([IO.FileInfo]$file) {
  if ($file.Extension -in @('.master', '.aspx')) {
    $text = [IO.File]::ReadAllText($file.FullName, [Text.Encoding]::UTF8)
    $text = $text.Replace('{{site}}', $webRel).Replace('{{v}}', $version)
    $bytes = $utf8Bom.GetPreamble() + $utf8Bom.GetBytes($text.TrimStart([char]0xFEFF))
    return [byte[]]$bytes
  }
  return [IO.File]::ReadAllBytes($file.FullName)
}

function Publish-File($file) {
  if ($file.CheckOutType -ne [Microsoft.SharePoint.SPFile+SPCheckOutType]::None) {
    $file.CheckIn('KB deploy', [Microsoft.SharePoint.SPCheckinType]::MajorCheckIn)
  }
  $list = $file.Item.ParentList
  if ($list.EnableMinorVersions -and $file.Level -ne [Microsoft.SharePoint.SPFileLevel]::Published) { $file.Publish('KB deploy') }
  if ($list.EnableModeration -and $file.Item.ModerationInformation.Status -ne [Microsoft.SharePoint.SPModerationStatusType]::Approved) { $file.Approve('KB deploy') }
}

function Get-Folder([string]$serverRelativeUrl) {
  $folder = $web.GetFolder($serverRelativeUrl)
  if ($folder.Exists) { return $folder }
  $parent = Get-Folder ($serverRelativeUrl.Substring(0, $serverRelativeUrl.LastIndexOf('/')))
  return $parent.SubFolders.Add($serverRelativeUrl)
}

function Upload-Directory([string]$localDir, [string]$targetUrl, $targetWeb) {
  if (-not (Test-Path $localDir)) { throw "پوشه یافت نشد: $localDir" }
  $root = (Resolve-Path $localDir).Path.TrimEnd('\')
  $count = 0
  Get-ChildItem $root -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($root.Length).TrimStart('\').Replace('\', '/')
    $dest = "$targetUrl/$rel"
    $folder = $targetWeb.GetFolder($dest.Substring(0, $dest.LastIndexOf('/')))
    if (-not $folder.Exists) { $folder = Get-Folder ($dest.Substring(0, $dest.LastIndexOf('/'))) }
    $existing = $targetWeb.GetFile($dest)
    if ($existing.Exists -and $existing.CheckOutType -eq [Microsoft.SharePoint.SPFile+SPCheckOutType]::None -and $existing.Item -and $existing.Item.ParentList.ForceCheckout) {
      $existing.CheckOut()
    }
    $file = $folder.Files.Add($dest, (Get-Bytes $_), $true)
    Publish-File $file
    $count++
  }
  Write-Host "    [OK] $count فایل → $targetUrl" -ForegroundColor Green
}

Write-Host "`n==> مستر پیج" -ForegroundColor Cyan
$rootWeb = $site.RootWeb
$mpFile = Get-Item (Join-Path $package 'masterpage\kb.master')
$gallery = $rootWeb.GetFolder("$siteRel/_catalogs/masterpage")
$existing = $rootWeb.GetFile("$siteRel/_catalogs/masterpage/kb.master")
if ($existing.Exists -and $existing.CheckOutType -eq [Microsoft.SharePoint.SPFile+SPCheckOutType]::None -and $existing.Item.ParentList.ForceCheckout) { $existing.CheckOut() }
$mp = $gallery.Files.Add("$siteRel/_catalogs/masterpage/kb.master", (Get-Bytes $mpFile), $true)
Publish-File $mp
Write-Host "    [OK] $siteRel/_catalogs/masterpage/kb.master" -ForegroundColor Green

Write-Host "`n==> فایل‌های قالب (CSS، JS، فونت، تصویر)" -ForegroundColor Cyan
Upload-Directory (Join-Path $package 'KBAssets') "$webRel/KBAssets" $web

Write-Host "`n==> صفحات عمومی" -ForegroundColor Cyan
Upload-Directory (Join-Path $package 'KBPages') "$webRel/KBPages" $web

Write-Host "`n==> صفحه‌ی پنل" -ForegroundColor Cyan
Upload-Directory (Join-Path $package 'KBPanel') "$webRel/KBPanel" $web

# پاک کردن Cache تنظیمات هندلر روی این سرور (سایر سرورها حداکثر ۲ دقیقه بعد خودکار به‌روز می‌شوند)
try { Invoke-WebRequest -Uri "$($web.Url)/_layouts/15/KB/KBApi.ashx?action=bootstrap" -UseDefaultCredentials -UseBasicParsing | Out-Null } catch { }

$web.Dispose(); $site.Dispose()
Write-Host "`nاستقرار کامل شد: $($config.SiteUrl)   (نسخه‌ی $version)" -ForegroundColor Green
Write-Host "بررسی دسترسی ناشناس:  .\Test-KBAnonymous.ps1" -ForegroundColor Green
