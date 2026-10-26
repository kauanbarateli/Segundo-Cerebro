# Capturar, Conhecimento e destaque de Metas — QA conectada

**OBSERVADO em26/10:** Preview isolado Source `0310f63432e6297d22dd0c1e6a8640b3ffa33015`, deployment `dpl_AaQTY2yywx2K51baX1aYq1qkoYG3`, projeto pessoal `twrydxsdemaykgvdlpyd`. Conta comum descartável já criada pelo mantenedor. A [prova sanitizada](evidence/doc18-content-goal-connected-20261026.json) contém contadores/booleanos e hashes dos JPEGs originais, sem UUID, e-mail, URL de arquivo privado ou payload. Não houve novo login, consentimento Google, migration ou SQL de escrita.

## Percurso de conteúdo

1. Baseline restrito ao perfil exato e marcadores: captura0, caderno0 e página0. A primeira consulta readonly usou equivocadamente `knowledge_notebooks.title` e foi recusada sem retornar dados; Root conferiu a migration e corrigiu para `payload.name`, sem ampliar o filtro.
2. Criação de um caderno sintético e de uma captura curta em negrito. Título vazio foi recusado; o erro estava associado ao campo, mas o foco ficou em BODY. Link `javascript:` foi recusado com foco no endereço. Um link HTTPS válido produziu o erro genérico de limite de conteúdo; a última alteração foi desfeita antes de salvar.
3. Seleção única do asset público `public/icons/icon-192.png` (192×192,4.608bytes). Após a finalização, salvamento e recarga conservaram a mesma captura rica v1, um arquivo válido e seu vínculo. A leitura independente encontrou um recibo de criação, um evento e um recibo de finalização. Não se mede latência de upload: o controle do seletor retornou tardiamente, sem permitir atribuir esse tempo ao servidor.
4. **Guardar em Conhecimento** no caderno QA criou uma única página v1 e arquivou a captura. Um recibo de promoção, um evento de criação e um vínculo página→mesmo arquivo. Documento inicial igual ao da captura. O leitor tinha zero contenteditables/toolbars e a imagem carregou.
5. **Editar → Voltar à leitura → Retomar edição** conservou a linha sintética não salva somente na aba. O leitor mostrou o conteúdo salvo e o aviso do rascunho; a leitura independente ainda encontrou página v1 e zero recibos de update.
6. Um acionamento de **Salvar página**, seguido de leitura e recarga, deixou página v2 e um recibo de update. Captura/caderno/página/arquivo continuaram únicos; os eventos representam os estados atuais. O documento da página passou a diferir legitimamente da origem histórica. [Leitor final](evidence/doc18-content-goal-connected-20261026/reader-final.jpg).

## Destaque de Meta existente

Foi selecionada somente a Meta sintética `QA 24/10 — foto da Meta`, com revisão e confirmação. O destaque permaneceu após recarga; a imagem pública existente apareceu no cartão e no [detalhe](evidence/doc18-content-goal-connected-20261026/goal-detail-light.jpg). O formulário recusou aporte vazio localmente; nenhum aporte, conta, lançamento ou nova Meta foi criado.

Depois da leitura/reconciliação explícitas, Root restaurou **Sem destaque**. A consulta readonly encontrou o singleton com alvo nulo, a Meta ativa, a referência de imagem consistente, um arquivo live e uma reserva finalizada. Metadados relacionais não substituem uma prova independente dos bytes físicos no Storage. No drawer medido1280×720 não houve overflow horizontal; isso não certifica mobile ou zoom200%.

## Correções e limites

As correções em desenvolvimento foram motivadas pelo Preview0310: foco após a reconciliação de `busy` na validação do título e schema Link de UI restrito aos quatro atributos já aceitos pelo domínio. O TipTap acrescentava `title:null` ao JSON; um documento de311bytes era recusado por atributo extra, não por tamanho. Contrato de domínio, SQL e limites não foram ampliados. Testes puros e lint não substituem o novo aceite hospedado dessas correções.

Continuam pendentes: CAS em duas abas, falhas reais de rede, todos os controles da toolbar, arquivo inválido/quotas/EXIF, logout, zoom e aparelhos físicos. Os negativos existentes do CI conservam suas identidades; não se induziu indisponibilidade no hosted. O rascunho de Conhecimento é memória da aba, sem promessa de sobreviver a reload; conteúdo salvo foi recarregado.

Permanecem na QA apenas um caderno, uma captura arquivada, uma página v2 e um arquivo sintético com dois vínculos. Nenhuma exclusão global, remoção de usuário ou revogação Google foi executada. Merge e produção continuam bloqueados. Referências: #122, #124 e [registro da execução](retomada-doc18-20261026.md).
