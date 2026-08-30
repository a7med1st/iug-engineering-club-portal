param(
  [string]$ProjectRoot = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path $ProjectRoot).Path
$headerPath = Join-Path $ProjectRoot "components\Header.tsx"

if (-not (Test-Path $headerPath)) {
  throw "components\Header.tsx was not found. Run this script from the project root."
}

# Find the latest Phase 6 backup that actually contains Header.tsx.
$backupCandidates =
  Get-ChildItem -LiteralPath $ProjectRoot -Directory -Filter ".phase6-backup-*" |
  Sort-Object LastWriteTime -Descending

$backupHeader = $null

foreach ($backupDir in $backupCandidates) {
  $candidate = Join-Path $backupDir.FullName "components\Header.tsx"

  if (Test-Path $candidate) {
    $backupHeader = $candidate
    break
  }
}

if (-not $backupHeader) {
  throw "No Phase 6 Header.tsx backup was found."
}

Write-Host "Using backup:" -ForegroundColor Cyan
Write-Host "  $backupHeader"

# Keep a safety copy of the currently corrupted header.
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$safetyDir = Join-Path $ProjectRoot ".header-fix-backup-$stamp"
$safetyHeader = Join-Path $safetyDir "components\Header.tsx"

New-Item -ItemType Directory -Path (Split-Path $safetyHeader -Parent) -Force | Out-Null
Copy-Item -LiteralPath $headerPath -Destination $safetyHeader -Force

# Restore the exact original bytes first.
Copy-Item -LiteralPath $backupHeader -Destination $headerPath -Force

# IMPORTANT:
# Windows PowerShell 5.1 Get-Content can misread UTF-8 without BOM.
# Read/write explicitly as UTF-8 to preserve Arabic text.
$utf8 = [Text.UTF8Encoding]::new($false)
$header = [IO.File]::ReadAllText($headerPath, [Text.Encoding]::UTF8)

$notificationImport =
  'import NotificationBell from "@/components/notifications/NotificationBell";'

# Add import safely.
if ($header -notmatch 'components/notifications/NotificationBell') {
  $presenceImport =
    'import MemberPresenceHeartbeat from "@/components/member/MemberPresenceHeartbeat";'

  $mainNavImport =
    'import MainNav from "@/components/MainNav";'

  if ($header.Contains($presenceImport)) {
    $header =
      $header.Replace(
        $presenceImport,
        $presenceImport + "`r`n" + $notificationImport
      )
  }
  elseif ($header.Contains($mainNavImport)) {
    $header =
      $header.Replace(
        $mainNavImport,
        $mainNavImport + "`r`n" + $notificationImport
      )
  }
  else {
    throw "Could not find a safe import anchor in Header.tsx."
  }
}

# Add bell after MainNav, only once.
if ($header -notmatch '<NotificationBell\s*/>') {
  $mainNavPattern = '<MainNav\s*/>'
  $match = [regex]::Match($header, $mainNavPattern)

  if (-not $match.Success) {
    throw "Could not find <MainNav /> in Header.tsx."
  }

  $bellMarkup = "`r`n`r`n        {session && <NotificationBell />}"
  $insertAt = $match.Index + $match.Length

  $header =
    $header.Insert(
      $insertAt,
      $bellMarkup
    )
}

[IO.File]::WriteAllText(
  $headerPath,
  $header,
  $utf8
)

Write-Host ""
Write-Host "Header restored and NotificationBell re-added safely." -ForegroundColor Green
Write-Host "Safety backup of corrupted header:" -ForegroundColor Yellow
Write-Host "  $safetyHeader"
Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "  npx.cmd tsc --noEmit"
Write-Host ""
Write-Host "Then hard refresh the browser: Ctrl + Shift + R"