# Reserva durável para finalização de cadastro — proposta não integrada

Este material é um rascunho para revisão, não é migration nem autorização de uso em QA ou produção. `candidate.mjs` implementa somente a orquestração com portas injetadas; `candidate.test.mjs` usa memória e respostas sintéticas, sem conectar a Supabase, GoTrue ou banco. O contrato SQL em `sql-contract.sql.txt` contém apenas comentários; a candidata separada possui um guard que aborta antes do DDL. O modelo `consent-model.mjs` explicita o snapshot mínimo de consentimento e ainda não está integrado à orquestração demonstrativa.

## Problema e garantia pretendida

Duas requisições podem ler a mesma intenção de cadastro como disponível e iniciar alterações de senha concorrentes. Um lock em JavaScript não coordena processos ou instâncias serverless. Propõe-se uma reserva persistente, exclusiva por identidade, adquirida antes da primeira chamada externa e mantida também quando o resultado for incerto. Nenhuma segunda requisição pode chamar Auth enquanto a reserva existir. O sucesso só deve ser declarado após a admissão efetivamente concluída.

Essa garantia depende de implementação atômica no banco, de todas as rotas obedecerem ao contrato e de um corte controlado das rotas antigas. As portas em memória demonstram a lógica pretendida, não comprovam atomicidade, isolamento, durabilidade ou comportamento real do Auth.

## Estados e transições

| Estado durável | Significado | Próxima ação permitida |
| --- | --- | --- |
| `reserved` | Identidade e intenção verificadas; reserva única criada. | Um único avanço atômico para `auth_in_flight`. |
| `auth_in_flight` | Autorização de chamada externa confirmada no banco; chamada pode estar em curso, ter ocorrido ou não ter começado. | Registrar resposta comprovada ou manter bloqueio e investigar. |
| `uncertain` | Chamada pode ter ocorrido e não há prova suficiente do resultado. | Somente reconciliação operacional explicitamente desenhada. |
| `password_acknowledged` | Resposta de sucesso e vínculo de identidade foram verificados e registrados. | Prosseguir apenas com operações de banco de dados, sem chamar Auth outra vez. |
| `complete` | A admissão foi concluída. | Uma futura consulta/repetição idempotente da resposta, sem chamar Auth. |

Não há expiração que reabra a reserva. Se a gravação de `uncertain` falhar, `auth_in_flight` continua bloqueando. Uma resposta perdida ao passar de `reserved` para `auth_in_flight` impede a chamada externa: o servidor só chama Auth quando recebe confirmação inequívoca do avanço. Uma resposta perdida após o commit deixa o usuário em estado pendente, deliberadamente. A demonstração retorna `unavailable` para erro no início da reserva; a camada HTTP real deve tratar a possibilidade de commit incerto como pendência, mesmo nessa situação. A demonstração atual **não implementa retomada nem consulta idempotente**: qualquer reserva preexistente, inclusive `password_acknowledged` ou `complete`, retorna pendência. As operações exclusivas de banco para retomada e consulta são requisitos futuros, não comportamento comprovado.

## Consentimento vinculado à reserva

No mesmo commit que cria a reserva, preservar os mínimos necessários: versão dos termos, versão da política de privacidade e escolha efetiva sobre a origem, inclusive sua versão de consentimento quando aceita, sempre vinculados à intenção e à identidade verificadas. Se a origem for recusada ou o aceite não for explícito, descartá-la transacionalmente antes de Auth, respeitando o contrato atual. Não copiar valores de UTM para a tabela de reserva. Na retomada, nunca substituir a escolha salva por valores de outra requisição nem presumir aceite; se uma versão legal vigente ou a versão de consentimento de origem aceita mudar, interromper a decisão afetada e obter ciência conforme um fluxo seguro antes de admitir. A retirada continua prevalecendo independentemente da versão de origem.

Uma retirada posterior deve prevalecer mesmo sobre uma escolha previamente afirmativa: sob o lock da identidade, registrar retirada monotônica e apagar a origem pendente, ou definir mecanismo equivalente transacional. Finalização concorrente não pode recriar a origem depois da retirada confirmada; testar ambos os ordenamentos e garantir a retirada também após admissão. A política exata para um pedido concorrente que recusa origem enquanto outra requisição está em voo deve integrar essa regra, sem permitir que a tentativa perdedora volte a mudar a senha. O modelo puro demonstra apenas as decisões, não prova transações nem tratamento de solicitações concorrentes reais.

