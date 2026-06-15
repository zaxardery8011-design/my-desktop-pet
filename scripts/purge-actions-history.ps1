# Purge assets/actions from Git history.
# This rewrites local history. Review with the repository owner before pushing.
# Run from the repository root after committing the non-history cleanup.

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath '.git')) {
  throw 'Run this script from the mrwu_pet repository root.'
}

$dirty = git status --porcelain
if ($dirty) {
  throw 'Working tree is not clean. Commit or stash changes before history rewrite.'
}

$originUrl = git remote get-url origin 2>$null

git filter-repo --path assets/actions --invert-paths --force

if ($originUrl -and -not (git remote | Where-Object { $_ -eq 'origin' })) {
  git remote add origin $originUrl
}

Write-Host ''
Write-Host 'History was rewritten locally.'
Write-Host 'Do not force-push until the repository owner approves it.'
Write-Host 'Suggested push after approval:'
Write-Host '  git push --force-with-lease origin master'
