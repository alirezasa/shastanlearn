<#
.SYNOPSIS
  کپی سرویس سمت سرور پایگاه دانش در پوشه‌ی LAYOUTS شیرپوینت — روی «همه‌ی» سرورهای وب (WFE) فارم اجرا شود.

.DESCRIPTION
  ..\layouts\KB\KBApi.ashx  →  %CommonProgramFiles%\microsoft shared\Web Server Extensions\16\TEMPLATE\LAYOUTS\KB\
  آدرس: http://<site>/_layouts/15/KB/KBApi.ashx
  ASP.NET فایل را در اولین درخواست کامپایل می‌کند؛ Visual Studio یا WSP لازم نیست.
  پس از هر به‌روزرسانی فایل، ASP.NET خودکار دوباره کامپایل می‌کند (نیازی به IISReset نیست).
#>
$ErrorActionPreference = 'Stop'
if (-not (Get-PSSnapin Microsoft.SharePoint.PowerShell -ErrorAction SilentlyContinue)) {
  Add-PSSnapin Microsoft.SharePoint.PowerShell
}
$source = Join-Path (Split-Path $PSScriptRoot -Parent) 'layouts\KB'
$target = [Microsoft.SharePoint.Utilities.SPUtility]::GetVersionedGenericSetupPath('TEMPLATE\LAYOUTS\KB', 15)
New-Item -ItemType Directory -Force -Path $target | Out-Null
$utf8Bom = New-Object System.Text.UTF8Encoding($true)
Get-ChildItem $source -File | ForEach-Object {
  $dest = Join-Path $target $_.Name
  if ($_.Extension -in @('.ashx', '.aspx')) {
    # UTF-8 با BOM؛ بدون آن پیام‌های فارسی سرویس خراب می‌شوند
    $text = [IO.File]::ReadAllText($_.FullName, [Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
    [IO.File]::WriteAllText($dest, $text, $utf8Bom)
  } else { Copy-Item $_.FullName $dest -Force }
}
Write-Host "[OK] $source → $target" -ForegroundColor Green
Write-Host "این اسکریپت را روی سایر سرورهای وب (WFE) فارم هم اجرا کنید." -ForegroundColor Yellow
