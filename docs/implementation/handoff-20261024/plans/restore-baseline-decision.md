# Baseline do restore — decisão e preparo mínimo após V8

Proposta estática. Não implementa uma política, não prepara alvo e não concede aceite. Nenhum Node, teste, SQL, inspeção, rede ou leitura de archive/perfil foi executado. O pacote N permanece congelado, fora desta proposta.

## Ponto de partida preservado

O recibo público V8 foi novamente conferido: `root-observation-v8-20261023/closed-result.json`, 12.463 bytes, SHA-256 `72fa09fb476d77bd94be09ba1fb32c401e20a95e592402ff0f9f3047dd846606`. Fonte operacional registrada `057ec5b353972d7d09ba7f5787687b6fcb9863ae`, árvore `78b73038b23fe677f3fa9341fcffded7156e5bf6`.

**Observado:** comparação/transporte concluídos; 350 pares managed; 36 vetores divergentes, todos comparáveis e com multiset mapeado igual; zero multiset diferente/não comparável. No grupo público adicional, oito pares e cinco definições divergentes: uma FUNCTION, uma ACL e três DEFAULT ACL. A2 registrou FAIL por dependências e definições; `baselineQualified=false`, `remoteMutation=false`, `restoreAccepted=false`. Histórias 82/74 iguais e cobertura completa não substituem esses gates.

**Já explicado por fontes públicas:** o parecer `restore-v8-definition-order-plan-20261023.md` correlacionou as cinco identidades com `public.rls_auto_enable()`, sua ACL e defaults públicos de sequências/funções/tabelas. A correlação usa candidatos públicos, não preimagem de SQL. As migrations 001/003/016 descrevem endurecimentos de privilégios compatíveis com a suspeita de origem endurecida versus alvo fresh. Não comprovam o conteúdo das quatro ACLs reais. A 003 conserva o corpo do helper; não explica os 1103 → 1205 bytes da FUNCTION. Esse conteúdo continua desconhecido.

**Limite de contexto:** o resumo dos 36 usa o contexto managed. A comparação existingApp usa a união managed + candidatos públicos. A experiência V7-r2 já provou que razões nesses contextos não são intercambiáveis. Não inferir que o diagnóstico de um grupo cobre automaticamente toda aresta que a união pode mapear. Um futuro certificado de equivalência precisaria conferir separadamente os pares em cada contexto efetivamente usado pelo comparador.

## Decisão necessária, antes de mexer em comparação ou alvo

A política vigente é deliberadamente conservadora: ordem e multiplicidade das dependências e bytes integrais das definições importam. O V8 não prova um bug. Sob esse contrato, não há caminho legítimo para cunhar baseline enquanto as divergências continuarem; repetir a mesma inspeção não muda isso.

Recomendo **preparar duas provas públicas independentes**, antes de decidir qualquer exceção: (A) por que a ordem de uma lista de dependências do produtor/consumidor pinado seria ou não semanticamente relevante; (B) qual política de infraestrutura pública deve existir no alvo e qual é a proveniência do helper. O resultado de A não autoriza B, e o hardening de ACL não explica o corpo da função.

Depois dessas provas, Root deverá escolher expressamente entre manter a política estrita e preparar um alvo comprovadamente compatível por uma entrega separada, ou revisar um **novo contrato versionado de equivalência**, mantendo A2 v1 intacto e seu resultado original visível. Não recomendo tentar reproduzir OIDs/ordem física de catálogo, substituir o helper por um corpo antigo, remover metadados ou ordenar vetores para conseguir o verde. Se não houver prova suficiente, #35 continua bloqueada.

## Prova A: dependências, sem transformar diagnóstico em aceite

Critério mínimo que seria necessário para uma alternativa futura: bijeção inequívoca por identidade completa em bytes; fechamento do contexto nos dois lados; mesmo número de referências a **cada** identidade correspondente; nenhuma aresta faltante, extra, desconhecida, externa não suportada ou própria; todas as outras comparações integrais de A2 e ambas as histórias inalteradas. A equivalência teria de ser demonstrada para o produtor e o caminho real de consumo da versão pinada, incluindo execução sequencial/paralela pertinente, seleção e ordenação de restore. Não basta um grafo abstrato permitir topological sort.

Os vetores originais, seus ordinais e duplicatas permanecem evidência. Uma eventual prova auxiliar poderia contabilizar ocorrências em estrutura transitória separada, sem reescrever/ordenar/deduplicar os arrays nem apagar `dependency_vector_mismatch` do A2. Isso continua somente observação até existir decisão e integração versionadas. Hash de identidade só acelera busca; bytes completos decidem bijeção. Uma razão no contexto managed não resolve a razão no contexto da união.

**Não seriam seguros:** igualdade numérica de IDs/OIDs; sets que descartam duplicatas; ordenar SQL, registros ou vetores existentes; comparar só contagens/primeiras oito amostras; aceitar arestas não mapeadas; transportar uma contagem entre contextos; pressupor que toda dependência de pg_dump é independente de ordem; demonstrar apenas que um dump pequeno restaurou uma vez. Os 36/36 do V8 encerram a necessidade de investigar multiplicidade desse grupo, mas não aprovam esse novo contrato.

Próximo preparo público: matriz anotada dos pontos do produtor e consumidor que constam das referências PG18.4 já presentes no contrato A2, identificando onde a ordem entra ou deixa de entrar na seleção/scheduling. Não li fonte externa nova nesta tarefa. Sem revisar a implementação exata, a hipótese continua hipótese. Fixtures públicas podem confrontar identidade mapeada, permutação, duplicação e arestas externas; testes nativos sintéticos futuros corroboram a revisão, sem substituí-la.

