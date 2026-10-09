import "server-only";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { ErroDeDominio, exigir } from "../../core/contracts/base";
import { validarEntradaArquivo, type ArquivoPreparado, type PoliticaArquivos, type TipoArquivo } from "../../core/drive";
/** Bytes and metadata are measured here; no client MIME/length is authoritative. */
export async function prepararArquivo(kind:TipoArquivo,name:string,input:Uint8Array,policy:PoliticaArquivos):Promise<ArquivoPreparado>{
 const mime=validarEntradaArquivo(kind,name,input,kind==="drive"?policy.drive_max_bytes:policy.image_max_bytes);let bytes=input,finalMime=mime,width:number|null=null,height:number|null=null,finalName=name;
 if(mime.startsWith("image/")){
  try {
  const source=sharp(input,{limitInputPixels:policy.max_pixels,failOn:"error",animated:false});const metadata=await source.metadata();exigir(metadata.width&&metadata.height&&metadata.width*metadata.height<=policy.max_pixels,"Imagem grande demais para processar.");
  let pipeline=source.rotate();if(kind==="avatar")pipeline=pipeline.resize(512,512,{fit:"cover",withoutEnlargement:true});
  const png=mime==="image/png"&&kind!=="avatar";const output=await(png?pipeline.png():pipeline.jpeg({quality:90})).toBuffer({resolveWithObject:true});
  bytes=new Uint8Array(output.data);finalMime=png?"image/png":"image/jpeg";width=output.info.width;height=output.info.height;
  finalName=name.replace(/\.[^.]+$/,"")+(png?".png":".jpg");
  exigir(bytes.byteLength>0&&bytes.byteLength<=(kind==="drive"?policy.drive_max_bytes:policy.image_max_bytes),"A imagem preparada excede o limite.");
  } catch(error) { if(error instanceof ErroDeDominio)throw error;throw new ErroDeDominio("VALIDATION","Imagem inválida ou grande demais para processar."); }
 }
 return{bytes,mime:finalMime,name:finalName,width,height,sha256:createHash("sha256").update(bytes).digest("hex")};
}
