# Peer estático V1 — frequência do onboarding

**Sem bloqueador ou achado acionável demonstrado nos nove paths congelados.** Favorável à integração para os checks do Root. Este parecer não transforma testes escritos em execução aprovada.

Pacote: `onboarding-frequency-item-v2-3403-20261025/proposal-v1`. MANIFEST SHA256 `177380ca80e6fce8470de986c09fb1d63bdfe45923d6a9dc88f03ff2c2516c7a`; patch `36f48de5c94690f68c454cc968de5db9dd8e68ef25ad63d8b7b3465f6b56d8f2`. Base Git `3403a5aa1901c166e6cfc1206848bfdc1c34957a`, tree `7fdeb63d76d30058c260ba1579e55f94c6f1c2ca`.

- `types.ts:9–18`, `validation.ts:113–166,213–245`: item v2 explícito; ausência de version continua legado. O decoder rejeita versão própria undefined/desconhecida, extras, mistura de campos e getters. Dias vazios podem ser rascunho; confirmação/replacement exigem seleção completa. O envelope/round mantém schema1.
- `server-planning.ts:35–47,77`: daily/weekdays/weekly_target usam o habit.create existente. Apenas o input de domínio ordena os dias; choice e rascunho não são normalizados em leitura. No legado, ordem dos campos, corpo, escolha e clientId continuam os mesmos. A versão do item não se confunde com a versão da intenção.
- `draft-steps.tsx:51–78,128–176`, `recovery-choices.tsx:48–66`: um seletor compartilhado; renomear espalha o item anterior e conserva key/data/cadência/ausência de version. Frequência só muda por interação explícita. Foco do primeiro dia depende da tentativa de validação; autosave não adiciona efeito de foco. O fluxo de Add/open/remove permanece. Sem alteração de estilo ou novo token; aparência/responsividade não observadas por este peer.
- Pending/unknown, CAS, geração, TTL, emenda, recibos/eventos/ACLs, transportes e SQL026 são suportes sem delta. A recuperação usa o mecanismo anterior de substituição/reconciliação; o patch não introduz retry, criação de slot ou promoção de recibo em leitura. Uma aba antiga que conheça somente legado não é declarada compatível com v2.

## Testes e preservação conferidos

O novo `tests/core/onboarding-frequency.test.ts:22–142` chama decoder/planner/service reais, cobre JSON/corpo legado literais, extremos 1/7, dias inválidos/esparsos/duplicados/getter, campos mistos, versão desconhecida e recusa antes de port.save. `tests/adapters/onboarding-canonical-sql.test.ts:100–152` usa o adapter/Core/wrapper reais sobre o helper canônico descartável: três hábitos, payloads persistidos, eventos/recibos, zero marcas, replay e zero permits. Isso é um teste escrito para SQL histórico026 em PGlite com Auth fixture; não representa GoTrue, PostgreSQL com sessões sobrepostas ou Preview.

O append E2E `onboarding-workspace.spec.ts:567–664` usa os componentes reais e o HTTP sintético existente: teclado/foco, autosave, resumo/reload, edição legada, recuperação e DTO desconhecido. Fixtures/mount/labels nativos conferidos por leitura; não é ensaio hospedado ou observação de browser deste peer.

Checks locais somente de bytes/texto/Git: 9/9 after e 8/8 before coincidem com o manifesto; os oito before correspondem aos blobs Git3403; 16 objetos de suporte resolvidos e comparados aos pins Git3403. Os testes anteriores permanecem prefixos byte exatos de 60359 e 10694 bytes. Apply --check --whitespace=error-all exit0. Nenhum Node, sintaxe, typecheck, lint, suite, SDK, SQL, browser, API ou edição Root executados por este peer.

Pendências: checks apropriados do Root/CI e eventual recorte visual do produto novo; a Source3403 verde e as provas anteriores não qualificam estes bytes novos. Não se exige novo ensaio manual de cada permutação que uma suite adequada comprovar. Restore segue pós-lançamento por decisão explícita e não é gate do MVP. MainHTTP permanece separado.
