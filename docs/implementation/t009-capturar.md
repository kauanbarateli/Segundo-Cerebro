# T-009 — Capturar com exemplos

## Implementação

`src/components/features/capturar` oferece editor de texto simples, biblioteca com filtro sem acento, seleção pela URL `?capture=<id>`, navegação anterior/próxima, quatro tipos, categoria/projeto dinâmicos, organização recolhida, salvar por botão ou Ctrl/Cmd+Enter e rascunho por usuário. A composição segue doc 14 e o [brief](../../.impeccable/surfaces/capturar.md). As sete fixtures, seus IDs, títulos e corpos vêm do provider comum, sem nova coleção da feature.

Criar, editar, converter, organizar, arquivar e desarquivar chamam comandos do mesmo Núcleo usado por Início/Tarefas. Conversão conserva o vínculo recíproco, e Abrir tarefa/Abrir origem mantêm a sessão. Guardar em Conhecimento conserva o ID e usa `organized`; a página persistente/editor futuro continuam em T-015/T-021. O grafo visual é informado como etapa futura, sem controle que simule uma operação inexistente.

Vincular nota usa IDs estáveis e diálogo compartilhado com busca; os chips abrem o destino ou removem o vínculo. Wiki-links têm até quatro sugestões por Tab/botão, aviso para destino ausente e resolução posterior. Autorreferências são ignoradas e as saídas são deduplicadas. Backlinks usam notas salvas, incluindo arquivadas com rótulo. HTML digitado permanece texto.

Renomear reescreve as referências textuais no Núcleo, na mesma transação da nota e de todos os eventos. A operação alcança notas ativas, arquivadas e na lixeira do mesmo usuário, preservando vínculos por ID, anexos e os demais trechos. Títulos legados ambíguos ou expansão do texto além de 30 mil caracteres impedem toda a operação com mensagem explicativa. A UI apenas atualiza seus rascunhos locais depois do sucesso.

## Extensão mínima de contratos

O corpo de captura passa de 10 mil para **30 mil caracteres**, conforme autoridade DS 2.1 do doc 14. Captura rápida genérica mantém título opcional e limite original de título; este fluxo de notas exige título de até 120 caracteres e unicidade normalizada, incluindo arquivadas. O relatório histórico de T-007 permanece como registro daquela entrega.

`Captura`/`CamposCaptura` ganham dois campos opcionais; a ausência é preservada nos clientes antigos:

- `linked_capture_ids?: string[]`: IDs existentes do mesmo usuário, sem repetição ou autorreferência. Referências históricas sobrevivem ao arquivo/lixeira, enquanto novos vínculos não podem apontar para a lixeira.
- `attachments?: AnexoCaptura[]`: `id`, `name`, `mime`, `width`, `height`, `bytes`. Até seis, até 8 MiB por arquivo, PNG/JPEG reencodados, dimensões válidas. O evento inclui somente esses metadados, nunca Blob ou pixels.

`organizarCaptura({id,client_id,destination:'inbox'|'knowledge'})` e `desarquivarCaptura({id,client_id})` são transacionais, idempotentes e emitentes de eventos. Desarquivar retoma `organized` se houver `organized_at` ou tarefa convertida, senão `inbox`. Os comandos não removem origem ou tarefa. Desfazer aparece apenas em organização/arquivo/restauração; conversão oferece Abrir tarefa e não exclusão disfarçada de undo.

## Imagens e rascunhos

As regras de `legacy-segundo-cerebro@ffdf064/src/lib/imagem.ts` foram portadas com seus **14 testes originais**. O preparo adapta `components/features/capture/anexos.ts`, sem importar SDK ou código de envio. Reconhece a assinatura dos bytes antes de decodificar; PNG permanece PNG, JPEG/WebP/GIF vira JPEG a qualidade 0.9; GIF torna-se quadro único. Canvas produz um arquivo novo de pixels, descartando EXIF original. A saída também tem assinatura e tamanho conferidos. URLs de prévia são revogadas ao desmontar.

Escolher, colar e arrastar usam o mesmo preparo. O botão Anexar imagem fica visível mesmo sem anexos. Os Blobs vivem apenas no armazenamento de imagens do provider, isolado pela instância do usuário. Retirar uma imagem do rascunho não apaga bytes ainda referenciados por uma nota salva. Logout descarta a instância e os bytes; não há envio ou persistência de imagem após recarregar.

Rascunhos usam `segundo-cerebro:captures:drafts:v1:<userId>`, debounce de 350 ms e flush ao trocar de nota, ocultar/sair da página ou desmontar. Dados recuperados são validados; falha de localStorage mantém a memória utilizável e informa “Sem armazenamento · sessão atual”. O evento síncrono `segundo-cerebro:demo-logout` cancela timer/flush antes de limpar. Um rascunho de captura ausente na nova sessão pode ser recuperado e salvo como nota nova.

Consultas de rascunho usam somente propriedades próprias, inclusive para IDs `__proto__` e `constructor`. Abrir uma captura sem categoria conserva o valor nulo; o padrão Pessoal vale apenas para nova nota. A biblioteca ordena `captured_at` decrescente, com ID como desempate, sem alterar a coleção compartilhada.

## Verificação

- 44 casos focados passaram: 14 regras de imagem portadas, dez projeções/rascunhos e 20 extensões de contrato. Os 42 contratos originais T-007 também passaram, sem modificar sua suíte. As regressões cobrem rollback no segundo evento, replay, lixeira, isolamento e expansão/ambiguidade na renomeação.
- Typecheck, ESLint focado e portão de camadas passaram após a integração dos imports.
- Oito cenários E2E estão em `tests/e2e/captures.spec.ts`: captura→tarefa→origem; vínculos/wiki/renomeação; arquivo/undo; reload/logout; três vias de anexar com JPEG sintético contendo marcador EXIF e saída sem EXIF; alvos/overflow em 320, 390 e 1280px.
- E2E, screenshots, contraste nos estados novos e revisão visual final aguardam execução integrada. Nenhum servidor, build, banco, commit ou push foi executado por este recorte.

Limites da demonstração: notas salvas usam memória de sessão; só o rascunho textual/metadados usam localStorage. Não há editor de blocos, grafo, autenticação, persistência de arquivos ou sincronização. O marcador nominal `referencia-de-leitura.jpg` da fixture book não conta como uma imagem real e não cria Blob.
