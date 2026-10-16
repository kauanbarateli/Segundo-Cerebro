# Frente B4 — preparação nominal do baseline alvo

Implementação pura para revisão de Root, em 16/10/2026. Não estabelece origem nativa, igualdade A2, vazio do banco, autorização ou aceite de restore. Não executa processo, conexão, SQL, migrations, importação nem mint. A Frente A externa continua responsável pelo comparador A2.

## Duas fronteiras nominais distintas

O planejador source existente exige as quatro customizações do Segundo Cérebro e os dados `auth.users`. Um projeto de ensaio vazio não satisfaz esse contrato. B4 mantém esses gates e acrescenta um preparador separado:

```js
const target = planManagedTargetBaseline(tocText, {
  projectRef, databaseName: "postgres", nativeDumpSha256, nativeDumpBytes,
});
const requirements = managedTargetBaselineRequirements(target);
const tocHandle = extractCustomTargetToc(target, nativeDumpBytesInRam);
```

`target` é somente `{}` frozen, registrado em **WeakMap exclusivo de target**. Clones, JSON, herança, Proxy, um source plan e objetos semelhantes não são esse handle. `managedRestoreRequirements`, `authorizeManagedRestore`, `claimManagedRestore` e `extractCustomArchiveToc` não o aceitam. O novo getter e `extractCustomTargetToc` também recusam source plans. Não existe flag pública que transforme um lado no outro.

O input `binding` tem exatamente quatro propriedades próprias enumeráveis de dados. Getters, símbolos, extras, arrays e Proxy, inclusive revogado, recusam sem executar traps. `projectRef` aceita somente 20 caracteres alfanuméricos minúsculos; `databaseName` é literalmente `postgres`; o digest tem 64 dígitos hexadecimais minúsculos e o tamanho é inteiro positivo de até 64 MiB. Uma forma válida não identifica uma conexão nem comprova o projeto autorizado.

O getter retorna somente fatos **privados em RAM**, todos frozen:

```js
{
  binding: {
    side: "target", projectRef, databaseName: "postgres",
    nativeDumpSha256, nativeDumpBytes, tocSha256,
  },
  preserved: [/* metadados completos da listagem original */],
  other: [/* todas as demais entradas originais admitidas */],
}
```

Cada metadado mantém ID, ambos os OIDs uint32, classe, namespace/tag/owner de apresentação e sequência original das dependências, com duplicatas intactas. `preserved + other` cobre a enumeração inteira uma única vez; `other` **não** é uma seleção importável. IDs, nomes, SQL, owners e dependências não entram no handle público nem em erros.

## Perfil conservador de alvo vazio

O preparador reutiliza o parser privado da listagem `pg_restore --list --verbose` existente, incluindo headers, producer PG18, IDs, OIDs, gramática de nomes, dependências presentes/conhecidas e veto a self-edge. O comportamento source não recebe os novos limites nem os gates de target.

O perfil target admite as mesmas 24 classes qualificadas do leitor B2. Ele conserva integralmente:

- Metadados globais DATABASE/PROPERTIES e sua ACL/comment, com nome `postgres`, owner coerente e o vetor de dependências nativo esperado; nunca são instruções a reproduzir.
- SCHEMA e ACL/comment globais de `auth`, `storage` e `public`.
- Todas as definições e metadados admitidos dos namespaces `auth` e `storage`, inclusive entradas adicionais que o source não contenha. A2 poderá detectar essas diferenças; nenhuma busca pelas identidades do source elimina extras.
- Exatamente as duas histórias `TABLE DATA auth.schema_migrations` e `TABLE DATA storage.migrations`, ambas obrigatórias.

`ENCODING`, `STDSTRINGS` e `SEARCHPATH` globais são obrigatórios, únicos e entram em `other`. `TABLE DATA` managed fora das duas histórias e `SEQUENCE SET` também entram em `other`, preservando o registro original. O TOC não informa que seus dados estejam vazios: **a observação nativa de emptiness continua obrigatória e separada**.

Public/app_private DDL, schema `app_private`, suas ACLs/comments, as quatro customizações conhecidas do projeto, classes fora do conjunto qualificado, outros namespaces e globals desconhecidos recusam. Nenhum fallback relaxa o perfil quando um projeto real contém algo diferente. Outra situação exige revisão explícita e evidência própria de Root.

Tetos da listagem target: texto ASCII até 32 MiB, 10.000 entradas e 100.000 referências cumulativas de dependências. O tamanho de texto é verificado antes de split/regex volumoso; o count de entradas é verificado antes de expandir registros, e o count de dependências antes de construir o vetor. O source mantém seus comportamentos existentes.

## Leitor binário comum, entradas públicas separadas

