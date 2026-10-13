import type { StaticImageData } from "next/image";
import buscaCelularEscuro from "./telas/busca-celular-escuro.webp";
import buscaCelular from "./telas/busca-celular.webp";
import buscaEscuro from "./telas/busca-escuro.webp";
import busca from "./telas/busca.webp";
import capturarCelularEscuro from "./telas/capturar-celular-escuro.webp";
import capturarCelular from "./telas/capturar-celular.webp";
import capturarEscuro from "./telas/capturar-escuro.webp";
import capturar from "./telas/capturar.webp";
import cofreCelularEscuro from "./telas/cofre-celular-escuro.webp";
import cofreCelular from "./telas/cofre-celular.webp";
import cofreEscuro from "./telas/cofre-escuro.webp";
import cofre from "./telas/cofre.webp";
import financeiroCelularEscuro from "./telas/financeiro-celular-escuro.webp";
import financeiroCelular from "./telas/financeiro-celular.webp";
import financeiroEscuro from "./telas/financeiro-escuro.webp";
import financeiro from "./telas/financeiro.webp";
import habitosCelularEscuro from "./telas/habitos-celular-escuro.webp";
import habitosCelular from "./telas/habitos-celular.webp";
import habitosEscuro from "./telas/habitos-escuro.webp";
import habitos from "./telas/habitos.webp";
import inicioCelularDiaEscuro from "./telas/inicio-celular-dia-escuro.webp";
import inicioCelularDia from "./telas/inicio-celular-dia.webp";
import inicioCelularEscuro from "./telas/inicio-celular-escuro.webp";
import inicioCelular from "./telas/inicio-celular.webp";
import inicioEscuro from "./telas/inicio-escuro.webp";
import inicio from "./telas/inicio.webp";
import projetoCelularEscuro from "./telas/projeto-celular-escuro.webp";
import projetoCelular from "./telas/projeto-celular.webp";
import projetoEscuro from "./telas/projeto-escuro.webp";
import projeto from "./telas/projeto.webp";

/**
 * Texto da apresentação comercial. Cada afirmação corresponde a um comportamento
 * existente no app; recursos fora do MVP (Drive, IA, grafo persistente, cobrança)
 * não aparecem. As telas são capturas do modo demonstração com dados fictícios,
 * nos dois temas, geradas por scripts/landing/capturar-telas.mjs.
 */
export interface Variantes {
  claro: StaticImageData;
  escuro: StaticImageData;
}

export interface Tela {
  /** Versão exibida a partir de 768px; segue o tema resolvido da página. */
  amplo: Variantes;
  /** Mesma cena na tela do celular, exibida abaixo de 768px. */
  celular?: Variantes;
  descricao: string;
  formato: "janela" | "recorte" | "celular" | "dialogo";
}

export interface Pergunta {
  id: string;
  pergunta: string;
  resposta: string;
  texto: string;
  fatos: readonly string[];
  tela: Tela;
}

export const hero = {
  titulo: ["Capture agora.", "Encontre depois."],
  chamada: "Notas, tarefas, agenda, hábitos, finanças e senhas num só lugar, ligados entre si e prontos quando você precisa.",
  acao: "Ver como funciona",
  indice: "Comece por uma pergunta",
  tela: {
    amplo: { claro: inicio, escuro: inicioEscuro },
    celular: { claro: inicioCelular, escuro: inicioCelularEscuro },
    descricao: "Início do Segundo Cérebro: foco do dia, tarefas de hoje, agenda e hábitos na mesma tela.",
    formato: "janela",
  } satisfies Tela,
} as const;

export const dispersao = {
  titulo: "Cada resposta mora num lugar diferente.",
  texto: "A ideia ficou num bloco de notas, a tarefa numa lista, a reunião no calendário. Quando você precisa, procura em vários lugares e ainda perde o contexto.",
  lugares: [
    ["Onde anoto isso?", "Num bloco de notas qualquer"],
    ["O que é hoje?", "Entre o calendário e a lista de tarefas"],
    ["Para onde foi o dinheiro?", "Numa planilha à parte"],
    ["Onde está aquilo?", "Em algum aplicativo, em alguma conversa"],
    ["Estou mantendo o ritmo?", "Num aplicativo que só faz isso"],
    ["Qual era a senha?", "No papel, no navegador ou na memória"],
  ],
} as const;

