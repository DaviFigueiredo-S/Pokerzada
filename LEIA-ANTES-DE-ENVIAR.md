# Enviar pelo site do GitHub

Este pacote contém o mesmo código, testes, migrações e documentação da versão atualizada. Não contém node_modules nem arquivos com nome iniciado por ponto.

1. Extraia este ZIP em uma PASTA NOVA. Não misture com a pasta onde executou npm ci.
2. Abra essa pasta. Selecione TODOS OS ITENS DENTRO dela (dist, supabase, tests, scripts, package.json etc.).
3. No repositório GitHub, abra Add file > Upload files. Arraste os itens selecionados, não o ZIP e não uma pasta externa envolvendo o projeto.
4. Confirme o commit. Não execute npm ci nessa cópia antes do envio: isso criaria milhares de arquivos.
5. Na Vercel, mantenha a raiz do projeto na raiz do repositório. A configuração vercel.json mantém dist como saída e npm test como verificação.

## Configurações ocultas preservadas
O upload não apaga os arquivos existentes no GitHub. Se o repositório já possui .gitignore e .github/workflows/pages.yml, eles continuam no lugar.

Por causa do bloqueio do upload web, três arquivos foram guardados com nomes visíveis, SEM alterar o conteúdo:
- configuracoes-github/gitignore.txt -> .gitignore
- configuracoes-github/pages.yml -> .github/workflows/pages.yml
- configuracoes-github/nojekyll.txt -> dist/.nojekyll (arquivo vazio)

Esses arquivos não são necessários para executar o site na Vercel. O workflow é necessário para a publicação automática pelo GitHub Pages. O .gitignore evita enviar dependências e segredos no uso local do Git.

Se o repositório for novo ou essas configurações estiverem ausentes, use Add file > Create new file no GitHub e crie cada caminho de destino acima, copiando o conteúdo da respectiva cópia. Para .nojekyll basta uma linha vazia. O editor permite esses nomes; a restrição está no upload de arquivos ocultos.

Alternativa local: execute restaurar-configuracoes.ps1 com PowerShell e envie pelo GitHub Desktop. O script restaura os três caminhos originais sem sobrescrever configurações já existentes.

## O que não enviar
Não envie node_modules, test-results, playwright-report, .env ou chaves secretas.
A pasta node_modules é recriada com npm ci quando necessária e não faz parte do código do projeto.

## Testes e dados
Os arquivos funcionais são idênticos aos do ZIP atualizado de 29/10/2026. Consulte ATUALIZACAO-MOBILE.md para o registro de testes e implantação. Este pacote não altera contas, senhas nem dados do banco.