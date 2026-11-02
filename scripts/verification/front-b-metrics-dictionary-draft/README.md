# Diagnóstico descartável do dicionário de UTMs

Artefato de revisão. Não é implementação, migration, autorização de alteração do banco ou prova para promover a Frente B. Quando instalado neste mesmo caminho dentro do repositório, os comandos determinam a raiz do projeto a partir de `scripts/verification/front-b-metrics-dictionary-draft`; opcionalmente aceitam `--repo` e um caminho absoluto para examinar outra cópia. O TypeScript é carregado das dependências já instaladas do repositório indicado. Os geradores gravam **somente** em `generated/` abaixo deste diretório (ignorado no Git); eles verificam o SHA dos dois arquivos de entrada antes de criar o SQL e o modelo. A UI é cópia da versão local encontrada e requer revisão de integração; não deve substituir automaticamente outras alterações.

Na raiz do repositório, com dependências instaladas:

```sh
node scripts/verification/front-b-metrics-dictionary-draft/generate.mjs
node scripts/verification/front-b-metrics-dictionary-draft/prepare-model.mjs
node scripts/verification/front-b-metrics-dictionary-draft/test-proposal.mjs
node node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --target es2022 --module esnext --moduleResolution bundler --lib es2022,dom,dom.iterable scripts/verification/front-b-metrics-dictionary-draft/generated/signup-metrics.ts scripts/verification/front-b-metrics-dictionary-draft/generated/origin-dictionary.generated.ts
```

Executando de uma cópia isolada, acrescente `--repo` e o caminho absoluto ao repositório a cada um dos três comandos Node. O gerador de SQL parte somente do candidato de hash `55b72a3a566af68e4795b367707cda5745c70321e0186b1536fe6f63bdc3dd5f` e o modelo de hash `c0ce91d93ca097e4f8fd34b5f04c5098984607cbb53766038dfb614c947e4c51`; qualquer diferença interrompe a geração e requer nova revisão, nunca troca automática do pin.

Uma falha não apaga uma saída anterior em `generated/`; não use arquivos preexistentes como evidência de geração bem-sucedida. Verifique o código de saída de cada comando e execute os testes apenas após os dois geradores passarem na mesma revisão.

O SQL gerado é `.sql.txt` e contém `DO ... RAISE` dentro da transação, antes da criação, para abortar uma execução integral. Isso não protege seleção parcial ou remoção do guard e não é controle de autorização. Ensaios futuros somente em banco descartável poderão retirar a linha guard de uma cópia de teste com verificação explícita, mantendo o rascunho e os candidatos intactos. Este diagnóstico não se conecta a banco e não executa SQL.

O dicionário é fixo, começa com exemplos limitados e recebe uma versão SHA-256 derivada de seus bytes, compartilhada pelo SQL e pelo parser. Classificação precede agrupamento, ordenação e serialização; valores não reconhecidos viram Outros, inclusive grupos grandes; ausências são preservadas mesmo em grupos de 1 a 4; aliases aprovados são agrupados antes do limiar. O parser recusa versões divergentes, códigos desconhecidos, duplicatas, campos extras e totais inconsistentes. Revisão humana de códigos, aliases e rótulos continua obrigatória; validação sintática não garante ausência de dados pessoais.

**Limitação funcional:** `utm_campaign`, `utm_term` e `utm_content` não têm entradas no dicionário inicial; todas as informações aparecem como Outros, impedindo acompanhamento de campanhas, termos ou conteúdos individuais. A issue #137 não está completa sem um mecanismo operacional revisado para cadastrar e versionar códigos seguros, além da implantação coordenada do banco e da aplicação. A coleta permanece inalterada e pode conter dados pessoais; contagens exatas e consultas sobrepostas permitem inferências, logo o resultado não garante anonimato.

Os testes puros exercitam o modelo e inspecionam o texto SQL, mas **não** validam execução SQL→API, RLS, sessões, navegador ou QA. Se aprovada uma mudança real, revisar e atualizar coordenadamente o candidato, catálogo `FRONT_B_30_DRAFT_REVIEW`, outros pins e inventários fechados, SQL Editor e manifesto, fixtures, typegen e provas de composição, sem reescrever catálogos históricos. A troca de versão isolada entre SQL e API deixará as métricas indisponíveis por desenho, até a implantação estar alinhada.
