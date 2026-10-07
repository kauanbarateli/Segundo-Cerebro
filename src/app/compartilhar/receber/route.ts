/** T-005 placeholder: never parse, log or persist shared personal payloads. */
export function POST(request: Request) {
  return new Response(null, { status: 303, headers: { Location: new URL("/compartilhar", request.url).toString(), "Cache-Control": "no-store" } });
}
