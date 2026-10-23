# Execução em frentes — MVP e redesign

Registro de 23/10/2026. O objetivo autorizado inclui MVP operacional, redesign, onboarding facultativo de nove telas e ajustes da landing. Checkout Asaas, abertura de vendas e Drive continuam fora desta execução. Merge e deploy de produção permanecem bloqueados; homologação isolada está autorizada. Uma pergunta sem resposta não impede as frentes independentes.

## 1. Interface e protótipo

**Implementado:** PR #113, melhorias do onboarding e landing que preservam a identidade e os capítulos aprovados. Mensagens, ações secundárias e resumo foram ajustados sem substituir a arquitetura ou ampliar o escopo comercial.

**Validado:** d16e1dd teve 17 checks originais aprovados; Root conferiu quatro capturas reais do CI em 320/390 px, claro/escuro, contra as referências do protótipo. O Preview conectado ainda está em 85b9712; nele foram conferidos dois percursos reais do onboarding, retorno Google com duas contas, resumo vazio sem duplicação e persistência de tarefa no Kanban após recarga/reentrada. Esses percursos não certificam automaticamente a interface posterior de Metas.

**Em execução:** PR #116, interface isolada de Metas financeiras segundo DS 2.1, revisão de operações e tratamento de resultado incerto. O primeiro CI apontou um erro de tipagem no teste; sua correção permanece separada dos resultados originais. Journal durável, canal, rotas e ativação real não são fornecidos pela fixture RAM.

**Próximo gate:** checks e capturas próprios de Metas; candidato integrado qualificado; então revisão visual conectada em homologação. Medição de contraste e aparelhos reais da nova composição não são declarados por screenshots de fixture.

## 2. Financeiro e novas funcionalidades

**Implementado:** PR #111 contém a composição financeira de orçamento/séries e correções do canal de navegador. PR #115 prepara Core e adapters de Metas, mantendo propostas SQL inertes e regras isoladas do SDK.

**Validado:** 708cbc6 teve 17 checks originais aprovados, incluindo as jornadas de navegador. Seu SQL descartável usa 001–025. As falhas de teste da PR #115 e suas correções estão registradas por SHA; a falha de porta de um original 0de769c permanece sem atribuição artificial ao produto.

**Em execução:** esta branch compõe o código final com onboarding 026; o novo helper verifica todos os 26 arquivos canônicos e aplica os compilers inertes revisados apenas em SQL-in-WASM. Testes existentes conservam ataques e efeitos esperados. Helpers históricos não são ampliados silenciosamente. A preparação e o peer estão em `composicao-mvp-onboarding-finance-026-20261023.md`.

**Próximo gate:** CI próprio da união; migrations novas revisadas, tipos/catálogo e instalação supervisionada somente na homologação; canal/journal e aceites Auth/RLS/CAS, replays, falhas parciais e privacidade. Não instalar uma guarda de fechamento isoladamente antes de existir o caminho de liberação de reservas.

## 3. Restore e operação

**Validado:** uma inspeção nativa V7-r2 do archive imutável autenticou e comparou a origem com o Ensaio_restore, somente leitura. Transporte, cobertura e histórias Auth/Storage concluíram. Produção e destino não receberam mutações.

**Pendente técnico:** o baseline foi recusado por 36 diferenças de vetores de dependências e cinco definições públicas diferentes. Oito amostras têm multiconjunto igual; 28 foram omitidas pelo limite e não são presumidas equivalentes. SQL, permissões ou vetores não foram normalizados para permitir restore. `baselineQualified`, `remoteMutation` e `restoreAccepted` continuam falsos.

**Em execução:** ampliação estritamente diagnóstica com quatro contadores agregados, preservando A2 e limites. Testes puros locais aprovaram 113 casos; CI próprio, leitor estrito novo e eventual inspeção adicional são gates separados. Nenhum resultado sintético autoriza restaurar.

## 4. CI e revisão da integração

Os testes pesados rodam no GitHub; localmente, revisões e verificações focais são serializadas. Cada SHA preserva seus próprios resultados, inclusive falhas, skips e infraestrutura. Não há rerun ou alteração de porta/timeout para produzir um resultado verde.

O candidato deriva os inventários pelas funções originais de arquivos públicos: Admin 471; Foundation 48; Recovery 234; regressão histórica de Storage/Drive 270. Isso não equivale ao vínculo de blobs/dependências e ao encerramento dos serviços nativos: esses precisam ser comprovados pelo CI próprio do candidato. A regressão histórica não recoloca a aba Drive no MVP.

## Decisões e ações externas preservadas

- As credenciais Google de Production serão recadastradas pelo mantenedor após os testes, conforme combinado. Não modificar Production para adiantar a homologação.
- Aceite humano visual e testes físicos da nova interface permanecem separados. As instalações anteriores em iPhone/A35 e a sincronização de tema já relatadas não certificam toda alteração posterior.
- Aprovação final de merge/produção fica para depois dos testes e revisão; enquanto isso continuam implementação, CI, documentação e homologação independente.
- Nenhuma etapa depende de resposta sobre Asaas, Drive ou novas contratações. Esses escopos não são iniciados por esta frente.

## Ordem de execução

1. Encerrar e registrar os originais dos SHAs em teste, corrigindo somente os erros demonstrados.
2. Qualificar o candidato integrado com seus testes, fontes e encerramentos próprios.
3. Concluir canal e schema financeiro em fatias revisáveis, com migrations novas e sem reescrever as históricas.
4. Publicar somente Preview isolado, verificar banco/alvo/configuração e testar as jornadas reais.
5. Registrar o que passou, o que falta e os aceites humanos, sem encerrar issues por inferência.
