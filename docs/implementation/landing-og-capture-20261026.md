# Imagem de compartilhamento da landing atual

Referências: [doc18](../planejamento/18-convergencia-prototipo-20261025/README.md), [PR #120](https://github.com/kauanbarateli/Segundo-Cerebro/pull/120) e #80. Este contrato não executa uma captura, não libera publicação e não substitui a qualificação dos arquivos pela Root. Merge e produção permanecem bloqueados.

## Escopo fechado

Reutilizar o modo `--og` de `scripts/landing/capturar-telas.mjs` e o supervisor isolado já existente. Nenhum SDK, serviço ou workflow alternativo é necessário. Não executar `--all`: ele percorre superfícies fora deste lote.

O lote OG tem **somente três membros**:

1. `src/app/conheca/opengraph-image.png`;
2. `src/app/conheca/opengraph-image.png.json`;
3. `src/app/conheca/opengraph-image.alt.txt`.

Não acrescentar outro recibo ao lote. O relatório independente do supervisor registra os hashes dos três membros e os oito hashes literais de entrada, sem incluir arquivos privados ou segredos.

## Ordem necessária

1. Capturar e qualificar o lote fechado de Início/Capturar: duas superfícies, desktop/mobile, claro/escuro. Conferir os oito rasters, seus sidecars e o recibo daquele lote. Projetos e Gallery conservam suas qualificações próprias.
2. Incorporar os arquivos aprovados, revisar e criar o commit que os contém.
3. Construir **esse commit**, em modo demo e sem variáveis privadas, com o processo isolado e supervisionado já previsto para o CI. Um build anterior à incorporação pode continuar usando os imports antigos, mesmo que os rasters tenham sido sobrescritos depois.
4. Somente então capturar o OG da `/conheca` construída. A prontidão exige a estrutura de três capítulos, suas três âncoras, fontes carregadas e a imagem visível da abertura completamente carregada.
5. Fechar os processos próprios, confirmar liberação da porta e reconferir Source, gerador, política, bytes do contrato OG e arquivos de entrada. Qualificar os três membros por bytes, sidecar, EXIF, dimensões e relatório da execução.
6. Incorporar o OG qualificado em outro commit e executar os gates aplicáveis. Uma captura demo não constitui aceite hospedado, conectado ou de aparelho físico.

O **Source do OG é o commit usado no build**, já contendo os novos rasters. Os Sources de captura dos rasters podem ser anteriores: não reescrever seus sidecars para fazê-los parecer provenientes do commit final.

## Contrato puro

`scripts/landing/capture-og-contract.mjs` não lê arquivos, não consulta ambiente, não abre portas e não inicia navegador ou subprocessos. Seus exports são:

| Export | Uso |
| --- | --- |
| `ogMembers()` | Lista exata dos três paths permitidos. |
| `ogInputFiles()` | Lista ordenada dos oito rasters de Início/Capturar. |
| `assertOgInputHashes(records)` | Valida a lista literal `{ file, sha256 }`, sem aceitar campos de aprovação. Não prova qualificação ou origem por si só. |
| `ogReadyInPage()` | Função sem dependência do escopo Node, serializável para `page.waitForFunction`. |
| `ogExifDescription(sha)` | Descrição ASCII exata com o SHA do Source usado para capturar o OG. |
| `ogOriginPrompt`, `ogAltText` | Textos existentes de proveniência e alternativa, sem novo conteúdo comercial. |
| `assertOgPng(bitmap, sourceSha)` | PNG limitado a 8 MB, chunks/CRC/EXIF verificados, dados descomprimidos com teto e filtros válidos, dimensões 1200 × 630. |
| `assertOgOutputs({ bitmap, sidecar, alt, source })` | Reconcilia PNG, digest, Source de quatro campos, sidecar, alternativa e geometria fechada. |

O supervisor fornece bytes de arquivos regulares canônicos, dentro da allowlist, e deriva os hashes de entrada de forma independente. A lista de hashes deve coincidir com os rasters efetivamente incorporados no Git e com a qualificação anterior. A função pura não aceita `qualified:true` como prova e não lê o banco.

O Source contém exatamente `sha`, `tree`, `generatorSha256` e `policySha256`. A Root também deve fixar o hash e reconferir independentemente os bytes do novo módulo OG, assim como faz com os módulos de diagnóstico, sem ampliar silenciosamente o formato histórico do Source de outros lotes.

### Geometria explícita

O navegador captura um viewport de 1200 × 630 em DPR 2. O gerador reduz essa imagem para o **PNG final de 1200 × 630**, conforme o comportamento existente do `--og`. O sidecar registra `density:2`, viewport/clip de 1200 × 630 e pixels finais de 1200 × 630. Essa redução é uma exceção explícita à regra dos WebP `clip × density`; não alegar que o arquivo social final possui 2400 × 1260 pixels.

O EXIF deve estar no chunk PNG `eXIf`, no campo TIFF ImageDescription, com o texto exato de `ogExifDescription(source.sha)`. Não aceitar uma ocorrência textual solta em qualquer parte do arquivo como prova de EXIF.

## Integração e validação

Content mantém ownership de `capturar-telas.mjs` e `capture-policy.mjs`. A Root mantém supervisor, wrappers e workflow. O hook OG importa apenas o módulo puro, espera `ogReadyInPage`, usa os textos/EXIF definidos e preserva todos os controles existentes de requisições, erros, processos próprios e limpeza. A criação deste contrato não autoriza executar o modo OG antes da incorporação e do build dos novos assets.

Checks locais leves, sem servidor ou navegador:

```powershell
node --test tests/scripts/landing-capture-og.test.mjs
npx eslint --max-warnings=0 scripts/landing/capture-og-contract.mjs tests/scripts/landing-capture-og.test.mjs
```

Os negativos cobrem Source divergente, sidecar antigo/extra, hash incorreto, dimensão/DPR falsos, alternativa alterada, CRC/TIFF/EXIF inválidos, dados comprimidos inválidos ou excessivos, término do PNG, navegação antiga de seis capítulos e Hero oculto, quebrado ou ainda não carregado. Esses testes exercitam bytes sintéticos públicos, não capturam tela e não qualificam os assets finais.

Validação local deste delta: **36/36 contratos puros passaram** com heap limitado a 64 MB. A primeira tentativa de ESLint, sob o mesmo teto, atingiu o limite de heap antes de emitir diagnóstico. Root posteriormente executou lint focado com teto de 256 MB: aprovado, sem warnings. Nenhum navegador, servidor ou captura foi iniciado nessa conferência.

**Checkpoint de incorporação:** Entrada17 de76d2659 foi qualificada por Root e seus oito rasters revisados por Root/Jornada e copiados, com recibo e prova pública. Projetos9 do mesmo run também foi conferido e incorporado; Gallery preservada. O supervisor OG v3 foi revisado e integrado ao candidato: três saídas, oito entradas vinculadas à qualificação anterior, Git/blob/ancestralidade, rechecagem dos inputs e cleanup. O checkout existente passa a trazer histórico completo; o checkerLDD permanece e nenhuma instalação APT foi reintroduzida. Os73contratos focados de OG/Entrada/Gallery passaram localmente, sem navegador/build. A nova execução usa somente o push exato da branch Root com ambas as provas presentes, depois dos E2Es e antes de Projetos alterar seus arquivos.

### Primeira execução e preparação da próxima candidata

O [push40375578011/a1](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40375578011), Source `eb008335aa244556352e53173dbae668b387c9f4`, alcançou a OG depois dos E2Es/Gallery/Entrada. A execução falhou em3s com outputs0: `CAPTURE_CLI_EXIT`, primeiro diagnóstico `CAPTURE_REQUEST_FAILED/CAPTURE_PHASE_READINESS/CAPTURE_RESOURCE_FETCH`, GET permitido abortado, RSC/routerPrefetchYES em Capturar. Os dois processos próprios fecharam e a porta foi liberada; inputs8/qualificação ancestral76 foram conferidos. Isso não produz asset OG admissível.

O código OG não optava pela política de pré-busca da câmera. O novo delta reutiliza **a mesma função** `initializeProjectPrefetchPolicy`, pelo alias OG, somente na origem loopback e antes da primeira página. A ausência de IntersectionObserver é reconferida após o Home real, após abrir `/conheca` e antes dos pixels. Nenhum componente da primeira dobra usa essa API diretamente; a [fonte oficial Next15.5.28](https://raw.githubusercontent.com/vercel/next.js/v15.5.28/packages/next/src/client/components/links.ts) condiciona a observação de pré-busca à sua presença. O SDK local15.5.27 não foi aceito como canônico para15.5.28. A política é uma condição da câmera, não aceite de observer/animação normal ou substituição dos dados da aplicação.

Demo DOM/SSR, dois documentos reais, os400ms preexistentes, prontidão antes/depois, GETs fatais, outputs3, prazos e cleanup permanecem. Não há exceção para requisição abortada, nova espera genérica, retry ou captura local. Os138contratos relacionados em oito arquivos passaram na Root, incluindo negativos da política/registro/primeiro erro; a captura real corrigida exige Source/run próprios.

**Pendente:** build da nova candidata; captura OG no CI; qualificação independente dos três membros; revisão visual final e cópia exata. A OG histórica continua ativa até essa cópia final. O PASS da Entrada e os contratos puros não certificam a OG.
