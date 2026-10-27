# Atualização colaborativa — 27/10/2026

## Estado e retomada
A migração 20261026174323_account_players_collaborative_counts já estava aplicada e salva. App, repository e testes também estavam salvos. Faltavam revisão de conflitos, persistência das preferências demo, documentação e entrega.

## Implementação
- Contas vinculadas a perfis pelo UUID. Cadastro cria perfil; aprovação ativa sua seleção. Nove perfis antigos arquivados (sem apagar histórico). Os nove exemplos continuam apenas na demonstração local.
- Participante autorizado altera sua própria contagem/valor final; organizador pode corrigir participantes. Servidor valida participação, situação da partida, conta e revisão individual. Organizador também joga.
- Cores pessoais em poker_accounts.preferences. Valores monetários permanecem iguais. Configurações administrativas visíveis somente ao principal; comando settings também exige principal.
- RPC poker_operation_status consulta apenas recibos do próprio autor. Resposta confirmada não se torna pendência quando leitura posterior falha. Rejeições HTTP definitivas liberam fila. Falhas ambíguas preservam operação e UUID; recuperação consulta recibo antes de reenviar.
- Autosave mantém rascunho e contagem zero. Conflito da mesma pessoa exige conferência; salvar outro participante não atualiza indevidamente a revisão de edições locais. Rascunho recuperado não é enviado silenciosamente.
- Preferências demo preservadas após reabrir e editar; cores reais persistem no banco.

## Arquivos
- dist/js/app.js: permissões, preferências, jogadores cadastrados, revisão da contagem.
- dist/js/repository.js: recuperação de operações e revisão individual.
- server.mjs: porta configurável por PORT.
- supabase/migrations/20261026174323_account_players_collaborative_counts.sql: vínculo de contas, preferências, permissões, contagens e recibos (já aplicada).
- tests/repository.test.mjs, tests/ui-permissions.test.mjs, tests/collaborative.integration.sql.

## Verificações executadas
48 testes Node passaram em 27/10. Incluem domínio financeiro, rodadas/cartas, exclusão/recuperação, autenticação com servidor simulado, autosave, recuperação de recibos, permissões de renderização e cores.
Sintaxe app.js e repository.js validada por node --check.
Teste collaborative.integration.sql executado no Supabase com BEGIN/ROLLBACK: novo cadastro gera perfil; principal participa; entradas idempotentes; membro impedido de contar outro jogador e configurar dados; duas contagens usando revisão de sessão antiga mas revisões individuais válidas; conflito no mesmo jogador; R$10,00 e zero; cores isoladas; fechamento bloqueia edição. Nenhuma partida de teste permanece.
O teste de concorrência usa comandos com revisões antigas em uma transação: verifica regras de conflito, não latência/simultaneidade real de dois aparelhos.
Verificação visual anterior: início e preferências na porta4180. Não foi concluído teste ponta a ponta em dois navegadores autenticados, nem nova auditoria visual mobile nesta retomada. Ferramenta de navegador indisponível no momento.
Advisor: proteção contra senhas vazadas continua desativada (preexistente): https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . auth_limits privada tem RLS sem política por bloqueio direto intencional.

## Testar no PC
O servidor antigo na porta4173 servia outra cópia. Use esta pasta atual:

    cd "C:\Segunda memoria Eterna\pokerzada-lendaria"
    $env:PORT="4180"
    node server.mjs

Abra http://127.0.0.1:4180 e entre normalmente. Não use demonstração para consultar contas reais. Se a porta4180 já estiver ocupada pelo servidor atualizado, abra o endereço sem iniciar outro processo.
1. Em Poder de TcheTche, libere os integrantes pendentes para aparecerem na seleção.
2. Crie mesa com Davi303 e outro integrante autorizado.
3. Abra outra conta em navegador diferente e conte as próprias fichas. Confira Placar e atualização.
4. Personalize cores em cada conta, recarregue e compare.
5. Edite o mesmo jogador em dois aparelhos e confira o aviso de conflito.

Login e senha existentes preservados. Não publiquei esta cópia no endereço Vercel. Histórico anterior em VERIFICACAO.md é registro de etapas passadas.
