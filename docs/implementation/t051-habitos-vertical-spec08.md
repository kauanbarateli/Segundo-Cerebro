# T-051 / #76 — Hábitos, histórico e imagens privadas

Refs #76. Part of #71. Implementação local autorizada pelo mantenedor em 21/10/2026 e liberada pela Root sobre `807fbe837211df91d4df1dff30e206a26a3c88e0` (PR #91). Branch `codex/spec08-habit-vertical-20261021`. O manifesto externo da entrega identifica o commit final e os arquivos exatos. Um único autor de código; revisões auxiliares somente por leitura. Não houve push, PR nova, merge, deploy, SQL remoto ou execução local de Node, testes, banco ou navegador.

## Estado da rodada

- **Implementado localmente:** agregado versionado de frequência; criação/edição e marcações históricas; painel de desempenho e filtro compartilhado; imagens privadas de hábitos pelo fluxo #72; projeção no Início; migration própria e testes de Core, adapters, cliente, SQL descartável e navegador preparados.
- **Validado:** leitura estática delimitada e `git diff --check`, sem erro. A base #72 tem 18 runs `completed/success` no SHA807, incluindo CI PR39614689252 e Fundação PR39614689289. Isso não é evidência de aprovação deste delta.
- **Pendente:** execução no GitHub no commit integrado, comparação visual contra a referência aprovada, reconciliação dos inventários/tipos/SQL Editor pela Root, Storage real e negativas conectadas. A primeira criação pelo onboarding depende de #63, que não foi simulada como pronta.
- **Bloqueio de ativação:** nenhum writer novo deve ser publicado isoladamente dos readers, marcações, SQL, métricas e Home deste conjunto. Não fechar #76/#71/#81 a partir desta preparação.

## Agregado e autoridade

O payload recebe opcionalmente `frequency_history:{version:1,baseline_origin,changes}`. Somente a ausência da chave é legado. Valor presente `null`, `undefined`, vazio, desconhecido, com accessors, owner/hábito divergente ou sequência não canônica é erro. O reader original da PR87 continua puro; o wrapper persistido acrescenta esta distinção estrita. `effective_until` é derivado, nunca persistido.

Novo hábito nasce com `created_frequency` na `started_on` imutável e `image_file_id:null`, sem marcação automática. No legado, a primeira alteração semântica materializa a frequência anterior conhecida desde o início, com `legacy_known_frequency`. Renomear, arquivar e restaurar conservam exatamente o wrapper ou sua ausência; não reconstroem versões antigas. A origem permanece imutável.

A alteração vale hoje em São Paulo. No mesmo dia substitui somente a vigência daquele dia. A→B→A remove a linha redundante de hoje, preservando baseline, prefixo, origem e os eventos/recibos das duas intenções. Início hoje/futuro mantém uma única baseline inicial com a frequência final. O browser continua enviando somente os campos públicos anteriores: não fornece owner, histórico, vigência, imagem ou relógio.

Guardas de sessão/ator/Entitlement e identidade do recibo precedem o replay. Recibo precede relógio, reconstrução e CAS. O Core captura um instante por tentativa nova e reutiliza-o no evento; replay não captura outro. O commit SQL captura `clock_timestamp()` uma vez após o guard/lock e o recibo, confere o mesmo dia civil e o mesmo timestamp de row/evento e reavalia o agregado esperado. Divergência na meia-noite é `40001`/conflito atômico; não reescreve a intenção silenciosamente. O contexto interno de dia é transaction-local e restaurado nas saídas de commit/stale; não há parâmetro público ou grant de DML direto. DML administrativo tem seu próprio teto real. Não houve mudança em `operations.ts`.

Nenhuma elevação do limite de snapshot de 8 MiB, truncamento ou novo limite arbitrário de histórico. Cliente antigo não pode apagar um histórico materializado; criação antiga sem baseline é recusada, exigindo implantação coordenada. O rollback da aplicação deve usar reader compatível com os novos payloads e a fundação #72; retornar diretamente ao reader legal b67 não é uma estratégia aceita para esses dados.

## Métricas congeladas com a Root

As barras contam registros reais R, inclusive marcas preservadas fora da cadência ou de pausas posteriores. A consistência agrupa hábito × semana civil de segunda-feira × vigência: E são as práticas elegíveis disponíveis, recortadas por seleção/início/hoje/união de pausas; na meta semanal, `min(alvo,dias disponíveis)`. Cada grupo contribui `C=min(R,E)`. O agregado calcula soma C/soma E; não faz média de percentuais nem compensa déficit de outra vigência com excesso. E0 produz `null` e “Sem práticas previstas”.

