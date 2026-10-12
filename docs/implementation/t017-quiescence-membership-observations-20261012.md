# Admin e Recovery: observação da pendência no encerramento

As [provas nativas de 1143323](frente-b-checkpoint-1143323-20261012.md) ainda recusaram o encerramento: Admin conservou um request e Recovery, cinco. A associação `exact-server-request` é histórica; ela não informa se o gerenciador ainda mantém aquele request nem se a sessão continua registrada. Não há correção causal comprovada para essas falhas.

O observador de testes passa a acrescentar duas informações fechadas à primeira fotografia de falha:

| Campo | Valores |
| --- | --- |
| `managerEntry` | `same-request`, `absent`, `other-request`, `unavailable`, `mixed` |
| `sessionRegistered` | `registered`, `removed`, `unavailable`, `mixed` |

As leituras usam identidade em RAM, descritores de dados e as Maps originais do Playwright fixado. Map substituída, entrada incompatível ou accessor resulta em informação indisponível. Os identificadores opacos permanecem em RAM; URLs, headers, credenciais e erros do provider não são publicados.

O contrato aceita o formato histórico exato de quatro campos ou o novo formato exato de seis. O par novo é obrigatório por inteiro. Valores livres, campos extras e getters são recusados. Recovery reutiliza o mesmo contrato; as specs e os wrappers conservam seu percurso original.

Nenhuma dessas observações remove uma pendência ou autoriza limpeza. Permanecem o prazo de 15 segundos, os eventos terminais reais, a primeira falha, a incerteza de escrita e o veto de cleanup. Ausência de uma entrada no gerenciador não comprova EOF. A alteração prepara o diagnóstico da próxima execução própria; não transforma os relatórios históricos em PASS.

Validação: o autor aprovou 59 controles integrados pertinentes, tipos estritos de Admin/Recovery, lint e sintaxe. Após o congelamento final, a raiz leu o diff e executou os sete novos controles, **7/7 aprovados**. Eles cobrem entradas presentes/ausentes/trocadas, sessão removida, getters, agregação, contrato fechado e preservação de falha/uncertainty/cleanup. Não executaram serviços, banco ou suites Auth nativas.
