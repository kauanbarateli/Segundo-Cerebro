# Restore #35/#41/#42 — proveniência pública das cinco definições, 24/10/2026

## Resultado e limite

OBSERVADO: os dez hashes completos das cinco diferenças de definição publicadas no recibo V8 correspondem exatamente a candidatos construídos de fontes oficiais públicas Supabase/PostgreSQL. Não foi aberto archive, dump, TOC privado, perfil, conexão ou inspector. A correspondência é de bytes identificados pelo SHA256 já sanitizado, não apenas de comprimentos.

As diferenças são reais: há duas versões públicas distintas do helper e quatro diferenças de privilégios. A2v1 continua correto ao recusar definição diferente. Os grants adicionais do alvo são RISCO e não aceite. Nada aqui torna o alvo qualificado, altera os 15 motivos, adota uma política de multiset ou autoriza operação.

Base factual preservada: recibo V8 de 12463 bytes, SHA256 72fa09fb476d77bd94be09ba1fb32c401e20a95e592402ff0f9f3047dd846606; documento anterior de 6670 bytes, SHA256 22b6c434353b8328810dedeafd95270a8084fbf1f58510cc32fc1d2236ed5fe7. A prova de ordem dos 36 vetores não foi repetida. CI c781efe pertence ao outro agente e não foi consultado.

## 1. FUNCTION: variante oficial identificada

