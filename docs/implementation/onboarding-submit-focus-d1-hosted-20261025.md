# Onboarding D1 — erro de nome vazio reconferido no Preview

**VALIDADO no recorte conectado:** deployment `dpl_AtGJNc2MU8dZwYHPNx9M9uS7R52J`, READY/targetnull, Source `d1d6c3138987a54670672df50a16ed4df942a135`, árvore `f0c373c2651cc0344c1d4e3d92b6a6e1b972d618`, src `8781d88211366a735b88102e19808da3d11ec690`. Branch de homologação `codex/homologacao-twry-20261022`, projeto Vercel pessoal `prj_68nPrMlzdTLhvhXF2zWvNK6BFaW2`, banco isolado `twrydxsdemaykgvdlpyd`.

A implantação foi selecionada somente para teste, enquanto o CI D1 continuava, conforme autorização de homologação isolada. Main e produção ficaram preservadas. De fe04 para D1 não há delta em Core, adapters, migrations, workflows ou Vercel. Os16 descritores de variáveis (IDs/branch/targets/timestamps) coincidiram integralmente com a seleção fe04; nenhum valor foi decriptado, passado ou alterado. O build do Preview concluiu, mas o [CI D1 falhou em um oráculo de scripts](ci-d1-20261025.md); não aceitar os gates SKIPPED por esse build.

## Percurso observado

Na sessão comum QA já existente, o onboarding retomou salvo na etapa Google. Avançar chegou ao hábito vazio. Ao clicar **Adicionar**, o campo recebeu foco, `aria-invalid=true` e `aria-describedby` ligado à mensagem de nome obrigatório. Nenhum foco corretivo foi imposto pelo teste.

Com o campo focado, Tab moveu ao botão Adicionar; Enter nesse botão retornou ao input, mantendo erro e vínculo acessível. AX e DOM concordaram. Isso reproduz o caso antes falho em fe04 e confirma a correção em D1, tanto por ponteiro quanto por teclado. A composição visual foi preservada.

![Campo de hábito vazio com erro e foco visível](evidence/onboarding-empty-focus-d1-20261025.jpg)

Captura real do viewport, JPEG35.661bytes, SHA-256 `953269d4b7d123ea8730614944adf48c6b7bdc0d925475bbba117ac0a7f0c473`. Sem e-mail, agenda, conteúdo pessoal ou credencial visível; não é captura demo, montagem ou imagem gerada.

Depois do teste, Voltar restaurou a etapa Google com duas conexões e escolhas salvas. Não houve digitação de nova escolha, conclusão de resumo, OAuth, troca de calendário ou comando financeiro nessa reconferência. Não foi feita consulta SQL para afirmar imutabilidade de todas as tabelas; o recorte se limita às ações/estados observados. O rascunho e a sessão foram preservados.

**Limites:** hábito no viewport observado, tema Sistema efetivamente escuro. Não houve reprodução conectada em projeto/tarefa, medida global de contraste, novo aparelho físico ou aceite humano #44. Os três casos E2E escritos continuam aguardando o pipeline chegar à sua etapa. A coorte da branch de homologação D1 é separada e não recebe o resultado de fe04 ou da Root. Merge e produção continuam bloqueados.
