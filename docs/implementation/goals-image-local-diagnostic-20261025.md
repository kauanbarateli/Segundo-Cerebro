# Diagnóstico local da imagem de Metas — 25/10/2026

O teste real do Preview D1 selecionou o PNG público da marca, mostrou a prévia e falhou ao revisar a nova meta QA. A tentativa original foi preservada. Consultar o envio limpou o alerta, mas não indicava a fase registrada. Não houve confirmação financeira. A causa original, a presença de bytes no Storage e a conclusão do arquivo permanecem desconhecidas.

A atualização acrescenta uma mensagem sobre a fase local e detalhes técnicos recolhidos: estado, fase, último código e etapa dessa falha. A mensagem principal continua genérica. A consulta lê somente o registro local existente: não reserva, reenvia, finaliza, substitui ou cancela arquivos, nem confirma uma meta. Erros anteriores à instrumentação permanecem UNKNOWN.

O diagnóstico aceita apenas códigos enumerados de classes nominais e descritores de dados. Um WeakMap preserva somente o código antes do encapsulamento, sem guardar ou mostrar causa, mensagem, URL, token, identificadores ou conteúdo do provedor. O guard de identidade precede a atualização do snapshot; se a leitura local falhar, a fase fica desconhecida. Nenhum guard, prazo, journal, rota, SQL, política ou regra financeira foi alterado.

Root e um revisor independente aprovaram a V2; a V1 foi recusada porque a mensagem principal podia usar uma falha histórica como causa de um erro atual. Oito controles puros próprios sobre os corpos reais dos mappers/classes e do encapsulamento passaram em Node 24.19.0, com zero leituras de getters; seis arquivos passaram na análise de sintaxe TypeScript 5.9.3. Esse recorte não executou coordenador, React, SDK, navegador ou serviços. Os seis novos testes Vitest e os dois E2E de falha/consulta exigem execução no GitHub.

O layout, os tokens, o foco do alerta e os controles existentes são preservados. Os detalhes usam o disclosure nativo já existente e começam fechados. Depois do build e revisão, conferir no Preview isolado a mesma tentativa: primeiro consultar o registro local; qualquer retomada mantém arquivo e identidade originais. Não usar uma ausência de mensagem ou um código desconhecido como autorização de novo envio ou limpeza.

Homologação exclusiva: `twrydxsdemaykgvdlpyd`. Merge e deploy de produção permanecem bloqueados. [Estado do MVP](mvp-status-atual-20261025.md).

