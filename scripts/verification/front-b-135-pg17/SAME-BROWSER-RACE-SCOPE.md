# Escopo da observação de retenção

O runner descartável inclui duas corridas para o composto de same-browser fixado por hash. Em ambas, a sessão A mantém o lock de usuário enquanto a sessão B executa `signup_prune` e conclui antes do commit de A. Depois, um novo sweep verifica os efeitos persistidos.

Na renovação, o teste exige preservação da intenção e da tentativa, novo prazo válido e remoção da origem vencida. Na reserva, usa a função real de reserva e simula, dentro da mesma transação, uma fence em fase `uncertain` e o vencimento da intenção. O sweep precisa preservar a fence incerta, o intent e a tentativa, remover todos os campos de origem e confirmar `origin_expired=true`. Não ocorre chamada Auth externa; a mudança para `uncertain` é uma simulação deliberada.

O ensaio **não cobre a ordem inversa**, em que o cleanup obtém o lock antes da renovação ou reserva, nem concorrência com o writer legado `signup_recover_verified_intent`. Também não prova GoTrue, PostgREST, serviços hospedados ou todas as possíveis corridas. A aprovação do runner expressa somente a observação desses casos sintéticos e não autoriza instalação, liberação de cadastro ou deploy.

## Barreira persistente e prune anterior em voo

O sexto cenário fixa por SHA-256 uma cópia integral da quarentena guardada. Num container novo, sem rede e apenas com tmpfs, extrai em memória somente a definição da barreira e sua verificação de catálogo; os guards do arquivo de origem continuam intactos e o recorte não é destinado a ambiente hospedado. A sessão A segura os locks das tabelas da aplicação. A sessão B inicia o `signup_prune` antigo real; o observador precisa ver B bloqueada no lock de `signup_intents` antes de A instalar a barreira e a composição candidata. Após o commit, a chamada antiga precisa receber exatamente a exceção de freeze; o ensaio também exige rejeição de seis comandos sintéticos INSERT/UPDATE/DELETE nas duas tabelas e ausência de linhas. A checagem da barreira confirma ainda o tipo/estado dos triggers, incluindo o evento TRUNCATE.

Este cenário observa apenas a ordem indicada. Não demonstra drenagem de jobs, acesso de owner/superusuário a DDL, ordens inversas, writers que não tocam as duas tabelas, GoTrue, SMTP ou o plano de controle hospedado. A trava não substitui coordenação externa, não autoriza remover guards nem instalar a proposta no QA. O resultado de cada execução fica vinculado ao SHA do runner e não certifica outras versões.
