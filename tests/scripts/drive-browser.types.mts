import{blankDriveCase,validateDriveCase,driveRefuse,type DriveCase,type DriveState}from"../e2e-auth-local/drive-browser-contract.mjs";
import{createDriveHarness,createDriveState,createDriveIo,driveEnvironment,type DriveContext,type DriveSql,type DriveHarness}from"../e2e-auth-local/drive-browser-support.mjs";
const closed:DriveCase=validateDriveCase(blankDriveCase());
const state:DriveState=createDriveState();state.count("contexts");state.stage("fixture");
createDriveIo(state).request({mode:"cap",url:"http://127.0.0.1:54321/owned",method:"GET",write:false},async()=>true);
const context:DriveContext=driveEnvironment({});
const h:Promise<DriveHarness>=createDriveHarness(context,{query:async()=>({}),cleanupAllowed:()=>false});
h.then(async harness=>{const sql:DriveSql=await harness.inspect();return sql.usageBytes;});
void closed;
// @ts-expect-error Closed reports cannot hold credentials.
closed.password="synthetic";
// @ts-expect-error No hosted-certification promotion is part of this protocol.
closed.limitations.hostedVerified=true;
// @ts-expect-error Stage enumeration is closed.
state.stage("hosted-production");
// @ts-expect-error Budgets are a fixed enumeration.
state.count("arbitraryRequest");
const neverResult:never=driveRefuse("REPORT_REFUSED");void neverResult;
