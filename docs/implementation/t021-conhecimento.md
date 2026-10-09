# T-021 — Conhecimento persistente

Implementação local de 09/10/2026. A migration nova não foi aplicada e não houve acesso Supabase, criação de dados remotos ou ensaio real de navegador neste recorte.

O Conhecimento conectado usa páginas e cadernos próprios. O editor TipTap é carregado sob demanda e aceita um documento de blocos fechado, com teto de 512 KiB, profundidade 32 e até 10 mil nós. Texto é derivado do documento validado; links HTTP/HTTPS são validados e texto não é convertido em HTML arbitrário. O ramo de demonstração permanece identificado e separado.

`[[` oferece destinos e criação de página. Salvar extrai referências; confirmar um destino inexistente cria a página e resolve sua referência na mesma transação. Wiki-links resolvidos conservam o ID do destino ao renomear. Backlinks e vínculos são projeções em lote de um snapshot; o adapter chama uma RPC por leitura e não consulta um registro por backlink. O grafo visual continua na fase 2.

Páginas têm versão própria para concorrência otimista. A interface preserva o rascunho ao detectar conflito e oferece usar a versão salva ou salvar explicitamente o rascunho sobre a atual. Caderno e página possuem lixeira com `deletion_batch_id`: restaurar uma árvore restaura só os registros excluídos por aquele lote, mantendo itens previamente excluídos na lixeira. Arquivar preserva referências e vínculos.

Promover uma captura cria uma única página por `origin_capture_id` e arquiva a entrada histórica na mesma transação. A origem deixa de aceitar edição de título/conteúdo; a página é o registro editável. A migration nova acrescenta `readonlyCaptureIds` ao snapshot T-015 e a RPC `knowledge_capture_origins` de metadados para integrar essa condição sem modificar o payload da captura nem migrations aplicadas. A fachada de Capturar deve ignorar essas origens ao reescrever referências por título.

As escritas usam o registro compartilhado de envios do aplicativo. O endpoint aceita comandos públicos fechados, vincula dono e canal no servidor, exige origem igual, limita o body e autentica antes de instanciar o cliente privilegiado. SQL revalida sessão e Entitlement com o lock já usado em Capturas/Tarefas; o recibo precede o CAS e dado, referências, evento e recibo são atômicos. O fingerprint interno é SHA-256 da assinatura estável. Resposta perdida consulta o mesmo recibo; não produz sucesso inventado.

## Contrato de integração

- `GET /api/knowledge`: `{revision,notebooks,pages,refs,links,targets}`; nunca retorna captures/receipts privados.
- `GET /api/knowledge?page=UUID`: página, backlinks e relacionados.
- `GET /api/knowledge?related_type=task&related_id=UUID`: `RelacionadosDTO` com `{source,items}`; cada item possui `link_id,type,id,title,href`. Entitlement da fonte e Conhecimento são exigidos; visibilidade não revoga acesso.
- `POST`: `ComandoConhecimento` em `src/core/conhecimento/types.ts`. Notebook retorna Caderno; CRUD de página retorna Página; resolve-ref retorna `{page,target}`; promoção retorna `{page,capture_id}`; vínculo retorna Vinculo.
- O painel compartilhado de tarefas/capturas/eventos usa o GET relacionado e `executeDomainCommand`, sem importar a feature Conhecimento.

## Arquivos de banco e execução manual

Aplicar em ordem o pacote canônico, incluindo `20261009144350_knowledge_pages_links.sql`, após revisar o projeto pessoal dedicado. Não reaplicar as migrations de identidade/Capturas já instaladas. Não há seed/reset ou aplicação automática em CI/build/deploy.

Depois da aplicação, executar separadamente `supabase/tests/knowledge-catalog.sql` e `knowledge-behavior.sql`; ambos terminam com ROLLBACK. O segundo usa somente identidades sintéticas aleatórias transacionais. Sua presença não comprova execução ou eficácia real de RLS/concorrência.

## Evidência local e pendências

29 testes focados de Núcleo, adapter, HTTP e cliente aprovados; lint deste recorte sem avisos e typecheck sem erros. A suíte cobre referência pendente/criação/backlink, renomear, conflito sem sobrescrita, lixeira exata, ciclos, normalização, promoção única com histórico, idempotência, CAS stale, reconciliação, sender compartilhado, isolamento, gates, body limitado e erros sem vazamento.

Pendentes: aplicação manual, tipos gerados do schema instalado, asserções reais, concorrência com conexões simultâneas, fluxo editor→criação→backlink em navegador conectado, contagem real de consultas, inspeção desktop/mobile nos dois temas e teclado/leitor de tela. O launcher Impeccable não executou por indisponibilidade de cache/permissão; PRODUCT, DESIGN, brief existente, Operate e Craft Floor foram lidos como fallback. Não se atribui aprovação visual ou encerramento remoto da issue.

Limite operacional explícito: snapshot completo máximo de 10 mil registros/8 MiB; exceder retorna erro, sem truncar árvores/referências silenciosamente. Paginação de documentos precisa preceder expansão além desse limite. O journal aceita o teto específico de envio definido pela integração; upload/anexos não pertencem ao documento deste recorte.
## Integração final da raiz — 09/10/2026

Os resultados e restrições de execução descritos acima pertencem ao checkpoint individual do agente deste módulo. A raiz estava autorizada a compilar e testar e concluiu a integração: 1.427 testes em UTC e São Paulo, 57 testes Node, 14 migrations e 29 asserções em PostgreSQL descartável, catálogo1242 e **168 E2E Chromium**. O portão Impeccable passou com zero registros. Detalhes, auditoria visual e limites estão na [validação final](t028-validacao-final.md).

Asserções de comportamento/fixtures são somente para **base dedicada vazia**, com rollback e verificação de resíduos; não executar sobre contas reais. No projeto pessoal, a revisão estrutural usa o catálogo readonly. Nenhuma migration nova foi aplicada remotamente. Banco/Storage/Google/SMTP, concorrência real, aparelhos e backup/restore seguem na [entrega e pendências](entrega-mvp-pendencias.md). Teste de demonstração não comprova o módulo conectado.
