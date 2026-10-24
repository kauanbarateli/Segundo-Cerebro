# Pacotes inertes da pausa de 24/10/2026

Leia primeiro [o handoff](../handoff-retomada-20261024-mvp-redesign.md). Este diretório preserva código **como patches de revisão**, não como módulos executáveis do produto ou workflows ativos.

- `native-v1/`: onze paths novos do gate nativo N. Estática favorável, com uma correção de composição ainda necessária. O patch tem prefixo `a/after/`; em checkout separado compatível, a conferência é `git apply -p2 --check <patch>`. Não o aplique antes de ler o bloqueio e preservar os Sources atuais.
- `upload-c2a-v1/`: nove paths do coordenador de upload. **V1 bloqueada por P1**, não pronta para montagem. A conferência mecânica usa `git apply --check <patch>`; isso não corrige nem aprova o bloqueio.
- `reviews/`: pareceres independentes, sem testes executados.
- `plans/`: contratos e proposta do baseline, sem autorização para relaxar A2 ou executar restore.
- `evidence/`: recibos públicos de CI e jornadas sintéticas na homologação; não contêm perfis privados nem credenciais.
- `package-manifest.json`: tamanhos e SHA-256 das cópias preservadas. Cada manifesto de origem conserva seus próprios hashes; confira ambos.

Os Sources puros e J2 já estão no código qualificado `70c5dd5`. Não importar outra vez os Sources históricos do WT autor, não sobrescrever o pin M1 `7fb8c48...` nem o ajuste EOF do Budget. O patch N não contém esses dez Sources.

O atributo `-text` é restrito a esta pasta para preservar os bytes e hashes dos pacotes no Git, inclusive seus finais de linha originais. A conferência aceita CRLF nos recibos e conserva o espaço de contexto exigido pela gramática dos patches; esses patches inertes não recebem correção automática de whitespace. Não altera a configuração global, os gates ou as fontes executáveis do projeto. O adendo Root em `reviews/` registra também a incompatibilidade `.nvmrc`/versão completa encontrada ao preparar a pausa.

Não executar os patches no checkout de trabalho humano, não aplicar SQL, não iniciar serviços, não fazer merge/deploy e não interpretar arquivo de teste escrito como PASS. A retomada depende de novo pedido do mantenedor.
