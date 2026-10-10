// Actual narrow product exports; Auth/RPC transport is explicit in the spec.
export { createFinanceGateway } from "../../../src/adapters/db/finance-gateway";
export { createFinanceStore } from "../../../src/adapters/db/finance-store";
export { decodeFinanceRequest, executeFinanceCommand } from "../../../src/adapters/db/finance-commands";
