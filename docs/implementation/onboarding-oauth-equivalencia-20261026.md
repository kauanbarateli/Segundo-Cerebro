# #64 — reaproveitamento da prova humana OAuth

**Conclusão:** não há delta no caminho servidor de início, callback, continuação ou SQL 026 entre o ensaio humano e o Preview 5862. Esses contratos positivos não precisam de novo consentimento somente porque o SHA global mudou. Isso não transforma a leitura atual da interface em um callback novo nem conclui os aceites ainda abertos da #64.

## Referências verificadas

- Prova humana: `docs/implementation/onboarding-homologacao-real-20261023.md`, Source `85b9712491e8e23fbba85a0504f71d2a13f4e768`, Preview `dpl_xn4hwcgox8KR6abZ91N54AusW8QG`, homologação pessoal `twrydxsdemaykgvdlpyd`, migrations 001–026.
- Preview atual analisado: `5862ab6cae76d33b5d5c35a40f22a0de9536e973`, árvore `1c519ce5c46a2fd0846d83306b74c3bdc1de64a7`.
- HEAD fotografado nesta análise: `c2b67f9586ae474a097eb0a24e28b8f22d142aa9`, árvore `0a8de97c03157b6211ea0c45ada4eeca3bf15436`.
- [Inventário de blobs](evidence/onboarding-oauth-equivalencia-20261026.json):37paths, Git blobs, SHA-256, bytes, árvores, função de início e versões das dependências. Nenhum dado de conta, cookie, código ou credencial foi coletado.

A prova de 23/10 registra: percurso completo com sete escolhas persistidas sem duplicação; segunda rodada vazia; consentimento humano positivo; retorno à etapa de agenda; duas contas somente leitura; conclusão sem novas criações. Ela explicitamente não prova sincronização/visualização de eventos, recusa OAuth, concorrência, falhas parciais ou aparelhos físicos.

## Equivalência objetiva por caminho

Dos 37 paths inventariados, 30 têm o mesmo blob entre 85b e 5862; todos os 37 têm o mesmo blob entre 5862 e C2. O diff completo de 5862 para C2 contém somente captura/CI/testes/documentação, sem alterações em `src/` ou migrations.

| Caminho/contrato | Resultado |
| --- | --- |
| OAuth start/callback | Bytes idênticos nos três Sources. Mesmos gates de sessão/origem, reserva, PKCE, classificação obrigatória e retorno interno. |
| `onboarding-oauth.ts` | Bytes idênticos: continuação assinada e vinculada a fluxo/dono/sessão/rodada/geração, validade e consumo; fence transacional antes do connect. |
| Cinco adapters onboarding e quatro adapters Google | Bytes idênticos; não introduz outro SDK, endpoint ou protocolo. |
| `core/calendario/*`, onboarding use-cases/reserved/attributes | Bytes idênticos. |
| Rotas `/api/onboarding`, attributes, auth/config/runtime/clients/guards/cookie-policy, middleware | Bytes idênticos. |
| `http-port.ts`, `lifetime.ts` | Bytes idênticos: transporte e descarte de operações de outra sessão permanecem. |
| Migration 026 | Bytes idênticos. A 027 adicionada é financeira; não redefine OAuth/onboarding nem suas rotinas de continuação. Isso é inspeção do repositório, sem afirmar estado atual do catálogo remoto. |
| Função `connectGoogle` do hook | Trecho exato de 613 bytes igual nos três Sources: SHA-256 `9c05c4398016de60e5ba3dc4d38138f33bd705f32b9dd9eb4f7a8a1bd150d108`. Salva etapa calendar antes do início e mantém a mesma saída protegida. |
| Dependências de runtime examinadas | Next 15.5.28, React/ReactDOM 19.2.8, SSR 0.12.7 e supabase-js/auth-js 2.117.2 iguais nos três locks. O delta de package.json/lock atualiza o override Zod 4.6.5 para 4.6.6 dos pacotes Serwist de build; não há import Zod em `src/`, nem mudança nessas seis dependências de runtime. |

Blobs-chave, iguais nos três Sources:

| Path | Git blob |
| --- | --- |
| `src/app/api/calendar/oauth/start/route.ts` | `a2f6818775da16d7830568551952c78757daee54` |
| `src/app/api/calendar/oauth/callback/route.ts` | `213f5dd56144debdcefb51c76234bf1d201055e6` |
| `src/adapters/db/onboarding-oauth.ts` | `7a63a3b15352a7ff301b4fd929bce1672bb553b4` |
| `src/components/features/onboarding/http-port.ts` | `57249b6c081d3e0b15161a2e7eba8ce4d51b93c2` |
| `src/components/features/onboarding/lifetime.ts` | `b0b46df54195c4d84c42a17d4d0eddd94fb45b3d` |
| `supabase/migrations/20261023061901_onboarding_foundation.sql` | `b9dae8e354428f39784640c00a16a274cdbf1cdc` |

## Deltas que conservam aceites próprios

1. **Frequência v2:** `types.ts`, `validation.ts` e `server-planning.ts` acrescentaram diário versionado, dias da semana e meta semanal. Ramos legacy sem versão continuam explicitamente preservados; isso não prova persistência conectada dos novos payloads. O ensaio antigo não qualifica hábitos v2, CAS/amend/recovery desses payloads ou MainHTTP atual.
2. **Avisos OAuth:** página e workspace passaram a tratar uma allowlist de notice com `oauth-notice.ts` novo. A mensagem connected afirma apenas que o retorno foi recebido; somente snapshot prova conexão. Parser/notice não mudam start/callback, mas os estados novos de recusa/falha/notice inválido precisam dos testes e da inspeção de UI correspondentes, sem inventar sucesso por querystring.
3. **Hook e apresentação:** `use-onboarding.ts` muda seleção/foco do erro e o deferimento da oferta; workspace muda navegação/rodapé/avisos, e outras superfícies de onboarding mudam chips/rascunhos/recuperação. Esses deltas visuais/funcionais têm gates próprios do candidato; não estão aceitos pelo ensaio 85b.

Não foi detectado delta de implementação que justifique repetir o consentimento positivo Google ou cadastrar mais contas para verificar novamente o mesmo contrato de callback. Um novo ensaio conectado deve ser motivado por um estado ainda não provado ou mudança efetiva em configuração/transporte, não por uma nova captura da mesma sessão.

## Pendências preservadas

- Concluir os negativos de sessão trocada/revogada, rodada alheia, replay, geração antiga, origem, expiração, veto e limite/reservas concorrentes pelos gates apropriados da #64.
- Aceite de frequência v2 e do MainHTTP permanece separado; os testes SQL/sintéticos não se tornam consentimento real.
- Configuração e valores de ambiente não foram lidos. Igualdade de Git não detecta troca de cliente/chaves, callback cadastrado, origem ou drift de banco. Root deve vincular o deployment e os pré-requisitos atuais usando seus metadados/protocolos antes de qualquer operação futura.
- A leitura atual de Settings/agenda no Preview demonstra renderização e snapshot daquele momento; não é emissão de fluxo, callback novo, novo consentimento ou sincronização.
- Os resultados de CI do 85b não são herdados. O inventário comprova equivalência de bytes e delimita o reaproveitamento da prova humana positiva; a qualificação de 5862/C2 continua própria.

Esta análise usou somente documentação e objetos Git locais. Nenhum navegador, conexão, SQL, API externa, conta ou configuração foi operado.
