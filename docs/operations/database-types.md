# Comparação offline de tipos — T013 / issue #20

O [comparador](../../scripts/operations/check-database-types.mjs) verifica a diferença entre `src/lib/supabase/database.generated.ts` e **um snapshot TypeScript fornecido explicitamente pelo operador**. Não gera tipos, consulta Supabase, lê `.env`, usa tokens, importa o snapshot, modifica arquivos ou aplica SQL. Usa somente o parser AST do TypeScript já instalado. A [validação local](../../tests/scripts/check-database-types.test.mjs) usa declarações sintéticas e um controle do recorte 001–005; não comprova tipos hospedados atuais.

## Preparar a evidência oficial

Obter um export TypeScript oficial pelo painel, MCP ou CLI autorizados, somente do projeto pessoal `rishenjoikgmfubmnfiu`, schema `public`. Essa obtenção é uma operação separada, sujeita ao canal autorizado; o comparador não a automatiza. Não usar BlackSheep/VOE nem fornecer credenciais como argumentos. Não fabricar um arquivo a partir de DTOs, mocks, REST incompleto ou cópia do baseline e chamá-lo de export atual.

Guardar o arquivo regular `.ts` em diretório privado local, fora de sincronização e do serving da aplicação. Registrar privadamente a origem oficial, ref/schema selecionados, data UTC, versões de geração e SHA-256 do arquivo obtido. Conferir que a coleta ocorreu depois das migrations efetivamente aplicadas, sem presumir aplicação da 016 preparada. O registro de procedência e sua conferência são responsabilidade do operador. O argumento de projeto é apenas uma salvaguarda de destino declarado; **não autentica a origem nem demonstra atualidade**.

## Executar a comparação

Ajuda não lê nenhum arquivo de entrada:

```powershell
node scripts/operations/check-database-types.mjs --help
```

Após obter e conferir o snapshot, usar seu caminho absoluto local, sem URL, UNC, dispositivo, alternate data stream ou symlink/junction. O comando contém somente caminho e identificadores públicos:

```powershell
node scripts/operations/check-database-types.mjs check --snapshot "C:/SegundoCerebro-private/database.types.ts" --project-ref rishenjoikgmfubmnfiu --schema public
```

O caminho do exemplo é **RECOMENDADO**, não um diretório criado por esta entrega. Substituí-lo pelo arquivo privado efetivamente exportado. O baseline é fixo relativo ao módulo; não é selecionado pelo diretório atual. Usar o próprio caminho do baseline como snapshot é recusado. Copiar o baseline para outro caminho pode produzir igualdade; a ferramenta não consegue distinguir essa cópia de uma coleta oficial e não declara procedência verificada.

Os dois arquivos são limitados a 2 MiB e UTF-8 válido, com BOM opcional. A leitura tem teto de bytes mesmo se o arquivo crescer; arquivos modificados durante a leitura são recusados. O parser possui limites de tokens, nós, profundidade e trabalho cumulativo de normalização. Subárvores permanecem estruturadas, sem reescapar repetidamente JSON dentro de JSON. Imports, reexports, referências externas, classes, interfaces, funções, namespaces, chamadas e expressões arbitrárias são recusados. Os aliases de tipo do formato aceito e `Constants` apenas como literal `as const` são analisados sem avaliação. O schema aceito é somente `public`, além da metadata interna do gerador.

## O que o resultado significa

A comparação estrutural ignora comentários, espaços, quebras CRLF/LF, nomes de propriedades entre aspas equivalentes, parênteses, ordem de membros e uniões/interseções. Preserva optional/readonly, nulabilidade, colunas de Row/Insert/Update, Args/Returns de RPCs, enums, views, composites, Json, aliases auxiliares e Constants literais. Json/Database/Constants exigem seus exports públicos; mudar o export de um helper é diferença de contrato. Relações e tuplas preservam posição, colunas, referência e `isOneToOne`. A versão interna PostgREST é metadata e não determina drift do schema público.

Esse normalizador não prova equivalência semântica completa do TypeScript, correção de SQL, RLS/grants ou validade dos contratos hospedados. Novos formatos do gerador podem ser recusados ou produzir diferença estrutural e devem ser revisados; não enfraquecer o parser para aceitar código arbitrário.

| Código | Resultado / exit |
| --- | --- |
| `SNAPSHOT_MATCH` | Estrutura igual ao snapshot fornecido; exit 0. **Não significa schema hospedado atual ou procedência aprovada.** |
| `SNAPSHOT_DIFFER` | Diferença estrutural; exit 1. Revisar antes de atualizar tipos ou adapters. |
| `DESTINATION_NOT_PERSONAL_PUBLIC` / `SNAPSHOT_PATH_INVALID` / `INVALID_ARGUMENTS` | Salvaguarda recusada antes de ler os arquivos; exit 1. |
| `SOURCE_LIMIT_EXCEEDED` / `AST_LIMIT_EXCEEDED` / `UTF8_INVALID` / `SYNTAX_INVALID` / `UNSUPPORTED_INPUT` / `SCOPE_NOT_PUBLIC` | Entrada excedida, inválida ou fora do formato fechado; exit 1. |
| `FILE_INVALID` / `FILE_CHANGED` / `FILE_UNAVAILABLE` / `INPUT_INVALID` | Leitura/entrada inconclusiva; exit 1. |
| `BASELINE_IS_NOT_A_FRESH_SNAPSHOT` | O caminho do baseline foi fornecido como snapshot; exit 1. |

A saída JSON contém somente código, flags fechadas e contagens: registros adicionados/removidos/alterados em cada seção e mudanças de Json/aliases/Constants. Não imprime nomes de tabelas/colunas/RPCs, caminhos fornecidos, diagnóstico do compilador, comentários, tipos brutos ou conteúdo do arquivo. `provenance_verified` e `freshness_verified` permanecem **false**, inclusive com exit 0.

## Continuidade e CI

Depois da comparação, um revisor confronta o export oficial com migrations aplicadas e contratos dos adapters. A atualização do arquivo gerado é uma alteração de código separada, revisada e validada; este CLI nunca faz importação automática. Repetir TypeScript, contratos/camadas, build e scanners após atualizar tipos. Não importar schema gerado no Núcleo, features ou UI.

Esta entrega prepara o mecanismo de comparação, sem criar um job CI ou obter o export oficial. Rodar o comparador contra o mesmo baseline, uma cópia antiga ou fixtures não é prova de drift hospedado no CI. Um portão futuro precisa de procedência e coleta autorizada próprias, sem SQL remoto, migrations, seeds ou credenciais remotas no CI vigente. Os critérios de tipos reais e ausência de divergência da issue #20 continuam abertos até que essas evidências sejam produzidas; a [OP-012](../implementation/decisoes-operacionais.md#op-012--conclusão-local-e-aplicação-manual-das-próximas-migrations) conserva a aplicação manual e a separação operacional.
