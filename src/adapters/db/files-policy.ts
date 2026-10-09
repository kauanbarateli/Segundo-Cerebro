import "server-only";
import { DRIVE_HARD_LIMIT, IMAGE_HARD_LIMIT, type PoliticaArquivos } from "../../core/drive";
export function readFilePolicy(environment:Readonly<Record<string,string|undefined>>=process.env):PoliticaArquivos{
 const integer=(key:string,fallback:number,max:number)=>{const value=environment[key]===undefined?fallback:Number(environment[key]);if(!Number.isSafeInteger(value)||value<1024||value>max)throw new Error("Política de arquivos indisponível.");return value;};
 return{quota_bytes:integer("DRIVE_QUOTA_BYTES",1024**3,10*1024**3),drive_max_bytes:integer("DRIVE_MAX_FILE_BYTES",DRIVE_HARD_LIMIT,DRIVE_HARD_LIMIT),image_max_bytes:IMAGE_HARD_LIMIT,max_pixels:24_000_000,lease_seconds:300};
}
