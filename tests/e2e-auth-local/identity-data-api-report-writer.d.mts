export type SerializedIdentityReport = Readonly<{ name: string; bytes: Buffer }>;
export function serializeIdentityReports(reports: Readonly<{ auth: unknown; identityRls: unknown; events: unknown; captureTask: unknown }>): readonly SerializedIdentityReport[];
export function isPrivateReportDirectory(root: string, directory: string, requested: string, information: { mode: number; isDirectory(): boolean; isSymbolicLink(): boolean }): boolean;
export function writeIdentityReports(environment: Readonly<{ reportPath: string; runnerTemp: string }>, reports: Readonly<{ auth: unknown; identityRls: unknown; events: unknown; captureTask: unknown }>): Promise<void>;
