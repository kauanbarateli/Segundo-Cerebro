# Ensaio descartável da recuperação

O 23º cenário exercita a candidata de recuperação pinada e o hash da instalação em fixture sintética. Depois de instalar a barreira sintética e inserir no ledger sintético os bytes exatos da instalação, substitui apenas as duas guardas fatais e os dois valores não observados por identificadores de teste. O SQL de recuperação resultante é executado dentro de container PG17 isolado, com o guard de instância em cada conexão. O ensaio exige barreira antes e ausência da função/triggers após o commit, preservando a entrada sintética da instalação.

O cenário não carrega o seed de corridas, que cria uma intent; ele confirma zero intents/origins/fences antes de chamar o SQL de recuperação. A execução anterior 41408591969 falhou nessa fase com o seed presente; esse registro demonstra a incompatibilidade da fixture, mas a confirmação da correção depende de nova execução PG17.

Não modifica a fonte guardada, o workflow, QA ou produção. Esse cenário não executa a instalação exata com as 38 precondições reais, não prova rollback, concorrência, semântica MCP, catálogo hospedado, plano operacional de drenagem ou autorização para operação. Deve ser executado no runner GitHub aprovado; testes Node locais não substituem sua execução.
