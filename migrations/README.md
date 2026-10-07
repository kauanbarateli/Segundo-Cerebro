# Migrations

T-001 não alterou banco. T-013 agora possui uma [migration de identidade e roteiro de validação](../supabase/README.md), versionados e ainda não aplicados. A demonstração continua sem banco ou credenciais.

Toda alteração de schema, índices, políticas RLS, funções ou dados de referência deve ser entregue como migration versionada, acompanhada de instruções e validações. Os arquivos usam a convenção nativa `supabase/migrations/<timestamp>_<descricao>.sql`, gerada pela CLI; este diretório conserva o contrato inicial.

Por instrução do mantenedor em 07/10/2026, a aplicação das migrations será **manual e posterior**. Agentes, CI, scripts de build, instalação e inicialização nunca executam migrations, reset, seed ou push de schema em bancos locais ou remotos. O CI verifica somente sintaxe SQL, sem banco. Essa instrução substitui as referências históricas a aplicação por pipeline nos documentos de planejamento.