export const movimentos = {
  titulo: "Um lugar. Três movimentos.",
  itens: [
    { nome: "Capture.", texto: "Tudo começa como uma anotação rápida na Caixa de entrada. O destino você decide depois." },
    { nome: "Conecte.", texto: "Vínculos ligam notas, tarefas, eventos e projetos sem copiar nada." },
    { nome: "Reencontre.", texto: "O Início junta o que importa hoje, e a busca encontra o resto." },
  ],
} as const;

export const perguntas = {
  titulo: "Seis perguntas, respondidas pelo próprio app.",
  itens: [
    {
      id: "anotar",
      pergunta: "Onde anoto isso?",
      resposta: "Em Capturar. Organize depois.",
      texto: "Escreva do jeito que vier: nota, ideia ou tarefa. Tudo cai na Caixa de entrada, e decidir o destino fica para quando você puder.",
      fatos: [
        "Conecte notas com [[nome da nota]] e veja quem menciona cada uma.",
        "Transforme uma captura em tarefa sem perder a ligação com a origem.",
        "Anexe até seis imagens por captura.",
      ],
      tela: {
        amplo: { claro: capturar, escuro: capturarEscuro },
        celular: { claro: capturarCelular, escuro: capturarCelularEscuro },
        descricao: "Editor de Capturar com a nota “Reforma da sala” em escrita e um vínculo com a nota “Paleta de cores”.",
        formato: "recorte",
      },
    },
    {
      id: "hoje",
      pergunta: "O que é hoje?",
      resposta: "O Início responde numa tela.",
      texto: "Foco do dia, tarefas, agenda, hábitos, o mês financeiro e a caixa de entrada lado a lado. Conclua uma tarefa ou marque um hábito ali mesmo.",
      fatos: [
        "A agenda vem de até duas contas Google, somente leitura.",
        "No celular, os módulos principais ficam ao alcance do polegar.",
      ],
      tela: {
        amplo: { claro: inicioCelularDia, escuro: inicioCelularDiaEscuro },
        descricao: "Início no celular com a agenda e os hábitos de hoje, acima da barra de navegação inferior.",
        formato: "celular",
      },
    },
    {
      id: "dinheiro",
      pergunta: "Para onde foi o dinheiro?",
      resposta: "O Financeiro mostra o mês inteiro.",
      texto: "Contas, cartões e lançamentos no mesmo lugar, com o patrimônio, o resultado da competência e as despesas por categoria.",
      fatos: [
        "A fatura do cartão é calculada pelas compras e aceita pagamento parcial.",
        "Limites mensais por categoria no plano do mês.",
        "Ocultar valores com um toque quando houver alguém por perto.",
      ],
      tela: {
        amplo: { claro: financeiro, escuro: financeiroEscuro },
        celular: { claro: financeiroCelular, escuro: financeiroCelularEscuro },
        descricao: "Despesas do mês por categoria no Financeiro, com o gráfico e o valor de cada categoria.",
        formato: "recorte",
      },
    },
    {
      id: "aquilo",
      pergunta: "Onde está aquilo?",
      resposta: "A busca procura em todos os módulos.",
      texto: "Ctrl ou Cmd + K abre a busca em qualquer tela. Tarefas, capturas, páginas, lançamentos, projetos e hábitos aparecem juntos, sem se importar com acentos.",
      fatos: [
        "Atalhos para nova captura e nova tarefa na mesma caixa.",
        "Setas e Enter levam ao resultado sem tirar a mão do teclado.",
      ],
      tela: {
        amplo: { claro: busca, escuro: buscaEscuro },
        celular: { claro: buscaCelular, escuro: buscaCelularEscuro },
        descricao: "Busca do Segundo Cérebro com a palavra “sala” e resultados em Tarefas, Capturas e Projetos.",
        formato: "dialogo",
      },
    },
    {
      id: "ritmo",
      pergunta: "Estou mantendo o ritmo?",
      resposta: "Cada hábito mostra a própria sequência.",
      texto: "Todos os dias, em dias da semana ou com meta semanal: cada hábito tem sua cadência, e uma pausa registrada é considerada na sequência.",
      fatos: [
        "Marque o dia pelo Início ou registre um dia que passou.",
        "Mapa das últimas 26 semanas para cada hábito.",
        "Pausas para um hábito ou para todos, com motivo e data de fim opcionais.",
      ],
      tela: {
        amplo: { claro: habitos, escuro: habitosEscuro },
        celular: { claro: habitosCelular, escuro: habitosCelularEscuro },
        descricao: "Hábitos do dia com a sequência de cada um e o progresso da semana.",
        formato: "recorte",
      },
    },
    {
      id: "senha",
      pergunta: "Qual era a senha?",
      resposta: "No Cofre, cifrada antes de sair do aparelho.",
      texto: "O conteúdo é cifrado no navegador a partir da sua senha mestra. O servidor guarda apenas dados cifrados e não consegue lê-los.",
      fatos: [
        "Kit de recuperação em duas metades, guardado só por você.",
        "Bloqueio após 5 minutos sem uso, ao ocultar a aba ou trocar de janela.",
        "A senha copiada sai da área de transferência em 30 segundos, quando o navegador permite.",
      ],
      tela: {
        amplo: { claro: cofre, escuro: cofreEscuro },
        celular: { claro: cofreCelular, escuro: cofreCelularEscuro },
        descricao: "Cofre desbloqueado com três itens cifrados: um login de banco, a senha do Wi-Fi e uma nota segura.",
        formato: "recorte",
      },
    },
  ] satisfies readonly Pergunta[],
} as const;

