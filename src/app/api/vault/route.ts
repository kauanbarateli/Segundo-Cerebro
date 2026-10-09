import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ErroDeDominio } from "@/core/contracts/base";
import { decodeVaultInput, executeVaultCommand } from "@/core/cofre";
import { vaultGatewayForRequest } from "@/adapters/db/vault-runtime";
import { VaultRateLimitError } from "@/adapters/db/vault-gateway";
import { CommitOutcomeUnknown } from "@/adapters/db/capture-task-store";
import { readAuthConfiguration } from "@/lib/auth/config";
import { requestAuthServices } from "@/lib/auth/runtime";
import { assertFeature, sameOrigin } from "@/lib/auth/policy";
import { AuthGuardError } from "@/lib/auth/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = () => new Headers({ "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", "X-Content-Type-Options": "nosniff" });
class AccountChanged extends Error {}
async function actor(request: Request, responseHeaders: Headers) { const identity = await (await requestAuthServices(true, responseHeaders)).gateway.readIdentity(); if (!identity) throw new AuthGuardError("unauthenticated"); if (identity.mustChangePassword) throw new AuthGuardError("forbidden"); assertFeature(identity, "cofre"); const expected = request.headers.get("x-expected-user-id"); if (!expected) throw new ErroDeDominio("VALIDATION", "Recarregue a página para confirmar sua conta."); if (expected !== identity.userId) throw new AccountChanged(); return identity; }
function failure(error: unknown, responseHeaders: Headers) { let status = 503, code = "UNAVAILABLE", message = "Não foi possível concluir a operação do Cofre. Tente novamente.";
 if (error instanceof AccountChanged) { status = 409; code = "SESSION_CHANGED"; message = "A conta mudou. Recarregue a página."; }
 else if (error instanceof AuthGuardError) { status = error.code === "unauthenticated" ? 401 : error.code === "forbidden" ? 403 : 503; code = error.code.toUpperCase(); message = status === 401 ? "Entre novamente para abrir o Cofre." : status === 403 ? "O Cofre não está disponível para esta conta." : message; }
 else if (error instanceof ErroDeDominio) { status = error.code === "CONFLICT" ? 409 : error.code === "NOT_FOUND" ? 404 : 400; code = error.code; message = error.message; }
 else if (error instanceof VaultRateLimitError) { status = 429; code = "RATE_LIMITED"; message = error.message; responseHeaders.set("Retry-After", "60"); }
 else if (error instanceof CommitOutcomeUnknown) { code = "COMMIT_UNKNOWN"; message = "A confirmação foi interrompida. Repita o mesmo envio para conferir o recibo."; }
 return NextResponse.json({ ok: false, code, message }, { status, headers: responseHeaders });
}
async function readBody(request: Request) { const reader = request.body?.getReader(); if (!reader) throw new ErroDeDominio("VALIDATION", "Informe a operação cifrada."); const chunks: Uint8Array[] = []; let size = 0; try { while (true) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength; if (size > 128 * 1024) { await reader.cancel(); throw new ErroDeDominio("VALIDATION", "A operação excede o limite de envio."); } chunks.push(next.value); } try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; } catch { throw new ErroDeDominio("VALIDATION", "Informe JSON cifrado válido."); } } finally { reader.releaseLock(); } }
export async function GET(request: Request) { const responseHeaders = headers(); try { const config = readAuthConfiguration(); if (config.mode !== "supabase") throw new AuthGuardError("demo"); const identity = await actor(request, responseHeaders); return NextResponse.json(await vaultGatewayForRequest(config, identity, "read.vault").snapshot(), { headers: responseHeaders }); } catch (error) { return failure(error, responseHeaders); } }
export async function POST(request: Request) { const responseHeaders = headers(); try { const config = readAuthConfiguration(); if (config.mode !== "supabase") throw new AuthGuardError("demo"); if (!sameOrigin(request.headers.get("origin"), config.appOrigin)) throw new AuthGuardError("forbidden"); const identity = await actor(request, responseHeaders); if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") throw new ErroDeDominio("VALIDATION", "Envie uma operação JSON cifrada."); const requestInput = decodeVaultInput(await readBody(request)); const result = await executeVaultCommand(vaultGatewayForRequest(config, identity, requestInput.command), { clock: { now: () => new Date().toISOString() }, ids: { next: randomUUID } }, { user_id: identity.userId, canal: "web" }, requestInput); return NextResponse.json({ ok: true, result }, { headers: responseHeaders }); } catch (error) { return failure(error, responseHeaders); } }
