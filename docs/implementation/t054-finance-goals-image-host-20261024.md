# T-054 — H1: montagem opcional de fotos no host de Metas

Base de autoria: `97db0840b2f405fdfcd674bba85f26ed490c8547`, árvore `7035bcc35497967f03d18665c639b7e8f61b9312`. O filho `799b7426b088f88ae3e0aa04c8d256df21fe371d` contém correções/evidências de outras frentes e será reconciliado por Root. Este registro não instala schema, não ativa uma flag e não é aceite conectado.

## Composição e identidade

`FinanceGoalsHost` conserva sua única factory financeira e o lifetime já existente. A instância concreta recebida abre `GoalImageHostBinding`, ainda sem IO. O binding captura dono, epoch do Provider, objeto/epoch do client, origem de Storage e referências dos serviços. O `GoalsPanel` oferece somente por gesto seu getter do **mesmo** controlador criado em `useGoalsChannel`; não há outro controlador, port ou journal financeiro. A exclusão `beforeRead → refreshActive → controller.page` permanece dentro de `channel.run`.

Na primeira preparação humana, o binding abre/readback o J2 real (`browserGoalImageUploadJournal`) e o memoiza por host vivo. O Picker é carregado depois dessa conferência. Cada coordenador usa o mesmo J2, `client.imageUploadBarrier`, client e getter do controlador. Todas as fronteiras assíncronas verificam geração, dono, Provider/client epochs, serviços, controlador e privacidade. A capacidade opcional do editor delega aos receivers reais; não aceita DTO para fabricar Ready, Linked ou G0.

Uma fonte A íntegra somente empresta seu `editorKey` quando `ownerId/epoch/goalId/goalRevision/baselineFileId` são exatamente os da edição. No mesmo alvo, fechar/reabrir ou ocultar/exibir requer nova preparação humana, conserva a chave e retoma A. Um alvo/revisão/baseline diferente recebe sua identidade local; A não é rebaseada.

## Recuperação da fonte original

Quando A ativa pertence a outra edição, a superfície **Recuperar envio original** abre por gesto um coordenador na identidade inteira de A. Ela não recebe `prepare`, `createId`, seleção de nova foto, intenção financeira ou prova pública. Permite apenas consultar, reselecionar o arquivo original e retomar. Nome/tamanho/MIME são conferidos antes de entregar o File; o receiver existente verifica o hash e a identidade durável. A fase pode avançar sem transformar sua origem em B.

A finalização original passa pelo sender real `file.upload.finalize`; somente o receiver do coordenador emite a prova nominal. A superfície inspeciona essa prova internamente e mostra apenas um estado local de conclusão do envio, sem vincular arquivo à meta atual. Voltar à edição atual reabre a capacidade do alvo. Retirar A exige novo positivo original e a barreira financeira real; substituir exige `replaceRetired` explícito e depois novo handle B. O binding não executa automaticamente nenhum desses passos, não faz ACK e não interpreta metadata `ready-unbound` como prova.

Se o File original foi perdido e A ainda não pode finalizar, a ação G0 **Continuar sem nova foto** permanece disponível depois de consultar o envio no editor atual. Ela captura/valida os campos e obtém/consome a autoridade nominal existente, preservando A integral. Create usa `image_file_id:null`; update preserva por omissão ou remove por gesto próprio. Escolher/Revisar normalmente jamais cai silenciosamente em null/omissão. O UUID financeiro só nasce depois da claim positiva, e a confirmação financeira continua sendo um segundo gesto.

## Rollout, privacidade e descarte

A Page autoriza Financeiro antes de calcular o boolean público com o módulo Root `finance-goals-images-availability.ts`. `GoalImagesHostProvider` tem default `false`; o boolean não é prova de autorização. Sem editar `FinanceWorkspace`, o host recebe essa apresentação. A disponibilidade antiga de Metas não foi modificada.

Com novas imagens desligadas, o binding recusa nova seleção, substituição, reserve e PUT. A política conservadora também recusa retomada anterior a `finalizing`; só a finalização já alcançada (`finalizing/ready-unbound`) e a recuperação G0 continuam. Root mantém a mesma política no endpoint de reserva: false recusa toda reserva/renovação, enquanto observação/finalização original continuam sob Auth/Entitlement próprios. Uma URL já emitida conserva seu TTL; desligar rollout não é revogá-la. A lib de transporte existente mantém limites de bytes, URL/origem, deadlines, EOF e cancelamento.

Ocultar valores desmonta a fonte sensível/Picker/prévia e invalida handles/callbacks. Exibir exige nova preparação humana; nenhum corpo dos journals é removido. Fechar diálogo ou desmontar Financeiro apenas dispose/conceal; não equivale a logout. O registro J2 de logout e troca confirmada de identidade existente continua responsável por redigir/revogar, inclusive entre factories/abas. Não há clear, outro UUID de upload por ausência ou retry automático. Recusa de journal/origem/configuração bloqueia o formulário de imagens, sem fallback legado.

## Validação escrita e pendências

- `tests/features/goal-image-host-binding.test.ts`: client/controlador/J2/barreira reais com armazenamento/fila e transportes públicos sintéticos. Cobre abertura por gesto/memoização, chave A, fonte separada, finalização original, G0 com flag false, File divergente, owner/Provider/controlador/serviços/privacidade/dispose após await e ausência de fallback em falha local.
- `tests/e2e/helpers/finance-goals-image-host-fixture.tsx` monta o `GoalsPanel`/hook reais, não cria outro controlador nem fabrica provas. O HTTP e as linhas de arquivo são públicos e sintéticos; localStorage e Web Locks são os do navegador do teste. `tests/e2e/finance-goals-image-host.spec.ts` escreve recuperação da origem A, G0 sem IO de foto, flag false, quota local, privacidade/remontagem e revisão/confirmação separadas. Os seis casos 320/390/768 × claro/escuro escrevem PNGs, teclado/retorno de foco e os guards existentes de overflow/alvos/campos.
- O layout reutiliza DS2.1, Geist, Dialog/Button/Field/EntityImagePicker e os estilos de Metas. Não há asset, CSS, paleta ou controle menor novo. O PNG de 70 bytes é apenas fixture pública já revisada; não é capa de produto.

**Nenhum teste, TypeScript, lint, bundler, browser ou captura foi executado por esta autoria.** Os testes sintéticos não provam Provider/Next Server Component, sessão real, duas abas nativas, Auth/RLS, Storage/Signed URL ou coinstalação do SQL. Root precisa conferir os hashes, o grafo/contagens derivados, lint/typecheck/CI e os PNGs próprios; depois, em homologação isolada com schema revisado, validar o host real e as corridas/lifecycles. Merge, produção, flags e schema seguem bloqueados por seus portões próprios.

Dependência Root copiada sem edição para resolver a Page: `src/adapters/db/finance-goals-images-availability.ts`, SHA256 `be1e4a534a0c20f70da098d498ea830b5e4a43b800ea3d705084c4fcecc44018`. Fica fora do patch H1 e não substitui o pacote de rota/testes/doc de rollout de Root.

Fontes: `docs/implementation/finance-goals-host-mount-plan-20261024.md`, contratos G0/J2/R2/C2b-E da base, `docs/planejamento/17-evolucao-prototipo/03-decisoes-e-contratos.md` (§Metas) e `tickets/t-054.md` do mesmo pacote, `DESIGN.md`, `.impeccable/surfaces/financeiro.md` e referências `harden/craft-floor` da skill Impeccable local. A revisão é documental; fidelidade renderizada e contraste não receberam selo PASS.
