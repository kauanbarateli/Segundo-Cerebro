# Alterações, validações e limitações

## Entrega desta auditoria

- Plano único doc18 com arquitetura, comparação por superfície, mapa/branches, decisões e prompts.
- Proveniência dos303 arquivos de referência e inventário completo do GitHub; históricos dos corpos revisados preservados.
- Atualização de precedência/escopo em AGENTS, CONTEXT, PRODUCT, DESIGN, índice e ADRs pertinentes. Doc17 foi preservado integralmente porque seus textos também pertencem ao manifesto congelado; doc18 substitui suas instruções históricas de execução onde indicado.
- Issues existentes consolidadas e cinco correções delimitadas, sem reabrir motores já entregues. Relações e números finais no [mapa](03-execucao.md) e [recibo de publicação](evidencias/publicacao.json).
- Delta documental na PR120; nenhum código de aplicação/teste/workflow/schema alterado por esta auditoria.

## Verificações efetivamente realizadas

1. Leitura do chat de origem, handoff imutável e arquivos pertinentes; análise paralela de arquitetura, interfaces e contratos.
2. Inventário remoto pessoal de75 issues (29 abertas),46 PRs (4 abertas),43 branches, labels/milestones; metadados de22 runs de ad24 e dos dois jobs falhos.
3. Log do job de push confirma TS2345 em teste de frequência; job de PR tem etapa Typecheck confirmada. Não foi executado novo teste de produto.
4. Hash dos305 arquivos de D:, com303correspondências exatas no snapshot no GitHub e dois prompts adicionais. Nenhuma alteração no protótipo.
5. Metadados Vercel confirmam Preview 3403 READY; inspeção renderizada somente leitura, desktop e amostras320/390. E-mails/agenda/segredos não foram publicados nas capturas selecionadas.
6. Verificação documental sem erros: oito documentos principais e seus links; 55 arquivos do pacote congelado preservados; 15 capturas com hashes registrados. O verificador do doc17 aprovou 303 arquivos, 23 scripts e 145 links locais. Scanner de segredos e `git diff --check` também passaram. Não houve execução de novo teste de produto.

## Resultado da publicação no GitHub

- Criadas e conferidas: #122–126, cinco subissues de #71, milestone M4.
- Atualizadas e conferidas: #7, #12, #44, #50, #62–65, #71, #80 e #81 (11 issues).
- Removida a dependência comercial obsoleta #62 → #54. Acrescentadas #62–65 e #122–126 como bloqueadoras de #81, preservando as relações anteriores.
- Todas as 16 issues permanecem abertas; nenhuma entrega foi declarada concluída pela auditoria. O [recibo](evidencias/publicacao.json) registra títulos, hashes e relações lidas de volta.
- Sete [comentários conferidos](evidencias/comentarios-historicos.json) nas issues #31, #72, #73, #75 e #77–79 apontam os complementos, sem reabrir os contratos já entregues.
- A [validação local](evidencias/validacao-local.json) registra links, hashes das capturas e preservação dos arquivos congelados.

## Limitações que a próxima frente deve respeitar

- Preview 3403 não qualifica ad24. Não afirmar paridade por testes/capturas do demo ou por CI antigo.
- A auditoria não exercitou todas as combinações de erro/vazio/sucesso, dark/zoom/leitor de tela, nem aparelho físico. Matriz completa é gate futuro #44/#81.
- Sem leitura do conteúdo do Cofre; sem novos writes em Supabase, OAuth, backup, restore ou configuração Vercel.
- A conta de homologação existente tem dados QA; não limpar ou tratá-la como ator descartável novo.
- Instalação PWA e sincronização de tema foram relatadas pelo mantenedor anteriormente; não foram repetidas nesta auditoria.
- O histórico de issues permanece disponível. Uma issue fechada pode ter cumprido o contrato técnico sem atingir a composição atual; as correções complementares tornam essa distinção explícita.
- Não há estimativa percentual confiável de “MVP pronto”. O plano é ordenado por bloqueios e aceites, não por número bruto de issues.
