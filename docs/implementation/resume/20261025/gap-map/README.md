# Onboarding e landing — lacunas finais do MVP

A Source examinada é `3403a5aa1901c166e6cfc1206848bfdc1c34957a`, árvore `7fdeb63d76d30058c260ba1579e55f94c6f1c2ca`. O mapa contém **46 critérios** dos corpos em cache de #62–65 e dos quatro itens atuais, publicados com D-077, de #80/#81. Não altera issues nem transforma o planejamento histórico comercial em bloqueio do MVP.

**Prova aproveitada:** Fundação push40234742944/job121293777449, checkout real 3403 na linha192; original SHA256 `20c7b19882bc53ea7d1c2476c496aadcbe9c42e0d68b1e4531a27e8ac4e2ca56`, 1.252.055 bytes. Foram aprovados 3624 testes em cada fuso e 541 E2E. O recorte específico tem 45 E2E do onboarding, 12 dos atributos e 33 da landing; 14 arquivos de unidade selecionados passaram nos dois fusos. A projeção qualificada existente é `b56f5c0b2ab1e774f778d12441f467d57e6723f1ba5ed764a896d86a747c27b9`. MATRIX.json conserva paths, blobs, casos e linhas; nenhum teste ou GET novo foi executado.

| Issue | Recomendação finita |
| --- | --- |
| #62 | HOLD: concluir o MainHTTP já reservado; falta localizar/conferir zoom/reflow nominal. Retenção autônoma é operação supervisionada pendente de vínculo, não falta de implementação do sweep. |
| #63 | HOLD de convergência: frequência completa na etapa e na recuperação. Os demais critérios têm Core, SQL, apresentação e persistência anterior vinculados; manter MainHTTP reservado. |
| #64 | HOLD de composição: exercitar a continuação OAuth real no SQL descartável nos negativos nominais, sem repetir o consentimento positivo de duas contas. |
| #65 | Candidata ao fechamento técnico depois do MainHTTP já reservado: não foi encontrada outra lacuna nominal nos dez critérios. Não exige recriar as sete entidades ou repetir cada permutação manualmente. |
| #80 | HOLD: frequência e landing do protótipo vigente, com os vínculos específicos de #62–65. Preço/checkout/comercial continuam fora. |
| #81 | HOLD de integração: registrar esses deltas de J6/J10 e suas provas. Os dez filhos técnicos já CLOSED não são reabertos; #44/#12/restore/corte mantêm seus canais próprios. |

## O que resta, exatamente

1. **G1 — ensaio já em autoria:** MainHTTP com dois atores comuns, cookie SSR e rotas HTTPS de onboarding/atributos, dono/sessão/CAS/replay/conclusão/cleanup. Pertence à frente onboarding/Root. Seu escopo não inclui OAuth ou expiração de720h. Não preparar outra coleta ou outro ensaio equivalente.
2. **G2 — frequência completa:** a etapa e a recuperação aceitam somente `daily|three_per_week`; falta `weekdays` e meta semanal1–7. O planner fixa3. Transportar o seletor/validação aprovados no módulo, mantendo draft/UUID/intenção legados. É convergência de #63/#80, sem reabrir #76. [Contrato proposto antes de autoria](CONTRACT-FREQUENCY.md).
3. **G3 — landing:** a referência17 descreve três capítulos principais Captura/Agenda/Projetos e preview alternável Projetos/Kanban. O código tem seis perguntas e o teste proíbe a palavra Kanban. Portar somente esse delta visual, conservando login existente/acesso fechado, legais e ausência de preço/checkout. As capturas a045 e os sidecars continuam históricos e válidos onde o trecho visual é equivalente.
4. **G4 — continuação OAuth:** os22 testes do helper e as rotas verificam negativos com RPC sintético; o SQL de integração Calendar usa fluxo direto. Não foi encontrado caso que execute `oauth_bind/take/connect` reais com reserva/limite, geração alterada, sessão/dono/rodada, replay e veto entre retorno e commit. O mínimo é um caso de composição SQL descartável sobre os wrappers originais, com rollback e transportes Google sintéticos, para esses ramos. Não é declaração de bug do produto nem pedido de novo consentimento real.
5. **G5 — zoom/reflow:** o checkbox62.9 e a matriz17 mencionam zoom200%; os specs originais de onboarding não exercitam isso. Conferir esse recorte focal, sem repetir320/390, dois temas, foco, campos, alvos e reduced-motion já aprovados. Aparelho físico não é uma exigência nova desse teste.
6. **O1 — retenção autônoma antes do corte:** função,720h e sweep serial estão implementados/testados. O documento backend:74 e o registro proposto dizem Cron inativo; não foi encontrado recibo público de ativação/saúde. Vincular prova já existente ou fazer a etapa supervisionada adequada quando autorizada. Nenhuma ativação, consulta nova ou espera de30dias é proposta por este mapa.

