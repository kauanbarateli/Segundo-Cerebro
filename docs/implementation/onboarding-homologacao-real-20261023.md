# Onboarding: validação real na homologação de 23/10/2026

## Candidato e limites

**OBSERVADO:** Preview `dpl_xn4hwcgox8KR6abZ91N54AusW8QG`, SHA `85b9712491e8e23fbba85a0504f71d2a13f4e768`, projeto pessoal isolado `twrydxsdemaykgvdlpyd`, migrations 001–026. O mantenedor criou uma conta comum descartável, confirmou o e-mail e realizou o login no navegador do Codex. Nenhuma credencial foi recebida ou inserida pelo agente.

A execução abaixo usa conteúdo fictício. Identificador do ator, e-mail, cookies, dados Google e credenciais não integram este registro. Ele não autoriza merge, deploy de produção, abertura comercial ou restore.

## Percurso aprovado

As nove telas foram percorridas: boas-vindas, nome e foco facultativo, agenda, hábito, projeto, tarefa, notas, outros espaços e resumo. Google foi pulado neste primeiro percurso.

O teste preparou um hábito, um projeto com contexto Pessoal, uma tarefa explicitamente vinculada ao projeto e um caderno com uma página e vínculo explícito ao projeto. O perfil recebeu nome fictício e foco Vida pessoal. Financeiro, Cofre e Arquivos permaneceram informativos, sem solicitar segredos ou criar registros nesses módulos.

Após preparar o hábito, “Fazer depois” retornou à Home sem criar o hábito. A reentrada e a recarga integral preservaram a etapa e o rascunho. A confirmação final apresentou sete escolhas confirmadas. Nova recarga e reabertura mantiveram a conclusão sem repetir os registros.

A Home passou a apresentar o hábito, o projeto e a tarefa preparados. No detalhe do projeto, a tarefa e a nota relacionadas estavam presentes; o contexto Pessoal estava salvo. No editor de Conhecimento, a página, o texto fictício e a relação com o projeto foram recuperados. Em Configurações, o foco Vida pessoal estava salvo.

## Conferência de persistência

Uma transação somente leitura, terminada com rollback, usou o projeto criado pela interface para delimitar exatamente o ator testado. Retornou somente contagens e booleanos:

| Verificação | Resultado |
| --- | --- |
| Ator vinculado, papel comum, nome e foco esperados | Aprovados |
| Hábitos, projetos e tarefas | Um de cada |
| Tarefa vinculada ao projeto preparado | Uma |
| Cadernos e páginas | Um de cada |
| Página no caderno do ator e vínculo explícito com projeto | Um de cada |
| Contexto esperado no projeto | Aprovado |
| Rodadas concluídas com rascunho limpo | Uma |
| Intenções ativas / confirmadas | Sete / sete |

Este é o estado conferido depois do primeiro percurso e antes da abertura da segunda rodada. A consulta privilegiada confirma persistência e delimitação do teste; **não substitui** os testes de RLS entre usuários.

A escolha explícita de iniciar outra rodada abriu um rascunho vazio, sem herdar as escolhas concluídas. A etapa Google dessa segunda rodada foi deixada para autorização humana; a conclusão sem novas criações ainda depende dessa conferência.

## Evidência e pendências

O recibo público de trabalho é `onboarding-connected-browser-85b9712-20261023.json`; as capturas apresentam somente o percurso e os registros fictícios. A atualização pública está na [PR #105](https://github.com/kauanbarateli/Segundo-Cerebro/pull/105#issuecomment-6373998946).

O CI próprio de 85b9712 concluiu 18 execuções originais aprovadas. Esse resultado não é herdado por candidatos posteriores.

Permanecem separados: sucesso/recusa/retomada OAuth, conclusão da rodada sem novas criações, falhas parciais e concorrência entre sessões, aceite visual completo de temas/teclado/movimento reduzido e aparelhos reais. As capturas do navegador não provam aceite em dispositivo físico. As credenciais Google de Production serão recompostas pelo mantenedor após os testes; nenhum deploy de produção está liberado.

