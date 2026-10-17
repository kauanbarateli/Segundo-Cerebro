# Public AST/RAM QA only. Never loads the launcher body, profile, archive,
# dispatcher, filesystem guards, process launcher, native executables or network.
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$backupQaPassed=[Collections.Generic.List[string]]::new()
$backupQaBytes=$null
try {
 if($PSVersionTable.PSVersion.Major -ne 7){throw 'QA_PS7_REQUIRED'}
 $backupQaPath=Join-Path $PSScriptRoot 'create-backup-preparacao-20261017-v1.ps1'
 $backupQaBytes=[IO.File]::ReadAllBytes($backupQaPath)
 if($backupQaBytes.Length -ne 22534 -or [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($backupQaBytes)) -cne '9E6C66A1A37E7B1C46B48F5962557EAD89691A31EEB16856B6FA2CD245400DEE'){throw 'QA_SOURCE_PIN_REFUSED'}
 $backupQaText=[Text.UTF8Encoding]::new($false,$true).GetString($backupQaBytes)
 $backupQaTokens=$null;$backupQaErrors=$null
 $backupQaAst=[Management.Automation.Language.Parser]::ParseInput($backupQaText,[ref]$backupQaTokens,[ref]$backupQaErrors)
 if($backupQaErrors.Count){throw 'QA_SOURCE_PARSE_REFUSED'}
 $backupQaNames=@('Stop-BackupPrep','Assert-BackupPrepObject','Assert-BackupPrepUniqueJson','Read-BackupPrepEnum','Read-BackupPrepBool','Read-BackupPrepCount','Read-BackupPrepDigest','Read-BackupPrepProjection')
 $backupQaDefinitions=[Collections.Generic.List[string]]::new()
 foreach($backupQaName in $backupQaNames){
  $backupQaMatch=@($backupQaAst.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq $backupQaName},$true))
  if($backupQaMatch.Count -ne 1){throw 'QA_FUNCTION_SELECTION_REFUSED'}
  $backupQaDefinitions.Add($backupQaMatch[0].Extent.Text)
 }
 $backupQaPure=$backupQaDefinitions -join [string][char]10
 $backupQaPureTokens=$null;$backupQaPureErrors=$null
 $backupQaPureAst=[Management.Automation.Language.Parser]::ParseInput($backupQaPure,[ref]$backupQaPureTokens,[ref]$backupQaPureErrors)
 if($backupQaPureErrors.Count -ne 0 -or $backupQaPureAst.EndBlock.Statements.Count -ne $backupQaNames.Count){throw 'QA_PURE_AST_REFUSED'}
 foreach($backupQaStatement in $backupQaPureAst.EndBlock.Statements){
  if($backupQaStatement -isnot [Management.Automation.Language.FunctionDefinitionAst] -or $backupQaNames -cnotcontains $backupQaStatement.Name){throw 'QA_PURE_AST_REFUSED'}
 }
 . ([scriptblock]::Create($backupQaPure))
 $backupQaPassed.Add('exclusive pure function AST selection and source pin')
 foreach($backupQaDefault in @(@('GateExecute','$false'),@('ReviewedCommit','$null'),@('NewQuiescenceDeclared','$false'),@('SelfSha256',"''"))){
  $backupQaParam=@($backupQaAst.ParamBlock.Parameters|Where-Object{$_.Name.VariablePath.UserPath -ceq $backupQaDefault[0]})
  if($backupQaParam.Count -ne 1 -or $backupQaParam[0].DefaultValue.Extent.Text -cne $backupQaDefault[1]){throw 'QA_DEFAULT_GATE_REFUSED'}
 }
 if($backupQaAst.EndBlock.Statements[2] -isnot [Management.Automation.Language.IfStatementAst] -or $backupQaAst.EndBlock.Statements[2].Clauses[0].Item1.Extent.Text -cne '-not $GateExecute'){throw 'QA_EARLY_GATE_REFUSED'}
 $backupQaPassed.Add('false gates/null commit precede all I/O')
 $backupQaPinsAssignment=@($backupQaAst.FindAll({param($n)$n -is [Management.Automation.Language.AssignmentStatementAst] -and $n.Left.Extent.Text -ceq '$backupPrepSources'},$true))
 if($backupQaPinsAssignment.Count -ne 1){throw 'QA_UNION_REFUSED'}
 $backupQaPins=[regex]::Matches($backupQaPinsAssignment[0].Extent.Text,"@\('([^']+)',([0-9]+),'([A-F0-9]{64})'\)")
 $backupQaPaths=@('scripts/operations/run-operator.ps1','scripts/operations/backup.mjs','scripts/operations/backup-config.mjs','scripts/operations/backup-sources.mjs','scripts/operations/backup-format.mjs','scripts/operations/restore-verify.mjs','scripts/operations/restore-target.mjs','scripts/operations/postgres-process.mjs')
 if($backupQaPins.Count -ne 8){throw 'QA_UNION_REFUSED'}
 for($i=0;$i -lt 8;$i++){if($backupQaPins[$i].Groups[1].Value -cne $backupQaPaths[$i] -or [long]$backupQaPins[$i].Groups[2].Value -le 0){throw 'QA_UNION_REFUSED'}}
 foreach($backupQaGuard in @(
  '[IO.FileShare]::Read','ls-files --error-unmatch -- @backupPrepSourcePaths',
  '$backupPrepGit = (@(Get-Command git -CommandType Application -ErrorAction Stop)[0]).Source',
  '$backupPrepWatch.ElapsedMilliseconds -ge 600000',
  '$backupPrepOutput.Length + $backupPrepReadCount -gt 65536',
  '-not $backupPrepOutDone -or -not $backupPrepErrDone -or -not $backupPrepProcess.HasExited',
  '$backupPrepStart.Environment.Clear()',
  '$backupPrepStart.Environment[''PATHEXT''] = ''.EXE''',
  '$backupPrepStart.Environment[''SC_BACKUP_QUIESCED''] = ''YES''',
  "'-Operation','create'",
  "'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe' 632320 '46C8AD2E487FA01BB5401AE3B383C09E20789EFDD3A37C6940975647EB1FF574'",
  "Open-BackupPrepPin $"+"backupPrepProfile 4206 '5D9C83138241DBBF3EA94722E46BF4A67EA52B2EF22D72F7F05055BBC214F32C'",
  "certificates\prod-ca-2021.crt' -1 '700723581420DD1AC98FD7E9AC529F0EF210EADCAF87FC868A3AD7D114C2F3B7'",
  "'S-1-5-18','S-1-5-32-544'","FileSystemType -cne 'NTFS'",
  'Get-Acl -LiteralPath $backupPrepResolved','ReparsePoint',
  '$backupPrepTransportReviewed = $true',
  '[Text.UTF8Encoding]::new($false,$true)'
 )){if(-not $backupQaText.Contains($backupQaGuard)){throw 'QA_SOURCE_GUARD_REFUSED'}}
 $backupQaPrivate=$backupQaText.IndexOf(' $backupPrepProfile =')
 if($backupQaPrivate -lt 0 -or $backupQaText.IndexOf("if (-not "+'$backupPrepTransportReviewed'+")") -gt $backupQaPrivate){throw 'QA_TRANSPORT_GATE_POSITION_REFUSED'}
 foreach($backupQaForbidden in @("'-Archive'","'-Operation','restore'","'-Operation','verify'",'Import-Clixml','Export-Clixml','ExecutionPolicy','Set-Acl','Remove-Item')){
  if($backupQaText.Contains($backupQaForbidden)){throw 'QA_AUTHORITY_REFUSED'}
 }
 $backupQaPassed.Add('eight pins/exclusive create/sterile env/private leases/NTFS/deadline review guards')
 function Invoke-BackupQaProjection([string]$Json,[int]$ExitCode){
  $d=$null
  try{$d=[Text.Json.JsonDocument]::Parse($Json);return Read-BackupPrepProjection $d.RootElement $ExitCode}catch{throw 'BACKUP_PREP_PROTOCOL_REFUSED'}finally{if($null -ne $d){$d.Dispose()}}
 }
 function New-BackupQaSuccess {
  return [ordered]@{ok=$true;operation='encrypted_backup';archive_name='second-brain-2026-10-17T12-00-00-000Z-01234567.scbackup';entries=1;database_entries=1;storage_objects=0;plaintext_bytes=1000;manifest_sha256=('a'*64);archive_sha256=('b'*64);key_id='SC-20261012-001'}
 }
 function Assert-BackupQaRefusal([string]$Name,[scriptblock]$Operation){
  $refused=$false
  try{$null=&$Operation}catch{$refused=$true;if($_.Exception.Message -cne 'BACKUP_PREP_PROTOCOL_REFUSED'){throw 'QA_UNEXPECTED_REFUSAL'}}
  if(-not $refused){throw 'QA_MISSING_REFUSAL'}
  $backupQaPassed.Add($Name)
 }
 $success=(New-BackupQaSuccess)|ConvertTo-Json -Compress
 $projection=Invoke-BackupQaProjection $success 0
 if(-not $projection.ok -or $projection.backupQualified -or $projection.restoreAccepted -or -not $projection.separateVerifyRequired -or $projection.archive_name -cne (New-BackupQaSuccess).archive_name){throw 'QA_SUCCESS_FAILED'}
 $backupQaPassed.Add('create report remains unqualified pending separate verify')
 $objects=New-BackupQaSuccess;$objects.entries=1000001;$objects.storage_objects=1000000
 $projection=Invoke-BackupQaProjection ($objects|ConvertTo-Json -Compress) 0
 if($projection.storage_objects -ne 1000000){throw 'QA_LIMIT_EDGE_FAILED'}
 $backupQaPassed.Add('maximum inventory accepted without personal metadata')
 Assert-BackupQaRefusal 'native exit mismatch success' {Invoke-BackupQaProjection $success 1}
 Assert-BackupQaRefusal 'duplicate JSON property' {Invoke-BackupQaProjection ($success.Replace('"ok":true','"ok":true,"ok":true')) 0}
 foreach($case in @(
  @('extra private field','payload','private canary'),
  @('foreign key id','key_id','other-id'),
  @('unknown operation','operation','restore'),
  @('path instead of basename','archive_name','C:\private\canary.scbackup'),
  @('unknown archive name','archive_name','other.scbackup'),
  @('database count mismatch','database_entries',2),
  @('entry count mismatch','entries',2),
  @('object count overflow','storage_objects',1000001),
  @('object count negative','storage_objects',-1),
  @('fraction count','plaintext_bytes',1.5),
  @('unsafe integer count','plaintext_bytes',9007199254740992),
  @('zero bytes','plaintext_bytes',0),
  @('digest contains payload','archive_sha256','private canary'),
  @('uppercase digest','manifest_sha256',('A'*64)),
  @('boolean type','ok','true')
 )){
  $value=New-BackupQaSuccess;$value[$case[1]]=$case[2];$json=$value|ConvertTo-Json -Compress
  Assert-BackupQaRefusal $case[0] {Invoke-BackupQaProjection $json 0}
 }
 $codesAssignment=@($backupQaAst.FindAll({param($n)$n -is [Management.Automation.Language.AssignmentStatementAst] -and $n.Left.Extent.Text -ceq '$backupPrepCliErrors'},$true))
 if($codesAssignment.Count -ne 1){throw 'QA_CODES_REFUSED'}
 $codes=[regex]::Matches($codesAssignment[0].Extent.Text,"'([A-Z][A-Z0-9_]+)'")
 foreach($c in $codes){
  $value=[ordered]@{ok=$false;operation='backup';error=$c.Groups[1].Value};$json=$value|ConvertTo-Json -Compress
  $projection=Invoke-BackupQaProjection $json 1
  if($projection.ok -or $projection.backupQualified -or $projection.error -cne $c.Groups[1].Value){throw 'QA_CLOSED_CODE_FAILED'}
  $backupQaPassed.Add('closed CLI refusal '+$c.Groups[1].Value)
 }
 $operator='{"ok":false,"operation":"operator","error":"OPERATOR_SETUP_FAILED"}'
 $projection=Invoke-BackupQaProjection $operator 1
 if($projection.ok -or $projection.error -cne 'OPERATOR_SETUP_FAILED'){throw 'QA_OPERATOR_REFUSAL_FAILED'}
 $backupQaPassed.Add('closed operator refusal')
 Assert-BackupQaRefusal 'failure exit mismatch' {Invoke-BackupQaProjection $operator 0}
 Assert-BackupQaRefusal 'unknown error cannot leak provider text' {Invoke-BackupQaProjection '{"ok":false,"operation":"backup","error":"private canary"}' 1}
 Assert-BackupQaRefusal 'ambiguous two JSON reports' {Invoke-BackupQaProjection ($success+$success) 0}
 [ordered]@{ok=$true;operation='backup_create_preparation_ast_qa';tests=$backupQaPassed.Count;nativeExecuted=$false;privateInputsOpened=$false}|ConvertTo-Json -Compress
} catch {
 # Public tests never include JSON payload/provider messages in diagnostics.
 $backupQaCode=if($_.Exception.Message -cmatch '^QA_[A-Z_]+$'){$_.Exception.Message}else{'QA_REFUSED'}
 [ordered]@{ok=$false;operation='backup_create_preparation_ast_qa';code=$backupQaCode;passed=$backupQaPassed.Count;nativeExecuted=$false;privateInputsOpened=$false}|ConvertTo-Json -Compress
 exit 1
} finally {
 if($null -ne $backupQaBytes){[Array]::Clear($backupQaBytes,0,$backupQaBytes.Length)}
}