Exemplos preparados: específicos com uma de duas práticas=50%; semanal aberta uma de duas=50%; excesso R5/E3/C3=100%; agregado C2/E5=40%; semanal→diária C3/E4=75%; diária→semanal C4/E5=80%; excesso em uma vigência não compensa a outra (75%). Marca preservada com E0 mantém barra e C0; com E1 pode contribuir C1 no próprio grupo. Arquivados saem do agregado ativo, mas têm consulta individual com cadências/pausas conhecidas; não se inventam intervalos antigos de arquivo/restauração.

Sequências identificam dias elegíveis ou semanas. A troca de unidade começa segmento novo; diária↔dias específicos conserva a unidade e a elegibilidade histórica. Recordes por unidade permanecem separados. Uma semana com várias vigências só completa quando a soma dos C próprios preenche a soma dos E próprios. A semana corrente pode continuar aberta; nenhuma prática prevista não é fracasso. `falhas` continua sendo o déficit do recorte passado encerrado, distinto do percentual que pode receber crédito de uma marca posterior preservada no mesmo grupo. Wrappers públicos, Início e painel usam a mesma unidade de práticas para E/C.

## Imagem, interface e reutilização

`habit_image` reutiliza reserva/finalize/observação/PUT assinado e o diário da #72. O setter exige Habits e proprietário real, arquivo finalizado com mesmo owner/purpose, CAS de `expected_file_id` e recibo idempotente; atualiza hábito/evento/recibo atomicamente. Vetos em Drive/Configurações/Projetos não substituem Habits; veto de Habits prevalece inclusive em replay/leitura. Arquivar preserva o vínculo privado e o protege da limpeza. Remoção é uma intenção explícita. Sessão diferente, resultado incerto ou ACK divergente não libera uma segunda criação/vinculação. Arquivo/capacidade não vai a localStorage; recarregar não preserva bytes da escolha.

A composição segue o protótipo aprovado: desempenho mês/semana com seletor de período, barras e consistência; rotina em linhas com imagem e ações; filtro comum. Histórico/pausas e melhores sequências continuam disponíveis em disclosures. O histórico longo de 230 dias continua maior que as 182 células visíveis. Link arquivado abre seu próprio histórico; link inexistente/alheio não escolhe outro hábito. Arquivar/restaurar devolve foco ao filtro persistente.

Reutilização #63: `HabitFrequencyFields` é apresentação compartilhada, com CSS próprio e o mesmo contrato de criação do Core. Não há onboarding paralelo, automarcação ou aceite conectado de J6. DS2.1/Geist/tokens e claro/escuro/sistema preservados. **Adaptação acessível RECOMENDADA:** abaixo de335px de conteúdo, sete alvos de44px quebram em4+3; a referência compacta não justifica alvos menores. Valores de gráficos usam styles locais derivados exclusivamente de números do Core; a Root deve conferir a política DS no commit integrado. Capturas/contraste ainda não foram executados.

## Banco reservado e reconciliação Root

Migration preparada: `supabase/migrations/20261021144650_spec08_habit_frequency_history.sql`, timestamp reservado pela Root, depois de020 e de `20261021050931_spec08_calendar_list_participants.sql` no candidato combinado. As001–020 não foram editadas/reaplicadas. A migration adiciona `habits.image_file_id`/FK composta de owner, helpers privados puros e transições/guardas dos RPCs existentes. Nenhum RPC público novo. Substituições dos corpos existentes têm assert de origem; drift aborta a transação inteira. Helpers/implementações anteriores não têm EXECUTE para public/anon/authenticated/service_role. SQL Editor e aplicação supervisionada são trabalhos distintos de preparar este arquivo.

A Root deve reconciliar, no candidato completo e sem enfraquecer asserções:

