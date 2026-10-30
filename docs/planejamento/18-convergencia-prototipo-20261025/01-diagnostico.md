# Diagnóstico técnico e reconciliação

Base de código: ad24a6b; datas, hashes e gradação de evidência no [índice](README.md). “Implementado” abaixo significa caminho encontrado em UI/canal/domínio, não homologação integral.

## Arquitetura aproveitável

| Camada / área | Estado observado | Consequência |
|---|---|---|
| `src/core/` | 98 arquivos de regras/contratos puros por domínio | Manter sem React, Next ou SDK. |
| `src/adapters/` | 68 arquivos; banco, memória, cifra e observabilidade | Reusar stores, CAS, transações, eventos e recibos. |
| `src/app/` | App Router público/Auth/workspace/onboarding e APIs finas | Preservar rotas reais/deep links; não portar hash-router do demo. |
| `src/components/ui/`, `layout/`, `features/` | 32 arquivos de primitivas; shell/editor/controles compartilhados; 192 arquivos de features em 16 áreas | Compor sobre componentes existentes; compartilhar sem importar uma feature em outra. |
| `src/lib/demo/` | Provider escolhe aplicação conectada com serverUserId ou memória sem usuário | Nome histórico não prova dados falsos; não fazer refatoração de nomes como pré-requisito visual. |
| `design-system/` | Tokens JSON, CSS gerado, Geist, marca e verificadores | Reutilizar DS 2.1 e aliases; medir os pares reais após ajustes. |
| `supabase/` | 27 migrations e SQL Editor | Não editar histórico nem aplicar schema nesta auditoria. Instalação 001–027 de homologação é evidência anterior; produção precisa inventário próprio antes do corte. |
| `tests/`, workflows e scripts | Core, adapters, navegador, SQL descartável, Auth/Admin, nativos e operações | Testes pesados no GitHub; resultados vinculados ao SHA e ambiente. |

Manifesto observado: Next 15.5.28, React 19.2.8, TypeScript ~5.9.3, Supabase SSR 0.12.7 / JS 2.117.2, Tiptap 3.31.4, Serwist 9.5.13; Vitest 4.1.12, Playwright 1.63.0, PGlite 0.5.8, ESLint e dependency-cruiser. Esses números descrevem a base, não uma recomendação de upgrade.

A fronteira em `.dependency-cruiser.cjs` impede Core→SDK, UI→feature, imports entre features, ciclos e banco no cliente. `check:layers` deve continuar obrigatório quando a composição mudar.

## Contratos que a aparência não pode quebrar

- Usuário é a unidade de isolamento. Preferência não concede Entitlement; servidor/canal/banco validam acesso direto, sessão e dono.
- Escrita de domínio e evento são atômicos; comandos conservam identidade/recibo em retry, CAS e resultado desconhecido.
- Admin usa papel `master`, proteção do último master e saga Auth recuperável; não inspeciona conteúdo pessoal.
- Google: somente leitura, até duas contas, fontes selecionadas, segredo no servidor.
- Financeiro: centavos, competência e Fatura derivada; reserva de Meta não é despesa nem reduz saldo bancário; séries finitas não são cron infinito.
- Hábitos: cadência tem vigência; edição não recalcula o passado.
- Onboarding: oferta automática somente em entrada explicitamente elegível; contas antigas opt-in, deep links preservados, rascunho versionado e conclusão idempotente.
- Cofre: cifra cliente, kit em duas partes, máscara/bloqueio, nenhum segredo em log/evento/galeria.
- PWA: NetworkOnly para navegação privada e fallback offline público; instalação não significa dados pessoais disponíveis offline.

## Estado real por família

| Família | Implementado encontrado | Restante |
|---|---|---|
| Auth/Admin/acesso | Rotas, guards, saga, CSP, rate-limit, sessões, canais reais | Regressão do candidato e aceites conectados aplicáveis; não recriar Auth. |
| Capturar/Tarefas/Conhecimento | Tiptap, persistência, promoção, backlinks, ciclo de vida, Lista/Kanban, CAS | Deltas visuais e de navegação descritos no comparativo. |
| Projetos/Hábitos | Vínculos explícitos, capas/contexto, análise e cadência histórica | Ações contextuais de Projeto; desvio aprovado sem prazo/status próprios; fidelidade. |
| Calendário/Integrações | Quatro vistas, participantes, contexto lateral, fontes e OAuth | Conferir estados equivalentes e regressões; não abrir ticket genérico de “criar Calendário”. |
| Financeiro | Contas/cartões/faturas, lançamentos/transferências, limites, séries/Metas/imagens | Hierarquia, filtros, abas e forms; foco de erro Metas no gate. |
| Cofre | Cifra, kit, desbloqueio, lista/detalhe, copiar, lixeira | Reveal protegido planejado (D083) e validação visual com dados sintéticos. |
| Configurações | Perfil/foco/avatar/tema persistente, módulos/sessões/dados/legais | Composição dos painéis/modelos de tema e texto falso em Ajuda. |
| Landing/onboarding | Landing seis capítulos; nove telas conectadas | Landing três capítulos/assets; qualificação onboarding e chips de frequência. |
| Drive / comercial | Código residual Drive e PRs comerciais preservados | Fora da execução atual; corrigir exposição Drive sem implementar sua nova lógica. |
| Operação | Backup/restore e protocolos preservados | Restore pós-lançamento #42; manutenção #121 separada do MVP. |

