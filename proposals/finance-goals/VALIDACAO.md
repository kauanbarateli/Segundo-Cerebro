# #79 — gates da proposta de servidor

**SQL inerte.** Não copiar estes arquivos no SQL Editor nem retirar DRAFT_ONLY para um projeto hospedado. Root só promoverá uma nova migration após revisão, tipos/canal/UI correspondentes e aceite supervisionado. Cada SQL termina com rollback. Nenhum workflow/build/deploy pode instalar o schema.

## Ordem e escopo

Base0d9d92f + Core V2 (930ba6c1), depois candidato B2 byteconferido e os cinco arquivos01–05 de Metas. O catálogo deve comprovar a mesma ordem de lock do financeiro, filtros/eventos v1 preservados e o pin pós-B2 3bc2076d…; divergência aborta. O helper descartável fixa001–025 até reconciliação explícita de026 pela Root.

Compiler/lint/fronteiras/segredos e suites sintéticas serão executados no GitHub no SHA consolidado. O teste canônico compõe SQL real em WASM, sem rede/GoTrue/Storage: não comprova autenticação hospedada, RLS hospedada ou disputa entre duas conexões nativas.

## Matriz mínima já escrita no teste canônico

- Sete comandos reais via Core→store→gateway→SQL; resultados/eventos/recibos vinculados.
- Oito ataques preservando baseline: omitir efeito, omitir evento, evento de outro dono, efeito de outro dono, espécie trocada, ação errada, evento duplicado e aporte coerente porém acima do disponível.
- Ataque de doador: BEFORE/AFTER e evento válidos de outra Meta própria não podem satisfazer uma intenção sobre a Meta alvo. Comparar também os payloads, não somente contagens.
- Grants privados fechados, RLS nas quatro tabelas, seis wrappers somente serviço; usuário estrangeiro não lê detalhe.
- Original de aporte não aceita UPDATE/DELETE; liberação deixa o original idêntico.
- Archive limpa destaque sem liberar valores; restore não redestaca. Replay legítimo funciona depois de archive sem novo commit.
- Conta com reserva não pode passar null→archived_at; após liberar tudo a mesma transição é permitida. Contas já arquivadas permanecem legíveis/liberáveis.
- Falta de prova de imagem recusa vínculo novo; Auth/sessão revogada recusa até replay autenticado anteriormente.

## Gates de SQL/hospedado que ainda faltam

1. Executar a suíte canônica, resolver falhas no código e repetir no SHA final. Conferir que erros de transporte/resultados malformados continuam incertos; não afrouxar asserts ou imprimir dados reais para obter PASS.
2. Provar rollback por falha posterior à mutação, inclusive evento/recibo, e inexistência de efeito/recibo parcial. Conferir comando no-op com apenas recibo sem presumir bump global exatamente1.
3. Atestar catálogo/grants/RLS/Auth no único projeto de homologação autorizado twrydxsdemaykgvdlpyd. Usar somente fixtures descartáveis identificadas e inventário anterior, sem listar conteúdo pessoal ou reaplicar001–025.
4. Corridas NATIVAS em duas conexões, sob barreiras explícitas: aporte+Aporte pelo mesmo disponível; liberações pelo mesmo remanescente; aporte versus gasto real; aporte versus finance.account.close; liberação integral versus close. Resultado precisa corresponder a uma ordem serial legítima com CAS/receipt; jamais exceder disponível/remanescente nem fechar com reserva.
5. Confirmar ordem real finance_project→finance_reserved_balance_guard, projeção de NEW coerente, kind/owner/criação preservados, e lock compartilhado com v1/Series. Não substituir um teste de corrida por Promise.all sobre uma sessão PGlite.
6. Confirmar replay original após alteração de Meta/Conta/imagem, conflito por mesmo clientId com corpo diferente, resultado perdido depois de commit e consulta da MESMA intenção. Nada de novo UUID/dispatch automático para escapar da incerteza.
7. Cobrir limites Unicode/int-safe/datas, total completo com histórico maior que uma página, identidade das refs e mesma finance_revision em todos os agregados. Nenhum limite de transporte autoriza truncar totais.
8. Completar pipeline de imagem de propósito próprio, retenção/export/backup/restore e consumidor UI/mascaramento/mobile antes de aceitar #79 inteira.

As senhas/chaves/valores reais não pertencem à evidência pública. Root conduz transporte operacional, CI e qualquer aplicação supervisionada. Esta proposta não promove produção nem encerra a issue.
