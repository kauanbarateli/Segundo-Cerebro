# Segundo Cérebro

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 15 App Router, React 19, TypeScript, Tailwind 4/CSS e tokens DS 2.1. Monolito modular com Core sem SDK, adapters servidor, Supabase pessoal e Vercel Pro informada pelo mantenedor. Estado técnico/versões em [doc18](docs/planejamento/18-convergencia-prototipo-20261025/01-diagnostico.md); não confundir o histórico T001 sem serviços com a aplicação atual.

## Users

Uso pessoal no computador e celular, isolado por Usuário. Sem espaço compartilhado. Contas existentes e cadastradas pelo fluxo administrativo; novos assinantes são etapa comercial posterior, sem abertura de vendas nesta execução.

## Product Purpose

Capturar, conectar e reencontrar informações pessoais com pouco esforço. O Início responde o que importa no dia usando os mesmos registros dos módulos.

## Operating Context

MVP operacional: Início, Capturar, Conhecimento, Tarefas, Calendário, Projetos, Hábitos, Financeiro, Cofre, Configurações, Integrações, Admin, onboarding facultativo e landing pública. Drive foi retirado (D032), sem apagar infraestrutura compartilhada. Restore é pós-lançamento (D078). D-084 retoma a implementação do doc18 em quatro frentes, com fidelidade ao protótipo. Merge e deploy continuam bloqueados até as validações.

## Capabilities and Constraints

- Módulos possuem UI/canais/Core/adapters e persistência reais; modo demo é separado. Provider com nome histórico demo não prova ausência de backend.
- Toda escrita de domínio emite evento na mesma transação. Entitlement difere de preferência; acesso é validado no servidor, incluindo URL/chamada direta.
- Capturar e Conhecimento preservam identidade, rascunhos, promoção e vínculos explícitos. Grafo persistente segue fase 2; global fase 3.
- Google Calendar somente leitura, até duas contas e fontes escolhidas. IA embutida e colaboração fora do MVP.
- Financeiro mantém Fatura derivada, valores em centavos, séries finitas e reservas de Metas sem reduzir saldo bancário.
- Hábitos têm cadência com vigência; editar frequência não reescreve passado.
- Cofre cifra no cliente, kit em duas partes e proteção de sessão; Admin consulta metadados/agregados, nunca conteúdo pessoal.
- Onboarding tem nove telas conectadas, entrada explícita, contas antigas opt-in, rascunho versionado e conclusão idempotente. Código presente não equivale a aceites concluídos.
- Tema conectado é salvo na conta; sincronização e instalação em iPhone 11/A35 foram relatadas pelo mantenedor, com alcance registrado em #12/#44.
- PWA não promete conteúdo privado offline. Share target ainda requer seu aceite/contrato; instalação não prova essa função.
- Banco usa migrations versionadas e aplicação supervisionada nos destinos autorizados; jamais CI/build/deploy/reset/seeds.
- Asaas está planejado em SPEC-07, com decisões já aprovadas. D077 autoriza onboarding/landing no recorte operacional, preservando checkout/billing/abertura comercial para depois.

## Brand Commitments

DS 2.1, Geist, marca “2” e texto pt-BR claro. O protótipo de 303 arquivos do doc17 é autoridade visual confirmada contra D:; [DESIGN](DESIGN.md) e doc18 registram adaptações e exceções. Não prometer funcionalidades indisponíveis.

## Evidence on Hand

- [Doc18](docs/planejamento/18-convergencia-prototipo-20261025/README.md): análise ad24, Preview 3403, inventário/issues, capturas comparativas e limitações.
- [Doc17/protótipo](docs/planejamento/17-evolucao-prototipo/prototipo/): referência exata de 303 arquivos.
- [Handoff PR120](docs/implementation/handoff-retomada-20261025-pausa-mvp.md): pacotes/evidências congelados, não editar.
- [Decisões](docs/planejamento/registro-de-decisoes.md), ADRs e contratos por domínio.

## Product Principles

1. Capturar com facilidade, organizar depois e reencontrar com contexto.
2. Vínculo conserva identidade e não duplica informação.
3. Segurança e isolamento acompanham toda apresentação.
4. O protótipo define o visual; contratos reais delimitam comportamentos.
5. Cada entrega distingue implementado, validado, pendente e adiado.

## Accessibility & Inclusion

Piso de 320 px, campos de 16 px, alvos de 44 px, foco visível, teclado, contraste medido e reduced motion. Ajustar área de toque/reflow quando o mock tiver controle menor, documentando o desvio. Não esconder overflow global para aprovar captura.

## Open Decisions

[Doc18/decisões](docs/planejamento/18-convergencia-prototipo-20261025/04-decisoes.md) é a referência de escolhas remanescentes. D081 mantém Projetos só com progresso; D082 define Hoje com abertas e concluídas; D083 planeja reveal protegido no Cofre. Paginação e transformação de “limpar formatação” precisam contrato explícito antes de alterar comportamento. Não reabrir a entrevista comercial já encerrada nem tratá-la como autorização de implementação.
