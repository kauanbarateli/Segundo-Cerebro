# Metas — rollout de novas reservas de imagem

24/10/2026. Fatia local posterior a `799b742`. Implementada e revisada estaticamente pelo Root; execução no CI e homologação pendentes. Flags reais permanecem inalteradas; merge e produção bloqueados.

O servidor exige as strings exatas `FINANCE_GOALS_V1_ENABLED=true` e `FINANCE_GOALS_IMAGES_V1_ENABLED=true` para o POST de reserva com `kind=finance_goal_image`. O controle vem depois da autenticação, conferência de dono, Entitlement Financeiro e validação do corpo, antes do serviço privilegiado, UUID de upload, RPC e emissão de URL. Um campo ou afirmação do navegador não libera o controle. Outros propósitos de imagem conservam seus contratos.

Esta política é conservadora: desligar o rollout recusa tanto uma reserva nova quanto a renovação de URL de uma reserva existente, pois o endpoint atual não distingue essas intenções por autoridade do servidor. Não se inventou um parâmetro de retomada ou prova de metadata. Uma tentativa anterior a PUT pode ficar retida até reabilitar o recurso; o usuário conserva a escolha G0 explícita para revisar sem nova foto, sem apagar ou reclassificar seu envio.

Observação e finalização da tentativa original continuam sob seus próprios controles de Auth, sessão, dono, propósito e Entitlement. Finalizações já alcançadas podem ser resolvidas; não houve alteração de journal, coordinator, SQL, quota, cleanup ou vínculo financeiro. URLs assinadas já emitidas conservam sua validade finita; este rollout não é um mecanismo de revogação de capacidades existentes.

Os testes escritos cobrem as duas flags e valores inválidos; recusa de reserva/renovação antes do serviço; Auth/CSRF/owner/veto com flags ligadas; admissão positiva com os IDs originais; independência dos outros propósitos e da finalização/observação com flags desligadas. Eles não substituem o teste de Storage real nem a revisão do binder do host. Não executar migrations ou ativar flags por build, CI ou deploy.