O [commit oficial Supabase 536fbd547063cd7420b788e34c3150e542f3bfb8](https://github.com/supabase/supabase/commit/536fbd547063cd7420b788e34c3150e542f3bfb8), de 08/10/2026, muda o template do Studio para compatibilidade Multigres. Acrescenta a variável tbl e a consulta de relname pelo OID; o comando passa de object_identity/%s para schema+nome/%I.%I. O corpo anterior está no pai 12ab771e863b5f36ba7686028b9039d6e2719ea2. São 953→1055 bytes de corpo, +102; inverter somente essas três edições reproduz o corpo anterior integralmente.

Usando os literais de emissão de [dumpFunc, PostgreSQL REL_18_4](https://github.com/postgres/postgres/blob/f5cc81719e6da4cbdb1f797c48b693e91018153a/src/bin/pg_dump/pg_dump.c#L13492), com a delimitação de [appendStringLiteralDQ](https://github.com/postgres/postgres/blob/f5cc81719e6da4cbdb1f797c48b693e91018153a/src/fe_utils/string_utils.c#L484), esses corpos públicos produzem as definições de 1103 e 1205 bytes, SHA256 idênticos aos dois valores V8. O corpo não foi normalizado ou alterado para buscar um hash. Não houve execução SQL ou compilação C.

A [interface oficial de criação](https://github.com/supabase/supabase/blob/7e866ef83e89e35cdda45a6c98abd069d5fa1b2f/apps/studio/components/ui/AutoEnableRLSNotice.tsx) oferece o template por gesto humano. Logo, isto prova a existência de uma origem oficial possível e identifica o texto; não prova que a função seja bootstrap obrigatório nem como/por quem foi instalada em cada projeto. A versão documental S2 ainda usa object_identity e contém uma diferença de tratamento de erro; portanto “o exemplo atual da documentação” isolado não é pin suficiente.

## 2. ACL e três DEFAULT ACL: privilégios identificados

O [init-script oficial Supabase](https://github.com/supabase/postgres/blob/ff09b101523c6479f37fe1e0d02c5f7e3845104c/migrations/db/init-scripts/00000000000000-initial-schema.sql) registra grants de defaults em public para postgres, anon, authenticated e service_role, além de defaults explicitamente associados a supabase_admin. O papel emissor continua parte da identidade; não equiparei defaults de owners diferentes.

Os candidatos foram emitidos com a forma literal de [buildACLCommands/buildDefaultACLCommands REL_18_4](https://github.com/postgres/postgres/blob/f5cc81719e6da4cbdb1f797c48b693e91018153a/src/bin/pg_dump/dumputils.c#L75), sem reordenar ACL. A ACL do helper na fonte é a revogação de PUBLIC; no alvo são três grants de ALL para anon, authenticated e service_role. Para uma FUNCTION, ALL aqui é EXECUTE. Os três defaults postgres/public na fonte conservam somente o grant ao owner postgres; no alvo acrescentam os três papéis da API. Todos os oito hashes coincidem exatamente com V8.

A [correção documental oficial de 20/10, ae991bb19ea5f22e35ab5d954b05d14e1f5a69dd](https://github.com/supabase/supabase/commit/ae991bb19ea5f22e35ab5d954b05d14e1f5a69dd) distingue privilégios de tabelas, funções e sequências e explicita o alcance global de EXECUTE via PUBLIC. A [regra PostgreSQL](https://www.postgresql.org/docs/18/sql-alterdefaultprivileges.html) é que defaults por schema se somam aos globais, afetam objetos futuros e dependem do papel criador. Portanto não são diferenças cosméticas, nem uma revogação limitada a schema desfaz automaticamente qualquer grant global.

### Pares exatos do recibo

| Item público | Identidade SHA256 V8 | Fonte bytes | Fonte definição SHA256 | Alvo bytes | Alvo definição SHA256 |
| --- | --- | ---: | --- | ---: | --- |
| FUNCTION | af1fec135c4bdfd0ea6ef2319fbe2079ddb8ec3a82e64d62cef5a4f8e908ac59 | 1103 | a77ee3493086322fc0b204ba4133c936decda34340f071058b5daf01d4a550c5 | 1205 | 4d654fe0ea9b0a142d50309747942d6695eed7f7a3ff2b8a1cce5f82cd232186 |
| SEQUENCES | 92e1db4b41ecdfc447a5647b43d5017f9b2017be9fb671fdf8a67f7e35caa596 | 96 | 7511b7d510ef6c41ec7faba8fdfdceeabf1b398b28c9d8a22093a88decd055d5 | 389 | 4b061b3e1e5e782986994011714353d46f8fd4a76a30531d600c483d3c64a033 |
| FUNCTIONS | 79f2501a3065fd2e1f3308eb244cbe7fe666ac205b914d63c0c95d11f2d6b8fc | 96 | 937ba43e9b4827d3a35ff711b33dc59ffaa529f4313762ea0db206e66d1ee785 | 389 | 1bab47d15374afa4aabd3c88f55720ac3bad010cf595eefbe41acd61bf707aa7 |
| TABLES | dd93501c18e7008b125ddf08a01442b2fb6dd59b10b9cab7f13e1c36f0614d0e | 93 | 9dfaf664b2c7923e8eb11809727da8f5488a413782a0d6ffb4e9ad660b236f73 | 377 | a9551cf97c9575945fea6dad38fb6b48877fd01b4cc8721b81ede99f0f5a3be7 |
| helper-ACL | 7414fe815633844762598937295bc43b0f498bdab757b4851758f26d582be473 | 61 | 3b6d1a13ae664bbfe5d19815bc87a1e6e6de9af4ead1d13b58fa3d2690f6e97d | 185 | bb81e7a9e06b613304718e8aa911daf8b64653a8b1f5ae28750a24cfc45b138d |

Os nomes públicos usados na construção vieram dos fontes oficiais e das migrations públicas, não de busca em conteúdo privado. A identidade hash não foi usada como permissão. As ordens de emissão acima são as ordens concretas dos candidatos; não se conclui que qualquer permutação ou grant adicional tenha o mesmo efeito ou seja permitido.

## 3. Relação com as políticas públicas do aplicativo

001 exige postgres e fecha defaults globais/public de tabelas e funções; não depende de REVOKE por schema para retirar EXECUTE global de PUBLIC. 003 revoga acesso API/PUBLIC ao helper existente preservando corpo/OID/owner/search_path e ensure_rls. 016 fecha especificamente defaults postgres/public de sequências e recusa grants globais incompatíveis. Os hashes locais conferidos foram:

- 001: 30586 bytes, 7a5bc2b2b7f1fc953159ab31820ec734a5e0d9554ce92ca952465ddfc0fdddfc.
- 003: 1942 bytes, 64a2838cd0ee18a422e28d889e8d9bc5c045204e913aec050628620083baca07.
- 016: 1842 bytes, add5b17ee8af3162ed893d1ac955c4fe5229707b7807d43a58b8c9124dc8e381.

INFERIDO, com suporte dos hashes exatos: o alvo conserva uma política de grants distinta da fonte, compatível com defaults públicos históricos, enquanto a fonte tem o hardening descrito nessas migrations. O mecanismo causal específico de instalação continua desconhecido. Não atribuo a um rollout, versão de imagem ou ação de plataforma sem evidência de implantação.

Não reaplicar 001/016 no alvo como atalho: possuem precondições e DDL do aplicativo; 016 depende de profiles e do helper privado Storage. Este parecer não prepara comandos remotos.

## 4. Próxima decisão finita, sem execução

### Opção A — preparação de hardening estrito do alvo reservado

RECOMENDADO como primeira proposta separada: produzir um roteiro fechado exclusivamente para o alvo reservado jvwduowyavpaxssogadn, ainda sem executá-lo. O escopo inicial de menor risco é alinhar os quatro estados de privilégio à política restritiva já pública. A origem oficial dos grants explica a divergência e não justifica preservá-los.

O roteiro futuro deve conter binding inequívoco do projeto; versão/fonte revisada; catálogo prévio completo e hashes esperados antes de qualquer DDL; owner/assinatura/SECURITY DEFINER/search_path/OID do helper; ensure_rls habilitado e vinculado ao mesmo OID/tags; defaults postgres/public e globais explicitamente enumerados. Precisa recusar qualquer grantee, grantor, grant option, owner, objeto ou dependência não esperado, e preservar as entradas globais já iguais. Não assumir que o alvo está vazio.

As alterações futuras de ACL/default devem ser atômicas, limitadas às identidades e aos papéis revisados, com prova posterior integral e rollback em divergência. O procedimento não cria tabelas/usuários/dados do aplicativo, não redefine owners, não usa DROP/CASCADE, não amplia grants e não aplica a cadeia do aplicativo. Impacto sobre o event trigger e quaisquer consumidores existentes exige gate de comportamento em banco descartável antes de autorização operacional.

Isso resolve somente quatro diferenças de definição. A FUNCTION continua divergente se o template novo for preservado. Substituir o novo corpo pelo antigo não é simples hardening: retira a mudança oficial de compatibilidade Multigres. Tal escolha exige revisão explícita de plataforma/comportamento; não é recomendada automaticamente para produzir igualdade. Alinhar a fonte ao novo corpo também seria uma mudança versionada independente, jamais repin de um hash observado.

Mesmo eventual alinhamento integral dessas cinco definições não resolve por si os vetores managed nem o contrato de alvo/preflight/cobertura do plano atual. O resultado futuro deve continuar recusado enquanto outro critério estrito falhar.

### Opção B — proposta de contrato V2 com variantes oficiais exatas

Uma proposta alternativa pode reconhecer somente o par exato de corpos oficiais acima para essa identidade de infraestrutura, com pins de commit/blob/bytes/SHA, metadados fechados e direção explicitamente escolhida. Isso é uma evolução de política, não equivalência byte a byte nem nova interpretação de A2v1.

A política de segurança deve ser separada: não aceitar automaticamente as ACLs/grants amplos do alvo por serem oficiais. A opção mais conservadora mantém os quatro estados restritivos como requisito. Qualquer exceção de privilégios exigiria finalidade, superfície exposta, papéis e efeitos futuros documentados e aprovados, em uma decisão nova; não existe tal autorização hoje.

V2 teria de definir cobertura integral dos oito counterparts públicos, metadados que permanecem exatos, origem da seleção e qual camada pode emitir uma autoridade nova. Um matcher diagnóstico de variantes não pode cunhar TargetBaseline. Nada de exceção genérica por nome, tamanho, comentários, owner “conhecido”, tipo de objeto ou origem Supabase. Ordem/multiplicidade dos vetores e a proposta sobre sua semântica continuam uma decisão separada; não há exceção de ordem nesta proposta.

A2v1 e todos os originais continuam intactos. O reader/issuer atual deve recusar qualquer novo shape/version e os dez hashes continuariam divergentes no comparador original. Uma futura aprovação V2 precisaria de seus próprios testes, source closure, CI e protocolo operacional, antes de inspeção ou alteração conectada.

### Negativos/gates mínimos para a próxima autoria

1. Um byte/CRLF/espaço ou atributo diferente dos candidatos públicos não pertence à variante pinada; body/header/owner/config/assinatura/trigger devem ser verificados separadamente.
2. PUBLIC, papel API, grantee extra, grant option, grantor diferente, default global ou owner diferente continuam recusados; nenhum subset implícito.
3. Estado/precondição divergente antes do roteiro impede qualquer efeito; falha de verificação posterior exige rollback integral e OIDs/owners/corpos não envolvidos intactos.
4. Variante conhecida com metadados errados, imagem de plataforma não qualificada ou cobertura incompleta não promove baseline. Relatório estrutural/clonado/booleano não cria autoridade.
5. A2v1 conserva os motivos de V8; duplicata, ordem, contexto externo, definição e histórico permanecem cobertos pelas regressões existentes. Não duplicar toda a suíte.
6. Comportamento do helper e privilégios efetivos seriam testados em ambiente descartável de versão fixada; não são inferidos do tamanho do texto, do nome “Multigres-compatible” ou de um teste em WASM.

## 5. O que falta saber, precisamente

Não faltam bytes privados para identificar esses cinco textos: a construção pública já reproduz os dez hashes sanitizados. Permanecem perguntas de decisão/evidência pública, sem pedido de segredo:

- Qual revisão de infraestrutura deve ser normativa para o alvo reservado: o helper anterior, o novo template oficial, ou uma revisão própria versionada que preserve os invariantes de segurança? A revisão de implantação/imagem e a compatibilidade do comportamento escolhido ainda precisam de evidência.
- O alvo deve adotar exatamente a política restritiva de ACL/defaults da fonte antes de nova comparação? A recomendação deste parecer é preparar esse hardening fechado, sem executá-lo.
- Como o contrato futuro representará os counterparts públicos já selecionados, sem excluir silenciosamente helper/defaults nem contornar o preflight de alvo? Essa é evolução explícita de plano/autoridade e continua fora desta pesquisa.

Estas perguntas não bloqueiam as outras frentes do MVP. Não solicito nova janela humana, novo backup, nova inspeção ou acesso ao archive.

## Fontes e recibo de cálculo

O JSON público acompanhante, restore-public-infrastructure-provenance-20261024.json, registra os metadados dos oito arquivos completos lidos em base64 (conteúdo não persistido), tamanho/SHA256 calculados localmente e Git blob SHA1 refeito a partir de bytes com cabeçalho Git, conferido contra a API. A API de conteúdo pública do GitHub foi usada somente para repositórios oficiais Supabase/PostgreSQL depois de a ferramenta web não servir os endpoints JSON. Nenhuma consulta de Actions, conta, segredo ou banco foi feita.

| Ref | Arquivo oficial | Revisão | Bytes | SHA256 dos bytes completos | Git blob SHA1 conferido |
| --- | --- | --- | ---: | --- | --- |
| S1 | migrations/db/init-scripts/00000000000000-initial-schema.sql | ff09b101523c6479f37fe1e0d02c5f7e3845104c | 2761 | 84588fff60ff3cadcd361c820fe502052f4c5fd5aa273740e0690c5ee59ec813 | b32db6b939afc914db36b83bcac245df27f90902 |
| S2 | apps/docs/content/guides/database/postgres/event-triggers.mdx | 6368f00ca0ee80574774b3345033b82ffac13a78 | 6034 | 0c02367923e9f1ecde1ed881f63ac6d37884f1ce8b1f117eab22f65c8ab8ad6c | 914fb27bbf36813461338174ca94808ebdd65323 |
| S3 | apps/studio/components/interfaces/Database/Triggers/EventTriggersList/EventTriggers.constants.ts | 12ab771e863b5f36ba7686028b9039d6e2719ea2 | 2746 | 2a13c5b6a904bd1525bdc4cdd59a11dde7e243196ec6a366bb3e78725fc49fe5 | 869388398cc351babd25744fb239279707cda6d4 |
| S4 | apps/studio/components/interfaces/Database/Triggers/EventTriggersList/EventTriggers.constants.ts | 536fbd547063cd7420b788e34c3150e542f3bfb8 | 2849 | f729eb0b76fb6638501ccd7d152d3aad80eee9e60921f6f1b59648691e09361c | e42e7d981bf4ea45ffc11a2e96d82065a9cb13fa |
| S5 | apps/studio/components/ui/AutoEnableRLSNotice.tsx | 7e866ef83e89e35cdda45a6c98abd069d5fa1b2f | 6020 | b6a899c8e0b874ac991967db1f1deb64886fe8db6f4b8a80fe64adf05d3829e1 | 0e5ede8a99fa40e50f7370287b9e7d5fba3adbe6 |
| S6 | apps/docs/content/guides/api/securing-your-api.mdx | ae991bb19ea5f22e35ab5d954b05d14e1f5a69dd | 20467 | c93823eac1dce032285d18149667f1fc3225abbaa56637bf14512dca1b48fcb4 | 6fd97443abcd13f1189fa4bad1f6fedaec3fd661 |
| S7 | doc/src/sgml/ref/grant.sgml | REL_18_4 | 23389 | 20bdea0dd856f5afbea789db5a66d98d657e9fb89a4cd0eac359975b2b26f109 | 999f657d5c008970e290793c54ad74fb7b9342bb |
| S8 | doc/src/sgml/ref/alter_default_privileges.sgml | REL_18_4 | 10086 | 4cf14a7934753d826704b7c8eb8c59cdc9257e8566be02e37717c5668a9a4447 | 6acd0f1df914c6926e6d6f5bd28b0599d66d629c |

- S1: [fonte oficial pinada](https://github.com/supabase/postgres/blob/ff09b101523c6479f37fe1e0d02c5f7e3845104c/migrations/db/init-scripts/00000000000000-initial-schema.sql).
- S2: [fonte oficial pinada](https://github.com/supabase/supabase/blob/6368f00ca0ee80574774b3345033b82ffac13a78/apps/docs/content/guides/database/postgres/event-triggers.mdx).
- S3: [fonte oficial pinada](https://github.com/supabase/supabase/blob/12ab771e863b5f36ba7686028b9039d6e2719ea2/apps/studio/components/interfaces/Database/Triggers/EventTriggersList/EventTriggers.constants.ts).
- S4: [fonte oficial pinada](https://github.com/supabase/supabase/blob/536fbd547063cd7420b788e34c3150e542f3bfb8/apps/studio/components/interfaces/Database/Triggers/EventTriggersList/EventTriggers.constants.ts).
- S5: [fonte oficial pinada](https://github.com/supabase/supabase/blob/7e866ef83e89e35cdda45a6c98abd069d5fa1b2f/apps/studio/components/ui/AutoEnableRLSNotice.tsx).
- S6: [fonte oficial pinada](https://github.com/supabase/supabase/blob/ae991bb19ea5f22e35ab5d954b05d14e1f5a69dd/apps/docs/content/guides/api/securing-your-api.mdx).
- S7: [fonte oficial pinada](https://github.com/postgres/postgres/blob/REL_18_4/doc/src/sgml/ref/grant.sgml).
- S8: [fonte oficial pinada](https://github.com/postgres/postgres/blob/REL_18_4/doc/src/sgml/ref/alter_default_privileges.sgml).

Os três arquivos C de emissão foram lidos integralmente pela API UTF-8; seus Git blobs informados são pg_dump.c 8f6332d731f643b91b47f101e706c4fcddbb1bb8, dumputils.c dde165909babaedee83c04679957d147ee01c3e6 e string_utils.c 130d1020d504dffde9cff9e9da4c76f2f3b8d281, na tag REL_18_4 → commit f5cc81719e6da4cbdb1f797c48b693e91018153a. Não atribuí SHA256 raw novo a esses três arquivos grandes sem um rehash independente. Os pontos de emissão consultados foram dumpFunc 13492–13641, buildACLCommands 75–338/buildDefaultACLCommands 366–402 e appendStringLiteralDQ 484–515.

Houve apenas leitura pública, hashes e concatenação literal em PowerShell. Uma primeira chamada longa excedeu o limite de linha de comando do Windows (CreateProcessW 206), antes de iniciar o shell; foi substituída por cálculos pequenos por arquivo, sem mudança de dados ou autoridade. Não houve Node, testes, SQL executado, PG, SDK, serviço, inspeção, operação nativa, alteração de produto ou conexão. Os arquivos antigos, migrations, A2, observer, readers e operadores permanecem intocados.