1. `src/lib/supabase/database.generated.ts`: coluna/relação de habits e comparação real `SNAPSHOT_MATCH` após todas as migrations do candidato.
2. `supabase/sql-editor/`: instalação, asserções, manifesto e hashes pelo gerador oficial; ordem e ausência de operação automática mantidas.
3. `supabase/tests/release-catalog.sql`, `projects-habits-catalog.sql`, `drive-storage-catalog.sql`: helpers privados exatos, coluna/FK, guardas de histórico/imagem e limites de grants. Sete funções privadas novas: `habit_frequency_tuple`, `habit_frequency_state`, `habit_frequency_expected`, `habit_frequency_at`, `habit_check_attempt_clock`, `file_entity_image_get_habit_previous`, `file_entity_image_set_habit_previous`.
4. `scripts/verification/foundation-local-ci.mjs` e seus fixtures/testes: fontes, migrations, contagens de catálogo e metadados do candidato real, sem trocar somente números para obter verde. Revalidar no-op de segunda aplicação, concorrência e cleanup.
5. Inventários finitos usados por restore, camada/browser e DS quando a coleta real apontar os novos módulos/estilos; workflows/package/lock e regras globais permanecem sob dono Root. Os inventários de CSS dos dois E2Es alterados são exatos, sem wildcard.

## Lote preparado para GitHub

Node24; um lote pesado/worker por vez, ambiente sintético isolado. Os caminhos abaixo existem; não são placeholders. Nenhum comando deste lote foi executado localmente.

```sh
npx vitest run tests/core/habits.test.ts tests/core/habit-frequency-history.test.ts tests/core/habit-frequency-state.test.ts tests/core/habit-performance-history.test.ts tests/core/projects-habits.test.ts tests/core/entity-images.test.ts tests/features/habit-connected-history.test.ts tests/features/entity-image-attempt.test.ts tests/adapters/projects-habits-store.test.ts tests/adapters/files-route.test.ts tests/adapters/image-upload-observation-route.test.ts --maxWorkers=1
node --test --test-concurrency=1 tests/scripts/spec08-habit-frequency-sql.test.mjs tests/scripts/spec08-private-entity-images-sql.test.mjs
npx playwright test tests/e2e/projects-habits.spec.ts tests/e2e/issue30-habits-sql.spec.ts tests/e2e/spec08-image-retry.spec.ts --workers=1
```

Executar o lote Core em UTC e America/Sao_Paulo; depois lint do delta, TypeScript, camadas e DS. Após reconciliar catálogo/tipos/espelhos, checks SQL Editor/secrets, local-sql descartável, Fundação e build/client-auth no GitHub. Suites amplas somente no candidato integrado necessário, sem jobs comerciais/conexões reais por inferência. CI não aplica SQL remoto.

Os E2Es usam componentes/providers/diário reais com seams HTTP/SQL sintéticas delimitadas. O novo teste SQL/navegador conserva e confere payload/evento/recibo após edição e recarga, negativas de link, arquivo e foco; a matriz captura320/390/768/1024/1440 em claro/escuro/sistema, contraste textual real, alvos/campos, teclado e tabela do gráfico. O teste de imagens acrescenta Habits a reserva/PUT observado/finalize/bind/ACK inválido e retry com corpo idêntico. Não são prova de GoTrue/Storage remoto nem comparação visual aprovada, sidebar global ou zoom200%; estes aceites permanecem no lote conectado/#44/#81.

## Roteiro conectado da Root

Depois de CI do commit exato, reader compatível e aplicação supervisionada da ordem aprovada: usar duas contas sintéticas autorizadas e conferir criação sem automarca, três frequências, alteração hoje/no mesmo dia/futuro inicial, recarga, marca passada/futura, pausa geral/individual, preservação/undo da marca antiga e sequência por unidade. Comparar R/E/C às fixtures congeladas; conferir arquivo/restauração e Início. Interromper resposta de reserva/PUT/finalize/commit/bind, repetir a intenção original, verificar uma row/evento/recibo e proteção de cleanup. Conferir A/B, Habits negado, vetos independentes e acesso às imagens/rotas pelo owner correto. Conferir claro/escuro/sistema, sidebar, zoom200%, teclado, foco, reduced-motion e contraste sobre foto real autorizada. Não expor bytes privados nas capturas.

O início por onboarding e a composição com bloqueio comercial #53/#54 devem ser provados quando os contratos correspondentes estiverem integrados. Não há dependência circular para retomar testes offline #52/#53 no GitHub antes disso. Nenhum gate #44/#68 ou issue de terceiro é encerrado por esta entrega local. Slot de código pode ser devolvido à Root após o handoff; nenhum processo pesado local foi iniciado.
