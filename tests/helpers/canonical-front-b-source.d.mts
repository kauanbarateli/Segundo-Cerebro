import type { Buffer } from "node:buffer";
export const FRONT_B_30_DRAFT_REVIEW: readonly Readonly<{file:string;sha256:string;bytes:number}>[];
export function readStagedFrontB30(root:string):Promise<readonly Readonly<{file:string;source:Buffer}>[]>;
export function readHistorical027FromStagedFrontB30(root:string):Promise<readonly Readonly<{file:string;source:Buffer}>[]>;
export function readHistorical026FromStagedFrontB30(root:string):Promise<readonly Readonly<{file:string;source:Buffer}>[]>;
