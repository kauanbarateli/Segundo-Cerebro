# Agendamento da manutenção

Destino: projeto Vercel `segundo-cerebro-of`, organização pessoal e Supabase `rishenjoikgmfubmnfiu`. Os arquivos deste guia não ativam jobs. A ativação e a execução remota permanecem pendentes no modo manual da OP-012. Não usar BlackSheep/VOE.

## Limpeza de arquivos

`/api/files/cleanup` aceita GET e POST com o mesmo guard, antes de configurar o cliente privilegiado. `CRON_SECRET` exige pelo menos 32 bytes; o header deve ser exatamente `Authorization: Bearer <segredo>`, limitado a 1.024 caracteres. Sem segredo válido, nenhum candidato ou objeto é processado. Respostas não são cacheadas; sucesso retorna somente `removed`/`failed`. Falha parcial retorna HTTP 503 com as contagens, sem detalhes do provedor.

O [cron nativo Vercel](https://vercel.com/docs/cron-jobs) usa GET no deployment Production, com horário UTC. A Vercel envia automaticamente o `CRON_SECRET` no [header de autorização](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs); não se põe chave na URL. O User-Agent e o header de agenda não substituem esse segredo.

O [exemplo de configuração](examples/vercel-cleanup.json) fica em docs, fora da configuração ativa. **RECOMENDADO:** execução diária às 06:00 UTC, correspondente a 03:00 em Fortaleza. O [plano Hobby](https://vercel.com/docs/cron-jobs/usage-and-pricing) admite cadência diária e pode invocar dentro da hora; não promete minuto exato.

Antes de ativar:

1. Conferir o catálogo, as migrations aplicadas e as policies dos buckets pessoais. A correção de ordem dos lotes exige a migration 015, `20261009231338_file_cleanup_fairness.sql`, para aplicação manual após 014; não reaplicar 001–014. O [relatório da correção](../implementation/cleanup-fairness.md) registra os testes e os limites. Asserções com fixtures são somente para base dedicada vazia.
2. Cadastrar `CRON_SECRET` exclusivo em Production, diferente das chaves Auth/Admin/Supabase/Google. Os valores ficam somente na configuração privada, nunca em chat, Git, argumentos ou logs.
3. Revisar o exemplo e incorporar sua entrada `crons` à configuração do projeto; não substituir configurações preexistentes. O próximo deployment registra o agendamento.
4. Observar uma execução autorizada, seu status e as contagens; conferir reconciliação e proteção de vínculos/quota no ambiente de teste dedicado.

A Vercel [não repete automaticamente uma falha e pode entregar execuções duplicadas ou perdidas](https://vercel.com/docs/cron-jobs/manage-cron-jobs#cron-job-error-handling). Preservar a reconciliação do banco e observar as contagens; HTTP 503 não comprova retry. A disputa entre limpeza e vínculo precisa de teste com conexões sobrepostas. Se o tempo exceder a função, interromper a ativação e revisar a unidade de trabalho; não simular durabilidade com chamadas encadeadas.

A seleção da 015 ordena pela primeira expiração ou pelo último ACK mais um dia. Um ACK bem-sucedido permite avançar outros candidatos; remoções que falham permanentemente continuam sem confirmação e podem ocupar o lote. Contagens de falha exigem investigação, não certificam progresso por si mesmas.

## Calendário Google

`/api/cron/google-calendar` já aceita GET/POST, mas exige `GOOGLE_CALENDAR_CRON_SECRET`, próprio do Calendário. O header automático da Vercel usa `CRON_SECRET`; cadastrar a rota diretamente no cron nativo com os segredos distintos não satisfaz seu guard. Não igualar segredos para contornar essa diferença. O exemplo deste guia agenda somente a limpeza.

Enquanto não houver um adapter nativo específico, configurar um scheduler capaz de fornecer o header próprio, após cadastrar o cliente OAuth e conferir a capacidade. A implementação limita a seleção a 200 contas e processa cada uma sequencialmente; essa contagem não é prova de que a execução cabe no hosting. Timeout pode deixar claim `running`; nunca a expirar/liberar automaticamente ou iniciar concorrente com a mesma identificação. Seguir [recuperação operacional](../implementation/t025-calendario-google.md#recuperação-operacional) somente após provar que todas as chamadas anteriores terminaram.

## Backup

Backup/restauração usam o [operador privado](backup-restore-release.md), com PostgreSQL nativo, quiescência, destino externo privado e perfil/chave próprios. Um cron HTTP na Vercel não fornece esses pré-requisitos e não certifica o backup agendado. Preservar o procedimento e o aceite real de restore/Cofre.
