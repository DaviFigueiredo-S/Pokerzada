# Verificação atual — Legado — 28/10/2026

Implementação na cópia `pokerzada-legado`; original preservado. Instruções completas, arquivos e matriz de acesso: **IMPLEMENTACAO-LEGADO.md**.

## Resultados executados nesta entrega

- **73 testes Node/SQL aprovados**, sem falhas, pulos ou cancelamentos. Incluem os testes existentes e as novas integrações de exclusão, personagens, privilégios e preservação financeira.
- **7 testes Playwright aprovados no Chrome instalado**, com interface real conectada a servidor de teste e migrações/RPCs reais em Postgres/PGlite. Nenhum erro JavaScript não tratado foi capturado nas páginas principais desses sete testes.
- Sintaxe de JavaScript/MJS verificada; `npm audit` informou **zero vulnerabilidades conhecidas** nas dependências instaladas na data da execução.
- Comparação de arquivos com a base: nenhum arquivo original removido; `domain.js`, `autosave.js` e `visuals.js` idênticos à base. Busca por padrões de chaves secretas/tokens administrativos no conteúdo entregável não encontrou ocorrências. A configuração publicável existente é preservada.

| Área | Evidência executada |
| --- | --- |
| Exclusão real | Conta com/sem histórico; Auth e conta removidos no banco isolado; foto privada apagada; resultados e centavos preservados; perda de acesso ao snapshot; nome reutilizável por uma identidade nova |
| Falha parcial | Falha antes da remoção Auth no teste unitário; falha após Auth no navegador; pendência acessível após recarga; conclusão repetível sem duplicação |
| Permissões | Membro/organizador impedidos de excluir contas; TcheTche impedido de excluir outro TcheTche; principal protegido inclusive por gatilho; pendência não pode ser reativada; chamadas diretas às RPCs de serviço rejeitadas |
| Banco | Todas as migrações aplicadas em Postgres/PGlite novo; RLS conferida nas tabelas públicas/privadas; fotos não acessíveis diretamente; edição de outro perfil negada; revisão de personagem impede sobrescrita desatualizada |
| Identidade legada | Dois perfis com nomes legados duplicados preparados no fixture; suspensão/reativação não reinserem perfil nem geram falso erro de nome duplicado |
| Rodadas | Primeira/intermediária/última/única; repetição idempotente; manutenção de IDs, entradas e finais; bloqueio após fechamento; sequência automática com comandos sobre versão anterior; edição/observações antigas preservadas |
| Regressão SQL | `auth-database.integration.sql`, `auth-metadata.integration.sql`, `nightclub.integration.sql` e `collaborative.integration.sql` executados com rollback no banco isolado |
| Legado/Home | Quatro cards, links antigos, estado ativo da navegação e ausência dos cards removidos; páginas históricas reutilizadas |
| Mesa | Dez assentos em larguras 1440, 1024, 768, 390 e 320 sem sobreposição de retângulos ou rolagem horizontal; grade de dezesseis assentos; destaque da conta atual |
| Personagens | Dezesseis SVGs distintos, fallback/sanitização, catálogo no editor, traje salvo/recarregado, cancelamento de rascunho, remoção somente da foto e restauração do padrão |
| Fotos | JPEG real no servidor; PNG/WebP reais convertidos no navegador; rejeição de conteúdo falso, mais de 5 MB, dimensão acima de 8192 pixels e JPEG corrompido; remoção de metadados; zoom/posição e toque via protocolo do Chrome |
| Sincronização | Resposta de salvamento perdida após commit; editor não anuncia confirmação; repetição com mesmo UUID mantém uma única revisão; segundo acesso atualiza por polling |
| Fichas | R$ 10,00 e zero reconhecidos no Placar; recarga mantém valor; debounce, rascunho e falhas cobertos pela suíte existente; contagem não altera entradas/re-buys |
| Financeiro/relatórios | Testes existentes de centavos, fechamento, cancelamento, exclusão/recuperação de partida, rankings, gráficos, retrospectiva e backup passaram |

## Limites e pendências reais

Os testes SQL usam o motor Postgres do PGlite com schema Auth de teste. Isso valida SQL, transações, privilégios e comportamento da aplicação, mas **não é uma execução do serviço Supabase Auth real nem do runtime Deno hospedado**. O servidor de navegador usa os handlers reais com um adaptador Auth simulado. Não foram usadas credenciais reais para testar exclusão, nem alteradas contas/partidas compartilhadas.

