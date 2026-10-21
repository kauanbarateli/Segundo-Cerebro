# Base, escopo e precedência

## Corte consultado

| Fonte | Revisão / estado em 21/10/2026 | Papel |
|---|---|---|
| `main` | `f3d18960a41076e99aa60dcc9f6b46967970ebb5` | Código de produção versionado; PR #48 incorporado |
| PR #47 | `57a2967f34a11cf985e62827d67179335474f477`, aberto | Pacote visual anterior e primeiro onboarding; referência histórica |
| PR #69 | `3433c49b9e0e59546ed564222f3c3de814e71098`, aberto contra main | Contratação/gestão/onboarding, decisões D-034–D-064 |
| PR #70 | `b67f58ac3973fcef5f45daa23f36cdf84432a3fb`, aberto contra #69 | Fontes legais, checklist e decisões D-065–D-075; revisar delta antes de integrar |
| Protótipo | Snapshot de 303 arquivos em `prototipo/`, hashes no manifesto | Composição e interações mais recentes, sem backend |
| Tracker | #50–#68 abertas; #52/#53 sem comentários no corte | Escopo comercial já publicado; não demonstra o WIP local da outra frente |

Links imutáveis: [main consultada](https://github.com/kauanbarateli/Segundo-Cerebro/tree/f3d18960a41076e99aa60dcc9f6b46967970ebb5), [pacote comercial](https://github.com/kauanbarateli/Segundo-Cerebro/tree/3433c49b9e0e59546ed564222f3c3de814e71098/docs/planejamento/16-checkout-asaas-onboarding), [fonte legal](https://github.com/kauanbarateli/Segundo-Cerebro/tree/b67f58ac3973fcef5f45daa23f36cdf84432a3fb/src/lib/legal).

Reconsultar HEAD, PRs, issues e alterações locais ao assumir. Não resetar, descartar ou sobrescrever o trabalho em andamento de #52/#53. Registrar o ponto de retomada antes de integrar novas fatias.

## Precedência por assunto

1. Instruções atuais do mantenedor e decisões confirmadas deste pacote.
2. Contratos reais de domínio, segurança e decisões comerciais posteriores; preservar funcionalidades existentes ausentes da demo.
3. DS autoral em `design-system/tokens/tokens.json`: fonte de cores, Geist, acessibilidade e motion. CSS gerado não vira fonte de tokens.
4. Snapshot deste pacote para composição e interação visual; divergências explícitas estão no mapa e contratos.
5. Doc 15 e demais referências anteriores, apenas onde não substituídos. Imagens externas são exemplos de composição, não autoridade de regras ou paleta.

A frase histórica “sem billing” em main foi superada pelas decisões comerciais do mantenedor publicadas no PR #69. A restrição histórica por Vercel Hobby em D-075 foi superada pela informação atual de **Vercel Pro**. Integrar documentação operacional de modo consciente; não apagar histórico nem interpretar Pro como homologação técnica ou abertura automática de vendas.

## Escopo coberto e preservação

Todos os módulos do protótipo têm destino: Conheça/checkout/legais/onboarding; Início; Capturar; Tarefas; Calendário; Conhecimento; Projetos; Hábitos; Financeiro; Cofre; Atividade; Integrações; Configurações. Busca global, PWA, Admin e autenticação reais são regressões obrigatórias mesmo sem redesenho específico. O Cofre mantém cifra ponta a ponta e recovery; nunca recebe o motor fictício do HTML.

Drive continua retirado; sua infraestrutura privada compartilhada pode evoluir para imagens sem reativar a aba. Grafo persistente, colaboração, IA, escrita Google, Open Finance e importação bancária não entram por associação visual. Participantes de agenda não criam contas da plataforma nem convites.

Não transplantar `window.App`, localStorage da demo, hash router, seeds, IDs fictícios, data fixa 17/10/2026, HTML bruto, fotos fictícias de convidados ou status comercial simulado. Reutilizar casos de uso, adapters, ações autenticadas, RLS, eventos atômicos e idempotência.

## Método grill-with-docs

Foram lidas `.agents/skills/grill-with-docs/SKILL.md`, `grilling/SKILL.md` e `domain-modeling/SKILL.md`. A árvore de decisão está no doc 03. Fatos foram investigados em paralelo no código; somente as duas escolhas de negócio não resolvidas foram perguntadas e respondidas. A publicação deste planejamento e das issues já foi solicitada expressamente. Não há nova rodada de aprovação genérica do pacote.

Também foram lidos Impeccable 4.4 e `shape`; o contexto do projeto foi carregado. A direção visual está estabelecida: preservar e especificar, sem redesenhar. Não foi feito polimento de código de produção neste PR.
