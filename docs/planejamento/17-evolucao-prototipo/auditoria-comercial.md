# Auditoria comercial, onboarding e coordenação — 21/10/2026

**OBSERVADO:** leitura de `main@f3d18960a41076e99aa60dcc9f6b46967970ebb5`, PR #69 (`3433c49b9e0e59546ed564222f3c3de814e71098`), PR #70 (`b67f58ac3973fcef5f45daa23f36cdf84432a3fb`), corpos atuais das issues #50–#68 e protótipo local. PR #69 está aberta contra main; PR #70 está aberta contra a branch de #69. As issues #52/#53 estão abertas e não têm comentários na consulta desta rodada. A ausência de commits publicados não comprova ausência de trabalho local da outra frente.

Esta auditoria não executou aplicação, testes conectados, cobrança ou deploy. `OBSERVADO` identifica código/documento consultado; não significa funcionamento homologado.

## 1. Fontes e precedência

- Contratos de produção publicados: [SPEC-07 #50](https://github.com/kauanbarateli/Segundo-Cerebro/issues/50) e [pacote 16 no HEAD do PR #69](https://github.com/kauanbarateli/Segundo-Cerebro/tree/3433c49b9e0e59546ed564222f3c3de814e71098/docs/planejamento/16-checkout-asaas-onboarding), sobretudo `02-fluxos-e-estados.md`, `03-atribuicao-e-privacidade.md`, `04-contratos-tecnicos-propostos.md` e ADRs 0009/0010. D-034–D-064 já aprovam o comercial; a antiga frase de main “sem billing” não deve prevalecer contra essa decisão posterior do mantenedor.
- [PR #70](https://github.com/kauanbarateli/Segundo-Cerebro/pull/70): legais e configuração operacional, D-065–D-075. Os documentos `08-respostas-e-pendencias-checklist.md`, `09-identificacao-privada-do-fornecedor.md` e `docs/agents/prompt-retomada-issues-paralelas-8gb-20261018.md` contêm decisões posteriores ao consolidado inicial. Não importar o PR inteiro sem revisar seu amplo delta de Auth/CI; integrar contratos e fontes conscientemente.
- A composição vigente vem do snapshot atual `public.js/css`, `checkout.js/css`, `onboarding.js/css`, `profile.js/css`, `PRODUCT.md` e assets correspondentes. O pacote 15/PR #47 é histórico do primeiro onboarding; o novo snapshot substitui apenas sua referência visual/funcional demonstrativa, sem revogar contratos reais do pacote 16.
- **SOLICITADO AGORA:** Vercel Pro já contratada, implementar alterações e depois reconferir RAM e retomar testes #52/#53 se houver pelo menos 1 GB livre. Isso atualiza o adiamento por Hobby em D-075; não exigir uma nova contratação ou autorização redundante por aquela decisão histórica. É informação do mantenedor, não leitura de metadados Vercel.

## 2. Matriz do que existe e do delta

| Superfície | Estado observado em main / PR | Delta do protótipo a transportar | Destino e cuidado |
|---|---|---|---|
| `/conheca` | `src/components/features/conheca/{landing-page.tsx,content.ts,product-shot.tsx,access-action.tsx,landing.css}`; seis capítulos, capturas locais claro/escuro/mobile; `acesso.destino.tipo="aviso"`, acesso fechado, indexação falsa. | Copy enxuta, três capítulos principais Captura/Agenda/Projetos, preview alternável Projetos/Kanban, preço R$29,90 no hero e fechamento, CTAs, imagens do produto atualizado. | Complementar #52 com referência nova; não duplicar a issue. Preservar marca, semântica, imagens responsivas/lazy load/hero prioritário, animações discretas. Regenerar capturas **da implementação integrada em modo demo**, não anunciar o HTML local como interface já conectada. |
| Checkout | Nenhuma rota/caso de uso comercial em main; #52 define intenção pré-Auth e comprovação de e-mail; #54–#56 completam meios. | Layout de resumo + formulário, dois temas, campos, validação, progresso e retorno dos documentos legais. | `checkout.js` é referência **de apresentação**. NÃO portar cartão de teste, PAN/validade/CVV, `subscription.status='simulated'` ou salto direto para onboarding. Produção usa e-mail comprovado, CPF/necessários por método, cartão hospedado Asaas, confirmação financeira, criação/ativação única. |
| Termos e privacidade | PR #70 implementa `src/app/termos-de-servico/page.tsx`, `src/app/privacidade/page.tsx`, `src/lib/legal/documents.ts`, `src/components/legal/*`, `src/components/ui/legal-links.*`, `settings-legal-section.tsx`. Texto v0.2, revisão do uso atual, contratação fechada. | Links na landing/Configurações/checkout; leitura sem perder preenchimento e retorno acessível. | Reutilizar a fonte única do PR #70 e os caminhos de produção (`/termos-de-servico`, não hash `#/termos`). Nunca substituir os documentos pela cópia `legal-content.js`. Antes da abertura, reconciliar a minuta com capacidades comerciais efetivas e as novas imagens/participantes. |
| Onboarding | Ausente em main; #62–#65 já especificam a produção. | 9 telas: boas-vindas → nome/foco → Google → hábitos → projetos → tarefas → notas → outros espaços → resumo. Uma coluna até 560px, detalhes recolhidos, etapas opcionais, voltar/pular/fazer depois/rever. | #62 fundação/perfil; #63 hábito/projeto/tarefa; #64 Google; #65 notas/resumo. Atualizar referências nesses tickets via nova issue de convergência ou comentário vinculado, sem criar outro sistema de onboarding. |
| Frequência introdutória | #63 já exige preservar cadência completa; snapshot antigo citado no ticket precede a nova UI. | Em `onboarding.js`: Todos os dias / Dias específicos (mínimo um) / Meta semanal (1–7). Dias visíveis sem esconder a configuração principal. | A nova issue de hábitos deve fornecer contrato compartilhado com #63. Mapear DTO real, não transplantar nomes `cadence`, `goal`, `weeklyTarget`. Criar não equivale a marcar como feito. |
| Nome e foco | Settings já edita `display_name`; foco ainda não existe na base lida. #62/D-060 já pede contrato versionado. | Nome opcional no tutorial e foco Trabalho/Estudos/Vida pessoal/Um pouco de tudo. | #62 estende perfil, validação, leitura, escrita, evento, migration e edição posterior. Omissão preserva valor; não gravar em metadata de autorização nem inventar campo aceito no patch atual. |
| Foto no topo | `SettingsConnectedWorkspace.avatar()` usa `uploadFile(kind:'avatar')`, `avatar.set/remove`, recarrega Settings e `router.refresh()`. `avatar_file_id` é lido no layout. Shell mostra foto no rodapé lateral, não no canto superior. | Ícone superior direito sincronizado com Configurações; fallback e troca/remoção consistentes. | Reutilizar Storage/contrato avatar existente e `fileReadUrl`; a nova issue de shell/mídias deve incluir somente composição/atualização. Não criar segundo armazenamento base64/localStorage ou bucket público. |
| Temas | `useTheme`, preferência `system/light/dark`; Settings explica que seletor do topo muda navegador até salvar preferência da conta. | Mesma experiência claro/escuro e transições do snapshot. | Conservar a terceira opção Sistema e distinção conta/navegador. O protótipo não autoriza remover controles existentes. |
| Configurações comercial | Planejada em #53–#60: gestão própria, inclusive suspensão. | Protótipo só apresenta nota de assinatura simulada e links legais. | Não usar a nota demo para substituir a gestão real. Implementar projeções mínimas de cobrança, segurança e solicitações durante suspensão, sem snapshot geral de módulos. |

## 3. Contratos que prevalecem sobre a simulação

1. Conta existente autentica antes de nova cobrança; gratuidade histórica conferida e isenção preservam vetos/moderação. Preferências, papel Master, imagens e escolhas do onboarding nunca concedem direito.
2. Sem nova conta Auth antes do primeiro pagamento reconhecido; confirmação de e-mail pré-Auth é própria, POST explícito, capacidade de uso único/expiração. GET/scanner não consome nem cobra. #52 não chama cobrança Asaas.
3. Cartão somente na fatura hospedada; Pix/boleto no app. Webhook qualificado + processamento recuperável autorizam provisionamento; retorno do navegador não é comprovante. #51 homologa métodos/ciclos antes de #54–#56.
4. Termos contratuais, ciência da política e consentimento facultativo de atribuição têm finalidades distintas. O checkbox demo “aceito a política” não deve ser tratado como consentimento universal. Usar as versões reais aceitas/consultadas, sem rastrear quem recusa atribuição.
5. Onboarding persiste rascunho **no servidor** por Usuário/rodada/versão, 30 dias desde última edição confirmada, conflito explícito. Não portar `window.App`, hash routing, IDs demo, localStorage compartilhado ou JSON das escolhas do navegador como estado autenticado.
6. Registros têm intenções/recibos estáveis; falha parcial preserva o que confirmou. Projeto→Tarefa e Caderno→Página→Vínculo Página→Projeto dependem de IDs reais e autorizados. Não inventar `project_id` na Página. “Hoje” prepara dia civil explícito e não muda ao retomar amanhã.
7. OAuth Google é efeito real antes do resumo. Até duas contas no servidor contando reservas/fluxos simultâneos; retorno seguro para a rodada. Pausar não desfaz conexão. Não persistir tokens/códigos/URLs privadas no rascunho.
8. Etapa Outros espaços não cria saldos fictícios, não recebe segredos do Cofre e não reintroduz Drive. Revisão de rodada concluída não reaplica; contas antigas não recebem onboarding obrigatório por ausência de flag.

## 4. Issues existentes: reutilização e dependências

| Issues | Responsabilidade preservada | Dependência principal |
|---|---|---|
| #50 | Épico comercial SPEC-07 | 18 filhos; não fechar por conclusão apenas do layout |
| #51 | Homologação Asaas | Ambiente/roteiro próprio |
| #52 | Landing, checkout pré-Auth, comprovação e transporte | Inicial; pode evoluir sem cobrança |
| #53 | Acesso comercial + contas atuais + gestão restrita | Inicial; inventário por canal |
| #54 | Pix, saga paga, ativação | #51 + #52 + #53 |
| #55 / #56 | Boleto / cartão hospedado | #54 |
| #57 | Renovação/tolerância/suspensão/regularização | #55 + #56 |
| #58 → #59 | Cancelamento → reembolso/chargeback | #54 → #58 |
| #60 / #61 | Isenção / atribuição consentida | #54 |
| #62 | Rascunho/elegibilidade/perfil/onboarding | #54; desenho/componentes isolados podem ser preparados, sem declarar integração concluída |
| #63 / #64 | Hábito/Projeto/Tarefa / Google | #62; #63 consome contrato novo de hábitos |
| #65 | Conhecimento/outros espaços/resumo | #63; integração Google permanece #64 |
| #66 / #67 | Retenções / operação | #61+#62 / #54 |
| #68 | Aceite comercial integrado | #57/#59/#60/#61/#64/#65/#66/#67 + #12/#35/#44 |

**RECOMENDADO:** criar no novo épico apenas uma fatia de **convergência visual pública e onboarding com contratos existentes** que referencie #52/#62–#65 e sua dependência de hábitos/mídias. Essa fatia leva copy/capturas/estados/links/ref. atual; as questões de domínio, persistência, envio, OAuth e pagamento continuam nos tickets existentes. Alternativa equivalente: nenhum novo ticket comercial, somente extensão explícita do escopo visual no mapa do novo épico. Não reabrir #46 nem fechar #44 automaticamente.

Ordem: reconciliar a base e WIP #52/#53 → shell/mídias/contratos dos módulos → componentes e captura final pública/onboarding → integração nos tickets comerciais desbloqueados → aceite visual #44 e comercial #68. A interface pode ser preparada por contrato; fluxo conectado não deve ser anunciado antes da dependência real.

## 5. Aceites específicos do novo delta

- Landing mais curta mantém informação suficiente para reconhecer produto, preço mensal completo, destino do CTA e vínculos legais. Prévia Projetos/Kanban funciona por teclado e toque; screenshots coerentes com SHA implementado, nos dois temas, desktop/mobile; nenhum dado pessoal capturado.
- Checkout não monta campo PAN/CVV nem usa scripts do snapshot; leitura legal não perde dados nem confirma checkbox automaticamente; estados carregando/erro/expirado/reenvio/pronto e retorno funcionam com foco visível.
- Configurações e ícone superior refletem a mesma foto após escolher/trocar/remover/recarregar; imagem indisponível mantém iniciais/ícone e nome acessível; URL privada de outro dono falha. Nenhum novo direito surge da simples mudança visual.
- Nove etapas têm uma ação principal, títulos curtos, opção pular e nenhuma informação obrigatória fictícia. Pular tudo, parcial/completo, retomada, conflito, duplo clique, resultado incerto, revisão e nova rodada preservam identidades.
- Hábito criado com dias específicos reaparece no módulo e Início com mesma cadência; alterar dias não inventa marcações nem destrói histórico. A referência visual adicional não reduz os contratos já existentes.
- Novo nome/foco/contexto usa banco real e replay idempotente; notas e vínculos preservam corpus existente. Duas contas Google, recusa, expiração e troca de sessão não misturam dados.
- Claro/escuro/Sistema, 320/390/900/1440px, sidebar nos dois estados onde existe, foco/teclado, movimento reduzido, campos≥16px e alvos≥44px. Capturas devem identificar SHA/rota/estado/tema/tamanho.
- Revalidar negativas de #53 para **cada novo comando, imagem, snapshot e rota**. Usuário suspenso não obtém novo acesso aos módulos por onboarding, editor, upload ou widgets de Configurações.

## 6. Retomada #52/#53, RAM e Vercel

O prompt precisa começar literalmente com a frase exigida pelo mantenedor. Depois, orientar:

1. Antes de interromper a demanda em andamento, registrar branch/HEAD/WIP/processos e checkpoint dos testes #52/#53. Preservar alterações locais, sem reset/stash geral ou reiniciar entregas já feitas. Reconferir tracker porque os dados aqui são um corte de 21/10/2026.
2. Aplicar os deltas e validar suas próprias fatias. Só depois retomar do checkpoint, medindo a RAM disponível novamente. Exemplo Windows: `(Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory * 1KB`. Comparar com `1GB` em PowerShell (1 GiB, limite conservador de 1 GB pedido), registrar valor/horário; não inferir RAM livre pela capacidade total de 8 GB.
3. Se abaixo do limite, não iniciar suíte pesada; liberar somente processos próprios ociosos ou continuar trabalho leve e reavaliar. Se suficiente, uma tarefa pesada por vez, worker único, Node24; executar os testes reais alterados/dependentes de #52/#53, sem nomes inventados. Falha sob pressão de memória não é prova automática de defeito de produto.
4. A nova informação de Pro substitui o impedimento antigo de Hobby. Conferir projeto/time/destino e variáveis antes do deploy; preservar checks e autorização de migrations. Pro não transforma teste local em homologação, não sana CI falha e não implica liberação de vendas/ cobranças reais. Nenhum deploy foi executado por este planejamento.
5. `vercel.json` do PR #70 bloqueia autodeploy **apenas da branch legal**. Rever sua pertinência ao integrar; não replicar esse bloqueio por hábito em todas as branches nem removê-lo silenciosamente de histórico. Não desativar CI. Migrations não rodam por build/deploy.

## 7. Fronteira de decisões (grill-with-docs)

Não há pergunta comercial nova indispensável ao planejamento: preço, métodos, PF, foco/contexto, nove etapas, domínio, atendimento, Resend, limitação Google e persistência foram decididos e documentados. A instrução atual resolve a mudança de hospedagem/RAM. Não repetir entrevista sobre esses pontos.

Há **provas de execução pendentes**, não escolhas que este plano possa declarar resolvidas: remetente/entrega real, fontes temporais/ciclos Asaas, conjunto privado de contas gratuitas, callbacks/ambiente, aceites legais definitivos e matriz de acesso. Vincular aos tickets responsáveis. Não pedir credenciais/documentos privados no chat e não afirmar que PR aberto/planejamento = implementação.

O novo uso de imagens de metas/hábitos/projetos e participantes deverá atualizar inventário/política quando implementado, preservando a revisão de #70; não inventar termos legais nem obrigação de consentimento extra por hipótese. Novo desenho não autoriza ampliar escopos Google para obter fotos de terceiros.
