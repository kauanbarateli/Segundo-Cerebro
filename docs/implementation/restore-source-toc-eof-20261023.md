# EOF da listagem do backup autenticado

## Escopo autorizado

Em 23/10/2026 o mantenedor autorizou explicitamente a correção restrita de EOF com testes, depois de revisar a proposta. A revisão automática havia recusado a mudança antes dessa autorização; nenhuma alteração foi aplicada naquela tentativa. Esta implementação preserva o bloqueio de merge e produção.

O controle público anterior, versionado em `evidence/restore-public-windows-20261023.json`, observou Node 24.19.0 e PostgreSQL 18.4 no Windows: `stdin.end` produziu callback e evento `EOF`, sem `finish`, enquanto a listagem terminou naturalmente. Isso não significa que um backup privado, extração COPY ou restore tenha passado.

## Contrato implementado

Somente o ponto interno de listagem da **fonte** habilita o novo caso, após:

1. autenticar integralmente todos os registros, Storage, footer, manifest e EOF do arquivo cifrado;
2. reconferir hash e identidade do snapshot cifrado;
3. vincular exatamente um banco PGDMP ao tamanho e digest autenticados.

Não há configuração de ambiente, argumento público ou porta injetável para habilitar essa exceção em outro lugar. O coletor conserva a recusa padrão, utilizada pelo alvo e pelo controle de ACL.

Para aceitar o EOF da fonte, exige simultaneamente:

- um evento original `spawn`, anterior às observações de entrada e EOFs de saída;
- um callback original e um evento original de entrada, ambos com código próprio de dados exatamente `EOF`, sem `finish`;
- um EOF de stdout e um de stderr, sem fechamento prematuro do pipe;
- um `exit(0, null)` e um `close(0, null)`, nesta ordem; os dois EOFs de saída devem preceder `close`;
- nenhuma repetição, mistura com EPIPE/outro erro, sinal ou erro original tardio durante a limpeza.

O par EOF precisa ter sido observado antes de `close`: callback/evento posterior ao fechamento original recusa, mesmo que ocorra antes da continuação da Promise de coleta.

`exit` pode preceder a drenagem dos pipes; `close` não pode. Getters, proxies, códigos herdados ou coerções não são consultados para qualificar EOF. EOF não é renomeado para EPIPE. A exceção histórica de EPIPE permanece separada.

O planejamento original continua obrigatório depois da coleta. Prazo absoluto, recusa prioritária, limpeza não recursiva por identidade e zeragem da RAM permanecem. Não há mudança em COPY/history, produtor SQL, aplicação do banco, permissões ou migrations.

## Validação observada

Runtime local: Node **24.19.0**, executável oficial incluído no runtime do Codex; heap limitado a 96 MiB para testes e 128 MiB para lint. Não houve instalação de dependências, navegador, banco ou build local.

- Suíte inteira do inspector: **40 PASS / 1 FAIL**, 41 testes. O teste nativo de ACL falhou na remoção de sua própria pasta temporária com `EPERM` dentro do sandbox. Essa falha permanece registrada; não foi classificada como sucesso.
- Mesmo teste de ACL, isolado e fora do sandbox: **1/1 PASS**, sem alteração de código. Atuou somente em diretórios temporários novos do próprio teste.
- Seleção final após os negativos adicionais: **9/9 PASS**. Inclui os seis grupos novos da fonte, recusa de EOF na extração de history e recusa de EOF na listagem do alvo. O controle do alvo apresenta o par completo e todos os terminais naturais, comprovando a recusa específica do caso que a fonte poderia aceitar.
- Os seis grupos novos cobrem vínculo criptográfico, ordem dos eventos, saída antes/depois de exit, callback/evento faltante ou repetido, mistura de códigos, sinais, pipes incompletos, timeout, getters/proxies, falha de autenticação, plano inválido, erro tardio, limpeza e zeragem.
- Revisão independente do código aprovou após corrigir três lacunas: EOFs de saída repetidos; close prematuro; I/O anterior ao spawn. A revisão é estática e não substitui execução hospedada.

Lint dos três módulos alterados: **PASS**, zero avisos ESLint; o plugin React informou detecção de versão sem dependências instaladas neste worktree, sem reprovação do comando. Detector de segredos: **PASS**, 2.021 arquivos versionáveis. O resultado próprio do CI da nova revisão será registrado separadamente; não se herdam os resultados da base.

## Pendente

Qualificação dos dois jobs Windows que recusam o ZIP público; QA remoto próprio do preparo V3; inspeção privada somente pelo dispatcher e protocolo revisados; comparação efetiva de baseline e ensaio de restore. Nenhuma inspeção privada ou restore foi executado para esta mudança. `restoreAccepted` permanece falso nos diagnósticos.

A alteração não autoriza nova janela de backup, não aplica 001–025, não modifica o ambiente de produção nem libera merge/deploy.

## CI próprio da primeira publicação e correção

O SHA `9532a7f2570dfaaea772e0683542b982e42bb24d` teve 14 jobs elegíveis aprovados e os dois CI gerais reprovados, com 1.974 PASS / 2 FAIL entre 1.976 contratos de scripts. O workflow Windows apareceu como skipped pela condição explícita de branch; não recebeu PASS nem houve job push Windows elegível. Nenhum ensaio privado foi liberado por esses resultados.

Os dois logs próprios identificaram: o teste combinado ainda esperava uma leitura de getter, agora evitada; e o controle EOF posterior ao close revelou a lacuna de ordem descrita acima. A correção atualiza o primeiro assert para zero leituras, preservando a recusa; acrescenta a recusa de entrada EOF após close ao código e mantém integralmente o segundo controle negativo. Não se alterou esse negativo para aceitar a sequência.

Depois da correção: **23/23 PASS** no fluxo combinado e **9/9 PASS** na seleção da fonte/history/alvo, em Node 24.19.0. Novo CI próprio continua obrigatório; os dois failures originais permanecem no histórico.

## Fechamento do CI 7002 e preparo de leitura V3

No SHA `7002bf2d47931bbec8b9be8a4051b802969840e1`, os **16 checks elegíveis** concluíram com sucesso, na tentativa original: os dois gerais executaram 2.453 testes de unidade em cada fuso, 1.976 contratos de scripts e 361 E2E. Os 14 envelopes nativos não deixaram resultado incerto, operação pendente ou limpeza não confirmada; 461 blobs Git e 63 pins de dependências foram comparados sem divergência. Os dois envelopes Auth não incluem manifesto granular de arquivos; não se atribui a eles essa evidência ausente. O Windows específico foi skipped pela condição da branch, sem aceite de seu ZIP.

O preparo público V3 mantém a fonte operacional fixa em `7002bf2`, árvore `209900e0ef1af0f87e8872484c29c2266012355a`, em checkout separado e limpo. Root reconferiu os 21 pins transitivos por bytes/hash/blob; a ampliação inclui duas dependências já alcançadas pelos adapters, sem executar seu SQL. Os 26 parsers permanecem byte-idênticos à V2, assim como os limites e gates inertes. Seu QA puro local aprovou **374 controles**, lendo apenas o template público e funções extraídas por AST, sem processo nativo, arquivo privado ou banco. O QA remoto próprio é o próximo gate. Esse resultado não é uma inspeção do backup e não libera restore, merge ou produção.
