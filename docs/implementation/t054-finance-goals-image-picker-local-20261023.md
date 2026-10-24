# T-054 — escolha local da foto de Meta (B2a)

Implementado em paths novos, **sem montar no GoalEditor** e sem ativar Goals. Base `dab149caf69878e1f3171e2bfbe3ee8c58a3e9a3`. A proposta aprovada é o contrato público E1-B2 `c6754cdb24ba88e15713ca097e707622169265da8bfe9e49eb632b12814022ea`; M1, upload e vínculo financeiro são entregas separadas.

O presenter `GoalImagePicker` recebe somente scope (owner/epoch/editor/Meta/revisão/baseline), disabled e callback local. Reutiliza EntityImagePicker, useImagePreview e PrivateImagePreview. Não recebe aplicação, SDK, uploader, URL remota, GoalCommand ou porta de gravação. A foto atual aparece como estado textual; nenhum endpoint é consultado. File e blob URL permanecem privados à instância e são descartados/revogados na troca/unmount. O callback contém metadados imutáveis, nunca File ou URL.

O modelo preserva a baseline capturada. Cancelar o seletor nativo é NOOP; arquivo inválido conserva a escolha válida anterior. Remover é apenas uma marca local, sem apagar arquivo. Desfazer retorna à baseline. Identidades e revisão divergentes cercam a seleção como stale. Geração local crescente não é client_id financeiro e não volta a zero ao desfazer.

`goalImageDecision` é uma união: unchanged/omit na edição, unchanged/default-null na criação, remove/null explícito, needs-upload para toda seleção, stale para contexto inválido. **Nenhum estado ready existe.** Needs-upload não pode ser traduzido em null ou omissão: a integração futura deve bloquear revisão até prova própria de finalização, e então usar o comando financeiro revisado. Metadata/MIME/preview não provam bytes, dimensões ou finalização.

OBSERVADO doc17: prévia16:7, máximo180px e16:8≤600px. A adaptação mantém tokens DS2.1, foco, alvos≥44px e campo≥16px; status e erro são textuais. Sem quantias/nome de Meta em alt/title, sem imagem de demonstração ou promessa de salvamento. Não há timer, IO, persistência ou repetição automática.

## Validação

Escritos nove testes de jornadas/bordas: substituir→remover→desfazer preserva baseline; nova Meta selecionada continua bloqueada; cancelar/arquivo inválido;8MiB; nomes e tipos; owner/epoch/editor/revisão; cópias; getters/extra; geração sem reuso. **Não executados nesta autoria**, conforme coordenação de RAM do Root. Sem alegação de PASS, contraste medido, validação mobile ou aceite de serviço.

Comandos propostos para o CI/Root, depois da revisão:

```text
npx vitest run tests/components/goal-image-picker-model.test.ts
npx eslint --max-warnings=0 src/components/features/financeiro/goals/goal-image-picker-model.ts src/components/features/financeiro/goals/goal-image-picker.tsx tests/components/goal-image-picker-model.test.ts
npm run check:layers
node scripts/check-secrets.mjs
```

Os nomes dos comandos foram conferidos no package.json; são roteiro, não resultado. Capturas isoladas com File público,320/390/768/1440, claro/escuro, teclado/foco/zoom, blob URL na troca/unmount e zero rede ainda ficam pendentes; nenhum harness/E2E existente foi alterado aqui.

Antes de integrar no editor: porta de upload durável específica Goal, proteção ao perder File, observação/finalize, E1-A, journal/HTTP financeiro e protocolo terminal M1 precisam de revisão e aceites próprios. Cancelar/timeout/recibo ausente nunca libera UUID nem pendência. A foto só aparecerá salva após confirmação do vínculo financeiro; nenhum setter genérico Goal é autorizado.
## Revisão Root da composição

Root preservou o freeze da autoria e ajustou o acesso aos descritores no modelo para um loop com narrowing explícito, mantendo fechamento de campos e recusa de getters antes de ler valores. Um peer independente conferiu a equivalência desse delta. O peer de React identificou a perda possível de foco quando Remover/Desfazer desmontam o botão ativo; agora essas ações transferem foco ao input persistente, sem abrir o seletor nem enviar dados. O adendo foi aprovado estaticamente; a comprovação DOM continua pendente.

O presenter permanece fora do GoalEditor e não fornece upload, prova finalizada ou gravação de Meta. Os nove testes de modelo são código escrito, ainda sujeitos ao CI próprio. Capturas do display da PR #119 não certificam esta apresentação nova.
