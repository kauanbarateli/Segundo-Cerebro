# Revisão do planejamento

Revisão estática independente das fatias de interface e financeiro/hábitos, em 21/10/2026. Não equivale a execução de produto ou banco.

Achados incorporados no doc03 e tickets:

1. Liberação parcial de reserva requer lançamentos próprios de liberação, limite e idempotência; um timestamp binário de reversão era insuficiente.
2. Fechar conta com reserva ativa precisa guarda e caminho de liberação explícita; não ocultar o dinheiro reservado.
3. Gráfico de competência deve incluir compras ocorridas fora do mês em ponto inicial identificado, preservando data original e total do Núcleo.
4. Vínculos entre Capturas não podem reutilizar IDs no namespace de Páginas. Tradução por origem ou vínculo tipado, com testes de ordem de promoção.

As propostas técnicas nas auditorias são detalhamentos iniciais; o doc03 e os tickets incorporam estes ajustes e prevalecem nas divergências. O mantenedor confirmou reserva virtual e histórico de cadência preservado. As capacidades comerciais já têm tickets próprios; o novo pacote não as duplica.
