# Primeiro acesso de organizador

O projeto já está configurado e protegido. Não existe conta administrativa automática e informar o nome Davi ou qualquer outro apelido não concede acesso.

1. No dashboard do projeto Supabase, abra Authentication → Users.
2. Crie a conta do organizador pelo fluxo do dashboard. Escolha pessoalmente o e-mail e a senha; não envie a senha pela conversa nem a grave no código.
3. Confirme a identidade/e-mail pelo fluxo disponível. Copie o UUID do usuário criado.
4. No SQL Editor, execute o bloco abaixo substituindo somente o UUID e o nome de exibição:

```sql
insert into public.poker_organizers(user_id,display_name,active)
values ('UUID-DO-USUARIO-AUTENTICADO'::uuid,'Davi',true)
on conflict (user_id) do update
set display_name=excluded.display_name,active=true;
```

5. Abra a aplicação, clique em **Entrar no clube** e informe seu e-mail e senha. A URL e a chave publicável já estão preenchidas na configuração avançada.
6. Para outro organizador, repita com outra conta. Os nove jogadores não precisam ter contas.
7. Para revogar um organizador, marque `active=false` na linha correspondente. A verificação no banco passa a bloquear as próximas operações e consultas, inclusive com token ainda válido.

Não adicione políticas públicas de leitura/escrita para resolver problemas de login. Se o login autentica mas aparece “Organizador não autorizado”, confira o UUID, o projeto selecionado e o campo active.

## Instalação em outro projeto

`001_schema.sql` é o script consolidado para um projeto novo. Execute uma única vez no SQL Editor. No projeto poker desta entrega ele **já foi aplicado**; não precisa executar de novo. O arquivo contém políticas que não devem ser recriadas cegamente.

Atualize `dist/config.js` com a URL e uma chave **publicável** do novo projeto. Depois crie e autorize a conta conforme acima.

## Recuperação e backups

A exportação JSON inclui jogadores, sessões, configurações e auditoria que o organizador consegue consultar. A importação pela interface é restrita à demonstração, para inspecionar o backup sem sobrescrever o banco real.

A restauração de produção deve ser feita pelo responsável pelo banco usando um backup verificado e um procedimento transacional. Não existe botão que substitua silenciosamente o histórico real. Dados de autenticação não fazem parte da exportação do aplicativo.

