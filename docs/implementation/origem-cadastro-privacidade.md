# Origem do cadastro: apresentação e consentimento

Decisão do mantenedor: os campos facultativos `utm_source`, `utm_medium`, `utm_campaign`, `utm_term` e `utm_content` pertencem à origem do cadastro vinculada ao usuário. **Configurações não apresenta os valores desses campos.** A consulta individual está prevista somente para o futuro ADM; ela ainda não foi implementada ou autorizada por este registro.

O comportamento existente de Configurações deve permanecer: a pessoa consulta se há consentimento ativo e sua validade e pode retirá-lo. A rota autenticada retorna apenas estado e validade; valores inesperados fazem a resposta falhar fechada. A retirada atua sobre o usuário da sessão, não sobre uma identidade fornecida livremente pelo cliente. Não incluir UTMs em eventos ou logs ao fazer essas operações.

O cadastro público segue sujeito às suas próprias validações e gates. A coleta é opcional e depende de escolha afirmativa; a origem é vinculada à admissão após confirmação da identidade. Retirada e expiração continuam regidas pelos contratos existentes. A instalação de migrations em QA não comprova que essas funções estejam ativas em produção ou que o descarte físico esteja agendado; a confirmação de e-mail permanece na #215 e a retenção operacional deve ser acompanhada na #136.

Uma futura consulta individual no ADM exigirá projeto e revisão próprios de autorização, isolamento, minimização, auditoria e ciclo de vida; não expor essa consulta apenas por registrar esta decisão. A tela agregada do Master segue contrato separado e não recebe permissão para divulgar textos livres.
