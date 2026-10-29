# Implementação do Legado — 28/10/2026

## Estado da entrega

Implementação sobre a base existente, na cópia `pokerzada-legado`, conforme o PLANEJAMENTO-POKERZADA aprovado. A pasta original `pokerzada-lendaria` não permitia gravação neste ambiente e foi preservada. Backup anterior: `../pokerzada-base-20261028-170714.zip`.

Esta entrega contém o frontend, a migração e as funções de servidor. **A nova migração e as novas versões das funções ainda precisam ser aplicadas ao Supabase compartilhado. Não houve publicação, push nem exclusão de contas reais. A senha de Davi303 não foi alterada.**

## O que já estava salvo e foi aproveitado

Login/cadastro por usuário, conta principal, hierarquia owner/admin/organizer/member, tema noturno, Mesa ao Vivo, autosave de fichas, contagem individual, cores pessoais, rodadas automáticas, fechamento, histórico, rankings, gráficos, retrospectivas e exclusão lógica/recuperação de partidas.

A exclusão de rodadas já existia; foi reutilizada. O botão antigo “Excluir conta” apenas desativava o integrante. O vínculo automático de perfis usava INSERT com ON CONFLICT, acionando a validação de nome antes de atualizar um perfil existente. Isso podia provocar o erro de nome duplicado em perfis legados.

Na retomada, Legado, personagens, exclusão em etapas, migração e testes iniciais estavam salvos. Faltavam a validação final no navegador, correções de assentos no tablet, recuperação visível quando o Auth já havia removido a identidade, instruções e pacote completo.

## Alterações concluídas no código

- **Exclusão real:** confirmação digitando o usuário, identificação por UUID, autorização no servidor, bloqueio durante mesa ativa e proteção de Davi303. O backend bloqueia o acesso, anonimiza o histórico, apaga a foto privada, remove a identidade no Auth e confirma a conclusão. Falhas intermediárias deixam “Concluir exclusão”, inclusive depois de a identidade já ter sido removida. Repetir a operação não duplica a exclusão.
- **Vínculos legados:** atualização do perfil existente antes de tentar uma inserção, corrigindo a revalidação indevida de nomes durante suspensão/remoção.
- **Histórico preservado:** entradas, re-buys, centavos, resultados, IDs e rodadas continuam existindo com “Integrante removido”. A conta e sua autenticação deixam de existir; o registro histórico anonimizado não é uma conta desativada.
- **Rodadas:** ação explícita “Excluir rodada”, confirmação com número e vencedores, motivo auditado e mesmas regras transacionais anteriores. Sessões encerradas continuam bloqueadas até uma correção autorizada. Não há movimentação financeira automática. A numeração histórica das demais rodadas não é alterada.
- **Central do Legado:** quatro cards ligam às páginas existentes de Arquivo, Hall da Fama, Estatísticas e Retrospectiva. URLs antigas continuam funcionando. Navegação horizontal no desktop e navegação adaptada no celular.
- **Home:** retirada somente do bloco de três cards indicado no plano. Configurações de fichas continuam acessíveis.
- **Meu Personagem:** 16 trajes originais em SVG, rosto neutro, cabeça circular com foto, zoom, posicionamento por controles/mouse/toque, prévia, salvar/cancelar, remover somente a foto e restaurar o padrão. Acesso pela conta e pelo perfil. Corpo completo na mesa e perfis; avatares compactos preservados nas áreas pequenas.
- **Fotos:** JPEG/PNG/WebP até 5 MB; conteúdo decodificado, limite de 24 MP/8192 pixels por lado no navegador, normalização para JPEG até 1200 pixels. O servidor decodifica novamente, remove metadados e gera o retrato de 240 × 240. A cópia de edição fica em tabela privada, uma por jogador; não é duplicada nas mesas. Falhas mantêm o rascunho e não são apresentadas como salvamento confirmado.
- **Mesa:** personagem salvo, identificação “Você”, fallback de foto, redução de movimento, disposição oval até dez participantes e grade adaptativa acima disso. Celular usa cartões acessíveis. A grade não estabelece um limite artificial de jogadores.

## Matriz de acesso preservada

Todas as ações exigem conta ativa, acesso liberado e eventuais requisitos de senha cumpridos. “Ancião” identifica o responsável histórico da partida; não concede privilégios.

