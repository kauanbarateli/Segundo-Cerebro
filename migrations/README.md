# Migrations

Não há alteração de banco em T-001. A aplicação inicial não usa banco nem exige credenciais.

Toda alteração futura de schema, índices, políticas RLS, funções ou dados de referência deve ser entregue como migration versionada, acompanhada de instruções e validações. Quando a infraestrutura Supabase for criada em T-013, usar a convenção nativa `supabase/migrations/<timestamp>_<descricao>.sql`; este diretório apenas registra o contrato inicial.

Por instrução do mantenedor em 07/10/2026, a aplicação das migrations será **manual e posterior**. CI, scripts de build, instalação e inicialização nunca devem executar migrations em bancos remotos. Essa instrução substitui as referências históricas a aplicação por pipeline nos documentos de planejamento.
