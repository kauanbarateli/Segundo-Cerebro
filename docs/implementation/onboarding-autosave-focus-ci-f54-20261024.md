# Onboarding — falha própria do teste de foco e correção restrita

**OBSERVADO:** f54 terminou com18/20workflows e20/22jobs SUCCESS. Os dois gerais falharam no mesmo teste novo de foco. Cada um passou3618unidades em UTC e São Paulo,2142contratos de scripts e532dos533E2E. Captura26 e upload27 foram pulados. Os dois logs originais foram obtidos uma vez; a coorte permanece FAIL. O [recibo](evidence/onboarding-focus-ci-f54-20261024.json) vincula runs, jobs, hashes e limites.

A asserção esperava foco em Continuar após o autosave. O log mostra o botão inativo no fim da espera; não registra o elemento realmente focado nem o instante intermediário. **INFERIDO pelo Source:** Continuar recebe loading=busy e o Button fica disabled; o autosave mantém campos editáveis, mas bloqueia navegação. Esse alvo não serve para testar foco persistente durante o salvamento.

A correção altera só esse bloco de teste. Segura a resposta do próximo save sintético, focaliza Seu nome e verifica campo habilitado/focado e Continuar desabilitado durante o save. Um finally libera a resposta mesmo se houver falha. Após Continuar reabilitar, verifica novamente foco/habilitação do campo. Preserva profile vazio, nenhuma confirmação, efeitos ou erros e a contagem de testes. Não muda aplicação, Button, travas, protocolo, timeout, schema ou workflow.

Root revisou o delta e executou ESLint com Node24, exit0. Um revisor independente conferiu o bloco, fixture, sincronização e liberação, sem bloqueador concreto; parecer SHA256 `514461bbfb19fe145f878fcb627e13857ad94e6a5fa22063a710dcd8a2e43f25`. O teste corrigido ainda depende de execução própria no próximo CI; não foi executado localmente no notebook de8GB.

O próximo candidato pode ser usado exclusivamente no Preview isolado para validar os sete arquivos de onboarding já revisados, em paralelo ao CI, conforme a autorização vigente de homologação. Isso não é aceite do f54 nem promoção de testes anteriores. Antes de criar o Preview, conferir SHA, branch, equipe, projeto, target de Preview e banco `twrydxsdemaykgvdlpyd`. Merge e produção seguem bloqueados; a captura de Projetos e os demais aceites permanecem separados.
