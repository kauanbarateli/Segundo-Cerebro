# T028 — validação integrada e auditoria Impeccable

Em 09/10/2026, a raiz integrou e revisou as entregas dos agentes de Admin/Financeiro/Google, Conhecimento/Drive/Projetos/Hábitos/Cofre, operação e hardening. A implementação local do MVP passou os portões abaixo. **Implantação e aceite operacional continuam pendentes**, descritos no [arquivo de entrega](entrega-mvp-pendencias.md). Nenhuma migration nova foi aplicada no Supabase nesta conclusão.

## Portões executados

| Portão | Resultado |
| --- | --- |
| TypeScript e ESLint | Integrais aprovados, inclusive no build final |
| Regras/contratos em UTC e São Paulo | 93 arquivos, 1.427 testes em cada fuso |
| Scripts Node | 57 testes aprovados, incluindo backups cifrados, corrupção, alvo isolado, preservação de owners e falha sem retry ou upload |
| Dependências de produção | `npm audit --omit=dev`: zero vulnerabilidades em 09/10; o aviso da cadeia de lint permanece na issue #36 |
| Camadas | 318 módulos/1.284 dependências, sem violação |
| DS 2.1 | Fonte JSON/CSS coerente, 164 pares de contraste aprovados |
| Impeccable | Engine 0.1.6: zero registros no código src |
| SQL estático | 59 arquivos, zero erros |
| SQL Editor | 14 migrations e 31 scripts separados, hashes/cópias conferidos |
| PostgreSQL local descartável | 14 migrations +29 asserções passaram; release readonly: 1.242 checks/zero desvios |
| Busca com massa | 50 mil metadados Drive, seis termos, máximo local 29 ms |
| Build de produção | Aprovado em modo demo, sem integração remota |
| Bundle público | 78 bundles, sem assinaturas SDK Auth, tokens ou nomes de segredos de servidor |
| Browser integrado | **168/168 E2E Chromium aprovados**, três workers, 2,2 minutos na confirmação final |

