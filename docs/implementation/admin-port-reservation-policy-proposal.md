> HISTÓRICO DO PACOTE AUTOR: as indicações EXTERNAL/NOT_RUN no corpo abaixo registram o estado autoral original, preservado como referência. O adendo Root datado registra o candidato preparado para incorporação e distingue os checks já executados.

# Higiene CI — reserva preventiva das portas fixas do Admin

**EXTERNAL_PROPOSAL_NOT_INCORPORATED / NOT_RUN.** Base15cb0c0e9f46d5134ea382cdc5c1aadbce4d219e, árvoreafefecbce167be6d0c50c721d788b886895ab7d6. Nenhuma política de OS, serviço, teste ou workflow foi executado. Root, Windows, produção e o guard original de portas permanecem intactos. O failurePR105/40128812846 de54320/listen/EADDRINUSE continua válido e sem proprietário/causa determinados. Isto é prevenção proposta, não correção retroativa.

## Pesquisa primária

O kernel documenta a faixa TCP/UDP padrão32768–60999. ip_local_reserved_ports impede alocações automáticas, inclusiveconnect/bind0, e mantém binds explícitos. A escrita substitui a lista inteira; por isso a união deve preservar cada reserva observada. Faixa e reservas são independentes. Esses fatos aparecem nas[docs atuais](https://docs.kernel.org/networking/ip-sysctl.html#ip-variables) e nas[docs6.8](https://docs.kernel.org/6.8/networking/ip-sysctl.html#ip-variables). Nenhum valor real do runfalho foi observado.

O[Node24.19 net.listen](https://nodejs.org/download/release/v24.19.0/docs/api/net.html#serverlisten) já usaSO_REUSEADDR. O optionexclusive trata compartilhamento de handles entre workers; não reserva portas de clientes efêmeros. A proposta não altera opçõesSocket nem adota o exemplo de retry dos docs.

GitHub documenta[VMs hospedadas comsudo sem senha](https://docs.github.com/en/actions/reference/runners/github-hosted-runners#administrative-privileges),[VM nova por job/descartada ao fim](https://docs.github.com/en/actions/how-tos/manage-runners/github-hosted-runners/use-github-hosted-runners),[execução de jobs semcontainer no host](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/run-jobs-in-a-container) e os[contexts de runner/job](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#runner-context). O Admin atual éubuntu-24.04 semcontainer/services. Capacidade técnica não equivale a autorização.

INFERIDO: excluir54320–54322 de alocações automáticas novas do host pode prevenir uma classe de colisão com as portas fixas. Não prova o que causou a recusa original, que a faixa era a padrão, nem que os sockets/estados anteriores desapareceram. Continua possível um bind explícito conflitante. Não se declara proteção de Docker/NAT ou outros namespaces.

## Autorização e limites desta autoria

O integrador autorizou literalmente “GO autoria EXTERNA ... inclui proposta executor Bashworkflow mas NÃO executar kernel ou Root”. Este pacote cumpre essa fronteira: after/manifest/patch externos, sem aplicação. A decisão de incorporar/executar pertence a Root após peer e gates próprios; o sudoapt-get existente não é a autorização. A regra local “CI, build, deploy e integração GitHub não devem aplicar schema automaticamente” permanece: esta proposta não toca schema/banco/migration.

A proposta recusa self-hosted, nãoLinux, jobcontainer, servicecontainers e falta do opt-in. A ausência de job.services aceita somenteJSONnull, stringvazia ou objeto vazio; objetos não vazios/arrays/booleanos/números continuam recusados. O peer encontrou e corrigiu a recusa inicial equivocada deJSONnull antes do freeze. A semântica de chave ausente/null e sua serialização está no[código oficialIndex](https://github.com/actions/runner/blob/main/src/Sdk/DTExpressions2/Expressions2/Sdk/Operators/Index.cs) e[ToJson](https://github.com/actions/runner/blob/main/src/Sdk/DTExpressions2/Expressions2/Sdk/Functions/ToJson.cs). Os contexts vêm de expressões GitHub; o helper ainda valida o escopo. Não existefallback, continue-on-error ou skip do guard. As funções puras recebem dados, não emitem capability de OS nem aceite nominal.

## Quatro paths e execução futura proposta

1. `scripts/verification/admin-port-reservation-plan.mjs`: um helper standalone, somente built-ins. Exports de planejamento/guard/diagnóstico são puros. Import/help não fazIO. A CLI proposta só lê as duas chavesproc fixas e lê/escreve um snapshot privado noRUNNER_TEMP; não temspawn/exec/sudo/sysctlwrite.
2. `.github/workflows/admin-native-backend-local-ci.yml`: uma única etapa nova apóssetup-node e antes denpmci/CLI/serviços. Usa a versãoNode selecionada e não altera o executorAdmin original. Não afirma anteceder toda a rede: runner/checkout/setup-node já existiram.
3. `tests/scripts/admin-port-reservation-plan.test.mjs`:17 controles escritos, não executados; somente modelos, guards semIO, help/argumentos recusados e leitura declarativa de duas Sources. Não abre/procura porta ouproc, não chama serviço/CLI/SDK e não testa kernel.
4. Este contrato: hipótese, política, TOCTOU e pendências, sem promover a proposta a aceite.

Na etapa proposta, --check-scope recusa o contexto antes domktemp. O snapshot temprefixo fixo,uid do usuário,nlink1,mode600,path/realpath restritos aRUNNER_TEMP eopenNOFOLLOW; não aceitaNode executado comuid0. O conteúdo inclui oSHA do evento e as strings de estado, fica somente no arquivo temporário e é removido pelotrap. Nada publica esse arquivo ou os valores brutos emlogs/artefatos/GITHUB_OUTPUT.

--snapshot lê faixa/reservas reais e emite diagnóstico finito. O plano calcula exatamenteR∪{54320,54321,54322}, preserva todos os membrosR (inclusive0/65535), não altera faixa e recusa exaustão total ou argumento canônico acima de65536caracteres. Sem default comofallback. Se as três já estiverem reservadas, requiresWritefalse/NO_WRITE.

--check-before-apply relê as duas chaves e exige que o snapshot semântico ainda seja o mesmo. O valor de união validado é capturado em variávelBash comxtrace desabilitado, nunca impresso. O Bash valida também seu alfabeto/tamanho. O único novo comando privilegiado é `sudo -n sysctl -q -w` com chave literalnet.ipv4.ip_local_reserved_ports e o valor já validado. Há no máximo uma escrita; zero seNO_WRITE. Erro é fatal e vira código fechado, semrawstderr ou valor bruto. Nenhuma persistência em/etc, ajuste de outra chave ou mudança emcontainer.

--check-readback relê estado real no mesmo processo de job e exige conjunto exatamente igual à união e faixa inalterada. Readback divergente/falha impede iniciar o teste. Não há rollback de sysctl que poderia apagar reservas adicionais de outro escritor. Só após esse passo o workflow segue os comandos originais.

## TOCTOU: limite exposto, semCAS fictício

As leituras prévias e a escrita porBash são processos separados. A verificação de arquivo usaoopenNOFOLLOW e inode/dev, mas não é proteção contra toda alteração de conteúdo por outro processo do mesmo usuário. A lista de reservas também não ofereceCAS nesta proposta.

Existe uma janela entre a última leitura e a escrita. Outro escritor pode acrescentar uma reserva nesse intervalo; escrever a união do snapshot poderia perdê-la. O readback não detecta uma reserva desconhecida que já tenha sido sobrescrita. Portanto a promessa é preservar o snapshot observado, não preservar alterações concorrentes invisíveis. Exigir owner operacional único da política nojob é uma precondição que aVM descartável reduz, mas não prova automaticamente. Não afirmar que reread/readback elimina essa janela. Root pode preferir primeiro instrumentaçãoRO.

Drift observado antes da escrita causa recusa única, semrecompute/retry. Drift observado depois causa recusa semrestore do valor antigo. Nenhum código fecha processo desconhecido, espera a porta liberar, troca porta, amplia timeout ou transforma EADDRINUSE emsucesso. O probeAdmin original continua umbind/umclose, fatal, antes de cada namespace; as três portas e os envelopes/ACK/cleanup/GUI00 não mudam.

## Diagnóstico finito e evidência

Os diagnósticos têm shape fixo:stage,sourceSHAhex, limites numéricos dafaixa, contagens/hashSHA256 das reservas antes e planejadas, quantidade alvo, disponíveis antes/depois, requiresWrite e confirmação de comparação doreadback. originalCauseKnown/nativeCasesCertified são semprefalse. Não contêm lista bruta de reservas, PID, IP, nome de processo, credencial, providerdata ou ownerinventado. O diagnósticoplanned descreve uma intenção; kernelReadbackConfirmed só étrue no caminhoCLI após comparação da leitura real. Um chamador de função pura não ganha proveniência ou autoridade por construir o mesmoDTO.

A qualificação real ainda depende doSHA/árvore e do próprio job. O runoriginal não recebePASS retroativo e um readback de política não certifica Admin/SQL/Auth ou disponibilidade das portas. Uma reserva não remove conexões/estados existentes e não impede binds explícitos.

## Testes e integração pendentes

Os17 controles incluem união pelo domínio65536, preservação e mudança somente nas três portas,0/65535,idempotência, range disjunto, exaustão, parser/coerção/controlchars, registros/getters, comparação de snapshot/readback, contexts recusados, diagnóstico fechado,help/inválidos semIO e ordem/chave fixa do workflow. O caso longo recusa argumento canônico acima do limite. Não foram executados, nem a sintaxeJS/Bash foi validada por runtime.

O novo helper precisa entrar no inventário fechadoAdmin, com nova enumeração/manifesto independente de Sources e atualização derivada do contador. O contador99 não foi tocado. Essa integração é pendência explícita: não considerar o pacote pronto para incorporar apenas porque o patch tem quatro paths. A ausência de um selo novo não autoriza excluir a Source ou aceitar countflexível.

Antes deRoot escolher implementação/execução:peerestático, revisão de necessidade e escopo privilegiado, decisão sobre o risco residual de escritor concorrente, qualificação doSourceSet, checks do novo candidato e evidência própria do runner. Não há pedido para aplicar agora. Nenhum aspecto de produção, restore, baselineV2, Asaas, Drive ou #36é ampliado. Merge e produção seguem bloqueados.


## Adendo Root — integração externa revisada em 24/10/2026

Status deste registro de 24/10/2026: CANDIDATO PREPARADO PARA INCORPORAÇÃO da preparação preventiva e restrita ao CI, conforme decisão Root. Este adendo registra o escopo e os checks da preparação externa sobre Root15; a execução efetiva e a incorporação no checkout pertencem ao registro de evidência Root separado. Os pacotes autores permanecem congelados. A política de kernel não foi executada nem aceita por esta preparação. O proprietário da porta 54320 e a causa anterior do EADDRINUSE original continuam desconhecidos; nenhum caso nativo é aprovado retroativamente.

Os 17 testes puros do pacote autoral passaram no Root com Node 24.19.0/heap 128 em 271 ms, sem kernel, serviço ou SDK. O workflow integrado acrescenta sua execução também antes de --check-scope e, portanto, antes de qualquer sysctl, sem depender de npm ci. Essa ordenação e estes comentários ainda exigem a reexecução dos 17 pelo Root sobre os bytes finais. Importação/help do helper continuam sem IO; probe nativo e seus guards permanecem intactos.

A derivação fresca dos nove getters e o confronto FS independente concordaram: Admin 101, AdminBrowser 542, Recovery 268, Drive 306, Avatar 96, Capturar 104 Git+marcador vazio, Foundation 78 e N12/I8=172 cada. A união dos nove contém 635 caminhos Git; sem Drive,624 Git+um marcador externo. Helper e teste estão declarados explicitamente em ADMIN_LOCAL_NEW_PATHS. O prefixo Source original do coletor registra 102 leituras Git no positivo (HEAD + 101 Sources); a retirada apenas da migration 026 original registra 101 leituras (HEAD + 100 Sources), mantendo uma leitura da cópia 026. A variante de lista com tamanho preservado e 025 duplicada produz o mesmo conjunto negativo. Os contadores externos propostos seguem esses resultados; o contrato de 45 dependências e a validação de seus pins não foram relaxados.

Os resultados são de enumeração, hashes e modelo Source/Git-read somente. Não equivalem à execução do coletor com SDK, às suites nativas, ao novo CI, à política aplicada no runner ou à aceitação hosted/restore. Merge e produção seguem bloqueados.
