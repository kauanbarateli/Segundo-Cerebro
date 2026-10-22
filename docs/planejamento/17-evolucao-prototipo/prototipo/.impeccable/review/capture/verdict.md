# Verdict — correções de Capturar

**Disposition: ship.** Os dois achados materiais de `review.md` estão **resolved**. O lote encerra a pendência da revisão anterior.

| Achado | Classificação | Evidência |
|---|---|---|
| URL inválida escondida bloqueava salvamento | **resolved** | `richtext.js:103` inicia o campo desabilitado. `closeLink()` limpa o valor e desabilita o campo; `openLink()` reabilita antes de preencher e focar. O campo fechado deixa de participar da validação nativa. |
| Foco do título com contraste insuficiente | **resolved** | `capture.css:39` usa `--ink`. As novas imagens `captura-foco-light.png` e `captura-foco-dark.png` mostram o contorno completo e claramente visível. |

O cenário em `work/capture-browser.cjs:65–77` cobre digitar URL inválida, cancelar, confirmar `checkValidity()`, salvar a alteração de título e verificar o registro persistido. Também reabre o painel, verifica o campo habilitado, digita outro endereço inválido, fecha por Escape e confirma a validade do formulário. `results.json` atualizado registra oito grupos aprovados, inclui essa regressão e não apresenta erros de console. O ciclo corrigido pertence ao componente compartilhado pelos editores de captura e Conhecimento.

Para o foco, o script verifica que o título recebe foco após seleção por teclado e que a cor computada do contorno acompanha a cor de texto nos dois temas. Os pares atuais fornecem **18,13:1 no claro** e **16,01:1 no escuro** sobre a superfície do documento. As duas capturas de foco foram abertas e inspecionadas com `view_image`.

Este verdict se restringe aos dois achados: foram lidos o código alterado, o resultado e as asserções relevantes dos testes, além das duas novas imagens de foco. Os 12 estados de composição permanecem cobertos pela revisão anterior e pela recaptura declarada no resultado atualizado. O detector não foi executado novamente, o produto não foi editado por este revisor e os testes não foram repetidos por este revisor.