Contagens dos scanners dependem do inventário de arquivos; o portão final registra somente quantidade/regra, sem imprimir valores. Assinaturas não detectam qualquer segredo ofuscado ou aleatório. CI é um portão adicional da publicação: conferir seu resultado pelo SHA em Actions e consultar o registro na [issue de release #35](https://github.com/kauanbarateli/Segundo-Cerebro/issues/35); um CI anterior não certifica esta entrega.

Auth/Storage do PGlite são fixtures explícitas. Não houve serviço Storage, OAuth/Google real, SMTP, dump/restore Supabase, scheduler ou transações simultâneas. O kit e Argon2id/AES-GCM foram reais nas jornadas locais do Cofre, com dados sintéticos. A recuperação em contexto limpo tem harness de crypto com bypass CSP explicitamente isolado; as jornadas normais exercitam worker/CSP da aplicação. Isso não prova persistência conectada ou comportamento de aparelho físico.

## Defeitos encontrados e corrigidos na integração

- Restauro Financeiro concluía depois de uma troca de aba e sobrescrevia a escolha do usuário. O destino agora só muda se a URL ainda é a mesma do início da ação; três regressões de disputa e os dois formulários E2E passaram.
- Salvar lembretes podia deixar a Agenda ativa com a preferência antiga. O comando invalida também Agenda; teste confirma a segunda leitura e o lembrete desligado.
- Relacionados mantinha títulos após mutações externas. Um bus publica somente keys de consulta, e a interface relê metadados; rename/delete e resposta anterior lenta têm regressões. Falha do observer não altera o resultado de um comando confirmado.
- Logout deixava uma janela para títulos financeiros/retornos tardios. Provider desmonta conteúdo com máscara ativa; Busca, Relacionados, OAuth e Admin abortam e invalidam suas gerações. O formulário nativo é conectado após a limpeza. Cofre bloqueia antes de qualquer await do journal, inclusive cópia pendente.
- Inspeção visual encontrou título/tipo colados no Cofre e confirmações rápidas cobrindo quase todo o Financeiro. O tipo ganhou linha/espaçamento; a fila mantém duas confirmações transitórias, preserva avisos com ação/persistentes/foco e limita altura. O novo E2E confirma que Desfazer continua disponível.
- A revisão independente do restore encontrou mudança indevida de owners por opção do PostgreSQL. O operador preserva owners/grants originais e recusa incompatibilidade; o catálogo do aplicativo não declara sozinho Auth/Storage gerenciados verificados. O ensaio real permanece manual.

## Auditoria técnica Impeccable

Skill local 4.4.0, contexto e referências de Operate/craft-floor/audit, DS 2.1/Geist e briefings por superfície preservados. O detector determinístico passou sem finding. A inspeção visual do integrador foi feita em duas rodadas por imagens atuais geradas pelos testes, com desktop e celular na mesma avaliação. Após os dois ajustes visuais acima, houve uma confirmação; não foi substituída a identidade do planejamento.

**Integridade: aprovada no escopo local.** Shell, campos, botões, estados e hierarquia expressam o mesmo sistema; fluxos demo são identificados e integrações indisponíveis não fingem sucesso. Pontuações são uma avaliação de engenharia desta amostra, não certificação WCAG ou nota de produção.

| Dimensão | Nota /4 | Evidência e limite |
| --- | ---: | --- |
| Acessibilidade | 3 | Labels, landmarks, foco/retorno, diálogo aninhado, setas/Esc e anúncio de contagem exercitados; leitor de tela real pendente |
| Performance | 3 | Editor lazy, worker Argon2id, 105 kB compartilhados no build e Busca local medida; profiling mobile/latência hospedada pendentes |
| Responsividade | 3 | 320/390/768/1280, temas, transbordo/alvos44px/campos16px; jornadas adicionais390/1440; touch/iPhone real pendente |
| Tema | 4 | Tokens DS, claro/escuro/sistema, head sem flash, propagação entre abas e preferência explícita testados localmente |
| Integridade | 4 | Detector zero, contratos de camadas e privacidade preservados, labels/estados do domínio coerentes |
| Total | **17/20** | **Bom**, com aceites de dispositivo/serviço ainda externos |

Nenhum P0/P1 visual confirmado permaneceu na amostra após os ajustes. Não se classificam medições não realizadas como defeitos provados. Contraste automatizado não cobre toda combinação de conteúdo personalizado.

Imagens inspecionadas incluem Início390 e desktop escuro, Calendário1280, Conhecimento390, Projetos1280, Cofre390/1280, Financeiro320/1280 e Admin320. Os testes também geram DS em ambos os temas e Auth claro/escuro. São arquivos em test-results, regenerados e anexados ao CI, sem dados pessoais. Downloads do kit são excluídos do artefato; as jornadas Cofre não gravam trace de conteúdo desbloqueado.

## Jornadas e aceites externos

| Jornada do doc 05 | Prova local integrada | Continuidade externa |
| --- | --- | --- |
| Capturar/organizar | CRUD, conversão/origem, wiki/vínculo, imagens reencodadas, lixeira e rascunho/logout | Storage/persistência conectados e iPhone |
| Agir no Início | Concluir/reabrir tarefa, marcar/desfazer hábito, esconder/vetar blocos | Projeções persistidas dos novos módulos |
| Lançar/pagar | Formulários, transferência bilateral, fatura parcial/encargos, parcelas e Desfazer | RPC hospedada, transações sobrepostas e dois usuários |
| Buscar/vincular | Paleta → Capturas/Tarefas/Projetos, teclado/foco; sete fontes e vínculos em contratos/SQL | Editor/vínculos conectados, leitor real |
| Reunião/nota/tarefa | Grade/evento multidia/demo; nota/seleção/410/cron com doubles e SQL | OAuth duas contas e serviço Google real |
| Cofre/copiar/bloquear | Criar/provar kit, CRUD/recovery, chave não extraível, hide-lock; clipboard/30s com doubles | Clipboard/aparelho, persistence/restore real e revogação |

Viewport emulado não é iPhone físico e clique de mouse não demonstra toda interação touch. Nenhum vídeo de aparelho/leitor real foi produzido. Backup/restore, comparação owners Auth/Storage, tipos reais e catálogo no projeto pessoal são critérios externos obrigatórios. A [entrega e pendências](entrega-mvp-pendencias.md) reúne a sequência de retomada; #12 e #20–35 continuam abertas para seus aceites reais.