Não houve implantação da migração de 28/10, das novas funções, publicação do frontend ou push. Após implantação autorizada, ainda é necessário conferir em homologação o serviço Auth real, as duas Edge Functions, Realtime hospedado e dispositivos físicos. A sincronização verificada em dois acessos usou duas páginas do Chrome e polling, não dois celulares físicos. Safari/Firefox, todos os leitores de tela e um novo download do cartão de retrospectiva não foram testados nesta rodada.

Os testes de concorrência desta suíte verificam idempotência e comandos com versões anteriores; PGlite usa uma conexão. Não foi executado teste de carga ou corrida com várias conexões PostgreSQL em produção. O esquema mantém bloqueios transacionais de linha e advisory locks para coordenar exclusão e comandos.

## Registros anteriores (histórico)

# Situação em 27/10/2026

Veja ATUALIZACAO-NIGHTCLUB.md para a revisão mais recente (54 testes Node e duas integrações SQL aprovadas). ATUALIZACAO-COLABORATIVA.md documenta a etapa anterior. Davi303 já foi inicializado e o usuário confirmou login/cadastro funcionando. As instruções históricas abaixo não descrevem pendências atuais.

# Retomada de autenticação — 26/10/2026

Esta seção substitui as instruções anteriores de senha temporária. O principal agora usa senha definitiva escolhida pelo titular por scripts/iniciar-admin.ps1. A conta real ainda aguarda esse passo privado.

Diagnóstico real: dois usuários Bruno existiam em auth.users, mas não em poker_accounts. Os metadados chegaram após INSERT. Corrigido o gatilho para INSERT/UPDATE com idempotência, e recuperadas as identidades sem mudar senhas (Bruno e Bruno_025eb691dd26). Migração 20261026170059 aplicada; Edge poker-auth versão 2 publicada. Cadastro verifica vínculo antes de anunciar sucesso; falha de entrada após cadastro não pede novo cadastro.

40 testes Node passaram. Novo tests/auth-metadata.integration.sql passou no PostgreSQL com rollback: metadados tardios, repetição, duplicados, user_metadata sem privilégios e principal com senha definitiva. O menu Minha conta está implementado; o login válido com senha do titular e o fluxo visual das permissões ainda dependem da inicialização.

Advisor informa proteção contra senhas vazadas desativada: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . Não alterada nesta correção.

## Registro anterior (histórico)

# Atualização verificada — 25/10/2026 (horário de Brasília)

## Estado encontrado na retomada

O frontend e os módulos originais estavam salvos. Também estavam salvos o novo login/cadastro, o painel de permissões, o contador automático, a migração de contas/rodadas/exclusão lógica e a função Edge poker-auth. A migração principal já estava aplicada no projeto Supabase.

Faltavam a verificação final, ajustes dos testes ao novo comportamento, revisão do autosave, documentação de inicialização e pacote atualizado. O vault Obsidian tinha somente uma nota vazia fora da pasta do projeto; a continuidade útil estava nos próprios arquivos e nesta conversa.

Nenhuma tela foi reconstruída. style.css, index.html e visuals.js foram preservados.

## Alterações desta atualização

| Arquivo | Responsabilidade |
| --- | --- |
| dist/js/app.js | Cadastro/login por usuário, troca obrigatória de senha, Poder de TcheTche, permissões visuais, contador automático, formulário compacto de rodadas, exclusão e recuperação |
| dist/js/repository.js | Chamada da função de autenticação, rascunhos isolados por conta/projeto, compatibilidade com demonstrações antigas |
| dist/js/autosave.js | Agrupamento de alterações por 650 ms, envio em sequência, confirmação e conservação do rascunho em falha |
| dist/js/domain.js | Numeração automática, preservação de notas antigas, exclusão lógica e estatísticas, permissões da demonstração |
| supabase/functions/poker-auth/ | Autenticação server-side com Supabase Auth; identidades internas aleatórias, validação, limites de tentativas e bootstrap protegido |
| supabase/migrations/ | Evolução do esquema existente e correção do limitador de autenticação |
| scripts/bootstrap-admin.mjs | Inicialização única do principal com senha temporária aleatória, sem persistir a senha |
| tests/ | Testes Node e integração PostgreSQL transacional |
| README.md e supabase/ACESSO.md | Instalação, acesso, segurança e pendências atualizados |

A migração `20261025180420_poker_accounts_permissions_autorounds_soft_delete.sql` evolui as tabelas existentes sem apagar partidas/perfis. A migração `20261026005558_fix_auth_rate_bucket_ambiguity.sql` corrige uma ambiguidade de parâmetro encontrada no teste real do PostgreSQL. Ambas já estão aplicadas no projeto atual.

