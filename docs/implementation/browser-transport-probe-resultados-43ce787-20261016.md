# Transporte Chromium — observações de 43ce787

O [ensaio manual 38974156428](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38974156428), Node 24.19.0/Playwright 1.63.0/Chromium 153.0.8010.12, terminou success. A [captura original qualificada](evidence/browser-transport-probe-body-drain-native-20261016.json) conserva SHA, tentativa, job, índice original de etapa, intervalos e hashes dos novos arquivos privados. Reader: 21/21 próprios do autor e de Root, lint e peer; duas conferências de metadata antes do claim e outra depois do download. Não reutilizar essa captura nem ler novamente seus arquivos privados.

A alteração da fixture foi somente consumir o corpo do fetch, igualmente no controle e no caso retido, sem aguardar no trigger. O [controle anterior inconclusivo](evidence/browser-transport-probe-first-native-20261016.json) permanece próprio e não identifica retrospectivamente seu recurso pendente.

| Caso isolado | Offline | Observação de comandos Fetch | Eventos originais na decisão | Pendências | Resultado |
| --- | --- | --- | --- | ---: | --- |
| Controle, cinco respostas normais | Não | Sim | 5 finished públicos e CDP | 0 | CONTROL_PASSED em 375 ms |
| Fetch retido | Sim | Sim | Nenhum terminal público/CDP | 1 | REPRODUCED em 15000 ms |
| Quatro scripts retidos | Sim | Sim | 4 failed públicos e CDP | 0 | NOT_REPRODUCED em 163 ms |
| Fetch retido, variante online | Não | Sim | 1 failed público e CDP | 0 | NOT_REPRODUCED em 163 ms |
| Fetch retido, observação de comandos desativada | Sim | Não | Nenhum terminal público/CDP | 1 | REPRODUCED em 15000 ms |

As duas variantes executaram uma vez, depois da primeira reprodução base e sua limpeza. Cada caso usa browser/contexto/servidor próprios. Nos casos reproduzidos, o servidor recebeu uma request, não terminou resposta e fechou seu único socket antes do prazo; o contador do navegador continuou pendente. A decisão ficou congelada antes da limpeza. A resolução posterior de close do contexto/browser não transforma essa pendência em um terminal observado.

A diferença online/offline orienta a investigação da ordem do protocolo; a reprodução persistiu com a observação de comandos Fetch desativada. Cada contraste foi observado uma vez nessa fixture pública. Isso não prova causa de Admin/Recovery, estabilidade geral do produtor ou ausência de escrita incerta no aplicativo. O experimento não inicia Next, Supabase, Vercel ou serviços pessoais e não concede aceite do MVP.

Próxima revisão: conferir onde os runners fazem offline, impedem novos envios, stopLoading, navegação, remoção dos handlers e fechamento da fonte. Remover offline sem outra barreira deixa possibilidade de envio novo; manter a barreira e os eventos originais é obrigatório. Não ampliar autoridade do relay para Auth, substituir EOF por ACK, renovar 15 s ou limpar fixtures por inferência. Uma correção do protocolo exige regressões de corrida e observação própria dos workflows reais.
