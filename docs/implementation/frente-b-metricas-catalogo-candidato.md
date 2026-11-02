# Métricas de origem por catálogo — integração candidata

A API só aceita `signup_metrics` com a versão exata do catálogo e uma distribuição validada por dimensão, totais e códigos aprovados. Campos extras, códigos livres, versões antigas e respostas inconsistentes são recusados antes da resposta HTTP. O browser também valida o contrato e usa apenas rótulos fixos. Quando o SQL instalado ainda for o anterior, a rota responde 503 e a tela de métricas fica indisponível; é um rollout coordenado, não um fallback silencioso. O conteúdo `catalog-integration.sql.txt` é um rascunho guardado, não migration, e nunca deve ser executado em QA ou produção como está.

## Manutenção versionada

O arquivo `scripts/verification/front-b-metrics-dictionary-draft/origin-dictionary.json` é a fonte revisada das cinco dimensões. Para incluir campanha, termo ou conteúdo:

1. Edite apenas a lista correspondente. Cada entrada tem `code`, `label` e `aliases`; o próprio código deve aparecer entre os aliases. Exemplo ilustrativo, não incluído automaticamente: `{"code":"lancamento_2027","label":"Lançamento Campanha","aliases":["lancamento_2027","campanha_2027"]}`.
2. Use códigos e aliases minúsculos, iniciados por letra ASCII e com até 32 caracteres ASCII de letras, números ou `_`. Rótulos têm até 40 caracteres de letras e espaços. Não reutilize códigos, aliases ou rótulos dentro da mesma dimensão; rótulos reservados como “Outros” e “Não informada” são recusados. O compilador normaliza a origem ao classificar, recusa entradas inválidas e limita a 100 códigos por dimensão e 30 aliases por código.
3. Revise cada código, alias e rótulo: não inclua e-mails, telefones, nomes de pessoas, IDs de usuário ou outros dados pessoais. A validação de formato não identifica todos os dados sensíveis. Preserve códigos e aliases já usados para não alterar a classificação histórica sem decisão explícita.
4. Na raiz do repositório, gere os dois artefatos locais e valide-os:

   ```sh
   node scripts/verification/front-b-metrics-dictionary-draft/catalog.mjs --write
   node scripts/verification/front-b-metrics-dictionary-draft/catalog.mjs --check
   ```

5. Abra um PR com o JSON, `src/core/acquisition/origin-dictionary.generated.ts` e `catalog-integration.sql.txt` juntos. Revise os aliases, rótulos, SQL e o hash de versão; o teste de catálogo existente executa `--check` e falha se os artefatos divergirem. O comando não acessa banco, não cria migration e não faz deploy.

Cada alteração no JSON altera o hash SHA-256 compartilhado pelo SQL e pelo browser. Um hash retornado pelo banco não prova sozinho qual SQL ou ACL está instalado. Antes de liberar, qualificar função, owner, RLS/grants, catálogo, ledger e tipos no destino correto, planejar migração e publicação coordenada, e validar a sessão Master. A troca isolada entre SQL e aplicação deixa as métricas indisponíveis de propósito.

A ausência considera valor não coletado, consentimento não concedido, retirada ou expiração, sem distinguir esses motivos. Grupos reconhecidos menores que cinco e valores não reconhecidos são Outros. Os resultados continuam sujeitos a inferência por contagens e consultas sobrepostas; não são anônimos.

O catálogo inicial é apenas exemplificativo: source cobre Google e Instagram, medium cobre organic e email; campaign, term e content não têm códigos aprovados e ficam em Outros até que sejam incluídos pelo processo acima. A issue #137 não está completa até os códigos necessários serem aprovados e os gates de SQL, retenção e validação conectada serem atendidos.

O diagnóstico histórico `prepare-model.mjs` fixa o hash do modelo anterior e recusará o novo modelo por desenho; não modificar esse pin automaticamente. Requalificar o diagnóstico ou manter fixture histórica antes de depender dele. Não reescrever migrations ou o catálogo histórico para contornar o descompasso.
