# T-015 — diário durável de envios

Implementado localmente em 07/10/2026. Este recorte estende a [persistência de Capturas e Tarefas](t015-persistencia.md): o comando pode ser recuperado após recarregar a página ou fechar e reabrir uma aba. A [validação integrada T-015/T-016](t015-t016-validacao.md) consolida em 09/10 a evidência aprovada antes da pausa, as pendências reais e o estado do CI. Os testes descritos abaixo usam ambiente de navegador injetado, sem Supabase.

## Protocolo

1. A identidade verificada no servidor seleciona a instância e o namespace local do Usuário. A construção da instância e o snapshot SSR permanecem `idle`, sem tocar armazenamento. O provider inicializa o diário somente após montar no cliente.
2. Antes do primeiro POST, um Web Lock exclusivo por Usuário serializa a leitura e a admissão do comando. O diário grava um envelope versionado em `localStorage`, em chave própria por `client_id`, e relê os bytes gravados. Nenhum POST é iniciado sem essa confirmação local.
3. O envelope conserva comando, `client_id` e corpo JSON exato. Na restauração, versão, dono, geração da sessão, chave/identificador, campos permitidos e limites são conferidos. Registros incompatíveis não viram uma coleção vazia nem são sobrescritos. O servidor continua validando a sessão, `X-Expected-User-ID`, Entitlement e DTO; o diário não concede acesso.
4. Uma pendência bloqueia novas escritas de Capturas/Tarefas. A recuperação mostra **Confirmar envio**, sem replay automático ao montar, receber um evento de outra aba ou atualizar consultas. O reenvio usa o conteúdo original e o recibo idempotente do servidor.
5. Sucesso confirmado ou `VALIDATION` definitiva remove somente a entrada correspondente, após comparar seu conteúdo. Um marcador sem conteúdo de domínio comunica a resolução às outras abas. O contrato do canal resolve o recibo exato antes de devolver essa validação definitiva.

Uma recusa conhecida no **primeiro envio**, sem tentativa incerta anterior, também libera a entrada: por exemplo, 404 ou 429 permite corrigir o conteúdo e usar outro `client_id`. Depois de resultado desconhecido ou restauração do diário, essas respostas conservam o envio original; somente sucesso confirmado ou validação definitiva permite removê-lo. Assim, um registro inexistente na primeira tentativa não aprisiona a edição, e uma recusa posterior não apaga a evidência de um possível commit anterior.

O diário guarda temporariamente texto de Capturas/Tarefas no navegador, como já ocorre com os rascunhos locais; não é armazenamento cifrado do Cofre. Não recebe cookies, tokens, cabeçalhos de autenticação, credenciais ou URLs de upload. Imagens continuam recusadas no modo conectado. Não há SDK Supabase no navegador.

## Abas, fechamento e saída

Eventos `storage` sincronizam pendência e resolução entre abas. Eventos recebidos durante uma escrita ou durante a leitura de sincronização marcam uma atualização pendente, drenada ao terminar a operação; não são descartados. A confirmação recebida de outra aba identifica o `client_id`, permitindo liberar o controller local correspondente.

O Web Lock cobre admissão, POST e remoção. A atualização de consultas ocorre depois de liberar o lock. Esperar um lock tem limite de 25 segundos; fetch e leitura do corpo têm interrupção de 20 segundos, inclusive quando um transporte injetado ignora `AbortSignal`. Fechar uma instância aborta pedidos, mas **não apaga o diário**: desmontagem, navegação externa e reload não equivalem a logout.

Logout explícito e troca de conta detectada pelo canal invalidam a geração do diário do Usuário anterior. Outras abas dessa geração encerram suas instâncias e abortam operações; uma resposta tardia não recria a entrada. A limpeza não alcança o namespace de outro Usuário, e uma aba já revogada não apaga a geração de um login posterior do mesmo Usuário.

