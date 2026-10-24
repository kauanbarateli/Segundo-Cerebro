# Foto de Meta na homologação conectada — 24/10/2026

O caminho positivo foi observado por Root no Preview dpl_89je6CQZtbb6HL92gXbY3PuDokp8, Source be37202c80b0454259038a40bb3d12ce54b12fcf, árvore 61189963f7c38020eb618ea2b844a7599ea49675, conectado somente à homologação TWry. As flags usadas pertencem à branch de Preview; esta evidência não altera produção.

## Observado / PASS

A sessão da conta QA existente e autorizada foi preservada. Root criou uma única Meta marcada como dado de teste, de nome sintético QA 24/10 — foto da Meta, alvo R$100 (10000 cents), sem conta ou reserva. Foi usado o asset público técnico public/icons/icon-192.png. O fluxo passou por preparar, revisar com foco em Voltar (checkpoint Root 33), confirmar Criar meta (checkpoint 34), Atualizar metas manualmente para exibição no Planner e reload completo. O registro não pressupõe atualização automática do Planner.

Após reload, Root observou uma imagem privada carregada, img.complete e dimensões naturais 192×192, com a marca visível na capa. A medição DOM do viewport CSS foi 948×569, sem overflow horizontal; tema dark herdado do sistema. Nessa observação desktop, nenhum override havia sido aplicado. A imagem renderizada da captura não foi usada para inferir o tamanho do viewport. Este autor não abriu navegador nem acrescentou screenshot/asserção visual ao relato.

Root executou separadamente a consulta METAONLY pinada 39fdbb91222ec185d84d51f9144ba745e7fd123f6a989f1c7210994407ab7727 na conexão MCP dedicada TWry, em READ ONLY/REPEATABLE READ. O escopo exigiu exatamente uma Meta com o nome sintético. Os 15 resultados foram positivos: uma Meta, target sintético 10000 coerente, imagem não nula e projetada no payload, arquivo do mesmo owner com kind correto e vivo, uma finalização, um objeto Storage existente, zero reservas e um evento created da mesma Meta. Nenhum UUID, nome de usuário, e-mail, payload, URL privada, path Storage ou token foi retornado. O [JSON curado](evidence/t054-goal-image-connected-homologation-20261024.json) preserva os 15 campos numéricos/booleanos.

A homologação recebeu uma única aplicação do SQL 027, 158010 bytes/SHA f96d7a62b9337b9688c34ac471dd9fd326318e12d859817c263bb1ccf46d072a, após autorização humana exata. Versão MCP 20261024160005/m027_finance_mvp_vertical; arquivo público 20261024130000_finance_mvp_vertical.sql, sem history repair. O catálogo V4, 207834 bytes/SHA 19b5f158dfd2003fa89285df99f4ab2e0287ee411b07b9a6b0bc7e6fb82f6e9e, aprovou 2512 checks sem desvios em PG 17.11. Isso é evidência separada do teste de tela.

## Responsividade parcial observada por Root

Na mesma Source, o override de viewport da ferramenta em 390×844 mostrou o card com foto carregada; Root inspecionou card, progresso e botões, sem overflow horizontal. Em 320×740, o DOM confirmou Meta presente e imagem 192×192 completa, também sem overflow horizontal. A captura desse segundo tamanho mostrou heading, ações e filtro de orçamento; o card estava abaixo do frame, portanto não se afirma card inteiro visível. O override foi resetado ao final. São observações parciais de viewport, não execução em telefone físico.

## Pendente / limites

Este é um positivo conectado de criação com foto e persistência após reload. Não certifica todos os adversos de upload/Storage, limpeza, logout, duas abas, contraste, acessibilidade completa, telefone físico, A35 ou iPhone. Nenhum novo papel master/common foi verificado; usou-se somente a conta QA autorizada existente.

A interação de transporte/filechooser da ferramenta CUA levou cerca de 46 minutos. Esse intervalo não é uma medição da latência do produto ou do upload e não constitui benchmark.

Nenhuma limpeza, DELETE, exclusão de arquivo ou remoção do dado QA foi executada por esta verificação. A nova CI integral CURRENT27, comparação estrita do CLI27/tipos, readers e contagens de fontes ainda precisam de seus próprios gates. PR120 continua em rascunho; merge, produção e restore permanecem bloqueados.

Proveniência: relato e execução Root, consolidados em docs/implementation/evidence/current27-integration-verification-20261024.json (SHA 94bb87e6daef1125c4ee65836a8fef6e60a2818e497a59f16bc84b79cfa2e126). O preparo/evidence anterior em EV/goal-photo-qa-meta-readonly-prep-v1-20261024 permanece preservado.
