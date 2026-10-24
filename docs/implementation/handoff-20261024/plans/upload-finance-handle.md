# B2b-2 — handle financeiro concreto para a barreira local

24/10/2026. Proposta somente leitura, após congelar J2. Nenhum path de produto editado nem runtime/rede/SQL executado. Não é GO C2 ou montagem. Complementa o contrato B2b-2; não cria autoridade de finalização/vínculo.

## O que existe

* `FinanceGoalsBrowserClient` recebe o journal concreto no construtor (`src/lib/finance-goals-client.ts:113`), mas o mantém privado. A factory oficial registra esse mesmo journal para logout (`:232–241`). Esse vínculo deve ser preservado.
* `FinanceGoalsJournal.exclusive` (`src/lib/finance-goals-journal.ts:112`) fornece uma lease real sob o mesmo Web Lock usado por stage/execute/terminal. `lease.snapshot()` reconfere dono/epoch e fornece pending/reconfirmRequired. Não é preciso criar outro journal, adivinhar lock ou ler localStorage bruto.
* O port `FinanceGoalsClient.loadPending` libera a lease antes de devolver a observação. Portanto consultar essa função e depois escrever o journal de imagem **não** cria uma barreira atômica entre abas.
* O controlador preserva seu hold em `state().journal.pending`, inclusive quando o corpo físico desaparece (`goals-ui-model.ts`, `hold`/`refreshJournal`). State nulo não significa livre. `current()`/`matches(owner,client)` permitem verificar identidade sem exportar heldIntent. `channel.busy` é apresentação; não substitui a lease real.

## Menor integração recomendada para a Root

Se C2 for autorizado, acrescentar uma capacidade local estreita **ao client concreto**, fechada sobre `this.journal`, em vez de exportar seu campo privado ou reconstruir outra sessão. A factory oficial atual continua dona de criação/abertura/logout. Não alterar Core, SQL, requests, command IDs, stage/execute ou o formato do port financeiro existente.

Forma conceitual:

```ts
interface GoalImageFinanceBarrier {
  readonly ownerId: string;
  readonly epoch: string;
  runLocalTransition(work: (assertCurrent: () => void) => undefined): Promise<void>;
}
```

A capacidade não devolve journal, lease, input/GoalCommand ou método de escrita financeira. `runLocalTransition` usa a instância concreta existente, não aceita `{pending:false}`/snapshot fornecido pelo chamador e não gera UUID. O coordenador a recebe por injeção somente quando owner/epoch/service coincidem com o client financeiro atual.

Algoritmo a implementar apenas após GO:

1. O coordenador já está sob o lock de upload e já obteve a prova própria de finalização; **não** mantém lock financeiro enquanto faz HTTP/Storage/finalize.
2. A capacidade confere `this.initialized()`, host/service e o fence do journal, depois entra em `this.journal.exclusive`.
3. Dentro da lease: reconferir guard/fence; obter snapshot internamente; exigir owner/epoch exatos, pending nulo e reconfirmRequired=false. Não há bypass por disponibilidade de novas operações, nem fallback por erro/403/503.
4. Reconferir também o controlador da mesma composição: `current()`+`matches` verdadeiros, journal não nulo, pending nulo e reconfirmação resolvida. Isso é uma condição adicional de liveness, não um DTO que substitui a leitura concreta da lease. O host não pode usar state React antigo ou um boolean capturado durante o mount.
5. Executar somente a transição **síncrona** de metadata de imagem; o callback recebe um guard temporário que valida client/fence e a lease atual. O tipo retorna `undefined`; retorno Promise/thenable ou qualquer outro valor é recusado em runtime, e um guard escapado é invalidado no finally. Não é uma API para executar sender/fetch ou outros comandos dentro da lease. A rotina concreta deve chamar o guard imediatamente antes/depois de cada SET/readback.
6. Reconferir snapshot/guard antes da saída e identidade depois do await externo. Qualquer erro preserva A/retirement-review e não admite B. O journal de imagem faz seu próprio CAS/revisão; não se cria atomicidade fictícia entre dois localStorages.

Usar sempre **upload → financeiro**. Nenhum chamador pode adquirir financeiro e aguardar upload. Nenhum callback pode chamar `loadPending()` ou outro método que tenta adquirir novamente a mesma lease. Essa capacidade não modifica estado do journal financeiro, reconhece terminal, limpa pending, faz ack ou revoga sessão.

O requisito reconfirmRequired=false é o recorte mais simples para ambas as razões de retirada: se a confirmação financeira deixou o aviso atual de revisão, aguardar a revisão/ack existente antes da retirada local. O resultado positivo de vínculo pode continuar registrado em RAM, mas não autoriza uma nova seleção enquanto esse aviso estiver ativo. Otimizar uma retirada antes de ack seria outra decisão explícita da Root; não é necessária para uma fatia segura.

## Onde o handle falta hoje

O client concreto ainda não expõe essa capacidade. Criar um segundo `browserFinanceGoalsJournal(owner)` apenas para conseguir a lease pode rotacionar metadata em uma corrida de logout e não prova ser o mesmo handle registrado na factory. Não usar cast para acessar `private journal`, nome de lock montado por string ou injeção de `{pending:null}` como atalhos.

Proposta de delta C2 a autorizar: um método/capacidade local no **client concreto** e seu teste focal, mais o módulo novo de barreira/coordenador já planejado. O port `FinanceGoalsClient` financeiro pode permanecer inalterado; a composição isolada recebe a capacidade extra separadamente. Se a Root preferir que a factory entregue `{client,imageBarrier}`, ela deve preservar o mesmo journal e seu registro de logout, sem criar outro epoch. Não implementar as duas opções em paralelo.

Para o controlador, o host isolado pode prover uma função que lê `controller.current()/matches()/state()` no instante da transição, sem acrescentar uma API de autoridade no Core. Se não houver controlador recuperado correspondente, recusar. A integração real desse host continua fora da J2 e sem montagem em Workspace.

## Negativos específicos

* journal financeiro concreto com B pendente, corpo físico null mas hold A no controlador, reconfirmRequired, state null, journal-error, owner/epoch/client trocado: zero SET no upload;
* fila de lock enquanto outra aba stage A/B: a leitura **dentro** da lease vê o vencedor e recusa; não usa loadPending prévio como prova;
* callback/guard escapado, retorno async, logout durante readback, e1 versus e2: nenhum corpo novo removido;
* bloqueio local depois da confirmação financeira não altera resultado remoto nem converte o aviso em rollback;
* nenhuma chamada de HTTP/Storage/execute/settle/ack dentro da lease financeira, nenhum lock inverso;
* no client atual, disponibilidade false não é logout; a barreira local pode recusar por estado, mas não limpa tentativa ou exige um novo UUID.

Esses são testes a escrever na futura autorização. Não há execução ou garantia de corrida nativa nesta leitura. O plano conserva os quatro paths J2 e os doze M2-S congelados intactos.
