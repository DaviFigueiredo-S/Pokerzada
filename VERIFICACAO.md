# Registro de retomada e verificação — 25/10/2026

## Encontrado após a interrupção

Já estavam salvos: frontend HTML/CSS/JS, domínio financeiro, repositório de dados, gráficos/Canvas, SQL, servidor local, testes de domínio e identidade do projeto Sites. Não havia publicação confirmada, conta de organizador, documentação final ou pacote de entrega. O esquema SQL ainda precisava ser executado e validado no Supabase.

## Trabalho retomado

- Preservados e ampliados os módulos existentes.
- Supabase conectado ao projeto poker existente; esquema executado, nove perfis inseridos, frontend configurado com chave publicável.
- Corrigidos dois erros de SQL, validações de payloads nulos e políticas internas.
- Corrigida separação demo/nuvem em falhas de login.
- Recuperação de envios agora persiste por usuário/projeto e mantém idempotência após falha de leitura.
- Leituras atrasadas não regridem a revisão nem restauram dados após logout.
- Rascunhos de apuração separados ao trocar de sessão; confirmação de fechamento usa a revisão que foi conferida.
- Backups importados recebem validação estrutural.
- Cartões permitem escolher os destaques e ocultar valores/fotos.
- Servidor local encontra dist a partir do próprio arquivo, independentemente do diretório de execução.
- Guias de acesso, publicação, testes e configurações de deploy adicionados.

## Verificado

| Área | Evidência |
| --- | --- |
| Domínio e repositório | 26 testes Node passaram, zero falhas |
| PostgreSQL real | Teste transacional passou com rollback integral |
| Dinheiro | Entradas, re-buy, contagem R$ 5,00, ausência versus zero, divergência de R$ 0,01, bloqueio de fechamento |
| Independência | Rodadas e contagens não alteram investimento |
| Concorrência | UUID repetido não duplica; revisão antiga rejeitada |
| Segurança | Anônimo e usuário sem autorização bloqueados; escrita direta bloqueada |
| Correção | Fechamento bloqueado, reabertura justificada, snapshot anterior preservado |
| Recuperação | Demo reaparece após reabertura; falhas de rede e persistência cobertas por testes |
| Interface | Sessão com nove jogadores e entrada total R$ 45,00; re-buy eleva para R$ 50,00 |
| Celular | Mesa e painel individual inspecionados em 390 × 844 |
| Histórico/gráficos | Sessão finalizada de teste com Marcos R$ 0,00, Anthony −R$ 5,00, Davi +R$ 5,00; comparação confere |
| Retrospectiva | Prévia PNG 1080 × 1350 e 1080 × 1080, destaques escolhidos e valores ocultos |
| Segurança Supabase | Advisor sem apontamentos |
| Desempenho Supabase | Apenas INFO de índices recém-criados ainda não usados; banco sem partidas reais |

Os testes de navegador usaram somente a demonstração local. Os testes do banco foram revertidos. Nenhuma partida fictícia foi adicionada ao histórico real.

O aviso informativo de índices não usados pode ser revisto depois que existirem partidas reais:
https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

## Ainda não confirmado / dependências externas

- Primeiro organizador: conta e credenciais ainda precisam ser criadas pelo titular.
- Login real no frontend, Realtime e sincronização entre dois aparelhos: aguardam essa conta. A autorização e as operações foram testadas diretamente no PostgreSQL.
- Download do PNG: a imagem foi gerada corretamente; a espera pelo evento de download travou na automação. Não foi declarado como teste concluído.
- Publicação: tentativa de envio pelo fluxo Sites falhou na conexão HTTPS com o servidor Git. Sem URL de produção.
- GitHub: repositório de destino não informado/criado; nenhum envio foi realizado.
- Navegadores móveis físicos, leitores de tela e restauração de backup de produção: não testados nesta sessão.

Estas pendências impedem chamar a implantação de produção de concluída. O código implementado e seus testes seguem no pacote.

