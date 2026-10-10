// Fixed product entry for disposable SQL composition. No runtime or credentials.
export { createKnowledgeGateway } from "../../../src/adapters/db/knowledge-gateway";
export { createKnowledgeStore } from "../../../src/adapters/db/knowledge-store";
export { decodeKnowledgeCommand } from "../../../src/adapters/db/knowledge-commands";
export { executarConhecimento, conhecimentoDTO, leituraPagina, leituraRelacionados } from "../../../src/core/conhecimento";
export { ErroDeDominio } from "../../../src/core/contracts/base";
export { AuthGuardError } from "../../../src/lib/auth/types";
