# Atualização de 29/10/2026 — celular, perfil e administração

Este documento complementa os relatórios de 28/10, que descrevem a entrega anterior.

## Alterações incluídas
- Minha conta: escolher imagem da galeria ou capturar pela câmera, recortar e salvar como rosto; foto também no ícone superior.
- Seletor com os nomes dos 16 trajes e prévia imediata.
- Mesa visível em telas pequenas, controles da conta ajustados e navegação centralizada.
- Texto Re-Buy no lugar de RB.
- Encerramento restrito aos perfis autorizados; jogador comum continua podendo contar suas fichas.
- Deletar conta permanente com confirmação simples, preservando a proteção da conta principal.
- Exclusão permanente de partidas já removidas, exclusiva do administrador principal, com confirmação e auditoria.

## Verificação executada
- 74 testes Node/SQL passaram na etapa anterior desta atualização.
- 8 testes de navegador passaram na etapa anterior, incluindo câmera simulada, trajes e telas pequenas.
- O teste adicional de exclusão permanente pela interface foi executado após a reconexão e passou: 1/1.
- Assim, os 9 cenários de navegador foram verificados, em execuções separadas.
- Não foram feitos testes em aparelhos físicos iPhone/Samsung nem exclusões de contas ou partidas reais para teste.

## Banco e publicação
As migrações legado_personagens_exclusao_contas e mobile_profile_permanent_session foram aplicadas ao projeto Supabase existente durante esta atualização. As funções poker-auth (v4) e poker-profile (v1) também foram publicadas. Isso atualiza as informações de implantação pendente nos relatórios anteriores.

Não reaplique cegamente as migrações nesse projeto. Para outro banco, siga as instruções de instalação e aplique as migrações em ordem.
O frontend não foi publicado automaticamente: os arquivos prontos para hospedagem estão em dist.
A senha existente do administrador não foi alterada.

## Executar localmente
Instale Node.js 22 ou mais recente. Na pasta extraída:
    npm ci
    npm run dev

Abra http://127.0.0.1:4173. A câmera exige permissão do navegador e HTTPS ou localhost.
O ZIP não inclui node_modules, resultados temporários, screenshots nem segredos de servidor.