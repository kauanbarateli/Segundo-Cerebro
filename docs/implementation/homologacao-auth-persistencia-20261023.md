# Auth e persistência reais na homologação — 23/10/2026

Refs #44 e #105. Projeto exclusivo: `twrydxsdemaykgvdlpyd`, catálogo001–025 previamente aprovado. Este ensaio usa diretamente Auth/Data API e a RPC canônica `update_identity`; não certifica formulários, Server Actions, cookies do Preview, imagens ou aparelhos reais.

## Resultado

Na segunda execução independente, **36 chamadas e12 tentativas de efeito**, com duas contas comuns descartáveis: login/getUser/my_access_state, perfil próprio visível e estrangeiro invisível, recusa42501 de alterações diretas de papel/moderação, gravação canônica e releitura, replay do mesmo client_id com **um único evento**, logoutglobal, recusa da sessão revogada enquanto seu JWT original ainda não expirou e preservação do segundo ator. Ambos os logouts e exclusões foram confirmados; dois GETs administrativos retornaram404. Conferência MCP READ ONLY/ROLLBACK posterior encontrou zero usuários, sessões, perfis, eventos e objetos de Storage.

O resultado vem de chamadas reais ao serviço, não de fixtures locais. Não criou Master, concedeu direitos, enviou e-mail ou arquivos ao Storage, aplicou migrations ou leu dados de produção. As credenciais foram lidas apenas nos arquivos privados autorizados e não aparecem nas evidências.

## Primeira execução preservada

A primeira tentativa parou em SIGNIN_A com OWNERSHIP_REFUSED: o PowerShell7.6 converteu `email_confirmed_at` em DateTime, enquanto o verificador exigia string. Uma conta foi criada e sua sessão efetivamente iniciada; o runner manteve UNCERTAIN_HOLD e não tentou limpar automaticamente. A reconferência exata provou UUID/marcadores, papel comum e a sessão da fixture. Uma operação de recuperação separada fez GET com conferência completa, um DELETE e GET404; a consulta MCP confirmou zero registros depois. Nenhum PASS substitui a primeira recusa.

V2 fixa o parser com DateKindString e exige PowerShell7.5+, sem relaxar predicados. Novo manifesto, dois novos UUIDs e novas senhas em memória; não retomou o journal anterior. O runnerV1, seu manifesto/journal e o resultado continuam preservados fora do Git.

## Evidências sanitizadas

- [Primeiro resultado](evidence/homolog-auth-20261023/attempt1-result.json), SHA256 `3ff937cb1ac80082e38990dc5a8716e065d4a604e62d94b240656202b6b4f580`.
- [Recuperação exata da fixture](evidence/homolog-auth-20261023/attempt1-cleanup.json), SHA256 `a82897684df540fce3b81d0a4eac35fcc7ca082d826057e30682a7ee16e0d439`.
- [Segundo resultado](evidence/homolog-auth-20261023/attempt2-result.json), SHA256 `163fdb46aa0d43734f0c422bdc76340e350c2a50dfd81eb8c6bb591b53b66204`.
- [Contagens finais reais](evidence/homolog-auth-20261023/final-counts.json), extraídas do retorno do MCP dedicado. Não contém IDs pessoais, conteúdo de perfil, senhas, tokens, links de autenticação ou chaves.

Source pins do runner conferem os contratos Auth/Admin/Identity/Sessions/Calendar existentes na fonte4439; não substituem o CI próprio do candidato. RunnerV2 SHA256 `61e7bbfd8369a674323853c3b652c8d3ae92bc03bb59f8445c18d38b9d451c84`. O aceite é de serviço e schema, não do frontend de uma fonte futura.

## Pendências

Autenticação e comandos pelas telas do Preview, persistência/imagens dos módulos, onboarding, mobile e recuperação operacional ainda exigem suas provas. Merge e deploy de produção permanecem bloqueados; nenhuma migration histórica foi reaplicada.
