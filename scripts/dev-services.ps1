<#
dev-services.ps1 - kelola dev server Next.js (port 3100) dan MCP HTTP (port 3110) sekaligus.

Pemakaian (dari root repo):
  npm run services -- status
  npm run services -- start
  npm run services -- restart
  npm run services -- stop

Perilaku:
  status   Tampilkan proses LISTEN di 3100 dan 3110 beserta PID. MCP diverifikasi
           dengan POST initialize (harus HTTP 200), bukan hanya port terbuka.
  start    Nyalakan hanya service yang belum hidup. Polling tiap 500 ms sampai siap
           (dev maks 60 s, MCP maks 15 s).
  restart  stop, tunggu port benar-benar bebas, lalu start.
  stop     Hentikan PID pemilik port HANYA jika proses itu berasal dari repo ini.
           Induk wrapper milik repo (npm run dev, cmd, node) ikut dihentikan.

Log: %TEMP%\opencode\dev3100.log dan %TEMP%\opencode\mcp3110.log (append).
Catatan: proses MCP yang sudah berjalan dengan path relatif (node mcp-server.mjs)
dikenali lewat nama file; proses yang dinyalakan skrip ini memakai path absolut.
#>
param(
  [ValidateSet('status', 'start', 'restart', 'stop')]
  [string]$Command = 'status'
)

$ErrorActionPreference = 'Stop'
$Repo = Split-Path -Parent $PSScriptRoot
$RepoFwd = $Repo -replace '\\', '/'
$LogDir = Join-Path $env:TEMP 'opencode'
$PollMs = 500
$McpBody = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"dev-services","version":"1"}}}'

$Services = @(
  [pscustomobject]@{ Name = 'dev'; Port = 3100; TimeoutSec = 60; Log = (Join-Path $LogDir 'dev3100.log') }
  [pscustomobject]@{ Name = 'mcp'; Port = 3110; TimeoutSec = 15; Log = (Join-Path $LogDir 'mcp3110.log') }
)

function Get-ListenerPid([int]$Port) {
  $c = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
  if ($c.Count -eq 0) { return $null }
  return [int]$c[0].OwningProcess
}

function Get-Proc($ProcId) {
  if (-not $ProcId) { return $null }
  return Get-CimInstance Win32_Process -Filter "ProcessId=$ProcId" -ErrorAction SilentlyContinue
}

function Test-Owned($Proc, $Svc) {
  if (-not $Proc -or -not $Proc.CommandLine) { return $false }
  $cl = $Proc.CommandLine
  if ($cl.IndexOf($Repo, [StringComparison]::OrdinalIgnoreCase) -ge 0) { return $true }
  if ($cl.IndexOf($RepoFwd, [StringComparison]::OrdinalIgnoreCase) -ge 0) { return $true }
  if ($Svc.Name -eq 'mcp' -and $Proc.Name -eq 'node.exe' -and $cl -match '(^|[\s"])mcp-server\.mjs("|\s|$)') { return $true }
  return $false
}

