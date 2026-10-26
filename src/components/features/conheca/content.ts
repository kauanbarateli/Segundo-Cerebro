import type { StaticImageData } from "next/image";
import capturarCelularEscuro from "./telas/capturar-celular-escuro.webp";
import capturarCelular from "./telas/capturar-celular.webp";
import capturarEscuro from "./telas/capturar-escuro.webp";
import capturar from "./telas/capturar.webp";
import inicioCelularEscuro from "./telas/inicio-celular-escuro.webp";
import inicioCelular from "./telas/inicio-celular.webp";
import inicioEscuro from "./telas/inicio-escuro.webp";
import inicio from "./telas/inicio.webp";
import projetoCelularEscuro from "./telas/projeto-celular-escuro.webp";
import projetoCelular from "./telas/projeto-celular.webp";
import projetoEscuro from "./telas/projeto-escuro.webp";
import projeto from "./telas/projeto.webp";
import calendarioListaCelularEscuro from "./telas/calendario-lista-celular-escuro.webp";
import calendarioListaCelular from "./telas/calendario-lista-celular.webp";
import calendarioListaEscuro from "./telas/calendario-lista-escuro.webp";
import calendarioLista from "./telas/calendario-lista.webp";
import tarefasKanbanCelularEscuro from "./telas/tarefas-kanban-celular-escuro.webp";
import tarefasKanbanCelular from "./telas/tarefas-kanban-celular.webp";
import tarefasKanbanEscuro from "./telas/tarefas-kanban-escuro.webp";
import tarefasKanban from "./telas/tarefas-kanban.webp";

/** D-077 / doc17: três capítulos sobre capturas reais do app em demonstração.
 * Checkout, ofertas, Drive e operações autenticadas não integram esta página. */
export interface Variantes { claro: StaticImageData; escuro: StaticImageData }
export interface Tela {
  amplo: Variantes;
  celular?: Variantes;
  descricao: string;
  formato: "janela" | "recorte" | "celular" | "dialogo";
}
export interface Capitulo {
  id: "captura" | "agenda" | "projetos";
  atalho: string;
  titulo: string;
  texto: string;
  fatos: readonly string[];
  tela: Tela;
}

export const hero = {
  titulo: ["Capture agora.", "Encontre depois."],
  chamada: "Seu dia, suas ideias e seus planos. Um só lugar para organizar a vida.",
  acao: "Ver como funciona",
  indice: "Conheça os recursos",
  tela: {
    amplo: { claro: inicio, escuro: inicioEscuro },
    celular: { claro: inicioCelular, escuro: inicioCelularEscuro },
    descricao: "Início do Segundo Cérebro: foco do dia, tarefas de hoje, agenda e hábitos na mesma tela.",
    formato: "janela",
  } satisfies Tela,
} as const;

export const movimentos = {
  titulo: "Menos coisas espalhadas. Mais espaço para o que importa.",
  itens: [
    { nome: "Capture uma ideia.", texto: "Anote agora. Decida o destino depois." },
    { nome: "Organize o próximo passo.", texto: "Ligue suas notas, tarefas e projetos." },
    { nome: "Siga com clareza.", texto: "Reencontre o que precisa, com contexto." },
  ],
} as const;

export const capitulos = {
  titulo: "Das ideias ao próximo passo.",
  itens: [
    {
      id: "captura",
      atalho: "Dê espaço às ideias",
      titulo: "Uma ideia não precisa ficar só na cabeça.",
      texto: "Capture, escreva e transforme suas anotações em tarefas ou conhecimento.",
      fatos: [
        "Organize depois, sem perder a ligação com a captura de origem.",
        "Conecte notas com [[nome da nota]] e reencontre suas referências.",
      ],
      tela: {
        amplo: { claro: capturar, escuro: capturarEscuro },
        celular: { claro: capturarCelular, escuro: capturarCelularEscuro },
        descricao: "Editor de Capturar com a nota “Reforma da sala” em escrita e um vínculo com a nota “Paleta de cores”.",
        formato: "recorte",
      },
    },
    {
      id: "agenda",
      atalho: "Enxergue seu dia",
      titulo: "Seu tempo, com perspectiva.",
      texto: "Calendário ao lado. Compromissos em lista. O dia fica mais fácil de enxergar.",
      fatos: [
        "Reúna a agenda de até duas contas Google, somente leitura.",
        "Ligue tarefas aos compromissos sem criar uma cópia do evento.",
      ],
      tela: {
        amplo: { claro: calendarioLista, escuro: calendarioListaEscuro },
        celular: { claro: calendarioListaCelular, escuro: calendarioListaCelularEscuro },
        descricao: "Calendário do Segundo Cérebro em Lista, com compromissos do período e o seletor de datas.",
        formato: "janela",
      },
    },
    {
      id: "projetos",
      atalho: "Tire planos do papel",
      titulo: "Do plano ao próximo passo.",
      texto: "Reúna o contexto de um projeto. Acompanhe as tarefas em lista ou Kanban.",
      fatos: [
        "Notas, tarefas e cadernos continuam sendo os mesmos registros quando vinculados.",
        "Excluir um projeto preserva os itens ligados a ele.",
      ],
      tela: {
        amplo: { claro: projeto, escuro: projetoEscuro },
        celular: { claro: projetoCelular, escuro: projetoCelularEscuro },
        descricao: "Projeto “Mudança de casa” com descrição, progresso das tarefas e registros vinculados.",
        formato: "janela",
      },
    },
  ] satisfies readonly Capitulo[],
} as const;

export const previaKanban = {
  amplo: { claro: tarefasKanban, escuro: tarefasKanbanEscuro },
  celular: { claro: tarefasKanbanCelular, escuro: tarefasKanbanCelularEscuro },
  descricao: "Tarefas do Segundo Cérebro em Kanban, distribuídas pelas colunas de estado do quadro.",
  formato: "janela",
} satisfies Tela;

export const principios = {
  titulo: "Feito para ser só seu.",
  texto: "Capturas e notas, tarefas e projetos, calendário, hábitos, financeiro e Cofre no mesmo espaço pessoal.",
  itens: [
    { titulo: "Contas isoladas", texto: "Cada pessoa tem a própria conta, separada no banco de dados. Não existe espaço compartilhado." },
    { titulo: "Cofre cifrado no navegador", texto: "Senha mestra e kit de recuperação ficam com você. Sem eles, nem o servidor recupera os dados." },
    { titulo: "Painel administrativo sem conteúdo", texto: "O painel administrativo mostra dados da conta, sem exibir suas notas, tarefas, finanças ou o Cofre." },
    { titulo: "Agenda somente leitura", texto: "O Calendário lê até duas contas Google e não cria, altera nem apaga eventos." },
  ],
} as const;

/** Integração comercial futura, sem preço, cadastro ou pagamento neste recorte. */
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
export const INDEXACAO_PUBLICA = false;
