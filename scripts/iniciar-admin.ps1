$ErrorActionPreference = 'Stop'
$env:SUPABASE_URL = 'https://ewyemeecnaptlbpoiakx.supabase.co'
$pokerSecret = Read-Host 'Chave secreta de servidor do projeto Supabase (não é a publicável)' -AsSecureString
$pokerPassword = Read-Host 'Escolha sua senha definitiva para Davi303 (mínimo 12 caracteres)' -AsSecureString
$pokerConfirm = Read-Host 'Repita a senha definitiva' -AsSecureString
try {
    $env:POKER_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $pokerPassword).Password
    if ($env:POKER_ADMIN_PASSWORD -cne [System.Net.NetworkCredential]::new('', $pokerConfirm).Password) { throw 'As senhas não coincidem.' }
    $env:SUPABASE_SECRET_KEY = [System.Net.NetworkCredential]::new('', $pokerSecret).Password
    & node (Join-Path $PSScriptRoot 'bootstrap-admin.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Inicialização não concluída. Confira a mensagem acima.' }
} finally {
    Remove-Item Env:POKER_ADMIN_PASSWORD, Env:SUPABASE_SECRET_KEY -ErrorAction SilentlyContinue
    Remove-Variable pokerSecret,pokerPassword,pokerConfirm -ErrorAction SilentlyContinue
}

