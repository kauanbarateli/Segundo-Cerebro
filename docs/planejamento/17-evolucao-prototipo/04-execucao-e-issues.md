# Execução, issues e dependências

Os números publicados e links estão em [tickets/README.md](tickets/README.md). Cada ticket tem escopo, arquivos de entrada, dependências, aceite e validação. São fatias de implementação; este PR documental não as conclui.

| Ordem | Lote | Entrega | Dependências |
|---|---|---|---|
| 0 | Reconciliação | Registrar WIP/HEAD da frente, testes #52/#53, reconsultar main/PRs, confrontar migrations e contratos | Antes de qualquer edição |
| 1 | E1 / T-047 | Infra de imagens privadas, avatar superior, fundo do Início e capas de Projetos | Base atual; alinhar novas superfícies com #53 |
| 1 | E2 / T-048 | Lista/Kanban usando mesmas tarefas e comandos | Independente de E1 |
| 1 | E3 / T-049 | Lista lateral de calendário e participantes | Google readonly existente; não depende de fotos reais |
| 1 | E4 / T-050 | Captura formatada e promoção integral para Conhecimento | Contrato de documento/revisão e migração compatível |
| 2 | E5 / T-051 | Hábitos com imagens, vigências e desempenho; Pequenos hábitos | E1 para imagens; ADR 0012 |
| 1–2 | E6 / T-052 | Painel/lançamentos/cartões e compatibilidade financeira | Pode avançar independente de metas, usando estado vazio |
| 2 | E7 / T-053 | Limites e recorrências finitas administráveis | E6 na integração de UI; regras podem avançar antes |
| 2 | E8 / T-054 | Metas com imagens e reservas virtuais | E1, E6, ADR 0011 |
| 2–3 | E9 / T-055 | Convergência landing/checkout/legais/onboarding | E2/E3/E4/E5 para imagens/referências finais; #52/#62–65 para integração |
| 3 | E10 / T-056 | Aceite cruzado e retomada de testes | E1–E9; depende dos contratos comerciais para fechar jornada real |

Não confundir ordem de desenho com disponibilidade real: E9 pode construir componentes e estados sobre contratos enquanto #54–#65 ainda estão bloqueadas, mas não pode declarar checkout/onboarding conectado concluído. O épico novo consolida o delta visual/funcional; SPEC-07 continua responsável pela cobrança e orquestração comercial.

## Reaproveitamento do tracker

- **#52 e #53:** preservar WIP e testes em andamento; novo layout não autoriza recriar essas bases. Incorporar as novas rotas/comandos de mídia, hábitos, metas e editor na matriz negativa de acesso de #53.
- **#54–#61:** pagamentos, renovação, cancelamento, reembolso, isenção e atribuição continuam nos tickets existentes; nenhum duplicado neste pacote.
- **#62–#65:** implementação real das nove etapas. E5 fornece cadência; E1 fornece personalização quando aplicável; E4 preserva o documento de notas. Não criar segundo sistema de onboarding.
- **#66/#67:** incluir novos dados na retenção/restore e operação existentes.
- **#44:** aceite visual global continua aberto. E10 produz evidência do delta para ele, sem reivindicar aceites externos que não executou.
- **#68:** fechamento comercial completo continua condicionado às próprias dependências; layout aprovado não substitui homologação Asaas, e-mail, ativação ou acesso.
- **#12/#35/#41–#43/#36:** preservar pendências próprias; não ampliar este plano para recomeçar restore/Auth/limpeza ou manutenção incidental.
- **#46 fechada / PR #48 merged:** fundação reaproveitada, sem reabrir como se a entrega anterior não existisse.

## Divisão segura entre frentes

Raiz coordena contratos, migrations, tipos, navegação, CI e revisão. Delegar módulos independentes com propriedade explícita de arquivos; não editar `contracts/modules.ts`, allowlists, snapshots, tokens ou migrations simultaneamente. Migrations recebem IDs após reconciliação, não números rígidos previstos neste planejamento. Uma integração por vez, acompanhada de review de domínio e UI.

Antes de cada fatia: ler ticket e aceites, inspecionar estado efetivo, listar o que já está implementado. Depois: diff revisado, testes proporcionais, capturas por estado e registro `implementado / validado / pendente / bloqueado`. Se o teste exige integração externa, registrar a prova correspondente; não reutilizar resultado do protótipo como validação do produto.

## RAM, testes #52/#53 e deploy

Após aplicar os deltas e seus checks, retomar do checkpoint das issues #52/#53. Medir novamente: `(Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory * 1KB`; comparar com `1GB` do PowerShell, limiar conservador (1 GiB). Registrar horário/valor. Se houver pelo menos esse volume livre, continuar testes com **um processo pesado por vez e um worker**, no Node 24 do projeto. Descobrir scripts/arquivos reais do WIP, sem inventar nomes de testes novos. Não executar toda suíte em paralelo por haver Vercel Pro.

Se faltar RAM, não iniciar teste pesado nem encerrar processos alheios. Encerrar apenas os próprios ociosos, continuar revisão/documentação e reavaliar. Um teste interrompido por memória permanece não validado.

**Evitar dependência circular:** retomar #52/#53 após implementar os deltas disponíveis, antes de exigir o fechamento conectado de E9/E10. #54 depende desses testes, e a jornada final depende de #54. Componentes/estados de E9 podem estar prontos com integração comercial pendente; não esperar essa homologação para retomar os testes que a desbloqueiam. Depois, concluir integração e aceites restantes.

O mantenedor informou Vercel Pro: o impedimento histórico por Hobby deixa de valer. Na implementação, conferir time/projeto/variáveis/destino e executar os checks necessários antes de deploy; não reativar a proibição antiga nem dispensar segurança/CI. Integração de schema segue OP-009, nunca por build/deploy. Abrir vendas reais continua sujeito ao aceite #68. Este planejamento não executou deploy.
