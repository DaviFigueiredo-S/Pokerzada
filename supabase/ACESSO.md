# Primeiro acesso — atualizado em 26/10/2026

## Correção aplicada

O serviço Auth gravava os metadados administrativos após inserir a identidade. O gatilho antigo observava somente a inserção, deixando contas sem vínculo na aplicação. A migração 20261026170059_repair_auth_metadata_registration.sql observa inserção e atualização dos metadados, é idempotente e bloqueia nomes duplicados. Já foi aplicada no projeto configurado.

As duas tentativas anteriores foram recuperadas, sem alteração de senha:
- Bruno: cadastro mais recente.
- Bruno_025eb691dd26: cadastro anterior.

Ambas são contas comuns, aguardando liberação do principal. Autenticar deve abrir a tela de espera; isso não significa senha incorreta.

## Criar Davi303 com senha definitiva

Davi303 ainda precisa ser inicializado pelo titular. A conta não pode ser obtida pelo cadastro público. Não envie senhas ou a chave secreta na conversa.

No PowerShell, execute:

```powershell
cd "C:\Segunda memoria Eterna\pokerzada-lendaria"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\iniciar-admin.ps1
```

O script desta pasta pede, com entrada oculta:
1. Chave secreta de servidor do seu projeto Supabase, disponível no painel do projeto em API Keys. Não use a chave publicável.
2. Sua senha definitiva, entre 12 e 128 caracteres.
3. Confirmação da senha.

A chave e a senha ficam somente no processo e são removidas das variáveis ao terminar. A senha não é exibida nem salva em arquivo. O servidor não redefine uma conta já existente. A senha permanece válida até uma alteração solicitada; não existe troca inicial obrigatória nesse procedimento.

Depois abra a versão local, entre com Davi303 e sua senha. A senha ADMIN não foi configurada. Em Minha conta você poderá alterar a senha quando quiser.

## Permissões

Novos integrantes podem criar conta e entrar, mas aguardam liberação. Davi303 libera leitura e promove/rebaixa organizadores em Poder de TcheTche. Contas, perfis dos jogadores e Ancião continuam separados. Autorizações são conferidas no servidor.

## Instalação em outro projeto vazio

Aplicar 001_schema.sql e as migrações da pasta migrations em ordem. Publicar poker-auth a partir de supabase/functions/poker-auth/index.ts com verify_jwt=false: login/cadastro são públicos, mas a função valida credenciais e protege bootstrap com segredo de servidor. Configurar somente URL e chave publicável em dist/config.js.

Não reaplicar os arquivos sobre o projeto atual: eles já foram executados. Não expor segredos no frontend.

## Validação ainda necessária pelo titular

O primeiro login real de Davi303 e o teste em dois aparelhos dependem de você escolher a senha e concluir a inicialização. Os testes automáticos de autenticação usam Auth simulado; os gatilhos e permissões foram testados no banco real com rollback.

