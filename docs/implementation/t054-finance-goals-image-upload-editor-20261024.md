# T-054 · C2b-E · editor opcional de foto

Base de autoria: `bf1ffb0f0f397bc92b577cf524f4de24e6a49993`, branch `codex/goals-image-editor-20261024`. Escopo de sete paths. Nenhum Workspace, rota App, flag, migration, Core financeiro, SDK ou infraestrutura compartilhada foi alterado. Merge e produção permanecem bloqueados.

## Implementado, sem execução

- `GoalEditor.imageUpload?` é uma capacidade local separada. Ausente, conserva o formulário, `prepare(intent): Promise<void>` e o comportamento anterior sem upload. A máscara não monta campos financeiros nem o picker antes de revelar.
- `GoalImagePicker.onChange` continua recebendo somente metadata. O seam separado `onLocalSelection` mantém o `File` em RAM na sessão do editor; nunca o inclui em GoalCommand, view, callback de metadata ou journal. A prévia usa o hook existente, revogado no descarte local. O piso de geração evita reutilizar o ordinal de A no mesmo scope.
- Escolher, cancelar o seletor, desfazer e fechar o editor não enviam arquivo nem retiram A. A ação **Revisar** valida/captura formulário, revisão financeira e escolha antes de qualquer await. O coordenador persiste a identidade do upload antes do transporte; só seu receiver nominal de `file.upload.finalize` e `inspectReady` autorizam o imageId naquela edição. O clientId financeiro nasce depois dessa verificação, é capturado e não muda em erro/revisão repetida.
- Uma consulta explícita pode recuperar a escolha metadata de A ativa no mesmo scope. Isso não é ready: `resume` original ainda precisa de novo positivo e pode exigir reseleção/hash do mesmo arquivo. A de outro scope/revision e `retirement-review(A)` não viram ready nem omissão/null para a edição atual.
- Revisar a foto não confirma a Meta. O conteúdo de confirmação financeira existente permanece separado. O editor não chama execute, reconcile, stage ou acknowledgeReview financeiros. O controller/port continuam donos dessa confirmação, journal e resultado incerto.
- Toda continuação é cercada por dono, epoch, instância de serviço, scope, identidade de formulário/revisões e geração local. Há exclusão síncrona para duplo clique; dispose só encerra o handle e a RAM, sem logout ou limpeza dos journals. Erros são textos fixos, sem copiar exceção remota.

## Contrato R consumido, sem copiar sua implementação

Dependência: pacote R `finance-goals-image-upload-retirement-freeze-v2-20261024` (manifest `9ac3f3f2107d56d4054bb60481e96f41ae2a1b6042264d738e49b4ac2c91feef`). Client/coordinator públicos são byteiguais à R1; R2 corrige somente o hold interno J2 após SET/readback. Nenhum desses paths foi copiado nesta autoria.

`GoalImageEditorCapability` oferece scope, isCurrent, factory `open(scope)` e `linked()` da instância concreta, além de `Picker` tipado, fornecido pelo host opcional. A injeção explícita do presenter evita importar runtime/CSS do picker no caminho legado e preserva sua allowlist de estilos. Não altera o componente fornecido. A factory privada do host precisa usar **o mesmo journal de upload, client financeiro, barreira e controller** em cada abertura. Não se altera `FinanceGoalsClientPort`, suas Options ou sua factory.

`retireLinked(proof)` aceita somente o proof nominal atual do client concreto; `discardFinalized()` recaptura a finalização original. Ambos dependem da barreira financeira livre e retornam `retirement-review(A)`, nunca prova de ausência ou empty. A interface oferece esses gestos explicitamente. Não faz ack automático nem limpa financeiro.

`replaceRetired(File, generation, nextScope)` usa a autorização privada atual. Após B durável, A é encerrado e a sessão abre **outro handle B** pela mesma factory. Se SET B tiver efeito mas o readback falhar, consultar reabre metadata B; não repete substituição nem cria outro UUID. Um snapshot de B, mesmo ready-unbound, não é prova: a revisão passa por novo resume/finalize/inspectReady.

Limite conservador: após retirada, continuar sem nova foto não é inferido do estado review(A). Nesta fatia a saída explícita é substituir por B ou fechar o editor. Preservar/remover uma imagem da Meta funciona com journal vazio, respeitando omissão no update e null explícito na remoção/create vazio. Uma tentativa financeira já capturada continua protegida; o editor não inventa um novo corpo para sair de hold.

## Protótipo e acessibilidade

Referências: doc17/T-054, `finance-goals.js` (imagem opcional no formulário), brief Financeiro e DS 2.1. Usa exatamente Button, Field, EntityImagePicker, PrivateImagePreview, dialog e CSS existentes. Não cria capa fictícia, asset, paleta ou geometria. O botão de revisão continua sendo a ação principal. Controles de recuperação usam os alvos existentes de 44 px; campos continuam 16 px. Claro/escuro, foco, teclado, Escape, movimento reduzido e larguras 320/390/intermediária têm casos escritos, mas renderização/contraste não foram medidos nesta autoria.

## Provas escritas e validação pendente

