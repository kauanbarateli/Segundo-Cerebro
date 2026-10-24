# Fechamento do MVP e redesign — 23/10/2026

Janela-alvo do mantenedor: **segunda/terça, 26–27 de outubro**, em America/Fortaleza. O escopo confirmado em23/10 inclui **MVP operacional, redesign, onboarding de nove telas e ajustes da landing**; checkout Asaas fica para depois (D-077). Este plano organiza a execução; não promete encerrar critérios ainda não demonstrados e não libera produção. Refs #2, #7, #12, #35, #41, #42, #44, #46, #50–#68, #71–#81, #100–#105.

## Estado observado

O inventário de 23/10 encontrou **39 issues e 11 PRs abertas**, incluindo épicos, filhos e aceites compartilhados. Não são 39 implementações independentes. A main observada é `336e1b7c2a2f5efba871eb0ad461b04bba065c41`, com a pesquisa Asaas da PR #49; sua presença não inicia a execução comercial.

| Conjunto | Situação | Próxima prova |
| --- | --- | --- |
| #72–#77: imagens, Kanban, Calendário, Capturar, Hábitos e Financeiro | Construção integrada na cadeia da PR #100; melhorias mobile/foco na #101. | Aceite do candidato combinado e persistência/isolamento/imagens hospedados. |
| #101, fonte `629ce070fc63b2c76794d1cafb8e00eff9df178f` | 19/19 originais aprovados. Dois CI gerais com 375 E2E limpos, 2.453 unidades por fuso, 1.922 scripts e audit zero. | Mesmos bytes integrados à homologação, com execução própria do novo SHA. |
| #105, fonte `fd16e51e68a3c2d64bdbfab9a136cdb0093c885a` | 16 originais aprovados; Auth PR cancelado pelo teto de 35 minutos no bootstrap. Uma repetição específica aprovou 577 guardas, três jornadas, isolamento e limpeza. | Conservar tentativa 1 CANCELLED e tentativa 2 SUCCESS separadas; testar a combinação. |
| Homologação `twrydxsdemaykgvdlpyd` | 001–025 instaladas; catálogo 1.534/zero desvios. Signup desativado; quatro recusas de Data API aprovadas sem escrita. | Login real, persistência, replay, isolamento entre dois atores, imagens e limpeza. |
| Preview de fd16 | `dpl_AgUkCiELx42G912hWePFBUbNJ4HC` READY, após importação humana das nove variáveis exclusivas da branch. | Acesso pela proteção Vercel e aceites HTTP/UI. READY não certifica o login do aplicativo. |
| #103 / #35: recuperação | 17/19 originais de `0259d0c` aprovados; duas recusas Windows antes dos casos nativos. PACK019 passou nos CI gerais. | Transporte nativo qualificado e ensaio real de recuperação, sem redefinir EOF/EPIPE ou alterar pins para obter PASS. |
| #78 / #79: cópia/recorrência e metas/reservas financeiras | PRs #89/#90 entregam somente recortes puros. | Construção e prova dos consumidores, persistência, autorização, eventos/recibos, concorrência e UI. Não encerrar por calculadores isolados. |
| Onboarding e landing | Execução autorizada em23/10, sobre o protótipo de nove etapas existente. | Implementar entrada de novos usuários cadastrados, rascunho/retomada, conclusão idempotente, OAuth e criação pelos casos de uso reais; preservar usuários existentes e links profundos. Ajustes da landing não abrem checkout/vendas. |
| #80 / #81: convergência e aceite geral | Dependem dos filhos reais e do onboarding agora incluído. | Fechar filhos pelos seus critérios; não declarar o épico concluído com pendências omitidas. |

O export MCP de tipos não substitui o snapshot CLI protegido. As informações de Advisor e as diferenças de formato continuam registradas no relatório de homologação. Nenhuma migration histórica será alterada ou reaplicada na produção.

## Quatro frentes, uma fila de integração

| Frente | Entrega atual | Responsabilidade e limite |
| --- | --- | --- |
| A — Root / conexões | Preview, API hospedada, sessões, persistência, isolamento, imagens e roteiro de corte. | Único operador de conexões, segredos, SQL supervisionado e publicação. Nenhum schema por CI/build/deploy. |
| B — CI, interação e landing | Conferência dos próprios runs, conciliação #101→#105, Next 15.5.28, teclado/mobile e ajustes da landing. | Propostas isoladas, revisão por SHA e limpeza real. Preservar capítulos/animação; sem checkout, ampliação de retries, ocultação de cancelamentos ou merge/deploy. |
| C — Recuperação | Wrapper público da instalação Windows permitida, qualificação de origem/alvo/A2 e composição do restore. | Separar distribuição local de ZIP EDB; preservar pins e terminais. Não abrir perfis/archives privados por agente nem executar restore por PASS sintético. |
| D — Produto / onboarding | Ensaio leve de Auth/RLS/persistência e implementação do onboarding aprovado; fatias financeiras entram na próxima vaga de autoria. | Um dono por família de arquivos. SQL novo começa como proposta inerte; código e testes passam pela Root antes de publicação. Não implementar billing como dependência do onboarding. |

