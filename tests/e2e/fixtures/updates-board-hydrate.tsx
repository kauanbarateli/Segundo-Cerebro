import { hydrateRoot } from "react-dom/client";
import { UpdatesBoard } from "../../../src/components/features/atualizacoes/updates-board";
import { entries } from "./updates-board-entries";
Object.assign(globalThis, { __hydrateUpdates() { const root=document.getElementById("updates-fixture"); if(!root) throw Error("missing root"); hydrateRoot(root,<UpdatesBoard entries={entries} />); } });
