# Evidências e limites

## Conferido nesta consolidação — 17/10/2026

- Código do produto lido na base `61d03c768071e6618136e648fc71c552e3db2043`; mapa das 12 rotas, camadas compartilhadas, contratos e testes existentes. Inspeção estática, sem executar serviços ou dados reais.
- Snapshot final copiado do diretório de entrega. Runtime e assets preservados, com normalização textual para LF e retirada de linhas vazias excedentes no fim conforme o repositório; `LEIA-ME.txt` recebeu somente adaptação editorial para portabilidade. Referências originais copiadas com os nomes preservados.
- Navegação pelas 12 telas nos dois temas, troca de tema, expansão/recolhimento da sidebar e abertura/fechamento do menu mobile operados no navegador. [Capturas e condições](../capturas/README.md). Nenhum dado de conta real usado.
- Correspondência das 82 cores com o JSON oficial; 88 pares de contraste textual, mínimo **4,5109:1**, sem falhas. [Relatório numérico](contraste-ds21.json). O [verificador](../verificar-pacote.mjs) recalcula esses valores e verifica a sintaxe dos cinco scripts, hashes e links locais do pacote.
- Especificações revisadas separadamente para integração e medidas visuais. Registro de diferenças do protótipo: alvos pequenos, campos, motion, fuso demonstrativo, fontes fixas e funcionalidades simplificadas. A resolução para produção está nos documentos 02–05.

## Evidência anterior preservada

[VALIDACAO.md](../prototipo/VALIDACAO.md) e [DIAGNOSTICO.md](../prototipo/DIAGNOSTICO.md) conservam o contexto do refinamento, incluindo 70 verificações anteriores e limites declarados. Esses resultados não foram reexecutados integralmente nesta consolidação. A correção cromática posterior tem o relatório de 82 cores/88 pares acima. Os screenshots de `capturas/` e `prototipo/preview*.png` usam a paleta final DS 2.1.

## O que este PR não comprova

Não houve implementação no produto, execução do Next conectado, migração, conexão Google/Supabase real, teste completo de domínio, build do produto, ensaio em aparelho físico, leitor de tela, zoom 200% ou preferência de movimento reduzido do sistema nesta consolidação. A navegação do snapshot e as contas de demonstração não comprovam esses resultados.

Os 88 pares cobrem texto sobre papéis conhecidos, não a auditoria completa de contraste de controles, foco, composição alfa ou todos os estados do produto. Repetir medições nos fundos renderizados após integração. Capturas de página inteira incluem barras fixas na posição inicial do viewport; utilizar as imagens com sufixo `viewport` para avaliar o enquadramento mobile.

Os testes e comandos do [plano de aceite](../05-aceite-validacao.md) são obrigações da frente executora, não resultados deste PR. CI só pode ser declarada aprovada quando a execução correspondente ao SHA publicado estiver concluída no GitHub. A [issue #44](https://github.com/kauanbarateli/Segundo-Cerebro/issues/44) continua responsável pela coordenação do aceite final após estabilidade do design.