## Handoff reconciliado

| Item do handoff | Conferência atual | Próximo passo / issue |
|---|---|---|
| Cadência onboarding v2 | Aplicada em ad24; daily/weekdays/weekly_target1–7, legado/protocolo externo preservados | Qualificar testes e geometria; #63/#80. Não reaplicar patch nem criar DDL por esse JSON. |
| G4 SQL V3 | Teste integrado em `onboarding-oauth-canonical-sql.test.ts` | Qualificação do SHA; #64. Consentimento positivo anterior não precisa ser repetido sem delta relevante. |
| Gallery | Gerador/supervisor/workflow integrados | Produzir oito WebP + oito sidecars + recibo depois dos E2E; #80/#81. Ferramenta pronta não é captura pronta. |
| UI V2 landing | Pacote congelado existe; runtime ainda seis capítulos | Reconciliar patch depois dos assets e da nova comparação; #80. |
| Main HTTP | Pacote inert/approved:false/origin:null, pins 3403; tentativa anterior HOLD401 antes de atores | Cópia operacional nova vinculada ao Source, canal autorizado, sem cookies humanos; #62/#65/#81. |
| Retenção de 720 h | SQL 026 contém expiração/sweep/health; cron não é provado pela lógica | Prova operacional própria e caso vencido determinístico; #62. D078 não adia retenção. |
| Foco Metas | Falha anterior em ce7, `finance-goals-image-upload.spec.ts:137`; hipótese de RAF em `goal-editor.tsx:53` | Diagnosticar depois do Typecheck, preservando foco/lifetime/sessão/não reenvio; #81. |
| Restore | PR114 e #42 preservadas | Pós-lançamento; sem novas inspeções privadas por esta análise. |
| Migrations/produção | Homologação 001–027 registrada; mudanças 020–027 incompatíveis com código antigo em alguns contratos | Plano de corte coordenado posterior, com inventário real. Nenhuma aplicação agora. |

## Bloqueio de CI confirmado nesta auditoria

Em ad24, os runs gerais [push 40259751645](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40259751645) e [PR 40259756603](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40259756603) falham no passo 15 **Typecheck**.

O log do [job 121369348545](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40259751645/job/121369348545) aponta:

`tests/core/onboarding-frequency.test.ts(73,99): TS2345`: o callback inferido como `(weekdays: string | number | boolean) => void` não atende às tuplas inferidas pelo teste parametrizado, incluindo `[number, number]`.

Correção a planejar: representar cada entrada inválida de weekdays como um único caso tipado, conservando todas as negativas/asserts. Não relaxar TypeScript ou remover o teste. O segundo job teve etapa confirmada pelos metadados; seu conteúdo de log não foi independentemente lido. Ambos pararam antes do E2E/Gallery. A falha histórica de foco não foi reexercitada nessa coorte.

Os demais20 runs concluíram success; isso não torna o pipeline completo aprovado. A coorte antiga 3403 tinha22 runs/24 jobs registrados como aprovados, válidos somente naquela fonte.

## Documentação e histórico

Commits próximos que explicam o estado: `3403a5a` é a fonte do Preview e ajusta o oráculo financeiro/diagnóstico de fotos; `f39b76f` registra sete aceites técnicos; `ce7be47` consolida observação nativa/aceites e tem a falha histórica de foco; `ad24a6b` preserva cadência, G4, Gallery e handoff. O novo delta desta auditoria é documental e não corrige esses testes. PR48 é a base anterior do layout; doc17 evolui essa referência, e não exige começar do zero.

Há várias gerações válidas de documentos, com status desatualizados: PRODUCT/DESIGN ainda descreviam fundação mock/Hobby; AGENTS dava primazia ao doc15; doc17 mandava retomar #52/#53; #62 dependia de pagamento #54; #81 ainda tinha testes comerciais no título. Este pacote corrige a precedência e o recorte, preservando os contratos/histórico comercial.

ADRs 0011/0012 já têm implementação de domínio/migrations na candidata; não significam release aprovado. ADRs 0006/0007/0008 conservam registros históricos e passam a apontar este corte para estado atual. Nenhum fechamento de issue é tomado isoladamente como prova de produção.

O [inventário completo](inventario.md) diferencia branches absorvidas, divergentes, comerciais e de restore. Não houve limpeza, rebase ou merge nesta auditoria.
