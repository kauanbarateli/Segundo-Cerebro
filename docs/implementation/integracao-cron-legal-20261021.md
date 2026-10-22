# Integração da base pública e do Calendário — 21/10/2026

## Autorização e destino

O mantenedor autorizou corrigir os bloqueios da PR #95, integrar as alterações validadas e prosseguir nas pendências do MVP. A autorização de deploy após revisão/checks e conferência do destino permanece a de 21/10, com Vercel Pro confirmado. Não autoriza contratar serviços, abrir vendas Asaas, alterar contas alheias ou aplicar schema por CI/build/deploy.

Destino conferido pela integração Vercel: equipe `team_BqlhayzOBFfZT7Rv16j4OeUK`, projeto `prj_68nPrMlzdTLhvhXF2zWvNK6BFaW2`/`segundo-cerebro-of`. A produção observada está READY em `dpl_2HTfZ1ePMb759Uw2onhFqi76buX5`, código `b67f58ac3973fcef5f45daa23f36cdf84432a3fb`, publicado da branch legal. O domínio é `https://www.segundocerebroapp.com.br`. A main GitHub ainda observada em `f3d1896` é anterior ao código publicado; não selecioná-la como rollback ou candidato só por ser a branch padrão.

O Supabase pessoal `rishenjoikgmfubmnfiu` continua recusando o acesso MCP. Isso foi informado ao mantenedor para reautorização. Nenhum recurso VOE/BlackSheep/legado será usado como alternativa.

## Fatia inicial proposta

Reconciliar primeiro a cadeia de planejamento #69, páginas legais/Auth #70 e Calendário/segurança #95, preservando o código b67 já publicado. Essa fatia tem as mesmas 19 migrations da base de produção; não incorpora as candidatas 020/021/022 de imagens/Hábitos/Capturas nem os contratos comerciais não autorizados para execução.

A correção tem dois eixos independentes: obtenção dos binários exatos do Playwright 1.63 no CI e ordenação do encerramento de APIs/handlers no Admin. A primeira falha de 08803f6 foi TLS no download do Chromium; a segunda foi uma API sem terminal original no fechamento do Admin. Nenhuma recebe aceite por rerun, descarte de tracker, ACK de rota ou aumento do prazo original.

A preparação de integração usa `main: false` em `git.deploymentEnabled`, preservando as exclusões anteriores. Isso controla o deploy automático por Git da futura main; não pausa o serviço publicado. O código da revisão também conserva sua exclusão de deploy. Não confundir essa guarda com evidência de CI ou promoção de produção.

## Ordem de execução

1. Conferir heads, bases e árvore limpa dos dois checkouts. Esperar todos os runs originais do último SHA Root terminarem antes de publicar outro; preservar seus resultados.
2. Revisar o lote de correções com leitor independente. Reconciliar a base da PR #95 com main, se a revisão confirmar que ela é ancestral do pacote e a árvore continua preservando b67. Registrar a mudança de escopo da PR e verificar os eventos gerados antes do novo push, para não cancelar uma execução por concorrência.
3. Publicar um lote coerente e acompanhar seus originais: auditoria completa, SQL descartável, tipagem, lint, unidades nos dois fusos, scripts e negativos, build/E2E, cenários nativos e limpeza. O teste de interface precisa aprovar o ambiente de imagem novo; a imagem ou o preflight isolado não o certificam.
4. Antes da integração na branch padrão, suspender próximos disparos do scheduler pessoal e conferir o término dos anteriores. Pausar variável ou cancelar job não prova término remoto. Não repetir resultados incertos. Preservar o deployment aprovado e os segredos existentes.
5. Reconferir main e HEAD revisado, realizar merge condicionado ao SHA exato e conferir a árvore resultante. Verificar os estados das PRs ancestrais e registrar sua incorporação por commits; não presumir merge automático de cada uma. Não apagar branches usadas como referência de produção ou de revisão.
6. Observar os runs originais da main resultante e a proteção de deploy. Produção só pode receber um candidato com destino, SHA/árvore, variáveis e checks conferidos. Quando o fluxo exigir estágio, manter os aliases no deployment anterior, construir com ambiente Production e promover somente o ID verificado. Não promover um Preview supondo que seu build seja o de Production.
7. Validar as rotas públicas e a fronteira de autenticação após publicação. Login/recuperação/Calendário já têm seus aceites humanos em www; registrar qualquer nova validação sem herdar um resultado de CI como teste pessoal.
8. Realizar a rodada supervisionada única do Cron em main e conferir resultado fechado e registro no Admin; zero contas processadas não prova sincronização. Restabelecer o scheduler somente após aceite e observar o próximo disparo original.

## Integração posterior da cadeia de funcionalidades

As PRs #91–94 permanecem uma cadeia separada e já têm evidências próprias, incluindo a correção de segurança no HEAD 19e9848. Reconciliar a base pública final nessa cadeia antes de publicar outro candidato. A candidata 021 recusa o escritor anterior e novos campos de imagens/conteúdo exigem leitores compatíveis; não publicar essa cadeia sobre o banco antigo por mera sequência de merges.

Antes da ativação dessas funcionalidades, conferir o projeto pessoal, a ordem das migrations e a ausência do Calendar reservado na cadeia de 22 instalações. Qualquer inclusão/reagendamento exige nova revisão e validação; não inserir uma migration antiga silenciosamente. Aplicação supervisionada, compatibilidade de leitores/escritores, plano de retorno e aceites de persistência/Storage/restore continuam separados. 001–019 não serão reaplicadas.

## Estado deste documento

Preparação operacional. Correções, revisão, CI do novo candidato, merge, deploy e ensaio do scheduler ainda precisam de resultados próprios. Nenhuma dessas operações é declarada concluída pela escrita deste roteiro. As issues #35/#43/#75/#96 e as PRs registram o andamento por SHA, distinguindo implementado, validado e pendente.