export const conexoes = {
  titulo: "Uma informação, vários lugares. Nenhuma cópia.",
  texto: "Um projeto reúne tarefas, capturas, cadernos e a agenda ligada a ele. Cada item continua sendo um só e aparece onde faz sentido.",
  tela: {
    amplo: { claro: projeto, escuro: projetoEscuro },
    celular: { claro: projetoCelular, escuro: projetoCelularEscuro },
    descricao: "Projeto “Mudança de casa” com o progresso das tarefas, as capturas vinculadas, os cadernos e a agenda ligada.",
    formato: "janela",
  } satisfies Tela,
  regras: [
    { titulo: "Vincular nunca copia.", texto: "A tarefa que nasceu de uma captura continua ligada à origem." },
    { titulo: "Renomear não quebra nada.", texto: "As referências [[...]] acompanham o novo nome da nota." },
    { titulo: "Excluir um projeto preserva os itens.", texto: "Tarefas, capturas e cadernos seguem com seus vínculos." },
  ],
} as const;

export const principios = {
  titulo: "Feito para ser só seu.",
  itens: [
    { titulo: "Contas isoladas", texto: "Cada pessoa tem a própria conta, separada no banco de dados. Não existe espaço compartilhado." },
    { titulo: "Cofre cifrado no navegador", texto: "Senha mestra e kit de recuperação ficam com você. Sem eles, nem o servidor recupera os dados." },
    { titulo: "Administração sem acesso ao conteúdo", texto: "Quem opera o serviço vê dados da conta, nunca suas notas, tarefas, finanças ou o Cofre." },
    { titulo: "Agenda somente leitura", texto: "O Calendário lê até duas contas Google e não cria, altera nem apaga eventos." },
  ],
} as const;

/**
 * Ponto de integração comercial. Hoje o acesso está fechado e o botão apenas
 * informa isso na própria página, sem enviar dados nem redirecionar. Quando
 * houver um destino aprovado (lista de interesse, contato ou checkout), troque
 * por `{ tipo: "link", href, rotulo }`; preços e planos entram como uma nova
 * seção antes de "acesso" em landing-page.tsx.
 */
export type DestinoDeAcesso =
  | { tipo: "aviso"; rotulo: string; mensagem: string }
  | { tipo: "link"; rotulo: string; href: string };

export const acesso = {
  titulo: "Comece pela próxima ideia.",
  texto: "O Segundo Cérebro está em validação com um grupo pequeno de pessoas. O acesso ainda não está aberto ao público.",
  destino: {
    tipo: "aviso",
    rotulo: "Quero acesso",
    mensagem: "Ainda não há como pedir acesso. Quando as inscrições abrirem, esta página vai mostrar como participar.",
  } as DestinoDeAcesso,
} as const;

export const rodape = {
  lema: "Capture, conecte, reencontre.",
  aviso: "As telas desta página são capturas do aplicativo em modo demonstração, com dados fictícios.",
} as const;

/** Indexação pública depende de domínio e oferta definidos; até lá, a página não entra em buscadores. */
export const INDEXACAO_PUBLICA = false;
