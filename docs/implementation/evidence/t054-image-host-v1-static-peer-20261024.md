# H1 V1 — peer funcional e lifecycle estático (24/10/2026)

Não encontrei bloqueador funcional/de autoridade adicional no recorte lido. V1 não deve ser incorporada como pacote validado: Root informou uma recusa real de lint/exhaustive-deps no cleanup de SourceRecovery, e o autor prepara V2 estreita. Este parecer preserva V1 e exige delta-peer dessa correção. Não executei lint, TypeScript, Vitest, Node, browser, SQL, rede ou serviços; não há avaliação visual.

## Pacote e preservação

Manifesto EV/finance-goals-image-host-freeze-v1-20261024/manifest.json: 6.841 bytes, SHA256 28a708c9f9aea5eaaf1b6716c41983c3a767a6b3dc6209ef63d5f8bb0923f326. Conferi os 12 after, seis before e dois artefatos. Base 97db0840b2f405fdfcd674bba85f26ed490c8547; não foi presumida equivalência automática com o filho799.

Conferi diretamente os nove protegidos declarados, inclusive client concreto, coordenador G0, J2, contrato, disponibilidade antiga, Workspace e controlador. Retirar somente as três adições de comentário/campo/gates de GoalImageEditorSession reproduz integralmente o before SHA256 65a684d006998f4b63ae94250c8618bc90653dd9f5c8c4d3e0c1db7fbaff21b5. Nenhum receiver Ready/Linked/G0, journal/CAS ou autoridade financeira foi reimplementado.

O módulo Root fora do patch foi conferido: finance-goals-images-availability.ts, 768 bytes, SHA256 be1e4a534a0c20f70da098d498ea830b5e4a43b800ea3d705084c4fcecc44018. A rota HTTP de reserve e seus testes são outro pacote; este peer não os substitui.

## Ligação concreta, memoização e scope

finance-goals-host.tsx:30–43 usa a única factory financeira/lifetime existente. O binder só nasce depois de lifetime.ready e com o FinanceGoalsBrowserClient real; falha de construção não monta um formulário legado. A identidade envolve owner/providerEpoch/client/epoch e referências dos serviços.

goal-image-host-binding.ts:65–115 recusa substituição de dono, modo, cliente, serviços, origem, controlador, privacidade ou instância. O J2 real abre somente ao preparar a edição por gesto e é memoizado pela promessa/instância do host. A callback da factory mantém o fence da identidade, sem confundir dispose/conceal com logout. Cada coordenador recebe o mesmo client, imageUploadBarrier e controlador retornado pelo getter do hook.

use-goals-channel.ts:56–61 retorna o controlador REAL ativo e compatível com owner/client; não constrói outro a partir de state. A exclusão financeira original do hook permanece. O binder confere esse objeto antes/depois das fronteiras assíncronas e invalida todos os handles da geração anterior.

prepareEditor:117–140 captura basis fechado, lê A sob lease e só reutiliza editorKey quando owner/epoch/goalId/goalRevision/baselineFileId coincidem. Outro alvo/revisão/baseline recebe identidade local própria, sem rebase de A. A identidade financeira e a revisão continuam sendo verificadas pelo editor/controller/Core/CAS; metadata da foto não cria equivalência financeira.

O painel retém o objeto exato do overlay em currentTarget e invalida pedidos ao fechar, trocar serviço, ocultar ou desmontar. Antes de disponibilizar o editor, exige a preparação local; uma falha de J2/origem/configuração mantém o formulário bloqueado, sem passar imageUpload undefined como atalho legado. O editor mantém sua chave por scope e o efeito de sessão faz dispose da instância anterior.

## Fonte A estrangeira

sourceCapability:142–155 recaptura o scope ORIGINAL íntegro, invalida o editor B e abre o receiver real para A. sourceKey preserva seleção/generation/client/scope e ignora apenas a progressão permitida de phase/uploadId. O handle público expõe somente current/view/reselect/resume/dispose; não recebe prepare, createId, select, replace ou prova financeira.

Após resume positivo, inspectReady é chamado internamente com a prova nominal retornada pelo próprio coordenador e scope A. Somente um enum sai para a superfície; não existe ready proof para B, DTO de arquivo aceito como autoridade ou foto implicitamente vinculada à meta atual. A superfície de recuperação não descarta A. Retirada/substituição permanecem nas ações explícitas do editor e nos receivers/barreiras originais.

