# Admissão pública: candidato isolado

Este SQL é um experimento local incompleto para #135. Não pertence à cadeia de migrations nem ao SQL Editor. Ele prepara apenas a barreira de sessão e a distinção entre identidades anteriores confirmadas, pendentes e criadas pelo fluxo Admin; não implementa inscrição, confirmação, prova de senha, retomada, onboarding público ou liberação de novos usuários.

Antes de qualquer promoção, concluir #134; revisar com cuidado o corte de usuários anteriores, OAuth, recuperação, novos fluxos Admin e concorrência da instalação; fornecer um caminho seguro para usuários não confirmados; atualizar o catálogo e tipos; testar Auth/SQL/Storage, usuários legados/Admin e isolamento em QA. Não aplicar nem ativar o cadastro a partir deste arquivo. Reverter a aplicação antiga sem preservar a barreira de admissão pode reabrir acesso indevido e exige plano próprio de compatibilidade.

Na consulta somente de contagens agregadas realizada em 31/10/2026, QA possuía uma identidade e produção pessoal duas; todas estavam com e-mail confirmado e já haviam entrado. Não havia identidades anônimas nem sem confirmação nesses retratos. Isso não determina o corte futuro nem comprova direitos, tipo de provedor ou segurança de usuários que venham a existir até a implantação.

Em PGlite descartável, após as 27 fontes verificadas por hash, o teste candidato cobriu identidade confirmada anterior, usuário anterior não confirmado, inscrição direta com metadata forjada, RLS de perfil, sessão revogada e moderação. Uma fixture sintética exerceu a conclusão administrativa e a recusa sem marcador correto; ela não substitui o teste conectado da saga Admin real, de Auth ou de Storage.
