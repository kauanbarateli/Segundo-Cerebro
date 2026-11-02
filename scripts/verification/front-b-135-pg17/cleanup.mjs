import {lstat,realpath,rmdir} from 'node:fs/promises';
import {resolve,dirname,basename} from 'node:path';
/** Delete only the verified empty direct child; never recurse or follow links. */
export async function removeEmptyOwnedDirectory(parent,child){
 if(typeof parent!=='string'||typeof child!=='string'||resolve(parent)!==parent||resolve(child)!==child||dirname(child)!==parent||!/^sc-fb-race-[a-zA-Z0-9]+$/.test(basename(child)))throw Error('CLEANUP_REFUSED');
 const p=await lstat(parent),c=await lstat(child);if(!p.isDirectory()||p.isSymbolicLink()||!c.isDirectory()||c.isSymbolicLink()||await realpath(parent)!==parent||await realpath(child)!==child)throw Error('CLEANUP_REFUSED');
 await rmdir(child);
}
