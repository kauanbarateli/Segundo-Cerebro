# Observação do encerramento do snapshot de restore

Base: `f99bef348cbd0fff55a3bba9da90ac8e077577f5`. Esta alteração aplica a proposta pública V2 revisada: cinco marcas booleanas registram o progresso das promessas originais de encerramento, somente no diagnóstico de falha **v3**. Elas distinguem linha final recebida, callback de escrita concluído, tentativa e aprovação do parser de ACK e conclusão original do processo. Nenhuma marca concede autoridade ou modifica a decisão de sucesso.

O sucesso **v1** permanece sem campos adicionais. Continuam obrigatórios o ACK validado, os EOFs pareados e os terminais originais; os limites de 45/90 segundos, a ordem do `Promise.all`, o protocolo e os critérios de baseline não mudam. A recusa observada na inspeção V5 permanece preservada: esta telemetria não demonstra sua causa nem resolve o orçamento restante.

O leitor operacional V5 aceita somente falha v2 e deve recusar v3. Não foram atualizados preparadores, pins operacionais, leitor ou runner privado. Uma futura observação exige revisão própria do novo SHA, do leitor e dos preparadores correspondentes. Este pacote não autoriza operação, nova inspeção, retry, target-only, backup, mint ou restore.

Implementado: adapter público, controles sintéticos de encerramento e bloqueio de deploy da branch `codex/restore-end-progress-20261023`; os bloqueios anteriores estão preservados. Validação local: os dois arquivos de teste puros passaram, com 43 testes, em Node 24.19.0 e heap de 192 MiB. O lint e a verificação de assinaturas de segredos são registrados no recibo da entrega. CI próprio, revisão final e qualquer aceite operacional permanecem pendentes. Não houve conexão com banco, leitura privada ou execução de PostgreSQL nesta entrega.
