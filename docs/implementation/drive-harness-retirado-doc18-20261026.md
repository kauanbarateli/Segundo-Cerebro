# Drive: controles históricos preservados, execução inelegível

D-032 mantém a entrega Drive fora do MVP. O doc18/#125 retirou a oferta na navegação e fez `/drive` conservar a autorização existente e mostrar uma página contextual, preservando dados, APIs e Storage compartilhado. Isso não autoriza reapresentar o workspace antigo para fazer um teste histórico passar.

O harness manual `scripts/verification/drive-browser-local-ci.mjs` pressupõe o antigo workspace e suas ações de pastas, upload e download. Ele **não pode mais executar essa jornada no produto atual**: a CLI `--execute` retorna falha `DRIVE_NOT_PROVEN`; a entrada exportada `runDriveLocalCi` também recusa antes de ler ambiente, portas, arquivos privados, diretórios temporários, Docker, Auth, Storage ou banco. Não há variável, argumento ou flag para contornar essa recusa. O corpo histórico permanece para rastreabilidade; importação, ajuda e contratos puros continuam disponíveis. Nenhum workflow foi removido ou convertido em sucesso por skip.

## Inventário derivado, sem recuperar dependências artificiais

Derivação independente por objetos Git e AST de imports/exports/dynamic imports literais, sem executar a aplicação ou o harness:

| Referência | Seeds | Paths próprios | Base Admin | Closure Drive | União Git |
|---|---:|---:|---:|---:|---:|
| `cccc288ab3144aaa124d55447704dc55ae7b7045` — anterior à retirada | 62 | 11 | 101 | 256 | 306 |
| `0e053eb8253287e4d0cf9746f0023f0a06d275ad` — rota contextual | 62 | 11 | 101 | 241 | 291 |

Saíram somente 15 paths: cinco arquivos do workspace Drive; RelatedPanel TSX/CSS; WorkspacePage; Card TSX/CSS; DataDisplay TSX/CSS; DataTable TSX/CSS; TableModel. Nenhum entrou. Os arquivos permanecem no repositório; deixaram de ser alcançados pelos seeds deste coletor. Os contratos testam sua ausência da closure e a permanência dos arquivos, além dos positivos Files/Storage/availability, relay e isolamento. Não se adicionou o antigo componente como seed artificial.

SHA-256 da lista ordenada de paths, separados por LF e com LF final: antes `71469f3697ec73c9786b56eddd78d3a52a130446de9f7b75e675a1dae9ed01ae`; agora `9ba9e3fb0a291c391ad4e52261834577fde53e2f824e8ef8b4fdf64662a35400`. As dependências instaladas continuam 50: 45 do coletor Admin e cinco pacotes adicionais. O teste binário continua comparando bytes brutos e recusando blob divergente.

## CURRENT27 não se confunde com execução histórica

O coletor mantém o vínculo da cadeia CURRENT27 inteira, incluindo nomes/cópias SQL e seus manifests. O corpo histórico seleciona explicitamente 001–026 e usa o catálogo fixado de 82.143 bytes, SHA-256 `4557741f008d48ea60ad8a3e2d5a41667630543c3bf2ab0682ec2b33ad97e297`, com 1.720 verificações. Nada nesta correção altera schema, catálogo, grants, migrations, testes de Storage ativos ou o plano econômico da 027. Um recibo histórico de execução continua vinculado ao Source original; não é aceite do produto atual nem da CURRENT27.

Validação permitida: `node --test tests/scripts/drive-browser-local-ci.test.mjs tests/scripts/drive-browser-support.test.mjs`. São contratos puros, inclusive a recusa antecipada com ambiente-canário; não executarão o corpo operacional histórico. Build, browser, stack e banco não são parte desse comando. O CI completo e seus demais gates permanecem obrigatórios; este ajuste não libera merge ou produção.

Nesta alteração, passaram seis contratos focados de recusa, closure, inventário, positivos de availability e negativos dos relatórios, além do lint dos três MJS e `git diff --check`. A execução integral local encontrou uma limitação distinta: `node_modules` é uma junction externa ao checkout; os controles existentes de `realpath` e do grafo SDK recusam esse ambiente. Essa proteção foi preservada. O coletor completo e os testes de cleanup dependentes do SDK ainda exigem o resultado próprio do GitHub com `npm ci` no checkout efêmero. Os seis PASS focados não são promovidos a PASS da suite integral ou a aceite nativo.
