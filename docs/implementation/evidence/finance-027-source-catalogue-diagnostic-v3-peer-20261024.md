# Peer estático — diagnóstico de catálogo Source V3

Parecer favorável no recorte, sem bloqueador objetivo identificado. Não executei Node, SQL, banco, SDK, rede, testes ou Git; não alterei os payloads nem o checkout Root.

Conferi os quatro hashes/tamanhos before/after do manifesto. O teste after tem 22.349 bytes, SHA256 `73d3a2385e820665b42913a88489e28bc755394314ed9deff9ef822f5f97bd34`; o workflow tem 4.668 bytes, SHA256 `346fafc4f60af4c0300c8743a2cdfeca8e67f2b1d867499c174fc18c0176a82d`, idêntico à V2. O manifesto V3 tem SHA256 `bb0ac3e4e64e9bfd44c1a59d1e6357eaa6021c9e7c61d0693c66cfc29c79f8ae`.

O delta V2→V3 está somente no tipo e na única query de metadados `engine` (linhas 132–199). Os prefixos/sufixos externos a esse bloco são byte a byte iguais à V2; `definitions()` permanece igual ao before891. Continuam cinco casos, os mesmos engines, SQL/asserts/lifecycle e fechamento em `finally`.

A consulta usa somente literais fechados: sete assinaturas, oito relações Source, um CHECK de `public.domain_events` e um índice. Acrescenta deparse normal/pretty/expressão, atributos e vínculos de constraint triggers por `tgconstraint=k.oid`; inclui `contype=t`, sem inventar uma contagem esperada nem descartar esses vínculos. A exclusão de `contype=n` conserva a distinção PostgreSQL 17/18 já revista. Não consulta linhas de usuário, não executa SQL do chamador nem altera grants ou esquema. Os resultados são observação de um Source conhecido, nunca expected do destino.

Permanecem o pin SQL proposto 158.010 bytes/`f96d7a62…`, igualdade com os compilers originais, CI/TZ restritos, saída JSON ≤5 MiB, diretório e dois nomes fechados, gravação exclusiva `wx` e seis autoridades `false`. A linha YAML acrescentada é só o glob de artefatos desse diretório, sem alterar condições, retenção ou os demais caminhos. Não inclui segredo, conteúdo pessoal ou dump de ambiente.

Limites: não confirmei sintaxe/resultado da query em engine nem o conteúdo do artefato futuro; TypeScript, SQL e a coorte própria seguinte continuam necessários. Este parecer não transfere os resultados da V1/V2 ou do SHA891.