## Autoridade: o legado não é uma regressão

D-077/23 de outubro autoriza MVP + redesign + onboarding de nove telas + landing e cita o doc15/07. O item3 desse documento oferece diário/três por semana; o Source atual satisfaz esse baseline. Portanto não atribuir a D-077, isoladamente, uma exigência antiga de1–7 que ela não contém.

O pacote17, solicitado em21/10, define a precedência visual do snapshot17 sobre o doc15 onde substituído (01:23–24), vincula #62–65 à cadênciaE5 (04:25), determina o mesmo seletor/validação em #63 (03:40) e descreve explicitamente Dias específicos/Meta semanal1–7 (auditoria:22; onboarding.js100–111/177–178). A convergência de landing está na auditoria:18 e na #80 atual. O caput03:14 classifica escolhas técnicas como RECOMENDADAS e refináveis; isso não converte nomes demo em APIs existentes nem autoriza migration por inferência. Root pediu a reconciliação com o protótipo vigente e revisão do contrato antes da autoria.

Preço, checkout e contratação permanecem comerciais da SPEC-07; não entram por associação com a alteração visual. Os corpos atuais de #71/#80/#81 preservam essa separação publicada.

| Fonte-chave da Source3403 | Blob Git |
| --- | --- |
| docs/planejamento/registro-de-decisoes.md | `fc04ed38ec6af0f4922b1404daf4c10ce4c56aaa` |
| docs/planejamento/15-aplicacao-layout-codex/07-onboarding-simplificado.md | `c6ba8f883db8c1e4f943ffa36f86645336952f64` |
| docs/planejamento/17-evolucao-prototipo/01-base-e-escopo.md | `377f5f2e570089ed22fe3f0cce7eadb0ed770b4c` |
| docs/planejamento/17-evolucao-prototipo/03-decisoes-e-contratos.md | `c98bfed5ce7581b11fb182fe6b731c35d8142bfd` |
| docs/planejamento/17-evolucao-prototipo/04-execucao-e-issues.md | `25ebede5bf636ace790c42e36c7a517f47ec3fa2` |
| docs/planejamento/17-evolucao-prototipo/auditoria-comercial.md | `e2f8d3eaa4368279d1197a868947182b58c2f774` |
| docs/planejamento/17-evolucao-prototipo/prototipo/onboarding.js | `71594518689edd59201679bb5b5e46c2d1f23715` |
| src/core/onboarding/types.ts | `ff16d3639b9750421c0421dc1ad6e213c778fa17` |
| src/components/features/onboarding/draft-steps.tsx | `ca30503e2f5bede5fa93b900754efea89736d6d3` |
| src/components/features/conheca/content.ts | `c9f9f9c634eafad2bc7683866283c099e89e5174` |

## Provas que não devem ser repetidas

A homologação85b percorreu as nove telas, pausou/retomou após reload, confirmou sete intenções, leu os registros/vínculos/foco/contexto e revisitou a conclusão sem recriar. Nova rodada explícita voltou vazia; OAuth humano retornou à agenda com duas contas somente leitura, e a segunda conclusão não acrescentou entidades. Core/adapters/API/SQL026 desse trecho não têm delta até3403; quatro componentes de apresentação mudaram e têm execução própria nos E2E3403. Não é herança indiscriminada do CI antigo.

a8e acrescenta validação de nota/hábito, erro associado, contraste computado do campo nos dois temas, pausa/reentrada e preservação do rascunho, com a falha original de Tema e a continuação documentadas. D1 observa o erro local por clique e Tab+Enter nas três coleções, sem foco corretivo. O E2E3403 executou os deltas posteriores. As cinco URLs de notice em a8e não equivalem a callbacks OAuth; as duas contas financeiras da QA3403 não são dois usuários Auth.

As quatro imagens de Projeto na landing são pixels demo a045, com digest, sidecars e inspeção Root próprios. Os33 E2E3403 e quatro testes de conteúdo conferem a landing atual; não tornam o layout de seis capítulos equivalente à nova composição17.

#44 continua aceite humano visual global e #12 instalação/aparelho físico no recorte próprio. Não exigir novo celular, nova leitura manual de cada teste ou novo restore para aceitar cada regra técnica já exercitada. #35/#42, credenciais Google Production, Main e corte continuam separados. Zero API, Node, browser, SQL, Root edit ou publicação nesta frente.
