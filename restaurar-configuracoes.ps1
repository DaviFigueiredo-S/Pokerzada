$ErrorActionPreference = 'Stop'
$mapping = @{
 'configuracoes-github/gitignore.txt' = '.gitignore'
 'configuracoes-github/pages.yml' = '.github/workflows/pages.yml'
 'configuracoes-github/nojekyll.txt' = 'dist/.nojekyll'
}
foreach ($item in $mapping.GetEnumerator()) {
 $source = Join-Path $PSScriptRoot $item.Key
 $target = Join-Path $PSScriptRoot $item.Value
 if (Test-Path -LiteralPath $target) {
  Write-Host "Preservado: $($item.Value)"
  continue
 }
 $parent = Split-Path -Parent $target
 [IO.Directory]::CreateDirectory($parent) | Out-Null
 Copy-Item -LiteralPath $source -Destination $target
 Write-Host "Restaurado: $($item.Value)"
}