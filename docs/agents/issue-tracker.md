# Issue tracker: GitHub

Issues e specs vivem em [kauanbarateli/Segundo-Cerebro](https://github.com/kauanbarateli/Segundo-Cerebro/issues). Use a CLI `gh`, indicando `--repo kauanbarateli/Segundo-Cerebro` quando houver risco de inferir um clone antigo.

## Acesso e publicação

Antes de escrever, confira a identidade ativa e a permissão no repositório. SSH para `git push` e o token HTTPS usado pelo `gh` são autenticações independentes: leitura do repositório não prova permissão de criar ou atualizar issues. Registre resultados reais na issue de fundação; não herde o diagnóstico de autenticação de agosto de 2026 do repositório antigo.

Preserve as configurações e chaves existentes, especialmente as do Sistema VOE. Se necessário, o acesso SSH novo deve usar chave exclusiva do projeto, conforme instrução do mantenedor. Nunca grave chaves privadas ou tokens no repositório.

Corpos multilinha devem ser escritos em arquivo temporário e enviados com `--body-file`, preservando o texto literal. Todos os conteúdos enviados seguem a regra do mantenedor: sem coautoria.

```powershell
gh issue view 1 --repo kauanbarateli/Segundo-Cerebro --comments
gh issue list --repo kauanbarateli/Segundo-Cerebro --state open --json number,title,labels,assignees,milestone
gh issue create --repo kauanbarateli/Segundo-Cerebro --title "Título objetivo" --body-file <arquivo-temporario>
gh issue edit <numero> --repo kauanbarateli/Segundo-Cerebro --body-file <arquivo-temporario>
gh issue comment <numero> --repo kauanbarateli/Segundo-Cerebro --body-file <arquivo-temporario>
```

## Planejamento e andamento

O [doc 13](../planejamento/13-tickets.md) é a fonte inicial: épico = spec-issue, fase = milestone, ticket = entrega verificável. Preserve os IDs SPEC e T nos títulos para rastreabilidade. Cada ticket inclui objetivo, escopo, critérios de aceite, dependências, validação e pontos em aberto; detalhes de implementação referem-se a áreas e contratos, sem congelar caminhos prematuramente.

Use sub-issues e dependências nativas quando disponíveis. Se indisponíveis, use task list no épico e referências `Part of #<numero>` / `Blocked by: #<numero>` nos tickets. Só inicie dependentes quando o bloqueio real tiver sido resolvido.

Atualizações distinguem **implementado**, **validado**, **pendente** e **bloqueado**, com commits, comandos e links de CI quando existirem. Feche apenas após comprovar todos os critérios de aceite, incluindo testes negativos e validações remotas exigidas. Build local passando não prova CI verde; emitir SQL não prova migration aplicada.

## Convenções das skills

- “Publish to the issue tracker”: criar ou atualizar a issue correspondente no repositório principal, dentro da autorização da tarefa.
- “Fetch the relevant ticket”: ler a issue e seus comentários, labels, dependências e critérios atuais.
- Papéis de triagem: [triage-labels.md](triage-labels.md).
- `/wayfinder`, quando solicitado, organiza uma issue mapa e tickets filhos; use os labels próprios apenas ao adotar esse fluxo. Sua ausência não bloqueia o plano já aprovado.

**PRs as a request surface: no.** PRs são superfície de revisão de implementação, não entrada automática de pedidos de Funcionalidade. O GitHub compartilha numeração entre issues e PRs; resolva o tipo antes de comentar ou fechar.