| Ação | Membro | Organizador | TcheTche (`admin`) | Principal (`owner`) |
| --- | --- | --- | --- | --- |
| Consultar dados da turma/Legado | Sim, após liberação | Sim | Sim | Sim |
| Contar as próprias fichas em mesa ativa | Sim | Sim | Sim | Sim |
| Editar o próprio personagem | Sim | Sim | Sim | Sim |
| Gerenciar mesas/rodadas e perfis de jogadores | Não | Sim | Sim | Sim |
| Excluir logicamente partida | Não | Sim | Sim | Sim |
| Recuperar partida removida | Não | Não | Não | Sim |
| Liberar acesso/promover organizador | Não | Não | Sim, conforme hierarquia existente | Sim |
| Conceder/retirar Poder de TcheTche | Não | Não | Não | Sim |
| Excluir conta comum/organizador | Não | Não | Sim | Sim |
| Excluir conta TcheTche | Não | Não | Não | Sim |
| Excluir Davi303/principal | Não | Não | Não | Não |
| Dados e segurança/banco compartilhado | Não | Não | Não | Sim |

A edição administrativa de personagens segue a permissão de edição de jogadores que já existia. As RPCs de foto e exclusão aceitam somente o papel de serviço; a Edge Function identifica o ator pelo token validado. O navegador não fornece uma identidade administrativa confiável por conta própria.

## Arquivos alterados/adicionados

| Arquivo | Responsabilidade |
| --- | --- |
| `dist/js/app.js` | Legado, navegação, personagens, confirmação de rodada e exclusão de conta |
| `dist/style.css` | Menu horizontal, cards, personagens/editor e assentos responsivos |
| `dist/js/repository.js` | Chamadas autenticadas para personagens/exclusão e sincronização |
| `dist/js/characters.js` | Catálogo original de 16 trajes e renderização segura reutilizável |
| `dist/js/character-editor.js` | Estado em rascunho, preparação da foto, recorte e confirmação |
| `supabase/functions/poker-auth/handler.js` | Novo encaminhamento de exclusão, preservando login/cadastro |
| `supabase/functions/poker-auth/account-deletion.js` | Exclusão Auth + confirmação recuperável |
| `supabase/functions/poker-profile/` | Autorização, limites e processamento real de fotografia |
| `supabase/migrations/20261028201548_legado_personagens_exclusao_contas.sql` | Evolução compatível de schema, permissões e RPCs |
| `supabase/config.toml` | Configuração de entrada das duas funções; JWT validado nos handlers |
| `tests/characters.test.mjs`, `tests/account-deletion.test.mjs`, `tests/legacy-database.test.mjs` | Testes novos de foto, exclusão, autorização e SQL |
| `tests/database-helper.mjs`, `tests/browser-server.mjs`, `tests/browser/legacy.spec.js` | Banco isolado e testes reais de interface |
| `tests/ui-permissions.test.mjs` | Ajuste ao componente de personagem e ao novo nome da ação |
| `playwright.config.js`, `scripts/test-browser.mjs` | Execução dos testes de Chrome e encerramento limpo no Windows |
| `package.json`, `package-lock.json`, `.gitignore`, `.github/workflows/pages.yml` | Dependências de teste fixadas e instalação antes do CI |
| `README.md`, `VERIFICACAO.md`, este documento | Orientações e limites atuais |

`domain.js`, `autosave.js` e `visuals.js` foram preservados. Os cálculos financeiros, gráficos e exportações continuam usando a implementação anterior.

## Aplicação no banco e servidor

### Instalação existente

1. Faça backup do banco pelo mecanismo do provedor e preserve o frontend anterior. Uma exportação JSON da interface não contém identidades Auth nem toda a estrutura privada.
2. Confira as migrações já aplicadas. A base desta entrega contém as migrações até `20261027142446_registration_name_availability.sql`. Não execute novamente `001_schema.sql` nem migrações antigas no projeto existente.
3. Aplique **uma vez** `supabase/migrations/20261028201548_legado_personagens_exclusao_contas.sql` com o mecanismo de migrações do projeto ou no SQL Editor administrativo. O arquivo usa BEGIN/COMMIT. Ele cria estruturas e funções; não exclui usuários ao ser aplicado.
4. Atualize a função **poker-auth**, incluindo os três arquivos `index.ts`, `handler.js` e `account-deletion.js`.
5. Publique a nova função **poker-profile**, incluindo `index.ts`, `handler.js` e `photo.js`. Ela usa `npm:jpeg-js@0.4.4` no servidor.
6. Mantenha a verificação JWT do gateway conforme `supabase/config.toml`: `verify_jwt=false` para essas funções. Isso não libera administração: os handlers validam o token em `/auth/v1/user`, e as operações consultam papéis ativos no banco. Cadastro/login precisam aceitar chamadas sem sessão.
7. Use as variáveis protegidas de servidor já fornecidas pelo Supabase: URL, chave publicável/anon e chave secreta/service role. Não copie a chave secreta para `dist`, `config.js`, Git ou mensagens. As funções seguem o mesmo padrão de variáveis da autenticação existente.
8. Só depois disponibilize o novo `dist`. No teste local, use a pasta `pokerzada-legado`, reinicie o servidor e atualize com Ctrl+F5. Abrir a pasta antiga continuará mostrando a versão anterior.

