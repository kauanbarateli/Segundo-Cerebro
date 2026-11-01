import type { StaticImageData } from "next/image";
import { LOGIN_PATH, SIGNUP_PATH } from "@/lib/access/signup-capability";
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

/** Acesso gratuito desta fase, sem preço, cartão ou prazo. O destino acompanha a capacidade real de cadastro. */
export interface DestinoDeAcesso { href: string; rotulo: string }
export interface ConteudoDeAcesso {
  titulo: string;
  texto: string;
  principal: DestinoDeAcesso;
  /** Só existe quando o cadastro está aberto; senão o principal já é Entrar. */
  conta: DestinoDeAcesso | null;
  /** Acesso do cabeçalho: Entrar sempre; criar conta só com cadastro aberto. */
  cabecalho: { entrar: DestinoDeAcesso; criar: DestinoDeAcesso | null };
}
const entrar: DestinoDeAcesso = { href: LOGIN_PATH, rotulo: "Entrar" };
const criarConta: DestinoDeAcesso = { href: SIGNUP_PATH, rotulo: "Criar conta gratuita" };
export function acessoPara(cadastroAberto: boolean): ConteudoDeAcesso {
  return cadastroAberto ? {
    titulo: "Comece pela próxima ideia.",
    texto: "O Segundo Cérebro é gratuito nesta fase. Crie sua conta com e-mail e senha e comece a capturar.",
    principal: criarConta,
    conta: { href: LOGIN_PATH, rotulo: "Já tem uma conta? Entrar" },
    cabecalho: { entrar, criar: criarConta },
  } : {
    titulo: "Comece pela próxima ideia.",
    texto: "O Segundo Cérebro é gratuito nesta fase. A criação de novas contas ainda não está aberta; quem já tem conta pode entrar.",
    principal: entrar,
    conta: null,
    cabecalho: { entrar, criar: null },
  };
}
export const rodape = {
  lema: "Capture, conecte, reencontre.",
  aviso: "As telas desta página são capturas do aplicativo em modo demonstração, com dados fictícios.",
} as const;
export const INDEXACAO_PUBLICA = false;
