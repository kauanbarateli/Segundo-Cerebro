import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createRoutineGateway, parseRoutineSnapshot, type RoutineRpc } from "../../src/adapters/db/projects-habits-gateway";
import { decodeRoutineRequest } from "../../src/adapters/db/projects-habits-commands";
import { CommitOutcomeUnknown } from "../../src/adapters/db/capture-task-store";
const actor = "00000000-0000-4000-8000-000000000001", session = "00000000-0000-4000-8000-000000000002";
const empty = { revision: "0", projects: [], habits: [], entries: [], pauses: [], containers: [], events: [], receipts: [] };
describe("T023 routine transport boundary", () => {
  it("all reads and receipts carry the authenticated user, session and operation", async () => {
    const calls: unknown[] = [], rpc: RoutineRpc = async (name, args) => { calls.push({ name, args }); return { data: name === "projects_habits_snapshot" ? empty : null, error: null }; }, gateway = createRoutineGateway(actor, session, "habit.mark", rpc);
    expect(await gateway.snapshot()).toEqual(empty); expect(await gateway.receipt("habit.mark", "same")).toBeNull(); expect(calls).toEqual([{ name: "projects_habits_snapshot", args: { p_user: actor, p_session: session, p_operation: "habit.mark" } }, { name: "projects_habits_receipt", args: { p_user: actor, p_session: session, p_operation: "habit.mark", p_command: "habit.mark", p_client_id: "same" } }]);
  });
  it("malformed or truncated snapshots fail rather than claiming a shorter history", () => {
    expect(() => parseRoutineSnapshot({ ...empty, entries: undefined }, actor)).toThrow(); expect(() => parseRoutineSnapshot({ ...empty, revision: "1.2" }, actor)).toThrow(); expect(() => parseRoutineSnapshot({ ...empty, projects: [{ id: "other", user_id: session }] }, actor)).toThrow();
  });
  it("known forbidden errors are rejections and connection loss during writes is unknown", async () => {
    const rpc: RoutineRpc = async () => ({ data: null, error: { code: "42501" } }); await expect(createRoutineGateway(actor, session, "read.habits", rpc).snapshot()).rejects.toMatchObject({ code: "forbidden" });
    const lost: RoutineRpc = async () => { throw new Error("Offline"); }; const gateway = createRoutineGateway(actor, session, "habit.mark", lost); await expect(gateway.commit({ expectedRevision: "0", context: { user_id: actor, canal: "web" }, changes: [], events: [], receipt: { user_id: actor, command: "habit.mark", client_id: "same", fingerprint: "{}", result: null } })).rejects.toBeInstanceOf(CommitOutcomeUnknown);
  });
  it("strict input decoding excludes batches, owners and forbidden patch fields", () => {
    const request = { command: "project.update", input: { id: actor, client_id: "same", patch: { name: "Projeto" } } }; expect(decodeRoutineRequest(request)).toEqual(request);
    expect(() => decodeRoutineRequest({ ...request, changes: [] })).toThrow(); expect(() => decodeRoutineRequest({ ...request, input: { ...request.input, user_id: actor } })).toThrow(); expect(() => decodeRoutineRequest({ ...request, input: { ...request.input, patch: { user_id: actor } } })).toThrow(); expect(() => decodeRoutineRequest({ command: "habit.mark", input: { client_id: " ", done: true } })).toThrow();
  });
});
