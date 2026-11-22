<#
  توابع مشترک اسکریپت‌های پایگاه دانش (با dot-source بارگذاری می‌شود).
#>

# Zone وب‌اپلیکیشن برای نشانی سایت: اگر Zone در kb.config.json خالی یا «Auto» باشد از Alternate Access Mapping پیدا می‌شود.
function Resolve-KBZone($webApp, $config) {
  $name = [string]$config.Zone
  if ($name -and $name -ne 'Auto') { return [Microsoft.SharePoint.Administration.SPUrlZone]$name }
  $u = [Uri]([string]$config.SiteUrl)
  $hostOnly = $null
  foreach ($a in $webApp.AlternateUrls) {
    if (-not $a.Uri) { continue }
    if ($a.Uri.Host -ieq $u.Host) {
      if ($a.Uri.Scheme -ieq $u.Scheme -and $a.Uri.Port -eq $u.Port) { return $a.UrlZone }
      if (-not $hostOnly) { $hostOnly = $a.UrlZone }
    }
  }
  if ($hostOnly) { return $hostOnly }
  Write-Host "    [!] نشانی $($config.SiteUrl) در Alternate Access Mapping وب‌اپلیکیشن $($webApp.Url) پیدا نشد؛ Zone = Default" -ForegroundColor Yellow
  return [Microsoft.SharePoint.Administration.SPUrlZone]::Default
}

# فهرست نشانی‌های AAM وب‌اپلیکیشن (برای نمایش)
function Show-KBAlternateUrls($webApp) {
  foreach ($a in ($webApp.AlternateUrls | Sort-Object { [int]$_.UrlZone })) {
    Write-Host ("    {0,-10} {1}" -f $a.UrlZone, $a.IncomingUrl)
  }
}
