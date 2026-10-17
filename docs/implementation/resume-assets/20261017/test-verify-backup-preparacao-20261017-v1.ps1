# AST/RAM QA. Public source + pure validators only, never the launcher body,
# filesystem/native guards, dispatcher, archive, profile, key or network.
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$verifyQaPassed=[Collections.Generic.List[string]]::new()
$verifyQaBytes=$null
try {
 if($PSVersionTable.PSVersion.Major -ne 7){throw 'QA_PS7_REQUIRED'}
 $verifyQaPath=Join-Path $PSScriptRoot 'verify-backup-preparacao-20261017-v1.ps1'
 $verifyQaBytes=[IO.File]::ReadAllBytes($verifyQaPath)
 if($verifyQaBytes.Length -ne 22904 -or [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($verifyQaBytes)) -cne '67643B096E1929F42934EDA57DA2CE8BB4578BAABEF21212EAC6231110B86845'){throw 'QA_SOURCE_PIN_REFUSED'}
 $verifyQaText=[Text.UTF8Encoding]::new($false,$true).GetString($verifyQaBytes)
 $verifyQaTokens=$null;$verifyQaErrors=$null
 $verifyQaAst=[Management.Automation.Language.Parser]::ParseInput($verifyQaText,[ref]$verifyQaTokens,[ref]$verifyQaErrors)
 if($verifyQaErrors.Count){throw 'QA_SOURCE_PARSE_REFUSED'}
 $verifyQaNames=@('Stop-VerifyPrep','Assert-VerifyPrepObject','Assert-VerifyPrepUniqueJson','Read-VerifyPrepEnum','Read-VerifyPrepBool','Read-VerifyPrepCount','Read-VerifyPrepDigest','Read-VerifyPrepBinding','Read-VerifyPrepProjection')
 $verifyQaDefinitions=[Collections.Generic.List[string]]::new()
 foreach($verifyQaName in $verifyQaNames){
  $verifyQaMatch=@($verifyQaAst.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq $verifyQaName},$true))
  if($verifyQaMatch.Count -ne 1){throw 'QA_FUNCTION_SELECTION_REFUSED'}
  $verifyQaDefinitions.Add($verifyQaMatch[0].Extent.Text)
 }
 $verifyQaPure=$verifyQaDefinitions -join [string][char]10
 $verifyQaPureTokens=$null;$verifyQaPureErrors=$null
 $verifyQaPureAst=[Management.Automation.Language.Parser]::ParseInput($verifyQaPure,[ref]$verifyQaPureTokens,[ref]$verifyQaPureErrors)
 if($verifyQaPureErrors.Count -ne 0 -or $verifyQaPureAst.EndBlock.Statements.Count -ne $verifyQaNames.Count){throw 'QA_PURE_AST_REFUSED'}
 foreach($verifyQaStatement in $verifyQaPureAst.EndBlock.Statements){
  if($verifyQaStatement -isnot [Management.Automation.Language.FunctionDefinitionAst] -or $verifyQaNames -cnotcontains $verifyQaStatement.Name){throw 'QA_PURE_AST_REFUSED'}
 }
 . ([scriptblock]::Create($verifyQaPure))
 $verifyQaPassed.Add('exclusive pure AST selection and source pin')
 foreach($verifyQaDefault in @(@('GateExecute','$false'),@('ReviewedCommit','$null'),@('ArchiveBinding','$null'),@('SelfSha256',"''"))){
  $verifyQaParam=@($verifyQaAst.ParamBlock.Parameters|Where-Object{$_.Name.VariablePath.UserPath -ceq $verifyQaDefault[0]})
  if($verifyQaParam.Count -ne 1 -or $verifyQaParam[0].DefaultValue.Extent.Text -cne $verifyQaDefault[1]){throw 'QA_DEFAULT_GATE_REFUSED'}
 }
 if($verifyQaAst.EndBlock.Statements[2] -isnot [Management.Automation.Language.IfStatementAst] -or $verifyQaAst.EndBlock.Statements[2].Clauses[0].Item1.Extent.Text -cne '-not $GateExecute'){throw 'QA_EARLY_GATE_REFUSED'}
 $verifyQaPassed.Add('inert false/null gates precede all I/O')
 $verifyQaPinAssignment=@($verifyQaAst.FindAll({param($n)$n -is [Management.Automation.Language.AssignmentStatementAst] -and $n.Left.Extent.Text -ceq '$verifyPrepSources'},$true))
 if($verifyQaPinAssignment.Count -ne 1){throw 'QA_UNION_REFUSED'}
 $verifyQaPins=[regex]::Matches($verifyQaPinAssignment[0].Extent.Text,"@\('([^']+)',([0-9]+),'([A-F0-9]{64})'\)")
 $verifyQaPaths=@('scripts/operations/run-operator.ps1','scripts/operations/backup.mjs','scripts/operations/backup-config.mjs','scripts/operations/backup-sources.mjs','scripts/operations/backup-format.mjs','scripts/operations/restore-verify.mjs','scripts/operations/restore-target.mjs','scripts/operations/postgres-process.mjs')
 if($verifyQaPins.Count -ne 8){throw 'QA_UNION_REFUSED'}
 for($i=0;$i -lt 8;$i++){if($verifyQaPins[$i].Groups[1].Value -cne $verifyQaPaths[$i] -or [long]$verifyQaPins[$i].Groups[2].Value -le 0){throw 'QA_UNION_REFUSED'}}
 foreach($verifyQaGuard in @(
  '[IO.FileShare]::Read','ls-files --error-unmatch -- @verifyPrepSourcePaths',
  '$verifyPrepGit = (@(Get-Command git -CommandType Application -ErrorAction Stop)[0]).Source',
  '$verifyPrepWatch.ElapsedMilliseconds -ge 600000',
  '$verifyPrepOutput.Length + $verifyPrepReadCount -gt 65536',
  '-not $verifyPrepOutDone -or -not $verifyPrepErrDone -or -not $verifyPrepProcess.HasExited',
  '$verifyPrepStart.Environment.Clear()',
  '$verifyPrepStart.Environment[''PATHEXT''] = ''.EXE''',
  "'-Operation','verify'","'-Archive',"+'$verifyPrepBinding.path',
  "Open-VerifyPrepPin $"+"verifyPrepProfile 4206 '5D9C83138241DBBF3EA94722E46BF4A67EA52B2EF22D72F7F05055BBC214F32C'",
  "'scripts/operations/run-operator.ps1',6111,'7311AEC2E11F747C7D3204821EF22748BDA9CCAB85608D6B3EDB854C44BF196C'",
  "'scripts/operations/backup.mjs',5828,'A8CAA0F5D4341B45FD9DC3B6CF209892E9C687894E7D1811C2056464632091FE'",
  "'scripts/operations/backup-sources.mjs',8865,'0533CDBABD16AB168B9F7CA5F23E1E7DDB878104D3230A28825452D085D9246D'",
  "'S-1-5-18','S-1-5-32-544'","FileSystemType -cne 'NTFS'",
  'Get-Acl -LiteralPath $verifyPrepResolved','ReparsePoint',
  '[Text.UTF8Encoding]::new($false,$true)'
 )){if(-not $verifyQaText.Contains($verifyQaGuard)){throw 'QA_SOURCE_GUARD_REFUSED'}}
 if(([regex]::Matches($verifyQaText,[regex]::Escape('Open-VerifyPrepPin $verifyPrepBinding.path $verifyPrepBinding.bytes $verifyPrepBinding.sha256'))).Count -ne 2){throw 'QA_ARCHIVE_RECHECK_REFUSED'}
 foreach($verifyQaForbidden in @("'-Operation','create'","'-Operation','restore'",'Import-Clixml','Export-Clixml','ExecutionPolicy','Set-Acl','Remove-Item','SC_BACKUP_QUIESCED','NewQuiescenceDeclared','TransportReviewed',"Open-VerifyPrepPin 'C:\Program Files\PostgreSQL","Open-VerifyPrepPin 'C:\Users\Kauan Sousa Barateli\SegundoCerebro-Operations\certificates")){
  if($verifyQaText.Contains($verifyQaForbidden)){throw 'QA_AUTHORITY_REFUSED'}
 }
 $verifyQaPassed.Add('eight source pins/read leases/hash twice/verify-only/no unused PG/CA authority')
 function New-VerifyQaBinding {
  return [ordered]@{
   path='C:\Users\Kauan Sousa Barateli\SegundoCerebro-Operations\archives\second-brain-2026-10-17T01-27-25-163Z-6b65e5f5.scbackup'
   bytes=951230L;sha256='21c0e0eb0b60a123854ec4d10d2bdbf69e1cb922bc2ed2591c89ec422262088a';entries=1L;databaseEntries=1L;storageObjects=0L;plaintextBytes=950017L
   manifestSha256='c6be061d96acf15f6d1303f88efde6807911b09e9e8d6ee858dfe24969aa646e';keyId='SC-20261012-001'
  }
 }
 function New-VerifyQaSuccess {
  return [ordered]@{ok=$true;operation='verify';entries=1;database_entries=1;storage_objects=0;plaintext_bytes=950017;manifest_sha256='c6be061d96acf15f6d1303f88efde6807911b09e9e8d6ee858dfe24969aa646e';archive_sha256='21c0e0eb0b60a123854ec4d10d2bdbf69e1cb922bc2ed2591c89ec422262088a';key_id='SC-20261012-001'}
 }
 function Invoke-VerifyQaProjection([string]$Json,[int]$ExitCode,$Binding=(New-VerifyQaBinding)){
  $d=$null
  try{$d=[Text.Json.JsonDocument]::Parse($Json);return Read-VerifyPrepProjection $d.RootElement $ExitCode $Binding}catch{throw 'VERIFY_PREP_PROTOCOL_REFUSED'}finally{if($null -ne $d){$d.Dispose()}}
 }
 function Assert-VerifyQaRefusal([string]$Name,[scriptblock]$Operation,[string]$Code='VERIFY_PREP_PROTOCOL_REFUSED'){
  $refused=$false
  try{$null=&$Operation}catch{$refused=$true;if($_.Exception.Message -cne $Code){throw 'QA_UNEXPECTED_REFUSAL'}}
  if(-not $refused){throw 'QA_MISSING_REFUSAL'}
  $verifyQaPassed.Add($Name)
 }
 $binding=New-VerifyQaBinding;$copy=Read-VerifyPrepBinding $binding
 if([object]::ReferenceEquals($binding,$copy) -or $copy.Count -ne 9){throw 'QA_BINDING_COPY_REFUSED'}
 $verifyQaPassed.Add('closed exact new binding copied without private I/O')
 foreach($bad in @($null,@{},@())){Assert-VerifyQaRefusal 'missing/array binding' {Read-VerifyPrepBinding $bad} 'VERIFY_PREP_BINDING_REFUSED'}
 foreach($case in @(
  @('path','C:\different\archive.scbackup'),@('bytes',951231L),@('sha256',('0'*64)),
  @('entries',2L),@('databaseEntries',0L),@('storageObjects',1L),@('plaintextBytes',950018L),
  @('manifestSha256',('0'*64)),@('keyId','different'),@('bytes',951230.0),@('bytes','951230')
 )){
  $b=New-VerifyQaBinding;$b[$case[0]]=$case[1]
  Assert-VerifyQaRefusal ('binding mismatch '+$case[0]) {Read-VerifyPrepBinding $b} 'VERIFY_PREP_BINDING_REFUSED'
 }
 $b=New-VerifyQaBinding;$b['extra']='private canary'
 Assert-VerifyQaRefusal 'binding extra property' {Read-VerifyPrepBinding $b} 'VERIFY_PREP_BINDING_REFUSED'
 $success=New-VerifyQaSuccess|ConvertTo-Json -Compress;$projection=Invoke-VerifyQaProjection $success 0
 if(-not $projection.ok -or -not $projection.archiveVerified -or $projection.targetQueried -or $projection.remoteExecuted -or $projection.restoreAccepted){throw 'QA_SUCCESS_FAILED'}
 $verifyQaPassed.Add('full expected manifest/counts/hash/key result verifies without restore authority')
 Assert-VerifyQaRefusal 'success exit mismatch' {Invoke-VerifyQaProjection $success 1}
 Assert-VerifyQaRefusal 'duplicate JSON property' {Invoke-VerifyQaProjection ($success.Replace('"ok":true','"ok":true,"ok":true')) 0}
 Assert-VerifyQaRefusal 'two JSON documents' {Invoke-VerifyQaProjection ($success+$success) 0}
 foreach($case in @(
  @('extra','private canary'),@('operation','restore'),@('entries',2),@('database_entries',2),
  @('storage_objects',1),@('plaintext_bytes',950018),@('plaintext_bytes',1.5),
  @('plaintext_bytes',9007199254740992),@('archive_sha256',('0'*64)),
  @('manifest_sha256',('0'*64)),@('key_id','other'),@('ok','true')
 )){
  $v=New-VerifyQaSuccess;$v[$case[0]]=$case[1];$json=$v|ConvertTo-Json -Compress
  Assert-VerifyQaRefusal ('result mismatch '+$case[0]) {Invoke-VerifyQaProjection $json 0}
 }
 $codesAssignment=@($verifyQaAst.FindAll({param($n)$n -is [Management.Automation.Language.AssignmentStatementAst] -and $n.Left.Extent.Text -ceq '$verifyCodes'},$true))
 if($codesAssignment.Count -ne 1){throw 'QA_CODES_REFUSED'}
 foreach($c in [regex]::Matches($codesAssignment[0].Extent.Text,"'([A-Z][A-Z0-9_]+)'")){
  $json=[ordered]@{ok=$false;operation='backup';error=$c.Groups[1].Value}|ConvertTo-Json -Compress
  $p=Invoke-VerifyQaProjection $json 1
  if($p.ok -or $p.archiveVerified -or $p.error -cne $c.Groups[1].Value){throw 'QA_CLOSED_CODE_FAILED'}
  $verifyQaPassed.Add('closed CLI code '+$c.Groups[1].Value)
 }
 $operator='{"ok":false,"operation":"operator","error":"OPERATOR_SETUP_FAILED"}';$p=Invoke-VerifyQaProjection $operator 1
 if($p.ok -or $p.archiveVerified){throw 'QA_OPERATOR_REFUSAL_FAILED'}
 $verifyQaPassed.Add('operator refusal')
 Assert-VerifyQaRefusal 'failure exit mismatch' {Invoke-VerifyQaProjection $operator 0}
 Assert-VerifyQaRefusal 'provider text refused' {Invoke-VerifyQaProjection '{"ok":false,"operation":"backup","error":"private canary"}' 1}
 [ordered]@{ok=$true;operation='backup_verify_preparation_ast_qa';tests=$verifyQaPassed.Count;nativeExecuted=$false;privateInputsOpened=$false}|ConvertTo-Json -Compress
} catch {
 $verifyQaCode=if($_.Exception.Message -cmatch '^QA_[A-Z_]+$'){$_.Exception.Message}else{'QA_REFUSED'}
 [ordered]@{ok=$false;operation='backup_verify_preparation_ast_qa';code=$verifyQaCode;passed=$verifyQaPassed.Count;nativeExecuted=$false;privateInputsOpened=$false}|ConvertTo-Json -Compress
 exit 1
} finally {
 if($null -ne $verifyQaBytes){[Array]::Clear($verifyQaBytes,0,$verifyQaBytes.Length)}
}