function Test-McpInit {
  try {
    $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3110/mcp' -Method Post -UseBasicParsing -TimeoutSec 3 `
      -Headers @{ Accept = 'application/json, text/event-stream' } -ContentType 'application/json' -Body $McpBody
    if ($r.StatusCode -ne 200 -or $r.Content -notmatch 'serverInfo') { return $false }
    $sid = $r.Headers['mcp-session-id']
    if ($sid) {
      try {
        Invoke-WebRequest -Uri 'http://127.0.0.1:3110/mcp' -Method Delete -UseBasicParsing -TimeoutSec 3 `
          -Headers @{ 'Mcp-Session-Id' = [string]$sid } | Out-Null
      } catch { }
    }
    return $true
  } catch {
    return $false
  }
}

function Test-Healthy($Svc) {
  if ($Svc.Name -eq 'mcp') { return (Test-McpInit) }
  return $true
}

function Show-Status {
  foreach ($svc in $Services) {
    $listenerPid = Get-ListenerPid $svc.Port
    if (-not $listenerPid) {
      Write-Host ("{0,-4} :{1}  DOWN" -f $svc.Name, $svc.Port)
      continue
    }
    $p = Get-Proc $listenerPid
    $owned = Test-Owned $p $svc
    $health = if ($svc.Name -eq 'mcp') { if (Test-McpInit) { 'initialize=200' } else { 'initialize=FAIL' } } else { 'port-listen' }
    Write-Host ("{0,-4} :{1}  UP    pid={2} owned={3} {4}" -f $svc.Name, $svc.Port, $listenerPid, $owned, $health)
  }
}

function Stop-Svc($Svc) {
  $listenerPid = Get-ListenerPid $Svc.Port
  if (-not $listenerPid) {
    Write-Host ("{0,-4} :{1}  already down" -f $Svc.Name, $Svc.Port)
    return $true
  }
  $p = Get-Proc $listenerPid
  if (-not (Test-Owned $p $Svc)) {
    Write-Host ("{0,-4} :{1}  REFUSE pid={2} bukan milik repo ini: {3}" -f $Svc.Name, $Svc.Port, $listenerPid, $p.CommandLine)
    return $false
  }
  $targets = [System.Collections.Generic.List[int]]::new()
  $targets.Add([int]$listenerPid)
  $cur = $p
  for ($i = 0; $i -lt 4; $i++) {
    $parent = Get-Proc $cur.ParentProcessId
    if (-not $parent) { break }
    $isWrapper = ($parent.Name -match '^(node|cmd|powershell)') -and (
      (Test-Owned $parent $Svc) -or
      ($parent.CommandLine -match 'run dev' -and $parent.CommandLine -match "(-p|--port) $($Svc.Port)\b")
    )
    if (-not $isWrapper) { break }
    $targets.Add([int]$parent.ProcessId)
    $cur = $parent
  }
  foreach ($id in $targets) {
    Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
  }
  Write-Host ("{0,-4} :{1}  stopped pid={2}" -f $Svc.Name, $Svc.Port, ($targets -join ','))
  return $true
}

function Wait-Free($Svc) {
  $deadline = (Get-Date).AddSeconds(15)
  while ((Get-Date) -lt $deadline) {
    if (-not (Get-ListenerPid $Svc.Port)) { return $true }
    Start-Sleep -Milliseconds $PollMs
  }
  Write-Host ("{0,-4} :{1}  port masih terpakai setelah 15 s" -f $Svc.Name, $Svc.Port)
  return $false
}

function Start-Svc($Svc) {
  $listenerPid = Get-ListenerPid $Svc.Port
  if ($listenerPid) {
    $p = Get-Proc $listenerPid
    if (-not (Test-Owned $p $Svc)) {
      Write-Host ("{0,-4} :{1}  REFUSE port dipakai pid={2} bukan milik repo ini" -f $Svc.Name, $Svc.Port, $listenerPid)
      return $false
    }
    if (Test-Healthy $Svc) {
      Write-Host ("{0,-4} :{1}  already up pid={2}" -f $Svc.Name, $Svc.Port, $listenerPid)
      return $true
    }
    Write-Host ("{0,-4} :{1}  pid={2} hidup tapi tidak sehat; jalankan restart" -f $Svc.Name, $Svc.Port, $listenerPid)
    return $false
  }

  New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
  Add-Content -LiteralPath $Svc.Log -Value ("`n=== start {0} ===" -f (Get-Date -Format o))

  if ($Svc.Name -eq 'dev') {
    $next = Join-Path $Repo 'node_modules\next\dist\bin\next'
    $cmd = "node `"$next`" dev --port $($Svc.Port)"
  } else {
    $cmd = "node `"$(Join-Path $Repo 'mcp-server.mjs')`""
  }
  $argLine = "/c `"$cmd >> `"$($Svc.Log)`" 2>&1`""
  Start-Process -FilePath 'cmd.exe' -ArgumentList $argLine -WorkingDirectory $Repo -WindowStyle Hidden | Out-Null

  $deadline = (Get-Date).AddSeconds($Svc.TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    $listenerPid = Get-ListenerPid $Svc.Port
    if ($listenerPid -and (Test-Healthy $Svc)) {
      Write-Host ("{0,-4} :{1}  started pid={2} log={3}" -f $Svc.Name, $Svc.Port, $listenerPid, $Svc.Log)
      return $true
    }
    Start-Sleep -Milliseconds $PollMs
  }
  Write-Host ("{0,-4} :{1}  GAGAL siap dalam {2} s. Log terakhir:" -f $Svc.Name, $Svc.Port, $Svc.TimeoutSec)
  if (Test-Path -LiteralPath $Svc.Log) { Get-Content -LiteralPath $Svc.Log -Tail 8 }
  return $false
}

$ok = $true
switch ($Command) {
  'status' { Show-Status }
  'stop' {
    foreach ($svc in $Services) { if (-not (Stop-Svc $svc)) { $ok = $false } }
  }
  'start' {
    foreach ($svc in $Services) { if (-not (Start-Svc $svc)) { $ok = $false } }
  }
  'restart' {
    foreach ($svc in $Services) { if (-not (Stop-Svc $svc)) { $ok = $false } }
    foreach ($svc in $Services) { if (-not (Wait-Free $svc)) { $ok = $false } }
    foreach ($svc in $Services) { if (-not (Start-Svc $svc)) { $ok = $false } }
  }
}
if (-not $ok) { exit 1 }
exit 0
