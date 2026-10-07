# Drive — T-012

Modo **Operate**. Autoridade D-030/DS 2.1, doc 13 T-012 e HTML aprovado. O recorte explora pastas, arquivos e lixeira de exemplo pelo mesmo reader; conteúdo binário e comandos de storage pertencem a T-022.

- **OBSERVADO:** breadcrumb, pastas em superfícies sólidas, uso de armazenamento, lista de arquivos com tamanho e data. Tipografia Geist e tokens existentes.
- **RECOMENDADO:** raiz mostra arquivos recentes; `?folder=<id>` restringe a pasta e `?view=trash` filtra a mesma coleção. Uso soma também a lixeira e não usa os números decorativos do protótipo. Caminho inválido tem recuperação para Meu Drive.
- **RECOMENDADO:** DataTable fornece busca, ordenação por nome/tamanho/destaque, paginação e cards mobile com o mesmo array. Datas são legíveis no fuso São Paulo; ordem inicial é por instante de modificação.
- **INFERIDO:** grade pastas/uso 8:4 até 900px e coluna única abaixo; pastas adaptáveis de 200px e lista única abaixo de 600px. Esqueleto reproduz breadcrumb, pastas, uso e linhas/cards.

Drawer de metadados usa o foco e Escape do primitivo compartilhado. Não existem botões de upload, download, exclusão, restauração ou destaque sem contratos. Valores de destaque são somente leitura. Texto informa explicitamente a natureza dos arquivos.

Alvos 44px, foco em duas camadas, sem movimento decorativo, sem novo par de cores. Testes cobrem caminhos/ciclos/lixeira/contagem/imutabilidade; E2E prepara a jornada e 320/390/1280px. Validação visual e medição integrada ficam registradas pelo root, sem aprovação antecipada neste brief.
