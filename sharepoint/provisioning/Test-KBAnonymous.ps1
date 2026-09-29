<#
.SYNOPSIS
  بررسی دسترسی‌ها: درخواست‌ها بدون ورود (مثل مرورگر کاربر عمومی) و سپس با حساب فعلی ارسال می‌شوند.
.DESCRIPTION
  «مورد انتظار» هر آدرس نوشته شده؛ هر ردیف ✖ یعنی تنظیمات کامل نیست. خروجی را برای بررسی ارسال کنید.
#>
param([string]$ConfigPath = (Join-Path $PSScriptRoot 'kb.config.json'))
$config = Get-Content $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
$base = $config.SiteUrl.TrimEnd('/')
$api = "$base/_layouts/15/KB/KBApi.ashx"
$rest = "$base/_api/web/lists/getbytitle"

function Probe($name, $url, $expect, [switch]$Auth, [string]$Contains) {
  $status = 0; $detail = ''
  try {
    $p = @{ Uri = $url; UseBasicParsing = $true; MaximumRedirection = 0; ErrorAction = 'Stop'; Headers = @{ Accept = 'application/json;odata=nometadata' } }
    if ($Auth) { $p.UseDefaultCredentials = $true }
    $r = Invoke-WebRequest @p
    $status = [int]$r.StatusCode
    if ($Contains -and $r.Content -notmatch [regex]::Escape($Contains)) { $detail = "پاسخ شامل «$Contains» نیست"; $status = -1 }
    elseif ($url -like '*KBApi.ashx*') { $detail = ($r.Content.Substring(0, [Math]::Min(90, $r.Content.Length))) }
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $status = [int]$resp.StatusCode
      try { $body = (New-Object IO.StreamReader($resp.GetResponseStream())).ReadToEnd(); if ($body -match '"message"\s*:\s*"([^"]+)"') { $detail = $Matches[1] } } catch { }
    } else { $detail = $_.Exception.Message }
  }
  $ok = if ($expect -eq 'deny') { $status -in 302, 401, 403 } else { $status -eq $expect }
  $mark = if ($ok) { '✔' } else { '✖' }
  $color = if ($ok) { 'Green' } else { 'Red' }
  $exp = if ($expect -eq 'deny') { '401/403' } else { $expect }
  Write-Host ("{0} {1,-44} {2,4}  (انتظار: {3})  {4}" -f $mark, $name, $status, $exp, $detail) -ForegroundColor $color
  return $ok
}

Write-Host "`n--- کاربر ناشناس (بدون ورود)" -ForegroundColor Cyan
$results = @(
  (Probe 'صفحه‌ی اصلی' "$base/KBPages/index.aspx" 200),
  (Probe 'فایل CSS قالب' "$base/KBAssets/css/kb.css" 200),
  (Probe 'سرویس: bootstrap' "$api`?action=bootstrap" 200 -Contains '"anonymous":true'),
  (Probe 'سرویس: فهرست محتوای عمومی' "$api`?action=list&size=1" 200 -Contains '"items"'),
  (Probe 'پنل مدیریت (نباید باز شود)' "$base/KBPanel/panel.aspx" 'deny'),
  (Probe 'نمای لیست محتوا (نباید باز شود)' "$base/Lists/$($config.ContentList)/AllItems.aspx" 'deny'),
  (Probe 'REST لیست محتوا (نباید باز شود)' "$rest('$($config.ContentList)')/items?`$top=1" 'deny'),
  (Probe 'REST تنظیمات (نباید باز شود)' "$rest('KBSettings')/items?`$top=1" 'deny'),
  (Probe 'سرویس: پنل مدیریت (نباید باز شود)' "$api`?action=admin-meta" 'deny')
)
Write-Host "`n--- حساب فعلی ($([Security.Principal.WindowsIdentity]::GetCurrent().Name))" -ForegroundColor Cyan
$results += (Probe 'سرویس: bootstrap با ورود' "$api`?action=bootstrap" 200 -Auth -Contains '"anonymous":false')

$fail = @($results | Where-Object { -not $_ }).Count
if ($fail) { Write-Host "`n$fail مورد مطابق انتظار نبود؛ بخش «رفع اشکال» راهنمای استقرار را ببینید." -ForegroundColor Yellow }
else { Write-Host "`nدسترسی‌ها درست تنظیم شده‌اند." -ForegroundColor Green }