A invalidação de geração é imediata; a remoção física ocorre sob o mesmo lock das gravações. Depois de esperar o lock, a limpeza reconfere a geração atual e limita a remoção à geração revogada. Uma limpeza antiga suspensa entre E1→E2 não pode apagar um comando criado depois de outra saída e entrada em E3.

O provider intercepta somente o formulário POST da própria aplicação para `/auth/logout`. Fecha a instância, tenta limpar os registros e então envia o formulário uma vez. A espera de limpeza é limitada a 1,5 segundo; falha de armazenamento ou de lock não impede o logout Auth. Nesse caso, a remoção física local pode não ser comprovada. Visitar a página de confirmação `/sair` conectada não limpa os registros por si só.

## Limites e falhas

- Corpo JSON: até 256 KiB medidos em UTF-8, conforme o canal. O envelope local também possui limite; dados fora do esquema ou múltiplas pendências incompatíveis falham de forma explícita.
- Um único comando não resolvido é admitido por Usuário, mesmo entre abas. As chaves por comando e a comparação antes da remoção impedem uma confirmação atrasada de apagar outro envio.
- Um único registro de metadados mantém as últimas 32 resoluções, sem texto de domínio. Logout remove esses metadados. Uma aba suspensa que perca esse histórico conserva sua intenção em memória: exige confirmação explícita e grava novamente o mesmo comando antes de consultar o recibo. Não interpreta ausência de marcador como sucesso.
- Navegador sem Web Locks, quota excedida, armazenamento bloqueado ou registro corrompido impedem POST; leituras continuam disponíveis. O aviso oferece **Verificar armazenamento**. Não há fallback silencioso para um diário em memória em produção.
- A durabilidade depende da retenção de `localStorage` pelo navegador. Limpeza explícita dos dados do site, políticas de navegação privada ou remoção externa podem apagar o diário. Não existe recuperação garantida de um conteúdo local que o navegador já eliminou.
- O diário é por navegador e Usuário; não sincroniza conteúdo local entre aparelhos. O recibo no servidor garante replay da operação identificada, mas não substitui o armazenamento de seu `client_id` e corpo para recuperação pelo cliente.

## Evidência local

Passaram 76 testes focados: 34 do diário, 32 da aplicação conectada e dez do controller do Início. TypeScript e lint dos arquivos alterados passaram. Nenhum desses testes criou conta, executou SQL ou acessou o serviço real.

Os testes exercitam gravação antes do POST; fechamento durante fetch; restauração sem replay automático; duas abas com admissão simultânea; confirmação e resultado desconhecido durante GET atrasado; sincronização durante outro GET; resposta tardia após logout; isolamento entre Usuários e gerações; quota/leitura/escrita/lock indisponíveis; corrupção de versão, dono, campos e limites; falha de remoção após commit; remoção atrasada por identificador; histórico de resolução limitado e recuperação após 40 resoluções; e timeouts de fetch/lock. O ambiente em memória usado nesses testes é injeção explícita e existe somente em `tests/`.

Na fonte final de 07/10, a integração aprovou `npm run check` (exit 0), 924 testes Vitest em 50 arquivos e 142 E2E em modo demo. Esse resultado foi preservado em 09/10; o [relatório integrado](t015-t016-validacao.md) registra os demais portões e distingue a regressão demo das asserções SQL reais.

O novo ensaio de 16 cenários de navegador conectado e 18 etapas via SDK ainda não foi executado: o MCP pessoal não estava anexado à sessão da retomada. Reload completo, reabertura de aba, sincronização entre abas, logout e troca de conta do diário final permanecem sem essa prova real. Artefatos de ensaios anteriores não substituem o ensaio deste recorte. Não se atribui evidência real aos testes com doubles nem se declara T-015 encerrada. Upload segue apenas [preparação](t015-uploads-preparation.md); aparelhos físicos e sobreposição de transações no PostgreSQL continuam pendentes.
