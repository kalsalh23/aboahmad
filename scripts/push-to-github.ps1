# push-to-github.ps1
# Pushes the project to an existing GitHub repository using the REST API
# (git CLI is not installed on this machine).
# Usage: ./push-to-github.ps1 -Token "ghp_..." -Owner "kalsalh23" -Repo "aboahmad" -Branch "main"

param(
  [Parameter(Mandatory = $true)][string]$Token,
  [Parameter(Mandatory = $true)][string]$Owner,
  [Parameter(Mandatory = $true)][string]$Repo,
  [string]$Branch = "main",
  [string]$Root = ".",
  [string]$Message = "Government warehouse management system (React + Supabase)",
  [switch]$WhatIf
)

$ErrorActionPreference = "Stop"

$headers = @{
  "Authorization" = "Bearer $Token"
  "Accept"        = "application/vnd.github+json"
  "User-Agent"    = "warehouse-uploader"
}

function GhApi($method, $path, $bodyObj) {
  $uri = "https://api.github.com/repos/$Owner/$Repo$path"
  if ($null -eq $bodyObj) {
    return Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -TimeoutSec 300
  }
  $json = $bodyObj | ConvertTo-Json -Depth 20 -Compress
  return Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -Body $json -ContentType "application/json" -TimeoutSec 300
}

# ---------- collect files ----------
$rootFull = (Resolve-Path $Root).Path
$excludeDirs = @("node_modules", "dist", ".git", ".vercel", "coverage", "__pycache__", ".vite")
$excludeFiles = @(".env", ".env.local", ".env.development.local", ".env.production.local")

$files = Get-ChildItem -LiteralPath $rootFull -Recurse -File | Where-Object {
  $rel = $_.FullName.Substring($rootFull.Length).TrimStart('\', '/')
  $parts = $rel -split '[\\/]'
  $inExcludedDir = $false
  for ($i = 0; $i -lt ($parts.Count - 1); $i++) { if ($excludeDirs -contains $parts[$i]) { $inExcludedDir = $true; break } }
  (-not $inExcludedDir) -and ($excludeFiles -notcontains $_.Name)
} | Sort-Object FullName

Write-Output "FILES TO PUSH: $($files.Count)"

if ($WhatIf) {
  $files | ForEach-Object { $_.FullName.Substring($rootFull.Length).TrimStart('\', '/') }
  return
}

# ---------- existing ref (parent commit) ----------
$parent = $null
try {
  $ref = Invoke-RestMethod -Uri "https://api.github.com/repos/$Owner/$Repo/git/ref/heads/$Branch" -Headers $headers -TimeoutSec 120
  $parent = $ref.object.sha
  Write-Output "EXISTING REF: $Branch -> $parent"
} catch {
  Write-Output "NO EXISTING REF (fresh branch)"
}

# ---------- upload blobs ----------
$tree = New-Object System.Collections.Generic.List[object]
$i = 0
foreach ($f in $files) {
  $i++
  $rel = $f.FullName.Substring($rootFull.Length).TrimStart('\', '/').Replace('\', '/')
  $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
  $b64 = [System.Convert]::ToBase64String($bytes)
  $blob = GhApi "POST" "/git/blobs" @{ content = $b64; encoding = "base64" }
  $tree.Add([pscustomobject]@{ path = $rel; mode = "100644"; type = "blob"; sha = $blob.sha })
  if ($i % 10 -eq 0) { Write-Output "  uploaded $i / $($files.Count)" }
}
Write-Output "  uploaded $($files.Count) / $($files.Count)"

# ---------- tree ----------
$treeBody = @{ tree = $tree.ToArray() }
if ($parent) { $treeBody.base_tree = $null }
$newTree = GhApi "POST" "/git/trees" $treeBody
Write-Output "TREE: $($newTree.sha)"

# ---------- commit ----------
$commitBody = @{ message = $Message; tree = $newTree.sha }
if ($parent) { $commitBody.parents = @($parent) }
$commit = GhApi "POST" "/git/commits" $commitBody
Write-Output "COMMIT: $($commit.sha)"

# ---------- ref ----------
if ($parent) {
  try {
    GhApi "PATCH" "/git/refs/heads/$Branch" @{ sha = $commit.sha; force = $true } | Out-Null
    Write-Output "REF UPDATED: refs/heads/$Branch -> $($commit.sha)"
  } catch {
    $msg = $_.Exception.Message
    try { if ($_.Exception.Response) { $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream()); $msg = $sr.ReadToEnd() } } catch {}
    throw "Failed to update ref: $msg"
  }
} else {
  try {
    GhApi "POST" "/git/refs" @{ ref = "refs/heads/$Branch"; sha = $commit.sha } | Out-Null
    Write-Output "REF CREATED: refs/heads/$Branch -> $($commit.sha)"
  } catch {
    $msg = $_.Exception.Message
    try { if ($_.Exception.Response) { $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream()); $msg = $sr.ReadToEnd() } } catch {}
    throw "Failed to create ref: $msg"
  }
}

Write-Output ""
Write-Output "DONE: https://github.com/$Owner/$Repo/tree/$Branch"
