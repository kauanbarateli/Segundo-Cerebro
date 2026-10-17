# Novo backup pessoal: preparação sem execução

Este material descreve o menor caminho para renovar o backup da origem pessoal
rishenjoikgmfubmnfiu. A data do arquivo acompanha o trabalho de 17/10 UTC.
Não cria perfil, abre archive, lê a chave ou toca no pendrive. Nenhuma janela
antiga de quiescência permanece válida.

## Motivo e limite do aceite

Root informou que a inspeção nativa única na fonte 51495ec3… terminou com
snapshot somente leitura vazio aprovado, 395 entradas TOC, 236.587 bytes e
históricos Auth=82/Storage=74. A inspeção autenticada anterior do backup na
fonte 801b6a84… tinha Auth=82/Storage=73. Estes são resultados recebidos de
Root; esta entrega não reabriu capturas nem consultou serviços.

A diferença Storage já impede a igualdade desse backup antigo com o alvo
observado. Um novo backup não garante que a origem tenha 74, nem que DDL,
owners, ACLs, dependências e históricos completos coincidam. A2 deve comparar
novamente o conteúdo completo. Não excluir a linha excedente, ignorar migrations
do provedor ou enfraquecer A2/B4 para acomodar uma diferença. Este preparo
não autoriza restore.

O backup anterior é preservado. A nova cópia recebe nome próprio e não
substitui archive, relatório, perfil, chave ou arquivo do pendrive.

## Perfil e destino existentes

O perfil a reutilizar, somente na execução futura revisada, é:

    C:\Users\Kauan Sousa Barateli\SegundoCerebro-Operations\profiles\backup-source-pg18-20261012-v1.xml

Pin histórico autorizado: 4.206 bytes, SHA-256
5D9C83138241DBBF3EA94722E46BF4A67EA52B2EF22D72F7F05055BBC214F32C.
Ele não foi aberto ou recalculado nesta preparação.

O produtor público work/prepare-backup-private-20261012-v1.ps1 registra o destino
C:\Users\Kauan Sousa Barateli\SegundoCerebro-Operations\archives, chave
independente existente com ID SC-20261012-001, pg_dump18 e certificado
certificates\prod-ca-2021.crt. Pin histórico do certificado:
700723581420DD1AC98FD7E9AC529F0EF210EADCAF87FC868A3AD7D114C2F3B7.
Isso descreve o código produtor público; não comprova por leitura o conteúdo
atual do perfil. Diferença de pin recusa, sem regenerar ou corrigir silenciosamente.

Não reler, imprimir, copiar ou rotacionar a chave. Não acessar novamente o
pendrive. O dispatcher importa todo o conjunto permitido do perfil DPAPI e
restitui o ambiente ao sair; ele não seleciona só os campos de create.
Os consumidores recebem ambiente selecionado e não senha/URL de conexão em argv.

## Grafo e pins públicos

O caminho é PS7 → run-operator.ps1 -Operation create → Node24 → backup.mjs create.
Não recebe Archive, SQL, ref alternativo, operação ou executável do chamador.

A união local tem oito paths:

| Path | Papel |
| --- | --- |
| scripts/operations/run-operator.ps1 | Importa DPAPI e monta argv fixo. |
| scripts/operations/backup.mjs | Create, autenticação integral, hash e relatório agregado. |
| scripts/operations/backup-config.mjs | Ref pessoal, chave, quiescência e caminhos. |
| scripts/operations/backup-sources.mjs | Dump custom, inventários e bytes Storage. |
| scripts/operations/backup-format.mjs | AES-GCM/HKDF, manifest e archive exclusivo. |
| scripts/operations/restore-verify.mjs | Import estático do CLI; ramo restore não é invocado. |
| scripts/operations/restore-target.mjs | Import estático; importa config/format/Storage/postgres-process. |
| scripts/operations/postgres-process.mjs | Transitivo de restore-target; não executa query em create. |

Os demais imports são built-ins node:*. Nenhum SDK, .env, inspector/B2/B3,
A2, psql ou pg_restore deve ser invocado. Os imports dos ramos de restore são
inertes, mas seus bytes entram nos pins.

Pins medidos na Main 51495ec3123a32d8c4ba6f134e0c5f2b52867fbc **antes do patch
de transporte**:

| Path | Bytes | SHA-256 |
| --- | ---: | --- |
| scripts/operations/run-operator.ps1 | 6111 | 7311AEC2E11F747C7D3204821EF22748BDA9CCAB85608D6B3EDB854C44BF196C |
| scripts/operations/backup.mjs | 3669 | 6390F03EA9BB03D0FE92C6597D3659DA6EC316000D6F6CDCD11FFEE69E9921D4 |
| scripts/operations/backup-config.mjs | 4347 | BB0F9276180C26E9D07253631B233AD8EF9AEAD7CCA07ABDB01D9F0E4C567D78 |
| scripts/operations/backup-sources.mjs | 5367 | F3AAF3D29FF465CCFF074B2626A6A0304700FFBD3847FE57B7003EB7F2E90F41 |
| scripts/operations/backup-format.mjs | 10581 | AE711C39EF31660CBDDC50081290C53B57CCE8FE6361E8A5E7846EDD0696AC74 |
| scripts/operations/restore-verify.mjs | 1634 | 3D7F21D25E8654ADF59B553FA0EB93231F816427E9B0B1088C1F6CC764ED7B9D |
| scripts/operations/restore-target.mjs | 11357 | F29BD0B5D23F78EDE190C6B85CD467E87DC0048E7172E8C8F686771DF49B4AA0 |
| scripts/operations/postgres-process.mjs | 5359 | D210AB110390EC8CD14DF2189346F0EEEE1DF3CCD03D13E6476AA00E51991464 |

Essa tabela é histórica. Após revisão e 36 testes próprios de Root, o novo
preparo foi atualizado somente para os dois novos pins abaixo e seu self hash
na QA. O dispatcher continua pinado pela Main publicada de 6.111 bytes,
não pelo WIP separado de Root no Review. Nenhum prep encerrado foi repinado.

| Path revisado | Bytes | SHA-256 |
| --- | ---: | --- |
| scripts/operations/backup.mjs | 5828 | A8CAA0F5D4341B45FD9DC3B6CF209892E9C687894E7D1811C2056464632091FE |
| scripts/operations/backup-sources.mjs | 8865 | 0533CDBABD16AB168B9F7CA5F23E1E7DDB878104D3230A28825452D085D9246D |

## Windows: saída custom binária

Os argumentos pg_dump são exatamente:

    --format=custom --schema=auth --schema=public --schema=app_private --schema=storage

