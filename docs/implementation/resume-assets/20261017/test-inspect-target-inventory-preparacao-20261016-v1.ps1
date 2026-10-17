# RAM-only QA for the target-only preparation. No dispatcher, profile, archive,
# executable, native process, PostgreSQL, SQL client or network is invoked.
# Only the public source and a fixed allowlist of PURE FunctionDefinitionAst
# bodies are read. Root separately runs the inert gate on the reviewed copy.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$targetPrepQaPassed = [Collections.Generic.List[string]]::new()
$targetPrepQaBytes = $null
try {
 if ($PSVersionTable.PSVersion.Major -ne 7) { throw 'QA_PS7_REQUIRED' }
 $targetPrepQaPath = Join-Path $PSScriptRoot 'inspect-target-inventory-preparacao-20261016-v1.ps1'
 $targetPrepQaBytes = [IO.File]::ReadAllBytes($targetPrepQaPath)
 $targetPrepQaHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($targetPrepQaBytes))
 if ($targetPrepQaBytes.Length -ne 36194 -or $targetPrepQaHash -cne '9E5685424135A34DEF796D53CBA113838C9B82AFCB6785B990BB3744D13446F8') { throw 'QA_SOURCE_PIN_REFUSED' }
 $targetPrepQaText = [Text.UTF8Encoding]::new($false,$true).GetString($targetPrepQaBytes)
 $targetPrepQaTokens = $null; $targetPrepQaErrors = $null
 $targetPrepQaAst = [Management.Automation.Language.Parser]::ParseInput($targetPrepQaText,[ref]$targetPrepQaTokens,[ref]$targetPrepQaErrors)
 if ($targetPrepQaErrors.Count -ne 0) { throw 'QA_SOURCE_PARSE_REFUSED' }
 $targetPrepQaNames = @('Stop-TargetPrep','Assert-TargetPrepObject','Assert-TargetPrepUniqueJson','Read-TargetPrepEnum','Read-TargetPrepBool','Read-TargetPrepCount','Read-TargetPrepNullableEnum','Read-TargetPrepDiagnostic','Read-TargetPrepSnapshotDiagnostic','Read-TargetPrepInventory','Read-TargetPrepProjection')
 $targetPrepQaAllFunctions = @($targetPrepQaAst.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst]},$true))
 $targetPrepQaDefinitions = [Collections.Generic.List[string]]::new()
 foreach ($targetPrepQaName in $targetPrepQaNames) {
  $targetPrepQaMatching = @($targetPrepQaAllFunctions | Where-Object {$_.Name -ceq $targetPrepQaName})
  if ($targetPrepQaMatching.Count -ne 1) { throw 'QA_FUNCTION_SELECTION_REFUSED' }
  $targetPrepQaDefinitions.Add($targetPrepQaMatching[0].Extent.Text)
 }
 $targetPrepQaPureText = $targetPrepQaDefinitions -join [string][char]10
 $targetPrepQaPureTokens=$null; $targetPrepQaPureErrors=$null
 $targetPrepQaPureAst=[Management.Automation.Language.Parser]::ParseInput($targetPrepQaPureText,[ref]$targetPrepQaPureTokens,[ref]$targetPrepQaPureErrors)
 if ($targetPrepQaPureErrors.Count -ne 0 -or $targetPrepQaPureAst.EndBlock.Statements.Count -ne $targetPrepQaNames.Count) { throw 'QA_PURE_AST_REFUSED' }
 foreach ($targetPrepQaStatement in $targetPrepQaPureAst.EndBlock.Statements) {
  if ($targetPrepQaStatement -isnot [Management.Automation.Language.FunctionDefinitionAst] -or $targetPrepQaNames -cnotcontains $targetPrepQaStatement.Name) { throw 'QA_PURE_AST_REFUSED' }
 }
 . ([scriptblock]::Create($targetPrepQaPureText))
 $targetPrepQaPassed.Add('pinned source and exclusive pure AST selection')

 $targetPrepQaGate=@($targetPrepQaAst.ParamBlock.Parameters | Where-Object {$_.Name.VariablePath.UserPath -ceq 'GateExecute'})
 $targetPrepQaCommit=@($targetPrepQaAst.ParamBlock.Parameters | Where-Object {$_.Name.VariablePath.UserPath -ceq 'ReviewedCommit'})
 if ($targetPrepQaGate.Count -ne 1 -or $targetPrepQaGate[0].DefaultValue.Extent.Text -cne '$false' -or $targetPrepQaCommit.Count -ne 1 -or $targetPrepQaCommit[0].DefaultValue.Extent.Text -cne '$null') { throw 'QA_DEFAULT_GATES_REFUSED' }
 if ($targetPrepQaAst.EndBlock.Statements[2] -isnot [Management.Automation.Language.IfStatementAst] -or $targetPrepQaAst.EndBlock.Statements[2].Clauses[0].Item1.Extent.Text -cne '-not $GateExecute') { throw 'QA_EARLY_GATE_REFUSED' }
 $targetPrepQaPassed.Add('inert false gate and null reviewed commit precede I/O')
 $targetPrepQaPaths=@('scripts/operations/run-operator.ps1','scripts/operations/restore-managed-inspect.mjs','scripts/operations/backup-format.mjs','scripts/operations/backup-config.mjs','scripts/operations/restore-target.mjs','scripts/operations/postgres-process.mjs','scripts/operations/backup-sources.mjs','scripts/operations/restore-managed-plan.mjs','scripts/operations/restore-custom-header.mjs','scripts/operations/restore-custom-toc.mjs','scripts/operations/restore-migration-history.mjs','scripts/operations/restore-migration-history-native.mjs','scripts/operations/restore-native-binary-output.mjs','scripts/operations/restore-managed-native-adapters.mjs','scripts/operations/restore-managed-validation-sql.mjs','scripts/operations/restore-target-snapshot-protocol.mjs','scripts/operations/restore-target-snapshot-native.mjs')
 $targetPrepQaUnion=@($targetPrepQaAst.FindAll({param($node) $node -is [Management.Automation.Language.AssignmentStatementAst] -and $node.Left.Extent.Text -ceq '$targetPrepSources'},$true))
 if ($targetPrepQaUnion.Count -ne 1) { throw 'QA_SOURCE_UNION_REFUSED' }
 $targetPrepQaPins=[regex]::Matches($targetPrepQaUnion[0].Extent.Text,"@\('([^']+)',([0-9]+),'([A-F0-9]{64})'\)")
 if ($targetPrepQaPins.Count -ne 17) { throw 'QA_SOURCE_UNION_REFUSED' }
 for($targetPrepQaIndex=0;$targetPrepQaIndex -lt 17;$targetPrepQaIndex++) {
  if($targetPrepQaPins[$targetPrepQaIndex].Groups[1].Value -cne $targetPrepQaPaths[$targetPrepQaIndex] -or [long]$targetPrepQaPins[$targetPrepQaIndex].Groups[2].Value -le 0){throw 'QA_SOURCE_UNION_REFUSED'}
 }
 foreach($targetPrepQaGuard in @(
  '[IO.FileShare]::Read','ls-files --error-unmatch -- @targetPrepSourcePaths',
  '$targetPrepGit = (@(Get-Command git -CommandType Application -ErrorAction Stop)[0]).Source',
  '$targetPrepWatch.ElapsedMilliseconds -ge 60000',
  '$targetPrepOutput.Length + $targetPrepReadCount -gt 65536',
  '-not $targetPrepOutDone -or -not $targetPrepErrDone -or -not $targetPrepProcess.HasExited',
  '$targetPrepStart.Environment.Clear()',
  '$targetPrepStart.Environment[''PATHEXT''] = ''.EXE''',
  "'-Operation','restore-inspect-target-inventory'",
  "'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe' 632320 '46C8AD2E487FA01BB5401AE3B383C09E20789EFDD3A37C6940975647EB1FF574'",
  "'C:\Program Files\PostgreSQL\17\bin\psql.exe' 635392 'C290C7F0A3335F290F8C18011A1E5AFA03EE3CDD628697A5F3E767E5F1D3D10D'",
  "'C:\Program Files\PostgreSQL\18\bin\pg_restore.exe' 379392 'E07BDB23F2D2A7E4D2DB7A50386CD43049F4216540FA18E2FAF79B80AB43AC18'",
  "Open-TargetPrepPin $" + "targetPrepProfile 3901 'E2CD837487821DD266D5F87223B5D65C56DD4CE0029CC52FE1DD71644EED740B'",
  "certificates\prod-ca-2021.crt' -1 '700723581420DD1AC98FD7E9AC529F0EF210EADCAF87FC868A3AD7D114C2F3B7'",
  'SelfSha256','[Text.UTF8Encoding]::new($false,$true)'
 )) {if(-not $targetPrepQaText.Contains($targetPrepQaGuard)){throw 'QA_SOURCE_GUARD_REFUSED'}}
 if ($targetPrepQaText.Contains('$targetPrepArchive') -or $targetPrepQaText.Contains("'-Archive'") -or $targetPrepQaText.Contains("'-Operation','restore'") -or $targetPrepQaText.Contains('ExecutionPolicy') -or $targetPrepQaText.Contains('Import-Clixml')) { throw 'QA_FORBIDDEN_AUTHORITY_REFUSED' }
 $targetPrepQaPassed.Add('17 transitive pins, executable/certificate/profile leases and sterile launcher guards')
 function Invoke-TargetPrepQaProjection([string]$Json,[int]$ExitCode) {
  $qaDocument=[Text.Json.JsonDocument]::Parse($Json)
  try {return Read-TargetPrepProjection $qaDocument.RootElement $ExitCode}
  finally {$qaDocument.Dispose()}
 }
 function Assert-TargetPrepQaRefused([string]$QaCaseLabel,[scriptblock]$QaCaseAction) {
  $qaDidRefuse=$false
  try {$null=& $QaCaseAction} catch {$qaDidRefuse=$true;if($_.Exception.Message -notin @('TARGET_PREP_PROTOCOL_REFUSED','TARGET_PREP_NATIVE_REFUSED')){throw 'QA_UNEXPECTED_REFUSAL'}}
  if(-not $qaDidRefuse){throw 'QA_EXPECTED_REFUSAL_MISSING'}
  $targetPrepQaPassed.Add($QaCaseLabel)
 }
 function New-TargetPrepQaInventory {
  return [ordered]@{version=1;headersValid=$true;dumpEntries=16;countObserved=16;unknownClassCount=0;malformedRowCount=0;classes=@(
   [ordered]@{kind='ACL';count=1;scopes=@([ordered]@{category='app';count=1});tails=@([ordered]@{shape='valid';count=1})},
   [ordered]@{kind='DEFAULT ACL';count=1;scopes=@([ordered]@{category='app';count=1});tails=@([ordered]@{shape='valid';count=1})},
   [ordered]@{kind='FUNCTION';count=1;scopes=@([ordered]@{category='app';count=1});tails=@([ordered]@{shape='valid';count=1})},
   [ordered]@{kind='TABLE';count=13;scopes=@([ordered]@{category='managed';count=13});tails=@([ordered]@{shape='valid';count=13})}
  )}
 }
 function New-TargetPrepQaSuccess {
  return [ordered]@{ok=$true;operation='managed_restore_target_inventory_inspect';format=[ordered]@{archiveVersion='1.16-0';intSize=4;offSize=8;format='CUSTOM';compression='GZIP'};snapshot=[ordered]@{version=1;protocolOnly=$true;nativeOrigin=$false;readonlySnapshot=$true;repeatableRead=$true;actorValidated=$true;rlsBypass=$true;schemas=3;catalogueRelations=5;ordinaryTables=4;emptyDataTables=2;authHistoryRows=82;storageHistoryRows=73;allOtherTableDataEmpty=$true;restoreAccepted=$false};transportMode='native';customToc=[ordered]@{entries=16;encoding='UTF8';tocBytes=25000};inventory=(New-TargetPrepQaInventory);inspectionOnly=$true;baselineQualified=$false;targetQueried=$true;remoteMutation=$false;baselineCompared=$false;restoreAccepted=$false}
 }
 function New-TargetPrepQaFailure {
  return [ordered]@{ok=$false;operation='managed_restore_target_inventory_inspect';error='RESTORE_TARGET_SNAPSHOT_NATIVE_PROTOCOL_REFUSED';stage='target_snapshot';targetConnectionRequested=$true;nativeTargetDiagnostic=$null;nativeHistoryDiagnostic=$null;tocDiagnostic=$null;tocPlanDiagnostic=$null;inspectionOnly=$true;baselineQualified=$false;remoteMutation=$false;baselineCompared=$false;restoreAccepted=$false}
 }
 function New-TargetPrepQaProducer([bool]$Psql) {
  return [ordered]@{spawnObserved=$true;stdinFinishObserved=$Psql;inputCallbacks=$(if($Psql){2}else{0});stdoutBytes=$(if($Psql){200}else{551});stderrBytes=0;stdoutEofObserved=$true;stderrEofObserved=$true;producerExitZero=$true;producerCloseZero=$true}
 }
 $targetPrepQaGood=New-TargetPrepQaSuccess
 $targetPrepQaProjected=Invoke-TargetPrepQaProjection ($targetPrepQaGood|ConvertTo-Json -Depth 12 -Compress) 0
 if(-not $targetPrepQaProjected.ok -or -not $targetPrepQaProjected.targetQueried -or -not $targetPrepQaProjected.inspectionOnly -or $targetPrepQaProjected.baselineQualified -or $targetPrepQaProjected.restoreAccepted -or $targetPrepQaProjected.snapshot.authHistoryRows -ne 82 -or $targetPrepQaProjected.inventory.classes.Count -ne 4){throw 'QA_SUCCESS_PROJECTION_FAILED'}
 $targetPrepQaPassed.Add('native inspection projects all classes and never a baseline/history selection')
 Assert-TargetPrepQaRefused 'success cannot be exit1' {Invoke-TargetPrepQaProjection ($targetPrepQaGood|ConvertTo-Json -Depth 12 -Compress) 1}
 Assert-TargetPrepQaRefused 'extra root canary refused' {$v=New-TargetPrepQaSuccess;$v.private='PRIVATE_CANARY';Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 Assert-TargetPrepQaRefused 'extra nested canary refused' {$v=New-TargetPrepQaSuccess;$v.snapshot.private='PRIVATE_CANARY';Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 Assert-TargetPrepQaRefused 'duplicate root key refused' {$json=($targetPrepQaGood|ConvertTo-Json -Depth 12 -Compress).Replace('"ok":true','"ok":true,"ok":true');Invoke-TargetPrepQaProjection $json 0}
 Assert-TargetPrepQaRefused 'duplicate nested inventory key refused' {$json=($targetPrepQaGood|ConvertTo-Json -Depth 12 -Compress).Replace('"countObserved":16','"countObserved":16,"countObserved":16');Invoke-TargetPrepQaProjection $json 0}
 foreach($flag in @('remoteMutation','baselineQualified','baselineCompared','restoreAccepted')){
  Assert-TargetPrepQaRefused ('success authority flag: '+$flag) {$v=New-TargetPrepQaSuccess;$v[$flag]=$true;Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
  Assert-TargetPrepQaRefused ('failure authority flag: '+$flag) {$v=New-TargetPrepQaFailure;$v[$flag]=$true;Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 1}
 }
 foreach($success in @($true,$false)){
  Assert-TargetPrepQaRefused ('inspection-only flag required: '+$success) {$v=if($success){New-TargetPrepQaSuccess}else{New-TargetPrepQaFailure};$v.inspectionOnly=$false;Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) $(if($success){0}else{1})}
 }
 foreach($flag in @('protocolOnly','readonlySnapshot','repeatableRead','actorValidated','rlsBypass','allOtherTableDataEmpty')){
  Assert-TargetPrepQaRefused ('snapshot required fact: '+$flag) {$v=New-TargetPrepQaSuccess;$v.snapshot[$flag]=$false;Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 }
 foreach($flag in @('nativeOrigin','restoreAccepted')){
  Assert-TargetPrepQaRefused ('snapshot authority flag: '+$flag) {$v=New-TargetPrepQaSuccess;$v.snapshot[$flag]=$true;Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 }
 foreach($mode in @('synthetic','unknown')){
  Assert-TargetPrepQaRefused ('synthetic transport refused: '+$mode) {$v=New-TargetPrepQaSuccess;$v.transportMode=$mode;Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 }
 foreach($operationName in @('managed_restore_target_baseline_inspect','managed_restore_history_inspect','PRIVATE_CANARY')){
  Assert-TargetPrepQaRefused ('another operation refused: '+$operationName) {$v=New-TargetPrepQaSuccess;$v.operation=$operationName;Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 }
 Assert-TargetPrepQaRefused 'native success needs original target query' {$v=New-TargetPrepQaSuccess;$v.targetQueried=$false;Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 Assert-TargetPrepQaRefused 'fractional catalogue count refused' {$v=New-TargetPrepQaSuccess;$v.snapshot.catalogueRelations=5.5;Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 Assert-TargetPrepQaRefused 'catalogue cap refused' {$v=New-TargetPrepQaSuccess;$v.snapshot.catalogueRelations=1001;Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 Assert-TargetPrepQaRefused 'ordinary tables cannot exceed catalogue' {$v=New-TargetPrepQaSuccess;$v.snapshot.catalogueRelations=3;Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 Assert-TargetPrepQaRefused 'two history-table exceptions required' {$v=New-TargetPrepQaSuccess;$v.snapshot.emptyDataTables=1;Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 Assert-TargetPrepQaRefused 'preserved entries forbidden' {$v=New-TargetPrepQaSuccess;$v.customToc.preservedEntries=16;Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 Assert-TargetPrepQaRefused 'migration history projection forbidden' {$v=New-TargetPrepQaSuccess;$v.migrationHistory=@{authRows=82;storageRows=73};Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 foreach($name in @('version','headersValid','dumpEntries','countObserved','unknownClassCount','malformedRowCount','classes')){
  Assert-TargetPrepQaRefused ('inventory missing field: '+$name) {$v=New-TargetPrepQaSuccess;$v.inventory.Remove($name);Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 }
 foreach($name in @('dumpEntries','countObserved')){
  Assert-TargetPrepQaRefused ('inventory total mismatch: '+$name) {$v=New-TargetPrepQaSuccess;$v.inventory[$name]=15;Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 }
 foreach($name in @('unknownClassCount','malformedRowCount')){
  Assert-TargetPrepQaRefused ('inventory failure count nonzero: '+$name) {$v=New-TargetPrepQaSuccess;$v.inventory[$name]=1;Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 }
 Assert-TargetPrepQaRefused 'headers must be valid' {$v=New-TargetPrepQaSuccess;$v.inventory.headersValid=$false;Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 Assert-TargetPrepQaRefused 'unknown inventory fields refused' {$v=New-TargetPrepQaSuccess;$v.inventory.sql='PRIVATE_CANARY';Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 Assert-TargetPrepQaRefused 'classes must be an array' {$v=New-TargetPrepQaSuccess;$v.inventory.classes=@{kind='TABLE'};Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 Assert-TargetPrepQaRefused 'classes cannot be empty' {$v=New-TargetPrepQaSuccess;$v.inventory.classes=@();Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 Assert-TargetPrepQaRefused 'duplicate class refused' {$v=New-TargetPrepQaSuccess;$v.inventory.classes[1]=$v.inventory.classes[0];Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 Assert-TargetPrepQaRefused 'class order cannot change' {$v=New-TargetPrepQaSuccess;$v.inventory.classes=@($v.inventory.classes[1],$v.inventory.classes[0],$v.inventory.classes[2],$v.inventory.classes[3]);Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 foreach($kind in @('PRIVATE_CANARY','TABLE private_name','EXTENSION')){
  Assert-TargetPrepQaRefused ('class not supported by inspection planner: '+$kind) {$v=New-TargetPrepQaSuccess;$v.inventory.classes[0].kind=$kind;Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 }
 foreach($extra in @('tag','owner','definition','oid','name')){
  Assert-TargetPrepQaRefused ('private class field refused: '+$extra) {$v=New-TargetPrepQaSuccess;$v.inventory.classes[0][$extra]='PRIVATE_CANARY';Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 }
 foreach($count in @(-1,0,1.5,10001,'1')){
  Assert-TargetPrepQaRefused ('invalid class count: '+$count) {$v=New-TargetPrepQaSuccess;$v.inventory.classes[0].count=$count;Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 }
 Assert-TargetPrepQaRefused 'class sum must equal total' {$v=New-TargetPrepQaSuccess;$v.inventory.classes[0].count=2;$v.inventory.classes[0].scopes[0].count=2;$v.inventory.classes[0].tails[0].count=2;Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 Assert-TargetPrepQaRefused 'scope sum must equal class' {$v=New-TargetPrepQaSuccess;$v.inventory.classes[0].scopes[0].count=2;Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 Assert-TargetPrepQaRefused 'scope array cannot be empty' {$v=New-TargetPrepQaSuccess;$v.inventory.classes[0].scopes=@();Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 Assert-TargetPrepQaRefused 'scope duplicate refused' {$v=New-TargetPrepQaSuccess;$v.inventory.classes[0].scopes=@($v.inventory.classes[0].scopes[0],$v.inventory.classes[0].scopes[0]);Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 Assert-TargetPrepQaRefused 'scope unknown label refused' {$v=New-TargetPrepQaSuccess;$v.inventory.classes[0].scopes[0].category='PRIVATE_CANARY';Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 Assert-TargetPrepQaRefused 'unparsed scope cannot qualify valid inventory' {$v=New-TargetPrepQaSuccess;$v.inventory.classes[0].scopes[0].category='unparsed';Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 Assert-TargetPrepQaRefused 'scope private field refused' {$v=New-TargetPrepQaSuccess;$v.inventory.classes[0].scopes[0].schema='PRIVATE_CANARY';Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 Assert-TargetPrepQaRefused 'tail sum must equal class' {$v=New-TargetPrepQaSuccess;$v.inventory.classes[0].tails[0].count=2;Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 Assert-TargetPrepQaRefused 'tail duplicate refused' {$v=New-TargetPrepQaSuccess;$v.inventory.classes[0].tails=@($v.inventory.classes[0].tails[0],$v.inventory.classes[0].tails[0]);Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 Assert-TargetPrepQaRefused 'malformed tail refused' {$v=New-TargetPrepQaSuccess;$v.inventory.classes[0].tails[0].shape='missing_fields';Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 Assert-TargetPrepQaRefused 'tail private field refused' {$v=New-TargetPrepQaSuccess;$v.inventory.classes[0].tails[0].text='PRIVATE_CANARY';Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 $targetPrepQaKinds=@('ACL','COMMENT','CONSTRAINT','DATABASE','DATABASE PROPERTIES','DEFAULT','DEFAULT ACL','ENCODING','FK CONSTRAINT','FUNCTION','INDEX','POLICY','ROW SECURITY','SCHEMA','SEARCHPATH','SEQUENCE','SEQUENCE OWNED BY','SEQUENCE SET','STDSTRINGS','TABLE','TABLE DATA','TRIGGER','TYPE','VIEW')
 foreach($kind in $targetPrepQaKinds){
  $v=New-TargetPrepQaSuccess;$v.inventory.classes=@([ordered]@{kind=$kind;count=16;scopes=@([ordered]@{category='managed';count=16});tails=@([ordered]@{shape='valid';count=16})})
  $projection=Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0
  if($projection.inventory.classes[0].kind -cne $kind){throw 'QA_INVENTORY_CLASS_LOST'}
  $targetPrepQaPassed.Add('exact public inspection class: '+$kind)
 }
 foreach($category in @('app','managed','global','other')){
  $v=New-TargetPrepQaSuccess;$v.inventory.classes[0].scopes[0].category=$category;$null=Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0;$targetPrepQaPassed.Add('exact scope enum: '+$category)
 }
 $v=New-TargetPrepQaSuccess;$v.inventory.classes[3].scopes=@([ordered]@{category='app';count=3},[ordered]@{category='managed';count=4},[ordered]@{category='global';count=3},[ordered]@{category='other';count=3});$null=Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0;$targetPrepQaPassed.Add('complete scope distribution is retained')
 Assert-TargetPrepQaRefused 'scope order refused' {$v=New-TargetPrepQaSuccess;$v.inventory.classes[3].scopes=@([ordered]@{category='global';count=6},[ordered]@{category='app';count=7});Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 $targetPrepQaRefusal=New-TargetPrepQaFailure
 $targetPrepQaProjected=Invoke-TargetPrepQaProjection ($targetPrepQaRefusal|ConvertTo-Json -Depth 12 -Compress) 1
 if($targetPrepQaProjected.ok -or $targetPrepQaProjected.error -cne $targetPrepQaRefusal.error){throw 'QA_CLI_REFUSAL_FAILED'}
 $targetPrepQaPassed.Add('closed target refusal preserved')
 $targetPrepQaOperator=Invoke-TargetPrepQaProjection '{"ok":false,"operation":"operator","error":"OPERATOR_SETUP_FAILED"}' 1
 if($targetPrepQaOperator.error -cne 'OPERATOR_SETUP_FAILED'){throw 'QA_OPERATOR_REFUSAL_FAILED'}
 $targetPrepQaPassed.Add('operator refusal preserved')
 foreach($code in @('RESTORE_MANAGED_TARGET_BINDING_INVALID','RESTORE_MANAGED_TARGET_INSPECTION_REQUIRED','RESTORE_MANAGED_TARGET_INSPECTION_UNSUPPORTED','RESTORE_CUSTOM_TOC_INSPECTION_REQUIRED')){
  $v=New-TargetPrepQaFailure;$v.error=$code;$v.stage='plan';$projection=Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 1
  if($projection.ok -or $projection.error -cne $code){throw 'QA_INSPECTION_REFUSAL_FAILED'}
  $targetPrepQaPassed.Add('closed inspection refusal: '+$code)
 }
 Assert-TargetPrepQaRefused 'failure cannot be exit0' {Invoke-TargetPrepQaProjection ($targetPrepQaRefusal|ConvertTo-Json -Depth 12 -Compress) 0}
 Assert-TargetPrepQaRefused 'unknown failure code refused' {$v=New-TargetPrepQaFailure;$v.error='PRIVATE_CANARY';Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 1}
 Assert-TargetPrepQaRefused 'unknown failure stage refused' {$v=New-TargetPrepQaFailure;$v.stage='PRIVATE_CANARY';Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 1}
 Assert-TargetPrepQaRefused 'B3 stage cannot appear' {$v=New-TargetPrepQaFailure;$v.stage='native_history';Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 1}
 Assert-TargetPrepQaRefused 'B3 diagnostic cannot appear' {$v=New-TargetPrepQaFailure;$v.nativeHistoryDiagnostic=@{version=1;phase='parse'};Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 1}
 Assert-TargetPrepQaRefused 'B3 error cannot appear' {$v=New-TargetPrepQaFailure;$v.error='RESTORE_MIGRATION_HISTORY_NATIVE_PARSER_REFUSED';Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 1}
 foreach($suffix in @('INPUT_INVALID','FRAME_INVALID','LIMIT_EXCEEDED','IDENTITY_REFUSED','ACTOR_REFUSED','MODE_REFUSED','RLS_REFUSED','SCOPE_REFUSED','CATALOGUE_REFUSED','TARGET_NOT_EMPTY','HISTORY_REQUIRED','END_REFUSED','START_REQUIRED')){
  $v=New-TargetPrepQaFailure;$v.nativeTargetDiagnostic=[ordered]@{version=1;mode='native';phase='snapshot_start';protocolError=('RESTORE_TARGET_SNAPSHOT_'+$suffix);psql=(New-TargetPrepQaProducer $true);dump=$null};$null=Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 1;$targetPrepQaPassed.Add('closed snapshot refusal: '+$suffix)
 }
 Assert-TargetPrepQaRefused 'unknown snapshot error cannot leak' {$v=New-TargetPrepQaFailure;$v.nativeTargetDiagnostic=[ordered]@{version=1;mode='native';phase='snapshot_start';protocolError='PRIVATE_CANARY';psql=$null;dump=$null};Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 1}
 Assert-TargetPrepQaRefused 'producer close cannot replace EOF' {$v=New-TargetPrepQaFailure;$p=New-TargetPrepQaProducer $true;$p.stdoutEofObserved=$false;$v.nativeTargetDiagnostic=[ordered]@{version=1;mode='native';phase='snapshot_end';protocolError=$null;psql=$p;dump=$null};Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 1}
 Assert-TargetPrepQaRefused 'dump cannot claim psql input' {$v=New-TargetPrepQaFailure;$p=New-TargetPrepQaProducer $true;$v.nativeTargetDiagnostic=[ordered]@{version=1;mode='native';phase='dump';protocolError=$null;psql=$null;dump=$p};Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 1}
 Assert-TargetPrepQaRefused 'producer callback cap' {$v=New-TargetPrepQaFailure;$p=New-TargetPrepQaProducer $true;$p.inputCallbacks=3;$v.nativeTargetDiagnostic=[ordered]@{version=1;mode='native';phase='snapshot_end';protocolError=$null;psql=$p;dump=$null};Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 1}
 Assert-TargetPrepQaRefused 'producer output byte cap' {$v=New-TargetPrepQaFailure;$p=New-TargetPrepQaProducer $true;$p.stdoutBytes=2097153;$v.nativeTargetDiagnostic=[ordered]@{version=1;mode='native';phase='snapshot_start';protocolError=$null;psql=$p;dump=$null};Invoke-TargetPrepQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 1}
 Write-Output ([ordered]@{ok=$true;operation='target_inventory_preparation_qa';passed=$targetPrepQaPassed.Count;nativeExecuted=$false;privateOpened=$false}|ConvertTo-Json -Compress)
 exit 0
} catch {
 Write-Output ([ordered]@{ok=$false;operation='target_inventory_preparation_qa';error='QA_REFUSED';passed=$targetPrepQaPassed.Count;sourceLine=$_.InvocationInfo.ScriptLineNumber;nativeExecuted=$false;privateOpened=$false}|ConvertTo-Json -Compress)
 exit 1
} finally {if($null -ne $targetPrepQaBytes){[Array]::Clear($targetPrepQaBytes,0,$targetPrepQaBytes.Length)}}
