# G4 V3 — correção estática do teste SQL canônico

Um único arquivo novo: tests/adapters/onboarding-oauth-canonical-sql.test.ts, baseado em Source 3403. O delta V2→V3 restaura somente o placeholder literal $1 da consulta de status da conta na linha 102. V1 e V2 permanecem preservadas/HOLD; nenhum SQL/runtime/Node foi executado.

A chamada pública real complete da V2 foi mantida: prepare vazio deixa executing; complete torna a rodada complete e permite que start crie outra. Os SQLSTATEs, nulls contratuais, vetos, replay, limites, projeções, eventos, recibos e rollback não mudaram.

A autoria conferiu os 14 db.query: sete parametrizados (20 ocorrências $n) e sete sem parâmetros. Cada conjunto $1..$n corresponde ao array real de argumentos; não há interpolação de template JS. O relatório de placeholders está no MANIFEST. Isso é inspeção estática, não parser SQL nem execução.

O helper carrega historical026 canônico completo. A última definição de google_calendar_call é a migration de participantes de 22/10, depois decorada pela guarda de 026; calendários vazios não exercitam participantes. Dois donos e três sessões são linhas Auth sintéticas, e os tokens são inertes. Interleavings são seriais. Nenhuma prova de GoTrue, OAuth remoto, consentimento, HTTPS/cookies ou instalação hospedada.

Apply --check --whitespace=error-all passou sem aplicar; os oito suportes continuam iguais aos blobs 3403. Root precisa fazer a revisão independente e executar o caso no canal permitido antes de qualificar G4. A autoauditoria da autoria não é revisão independente. Restore permanece pós-lançamento.
