# Peer estático C2b-E V2 — 24/10/2026

Parecer: os dois P2 funcionais de E1 foram corrigidos no delta E2. E2 ainda NÃO está aprovada para integração: há um P2 de tipagem no double unitário de Picker, confirmado somente por leitura. O pacote congelado e o parecer E1 permanecem preservados.

## Vínculo e escopo

- Pacote: finance-goals-image-upload-editor-freeze-v2-20261024.
- Manifesto: 5.802 bytes; SHA256 `6d5df64de7f239882dd7b2afac2391594265fa916bf5fad71306b3bae553c807`.
- Base declarada: `bf1ffb0f0f397bc92b577cf524f4de24e6a49993`.
- Conferidos: 7 after, 7 previous E1, 2 before e 4 artefatos; hashes/tamanhos sem divergência. Os 7 after coincidem com o WT do autor e os 7 previous com os after do freeze E1.
- Cinco deltas: sessão, teste unitário, spec E2E, fixture e documento. Picker e Editor são byte-idênticos a E1.
- Somente leitura, hashes e comparação textual. Não executei Node, TypeScript, testes, navegador, SQL, serviços, rede ou Git apply/reverse-check. Os checks de aplicação dos patches continuam a cargo do Root.

## Achado bloqueador P2 — double de Picker não cumpre seu tipo

`tests/features/goal-image-editor-session.test.ts:17` fornece `Picker: () => null`. O contrato em `goal-image-editor-session.ts:16` exige `typeof GoalImagePicker`; a função real em `goal-image-picker.tsx:26–30` retorna JSX nos dois caminhos, portanto seu retorno inferido é JSX.Element, não um componente geral com retorno ReactNode. O tsconfig do WT declara `strict: true`.

Assim, o double não é atribuível à assinatura exigida com strictNullChecks. O erro já existia no payload E1, mas permanece em E2 e pode bloquear Typecheck antes dos casos novos. Não se trata de falha da autoridade R nem de mudança necessária na API do produto.

Menor correção: usar um ReactElement real no double por `createElement`, com import explícito de React; não usar cast e não ampliar o tipo de Capability.Picker para acomodar o teste. Preservar E2 e emitir delta/freeze novo. Não executei compilador para este parecer.

## Dois P2 de E1 corrigidos

1. **Seleção não pode virar null ou omissão por retorno interno malformado.** Sessão E2:141–149 captura `observed.imageFileId` como unknown, chama `goalUuid` e recusa INVALID antes de `createId` e prepare. O ramo needs-upload não usa fallback; a criação recebe image diretamente. A omissão no update e null explícito de remoção continuam separados. O teste:33–47 cobre ausência, null, texto inválido, número e objeto com hook, exigindo zero UUID/prepare, A intacta e zero coerção. O double opaco apenas alcança a defesa da seam estrutural; NÃO constitui prova nominal R nem aceite do upload.

2. **Fixture distingue omissão de null no update.** Fixture E2:45–48 usa Object.hasOwn para image_file_id; null explícito permanece null e ausência conserva a imagem anterior. O modo existing possui Meta própria revision 3, global 7 e arquivo próprio finalizado. Os dois casos spec:41–46 exigem estado inalterado antes da confirmação, revision 4 depois, uma execução e zero reserve/PUT/finalize, tanto para preservar quanto para remover. Isto corrige a fixture e a lacuna de cobertura; o produto E1 já preservava a distinção omissão/null.

## Preservação e novo negativo de retomada

Reverti em RAM apenas as quatro transformações textuais da sessão (import goalUuid, bloco defensivo do ID, guarda needs-upload e retirada do fallback no create). O texto resultante é exatamente igual à sessão congelada E1. Logo o primeiro receptor nominal, captura de scope/generation, guardas antes/depois dos awaits, retenção da intenção original, retirement-review, nova abertura de B e cancelamento sem apagar A não foram alterados neste delta.

O novo spec:55 escolhe outro File com o mesmo nome e bytes/tamanho/hash diferentes após perda da resposta finalize. Exige upload A idêntico, um reserve/PUT/finalize e zero UUID financeiro, preview ou execute. A retomada exata escrita em spec:56 continua usando metadados de A e novo positivo original. A geração local do picker pode avançar; a comparação com generation do snapshot A é deliberada para retomar A, e não para autorizar B por metadata.

## Hashes after conferidos

| Path | SHA256 |
| --- | --- |
| src/components/features/financeiro/goals/goal-image-picker.tsx | `6ce9d8db76c5063ec5d043de1d88b1c996c2ac4cad4a7c1d39fba3eee8c61c40` |
| src/components/features/financeiro/goals/goal-editor.tsx | `a4e6fa5d12d88941366aa96ce1ac9e1b707ebae604cfca1f72d6824566862a1a` |
| src/components/features/financeiro/goals/goal-image-editor-session.ts | `5a6094affb05393fa4804e6cd063723f08f31a92299fc0227e837838ea624851` |
| tests/features/goal-image-editor-session.test.ts | `e2df026f6ceb4d15455ce560a0e067069b69bb768157516e104ca70ca1378dd1` |
| tests/e2e/finance-goals-image-upload.spec.ts | `3cdc04486135f3f0b5dd60948e40cc9ea23426c8f7100156dd64a062d49b1fb0` |
| tests/e2e/helpers/finance-goals-image-upload-fixture.tsx | `d6357c9cf2bb1a40b94f4cd842363ede3e6df5559e8a49eeb567c308d56ed120` |
| docs/implementation/t054-finance-goals-image-upload-editor-20261024.md | `9b74fdb71dfafdc064e21e433594b6234b276bd7db5f4e2f112569df68c9ce42` |

Patch completo `305ccd624514ed28d4142a76b5b099e9231ef242e6acd90f13e02da694a28502`; delta E1→E2 `b4a926bb2870c1e2d38d819edf737cb399b622bb89b2fb879e26a82fe42c0aab`. Conferência de hash não equivale a aplicação dos patches.

## Limites e próximo gate

Nenhum novo bloqueador funcional objetivo além do double de tipagem nesta leitura do delta. Após a correção mínima, Root deve conferir o novo payload, aplicar/reverter os patches em checkout autorizado e executar os gates próprios da união. A fixture usa client/controller/coordinator/journals reais com HTTP sintético; não prova Auth, Storage, CAS SQL, cleanup real nem PostgreSQL nativo. Nenhum render ou screenshot foi executado por mim. O grafo de fontes precisa ser derivado no novo candidato completo, sem herdar contagens ou CI anteriores. Montagem de Workspace, ativação, merge, produção e restore continuam fora deste parecer.
