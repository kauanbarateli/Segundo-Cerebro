# Peer independente — prova pública R, 24/10/2026

Parecer estático favorável no recorte entregue, sem bloqueador objetivo encontrado. O pacote acrescenta somente dois testes públicos e um documento; não autoriza mudança de política ou operação de restore. Não executei Node, Git, testes, rede, SQL, PG, CLI, serviço, inspeção ou restore. Nenhum archive, perfil, ACL real ou definição privada foi aberto. Este parecer não transfere PASS do autor nem de outro SHA.

## Identidade e integridade conferidas

- Manifesto `restore-public-provenance-proof-freeze-v1-20261024/manifest.json`: 3.042 B, SHA256 `f0b181ad7901c05aafae264966b6ac4bba07eec1a94a555bb3edcf14c9ad0aea`; base declarada `799b7426b088f88ae3e0aa04c8d256df21fe371d`.
- Três payloads: 5.013 B/`d9910a3f0b5ee150fb18e1e064f26e2c13a8854eaebbfed5f1ec801cd72bdb4d`; 4.559 B/`12219961e43982284d241e4a1dfc64d4098ca8a61c2574c2581d8fa80fcb55c9`; 6.670 B/`22b6c434353b8328810dedeafd95270a8084fbf1f58510cc32fc1d2236ed5fe7`, na ordem do manifesto.
- Os três artefatos declarados conferem tamanho/hash. Patch 17.392 B/`ca514b579b9b6276e5564b0641732a5a53b414df9f5da640acc39362cc6838e9`: exatamente três seções de arquivo novo, nenhum path operacional. Reconstruí cada conteúdo a partir das linhas adicionadas e obtive os três SHA256 exatos. Calculei os três digest de blob a partir do cabeçalho/blob em memória; não invoquei Git/apply.
- Os oito arquivos protegidos no checkout indicado conferem com os hashes do proof e do baseline-before: custom TOC, plano, A2, observer, stream, fixture e duas regressões. Isso prova igualdade com os bytes declarados no pacote, sem qualificar independentemente HEAD/status via Git nesta rodada.

## Contrato preservado

O teste de ordem usa a fixture pública existente para produzir listagem e bytes CUSTOM artificiais correspondentes ANTES da extração nominal. A fixture remapeia IDs por lado, mas conserva cada ocorrência/índice; os testes não ordenam/deduplicam as dependências. O controle compara fatos antes/depois e exige `dependency_vector_mismatch` quando há permutação ou alteração de multiplicidade. O cross-check liga cada plano ao hash dos bytes efetivamente fornecidos, isolando a relação listagem/binário em vez de aproveitar checksum antigo. O caso managed versus união exige motivos diferentes, sem reutilizar o veredito de um contexto no outro.

A2 permanece byte-intacto, com os quinze motivos originais e comparação por índice das dependências mapeadas. Os testes adicionais não introduzem um comparador alternativo, multiset operacional, exclusão de infraestrutura, normalização de bytes ou nova seleção de Sourceplan.

Os controles de infraestrutura mantêm divergência de definição apesar de dependências iguais, distinguem CRLF/espaço/literal/NULL/vazio e separam owner emissor de DEFAULT ACL da propriedade semântica de FUNCTION. Os comentários de fixture não são DDL nem interpretação de grants. A igualdade benigna continua observacional: exige `inspectionOnly=true`, `baselineQualified=false`, `restoreAccepted=false`; o plano operacional de alvo vazio recusa infraestrutura pública e o getter nominal recusa relatório, clone e booleano adulterado. O observer atual também retorna esses flags fixos e reconfere os handles nominais; nenhum relatório vira TargetBaseline ou autorização.

O documento reconhece que somente quatro dos cinco fontes core coincidem com 057 e que o observer799 tem outro hash. Não copia getter, gaps ou telemetria nem atribui os diagnósticos V8 a esse observer. Não há alteração entregue de operador, archive, parser, ACL, SQL aplicado, EOF/ACK, limites ou autoridade.

## Referências e limites

Li a proposta pública 13.163 B/`6bc7f7d1819a9d32edaaeccd1ed66e96d175d392de14b4c587591988d57b1471`, suas referências oficiais REL_18_4 e a distinção entre produtor, consumidor serial e paralelo. Não reabri web/raw, conforme o escopo desta revisão. Logo não qualifico independentemente bytes C/commit nem uma política normativa nova. O documento corretamente reconhece a falta de raw íntegro verificável e não inventa novos SHA de texto renderizado; o uso operacional futuro continua condicionado a raw/pins e revisão próprios.

Confrontei a descrição das migrations públicas001/003/016 com seus arquivos locais: defaults globais/schema, revogação de EXECUTE conservando helper/event trigger e fechamento de defaults de sequências continuam política, não instrução para reaplicar no alvo. A diferença real do corpo/ACL do helper não fica resolvida por comentários artificiais ou por esta prova. Não reconstruí inventário V8 nem os350 pares/36 permutações a partir de dados privados.

O recibo separado do autor, 3.052 B/SHA256 `a53acc98ca7069a0607564ddf2189146bb2158ceaa624081b682a0d0e3f44729`, e seus quatro artefatos conferem tamanho/hash. O stdout registra99 testes/99 PASS/zero falhas e o process-result registra exit0, em Node24.19.0/heap128; esses são fatos da execução do AUTOR, não desta revisão nem aceite CI/nativo/hospedado. Manifesto imutável dizendo não executado no freeze e recibo posterior estão coerentes.

Continuam pendentes a qualificação pelo novo SHA/CI, decisões versionadas de ordem/infraestrutura e qualquer aceite operacional. Esta fatia é somente prova pública adicional e documentação; nenhuma inspeção/restore, alteração de alvo ou nova autoridade decorre dela.