GoalImageSourceRecovery:25–51 captura source/generation, verifica current depois dos awaits, confere a instância do handle e descarta uma abertura tardia recusada. A reseleção entrega apenas o File original: nome/tamanho/MIME são pré-checados, e o receiver verifica hash/identidade. Retornar à edição reabre uma capacidade atual, sem transportar a prova de A como prontidão de B.

A recusa conhecida de lint está em :19–24. Root pediu extrair o cleanup para callback estável preservando incremento da geração atual, running=false, detach do handle e dispose. Não é autorização para capturar uma geração antiga, remover o fence ou redigir J2. Esse delta ainda precisa ser lido no freeze V2.

## Flag, G0, privacidade e RAM

O Provider tem default false; a Page autoriza Financeiro antes do boolean de apresentação. O boolean público não é autorização: reserve é conferido também pelo gate HTTP Root e demais endpoints mantêm seus guardas.

O binder recusa select/replace/reserve/PUT quando novas imagens estão desligadas e recusa resume anterior a finalizing. Observe/finalização original e G0 continuam delegados aos caminhos existentes. Os métodos chamam receivers reais com guardas correntes; newImagesEnabled no DTO do editor não cunha prova.

O ramo selected normal continua chamando review e nunca cai em null/omit. G0 permanece uma ação discriminada authorize→claim nominal antes do UUID financeiro. Create-null/update-omit/update-remove não viram setters genéricos; confirmação financeira é outro gesto. Os três pequenos gates novos na sessão não alteram os corpos de revisão/recuperação/retirada.

Ocultar desmonta Picker/source/prévia e invalida handles; File e URLs continuam sob lifecycles existentes em RAM. Conceal/dispose não fazem clear/revoke dos journals. O logout e a mudança confirmada de dono continuam sendo responsabilidade do registro J2 existente. Respostas de finalize já enviadas não publicam prontidão/GoalCommand depois de serviço/privacy/dispose; a fase durável continua protegida para nova recuperação.

## Controles escritos e limites

Li os 13 unitários e 13 E2Es declarados. Os positivos do binder usam client/controller/J2/barreira/coordenador reais com storage/queue/HTTP sintéticos; não fabricam provas Ready/Linked/G0. Há controles de abertura/memoização, A mesmo alvo vs outro alvo, recuperação original, flag false/G0, File/hash distinto, bloqueio em await de Picker/finalize, privacidade e dispose sem redaction. Os E2Es montam painel/hook reais e mantêm revisão/execute separados, com contadores e nenhum request real não declarado.

Isso não prova Provider/Server Components, sourcegraph, Auth/Entitlement, duas abas reais, Signed URL/Storage, schema coinstalado ou render. Os 13+13 são testes escritos nesta identidade; nenhuma execução é atribuída ao peer. Root deve reconciliar as bases e executar checks próprios depois do V2.

## Hashes centrais

- Binder: 15.233 bytes, SHA256 decc51c15348a38bcbec1112fde2184eb19183c4337ac6135ac4bb83061993b3.
- SourceRecovery V1: 6.144 bytes, SHA256 24b9cbf8eaebfdb0a397bb3c611a28499541043f2f50c0ec051e70ccd0da1641.
- Host: 4.722 bytes, SHA256 2ac35a651a37f833440d5c99c16a90bcc4499f8f973837210bba9fb2976e567c.
- Panel: 18.866 bytes, SHA256 ccd8851271f2d6902f5bcb97b694ea23f25e534e7fca365982a0d0f860fc3f96.
- Session: 17.403 bytes, SHA256 dda7667e45cf27533e27c698eeb2b6b891dc0960fcc5a22447c4b213c44b0d2b.
- Hook: 6.851 bytes, SHA256 80464bff757516689ed9ca0f6cd2a043b75457e6896c909156e5bf70d83b42b9.
- Unitário: 17.057 bytes, SHA256 b6c2b87a6c6ca2ad181e8b05980b13a8dc95b0a8ccb5ebb5d82d0056858df047.
- Patch: 109.324 bytes, SHA256 9d6f289906df4d9e694703a6131057d04618973d6c4fba16bf15e7ca05cec642.

Nenhuma ativação, instalação, aceite de upload/Storage ou produção decorre deste parecer. V1 permanece congelada; aguarda-se a correção estreita de cleanup e sua evidência própria.
