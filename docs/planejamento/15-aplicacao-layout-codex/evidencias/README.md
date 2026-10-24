# Evidências e limites

## Atualização: onboarding simplificado — 17/10/2026

O snapshot atual inclui a primeira experiência de nove telas, sua integração ao Início/Configurações, fontes JS/CSS, documentação de superfície e prévias finais. Os tokens cromáticos permanecem DS 2.1. A alteração de runtime é restrita ao snapshot documental; não há implementação de onboarding na aplicação Next neste PR.

| Evidência | Escopo e resultado |
|---|---|
| [comportamento.json](onboarding-simplificado/comportamento.json) | 31/31 verificações Node/VM aprovadas no protótipo simplificado: migração demo, rascunhos, validação, limites, vínculos e conclusão idempotente. |
| [verificar-comportamento.cjs](onboarding-simplificado/verificar-comportamento.cjs) | Mesma suíte, adaptada somente no caminho de entrada para permitir reprodução dentro do pacote. Executa dados fictícios em VM, não usa serviços. |
| [navegador.json](onboarding-simplificado/navegador.json) | Fluxo completo, pular tudo e entrada offline aprovados; 17 medições em desktop/mobile, sem erro JavaScript capturado. Registro do refinamento local, anterior à consolidação no PR. |
| [erros-movimento.json](onboarding-simplificado/erros-movimento.json) | Foco nos erros de caderno/nota, abertura do detalhe necessário e correção; reduced motion desativa a entrada e duração normal computada de 180 ms. |
| [revisao-final.md](onboarding-simplificado/revisao-final.md) | Parecer independente do refinamento: ship, sem achados materiais P0/P1/P2 no escopo visto. Revisão por arquivos/capturas; não reexecutou testes. Caminhos citados são os da entrega original. |
| [capturas.json](onboarding-simplificado/capturas.json) | Nova série de 20 capturas de referência: nove telas em dois temas, mais dois estados mobile; Edge isolado/file/offline. Inclui viewport, conteúdo fictício, hashes da fonte e sua cópia normalizada. |

Para reproduzir as verificações sem instalar pacotes, na raiz do repositório:

```sh
node docs/planejamento/15-aplicacao-layout-codex/verificar-pacote.mjs
node docs/planejamento/15-aplicacao-layout-codex/evidencias/onboarding-simplificado/verificar-comportamento.cjs
```

O primeiro comando verifica hashes, inventário, links, as 82 cores/88 pares textuais e a sintaxe dos seis scripts. O segundo cobre somente o comportamento do snapshot e foi reexecutado nesta atualização sobre a cópia do pacote: **31/31 aprovados**. O relatório de [validação local](../prototipo/VALIDACAO.md) delimita as revisões históricas. As novas capturas não são prova de OAuth, persistência remota, leitor de tela ou funcionamento da aplicação real.

Uma revisão independente dos documentos README/03–08, do índice de capturas, das evidências e da correspondência com o JS/CSS aprovou este plano sem achados P1/P2 acionáveis. Foi uma revisão de leitura; não executou serviços ou testes de produção.

O lote L3O e a jornada de onboarding em [05-aceite-validacao.md](../05-aceite-validacao.md) permanecem pendentes de implementação e verificação produtiva. Resultados antigos das 12 áreas são preservados abaixo como histórico; não foram reexecutados integralmente nesta atualização.

## Histórico: consolidação inicial — 17/10/2026

- Código do produto lido na base `61d03c768071e6618136e648fc71c552e3db2043`; mapa das 12 rotas, camadas compartilhadas, contratos e testes existentes. Inspeção estática, sem executar serviços ou dados reais.
- Snapshot final copiado do diretório de entrega. Runtime e assets preservados, com normalização textual para LF e retirada de linhas vazias excedentes no fim conforme o repositório; `LEIA-ME.txt` recebeu somente adaptação editorial para portabilidade. Referências originais copiadas com os nomes preservados.
- Navegação pelas 12 telas nos dois temas, troca de tema, expansão/recolhimento da sidebar e abertura/fechamento do menu mobile operados no navegador. [Capturas e condições](../capturas/README.md). Nenhum dado de conta real usado.
- Correspondência das 82 cores com o JSON oficial; 88 pares de contraste textual, mínimo **4,5109:1**, sem falhas. [Relatório numérico](contraste-ds21.json). O [verificador](../verificar-pacote.mjs) recalcula esses valores e verificava a sintaxe dos cinco scripts originais, hashes e links locais do pacote.
- Especificações revisadas separadamente para integração e medidas visuais. Registro de diferenças do protótipo: alvos pequenos, campos, motion, fuso demonstrativo, fontes fixas e funcionalidades simplificadas. A resolução para produção está nos documentos 02–05.

## Evidência anterior preservada

[VALIDACAO.md](../prototipo/VALIDACAO.md) e [DIAGNOSTICO.md](../prototipo/DIAGNOSTICO.md) conservam o contexto do refinamento, incluindo 70 verificações anteriores e limites declarados. Esses resultados não foram reexecutados integralmente nesta consolidação. A correção cromática posterior tem o relatório de 82 cores/88 pares acima. Os screenshots de `capturas/` e `prototipo/preview*.png` usam a paleta final DS 2.1.

## Limites da consolidação inicial e do aceite de produção

Não houve implementação no produto, execução do Next conectado, migração, conexão Google/Supabase real, teste completo de domínio, build do produto, ensaio em aparelho físico, leitor de tela, zoom 200% ou preferência de movimento reduzido do sistema nesta consolidação. A navegação do snapshot e as contas de demonstração não comprovam esses resultados.

Os 88 pares cobrem texto sobre papéis conhecidos, não a auditoria completa de contraste de controles, foco, composição alfa ou todos os estados do produto. Repetir medições nos fundos renderizados após integração. Capturas de página inteira incluem barras fixas na posição inicial do viewport; utilizar as imagens com sufixo `viewport` para avaliar o enquadramento mobile.

Os testes e comandos do [plano de aceite](../05-aceite-validacao.md) são obrigações da frente executora, não resultados deste PR. CI só pode ser declarada aprovada quando a execução correspondente ao SHA publicado estiver concluída no GitHub. A [issue #44](https://github.com/kauanbarateli/Segundo-Cerebro/issues/44) continua responsável pela coordenação do aceite final após estabilidade do design.
