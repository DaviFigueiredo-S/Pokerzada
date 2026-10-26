# Acesso por nome de usuário

O site usa Supabase Auth para guardar o hash das senhas e validar sessões. Cada conta recebe uma identidade técnica interna aleatória; ninguém precisa fornecer ou confirmar um e-mail. O nome de usuário é único sem diferenciar maiúsculas/minúsculas.

## Inicializar Davi303 uma única vez

O banco e a função `poker-auth` já estão instalados no projeto `ewyemeecnaptlbpoiakx`. A conta real **ainda não foi criada**. O procedimento abaixo deve ser executado pelo titular do projeto em um terminal particular.

A senha curta originalmente solicitada não é usada. O script gera uma senha temporária aleatória de 32 caracteres, exibe-a somente no terminal e não a salva no projeto. O banco bloqueia acesso aos dados e ações até a troca da senha. O cadastro público não pode reservar nem assumir Davi303.

1. No painel do seu projeto Supabase, obtenha a chave secreta de servidor. Não a coloque em `dist/config.js`, GitHub ou na conversa.
2. Abra PowerShell na pasta do projeto e execute:

```powershell
$env:SUPABASE_URL = 'https://ewyemeecnaptlbpoiakx.supabase.co'
$pokerSecret = Read-Host 'Chave secreta do projeto Supabase' -AsSecureString
try {
    $env:SUPABASE_SECRET_KEY = [System.Net.NetworkCredential]::new('', $pokerSecret).Password
    node .\scripts\bootstrap-admin.mjs
} finally {
    Remove-Item Env:SUPABASE_SECRET_KEY -ErrorAction SilentlyContinue
    Remove-Variable pokerSecret -ErrorAction SilentlyContinue
}
```

3. Abra o site atualizado, clique **Entrar no clube**, use `Davi303` e a senha temporária exibida no seu terminal.
4. A tela exigirá a senha atual, uma nova senha de 12 a 128 caracteres e sua confirmação. Escolha você mesmo a nova senha.
5. Após a troca, **A TROPA → Poder de TcheTche ♛** fica disponível.

Se o script informar que a conta principal já existe, ele não altera senha nem recria a conta. Não insista nem apague contas para repetir a inicialização.

## Integrantes e organizadores

- Cada pessoa escolhe **Criar minha conta** e informa somente usuário, senha e confirmação.
- Novos cadastros aguardam liberação. Isso preserva a decisão de manter as informações restritas à turma convidada.
- Davi303 pode **Liberar leitura**, **Promover a organizador**, **Remover poder de organizador** e **Suspender acesso**, sempre com confirmação.
- Remover o poder de organizador preserva a conta e seu acesso de leitura. Suspender acesso bloqueia também a leitura.
- Organizadores não promovem outros usuários nem recuperam partidas removidas.
- Davi303 tem proteção contra rebaixamento e suspensão pela aplicação.
- Contas de acesso e perfis dos nove jogadores são entidades diferentes. O nome do Ancião identifica o responsável histórico por uma sessão; não é uma credencial.

## Instalação e atualização do banco

No projeto atual, estas migrações **já foram aplicadas**. Não as execute novamente:

1. `20261025180420_poker_accounts_permissions_autorounds_soft_delete.sql`
2. `20261026005558_fix_auth_rate_bucket_ambiguity.sql`

A primeira evolui a tabela existente de organizadores para contas, preserva os dados, adiciona papéis/permissões e gatilhos de autenticação, numera rodadas sob bloqueio da sessão e implementa exclusão lógica/recuperação auditadas. A segunda corrige a ambiguidade de parâmetro do limitador de tentativas.

Para **outro projeto vazio**, aplique `001_schema.sql` uma única vez e, depois, os dois arquivos de migração na ordem acima. Publique a função `supabase/functions/poker-auth/index.ts` com verificação JWT do gateway desativada: cadastro/login precisam ser acessíveis antes de autenticar. A própria função valida JWT e senha atual na troca de senha; bootstrap exige segredo de servidor. As variáveis de servidor são fornecidas pelo Supabase, sem incluí-las no frontend.

Atualize somente URL e chave publicável em `dist/config.js`. Para projeto existente diferente, compare o esquema antes de aplicar; não recrie tabelas sobre dados reais.

Contas antigas de organizadores, se existirem em outra instalação, são preservadas com nome `legacy_` seguido de parte do UUID. Consulte `poker_accounts.username` de forma administrativa para identificar o nome atribuído; a senha anterior continua no Supabase Auth.

## Recuperação e limitações

A recuperação de senha esquecida exige o titular do projeto: não existe recuperação por e-mail fictício. Não exponha endpoints públicos de redefinição administrativa. A troca normal usa **Configurações → Alterar minha senha**.

Partidas removidas continuam no banco. Davi303 recupera em **Poder de TcheTche → Partidas removidas**, informando motivo. Os resultados voltam às estatísticas somente se a sessão continua finalizada e válida.

Backups JSON da aplicação não contêm senhas nem credenciais de autenticação. A importação continua restrita à demonstração. O backup de produção e a recuperação de contas devem usar os mecanismos administrativos do provedor.

O teste de login real com Davi303 e a verificação em dois aparelhos ainda dependem dessa inicialização. Testes de banco usam rollback; nenhuma conta temporária desses testes foi persistida.