São quatro slots totais, incluindo Root. Autoria e revisão podem ocorrer simultaneamente; não abrir quatro stacks locais. Builds, Docker/PostgreSQL e Playwright pesados rodam no GitHub/Vercel. Uma pequena operação local só poderá ser escolhida após revisão de custo de memória, destino e efeitos.

## Ordem para reduzir retrabalho

1. Conferir a configuração por metadados e validar o vínculo estrito do Preview antes de usar clientes.
2. Reunir #101/#105 em **um candidato da mesma branch de homologação**. Preservar Recovery com 233 fontes, hash C real de Capturar nos dois qualificadores e união dos guards `false` em `vercel.json`. Os 17 arquivos de origem já revisada conservam seus bytes; o novo SHA exige seus próprios checks.
3. Executar o pacote mínimo hospedado: duas contas comuns descartáveis, login/sessão, gravação e releitura, replay, isolamento, imagens e revogação/ausência confirmadas. UI e aparelhos mantêm provas distintas; não confundir chamadas de API com clique/teclado real.
4. Em paralelo, fechar o transporte e qualificar recuperação019. O alvo Ensaio_restore permanece reservado; não instalar025 nele como preparo do restore. Nova criação de backup exige janela humana atual de quiescência.
5. Construir o onboarding sobre os contratos existentes e seu protótipo, sem interromper contas anteriores. Avançar #78/#79 sobre a base financeira estável na próxima vaga de autoria, transportando somente os recortes puros aceitos; não fazer merge amplo das branches antigas ou alterar consumidores compartilhados simultaneamente.
6. Congelar a interface para um pacote humano curto em iPhone11/A35: jornadas, teclado, tema, instalação/update/offline, movimento reduzido e problemas visuais. Usar os relatos anteriores no seu recorte histórico.
7. Conferir a main atual e selecionar o candidato de release. Somente após revisão e aceites: integração das PRs, janela/cerca de escritores, backup/recuperação comprovados, aplicação supervisionada020–025 e código compatível coordenados. O deploy antigo não é rollback seguro após021/023.
8. Observar os próprios checks e smoke após o corte; fechar filhos comprovados e depois os épicos. Problema novo volta à fila do seu dono, sem polimento aberto ou repetição indiscriminada de testes.

## Calendário condicional

| Data | Meta de trabalho |
| --- | --- |
| Sexta23 | Candidato combinado e primeira validação hospedada; wrapper/diagnóstico operacional de transporte revisado; inventário por issue publicado. |
| Sábado24 | Correções dos defeitos observados, recuperação supervisionada quando qualificada e onboarding/landing em paralelo; fatias financeiras por vaga de autoria. |
| Domingo25 | Estabilizar candidato, executar o pacote humano e revisar roteiro de corte/recuperação. |
| Segunda26 / terça27 | Janela-alvo de entrega operacional se os gates estiverem fechados; margem para regressões do corte. Não substituir os gates por uma data. |

Os maiores riscos de prazo são transporte/restore, descoberta de falhas hospedadas e aceites humanos. Mais agentes não removem essas dependências. O prazo será reconferido pelos resultados, sem estimar percentual pronto pela quantidade de issues.

## Fronteiras preservadas

- Drive continua excluído; seu Storage histórico compartilhado de imagens/Avatar permanece preservado.
- #36 continua como manutenção após o MVP, por decisão humana. A correção de segurança Next da #104 é outra entrega e permanece obrigatória.
- SPEC-07 (#50–#68) reúne épico e18 filhos comerciais/onboarding. D-077 libera somente seu recorte de onboarding e os ajustes da landing neste fechamento. Checkout, assinatura/cobrança Asaas, webhooks, atribuição de aquisição e abertura de vendas permanecem para a etapa comercial. Não fechar o épico inteiro ao concluir o onboarding, nem introduzir cobrança para contas já cadastradas.
- Sem contratação de serviços, novos recursos pagos, uso de BlackSheep/VOE/legado, reset, seeds, reexecução de001–019 em produção ou segredos no Git/GitHub/chat.
- Merge e deploy de produção continuam bloqueados até os testes e a revisão. O Preview autorizado é isolado e não promove aliases de produção.

## Evidência e prestação de contas

Cada frente entrega issue, fonte/árvore, arquivos alterados, **implementado / validado / pendente**, primeiro erro, situação da limpeza e próxima ação. CIs pertencem ao SHA e à tentativa executados; código puro não comprova consumidor, fixture não comprova serviço hospedado e viewport não comprova aparelho físico.

Referências: [homologação](homologacao-twry-20261022.md), [corte020–025](corte-migrations020-025-20261022.md), [aceite mobile de Capturar](capture-shell-mobile-acceptance-20261022.md), [segurança Next](next-security-15528-20261022.md), [redesign](redesign-paralelo-20261022.md), [issue tracker](../agents/issue-tracker.md) e [planejamento comercial](../planejamento/16-checkout-asaas-onboarding/README.md).
