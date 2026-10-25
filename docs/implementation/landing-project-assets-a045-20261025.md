# Landing — lote de Projetos com origem conferida

**Integrado:** quatro WebP originais do aplicativo demo, quatro sidecars e o recibo de captura. Os nove arquivos foram copiados sem reencode, recorte ou alteração do conteúdo. Imports, composição, CSS e animações da landing foram preservados.

Origem: Source `a045c3e4e593b7cf3c40fb65732f64eb5e039545`, árvore `cc9f1a8d5ab3517e26c1b06b2814a55a367dc0a7`, [run 40168721816](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40168721816), job `121095022272`, tentativa original. Artefato `12589202974`, 283.802 bytes, SHA-256 `e9d0526189412b089254dca68735aa6987e8362335e33433c6fbc4abaf752c97`. Browser-evidence e outros conteúdos não foram extraídos.

**Validação estrutural:** ZIP/digest/tamanho e conjunto exato de nove membros; hashes de imagens/sidecars, Source de quatro campos, política de GET loopback, sem API/SW/sockets, tempos da captura, viewport, tema, densidade e canvas WebP conferidos. O [recibo original](evidence/landing-project-capture.json) permanece exato. A seleção e transferência tiveram limites e nenhuma repetição; a identidade pessoal foi confirmada separadamente pelo Root.

**OBSERVADO na inspeção visual Root:** os quatro originais mostram o detalhe demo “Mudança de casa”, nos temas claro/escuro e desktop/celular. Texto legível, controles organizados, sem loading, erro, sobreposição ou corte horizontal inesperado no recorte. A capa neutra com ícone é a neutralização prevista pelo gerador, sem simular upload real. O fim do viewport não comprova o conteúdo fora dele.

As imagens foram decodificadas e exibidas pelo `view_image`, com redução de 2880×1800 para 1996×1248 e de 1170×2532 para 946×2048. Não houve medição nova de contraste, inspeção física ou aceite de animação por imagens estáticas. [Registro por imagem](evidence/landing-project-visual-a045-20261025.json).

Os quatro arquivos de imagem passaram de 397.856 para 299.586 bytes, **24,7% menos bytes de origem**. Não é medição de latência, LCP ou do tráfego efetivo após otimização do Next.

**Pendente no próximo candidato:** testes de conteúdo/EXIF/imports, build e E2E da landing nos runners do GitHub. O CI de f91 antecede essa incorporação; a origem histórica dos pixels continua a045. As claims `hostedValidated=false` e `productionValidated=false` permanecem. Merge e produção continuam bloqueados.
