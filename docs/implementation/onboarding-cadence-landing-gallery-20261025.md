# Onboarding e capturas da landing — lote de 25/10/2026

## Implementado, ainda sem aceite de execução no GitHub

O onboarding passa a oferecer Todos os dias, Dias específicos e Meta semanal de uma a sete vezes. Etapa, recuperação e resumo compartilham a frequência. A escolha nova recebe versão 2 no item; rascunhos e revisões legados continuam com seu JSON original. A versão externa do protocolo permanece 1. Não há migration, alteração de dependências, permissões, recibos, eventos ou execução de banco hospedado.

O seletor atende a evolução aprovada no [doc 17](../planejamento/17-evolucao-prototipo/README.md), incluindo a paridade de frequência com Hábitos. Ele não reabre a #76 concluída: esta entrega pertence às #63/#80. Foram escritos controles puros de formatos/compatibilidade, E2E de foco/retomada/erro e um caso com coordenador, Core e SQL canônico descartável. Esses testes novos ainda não foram executados; a instalação local de Vitest difere do lock atual, e a execução pesada permanece no GitHub.

O lote também acrescenta um teste SQL descartável para a #64: vínculos de dono/sessão/rodada/geração, veto, reservas no limite de duas contas, replay e dois controles positivos. V1/V2 da proposta foram preservadas e recusadas durante revisão por erros concretos de construção do teste; somente V3 foi incorporada. Isso não representa OAuth Google real, GoTrue ou instalação hospedada.

O gerador Gallery prepara oito capturas reais demo: Calendário em Lista e Tarefas em Kanban, nos temas claro/escuro e formatos desktop/celular. Reutiliza o supervisor existente e acrescenta uma etapa ao CI geral, restrita a push da branch Root. O contrato anterior de Projetos, seus nove membros e os limites de transporte/cleanup foram preservados. Os 17 membros Gallery ficam fora do checkout, ligados ao Source e aos hashes de geração/política. Nenhuma imagem foi produzida ou incorporada nesta preparação.

## Validado localmente

- Revisão Root dos diffs e dos contratos; revisão estática de pares da cadência e do Gallery. Aplicação com before/after e patches conferidos.
- Node 24.19.0: sintaxe dos nove arquivos TS/TSX da cadência pelo parser TypeScript 5.9.3. Não é typecheck.
- ESLint sem avisos nos nove arquivos da cadência e no teste G4. O primeiro lint identificou `aria-invalid` indevido no botão; o delta Root mantém o erro no grupo e a descrição acessível no botão focado, com o E2E correspondente.
- Gallery: seis sintaxes, lint sem avisos, 61/61 testes puros seriais, contrato legado de Projetos com 33 checks e contrato Gallery com quatro. Sem browser, Next, SDK ou rede nesses testes.
- Detector Impeccable nos três componentes alterados: nenhuma ocorrência. Não substitui revisão visual ou testes de interação.

O [inventário local](evidence/onboarding-gallery-local-20261025.json) fixa os 17 paths de código/testes/workflow e os limites desses checks. Os pacotes e resultados originais permanecem no diretório externo de evidências desta tarefa. A referência de aplicação da cadência é o manifesto `177380ca80e6fce8470de986c09fb1d63bdfe45923d6a9dc88f03ff2c2516c7a`, acrescido da correção acessível de dois paths; G4 usa `1921d724071d2d1819e708aa6ac436fe567f4a990d25facdbf34b25d9b2d5913`; Gallery usa `662a1fbb1894f573fceaff39a5b678adf3f9ac1ab9fd378501eb8316eb87ca10`.

## Pendente antes do próximo Preview

1. Executar typecheck, suites e portões completos no GitHub. A coorte anterior ce7 encerrou com 20/22 runs bem-sucedidos; os dois gerais falharam na etapa E2E. Seus originais foram coletados uma vez para diagnóstico; não ocultar falhas ou aumentar retries para aprovar.
2. Qualificar o artefato Gallery próprio, seus hashes e as oito imagens. Somente depois incorporar os 17 membros e aplicar a landing de três capítulos, incluindo o seletor Projetos/Kanban. O pacote UI V2 permanece externo, aguardando esses assets; não apontar imports a arquivos ausentes.
3. Atualizar a homologação após os testes. O Preview consultado continua no Source `3403a5aa1901c166e6cfc1206848bfdc1c34957a`; a cadência deste lote e a nova landing ainda não aparecem nele.
4. Reconciliar o roteiro HTTP conectado com o Source final e concluir os critérios restantes das #62–65/#80/#81. A tentativa anterior de canal HTTP parou na proteção Vercel, sem carregar chaves ou criar atores. Não flexibilizar essa proteção.

Merge e produção continuam bloqueados pelos testes e revisão aplicáveis. [D-078](restore-pos-lancamento-20261025.md) moveu o restore para pós-lançamento; não há operação nova de backup/restore neste lote. Asaas, checkout, abertura comercial e Drive permanecem fora.
