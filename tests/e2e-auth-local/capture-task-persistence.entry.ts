// Fixed trusted entry. No runtime factory, configuration, client or side effect.
export { createCaptureTaskGateway, parseCaptureTaskSnapshot } from "../../src/adapters/db/capture-task-gateway";
export { createCaptureTaskStore, CommitOutcomeUnknown } from "../../src/adapters/db/capture-task-store";
export { decodeCaptureTaskRequest, executeCaptureTaskCommand } from "../../src/adapters/db/capture-task-commands";
export { ErroDeDominio } from "../../src/core/contracts/base";
export { AuthGuardError } from "../../src/lib/auth/types";
