import { describe, expect, it, vi } from "vitest";
import { EntityImageAttempt } from "../../src/components/layout/entity-image-attempt";
import { ConnectedApplicationError, type CommandFeedback } from "../../src/lib/demo/connected-application";
import { decodeImageUploadObservation, isImageUploadInstant } from "../../src/lib/files/image-upload-observation";
import { LOCAL_STORAGE_ORIGIN } from "../../src/lib/files/storage-origin";
import type { EntityImagePurpose } from "../../src/core/drive/entity-images";
const user = "10000000-0000-4000-8000-000000000001", upload = "10000000-0000-4000-8000-000000000002", entity = "10000000-0000-4000-8000-000000000003";
const token = "synthetic-only", url = `${LOCAL_STORAGE_ORIGIN}/storage/v1/object/upload/sign/second-brain-staging/${user}/${upload}?token=${token}`;
const unknown = () => new ConnectedApplicationError("COMMIT_UNKNOWN", "Confirme o mesmo envio.", true);
function harness(purpose: EntityImagePurpose) {
  const file = new File([new Uint8Array([1, 2, 3])], "imagem.png", { type: "image/png" }), events: string[] = [];
  const saved = { id: upload, user_id: user, kind: purpose, name: file.name, folder_id: null, mime: "image/png", bytes: 3, sha256: "a".repeat(64), width: 1, height: 1, starred: false, deleted_at: null, deletion_batch_id: null, created_at: "2026-10-21T00:00:00Z", updated_at: "2026-10-21T00:00:00Z", modified_at: "2026-10-21T00:00:00Z" };
  const controls = { reserve: [] as (Error | Response)[], put: [] as (Error | Response)[], finalize: [] as Error[], bind: [] as Error[], observation: "staging", malformed: false, feedback: { status: "idle" } as CommandFeedback };
  const sender = vi.fn(async (command: string, input: unknown) => {
    events.push(command); const failure = (command === "file.upload.finalize" ? controls.finalize : controls.bind).shift();
    if (failure) { controls.feedback = failure instanceof ConnectedApplicationError && !failure.outcomeUnknown ? { status: "idle" } : { status: "pending", retrying: false, message: "incerto" }; throw failure; }
    controls.feedback = { status: "idle" }; if (controls.malformed) return null;
    if (command === "file.upload.finalize") return saved;
    const binding = input as { entity_id: string; file_id: string | null };
    return { version: 1, user_id: user, id: binding.entity_id, purpose, file_id: binding.file_id };
  });
  const fetcher = vi.fn<typeof fetch>(async (input, request) => {
    const target = String(input); const action = request?.method === "PUT" ? "put" : target.startsWith("/api/files/uploads/observe?") ? "observe" : "reserve";
    events.push(action);
    if (action === "observe") return Response.json({ version: 1, user_id: user, upload_id: upload, purpose, state: controls.observation, file: controls.observation === "final" ? saved : null });
    const failure = controls[action].shift(); if (failure instanceof Error) throw failure; if (failure) return failure;
    return action === "put" ? Response.json({}) : Response.json({ id: upload, token, upload_url: url, expires_at: new Date(Date.now() + 150_000).toISOString() });
  });
  const app = { userId: user, mode: "connected" as const, closing: false, storageOrigin: LOCAL_STORAGE_ORIGIN as typeof LOCAL_STORAGE_ORIGIN, executeDomainCommand: sender, initializeJournal: vi.fn(async () => undefined), getCommandSnapshot: () => controls.feedback };
  const attempt = new EntityImageAttempt({ purpose, file, application: () => app, fetcher, ids: { upload: "original-reservation", binding: "original-binding" } });
  return { app, controls, events, file, saved, sender, fetcher, attempt };
}
for (const purpose of ["project_cover", "home_focus_image"] as const) describe(`Tentativa compartilhada: ${purpose}`, () => {
  it("keeps reserve/PUT/finalize/binding order and credentials/capabilities outside commands", async () => {
    const h = harness(purpose); expect(h.attempt.canDiscard).toBe(true);
    expect(await h.attempt.upload()).toEqual(h.saved); expect(h.attempt.canDiscard).toBe(true);
    expect(await h.attempt.bind(entity, null)).toBe(upload);
    expect(h.events).toEqual(["reserve", "put", "file.upload.finalize", "file.entity-image.set"]);
    expect(h.fetcher.mock.calls[0]![1]).toMatchObject({ method: "POST", credentials: "same-origin", redirect: "error", headers: { "X-Expected-User-ID": user } });
    expect(h.fetcher.mock.calls[1]).toEqual([url, expect.objectContaining({ method: "PUT", credentials: "omit", redirect: "error", headers: { "x-upsert": "false" } })]);
    expect(JSON.stringify(h.sender.mock.calls)).not.toMatch(/synthetic-only|token|upload_url|staging/);
  });
  it("replays an unacknowledged reservation with the exact body/client_id and no premature finalize", async () => {
    const h = harness(purpose); h.controls.reserve.push(new Error("lost reserve ACK"));
    await expect(h.attempt.upload()).rejects.toMatchObject({ code: "UNAVAILABLE" }); expect(h.attempt.canDiscard).toBe(false); expect(h.sender).not.toHaveBeenCalled();
    await h.attempt.upload(); expect(h.fetcher.mock.calls[1]![1]!.body).toBe(h.fetcher.mock.calls[0]![1]!.body);
    expect(h.events).toEqual(["reserve", "reserve", "put", "file.upload.finalize"]);
  });
  it("refuses a concurrent call and discard while the original reservation is outstanding", async () => {
    const h = harness(purpose); let resolve!: (value: Response) => void;
    h.fetcher.mockImplementationOnce(() => new Promise<Response>(done => { resolve = done; }));
    const work = h.attempt.upload(); await vi.waitFor(() => expect(h.attempt.stage).toBe("reserving"));
    expect(h.attempt.canDiscard).toBe(false); await expect(h.attempt.upload()).rejects.toMatchObject({ code: "BUSY" });
    resolve(Response.json({ id: upload, token, upload_url: url, expires_at: new Date(Date.now() + 150_000).toISOString() })); await work;
    expect(h.sender).toHaveBeenCalledTimes(1);
  });
  it("reconciles a lost PUT ACK to staging without a second PUT", async () => {
    const h = harness(purpose); h.controls.put.push(new Error("stored; ACK lost"));
    await expect(h.attempt.upload()).rejects.toMatchObject({ code: "UNAVAILABLE" }); expect(h.attempt.stage).toBe("put-uncertain");
    await h.attempt.upload(); expect(h.events).toEqual(["reserve", "put", "observe", "file.upload.finalize"]);
  });
  it("retries the same bytes conditionally only after explicit retry and observed absence", async () => {
    const h = harness(purpose); h.controls.put.push(new Response(null, { status: 503 })); h.controls.observation = "missing-observed";
    await expect(h.attempt.upload()).rejects.toMatchObject({ code: "UNAVAILABLE" }); expect(h.sender).not.toHaveBeenCalled();
    await h.attempt.upload(); expect(h.events).toEqual(["reserve", "put", "observe", "reserve", "put", "file.upload.finalize"]);
    const reservations = h.fetcher.mock.calls.filter(([target]) => target === "/api/files/uploads"); expect(reservations[1]![1]!.body).toBe(reservations[0]![1]!.body);
    const puts = h.fetcher.mock.calls.filter(([, request]) => request?.method === "PUT");
    expect(puts[1]![0]).toBe(puts[0]![0]); for (const [, request] of puts) { const bytes = (request!.body as FormData).get(""); expect(bytes).toBeInstanceOf(File); expect(new Uint8Array(await (bytes as File).arrayBuffer())).toEqual(new Uint8Array([1, 2, 3])); }
  });
  it("reconciles a late first PUT / duplicate instead of overwriting or inventing an ID", async () => {
    const h = harness(purpose); h.controls.put.push(new Error("late"), new Response(null, { status: 409 })); h.controls.observation = "missing-observed";
    await expect(h.attempt.upload()).rejects.toBeInstanceOf(Error); await expect(h.attempt.upload()).rejects.toBeInstanceOf(Error);
    h.controls.observation = "staging"; await h.attempt.upload();
    expect(h.events).toEqual(["reserve", "put", "observe", "reserve", "put", "observe", "file.upload.finalize"]);
    expect(h.sender).toHaveBeenCalledWith("file.upload.finalize", { upload_id: upload, client_id: "original-reservation" });
  });
  it("does not forget the first PUT when capability renewal itself loses its ACK", async () => {
    const h = harness(purpose); h.controls.put.push(new Error("unknown PUT"));
    await expect(h.attempt.upload()).rejects.toBeInstanceOf(Error); h.controls.observation = "missing-observed"; h.controls.reserve.push(new Error("renewal ACK lost"));
    await expect(h.attempt.upload()).rejects.toBeInstanceOf(Error); h.controls.observation = "staging"; await h.attempt.upload();
    expect(h.events).toEqual(["reserve", "put", "observe", "reserve", "observe", "file.upload.finalize"]);
  });
  it("indeterminate observations preserve the attempt without PUT/reservation/finalize", async () => {
    const h = harness(purpose); h.controls.put.push(new Error("unknown")); await expect(h.attempt.upload()).rejects.toBeInstanceOf(Error);
    h.controls.observation = "indeterminate"; await expect(h.attempt.upload()).rejects.toMatchObject({ code: "UNAVAILABLE" });
    expect(h.events).toEqual(["reserve", "put", "observe"]); expect(h.attempt.canDiscard).toBe(false);
  });
  it("settles finalize through the original journal before any observation or PUT", async () => {
    const h = harness(purpose); h.controls.finalize.push(unknown(), unknown());
    await expect(h.attempt.upload()).rejects.toMatchObject({ outcomeUnknown: true }); await expect(h.attempt.upload()).rejects.toMatchObject({ outcomeUnknown: true }); await h.attempt.upload();
    expect(h.events).toEqual(["reserve", "put", "file.upload.finalize", "file.upload.finalize", "file.upload.finalize"]);
    expect(new Set(h.sender.mock.calls.map(([, input]) => JSON.stringify(input))).size).toBe(1);
  });
  it("does not use an observed final file to bypass the finalize receipt", async () => {
    const h = harness(purpose); h.controls.put.push(new Error("unknown")); await expect(h.attempt.upload()).rejects.toBeInstanceOf(Error);
    h.controls.observation = "final"; await h.attempt.upload(); expect(h.events.at(-1)).toBe("file.upload.finalize");
  });
  it("binding ACK loss preserves CAS/body/IDs, blocks a changed destination and repeats no upload", async () => {
    const h = harness(purpose); await h.attempt.upload(); h.controls.bind.push(unknown());
    await expect(h.attempt.bind(entity, null)).rejects.toMatchObject({ outcomeUnknown: true }); expect(h.attempt.canDiscard).toBe(false);
    await expect(h.attempt.bind(user, null)).rejects.toMatchObject({ code: "PENDING_COMMAND" }); await h.attempt.bind(entity, upload);
    const bindings = h.sender.mock.calls.filter(([command]) => command === "file.entity-image.set"); expect(bindings).toHaveLength(2); expect(bindings[1]![1]).toEqual(bindings[0]![1]);
    expect(h.events).toEqual(["reserve", "put", "file.upload.finalize", "file.entity-image.set", "file.entity-image.set"]); expect(h.attempt.canDiscard).toBe(true);
  });
  it("malformed finalize ACK stays protected and retries only the same command", async () => {
    const h = harness(purpose); h.controls.malformed = true; await expect(h.attempt.upload()).rejects.toBeInstanceOf(Error); expect(h.attempt.canDiscard).toBe(false);
    h.controls.malformed = false; await h.attempt.upload(); expect(h.events).toEqual(["reserve", "put", "file.upload.finalize", "file.upload.finalize"]);
  });
  it("account change, closing and unrelated pending command do not reuse bytes/capabilities", async () => {
    const h = harness(purpose); h.controls.feedback = { status: "pending", retrying: false, message: "other command" };
    await expect(h.attempt.upload()).rejects.toMatchObject({ code: "PENDING_COMMAND" }); expect(h.fetcher).not.toHaveBeenCalled();
    h.app.userId = entity; await expect(h.attempt.upload()).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    h.app.userId = user; h.app.closing = true; await expect(h.attempt.upload()).rejects.toMatchObject({ code: "SESSION_CHANGED" }); expect(h.fetcher).not.toHaveBeenCalled();
  });
  it("blocks an account change between PUT failure and observation without another network effect", async () => {
    const h = harness(purpose); h.controls.put.push(new Error("unknown")); await expect(h.attempt.upload()).rejects.toBeInstanceOf(Error);
    h.app.userId = entity; await expect(h.attempt.upload()).rejects.toMatchObject({ code: "SESSION_CHANGED" }); expect(h.events).toEqual(["reserve", "put"]);
  });
  it("keeps malformed observations protected instead of treating them as absence", async () => {
    const h = harness(purpose); h.controls.put.push(new Error("unknown")); await expect(h.attempt.upload()).rejects.toBeInstanceOf(Error);
    h.fetcher.mockResolvedValueOnce(Response.json({ version: 1, user_id: user, upload_id: upload, purpose, state: ["missing-observed"], file: null }));
    await expect(h.attempt.upload()).rejects.toBeInstanceOf(Error); expect(h.attempt.canDiscard).toBe(false); expect(h.sender).not.toHaveBeenCalled(); expect(h.fetcher).toHaveBeenCalledTimes(3);
  });
  it("permits explicit discard after a definitive finalize rejection without a pending journal", async () => {
    const h = harness(purpose); h.controls.finalize.push(new ConnectedApplicationError("VALIDATION", "Imagem inválida."));
    await expect(h.attempt.upload()).rejects.toMatchObject({ code: "VALIDATION" }); expect(h.attempt.canDiscard).toBe(true); expect(h.attempt.stage).toBe("rejected");
  });
});
describe("Closed observation DTO", () => {
  it.each(["10/11/2026", "2026-02-30T00:00:00Z", "2026-10-21", "2026-10-21T24:00:00Z", "2026-10-21T00:00:00"])("rejects invalid or ambiguous instants %s", value => {
    expect(isImageUploadInstant(value)).toBe(false);
  });
  it.each(["missing-observed", "staging", "indeterminate"])("accepts only the exact %s envelope", state => {
    expect(decodeImageUploadObservation({ version: 1, user_id: user, upload_id: upload, purpose: "project_cover", state, file: null }, user, upload, "project_cover").state).toBe(state);
  });
  it.each([{ state: ["missing-observed"] }, { state: {} }, { version: 2 }, { user_id: entity }, { upload_id: entity }, { purpose: "home_focus_image" }, { path: "injected" }, { file: {} }])("rejects malformed or cross-intent observation %#", delta => {
    expect(() => decodeImageUploadObservation({ version: 1, user_id: user, upload_id: upload, purpose: "project_cover", state: "missing-observed", file: null, ...delta }, user, upload, "project_cover")).toThrow();
  });
});
