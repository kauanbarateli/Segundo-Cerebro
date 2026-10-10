// Fixed product closure for disposable SQL. No runtime factory or credentials.
export { createKnowledgeGateway } from "../../../src/adapters/db/knowledge-gateway";
export { createKnowledgeStore } from "../../../src/adapters/db/knowledge-store";
export { decodeKnowledgeCommand } from "../../../src/adapters/db/knowledge-commands";
export { executarConhecimento, conhecimentoDTO, leituraPagina, leituraRelacionados } from "../../../src/core/conhecimento";
export { createCaptureTaskGateway } from "../../../src/adapters/db/capture-task-gateway";
export { createCaptureTaskStore } from "../../../src/adapters/db/capture-task-store";
export { decodeCaptureTaskRequest, executeCaptureTaskCommand } from "../../../src/adapters/db/capture-task-commands";
export { ErroDeDominio } from "../../../src/core/contracts/base";
export { AuthGuardError } from "../../../src/lib/auth/types";
