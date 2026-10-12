# Comparação do export hospedado — 12/10/2026

O mantenedor forneceu um novo download do painel pessoal após a migration 019. O arquivo original tem 57.827 bytes, SHA-256 `287b963cfacedf252abe1f8c8e215e4eeb257eb84a5cbdf7357380637d4d1b17` e mtime de 12/10 às 11:12:01 UTC. A origem foi declarada pelo operador; nem mtime, ref informado ou igualdade de tipos autenticam a procedência ou a atualidade. O arquivo contém `public` e `graphql_public`; permanece privado e intacto.

O comparador padrão recusou `SCOPE_NOT_PUBLIC`. A nova opção explícita `--allow-graphql-public` valida o AST inteiro, incluindo os cinco grupos do schema adicional e `Constants`, antes de comparar apenas `public`. O relatório declara a projeção e o schema excluído. Outros schemas continuam recusados. Imports, expressões executáveis, limites, aliases, `Json`, `Constants.public`, argumentos, ordem dos overloads e `ComputedFields` conservam as verificações originais. A opção não modifica o snapshot nem gera um overlay.

A execução pela raiz retornou **`SNAPSHOT_DIFFER`, exit 1**: ambos contêm 35 tabelas, uma view e 55 RPCs, mas 41 objetos diferem. A inspeção AST independente confirmou 151 ocorrências de campos:

| Diferença do baseline local para o download | Ocorrências | Alcance |
| --- | --- | --- |
| `ComputedFields: never` ausente | 36 | 35 tabelas e uma view |
| `NonNullable<Json>` para `Json` | 60 | 20 colunas em 19 tabelas, em Row/Insert/Update |
| `never` para tipos mais amplos em Insert/Update | 50 | 25 colunas em dez tabelas |
| `Args: Record<PropertyKey, never>` para `Args: never` | 5 | `file_cleanup_candidates`, `google_calendar_jobs`, `my_access_state`, `my_sessions`, `prune_operational_data` |

Os 55 retornos RPC, relacionamentos, nomes, flags de propriedades, aliases, `Json` e `Constants.public` permaneceram iguais. Os argumentos sem parâmetros têm branches próprios no SDK instalado; isso não torna os arquivos equivalentes. Nullabilidade e tipos de escrita continuam diferenças materiais para o comparador. Não foram descartados para obter MATCH, e o baseline oficial local pós-019 foi preservado.

Os 29 controles do comparador passaram pela raiz e por revisão independente. A [evidência pública](evidence/hosted-types-public-comparison-20261012.json) contém apenas hashes, contagens, nomes estruturais e limites. A comparação não prova que houve drift no SQL, nem exige uma migration nova. O catálogo hospedado pós-019 tem [prova própria de 1.269 verificações/zero desvios](evidence/hosted-catalogue-post019-20261011.json).

A pendência da #35 passou de obter o arquivo para reconciliar os formatos com uma geração oficial hospedada compatível com a CLI usada no baseline. A versão do gerador do download não foi confirmada; não atribuir automaticamente as diferenças a uma versão específica. A obtenção pela CLI/MCP deve usar autenticação pessoal autorizada, schema `public`, sem extrair tokens de outra conexão. O [runbook](../operations/database-types.md) mantém as salvaguardas. Não substituir o baseline por um arquivo com tipos mais amplos para ocultar a divergência. Esse aceite não acrescenta gate hospedado à #37.