O cadastro de Davi303 já existe. **Não execute novamente o bootstrap e não altere a senha.** A configuração pública de conexão existente foi mantida.

### Instalação completamente nova

Aplique `supabase/001_schema.sql`, depois todos os arquivos de `supabase/migrations` em ordem de nome, e publique as duas funções. A inicialização privada do principal segue `supabase/ACESSO.md`; nunca use esse procedimento como atualização de uma conta existente.

### Estruturas novas e recuperação

- `poker_accounts.deletion_pending`: bloqueia reativação e alterações de privilégio durante exclusão.
- `poker_private.account_deletions`: etapas e responsável, sem recriar a conta excluída.
- `poker_private.character_photos`: cópia privada de edição, removida/substituída atomicamente.
- `poker_players.data.character` e `characterRevision`: traje, enquadramento e proteção contra sobrescrita por outro aparelho.
- Auditorias e operações mantêm referências históricas; vínculos Auth usam SET NULL na remoção.
- Funções antigas de comando/snapshot são encapsuladas, preservando as regras financeiras.

Se uma exclusão falhar, atualize o Poder de TcheTche e use **Concluir exclusão**. Não tente recriar a conta para resolver a pendência. Se o integrante participa de mesa ativa, finalize/cancele antes; uma mesa ativa removida logicamente precisa ser recuperada pelo principal antes desse ajuste.

Uma exclusão concluída é definitiva para a identidade Auth. Preservar resultados anonimizados não permite restaurar senha ou foto. Não há rollback automático que recrie essas informações. Em problema de implantação, mantenha as tabelas/dados novos, interrompa o uso das novas ações e investigue antes de reverter schema. Restaurar um backup do banco requer cuidado com registros posteriores e com exclusões já concluídas.

## Executar e testar localmente

Recomendado Node.js 24 (versão usada: 24.21.0).

```powershell
cd "C:\Segunda memoria Eterna\pokerzada-legado"
npm ci
npm test
npm run test:browser -- --reporter=line
npm run dev
```

Abra `http://127.0.0.1:4173`. O frontend de produção não depende do Node para executar no navegador; as dependências npm são de desenvolvimento/testes.

Os testes de navegador usam Chrome em `C:/Program Files/Google/Chrome/Application/chrome.exe`. Em outra instalação, informe `$env:CHROME_PATH` com o caminho do Chrome. A porta 4174 deve estar livre. O executor cria e encerra seu próprio servidor de teste.

O servidor de testes só escuta em 127.0.0.1 e usa Postgres/PGlite temporário com dados fictícios, Auth simulado e as migrações/RPCs reais. Ele não lê as chaves do Supabase compartilhado. Não publique `tests` como site.

## Validação e limites

Consulte `VERIFICACAO.md` para o resultado final e os cenários executados. Nenhuma afirmação de teste do Auth real, Deno hospedado ou dois celulares físicos deve ser inferida dos testes isolados. Essas verificações continuam necessárias após a implantação em um ambiente de homologação.

### Conferência após implantação

1. Entre com a conta existente. Confira Legado, os quatro destinos, links antigos e ausência dos três cards da Home.
2. Em Meu Personagem, experimente os 16 trajes; adicione foto, ajuste zoom/posição, salve e recarregue. Cancele outro rascunho e confirme que o visual salvo não mudou. Remover foto deve manter traje; restaurar padrão deve voltar a O Casual.
3. Abra a mesma mesa em outro acesso autorizado: o visual deve sincronizar pelo mecanismo existente, com reconciliação em até aproximadamente dez segundos quando Realtime não estiver disponível.
4. Em uma sessão de teste, conte R$ 10,00 e depois zero. Aguarde a confirmação e confira o Placar. Entradas e re-buys não devem mudar.
5. No modo completo, registre/edite/exclua rodada. Confirme número/vencedor antes da exclusão e confira a independência do caixa.
6. Em ambiente de homologação, crie uma conta descartável; exclua-a pelo Poder de TcheTche. Confirme perda de acesso e ausência após recarregar. Nunca use uma conta real para testar essa ação. Davi303 deve permanecer protegido.
7. Confira arquivo, rankings, gráficos, retrospectiva e exportação com uma sessão de teste finalizada e financeiramente válida.

Referências oficiais consultadas: https://supabase.com/docs/reference/javascript/auth-admin-deleteuser e https://github.com/actions/setup-node .
