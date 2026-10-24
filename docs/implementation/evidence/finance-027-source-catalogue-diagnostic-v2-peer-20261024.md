# Peer estático V2 — defaults do catálogo Source 027

Favorável, sem bloqueador objetivo no delta V1→V2. Nenhum Node, SQL, SDK, engine, teste, browser ou rede executado. O parecer V1/f1902c1b… permanece independente.

Os quatro hashes before/after conferem. Test after: 20.073 bytes/SHA256 8df208fad32bc57cec92270b8603a7f55e96bcb6a7f3677377c3fac3e79c5375. Workflow after mantém 4.668 bytes/346fafc4f60af4c0300c8743a2cdfeca8e67f2b1d867499c174fc18c0176a82d, byteigual V1. O corpo completo de definitions(), até bindings(), também permanece byteigual.

A query de versão anterior foi ampliada; não se abriu outra engine nem se inseriu fixture. WITH wanted contém sete assinaturas literais em app_private. LEFT JOIN preserva as sete linhas inclusive na ausência de uma função; pg_catalog.to_regprocedure resolve a assinatura exata, e found explícito permite recusar qualquer ausência. pg_proc, pg_get_expr(defaults,0), search_path e current_schemas são metadados de catálogo/configuração, sem tabela de usuário ou SQL do caller. Os nomes de argumentos são definições públicas do Source, não valores de uma operação.

Os gates sete linhas/todas found/soma oito defaults falham fechados se o Source divergir. Eles são integridade do Source já pinado f96d/26+13, não oracle de deparse, licença para alterar defaults ou expectedBaseline. A soma não é apresentada como comparação individual de defaults; as sete expressões e contagens observadas permanecem no JSON para confronto posterior.

O tipo do resultado identifica todos os campos novos, os acessos engine[0] usam o gate original de uma linha e as reduções têm valor inicial numérico. Não há novo cast de unknown para aceitar dados. A chamada segue dentro do try/finally fresh antes de Auth. Pin, compilação, gates de ambiente/TZ, tamanho máximo 5 MiB, filenames fixos, flag wx, cinco testes, SQL de produto e lifecycle permanecem.

A emissão continua observacional, com todos os campos de autoridade false, sem dados de negócio/credenciais/ambiente completo. O glob YAML não mudou. O novo conteúdo depende da execução própria do próximo CI; este peer não confirma compatibilidade de engine nem promove o DRAFT a catálogo esperado, homologação ou implantação.
