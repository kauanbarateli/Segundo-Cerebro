# Handoff de retomada — MVP e doc18 — 28/10/2026

A demanda foi pausada a pedido do mantenedor. A próxima frente deve concluir os aceites pendentes e só propor liberação depois da revisão completa. **Merge e deploy de produção permanecem bloqueados.** Restore é pós-lançamento; checkout Asaas e nova lógica de Drive estão fora deste recorte.

## Fontes e estado

- PR em rascunho: [#120](https://github.com/kauanbarateli/Segundo-Cerebro/pull/120), branch `codex/mvp-goals-terminal-20261023`. Antes de qualquer ação, conferir SHA remoto, checks, diferença e eventuais alterações posteriores; os SHAs deste documento são referências históricas, não garantias do estado atual.
- Último produto conectado validado: `c6ebf21207d48c605cc7417db4377d9922b1f890`; Preview isolado na branch `codex/homologacao-twry-20261022`, projeto pessoal Supabase `twrydxsdemaykgvdlpyd`. O HEAD `2169354099a8ea057690479d35983fab1f84c4c6` acrescentou somente documentação/recibos.
- Em 27/10, o CI próprio de 216 concluiu 23 workflows; Doc18 teve 425 PASS e os dois CIs gerais 612 E2Es PASS cada. [CI Doc18](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40483915397), [push](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40483915392), [PR](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40483917820). Qualquer novo SHA exige seus próprios checks.
- Leia [AGENTS.md](../../AGENTS.md), [doc18](../planejamento/18-convergencia-prototipo-20261025/README.md), [aceites conectados](aceites-conectados-doc18-20261027.md), [handoff anterior](handoff-retomada-20261025-pausa-mvp.md), [checkpoint #81](https://github.com/kauanbarateli/Segundo-Cerebro/issues/81#issuecomment-6439515233) e [checkpoint #63](https://github.com/kauanbarateli/Segundo-Cerebro/issues/63#issuecomment-6439518535). Verifique as demais issues vinculadas à PR e seus comentários atuais antes de modificar seu estado.
- Protótipo do doc17/doc18 é a autoridade visual, preservando segurança, acessibilidade e regras de domínio. O código e os recibos demonstram escopos específicos, não aceitação visual integral.

## Informação nova do responsável

Em 28/10 o responsável informou que **criou o Cofre de homologação e dois itens fictícios**. Isso é uma informação do responsável, ainda não uma validação independente do ciclo do Cofre. Não solicitar, ler, registrar ou fotografar senha mestra, metades do kit ou conteúdo dos itens. A mensagem anterior “Kit: baixe as duas metades antes de continuar” era a guarda anterior à prova; o código registra os cliques dos dois downloads na preparação atual e exige selecionar e provar os arquivos. A UI não identifica individualmente os downloads; eventual ajuste deve manter a prova e as proteções, com testes apropriados.

## Ordem de retomada

1. Conferir a PR, SHA, CI, Preview e as issues #81, #80, #62–65, #122–126 e #44. Leia os registros antes de repetir testes. Marcar separadamente implementado, validado, pendente e bloqueado; não fechar por CI verde apenas.
2. Com a conta comum de QA preparada, validar o Cofre conectado usando somente itens fictícios: abrir/bloquear, revelar/ocultar, troca de item e perda de foco/visibilidade, persistência e estados negativos pertinentes, sem acessar ou divulgar segredos. Não criar, excluir ou alterar itens sem necessidade; registrar exatamente o que foi observado e o SHA/deployment.
3. Concluir Main HTTP de onboarding: o preparo e cinco testes **puros** passaram (38+87+15 asserções, codec e sete verificações do oracle); não houve operador, HTTP, SQL, SSO ou aceite hospedado. A matriz de 64 passos, cadência v2 e recuperação parcial continuam pendentes. Revalidar contrato, identidade, fonte, janela e permissões antes de operar; não transformar a proposta inerte em execução automática.
4. Conferir autenticação e autorização da conexão pessoal de homologação. Na última tentativa a integração recusava acesso; houve novo link OAuth, mas não há confirmação de sucesso nesta entrega. Não usar VOE, BlackSheep, produção ou outra organização para contornar o bloqueio. Retenção hospedada exige comprovar metadados, execução autônoma e critérios da issue; testes puros não provam retenção de 720h.
5. Completar estados adversos, rede/permissões, zoom nativo, responsividade e testes em aparelhos conforme #44 e doc18. PWA instalado em iPhone 11 e A35 e sincronização do tema foram relatados pelo responsável em escopo limitado. Não atribuir à captura recortada uma certificação de largura completa.
6. Conferir compatibilidade e inventário de migrations/callbacks antes do corte. O responsável adiou o recadastro das duas variáveis Google em Production até terminar testes; confirmar os nomes e o destino sem revelar valores. Build/CI/deploy nunca aplicam migrations; não reaplicar histórico, resetar ou inserir seeds.
7. Revisar evidências e critérios de todas as issues relevantes, registrar o resultado por SHA e canal e somente então propor o procedimento de release. Não promover Preview automaticamente. Manter o histórico de falhas e os limites dos testes.

## Operação e materiais

A máquina tem 8 GB de RAM. Execute verificações locais leves em série; prefira GitHub Actions para testes pesados. Não encerre processos alheios. Use conta GitHub pessoal `kauanbarateli` e chave SSH exclusiva do projeto, sem alterar configuração ou chaves do VOE; commits e issues sem coautoria.

Os arquivos rastreados na PR, recibos sanitizados e links acima são a fonte portátil. Há materiais locais ignorados de preparo/teste sob `work/doc18-20261027/` que podem incluir perfis, evidências privadas ou configurações locais: **não publicar pastas inteiras**, credenciais, kits, arquivos baixados, dados pessoais ou variáveis. Recriar os preparos necessários a partir dos contratos e documentação rastreada; qualificar e sanitizar individualmente qualquer evidência adicional antes de publicar.

O trabalho desta frente está pausado. Atualizações posteriores devem substituir este estado por evidência própria e preservar os bloqueios até o aceite.
