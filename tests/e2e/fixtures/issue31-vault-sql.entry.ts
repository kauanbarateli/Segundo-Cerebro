// Narrow real server exports. Auth/RPC transport is declared in the SQL spec.
export { createVaultGateway } from "../../../src/adapters/db/vault-gateway";
export { executeVaultCommand } from "../../../src/core/cofre/use-cases";
export { decodeVaultInput } from "../../../src/core/cofre/validation";