## Evidências executadas

- **40 testes Node:** domínio financeiro, login/cadastro com Auth simulado, validações, senha, bootstrap, debounce, falhas de rede, persistência, zero, permissões, rodadas e exclusão/recuperação.
- **PostgreSQL real:** `database.integration.sql`, `updates.integration.sql` e `auth-database.integration.sql` passaram. Todas as transações foram revertidas. Nenhum usuário nem partida de teste ficou no banco.
- **Autenticação real, teste negativo:** pelo formulário do navegador, uma conta inexistente recebeu “Usuário ou senha inválidos”. Isso verificou frontend → Edge → lookup/limitador no servidor; não equivale a teste de login válido.
- **Navegador, demonstração local:** contagem de Marcos com 10 × R$ 0,50 + 5 × R$ 1,00 exibiu R$ 10,00 no placar sem salvar manualmente. Anthony recebeu zero válido. Ambos persistiram após recarregar.
- Três rodadas ficaram numeradas 1, 2 e 3; uma sem categoria e uma com empate. Não havia input de número nem observação. As dez categorias e o painel opcional de cartas permaneceram.
- Fechamento, exclusão justificada e recuperação da sessão de teste foram verificados pela interface; a sessão retornou ao arquivo finalizada.
- Layout do placar verificado em 390 × 844 e desktop. Nenhum erro JavaScript apareceu durante o fluxo da demonstração. O teste negativo de login produz uma resposta HTTP de erro esperada.
- A verificação de segurança Supabase não apontou ERROR/WARN. Houve INFO `rls_enabled_no_policy` na tabela privada do limitador: intencional, pois não permite acesso direto dos clientes e é manipulada somente pela função privilegiada de servidor.

Referência do aviso informativo: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

## Cenários solicitados

| Teste | Resultado e limite |
| --- | --- |
| 1. Cadastro/login | Handler testado com Auth simulado; trigger real de criação testado no PostgreSQL. Cadastro e login válidos pelo serviço Auth real ainda não executados |
| 2. Davi303 e troca inicial | Bootstrap e troca testados no handler; bloqueio/liberação e proteção principal testados no PostgreSQL. Conta real ainda aguarda procedimento em ACESSO.md |
| 3. Poder de TcheTche | Promoção e rebaixamento de Anthony via RPC real em transação revertida. Fluxo visual com contas reais aguarda principal |
| 4. Segurança | Membro bloqueado em RPC administrativa e escrita direta no PostgreSQL |
| 5. R$ 10,00 automático | Confirmado na demonstração pela interface e no RPC PostgreSQL |
| 6. Zero válido | Confirmado na interface, domínio e banco |
| 7. Persistência | Recarga da demonstração conferida; rascunhos e falhas testados em Node; confirmação e nova leitura verificadas no banco |
| 8. Numeração automática | 1, 2 e 3 na interface e no banco; comandos com a mesma revisão inicial receberam números distintos |
| 9. Formulário compacto | Conferido no navegador; dez categorias mantidas, empate/sem categoria usados, cartas opcionais mantidas; nota histórica preservada no SQL |
| 10. Exclusão | Exclusão e recuperação pela interface demo e RPC real; testes verificam recálculo de estatísticas, gráfico e retrospectiva |
| 11. Usuário sem permissão | Exclusão direta por RPC negada no PostgreSQL |
| 12. Regressão | Testes anteriores atualizados somente onde mudou o requisito; finanças, re-buy, fechamento, cartas, backup, gráficos e retrospectivas cobertos. Não é uma certificação de todos os navegadores |

## Pendências externas e uso real

1. Executar o procedimento seguro de `supabase/ACESSO.md` para criar a conta real Davi303. A senha curta solicitada foi substituída por uma senha temporária aleatória; nenhuma senha administrativa foi gravada no código.
2. Publicar o frontend atualizado no destino escolhido. A versão atualmente hospedada não é atualizada apenas por editar estes arquivos. O projeto não tem push remoto confirmado.
3. Com a conta real, conferir login válido, cadastro de integrante, promoção/rebaixamento na interface e sincronização em dois aparelhos.
4. As imagens de retrospectiva tinham sido verificadas na entrega anterior; o download real e testes em aparelhos móveis físicos não foram repetidos nesta atualização.

O acesso de leitura permanece restrito a cadastros autorizados, conforme a decisão anterior. Não foram criadas contas reais em nome de Anthony ou Davi303 durante os testes.

Para continuar: leia este arquivo e ACESSO.md; não refaça a migração principal nem recrie o site.

