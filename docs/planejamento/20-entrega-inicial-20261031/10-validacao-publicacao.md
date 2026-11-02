# Validação da publicação documental

Esta verificação cobre o planejamento, não a implementação ou produção.

- Base de código: `bd35288404c493d1b03f7a1a0208f808cc2079a2`, com PR #120 incorporado.
- Skill `to-tickets` lida; tracker/labels consultados, tickets verticais com dependências explícitas.
- 25 tickets preparados: 6 A, 7 B e 12 posteriores; 32 relações de bloqueio.
- Pacote v1.2 preservado integralmente: 65 arquivos, comparação byte a byte e manifesto SHA-256.
- Referências locais e caminhos do mapa técnico conferidos; as referências históricas permanecem identificadas como históricas.
- Revisão cruzada do contrato de cadastro/UTM: autoridade pré-Auth distinta da sessão de usuário e limites de agregação documentados.
- Corpos e comentários de issues sobrepostas consultados; nenhuma issue anterior fechada ou reescrita.
- Scanner de segredos executado no checkout, sem assinaturas detectadas; `git diff --cached --check` passou.
- [Recibo de publicação GitHub](evidencias/publicacao-github.json): 25 corpos/títulos/rótulos e 32 bloqueios nativos lidos novamente e conferidos com os arquivos de execução.
- [Validação documental](evidencias/validacao-documental.json): links locais, mapa de caminhos, estrutura dos tickets, ordem de dependências e integridade do pacote anterior.

O registro final de publicação, IDs reais e bloqueios fica no [índice de tickets](05-registro-de-tickets.md). Os prompts referenciam a mesma documentação e limitam execução à primeira etapa.

Nenhum teste do aplicativo, migration, escrita de banco ou deploy foi realizado nesta publicação. O CI disparado pelo PR deve ser consultado pelo seu status real; não é apresentado como concluído por este documento. A branch documental tem preview automático desativado pela entrada específica no `vercel.json`, sem mudar regras de outras branches.
