# Revisão visual de Metas e onboarding — 891bf4a

OBSERVADO em24/10/2026 por Root, com Impeccable local4.4 e referências dos documentos15/17. Fonte `891bf4a95badc6e93bff1c69b22254d2f08fa7dc`, árvore `eab147afc08af98d94ae2ba186bb67e062819a56`. A [PR120](https://github.com/kauanbarateli/Segundo-Cerebro/pull/120) continua draft; merge e produção bloqueados.

## Procedência

O geral de push [40097505618](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40097505618), job120882725726, attempt1, terminou SUCCESS, incluindo525/525 E2E. O artifact12561987722, `browser-evidence`, tem46.454.983 bytes e SHA256 `7d03aed3fb727a4262850a7570e2b67940e0e727e118db772542d64d80ba7891`. Houve uma única transferência do ZIP e extração limitada a12 nomes exatos sob `test-results/`; nenhum PNG de outra árvore foi reaproveitado.

Root abriu os12 PNGs e os comparou com `doc17/capturas/financeiro-meta.png` e `doc15/capturas/onboarding/summary-320-light.png` / `resumo-mobile-390-escuro.png`. Os caminhos completos e hashes estão no [recibo](evidence/891bf4a-visual-review-20261024.json). `doc15` e `doc17` são os pacotes versionados em `docs/planejamento/`.

## Resultado por estado

| Grupo | OBSERVADO |
| --- | --- |
| Metas320/390, claro/escuro | Diálogo dentro da largura, campos em coluna a320, grade a390, título/fechamento e confirmação alcançáveis. A região de recuperação longa usa rolagem; seu corte na captura inicial não significa perda de conteúdo. |
| Metas768, claro/escuro | Diálogo limitado a aproximadamente610px, superfícies sólidas e ritmo coerente com a referência. As três ações de recuperação cabem em linha sem sobreposição. |
| Onboarding320/390, claro/escuro | Canvas sem cartão/sidebar, margem16px, título e marca com quebra natural. Rodada vazia concluída não inventa registros; CTA leva ao painel. As diferenças de conteúdo em relação à demo preenchida são intencionais. |
| G0 sem nova foto320escuro | A escolha sem foto e a confirmação financeira são explícitas. Esta é uma fixture isolada de editor/coordenador, sem arquivo/prévia; não é foto salva ou tela hospedada. |
| Revisão com foto390escuro | Rodapé financeiro fica visível após rolagem, mas há um defeitoP2 de mensagem/ações descrito abaixo. A imagem1×1 cinza é material técnico de teste; não avalia qualidade fotográfica. |

## DefeitoP2 confirmado: revisão da foto

A captura [review390dark](evidence/891bf4a-visual/goals-image-host-review-390-dark.png) apresenta “Esta foto não foi enviada nem salva. A revisão da meta aguarda um envio confirmado.” junto de “Foto preparada para revisão”. No percurso executado já ocorreu finalize nominal antes da preparação da confirmação financeira. A afirmação temporal fixa do picker não descreve mais esse estado.

A tela também mantém uma pilha de ações desabilitadas de envio/retomada enquanto apresenta “Criar meta”. Isso aumenta a densidade da revisão sem oferecer uma ação útil naquela fase. A inspeção de código confirmou a copy fixa no picker e o grupo do editor; não foi encontrada perda de arquivo ou falha na prova nominal por esta inspeção.

Correção delimitada: texto neutro que distingue prévia e aplicação à meta; apresentação guiada pela revisão atual do canal, com apenas as ações pertinentes. **Preservar a mesma instância do picker, File/URL em RAM, sessão, locks, capacidades e journals.** Ocultar visualmente não autoriza desmontar, limpar, refazer upload ou usar o status persistente como autorização. Voltar deve devolver os controles e a escolha sem duplicar finalize/UUID/efeito financeiro.

## Cobertura e limites

Os seis casos de host executaram os30 pares textuais selecionados (cinco por largura/tema), com limiar4,5:1; também passaram os guards DOM de largura, campos e alvos. O resultado pertence aos testes executados nesse SHA. Root não recalculou razões a partir dos PNGs nem declarou conformidadeAA integral. Uma tentativa limitada de localizar seis JSONs de contraste nos arquivos separados do report não encontrou a matriz esperada; não houve segunda transferência nem substituição por dados antigos.

Foco após Escape e conclusão/replay pertencem às asserções de navegador, não à imagem parada. Não foram comprovados por estes PNGs: toque ou teclado virtual em aparelhos físicos, leitor de tela, zoom real, todos os contrastes de foco/borda/disabled, Storage conectado, imagem salva após recarga, nem a interface posterior à correção. A #44 conserva o aceite humano. Não há aceite visual global ou liberação de release por este documento.
