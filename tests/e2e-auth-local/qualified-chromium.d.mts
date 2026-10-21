export const QUALIFIED_CHROMIUM: Readonly<{version:"157.0.8103.6";sha256:string;executableBytes:305061192;archiveSha256:string;archiveBytes:202676171;driverVersion:"1.63.0";qualificationRun:39221217191;harnessSha256:string}>;
export interface QualifiedChromiumPaths {readonly executablePath:string;readonly assetsPath:string;readonly versionHome:string;}
export interface QualifiedChromiumRecord {readonly schemaVersion:1;readonly scenario:"qualified-chromium-runtime";readonly status:"BOUND";readonly applicationAccepted:false;readonly platform:"linux";readonly arch:"x64";readonly driverVersion:"1.63.0";readonly browserVersion:"157.0.8103.6";readonly executableSha256:string;readonly archiveSha256:string;readonly qualificationRun:39221217191;readonly harnessSha256:string;readonly executableBytes:305061192;readonly archiveBytes:202676171;}
export function qualifiedChromiumPaths():Readonly<QualifiedChromiumPaths>;
export function assertQualifiedBrowserVersion(value:unknown):void;
export function verifyQualifiedChromium():Promise<Readonly<QualifiedChromiumPaths>>;
export function parseQualifiedChromiumRecord(stdout:unknown):Readonly<QualifiedChromiumRecord>;
export function prepareQualifiedChromium(run:(command:string,args:string[],timeoutMs:number,options:{env:Record<string,string>;maxBytes:number})=>Promise<{stdout:string;groupConfirmed:boolean}>,environment:Readonly<Record<string,string|undefined>>):Promise<Readonly<QualifiedChromiumRecord>>;
