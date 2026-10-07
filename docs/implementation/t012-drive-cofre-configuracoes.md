# T-012 — Drive, Cofre e Configurações

As três rotas usam o provider compartilhado e os mesmos gates de acesso das demais cascas. Componentes vivem em `src/components/features/drive`, `cofre` e `configuracoes`; nenhuma feature importa outra. Não foram adicionados SDKs, banco, dados pessoais ou dependências.

## Drive

`DriveWorkspace` consulta `drive`. A raiz lista as pastas e os quatro arquivos recentes ativos; `?folder=<id>` navega por contêiner e `?view=trash` filtra os registros excluídos da mesma coleção. Breadcrumb resolve ancestrais por ID, recusa ciclos e caminhos ausentes/excluídos. A soma de uso inclui lixeira: 2.183.987 bytes para a massa de exemplo, capacidade 1 GiB. Não há números decorativos independentes dos registros.

DataTable compartilha busca/ordenação/paginação entre tabela desktop e cards mobile. A lista inicial ordena o instante de modificação; o usuário ordena nome/tamanho/destaque. Datas exibem São Paulo. Selecionar um arquivo abre Drawer com nome, MIME, tamanho, pasta e data. Destaque é metadado somente leitura.

O recorte não simula upload, download, restauração ou remoção: essas operações aguardam contratos de Drive e storage. Imagens reencodadas de Capturar não são copiadas para o Drive. Skeleton e erro/retry pertencem ao reader; lixeira/pasta vazias têm retorno navegável.

## Cofre

`VaultWorkspace` consulta somente metadados `vault`. A maquete passa por criar, bloqueado e prévia, com nomes ilustrativos e estado vazio se a coleção vier sem itens. Campos readOnly recebem uma senha ilustrativa por botão; não recebem credencial pessoal. Entendimento do caráter demonstrativo é obrigatório na criação. Transições apagam os valores dos campos e movem foco ao título.

Nenhuma senha vai para query, local/sessionStorage, eventos ou clipboard. Não há criptografia ou alegação de que ela exista. Kit, auto-lock, recuperação, cópia e edição de segredos permanecem fora do recorte. O desenho usa Card/Field/Button e as cores neutras existentes.

## Configurações

`SettingsWorkspace` consulta `settings` para um perfil sintético somente leitura; `profile=null` recebe mensagem própria. Perfil falhando não desabilita preferências. PageNavigation contém cinco âncoras com destino ativo: Perfil, Aparência, Módulos, Demonstração e Instalação.

DemoSettings, ThemeSelector e InstallHelp foram reutilizados sem alterar seus contratos. Os controles adicionais chamam `failNextRead` e `setScenario` do provider: falha real no reader uma vez, retry no módulo, cenário vazio real e reposição explícita de exemplos. O seletor de falha exclui módulos vetados. Não há query adicional ao selecionar destino; a leitura de uma rota desmontada só ocorre ao abri-la.

## Validação deste recorte

- Seis testes de projeção do Drive passaram, inclusive em `TZ=UTC`: coleção compartilhada, soma da lixeira, ancestralidade, referências inválidas/ciclos, ordenação por instante, imutabilidade e vazio.
- Typecheck, lint focado e portão de camadas passaram após integração.
- Dez jornadas estão preparadas em `tests/e2e/drive-vault-settings.spec.ts`: Drive, maquete do Cofre, chips/tema/acesso, três falhas reais com retry, cenário vazio e três larguras (320/390/1280).
- E2E, contraste e revisão visual final aguardam execução integrada pelo root. Nenhum build, servidor, navegador, banco, commit ou push foi executado por este recorte.

Os briefs em `.impeccable/surfaces/{drive,cofre,configuracoes}.md` distinguem observações da referência e adaptações recomendadas. A interface não declara conclusão dos tickets de produção T-022/T-024.
