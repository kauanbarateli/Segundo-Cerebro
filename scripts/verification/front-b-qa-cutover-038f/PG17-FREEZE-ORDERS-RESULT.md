O [ensaio PG17 isolado](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/41355904643), commit `7215a72bc73529b69ae8c8041dbdabffc8be9dec`, concluiu com oito casos observados e limpeza confirmada.

Nos dois novos cenários com prune real da 028:

- **Ordem inversa:** a execução antiga terminou seu trabalho mantendo a transação aberta; a instalação da barreira ficou comprovadamente aguardando o lock. Após o commit antigo, o corte terminou e a barreira bloqueou a escrita testada.
- **Rollback:** uma execução antiga aguardou enquanto a instalação da barreira estava sem commit. Após o rollback, ela retomou, e a consulta de catálogo confirmou a ausência dos triggers e da função de freeze.

O experimento usa container PG17 sem rede e tabelas sintéticas; o recibo explicita `acceptance=false` e `hostedCertified=false`. Não demonstra a segurança do Supabase hospedado, a ausência de outros caminhos de escrita, a drenagem de cron ou restrição de owners/superusuários. QA e produção não foram modificados.
