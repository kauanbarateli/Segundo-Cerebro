# Candidata de feedback — não instalada

O SQL nesta pasta é uma proposta para revisão e testes isolados da issue #138. Não integra a cadeia de instalação, o SQL Editor nem qualquer execução automática de migrations. A interface e a API de feedback dependem dessa estrutura e não podem ser ativadas enquanto ela não estiver instalada e validada.

Antes de promovê-la, concluir a reconciliação #134 e revisar dependências, catálogo, tipos, permissões e contratos fixados da cadeia. Criar a migration definitiva com a CLI do Supabase, atualizar conscientemente os artefatos e testes de instalação e validar o candidato exato em QA. A existência deste arquivo e os testes locais não autorizam aplicação remota, merge ou deploy.
