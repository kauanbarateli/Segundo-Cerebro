import { describe,expect,it } from "vitest";
import { decodeOnboardingAttributeCommand,decodeOnboardingAttributeQuery,decodeOnboardingAttributeResult } from "../../src/core/onboarding/attributes";
const project="2a000000-0000-4000-8000-000000000001";
describe("v2 profile/project attributes keep a separate, closed CAS contract",()=>{
 it("omission preserves focus whereas explicit null clears it",()=>{
  expect(decodeOnboardingAttributeCommand({kind:"profile",clientId:"save",expectedRevision:"opaque:0",patch:{displayName:" Kauan "}})).toEqual({kind:"profile",clientId:"save",expectedRevision:"opaque:0",patch:{displayName:"Kauan"}});
  expect(decodeOnboardingAttributeCommand({kind:"profile",clientId:"clear",expectedRevision:"opaque:0",patch:{focus:null}})).toMatchObject({patch:{focus:null}});
 });
 it("context belongs to the exact project ID, never a title or task category",()=>{
  expect(decodeOnboardingAttributeCommand({kind:"project",projectId:project,clientId:"save",expectedRevision:"opaque:1",context:"study"})).toMatchObject({projectId:project,context:"study"});
  expect(()=>decodeOnboardingAttributeCommand({kind:"project",projectId:"Meu projeto",clientId:"save",expectedRevision:"1",context:"study"})).toThrow();
 });
 it.each([
  {kind:"profile",clientId:"save",expectedRevision:"r",patch:{}},
  {kind:"profile",clientId:"save",expectedRevision:"r",patch:{focus:"sales"}},
  {kind:"profile",clientId:"save",expectedRevision:"r",patch:{focus:"work"},ownerId:project},
  {kind:"profile",clientId:"save",expectedRevision:"r",patch:{role:"master"}},
  {kind:"project",projectId:project,clientId:"save",expectedRevision:"r",context:"work",patch:{focus:"work"}},
  {kind:"project",projectId:project,clientId:"save",expectedRevision:"r"},
  {kind:"project",projectId:project,clientId:"save",expectedRevision:"r",context:"mixed"},
 ])("rejects expanded/missing/permission-like fields %#",input=>expect(()=>decodeOnboardingAttributeCommand(input)).toThrow());
 it("never reads an accessor while validating untrusted data",()=>{
  let calls=0;const input={kind:"profile",clientId:"save",expectedRevision:"r",patch:{get focus(){calls++;return "work";}}};
  expect(()=>decodeOnboardingAttributeCommand(input)).toThrow();expect(calls).toBe(0);
 });
 it("rejects a project response outside the requested identity and unrequested fields",()=>{
  expect(()=>decodeOnboardingAttributeResult({projectId:project.replace(/1$/,"2"),context:"work",revision:"r"},{kind:"project",projectId:project})).toThrow();
  expect(()=>decodeOnboardingAttributeResult({displayName:null,focus:null,revision:"r",entitlements:[]},{kind:"profile"})).toThrow();
 });
 it("rejects a profile query smuggling a project ID",()=>expect(()=>decodeOnboardingAttributeQuery({kind:"profile",projectId:project})).toThrow());
});
