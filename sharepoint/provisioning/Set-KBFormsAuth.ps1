<#
.SYNOPSIS
  فعال‌سازی ورود با صفحه‌ی اختصاصی (Forms + LDAP روی Active Directory) برای پایگاه دانش.

.DESCRIPTION
  پیش‌نیاز: Providerهای KBLdapMember و KBLdapRole در سه web.config ثبت شده باشند (docs/03-registration-and-login.md).
  این اسکریپت:
    1. وجود Providerها را در web.config وب‌اپلیکیشن و Security Token Service بررسی می‌کند (بدون آن‌ها تغییری نمی‌دهد)
    2. روی Zone، احراز هویت Windows (برای شبکه‌ی داخلی و Crawl) + Forms (LDAP) را تنظیم می‌کند
    3. صفحه‌ی ورود اختصاصی /_layouts/15/KB/login.aspx را تعیین می‌کند
    4. به گروه KB-Readers «همه‌ی کاربران Forms» و به KB-HR / KB-Admins گروه‌های AD متناظر (Role Claim) را اضافه می‌کند
  کاربر Forms و کاربر Windows از دید شیرپوینت دو هویت جدا هستند؛ مجوزها از طریق همین گروه‌ها به هر دو داده می‌شود.

.EXAMPLE
  .\Set-KBFormsAuth.ps1 -WhatIfOnly
  .\Set-KBFormsAuth.ps1
#>
[CmdletBinding()]
param(
  [string]$ConfigPath = (Join-Path $PSScriptRoot 'kb.config.json'),
  [string]$MembershipProvider = 'KBLdapMember',
  [string]$RoleProvider = 'KBLdapRole',
  [string]$SignInPage = '/_layouts/15/KB/login.aspx',
  [switch]$WhatIfOnly
)
$ErrorActionPreference = 'Stop'
if (-not (Get-PSSnapin Microsoft.SharePoint.PowerShell -ErrorAction SilentlyContinue)) { Add-PSSnapin Microsoft.SharePoint.PowerShell }
function Write-Ok([string]$m) { Write-Host "    [OK] $m" -ForegroundColor Green }
function Write-Note([string]$m) { Write-Host "    [!] $m" -ForegroundColor Yellow }

$config = Get-Content $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
$web = Get-SPWeb $config.SiteUrl
$wa = $web.Site.WebApplication
$zone = [Microsoft.SharePoint.Administration.SPUrlZone]$config.Zone
Write-Host "Web Application: $($wa.Url)   Zone: $zone"

# ---------------------------------------------------------------- ۱. بررسی Providerها در web.config
$problems = @()
$iisPath = $wa.IisSettings[$zone].Path.FullName
$appConfig = Join-Path $iisPath 'web.config'
$stsConfig = Join-Path ([Microsoft.SharePoint.Utilities.SPUtility]::GetVersionedGenericSetupPath('WebServices\SecurityToken', 15)) 'web.config'
foreach ($file in @($appConfig, $stsConfig)) {
  $text = Get-Content $file -Raw
  foreach ($p in @($MembershipProvider, $RoleProvider)) {
    if ($text -notmatch ('name="' + [regex]::Escape($p) + '"')) { $problems += "Provider «$p» در $file ثبت نشده است." }
  }
}
if ($problems) {
  $problems | ForEach-Object { Write-Note $_ }
  throw "ابتدا Providerها را طبق docs/03-registration-and-login.md (بخش ۴) در web.config ها (روی همه‌ی سرورهای وب) اضافه کنید. تغییری اعمال نشد."
}
Write-Ok "Providerهای $MembershipProvider و $RoleProvider در web.config وب‌اپلیکیشن و STS ثبت شده‌اند"
Write-Note "web.config سایت Central Administration را هم (برای People Picker) طبق راهنما به‌روز کنید."

# Role Claim گروه‌های AD برای KB-HR و KB-Admins (نام گروه بعد از «\»)
function Get-RoleClaims($logins) {
  @($logins) | Where-Object { $_ -and $_ -match '\\' } | ForEach-Object { "c:0-.f|$($RoleProvider.ToLower())|$($_.Split('\')[-1].ToLower())" }
}
$plan = @{
  'KB-Readers' = @("c:0(.s|forms:$($MembershipProvider.ToLower())")
  'KB-HR' = @(Get-RoleClaims $config.HRMembers)
  'KB-Admins' = @(Get-RoleClaims $config.AdminsMembers)
}
Write-Host "`nبرنامه:"
Write-Host "    احراز هویت Zone $zone : Windows (NTLM) + Forms ($MembershipProvider / $RoleProvider)"
Write-Host "    صفحه‌ی ورود: $SignInPage"
foreach ($g in $plan.Keys) { foreach ($c in $plan[$g]) { Write-Host "    $g ← $c" } }
if ($WhatIfOnly) { Write-Note 'حالت WhatIfOnly: تغییری اعمال نشد.'; return }

# ---------------------------------------------------------------- ۲ و ۳. Zone و صفحه‌ی ورود
$win = New-SPAuthenticationProvider -UseWindowsIntegratedAuthentication -DisableKerberos
$fba = New-SPAuthenticationProvider -ASPNETMembershipProvider $MembershipProvider -ASPNETRoleProviderName $RoleProvider
Set-SPWebApplication -Identity $wa -Zone $zone -AuthenticationProvider @($win, $fba) -SignInRedirectURL $SignInPage
Write-Ok "Zone $zone : Windows + Forms، صفحه‌ی ورود $SignInPage"

# ---------------------------------------------------------------- ۴. گروه‌ها
$web = Get-SPWeb $config.SiteUrl
foreach ($g in $plan.Keys) {
  $group = $web.SiteGroups | Where-Object { $_.Name -eq $g }
  if (-not $group) { Write-Note "گروه $g یافت نشد؛ ابتدا Install-KBPortal.ps1 را اجرا کنید."; continue }
  foreach ($claim in $plan[$g]) {
    try { $group.AddUser($web.EnsureUser($claim)); Write-Ok "$claim → $g" }
    catch { Write-Note "افزودن $claim به $g ناموفق بود: $($_.Exception.Message)" }
  }
}
$web.Dispose()
Write-Host "`nانجام شد. تست: پنجره‌ی InPrivate → «ورود» → صفحه‌ی ورود اختصاصی → نام کاربری AD (بدون دامنه) و رمز." -ForegroundColor Green
