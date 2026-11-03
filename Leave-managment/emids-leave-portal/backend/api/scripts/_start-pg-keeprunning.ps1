$apiDir = "C:\Users\padigapatir\Downloads\Leave-mangement-model2\Leave-managment\emids-leave-portal\backend\api"
$dataDir = Join-Path $apiDir ".test-data"
$pgCtl = Join-Path $apiDir "tools\pgsql\bin\pg_ctl.exe"
$listening = $null -ne (Get-NetTCPConnection -LocalPort 55432 -State Listen -ErrorAction SilentlyContinue)
if (-not $listening) {
  & $pgCtl -D $dataDir -l (Join-Path $dataDir "server.log") -o "-p 55432 -c listen_addresses=127.0.0.1" start
  for ($i = 0; $i -lt 60; $i++) {
    if ($null -ne (Get-NetTCPConnection -LocalPort 55432 -State Listen -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Milliseconds 500
  }
}
Get-NetTCPConnection -LocalPort 55432 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 | Out-Null
Write-Host ("LISTENING=" + ($null -ne (Get-NetTCPConnection -LocalPort 55432 -State Listen -ErrorAction SilentlyContinue)))
