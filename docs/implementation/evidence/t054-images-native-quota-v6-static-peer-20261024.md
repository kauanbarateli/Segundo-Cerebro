# I/quota V6 — peer estático (24/10/2026)

Favorável estático no delta restrito, sem novo bloqueador objetivo. Não executei Node, SQL, serviço, rede ou Git e não editei fontes. Este parecer não transforma a hipótese de I3 em causa dinâmica exclusiva nem qualifica os confrontos nativos.

Manifesto EV/finance-goals-images-terminal-native-complete-freeze-v6-20261024/manifest.json: 7.271 bytes, SHA256 007d86f81f4127d38fdcb13c9c0bfc42c44e4f1c356746941673ac6c7c8160ea. Conferi 13 after, 13 before-v5 contra o freeze V5 e dois artefatos. Apenas case/test/doc mudam; dez payloads permanecem idênticos. Prefixo/sufixo do case fora de quotaInstant/quota são byteiguais; inverter as duas correções de fixture e retirar os três controles novos reproduz integralmente o teste V5. O documento mantém o prefixo V5 exato.

## Contrato PostgreSQL

Li canonical004 original no WT da CI, SHA256 0645892ba82c4e13a391020aea4abfaeaa05a81283056adbc9954747b066b859; não usei a nova referência026 de minha autoria como autoridade independente.

consume_rate_limit_at:348–365 filtra os hits ativos sob lock, acrescenta p_now no ramo permitido e grava hits/updated_at=p_now no mesmo UPDATE. Goals04:68 passa p_now=null, portanto o instante da quota vem de clock_timestamp e não precisa igualar o timestamp Core do evento. O material nativo usa to_jsonb(x) da linha inteira. updated_at é campo PostgreSQL real, não um metadado novo do teste.

V5 exigia igualdade de todos os campos exceto hits quando havia linha anterior; isso recusa uma linha legítima de I3 cuja quota já foi consumida pelo CREATE de setup. A correção preserva a igualdade do material restante em vez de remover a linha/quota do oráculo.

## Predicados e controles V6

case:71–77 conserva delta0 integral. Para delta1, exige uma única linha de capture_task_write, exatamente um hit novo e prefixo anterior byteigual/ordenado. Exige updated_at novo exatamente igual à string do último hit novo, validada por quotaInstant. Só depois exclui hits/updated_at da igualdade de todos os demais campos. Identidade, dono, hash, scope, campos extras e quotas de outros scopes não são ignorados.

Na linha anterior presente, exige hits anteriores não vazios/válidos, updated_at anterior igual ao último hit antigo e avanço temporal. São precondições conservadoras das janelas nativas revisadas, com consumo anterior permitido de setup; não uma redefinição geral de toda entrada possível da função PostgreSQL (p_now explícito, janela expirada ou linha com array vazio). O documento registra que tais baselines não são usados pelo gate. A ausência de linha anterior não inventa campo/hit anterior.

quotaInstant valida tipo/formato/data civil e calcula a ordem em microssegundos. O roundtrip do componente civil recusa fevereiro30; BigInt conserva o incremento de1 microssegundo sem truncar na precisão milissegundo de Date.parse. A comparação de identidade permanece equal(updated_at,last), sem normalizar timezone/formato para aceitar strings diferentes.

As fixtures agora contêm os cinco campos reais da linha (user_id,scope,subject_hash,hits,updated_at), incluindo SHA256 do dono. O positivo update usa hits/updated_at um microssegundo depois e continua com evento Core no instante anterior. Os três controles novos cobrem ausência anterior, sucessor preciso, null/inválido/não avanço, formato equivalente porém texto diferente, campo ausente, identidade/extra e adulteração do prefixo. Os asserts antigos não foram removidos. Limite30/min, pesos, SQL, Source pins, CAS, unknown, framing/ACK, fases, driver, sessão, workflow e lifecycle não mudaram.

## Evidência e pendências

Conferi os quatro artefatos QA por hash: o recibo SHA256 580d09e5dc76e6ce4ef84e00c87716900f0f71ad3aeacd0d6022284e565724d3 registra35/35 puros/exit0/stderr0 Node24.19.0 heap128 serial. Essa execução é do autor; não a reexecutei e não comprova PG17 ou SourceCollector.

O proof preserva patchExit=1 e whitespaceCheckExit=1; não os tratei como --check0. Root informou que são diferenças no --no-index e aviso CRLF e fará diff --check normal após transporte. ReverseCheck0 permanece evidência separada. Não inferi aplicabilidade/whitespace novos por leitura.

Hashes after: case 18.940 bytes/b27ab58d8e5abdd2a813180d0dba1fc23982d9d183395cf335fcaeb792cc9e2d; teste 30.537/684e742f554c399383e3c035962126d20f3b4415ffb003edcd42f68007b57899; documento 25.723/5fb0daf3ddd3defcf39645c41ce38ebb3897cc797fdf36e9add02b063cf0eebc. Patch 15.115 bytes/SHA256 eba36177a24e6e3262fd5b1ec846b71ca0b4e6558ca8557719e64545d62736c9.

I3/oracle dos originais871 é observado; a posição interna do assert não está nos logs sanitizados. V6 corrige uma incompatibilidade estática demonstrável sem recategorizar aquela recusa ou prometer que nenhuma outra surgirá. Novo SHA precisa de seus próprios CI/grafo, grupos PG17, terminais e limpeza. Nenhum aceite hospedado/Storage, schema, flag, merge, produção ou restore decorre deste parecer.
