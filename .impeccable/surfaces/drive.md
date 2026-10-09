# Drive — T-012/T-022

Modo **Operate**. Autoridade D-030/DS 2.1, doc 13 T-012 e HTML aprovado. O recorte explora pastas, arquivos e lixeira de exemplo pelo mesmo reader; conteúdo binário e comandos de storage pertencem a T-022.

- **OBSERVADO:** breadcrumb, pastas em superfícies sólidas, uso de armazenamento, lista de arquivos com tamanho e data. Tipografia Geist e tokens existentes.
- **RECOMENDADO:** raiz mostra arquivos recentes; `?folder=<id>` restringe a pasta e `?view=trash` filtra a mesma coleção. Uso soma também a lixeira e não usa os números decorativos do protótipo. Caminho inválido tem recuperação para Meu Drive.
- **RECOMENDADO:** DataTable fornece busca, ordenação por nome/tamanho/destaque, paginação e cards mobile com o mesmo array. Datas são legíveis no fuso São Paulo; ordem inicial é por instante de modificação.
- **INFERIDO:** grade pastas/uso 8:4 até 900px e coluna única abaixo; pastas adaptáveis de 200px e lista única abaixo de 600px. Esqueleto reproduz breadcrumb, pastas, uso e linhas/cards.

No modo conectado T-022, drawer de metadados e formulários usam foco/Escape dos primitivos. Toolbar concentra enviar e criar pasta; soltar arquivos é uma alternativa ao botão. A coleção real expõe rename/move/destaque/lixeira/restauração/download por contratos. Quota inclui lixo/anexos/avatar; feedback revela cada fase do upload e erros preservam dados. Confirmação do mesmo envio resolve resultado incerto no journal compartilhado. Caminhos indisponíveis recuperam para raiz/lixeira. Pastas mantêm superfícies sólidas existentes; nenhum novo estilo temático ou cor foi introduzido. O modo demo continua identificando seus dados de exemplo.

Alvos 44px, foco em duas camadas, sem movimento decorativo, sem novo par de cores. Testes cobrem caminhos/ciclos/lotes/quota/imutabilidade, pipeline privado e guards. PGlite comprova metadata/RLS em banco descartável, sem equivalência com Storage hospedado. Browser, 320/390/1280px, leitor/Tab, iPhone e validação visual integrada permanecem pendentes no relatório root. [Relatório técnico](../../docs/implementation/t022-drive-storage.md).
