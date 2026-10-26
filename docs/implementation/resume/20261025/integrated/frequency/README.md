# Frequência completa do onboarding — proposta externa V1

Escopo #63/#80, Source-base3403, sem reabrir #76. Nove paths: seis de produto, um puro novo e append de casos nos E2E/SQL canônico. Os oito before são objetos Git3403; os dois testes anteriores permanecem prefixos byte exatos (60359 e10694 bytes). Root atual tem os mesmos oito conteúdos após normalizaçãoLF. Nenhuma aplicação Root, Node, browser, banco, API ou credencial nesta autoria.

## Implementado

Escolha JSON v2 explícita: daily / weekdays / weekly_target1–7. O legado daily/three_per_week sem version continua aceito e não recebe upgrade na leitura nem na edição somente do nome. O decoder é fechado para draft/replacement; versão desconhecida, extras, campos incompatíveis e getters são recusados. Dias[] é estado parcial persistível; Add/confirm/replacement exigem pelo menos um dia.

O planner gera habit.create já existente. Novo controle confere literalmente corpo/choice/clientId legados. Nenhuma marcação, mudança de data ou novo slot. Etapa e recuperação compartilham o seletor; dias têm rótulo/estado/check visual, teclado e foco de erro. Field16px e alvos52px vêm dos estilos existentes. O resumo mostra a frequência. Autosave comum não move foco.

Snapshot/wire/round schema1, comandos, resultado desconhecido, CAS, geração, locks, eventos/recibos, ACLs e migrations permanecem semdelta. Não há SQL de produção ou DDL novo.

## Testes escritos, não executados

O puro chama decoder/planner/service reais: formatosv2, legado exato, versão desconhecida, dias/meta inválidos, extras/getters/esparsos, parcial antes da confirmação, replacement e no-save no erro.

E2E com componentes reais e HTTP sintético:320claro/390escuro, dias/meta7, foco ativado pelo botão+Enter, autosave/reload/resumo sem criação, edição legada sem upgrade, recuperação e DTO de versão desconhecida entregue sem o próprio fixture o decodificar antes.

O caso SQL usa helper canônico descartável e adapter/Core/wrapper reais, guarda fetch sem rede e três hábitos (diasv2/meta7v2/legacy3); exige schema1, shape legado, payloads/eventos/recibos, zero marcas, replay e zero permits. Não prova GoTrue, OAuth, sessões PG sobrepostas ou serviço hospedado. O teste original1 continua inteiro antes do append.

## Checks e limites

Apply --check/whitespace PASS; oito before, nove after e16 suportes pinados. Nenhuma sintaxe, typecheck, lint ou suite runtime foi executada nesta autoria. Root/peer devem revisar e executar os checks apropriados; suites pesadas ficam no GitHub. Source3403 verde não é execução desta proposta.

G4 OAuth terá pacote separado. MainHTTP continua Source3403 e não herda produto novo sem revisão. Landing está com Root. Restore foi adiado pelo mantenedor para pós-lançamento e não é gate deste lote; não integra o patch.
