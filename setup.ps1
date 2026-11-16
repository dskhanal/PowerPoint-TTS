$ErrorActionPreference='Stop'
Set-Location $PSScriptRoot
$nodeMajor = [int]((node --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 20 -or $nodeMajor -gt 24) { throw 'Install Node.js 20 or 22 LTS, then run this script again.' }
npm install
npx office-addin-dev-certs install
npm run build
npm run validate
Write-Host ''
Write-Host 'Setup complete. Run .\start.ps1, keep that window open, then sideload manifest.xml in PowerPoint.' -ForegroundColor Green
