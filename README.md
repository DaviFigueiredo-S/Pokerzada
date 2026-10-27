# A Pokerzada Lendária ♣️

Plataforma para registrar partidas **presenciais** entre amigos. HTML5, CSS3 e JavaScript, sem framework ou dependências npm.

## Executar

Requer Node.js 22 ou mais recente.

```powershell
cd "C:\Segunda memoria Eterna\pokerzada-lendaria"
npm run dev
```

Abra http://127.0.0.1:4173. Em outro computador, use o caminho onde extraiu o projeto.
Não abra index.html por file://, pois a aplicação usa módulos JavaScript.

- **Entrar no clube** acessa dados privados compartilhados no Supabase.
- **Criar minha conta** cadastra um integrante; um administrador autorizado libera o acesso à turma.
- Os registros reais sobrevivem ao fechamento do navegador. O organizador pode precisar entrar novamente.
- Jogadores reais são vinculados às contas cadastradas. Perfis antigos foram arquivados, preservando o histórico.

## Situação atual — 27/10/2026

Veja ATUALIZACAO-NIGHTCLUB.md para alterações, testes, arquivos e instruções da entrega mais recente. Cadastro e login já foram confirmados pelo titular; Davi303 está inicializado e sua senha permanece inalterada. As migrações da atualização e a função poker-auth já estão aplicadas no Supabase existente. O frontend local foi atualizado; não houve publicação nesta entrega.

## Funcionalidades implementadas

- Perfis permanentes vinculados às contas, foto reduzida, edição e desativação com histórico preservado.
- Sessões com Ancião, seleção dos presentes, entrada/re-buy padrão de R$ 5,00, modos Express e Lendária, três modalidades para registro opcional de cartas.
- Mesa adaptativa, painel individual, entradas automáticas, re-buys, presença, estornos e ajustes auditados.
- Cinco denominações com cores configuráveis. Contador separado da compra, com salvamento automático após 650 ms e atualização do valor recebido. Zero é válido; o botão manual continua disponível.
- Dez categorias de mãos na ordem solicitada, vencedor sem categoria, empate, cartas visuais, numeração automática, edição e exclusão lógica. As observações antigas são preservadas; os campos de observação e número manual foram retirados do formulário. Rodadas não movimentam dinheiro.
- Fechamento em centavos, campos pendentes distintos de zero, divergências bloqueadas, placar, snapshots de fechamento e reabertura auditada.
- Arquivo com filtros e relatórios; rankings financeiros, re-buys, participação e rodadas; conquistas com critérios visíveis.
- Sete gráficos com seleção de jogadores, períodos, pontos interativos e tabela acessível.
- Retrospectiva mensal, anual, personalizada e histórica; seleção de 1 a 4 destaques no cartão; opções de ocultar dinheiro e fotos.
- Exportações JSON/CSV, auditoria, redução de animações, navegação móvel.
- Cadastro/login sem e-mail real, principal com senha definitiva escolhida pelo titular e Poder de TcheTche para liberar leitura/promover/rebaixar usuários.
- Exclusão lógica de partidas por organizadores, recuperação pelo principal e recálculo das estatísticas.
- Autenticação Supabase, permissões verificadas pelo servidor, RPC transacional, idempotência, controle de revisão e recuperação de envio ambíguo.

## Arquitetura e integridade

`dist/js/domain.js` contém cálculos puros e validações; `repository.js` contém os adaptadores local e Supabase; `app.js` contém a interface; `visuals.js` contém gráficos e exportação Canvas.

O banco usa tabelas de jogadores, sessões, configurações, contas/permissões, operações e auditoria. Uma sessão é um agregado JSONB transacional: participantes, entradas, contagens, rodadas, cartas, apurações e fechamentos. As views relacionais expõem esses itens para consulta. Todas as alterações de uma sessão são validadas juntas; não existem duas fontes concorrentes para o mesmo saldo.

- Dinheiro: inteiros em centavos, sem cálculo em ponto flutuante.
- Resultado: recebido − entrada − re-buys − ajustes individuais.
- Conferência: investido = recebido + ajustes de caixa. Um ajuste positivo de caixa representa retirada justificada; negativo, entrada externa. Seu motivo é obrigatório.
- Estatísticas: somente sessões finalizadas, completas e com diferença zero.
- Empates: separados de vitórias individuais; gráficos de categorias contabilizam cada vencedor registrado, com explicação na tela.
- Correções: reabertura exige motivo, retira a sessão dos rankings até novo fechamento e preserva o fechamento anterior.
- Ancião é uma identificação histórica. A autorização real vem do usuário autenticado cadastrado em `poker_accounts`, com papel e liberação verificados a cada operação.
- UUID de operação evita repetição após falha de conexão. Revisões bloqueiam edição de sessão desatualizada. Novas rodadas são a exceção: o servidor bloqueia a linha e atribui o próximo número, mesmo quando outro registro chegou antes.
- Envios pendentes ficam associados ao projeto e usuário no navegador. Reenviar reutiliza o UUID original.
- A aplicação não promete funcionamento offline completo. Preserva a última leitura e a tentativa pendente; reconcilia após reconexão.
- Realtime atualiza alterações e polling a cada 10 segundos funciona como reconciliação.

Fotos são reduzidas para 240 × 240 e armazenadas como data URL nas linhas protegidas, com limite validado no servidor. Não há bucket público. Para grandes volumes de fotos, migrar para Storage privado; o grupo atual não depende disso.

## Segurança

Todas as tabelas públicas têm RLS. Usuários sem autorização não conseguem ler os dados nem chamar as operações. Escrita direta de tabelas é revogada. Helpers privilegiados ficam em schema privado, usam search_path fixo e verificam auth.uid. Views usam security_invoker.

As chaves publicáveis identificam o projeto; não concedem administração. Nunca coloque `service_role`, `sb_secret_`, senha do banco ou tokens de Git no JavaScript, no ZIP ou no repositório.

Auditoria é imutável para o cliente. O proprietário do banco, por definição, mantém poderes administrativos. Faça exportações regulares e mantenha o backup do provedor conforme sua política.

## Testar

```powershell
npm test
```

54 testes automatizados passaram nesta atualização. Os testes SQL atuais são tests/collaborative.integration.sql e tests/nightclub.integration.sql; ambos passaram no PostgreSQL real com rollback. Os scripts SQL antigos documentam versões anteriores e podem pressupor os perfis originais.

Veja ATUALIZACAO-NIGHTCLUB.md para o escopo realmente conferido e os limites dos testes.

## Publicar

**Vercel:** importe seu repositório, selecione Other e mantenha saída `dist`. O arquivo `vercel.json` executa os testes no build. Nenhuma compilação do frontend é necessária.

**GitHub Pages:** envie o projeto ao seu repositório, configure Settings → Pages → Source → GitHub Actions e execute o workflow incluído. Ele roda os testes e publica somente `dist`, nunca os scripts administrativos SQL.

Não há banco dentro do GitHub Pages: o frontend conecta ao Supabase configurado.

Em uma instalação nova, inicialize o principal pelo guia. No projeto atual ele já existe. Valide entrada, re-buy e fechamento em uma sessão identificada como teste em ambiente apropriado, abra em dois dispositivos e confirme atualização e recuperação. Não conte esses testes como partidas da turma.

Referências oficiais consultadas:
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://vercel.com/docs/project-configuration/vercel-json
- https://supabase.com/docs/guides/database/postgres/row-level-security


