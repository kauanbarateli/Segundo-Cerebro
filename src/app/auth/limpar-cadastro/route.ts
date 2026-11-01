import {NextResponse} from "next/server";
import {noStoreHeaders} from "@/lib/auth/cookie-policy";
/** This legacy endpoint used to clear the principal session. It is disabled. */
export async function POST(){return new NextResponse(null,{status:410,headers:noStoreHeaders()});}
