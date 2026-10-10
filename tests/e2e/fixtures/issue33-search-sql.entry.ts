/** Actual search factory/SDK and domain composition. The test owns the finite
 * SQL-backed HTTP seam; the pinned personal URL is never a network destination. */
export { searchForRequest } from "../../../src/adapters/db/search-runtime";
export { search, searchTerm, validSearchResults } from "../../../src/core/busca";
export { createCaptureTaskGateway } from "../../../src/adapters/db/capture-task-gateway";
export { createCaptureTaskStore } from "../../../src/adapters/db/capture-task-store";
export { decodeCaptureTaskRequest, executeCaptureTaskCommand } from "../../../src/adapters/db/capture-task-commands";
export { createRoutineGateway } from "../../../src/adapters/db/projects-habits-gateway";
export { createRoutineStore } from "../../../src/adapters/db/projects-habits-store";
export { decodeRoutineRequest, executeRoutineCommand } from "../../../src/adapters/db/projects-habits-commands";
export { createKnowledgeGateway } from "../../../src/adapters/db/knowledge-gateway";
export { createKnowledgeStore } from "../../../src/adapters/db/knowledge-store";
export { decodeKnowledgeCommand } from "../../../src/adapters/db/knowledge-commands";
export { executarConhecimento, conhecimentoDTO, leituraRelacionados, documentoDeTexto } from "../../../src/core/conhecimento";
export { createFinanceGateway } from "../../../src/adapters/db/finance-gateway";
export { createFinanceStore } from "../../../src/adapters/db/finance-store";
export { decodeFinanceRequest, executeFinanceCommand } from "../../../src/adapters/db/finance-commands";
