# Escopo da observação de retenção

O runner descartável inclui duas corridas para o composto de same-browser fixado por hash. Em ambas, a sessão A mantém o lock de usuário enquanto a sessão B executa `signup_prune` e conclui antes do commit de A. Depois, um novo sweep verifica os efeitos persistidos.

Na renovação, o teste exige preservação da intenção e da tentativa, novo prazo válido e remoção da origem vencida. Na reserva, usa a função real de reserva e simula, dentro da mesma transação, uma fence em fase `uncertain` e o vencimento da intenção. O sweep precisa preservar a fence incerta, o intent e a tentativa, remover todos os campos de origem e confirmar `origin_expired=true`. Não ocorre chamada Auth externa; a mudança para `uncertain` é uma simulação deliberada.

O ensaio **não cobre a ordem inversa**, em que o cleanup obtém o lock antes da renovação ou reserva, nem concorrência com o writer legado `signup_recover_verified_intent`. Também não prova GoTrue, PostgREST, serviços hospedados ou todas as possíveis corridas. A aprovação do runner expressa somente a observação desses casos sintéticos e não autoriza instalação, liberação de cadastro ou deploy.
