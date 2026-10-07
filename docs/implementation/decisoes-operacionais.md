# Decisões operacionais da implementação

Registro iniciado em 07/10/2026. Estas decisões conciliam instruções atuais com o planejamento aprovado; não alteram seu histórico nem atestam critérios de aceite já cumpridos.

## OP-001 — Repositório principal

Instrução do mantenedor em 07/10/2026: implementar e publicar em `git@github.com:kauanbarateli/Segundo-Cerebro.git`. Este destino prevalece sobre o nome e a localização propostos em D-026. `segundo_cerebro` e `novo-segundo-cerebro` são fontes históricas; não são destinos de novas issues, commits ou pushes. Nenhum arquivamento remoto dos legados é autorizado implicitamente por este registro.

O clone de execução fica no workspace de desenvolvimento. O planejamento é copiado para `docs/planejamento/` para acompanhar o código; sua pasta original permanece fonte documental. Evite versionar caminhos pessoais como requisito de execução.

## OP-002 — Migrations com aplicação manual

A instrução atual do mantenedor exige registrar alterações de banco em migrations e deixar sua aplicação para execução manual posterior. Ela substitui as passagens históricas que determinavam “migrations só por pipeline” ou reset automático do banco em CI.

Agentes produzem arquivos SQL, documentação e validações estáticas; **não executam migrations, reset, seeds ou push de schema em banco local ou remoto**. Build, CI e deploy não devem aplicar schema. Testes que dependem de um banco já preparado devem informar o pré-requisito e permanecer pendentes até aplicação manual e execução confirmadas. Credenciais ou um projeto vinculado não substituem essa autorização.

## OP-003 — Ordem e evidência da entrega

O início é T-001 / M0: base compilável, contratos de camadas, docs de domínio, skills e portões de qualidade. DS 2.1 orienta a página provisória; a implementação completa de tokens, primitivas, shell e PWA segue seus tickets. O protótipo não antecipa autenticação, persistência, grafo visual de produção ou integrações.

O agente responsável revisa entregas paralelas antes de incorporá-las. Cada issue conserva pendências e limitações; instalação de ferramenta, existência de workflow e teste local não são sinônimos de validação remota ou aceite concluído. Mensagens de commit, issues e demais publicações não incluem coautoria.

O snapshot do diagnóstico omite a reprodução literal de um trailer de autoria adicional do histórico, para respeitar a instrução atual em todo conteúdo publicado. O original documental não foi alterado.

## OP-004 — Conciliação dos ADRs

D-019 adota cinco ADRs com Plano Pessoal implícito sem billing e eventos do Cofre limitados a metadados. As versões portadas incorporam essas conciliações e as extensões de glossário do doc 05. ADR-0002 esclarece que projeções de leitura podem usar adapters no servidor conforme doc 02 §3, enquanto regras e escritas atravessam o Núcleo.

## OP-005 — Acesso GitHub isolado do Sistema VOE

Leitura dos históricos, push de código e criação/atualização de issues foram confirmados. O token da conta `kauanbarateli` é selecionado somente no ambiente de cada comando; a conta global da CLI permanece inalterada. O token não inclui `workflow`, portanto foi gerada uma chave SSH exclusiva para este repositório e cadastrada pelo mantenedor como deploy key com escrita.

A seleção da nova chave usa `core.sshCommand` somente na configuração local deste clone. Não houve alteração de chaves anteriores, configuração SSH global ou autenticação do Sistema VOE. A chave privada não faz parte do repositório.

## Fontes rastreáveis

| Fonte | Revisão consultada | Uso |
|---|---|---|
| `kauanbarateli/novo-segundo-cerebro` | `20914ce61fefa268ab06fb52d6e0c27fad7e7143` | Glossário, ADRs, convenções de agentes e 25 skills de engenharia/produtividade |
| `kauanbarateli/segundo_cerebro` | `ffdf06435a5b8dcd047574172cddf1cc772dfd09` | História do aplicativo; outras branches devem registrar seus próprios SHAs quando usadas |
| Planejamento local aprovado | D-019/D-030 e documentos até a revisão de 29/09/2026 | Especificações, DS 2.1, roadmap e tickets; snapshot em `docs/planejamento/` |
| Impeccable do planejamento | `metadata.version: 4.4.0`; `scripts/VERSION: 0.1.6` | Skill integral em dois diretórios, sem binário/cache; hashes no `skills-lock.json` |

A versão declarada da skill Impeccable e a versão do launcher são registradas separadamente. Copiar seus arquivos não atesta funcionamento do detector nem instalação de runtime. Consulte [catálogo de skills](../../skills/README.md).
