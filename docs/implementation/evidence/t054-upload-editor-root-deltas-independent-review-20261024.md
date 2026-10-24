# Adendo de peer E3 — dois deltas Root — 24/10/2026

Parecer favorável estático aos dois ajustes Root após transporte E3. O parecer E3 `9211e5e9713c789cf664b2b8c0b74311569ac9b78aeb4da2f0923a06d41fff64` e o freeze E3 `39acf7aa6d17c66667193474acf7f08305cf0706729d6460f3c2d55ec8e4a59f` permanecem inalterados. Estes ajustes não alteram produto, API, R2, CSS, fixtures financeiras ou autoridades nominais.

Checkout revisado: `work/Segundo-Cerebro-mvp-goals-terminal-20261023`, transporte sobre `4f10655fc4e4efc61291b66a1e6f7962c7329419`. Comparei os sete paths E3: somente os dois abaixo diferem do freeze; os outros cinco são byte-idênticos. Em cada arquivo, inverter uma única substituição textual reconstitui exatamente o raw E3, sem normalização de linhas.

## 1. Literal PNG sintético

- Path: `tests/e2e/finance-goals-image-upload.spec.ts`, literal em linha 14.
- Before E3: `62493018a7a146b95441044855730134733727911ab075b799059d584fc150a0`.
- After Root: `8aec415742b06b90d971eb204799ed443500c6830e54ef4b761f8fe02078c3db`.
- Uma ocorrência do novo literal; inversão reproduz E3 integralmente.

Conferi independentemente, em RAM e somente com bytes públicos, assinatura PNG `89 50 4e 47 0d 0a 1a 0a`, chunks IHDR(13), IDAT(13), IEND(0), CRC32 correto dos três chunks e fim exato sem bytes ausentes ou posteriores. IHDR declara 1×1, profundidade 8, RGBA (tipo 6), compressão/filtro/interlace 0. O asset possui 70 bytes e SHA256 `44cd598daa29e0dfe2ddb86b1af21dbec9b37b2f214d320c2af0450610e218e8`, igual ao vínculo Root.

O PNG antigo de 67 bytes permanece preservado em E3; a derivação Root substitui apenas o literal público inválido para permitir testar a prévia. Não é imagem de produto, dado pessoal ou fallback no código real. Não executei inflate, decoder de imagem, renderer, navegador ou captura: a estrutura/CRC validada não equivale a naturalWidth observado ou aceite visual. Root havia comunicado verificação adicional de inflate; essa evidência é dele.

## 2. Mock prepare explicitamente tipado sem argumento inutilizado

- Path: `tests/features/goal-image-editor-session.test.ts`, linha 19.
- Before E3: `4da95e29a4c68ea12aff10942c64567352ddca07c67007b29e8b1371a8aa7fc4`.
- After Root: `18250713fd478b0191c19c18e579abb610cccb30caafe60456bb074eb8956cea`.

A substituição única é `vi.fn(async (_intent: GoalCommand) => undefined)` por `vi.fn<(intent: GoalCommand) => Promise<void>>(async () => undefined)`. O parâmetro das calls continua GoalCommand e o contrato de retorno agora explicita Promise<void>; a implementação continua resolvendo undefined sem efeito. Uma implementação que ignora argumentos é atribuível à função que recebe GoalCommand. Não há cast, alargamento da API do produto, supressão de regra, alteração de oracle ou troca de mock.calls por acesso sem tipo.

Li a declaração pública local de @vitest/spy: `fn<T extends Procedure | Constructable = Procedure>(originalImplementation?: T): Mock<T>`. Ela admite a forma genérica usada. Isso remove a variável inutilizada sem remover o tipo da intenção. A versão instalada localmente e a versão resolvida no CI não devem ser confundidas: Typecheck/lint e os testes da versão do lock ainda pertencem aos gates próprios do candidato.

## Limites

Nenhum novo bloqueador objetivo estático nestes dois deltas. Executei somente leituras, hashes, comparação textual e cálculo de CRC dos bytes públicos em PowerShell; não executei Node, TypeScript, lint, testes, Git apply, SQL, rede, serviços ou operações de upload. Nenhuma PNG foi renderizada/produzida por esta revisão. Os seis casos visuais, negativos da união, grafo de fontes e CI próprios seguem necessários; não se herda PASS da fonte E3 ou de commits anteriores. Merge, produção, montagem e restore não são objeto deste parecer.