`extractCustomTargetToc` obtém os requisitos exclusivamente do getter nominal target antes de olhar os bytes. `extractCustomArchiveToc` continua obtendo requisitos do getter source. Somente o leitor binário interno é comum; não é exportado e não recebe modo, callback ou autoridade fornecidos pelo input.

Os dois lados exigem o mesmo perfil B2: CUSTOM `1.16-0 / intSize=4 / offSize=8 / GZIP`, encoding UTF8 original, campos completos, NULL/vazio distintos, combinações coerentes com o produtor, limites, checks de offsets e grafo e cruzamento de **todas** as entradas contra a listagem nativa original. No target, o cruzamento usa `preserved + other`, inclusive dados que não pertencem ao baseline.

Os fatos target conservam `binding.side="target"` com seu próprio digest/tamanho de dump e `tocSha256`, nunca um hash de `.scbackup` cifrado. O store próprio de header/TOC, as vistas de ByteString, os getters de integridade e o descarte seguem B2. Hash igual não substitui origem e o compartilhamento do leitor não compartilha autoridade.

O B3 existente pode consumir esse handle nominal para selecionar e extrair as duas histórias, conservando o binding target. O binding de cada lado continua distinto. Root deve conservar a relação original entre target handle, bytes do dump, extração COPY e receipts nativos e reconferi-la imediatamente antes de qualquer comparação. Nenhuma string ou clone já retido é apagável por descarte dos stores.

O grafo de imports permanece sem ciclos: B3 → B2 → planner → formato. O planner não importa B2/B3, não compara bytes binários e não autentica processos.

## Erros, proveniência e trabalho pendente

Novos códigos próprios do planner: `RESTORE_MANAGED_TARGET_BINDING_INVALID`, `RESTORE_MANAGED_TARGET_SCOPE_UNSUPPORTED`, `RESTORE_MANAGED_TARGET_BASELINE_INVALID`, `RESTORE_MANAGED_TARGET_BASELINE_REQUIRED` e `RESTORE_MANAGED_TARGET_LIMIT_EXCEEDED`. Erros originais do parser continuam com seus códigos fechados existentes. Não é anexado o texto recebido nem uma causa.

B2 acrescenta `RESTORE_CUSTOM_TOC_TARGET_REQUIRED`; o enum passa de dez para **11 códigos**, com os demais inalterados. Source plan inválido continua usando `RESTORE_CUSTOM_TOC_PLAN_REQUIRED`; trocar os handles não muda essa distinção.

Root ainda precisa implementar e qualificar o adapter nativo, vinculando **exatamente o projeto isolado autorizado**, recusando o projeto pessoal source, com executável/versão/options conferidos, stdout completo em RAM, prazo absoluto, EOF e close0. Receipts nativos devem estar em estado privado nominal, nunca em booleanos serializáveis. A aplicação das migrations 001–019 não pertence a esse processo.

Continuam pendentes as observações de emptiness e permissões, extração nativa completa de ambos os lados, comparação A2 externa e o ponto único de mint após todas as qualificações. Nenhum sucesso de fixture libera restore. As fontes públicas pinadas e os perfis B2/B3 são os mesmos de seus documentos; B4 não expandiu o formato suportado.

## Validação

As fixtures são exclusivamente artificiais em RAM. Cobrem os 24 tipos qualificados, cobertura de `preserved + other`, extras managed, binding fechado, limites, troca de handles/clone/Proxy, continuidade dos gates source, parser original, cruzamento completo, formato, ownership/integridade/descarte, dados opacos sem declaração de emptiness e ligação nominal B3 target.

Com o semáforo de Root, Node 24.19.0 e `--test-concurrency=1`: a primeira execução target teve 12/13 PASS. Uma fixture das customizações ainda referenciava uma função omitida e, corretamente, o parser original recusou a dependência antes da classificação de escopo. Corrigida somente a fixture para apontar a uma entrada artificial presente, os 13/13 passaram. Nenhum gate de produção mudou por esse resultado.

Na execução associada posterior, **130/130 PASS**, zero skips/falhas, em 13,28 s: planner source, B2, B3, streaming, adaptadores nativos com ports artificiais/PGlite em RAM, A1 e target. Lint dos cinco `.mjs` alterados passou com zero warnings. Os processos foram sequenciais; não foi executado PostgreSQL externo, processo de banco remoto, arquivo privado, captura real, comparação A2 ou restore nesta implementação. Esses resultados não são aceite de CI hospedado ou do target.

Root revisou o delta contra Main e executou sua própria combinação: **130/130 PASS**, zero skips/falhas, em 14,71 s, Node 24.19.0/concurrency1; lint5 sem warnings. Peer independente conferiu os seis paths e as fronteiras source/target. A cópia para Main conservou exatamente os hashes revisados dos seis arquivos antes deste complemento documental. O destino real continua sem observação própria; os novos pins de planner/B2 exigem novo preparo operacional antes de qualquer inspeção seguinte.