Revisão E V2 (V1 preservada): o seam estrutural interno agora exige `imageFileId` UUID primitivo pelo guard puro existente **antes** de criar clientId financeiro ou chamar prepare. O ramo needs-upload não tem fallback para null/omissão; create recebe o valor já decidido explicitamente. O receiver R real já impõe essa propriedade, mas o editor não deve converter um retorno interno malformado em outra escolha. O negativo de ausente/null/texto inválido/número/objeto usa somente double opaco da fronteira e exige A intacta e zero createId/prepare; não fabrica prova nominal nem certifica R.

Outro ajuste V2 é exclusivamente na fixture: a projeção de update usa `Object.hasOwn(patch, "image_file_id")` para distinguir omissão de null explícito. Dois E2Es escritos partem de uma Meta existente (revisão 3, revisão financeira 7 e baseline próprios), passam pelo client/controller reais e exigem preservação versus remoção após confirmação; nenhum upload/proof é inventado nesses ramos de journal vazio. A projeção sintética de resposta segue +1 na revisão da Meta e na revisão financeira. Não é evidência executada nem autoridade de servidor real.

Revisão E V3 (E1/E2 preservadas): o único bloqueio restante do peer E2 `c67f784704300ac483f9cee7f92c86acf97e295f90999f40740d4ace5ba8d8aa` era o double unitário `Picker: () => null`, incompatível por leitura com o retorno JSX.Element de `typeof GoalImagePicker`. O double agora retorna `createElement("span")`, sem cast, alargar a API ou alterar o componente real. Os seis casos existentes de 320/390/768 × claro/escuro foram ampliados para aguardar fontes e uma imagem de prévia com naturalWidth positivo, escrever `goals-image-editor-{width}-{theme}.png` em testInfo.outputPath (fullPage, animations disabled) e exigir retorno do foco ao botão de abertura após Escape. São evidências **previstas pelo teste**, ainda não geradas. Não há novo asset, medição de contraste, execução local ou aceite visual. Root informou apply --check/whitespace do patch E2 aprovado em seu checkout; isso não certifica execução dos testes nem o novo delta E3.

Consultar e reselecionar o mesmo File é retomada de A: o ordinal local do picker pode avançar, mas o proof é comparado à geração persistida de A e a reseleção exige identidade/hash originais. Não se impõe igualdade entre a nova geração local e A, pois isso impediria retomada legítima. Outro File/hash é recusado sem criar B, clientId financeiro ou preparo; substituir exige os gestos separados Recover→replace. Há negativo E2E escrito com coordenador real para essa distinção.

Unitários da sessão: formulário inválido sem open/ID, escolha inválida sem fallback, preserve/remoção/create null, A held/need-file/scope antigo, ausência de linked proof, revisão alterada, dispose/owner/serviço tardio, duplo clique, preservação de UUID/corpo e SET B com readback perdido. Os doubles unitários **não** emitem provas nominais.

Fixture E2E isolada: journals reais sobre localStorage/Web Locks, coordenador/transport/client/controller/decoders reais; somente respostas HTTP, Storage e sender CommandSession são sintéticos. Não há construtor de proof falso, rota App ou contato com serviço. Cobre prévia/undo/cancel sem envio, validação antes de IO, finalize original→review→confirmação explícita, resposta perdida, retomada após remount, hold financeiro, recuperação A→B, máscara, temas e mobile. Isso não é prova de Auth, CommandJournal de produção, Storage conectado, SQL, corrida nativa ou persistência hospedada.

Nenhum Node, lint, Vitest, Playwright, build, install, SQL ou conexão foi executado. Comandos propostos **somente após união R revisada e ambiente serializado por Root**:

```text
npx eslint src/components/features/financeiro/goals/goal-image-picker.tsx src/components/features/financeiro/goals/goal-editor.tsx src/components/features/financeiro/goals/goal-image-editor-session.ts tests/features/goal-image-editor-session.test.ts tests/e2e/finance-goals-image-upload.spec.ts tests/e2e/helpers/finance-goals-image-upload-fixture.tsx --max-warnings=0
npx tsc --noEmit
npx vitest run tests/features/goal-image-editor-session.test.ts
npx playwright test tests/e2e/finance-goals-image-upload.spec.ts --workers=1
```

Antes de montar: peer estático, CI próprio da união, provas R de liveness/hold, aplicação supervisionada da composição SQL/tipos/catálogo na homologação, aceite real de upload/finalização/vínculo e troca, e validação visual. E1-A/M1 e demais propostas inertes não são ativadas por estes componentes. #79 não está concluída por esta entrega.

## EFix1 · wrapper Web Locks da fixture

Nos dois jobs gerais originais de deb586d, Root informou Typecheck TS2322 na fixture, antes de unidades/E2E. A declaração DOM local do TypeScript 5.9.3 é request<T>(name, callback: LockGrantedCallback<T>): Promise<T> e o callback retorna T. Com work retornando Promise<T>, a inferência da expressão síncrona resulta em Promise<Promise<T>>. O wrapper passa a ser async e retorna await navigator.locks.request(name, work), cuja adoção mantém Promise<T> na interface injetada.

Somente essa linha da fixture muda. Usa a mesma Web Lock nativa, nome e callback; não altera ordem das leases, lifetime, owner, journals, sender ou prova nominal. Nenhum cast, supressão de diagnóstico, valor substituto ou afrouxamento de contrato foi adicionado. E1/E2/E3 permanecem intactas; é um delta público separado baseado no candidato deb586d informado por Root. Nenhum Node, typecheck, teste, navegador ou PNG foi executado/produzido nesta correção. O próximo SHA precisa dos próprios resultados CI.