## Prova B: infraestrutura pública, em escopo exato

1. Registrar uma matriz desejada de privilégios para os papéis públicos/API já declarados pelo projeto. Considerar defaults **globais e do schema**, o emissor dos DEFAULT ACL, existentes versus objetos futuros e grant options; um REVOKE de schema não elimina GRANT global. A 016 já determina recusa diante dessa deriva. Não reaplicar migrations históricas no alvo fresh: suas pré-condições incluem fundação da aplicação que ainda não deve existir ali.
2. Documentar o gate de catálogo do helper/event trigger separado da definição TOC: tipo event_trigger, owner, security definer/search_path, vínculo `ensure_rls`, enabled, evento/tags exatos e permissões. Uma assinatura conhecida ou a função no dump não provam que o event trigger foi incluído ou que será preservado.
3. Localizar, em fontes públicas pinadas de infraestrutura, candidatos **íntegros** para as duas definições do helper. Comprimento/hash V8 serve para localizar um candidato público; não permite adivinhar, reconstruir, normalizar ou aprovar o corpo. Para autoridade futura, a comparação precisa conferir os bytes originais nominais contra o literal integral aprovado, não confiar só no hash de um JSON. Se nenhum candidato público corresponder, parar: não ampliar uma sequência de diagnósticos de conteúdo.
4. Só depois, preparar uma proposta separada e inerte de configuração do alvo, com estado anterior esperado, escopo de ACL/defaultACL, pré-condições/aborto, preservação de OID/corpo/owner do helper e catálogo pós-condição. Se a solução exigir mudar seu corpo, isso é outra decisão de infraestrutura/segurança; a autorização da 003 para REVOKE não a contém. Não é uma correção cosmética de baseline.

Não é seguro aprovar uma ACL porque parece mais restritiva pelo tamanho, porque apenas PUBLIC/anon foram removidos, ou porque os cinco nomes eram esperados. Mudanças podem ampliar grants em outra camada, retirar uma permissão necessária ou mudar comportamento do helper. Também não é seguro uma allowlist por nome que aceite qualquer versão futura da plataforma. Um contrato alternativo teria de ser pequeno, pinado, enumerar a compatibilidade aceita e recusar novidade.

## Menor fatia independente de operação

Para reduzir retrabalho, o próximo pacote a submeter à autorização de autoria é **somente público e não operacional**: documento único de política candidata + fixtures/asserts de decisão. Ele fixa a matriz A/B acima, reutiliza a fixture A2 existente e prova que A2 v1 continua recusando todos os casos V8 conhecidos. Não precisa de novo campo no operador, novo leitor, novo backup, conexão ou target-only. Pode manter uma projeção auxiliar `order-only candidate` para testes sintéticos, sempre sem `matches` substituto ou autoridade. A política existente e os quinze motivos permanecem intocados.

O pacote deve conter negativos que impeçam usar esse auxiliar como baseline: contexto trocado; dependência duplicada perdida; aresta extra/faltante/self/unmapped; mesma apresentação textual com bytes de identidade distintos; mesmo bucket de identidade de uma classe ordinária com owner semântico diferente; hash fornecido pelo chamador; NULL/vazio; campos/owner/SQL/ACL/história divergentes apesar de multiset igual; duplicatas/Proxy/getter/SAB/detach; teto; clone de relatório tentando cunhar handle; perfis públicos de helper sem proveniência; schema/global defaults contraditórios; grant option inesperada; event trigger desligado/tags/vínculo errados. Não se alega fabricar uma colisão criptográfica real. Permutação isolada só pode aparecer como candidata observacional enquanto A2 v1 retorna seu FAIL original.

Compatibilidade: archives/formato/AEAD, seleção Source, B4, deadlines 45/90 s, EOF/ACK, capacidades nominais e descarte não mudam. V5–V8, readers/pins, recibos e markers ficam byte a byte preservados. Qualquer protocolo futuro com campo/versão diferente precisa de outro leitor estrito; leitor antigo deve recusá-lo. Nenhuma nova observação, mesmo toda igual, é por si só um `TargetBaseline` ou aceite de restore.

## Sequência, com preparo e execução separados

**Agora, permitido e realizado:** ler apenas recibo/documentação/código públicos; conservar os fatos e a distinção entre contextos; entregar esta decisão técnica. Nenhum código adicional foi autorizado por este pedido de planejamento.

**Preparo futuro, após GO específico:** fechar a revisão de semântica PG e a política do helper/ACL; escrever fixtures/negativos e proposta inerte; peer independente; lint/controles puros e CI próprio; documentar se cada diferença foi explicada, continua desconhecida ou exige decisão. Não alterar o comparator v1 para acomodar um teste e não chamar skip de PASS.

**Operação futura, separada:** somente depois da decisão e revisão de efeitos, eventual preparação supervisionada do alvo e conferência do catálogo; então Root decide se é necessária uma única observação nova com fonte/reader/pins aprovados. Reutiliza-se o archive imutável já verificado; este plano não solicita nova janela humana para lê-lo nem autoriza inspeção. A qualificação e a execução de restore continuam etapas distintas, com todos os gates próprios de vazio, ator, permissões, fonte, quiescência e reconferência final. Nenhum prazo estimado de implementação do MVP é aceite para dispensar esses requisitos.
