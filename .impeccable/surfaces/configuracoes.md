# Configurações — T-012

Modo **Operate**. Casca de preferências com autoridade D-030/DS 2.1 e doc 13 T-012. Preserva DemoSettings, ThemeSelector e InstallHelp, inclusive nomes acessíveis utilizados pelas jornadas anteriores.

- **OBSERVADO:** Perfil e Aparência em cartões, identidade visual neutra, avatar de 52px e quebra em coluna abaixo de 980px.
- **RECOMENDADO:** perfil somente leitura usa Pessoa de exemplo e domínio `.invalid`, vindo do reader. Ausência e falha são estados distintos; controles de navegação e recuperação continuam utilizáveis.
- **RECOMENDADO:** chips Perfil/Aparência/Módulos/Demonstração/Instalação usam âncoras, aria-current e margem de rolagem de 100px. Preferência de tema permanece local, sem alegação de sincronização entre aparelhos.
- **RECOMENDADO:** controles explícitos para cenário vazio/exemplo e falha da próxima leitura. O seletor de falha inclui apenas módulos permitidos. O componente não consulta os módulos selecionados: delega ao provider e oferece link para abrir.

Skeleton do perfil tem círculo e duas linhas; erro é limitado ao perfil, com retry. Cenário vazio zera a massa real e informa que substituirá dados/rascunhos desta visita, preservando acesso. Não há cadastro, alteração de senha, notificações ou integrações simuladas como operações reais.

Alvos e campos seguem os primitivos, foco em duas camadas, cores dos tokens e nenhum movimento novo. E2E cobre chips, tema, preservação dos controles e cenário/falha reais. Validação visual final fica registrada pelo root.
