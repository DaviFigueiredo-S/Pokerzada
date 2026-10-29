# Atualização Dark Cyber e TcheTche — 27/10/2026

## Retomada do trabalho

O projeto existente em HTML/CSS/JavaScript foi preservado. Na retomada, as migrações, a função de cadastro, os controles administrativos e a maior parte do novo tema já estavam salvos. Faltavam a revisão visual, o atalho pessoal de contagem, testes adicionais e a atualização desta documentação. A arquitetura não foi substituída.

## Alterações entregues

- Arquivo das Pokerzadas: botão direto Excluir partida, com nome/data, aviso sobre estatísticas e motivo obrigatório. A exclusão é lógica; o principal mantém a recuperação existente.
- Poder de TcheTche: Davi303 concede/retira o papel admin. TcheTches gerenciam usuários comuns/organizadores, sem conceder admin nem alterar o principal ou outros admins. Contas removidas ficam desativadas e podem ser reativadas; o histórico permanece.
- Servidor: cada operação verifica o papel e a situação atual da conta. Uma conta desativada perde leitura/escrita mesmo com um token anterior. Alterações são auditadas.
- Nomes: novas colisões de usuário/apelido são rejeitadas no cadastro e na edição, incluindo variações de maiúsculas, acentos portugueses e espaços repetidos. Contas desativadas reservam seus nomes. Perfis antigos sem conta não reservam nomes.
- Dois perfis antigos com apelido Bruno foram preservados, sem fusão nem renomeação automática. A tela de jogadores identifica colisões existentes por um trecho do ID; os nomes de login continuam distintos.
- Demonstração removida da entrada pública. Os dados sintéticos permanecem somente como suporte interno de testes/compatibilidade, sem botão de acesso.
- Tema Dark Cyber / Luxury Night Club em CSS puro: fundo noturno, painéis translúcidos, cyan/roxo, títulos dourados, logo SVG e mesa oval com aro metálico. Gráficos e cartões exportados acompanham a paleta.
- Hover suave em botões, cartões e avatares; redução de animações respeitada. Ajustes de assentos no celular e marca compacta no tablet.
- Minha posição na mesa: apenas o participante ligado à conta atual recebe destaque Você e atalho Contar minhas fichas. Visitantes de uma mesa não recebem o atalho. Contagens continuam usando o mesmo autosave e as mesmas permissões anteriores.

## Arquivos principais

| Arquivo | Mudança |
| --- | --- |
| dist/js/app.js | Logo, acesso, arquivo, gestão de contas, nomes e assento pessoal |
| dist/style.css | Novo tema e responsividade, preservando estrutura |
| dist/js/visuals.js | Paleta de gráficos e imagem da retrospectiva |
| supabase/functions/poker-auth/handler.js | Verificação de nome disponível no cadastro |
| supabase/migrations/20261027142225_nightclub_admin_unique_identity.sql | Papel admin, hierarquia, desativação e unicidade de nomes |
| supabase/migrations/20261027142446_registration_name_availability.sql | Consulta de disponibilidade exclusiva do servidor |
| tests/auth.test.mjs | Cobertura do cadastro com consulta de disponibilidade |
| tests/ui-permissions.test.mjs | Permissões, acesso público, assento e ações do arquivo |
| tests/nightclub.integration.sql | Testes de permissões e identidade no PostgreSQL |

As duas migrações já foram aplicadas no projeto Supabase atual; a função poker-auth foi atualizada. Não execute as mesmas migrações novamente nesse projeto. Para outra instalação, siga a ordem das migrações e publique a função correspondente. Nenhuma senha foi modificada nesta entrega.

## Verificação executada

- 54 testes Node aprovados: autenticação simulada, cálculos, rodadas/cartas, autosave, falhas de conexão, pendências, exclusão/recuperação, estatísticas e controles da interface.
- tests/collaborative.integration.sql passou no PostgreSQL real: perfil ligado à conta, idempotência, contagem própria, bloqueio de alterações alheias, conflitos, zero, cores individuais e fechamento.
- tests/nightclub.integration.sql passou no PostgreSQL real: promoção/revogação, proteção do principal, bloqueio de promoção indevida, nomes normalizados, desativação com token existente, exclusão e recuperação.
- Ambas as integrações usaram ROLLBACK: nenhum usuário, partida ou mudança de permissão de teste foi mantido.
- Sintaxe JavaScript conferida. Página inicial e formulário de cadastro inspecionados no navegador, inclusive viewport móvel de 390 × 844. Não apareceram erros JavaScript no fluxo público observado.
- Mesa com seis participantes inspecionada com um fixture local isolado gerado pela interface atual, no desktop, celular e tablet de 800 × 900. O fixture não acessa nem grava o banco.

Limites: não houve novo login real com a senha de Davi303 nem repetição completa dos fluxos autenticados pelo navegador nesta revisão. O login/cadastro já havia sido confirmado pelo titular antes desta atualização. A verificação de permissões acima ocorreu diretamente nas operações reais do banco, com contas temporárias revertidas. Não foi realizado teste em dois celulares físicos nem novo download do cartão da retrospectiva.

## Como conferir no seu PC

1. Execute npm run dev na pasta do projeto e abra http://127.0.0.1:4173. Se uma versão antiga estiver aberta, atualize com Ctrl+F5. Durante esta revisão foi usado também http://127.0.0.1:4180.
2. Entre normalmente. Em Poder de TcheTche, escolha a conta e confirme a concessão/remoção do poder ou a desativação. Davi303 aparece protegido.
3. No Arquivo, escolha uma sessão de teste, clique Excluir partida e confira nome/data antes de confirmar. Ela sai das estatísticas; o principal pode recuperá-la.
4. Tente cadastrar/editar um nome já utilizado: a mensagem solicita outro nome.
5. Em uma mesa da qual sua conta participa, confira Você e Contar minhas fichas. Altere a contagem, aguarde a confirmação de salvamento e confira o Placar.
6. Saia da conta: a entrada pública oferece login/cadastro, sem demonstração.

## Continuidade

A versão local e o pacote estão atualizados. Esta entrega não publicou o frontend nem fez push para um repositório remoto. Para retomar, leia este arquivo antes dos registros históricos em VERIFICACAO.md.
