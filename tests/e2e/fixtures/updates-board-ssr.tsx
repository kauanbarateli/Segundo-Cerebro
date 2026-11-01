import { renderToString } from "react-dom/server";
import { UpdatesBoard } from "../../../src/components/features/atualizacoes/updates-board";
import { entries } from "./updates-board-entries";
export function renderBoard() { return renderToString(<UpdatesBoard entries={entries} />); }