Node recebe stdout direto e entrega os bytes ao cifrador, sem dump plaintext
em disco, normalização CR/LF ou flags que removam owners/ACLs. O código oficial
PostgreSQL 18.4, função _allocAH, linhas 2304–2316, seleciona O_BINARY no
Windows para archive não textual usando stdio. Esse é um caminho diferente do
SQL textual que precisou de pipe na inspeção History.
[Código oficial PostgreSQL 18.4](https://github.com/postgres/postgres/blob/REL_18_4/src/bin/pg_dump/pg_backup_archiver.c#L2304-L2316).

pg_dump usa uma fotografia consistente de um banco. A seleção de schemas não
exporta todos os objetos globais do cluster. O backup não atesta roles globais,
event triggers fora do escopo ou compatibilidade com um servidor alvo mais
antigo. [Manual oficial pg_dump 18](https://www.postgresql.org/docs/18/app-pgdump.html).

Executável autorizado: C:\Program Files\PostgreSQL\18\bin\pg_dump.exe,
632.320 bytes / 46C8AD2E487FA01BB5401AE3B383C09E20789EFDD3A37C6940975647EB1FF574.
Pin do executável não atesta todas as DLLs nem protege contra controle hostil
da mesma identidade/máquina.

Pins públicos herdados dos preps revisados para os runtimes:

| Runtime | Bytes | SHA-256 |
| --- | ---: | --- |
| .cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe (Node24) | 92825416 | 3602F2BB1A10F2CBAB4C36886218A33C1AB3DB87290E73B033C46C77147D0237 |
| .cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe (PS7) | 301368 | 362A356CE7F0940EC74F73A8FC2C990A2CC24A38A11C90BBD8ECA947110AD139 |

Os caminhos são relativos à raiz do usuário somente nesta tabela; o launcher
usa caminhos absolutos fixos, não o runtime resolvido pelo PATH.

## Lacuna e correção proposta separada

A fonte histórica consumia stdout por async iterator e aguardava child.close(0).
Tinha listener de child.error e stderr.resume(). Isso não exigia separadamente
EOF original de stderr, exit(0,null), close(0,null), spawn original ou veto
persistente após a Promise completar.

Root autorizou um patch separado e limitado:

1. Guard privado do child original com spawn/EOFs/exit/close únicos e sinais
   nulos. Error, aborted, close prematuro, duplicatas e terminais inválidos
   preservam a primeira falha fechada. Destroy/kill acordam a leitura, mas
   nunca suprem os eventos de conclusão.
2. backupEntries continua iterável e retém o guard em WeakMap.
   assertBackupEntriesCurrent aceita somente o iterator dessa factory.
   Uma fonte fake injetada sem guard segue sintética; PGDMP e JSON não
   atestam origem Native.
3. O produtor zera os chunks originais e cópias que entrega ao retornar/errar
   do yield. Não promete apagar strings, buffers internos do OS/runtime
   ou todas as cópias do cifrador existente.
4. O CLI revalida o guard depois dos awaits de create, readBackup, hash e
   relatório, até o check síncrono imediatamente antes de output.
5. A criação do relatório precisa continuar exclusiva, sem sobrescrever.
   Em falha, só o relatório desta invocação pode ser removido por inode/device
   conferidos com lstat e lease; nenhum archive ou relatório preexistente.
   Identidades de filesystem usam BigInt para não perder bits de dev/ino.

A primeira implementação tentou um temporário wx+ seguido de hardlink exclusivo.
Em controle **público** com fixture temporária, fs.link recusou EPERM; não
atribuir esse resultado a uma causa específica no destino privado. Root aprovou
a solução menor: relatório final aberto por wx+, identidade obtida do próprio
fd, escrita/fsync/close seguidos dos guards e limpeza restrita ao inode próprio.
Não há hardlink ou fallback de overwrite na versão final. A publicação é
exclusiva, **não atômica**; um relatório parcial visível não comprova sucesso.
Se a identidade não puder ser confirmada, o artefato não qualificado é deixado,
em vez de excluir um arquivo de origem incerta.

Não mudam formato, schemas, políticas, chave ou autoridade de restore.
Nenhum PASS sintético comprova backup conectado.

## Preparo novo e inerte

Novos arquivos em work:

- create-backup-preparacao-20261017-v1.ps1
- test-create-backup-preparacao-20261017-v1.ps1

Defaults: GateExecute=false, ReviewedCommit=null, SelfSha256 vazio e
NewQuiescenceDeclared=false. Gate false retorna antes de I/O. A primeira
fonte tinha transportReviewed=false, sem permissão para entradas privadas;
depois da revisão e QA própria, Root autorizou transportReviewed=true para os
dois pins novos. Essa constante não é opção do chamador e não substitui
GateExecute, commit/self hash ou nova declaração de quiescência.

Contrato do preparo final, após revisão de Root:

- HEAD exato, self hash, PS7/Windows e os oito paths tracked, limpos e pinados.
  Os WIPs alheios permanecem fora desse status guard.
- Leases FileShare.Read de fontes, Node24, PS7, pg_dump18, perfil e certificado
  até a saída. Não usar bypass de política do Windows.
- Archives já existente, diretório NTFS regular fora repo/work/OneDrive/sync,
  ancestrais sem reparse, owner e Allows limitados ao operador/SYSTEM/admins.
  Não mudar ACLs, criar pasta privada ou listar conteúdo.
- Child PS7 sem shell, Environment.Clear(), nomes OS selecionados, PATH System32,
  PATHEXT constante .EXE; não herdar NODE_OPTIONS, PGOPTIONS, PG credentials,
  tokens ou configuração Auth de outras conexões. PS7 pode ajustar PATH no
  startup; o core não o usa como selo de identidade. pg_dump continua absoluto.
- Somente após declaração **nova**, SC_BACKUP_QUIESCED=YES no ambiente desse
  child, nunca no perfil nem no processo pai.
- stdout bruto em RAM até 64 KiB, stderr descartado/zerado, JSON estrito com
  basename, hashes, key ID e contagens coerentes. Campo extra/duplicado,
  saída dupla, exit incompatível ou código desconhecido recusa sem texto bruto.
- Budget cooperativo de 600 s para preparo/processo/coleta, sem renovação.
  Calls síncronas de hash/Git são checadas antes/depois, sem promessa de
  preempção exata. Não altera o deadline de 45 s dos inspetores restore.
- Sucesso do transporte PS exige os dois EOFs e saída originais; não substitui
  eventos PG retidos pelo core. Timeout é indeterminado. Kill não prova término
  local/remoto e não permite retry automático.

A saída permanece backupQualified=false, inclusive com create concluído:
Root ainda precisa do verify separado e dos aceites posteriores de recuperação.
Não há tarefa Windows, cron ou automação Codex criada.

## Nova quiescência

Root pede a nova janela quando bytes finais, testes próprios e commit estiverem
concretos. A autorização antiga não pode ser reaproveitada.

Pausar escritores do app, abas/aparelhos, Admin, imports, uploads, limpeza de
staging/Storage, sincronismo Google e comandos/API/SQL de domínio; aguardar
operações em voo. Fechar uma aba não comprova que rotinas hospedadas pararam.
Registrar o estado conhecido sem alterar VOE/BlackSheep.

O CLI inventaria os dois buckets privados antes do dump, baixa bytes por HTTPS
nativo com Accept-Encoding: identity e compara o inventário posterior por
fingerprint. Não faz descompressão transparente. Esse controle detecta mudanças
observadas no inventário; não torna DB+Storage atômicos nem suspende migrations
internas do provedor. Estado incerto ou escrita percebida encerra a janela
sem repetição automática.

## Próximos passos exclusivos de Root

1. Revisar patch e QA, repinar somente esse preparo, fechar self hash e SHA
   publicado, rodar checks próprios.
2. Pedir nova quiescência e registrar estado de escritores/rotinas.
3. Preflight público e só depois leases do perfil/certificado e validação
   privada do destino; diferença recusa sem correção silenciosa.
4. Executar **um** create. Guardar somente o resultado agregado validado;
   preservar archives anteriores em qualquer falha.
5. Derivar o novo path apenas de basename/hash próprios, nunca “arquivo mais
   recente”. Preparar verify separado com a chave original.
6. Novo preparo revisado para autenticar o archive e extrair históricos/TOC;
   comparar com alvo em snapshot somente leitura consistente. Resultado antigo
   de 51495ec não é observação desse novo instante.
7. Decidir sobre compatibilidade/A2/restore sem reaplicar 001–019, mutar alvo
   ou ignorar o desvio Storage como efeito colateral de create.

## Validação e pendências desta entrega

A revisão de grafo e pins foi somente de fontes públicas. A QA nova cobre
eventos originais, terminais faltantes, sinais, duplicatas, falhas tardias após
exaustão e Storage, modo sintético e handles forjados. A fixture antiga foi
ajustada para emitir spawn/EOF2/exit0/close0 reais do double, em lugar de close0
isolado. QA AST carrega só funções puras de validação e JSON sintético.

Resultados próprios finais do core: novo guard 23/23 e antigo 13/13, juntos
36/36 PASS, mais lint dos quatro módulos/testes PASS. A primeira execução do
antigo registrou 12/13 por EPERM da publicação por hardlink, isolado por fixture
pública; após o delta aprovado, a suíte completa passou. AST do launcher
provisório 67/67 PASS, sem executar o gate. Após BigInt, Root informou revisão,
36/36 próprios e lint4 PASS no core final A8CAA/0533. Após os dois pins e
transportReviewed serem atualizados com autorização de Root, a QA AST final
passou novamente 67/67. Isso não representa aceite conectado. Root ainda
revisará o preparo final, fará QA própria e obterá nova janela antes de uso.
Nenhum perfil, archive, serviço privado, USB, pg_dump ou restore real foi
aberto/executado nesta entrega.

Root conferiu o preparo final e passou os 67 controles AST em execução própria; o gate padrão no Main permaneceu inerte. Um peer independente revisou os quatro arquivos do core e não encontrou bloqueador concreto nos guards/publicação. A remoção do relatório usa `unlink` por caminho após conferir identidade; depende do namespace privado não sofrer troca concorrente. Não é uma primitiva de exclusão atomicamente condicionada ao inode. Durante a janela, os caminhos do diretório de backups não devem ser manipulados por outro processo. O archive permanece preservado em falhas, e relatório visível isolado não certifica backup sem `create` e verificação separada bem-sucedidos. Nova janela humana ainda é necessária antes de qualquer execução real.