## Contrato das portas e API

1. `reserve(requestId)` representa RPC privilegiada transacional, não uma mera consulta: valida a identidade e sessão verificadas no servidor, intenção vinculada, coorte, moderação, configuração de cadastro e consentimentos atuais; bloqueia e cria a reserva única. Não concede controle da identidade ao cliente. Apenas a criação efetiva devolve `acquired` com `requestId` e `generation`; conflito, inclusive repetição do mesmo request, devolve bloqueio. O request ID não é credencial.
2. `markAuthStarting(fence)` muda **uma única vez** `reserved` para `auth_in_flight`, comparando usuário, intenção, sessão, request e geração e revalidando o necessário. Somente a transição nova devolve autorização para chamar Auth após o commit confirmado; repetição, resposta perdida ou erro nunca concedem autorização. O identificador de geração faz fencing das operações de banco, mas não interrompe chamada ao GoTrue já iniciada.
3. `updatePassword(password)` é a chamada externa única. Senha, tokens, cookies, OTP e seus derivados não são persistidos na reserva, logados ou enviados ao cliente de métricas. Exceção, timeout, resultado desconhecido e rejeição sem prova de ausência de efeito são tratados como incertos.
4. Uma confirmação suficiente de sucesso e o vínculo de identidade devem ser verificados conforme o comportamento real do provedor; `markPasswordAcknowledged(fence)` registra o resultado somente na geração em curso. Se o provedor rotacionar a sessão, é preciso desenhar e validar uma transição segura específica, não aceitar um identificador fornecido arbitrariamente. Falha de verificação não autoriza repetir a alteração da senha.
5. `finishAdmission(fence)` deve exigir a reserva reconhecida e executar a admissão e o registro `complete` na mesma transação, com os mesmos controles de consentimento e moderação; reexecuções comprovadamente seguras só consultam ou retomam operações de banco, nunca Auth. A API pode responder pendência sem expor existência de conta; sucesso apenas depois de `complete`.

A implementação real deve tornar inacessíveis ou adaptar todas as RPCs e rotas antigas de atestação/finalização para impedir desvio da reserva, preservando controle de Admin e permissões. Somente service role ou função interna estritamente concedida pode operar a reserva. As verificações de identidade não podem confiar em parâmetros fornecidos pelo cliente; `auth.uid()` não deve ser presumido válido em chamadas com service role.

## Incerteza, operação e corte

Sem uma propriedade de idempotência ou fencing comprovada no GoTrue, não há como inferir com segurança que uma chamada vencida por timeout não terminará depois. Não reabrir por TTL, clique de usuário, reinício de processo, falha de escrita ou consulta isolada de estado. Uma recuperação deverá ser especificada e auditada separadamente, exigindo evidência de que a chamada anterior terminou sem efeito e não poderá produzir efeito tardio, ou mecanismo equivalente comprovado do provedor. Se a evidência não existir, manter bloqueio e encaminhar para suporte: não há solução automática presumida.

No corte para a nova versão, identificar e drenar chamadas antigas já iniciadas, impedir novas chamadas pelo caminho antigo e verificar todas as instâncias/versões antes de liberar a nova entrada. A reserva nova não controla chamadas externas que já estavam em andamento. Também é necessário definir política segura para exclusão de conta, intenção e sessão: exclusões em cascata não podem apagar uma reserva em voo e liberar outra chamada; retenção, privacidade e eventual exclusão exigem desenho próprio. Não registrar informação sensível como evidência operacional.

## Validação ainda necessária

- Revisar SQL, privilégios, RLS, ordem de locks, integridade referencial e compatibilidade com as migrations e funções atuais, incluindo PT409; não aplicar a proposta como está.
- Testar concorrentemente em PostgreSQL descartável e depois em QA autorizado, com processos independentes e injeção de falhas antes/depois de commits, incluindo respostas perdidas e bypass pelas funções antigas.
- Validar contra Auth real e documentação/configuração efetiva os efeitos de alteração de senha, timeouts, alteração/rotação de sessão e o significado de cada resposta; nenhuma propriedade de GoTrue é assumida aqui.
- Avaliar cenários de moderação simultânea, revogação de sessão, conta legada, consentimento alterado, exclusão e bloqueio de cadastro. Definir resposta e recuperação operacional sem liberar resultados incertos.

Teste puramente local: `node --test candidate.test.mjs consent-model.test.mjs`. Os fixtures serializam a reserva em memória e não substituem os testes transacionais ou E2E.
