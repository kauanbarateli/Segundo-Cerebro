# Pure RAM/AST QA. Reads ONLY the new public template, never its operative body.
# No profile/archive, process, dispatcher, SQL, native producer or service access.
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$combinedQaPassed=[Collections.Generic.List[string]]::new()
$combinedQaBytes=$null
try {
 if($PSVersionTable.PSVersion.Major -ne 7){throw 'QA_PS7_REQUIRED'}
 $combinedQaPath=Join-Path $PSScriptRoot 'inspect-combined-baseline-preparacao-20261017-v1.ps1'
 $combinedQaBytes=[IO.File]::ReadAllBytes($combinedQaPath)
 if($combinedQaBytes.Length -ne 48798 -or [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($combinedQaBytes)) -cne '64E7B9E3FA2BBF684E28B9251CE1D6C951057980CC9B10E0B786FBD5AD1ED357'){throw 'QA_SOURCE_PIN_REFUSED'}
 $combinedQaText=[Text.UTF8Encoding]::new($false,$true).GetString($combinedQaBytes)
 $combinedQaTokens=$null;$combinedQaErrors=$null
 $combinedQaAst=[Management.Automation.Language.Parser]::ParseInput($combinedQaText,[ref]$combinedQaTokens,[ref]$combinedQaErrors)
 if($combinedQaErrors.Count -ne 0){throw 'QA_SOURCE_PARSE_REFUSED'}
 $combinedQaNames=@('Stop-CombinedPrep','Assert-CombinedPrepObject','Assert-CombinedPrepUniqueJson','Read-CombinedPrepEnum','Read-CombinedPrepBool','Read-CombinedPrepCount','Read-CombinedPrepNullableEnum','Read-CombinedPrepDiagnostic','Read-CombinedPrepSnapshotDiagnostic','Read-CombinedPrepParserDiagnostic','Read-CombinedPrepNativeDiagnostic','Read-CombinedPrepArchiveBinding','Read-CombinedPrepFormat','Read-CombinedPrepToc','Read-CombinedPrepHistory','Read-CombinedPrepSnapshot','Read-CombinedPrepA2','Read-CombinedPrepComparison','Read-CombinedPrepSourceDiagnostic','Read-CombinedPrepTargetDiagnostic','Read-CombinedPrepCodes','Read-CombinedPrepProjection')
 $combinedQaFunctions=@($combinedQaAst.FindAll({param($node)$node -is [Management.Automation.Language.FunctionDefinitionAst]},$true))
 $combinedQaDefinitions=[Collections.Generic.List[string]]::new()
 foreach($combinedQaName in $combinedQaNames){
  $combinedQaSelected=@($combinedQaFunctions|Where-Object {$_.Name -ceq $combinedQaName})
  if($combinedQaSelected.Count -ne 1){throw 'QA_FUNCTION_SELECTION_REFUSED'}
  $combinedQaDefinitions.Add($combinedQaSelected[0].Extent.Text)
 }
 $combinedQaPureText=$combinedQaDefinitions -join [string][char]10
 $combinedQaPureTokens=$null;$combinedQaPureErrors=$null
 $combinedQaPureAst=[Management.Automation.Language.Parser]::ParseInput($combinedQaPureText,[ref]$combinedQaPureTokens,[ref]$combinedQaPureErrors)
 if($combinedQaPureErrors.Count -ne 0 -or $combinedQaPureAst.EndBlock.Statements.Count -ne $combinedQaNames.Count){throw 'QA_PURE_AST_REFUSED'}
 foreach($combinedQaStatement in $combinedQaPureAst.EndBlock.Statements){if($combinedQaStatement -isnot [Management.Automation.Language.FunctionDefinitionAst] -or $combinedQaNames -cnotcontains $combinedQaStatement.Name){throw 'QA_PURE_AST_REFUSED'}}
 . ([scriptblock]::Create($combinedQaPureText))
 $combinedQaPassed.Add('exact public pin and 22 exclusive pure AST functions')
 foreach($combinedQaParam in @(@('GateExecute','$false'),@('ReviewedCommit','$null'),@('ArchiveBinding','$null'))){
  $combinedQaParameter=@($combinedQaAst.ParamBlock.Parameters|Where-Object {$_.Name.VariablePath.UserPath -ceq $combinedQaParam[0]})
  if($combinedQaParameter.Count -ne 1 -or $combinedQaParameter[0].DefaultValue.Extent.Text -cne $combinedQaParam[1]){throw 'QA_DEFAULT_GATES_REFUSED'}
 }
 if($combinedQaAst.EndBlock.Statements[2] -isnot [Management.Automation.Language.IfStatementAst] -or $combinedQaAst.EndBlock.Statements[2].Clauses[0].Item1.Extent.Text -cne '-not $GateExecute'){throw 'QA_EARLY_GATE_REFUSED'}
 $combinedQaPassed.Add('false/null/null gates precede all operative I/O')
 $combinedQaPaths=@('run-operator.ps1','restore-managed-inspect.mjs','backup-format.mjs','backup-config.mjs','restore-target.mjs','postgres-process.mjs','backup-sources.mjs','restore-managed-plan.mjs','restore-custom-header.mjs','restore-custom-toc.mjs','restore-migration-history.mjs','restore-migration-history-native.mjs','restore-native-binary-output.mjs','restore-managed-native-adapters.mjs','restore-managed-validation-sql.mjs','restore-target-snapshot-protocol.mjs','restore-target-snapshot-native.mjs','restore-managed-baseline.mjs','restore-inspected-baseline.mjs')
 $combinedQaUnion=@($combinedQaAst.FindAll({param($node)$node -is [Management.Automation.Language.AssignmentStatementAst] -and $node.Left.Extent.Text -ceq '$combinedPrepSources'},$true))
 if($combinedQaUnion.Count -ne 1){throw 'QA_UNION_REFUSED'}
 $combinedQaPins=[regex]::Matches($combinedQaUnion[0].Extent.Text,"@\('scripts/operations/([^']+)',([0-9]+),'([A-F0-9]{64})'\)")
 if($combinedQaPins.Count -ne 19){throw 'QA_UNION_REFUSED'}
 for($combinedQaIndex=0;$combinedQaIndex -lt 19;$combinedQaIndex++){if($combinedQaPins[$combinedQaIndex].Groups[1].Value -cne $combinedQaPaths[$combinedQaIndex] -or [long]$combinedQaPins[$combinedQaIndex].Groups[2].Value -le 0){throw 'QA_UNION_REFUSED'}}
 foreach($combinedQaGuard in @(
  '[IO.FileShare]::Read','ls-files --error-unmatch -- @combinedPrepSourcePaths',
  '$combinedPrepGit = (@(Get-Command git -CommandType Application -ErrorAction Stop)[0]).Source',
  '$combinedPrepWatch.ElapsedMilliseconds -ge 90000',
  '$combinedPrepOutput.Length + $combinedPrepReadCount -gt 65536',
  '-not $combinedPrepOutDone -or -not $combinedPrepErrDone -or -not $combinedPrepProcess.HasExited',
  '$combinedPrepStart.Environment.Clear()',
  '$combinedPrepStart.Environment[''PATHEXT''] = ''.EXE''',
  "'-Operation','restore-inspect-baseline'",
  "'-Archive',$"+'combinedPrepBoundArchive.path',
  'Open-CombinedPrepPin $combinedPrepBoundArchive.path $combinedPrepBoundArchive.cipherBytes $combinedPrepBoundArchive.sha256',
  "'C:\Program Files\PostgreSQL\18\bin\pg_restore.exe' 379392 'E07BDB23F2D2A7E4D2DB7A50386CD43049F4216540FA18E2FAF79B80AB43AC18'",
  "'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe' 632320 '46C8AD2E487FA01BB5401AE3B383C09E20789EFDD3A37C6940975647EB1FF574'",
  "'C:\Program Files\PostgreSQL\17\bin\psql.exe' 635392 'C290C7F0A3335F290F8C18011A1E5AFA03EE3CDD628697A5F3E767E5F1D3D10D'",
  "'System32\WindowsPowerShell\v1.0\powershell.exe') 495616 '60C9B29843624DD8AF6B6A7B26147753BE6AEEF65098B9A503CC50850AFE410F'",
  "Open-CombinedPrepPin $"+"combinedPrepNode 92825416 '3602F2BB1A10F2CBAB4C36886218A33C1AB3DB87290E73B033C46C77147D0237'",
  "Open-CombinedPrepPin $"+"combinedPrepPwsh 301368 '362A356CE7F0940EC74F73A8FC2C990A2CC24A38A11C90BBD8ECA947110AD139'",
  "Open-CombinedPrepPin $"+"combinedPrepProfile 3901 'E2CD837487821DD266D5F87223B5D65C56DD4CE0029CC52FE1DD71644EED740B'",
  "certificates\prod-ca-2021.crt' -1 '700723581420DD1AC98FD7E9AC529F0EF210EADCAF87FC868A3AD7D114C2F3B7'",
  '[Text.UTF8Encoding]::new($false,$true)','SelfSha256'
 )){if(-not $combinedQaText.Contains($combinedQaGuard)){throw 'QA_SOURCE_GUARD_REFUSED'}}
 foreach($combinedQaForbidden in @('Import-Clixml','Export-Clixml','ExecutionPolicy',"'-Operation','restore'","'-Operation','backup'",'Invoke-Expression')){if($combinedQaText.Contains($combinedQaForbidden)){throw 'QA_FORBIDDEN_AUTHORITY_REFUSED'}}
 $combinedQaPassed.Add('19 transitive pins, borrowed target profile, leases, sterile native launcher and original EOF gates')
 function Invoke-CombinedQaProjection([string]$Json,[int]$ExitCode){$qaDoc=$null;try{$qaDoc=[Text.Json.JsonDocument]::Parse($Json);return Read-CombinedPrepProjection $qaDoc.RootElement $ExitCode}catch{if($_.Exception.Message -in @('COMBINED_PREP_PROTOCOL_REFUSED','COMBINED_PREP_NATIVE_REFUSED')){throw};throw 'COMBINED_PREP_PROTOCOL_REFUSED'}finally{if($null -ne $qaDoc){$qaDoc.Dispose()}}}
 function Assert-CombinedQaRefused([string]$QaCaseLabel,[scriptblock]$QaCaseAction){
  $qaDidRefuse=$false
  try{$null=&$QaCaseAction}catch{$qaDidRefuse=$true;if($_.Exception.Message -notin @('COMBINED_PREP_PROTOCOL_REFUSED','COMBINED_PREP_NATIVE_REFUSED','COMBINED_PREP_INPUT_REFUSED')){throw 'QA_UNEXPECTED_REFUSAL'}}
  if(-not $qaDidRefuse){throw 'QA_EXPECTED_REFUSAL_MISSING'}
  $combinedQaPassed.Add($QaCaseLabel)
 }
 function New-CombinedQaBinding{return [ordered]@{path='C:\Users\Kauan Sousa Barateli\SegundoCerebro-Operations\archives\second-brain-2026-10-17T01-27-25-163Z-6b65e5f5.scbackup';sha256='21c0e0eb0b60a123854ec4d10d2bdbf69e1cb922bc2ed2591c89ec422262088a';cipherBytes=951230L;plainBytes=950017L}}
 function New-CombinedQaFormat{return [ordered]@{archiveVersion='1.16-0';intSize=4;offSize=8;format='CUSTOM';compression='GZIP'}}
 function New-CombinedQaHistory{return [ordered]@{authRows=82;storageRows=74;stdoutBytes=9353;inputTerminal='finish';transportMode='native'}}
 function New-CombinedQaSuccess{return [ordered]@{
  ok=$true;operation='managed_restore_combined_baseline_inspect';authenticatedSource=$true;transportMode='native'
  source=[ordered]@{format=(New-CombinedQaFormat);customToc=[ordered]@{entries=1332;preservedEntries=350;encoding='UTF8';tocBytes=40000};migrationHistory=(New-CombinedQaHistory)}
  target=[ordered]@{format=(New-CombinedQaFormat);customToc=[ordered]@{entries=395;encoding='UTF8';tocBytes=25000};snapshot=[ordered]@{version=1;protocolOnly=$true;nativeOrigin=$false;readonlySnapshot=$true;repeatableRead=$true;actorValidated=$true;rlsBypass=$true;schemas=3;catalogueRelations=70;ordinaryTables=35;emptyDataTables=33;authHistoryRows=82;storageHistoryRows=74;allOtherTableDataEmpty=$true;restoreAccepted=$false};migrationHistory=(New-CombinedQaHistory)}
  comparison=[ordered]@{version=1;managed=[ordered]@{version=1;matches=$true;reasons=@()};existingApp=[ordered]@{version=1;matches=$true;reasons=@()};coverage=[ordered]@{sourceEntries=1332;sourcePreservedEntries=350;targetEntries=395;targetBaselineEntries=350;targetStateEntries=5;targetAppEntries=40;sourceAppCounterparts=40;coverageComplete=$true};inspectionOnly=$true;baselineQualified=$false;restoreAccepted=$false}
  comparisonCompleted=$true;targetQueried=$true;inspectionOnly=$true;baselineQualified=$false;baselineCompared=$true;remoteMutation=$false;restoreAccepted=$false
 }}
 function New-CombinedQaFailure{return [ordered]@{ok=$false;operation='managed_restore_combined_baseline_inspect';error='INSPECTION_TIMEOUT';stage='source';sourceDiagnostic=$null;targetDiagnostic=$null;nativeHistoryDiagnostic=$null;comparisonCompleted=$false;inspectionOnly=$true;baselineQualified=$false;baselineCompared=$false;remoteMutation=$false;restoreAccepted=$false}}
 function New-CombinedQaNative{return [ordered]@{version=1;phase='parse';parserError='RESTORE_MIGRATION_HISTORY_FORMAT_UNSUPPORTED';parserDiagnostic=[ordered]@{version=1;phase='preamble';rule='banner_restrict'};stdoutBytes=9353;stderrBytes=0;spawnObserved=$true;stdinFinishObserved=$true;stdinCallbackSettled=$true;stdinError='none';stdinCallbackError='none';stdoutEofObserved=$true;stderrEofObserved=$true;producerExit='zero';producerClose='zero';cleanup='not_started'}}
 function New-CombinedQaSourceDiagnostic{return [ordered]@{stage='native_history';authComplete=$true;listStarted=$true;tocDiagnostic=$null;tocPlanDiagnostic=$null;inventory=$null;nativeHistoryDiagnostic=(New-CombinedQaNative)}}
 function New-CombinedQaTargetDiagnostic{return [ordered]@{stage='target_snapshot';targetConnectionRequested=$true;nativeTargetDiagnostic=$null;nativeHistoryDiagnostic=$null;tocDiagnostic=$null;tocPlanDiagnostic=$null}}
 $combinedQaBinding=Read-CombinedPrepArchiveBinding (New-CombinedQaBinding)
 if($combinedQaBinding.cipherBytes -ne 951230 -or $combinedQaBinding.plainBytes -ne 950017){throw 'QA_BINDING_FAILED'}
 $combinedQaPassed.Add('authorized metadata binding is exact without opening archive')
 Assert-CombinedQaRefused 'null archive binding' {Read-CombinedPrepArchiveBinding $null}
 Assert-CombinedQaRefused 'provider object is not a binding' {Read-CombinedPrepArchiveBinding ([pscustomobject](New-CombinedQaBinding))}
 foreach($combinedQaField in @('path','sha256','cipherBytes','plainBytes')){
  Assert-CombinedQaRefused ('missing archive field '+$combinedQaField) {$v=New-CombinedQaBinding;$v.Remove($combinedQaField);Read-CombinedPrepArchiveBinding $v}
  Assert-CombinedQaRefused ('null archive field '+$combinedQaField) {$v=New-CombinedQaBinding;$v[$combinedQaField]=$null;Read-CombinedPrepArchiveBinding $v}
 }
 foreach($combinedQaField in @('path','sha256')){Assert-CombinedQaRefused ('swapped archive '+$combinedQaField) {$v=New-CombinedQaBinding;$v[$combinedQaField]='PUBLIC_CANARY';Read-CombinedPrepArchiveBinding $v}}
 foreach($combinedQaNumber in @(0,951229,951231,1073741825,'951230',951230.0)) {Assert-CombinedQaRefused ('archive ciphertext type/value '+$combinedQaNumber.GetType().Name+':'+$combinedQaNumber) {$v=New-CombinedQaBinding;$v.cipherBytes=$combinedQaNumber;Read-CombinedPrepArchiveBinding $v}}
 Assert-CombinedQaRefused 'plain byte count exact' {$v=New-CombinedQaBinding;$v.plainBytes=950018;Read-CombinedPrepArchiveBinding $v}
 Assert-CombinedQaRefused 'extra archive field' {$v=New-CombinedQaBinding;$v.private='PUBLIC_CANARY';Read-CombinedPrepArchiveBinding $v}
 $combinedQaProjection=Invoke-CombinedQaProjection ((New-CombinedQaSuccess)|ConvertTo-Json -Depth 12 -Compress) 0
 if(-not $combinedQaProjection.ok -or -not $combinedQaProjection.comparisonCompleted -or -not $combinedQaProjection.inspectionOnly -or $combinedQaProjection.restoreAccepted -or $combinedQaProjection.target.migrationHistory.storageRows -ne 74){throw 'QA_SUCCESS_FAILED'}
 $combinedQaPassed.Add('aggregate original native success remains inspection only')
 foreach($combinedQaTerminal in @('finish','selected_tail_unconsumed')){$v=New-CombinedQaSuccess;$v.source.migrationHistory.inputTerminal=$combinedQaTerminal;$v.target.migrationHistory.inputTerminal=$combinedQaTerminal;$null=Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0;$combinedQaPassed.Add('original native input terminal '+$combinedQaTerminal)}
 $combinedQaReasons=@('identity_set_mismatch','dependency_scope_unsupported','dependency_vector_mismatch','section_mismatch','dumper_mismatch','definition_mismatch','drop_statement_mismatch','copy_statement_mismatch','owner_mismatch','tablespace_mismatch','table_access_method_mismatch','relation_kind_mismatch','with_oids_mismatch','auth_history_mismatch','storage_history_mismatch')
 foreach($combinedQaSide in @('managed','existingApp')){
  foreach($combinedQaReason in $combinedQaReasons){$v=New-CombinedQaSuccess;$v.comparison[$combinedQaSide].matches=$false;$v.comparison[$combinedQaSide].reasons=@($combinedQaReason);$p=Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0;if($p.comparison[$combinedQaSide].matches -or $p.comparison[$combinedQaSide].reasons[0] -cne $combinedQaReason){throw 'QA_REASON_LOST'};$combinedQaPassed.Add($combinedQaSide+' preserves mismatch '+$combinedQaReason)}
  $v=New-CombinedQaSuccess;$v.comparison[$combinedQaSide].matches=$false;$v.comparison[$combinedQaSide].reasons=$combinedQaReasons;$null=Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0;$combinedQaPassed.Add($combinedQaSide+' preserves all canonical reasons')
  Assert-CombinedQaRefused ('unknown reason '+$combinedQaSide) {$v=New-CombinedQaSuccess;$v.comparison[$combinedQaSide].matches=$false;$v.comparison[$combinedQaSide].reasons=@('PUBLIC_CANARY');Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
  Assert-CombinedQaRefused ('reason duplicate '+$combinedQaSide) {$v=New-CombinedQaSuccess;$v.comparison[$combinedQaSide].matches=$false;$v.comparison[$combinedQaSide].reasons=@('owner_mismatch','owner_mismatch');Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
  Assert-CombinedQaRefused ('reason order '+$combinedQaSide) {$v=New-CombinedQaSuccess;$v.comparison[$combinedQaSide].matches=$false;$v.comparison[$combinedQaSide].reasons=@('storage_history_mismatch','auth_history_mismatch');Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
  Assert-CombinedQaRefused ('matches true with reason '+$combinedQaSide) {$v=New-CombinedQaSuccess;$v.comparison[$combinedQaSide].reasons=@('owner_mismatch');Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
  Assert-CombinedQaRefused ('matches false no reason '+$combinedQaSide) {$v=New-CombinedQaSuccess;$v.comparison[$combinedQaSide].matches=$false;Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 }
 foreach($combinedQaFlag in @('authenticatedSource','comparisonCompleted','targetQueried','inspectionOnly','baselineCompared')){Assert-CombinedQaRefused ('required success flag '+$combinedQaFlag) {$v=New-CombinedQaSuccess;$v[$combinedQaFlag]=$false;Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}}
 foreach($combinedQaFlag in @('baselineQualified','remoteMutation','restoreAccepted')){
  Assert-CombinedQaRefused ('success authority '+$combinedQaFlag) {$v=New-CombinedQaSuccess;$v[$combinedQaFlag]=$true;Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
  Assert-CombinedQaRefused ('failure authority '+$combinedQaFlag) {$v=New-CombinedQaFailure;$v[$combinedQaFlag]=$true;Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 1}
 }
 foreach($combinedQaFlag in @('baselineQualified','restoreAccepted')){Assert-CombinedQaRefused ('comparison authority '+$combinedQaFlag) {$v=New-CombinedQaSuccess;$v.comparison[$combinedQaFlag]=$true;Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}}
 Assert-CombinedQaRefused 'comparison inspection flag' {$v=New-CombinedQaSuccess;$v.comparison.inspectionOnly=$false;Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 foreach($combinedQaFlag in @('comparisonCompleted','baselineCompared')){Assert-CombinedQaRefused ('failure cannot expose partial comparison '+$combinedQaFlag) {$v=New-CombinedQaFailure;$v[$combinedQaFlag]=$true;Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 1}}
 foreach($combinedQaSide in @('source','target')){
  foreach($combinedQaNested in @('format','customToc','migrationHistory')){Assert-CombinedQaRefused ('nested private field '+$combinedQaSide+'/'+$combinedQaNested) {$v=New-CombinedQaSuccess;$v[$combinedQaSide][$combinedQaNested].sql='PUBLIC_CANARY';Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}}
  Assert-CombinedQaRefused ('history synthetic '+$combinedQaSide) {$v=New-CombinedQaSuccess;$v[$combinedQaSide].migrationHistory.transportMode='synthetic';Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
  Assert-CombinedQaRefused ('history input terminal '+$combinedQaSide) {$v=New-CombinedQaSuccess;$v[$combinedQaSide].migrationHistory.inputTerminal='destroy_ack';Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
  Assert-CombinedQaRefused ('history cumulative rows '+$combinedQaSide) {$v=New-CombinedQaSuccess;$v[$combinedQaSide].migrationHistory.authRows=10000;Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
  Assert-CombinedQaRefused ('history stdout quota '+$combinedQaSide) {$v=New-CombinedQaSuccess;$v[$combinedQaSide].migrationHistory.stdoutBytes=20971521;Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 }
 foreach($combinedQaFlag in @('protocolOnly','readonlySnapshot','repeatableRead','actorValidated','rlsBypass','allOtherTableDataEmpty')){Assert-CombinedQaRefused ('required snapshot '+$combinedQaFlag) {$v=New-CombinedQaSuccess;$v.target.snapshot[$combinedQaFlag]=$false;Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}}
 foreach($combinedQaFlag in @('nativeOrigin','restoreAccepted')){Assert-CombinedQaRefused ('snapshot authority '+$combinedQaFlag) {$v=New-CombinedQaSuccess;$v.target.snapshot[$combinedQaFlag]=$true;Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}}
 foreach($combinedQaField in @('authHistoryRows','storageHistoryRows')){Assert-CombinedQaRefused ('snapshot/history mismatch '+$combinedQaField) {$v=New-CombinedQaSuccess;$v.target.snapshot[$combinedQaField]++;Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}}
 foreach($combinedQaField in @('sourceEntries','sourcePreservedEntries','targetEntries','targetBaselineEntries','targetStateEntries','targetAppEntries','sourceAppCounterparts')){Assert-CombinedQaRefused ('coverage quota '+$combinedQaField) {$v=New-CombinedQaSuccess;$v.comparison.coverage[$combinedQaField]=10001;Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}}
 foreach($combinedQaField in @('sourceEntries','sourcePreservedEntries','targetEntries','targetBaselineEntries','targetStateEntries','targetAppEntries')){Assert-CombinedQaRefused ('coverage correlation '+$combinedQaField) {$v=New-CombinedQaSuccess;$v.comparison.coverage[$combinedQaField]++;Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}}
 Assert-CombinedQaRefused 'coverage complete required' {$v=New-CombinedQaSuccess;$v.comparison.coverage.coverageComplete=$false;Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 Assert-CombinedQaRefused 'source counterparts cannot exceed app candidates' {$v=New-CombinedQaSuccess;$v.comparison.coverage.sourceAppCounterparts=41;Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 Assert-CombinedQaRefused 'source preserved count cannot exceed inventory' {$v=New-CombinedQaSuccess;$v.source.customToc.preservedEntries=1333;Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 Assert-CombinedQaRefused 'target inspection has no preserved selection' {$v=New-CombinedQaSuccess;$v.target.customToc.preservedEntries=350;Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 Assert-CombinedQaRefused 'root synthetic mode' {$v=New-CombinedQaSuccess;$v.transportMode='synthetic';Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 Assert-CombinedQaRefused 'success cannot use exit1' {Invoke-CombinedQaProjection ((New-CombinedQaSuccess)|ConvertTo-Json -Depth 12 -Compress) 1}
 Assert-CombinedQaRefused 'failure cannot use exit0' {Invoke-CombinedQaProjection ((New-CombinedQaFailure)|ConvertTo-Json -Depth 12 -Compress) 0}
 Assert-CombinedQaRefused 'root extra field' {$v=New-CombinedQaSuccess;$v.payload='PUBLIC_CANARY';Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}
 Assert-CombinedQaRefused 'duplicate nested key' {$j=((New-CombinedQaSuccess)|ConvertTo-Json -Depth 12 -Compress).Replace('"coverageComplete":true','"coverageComplete":true,"coverageComplete":true');Invoke-CombinedQaProjection $j 0}
 Assert-CombinedQaRefused 'duplicate root key' {$j=((New-CombinedQaSuccess)|ConvertTo-Json -Depth 12 -Compress).Replace('"ok":true','"ok":true,"ok":true');Invoke-CombinedQaProjection $j 0}
 foreach($combinedQaRootKey in @((New-CombinedQaSuccess).Keys)){Assert-CombinedQaRefused ('missing success field '+$combinedQaRootKey) {$v=New-CombinedQaSuccess;$v.Remove($combinedQaRootKey);Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 0}}
 $p=Invoke-CombinedQaProjection ((New-CombinedQaFailure)|ConvertTo-Json -Depth 12 -Compress) 1
 if($p.error -cne 'INSPECTION_TIMEOUT'){throw 'QA_REFUSAL_LOST'};$combinedQaPassed.Add('closed refusal without comparison')
 $p=Invoke-CombinedQaProjection '{"ok":false,"operation":"operator","error":"OPERATOR_SETUP_FAILED"}' 1
 if($p.error -cne 'OPERATOR_SETUP_FAILED'){throw 'QA_OPERATOR_LOST'};$combinedQaPassed.Add('operator setup refusal remains short')
 $combinedQaCodes=@(Read-CombinedPrepCodes)
 if($combinedQaCodes.Count -ne 94 -or @($combinedQaCodes|Select-Object -Unique).Count -ne 94){throw 'QA_CLOSED_CODES_REFUSED'}
 foreach($combinedQaCode in $combinedQaCodes){$v=New-CombinedQaFailure;$v.error=$combinedQaCode;$null=Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 1;$combinedQaPassed.Add('closed original error '+$combinedQaCode)}
 foreach($combinedQaCode in @('PUBLIC_CANARY','RESTORE_TARGET_SNAPSHOT_','RESTORE_TARGET_SNAPSHOT_NATIVE_','Error: producer message')){Assert-CombinedQaRefused ('provider/prefix error '+$combinedQaCode) {$v=New-CombinedQaFailure;$v.error=$combinedQaCode;Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 1}}
 Assert-CombinedQaRefused 'unknown outer stage' {$v=New-CombinedQaFailure;$v.stage='PUBLIC_CANARY';Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 1}
 $v=New-CombinedQaFailure;$v.sourceDiagnostic=New-CombinedQaSourceDiagnostic;$v.sourceDiagnostic.inventory=[ordered]@{private='PUBLIC_CANARY'};$v.targetDiagnostic=New-CombinedQaTargetDiagnostic;$v.nativeHistoryDiagnostic=New-CombinedQaNative
 $p=Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 1
 if($p.sourceDiagnostic.inventoryIncluded -or ($p|ConvertTo-Json -Depth 12 -Compress).Contains('PUBLIC_CANARY')){throw 'QA_SOURCE_INVENTORY_LEAK'};$combinedQaPassed.Add('source inventory deliberately omitted; nested closed diagnostics retained')
 $combinedQaPairs=[ordered]@{input=@('toc_required','stdout_type','stdout_size','stdout_nonempty','owned_copy','scratch_allocation');profile=@('encoding','standard_strings_entry','standard_strings_definition','search_path_entry','search_path_definition','preserved_data_count','preserved_data_identity','data_dumper','data_section','data_tablespace','data_access_method','data_relation_kind','data_definition','copy_statement','copy_lexical','copy_schema','copy_table','copy_columns');preamble=@('banner_restrict','database_version','producer_version','settings_head','search_path','settings_tail');block_comment=@('owner_text','exact_comment');copy_header=@('exact_original');row=@('line_scan','row_count','field_split','field_escape','field_decode','field_count','storage_id_decimal','storage_id_safe','history_shape');separator=@('exact_separator');footer=@('exact_footer','trailing_bytes');binding=@('toc_identity','stdout_digest','owned_digest','handle_required','handle_discarded','retained_bytes','retained_digest')}
 foreach($combinedQaPhase in $combinedQaPairs.Keys){foreach($combinedQaRule in $combinedQaPairs[$combinedQaPhase]){$v=New-CombinedQaFailure;$v.nativeHistoryDiagnostic=New-CombinedQaNative;$v.nativeHistoryDiagnostic.parserDiagnostic.phase=$combinedQaPhase;$v.nativeHistoryDiagnostic.parserDiagnostic.rule=$combinedQaRule;$null=Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 1;$combinedQaPassed.Add('closed B3 pair '+$combinedQaPhase+'/'+$combinedQaRule)}}
 foreach($combinedQaMutation in @('orphan','missing','phase','rule','pair','extra','duplicate')){
  Assert-CombinedQaRefused ('B3 diagnostic refusal '+$combinedQaMutation) {
   $v=New-CombinedQaFailure;$v.nativeHistoryDiagnostic=New-CombinedQaNative
   switch($combinedQaMutation){
    orphan{$v.nativeHistoryDiagnostic.parserError=$null}
    missing{$v.nativeHistoryDiagnostic.parserDiagnostic=$null}
    phase{$v.nativeHistoryDiagnostic.parserDiagnostic.phase='PUBLIC_CANARY'}
    rule{$v.nativeHistoryDiagnostic.parserDiagnostic.rule='PUBLIC_CANARY'}
    pair{$v.nativeHistoryDiagnostic.parserDiagnostic.phase='footer'}
    extra{$v.nativeHistoryDiagnostic.parserDiagnostic.sql='PUBLIC_CANARY'}
   }
   $j=$v|ConvertTo-Json -Depth 12 -Compress
   if($combinedQaMutation -ceq 'duplicate'){$j=$j.Replace('"rule":"banner_restrict"','"rule":"banner_restrict","rule":"banner_restrict"')}
   Invoke-CombinedQaProjection $j 1
  }
 }
 foreach($combinedQaNested in @('sourceDiagnostic','targetDiagnostic','nativeHistoryDiagnostic')){Assert-CombinedQaRefused ('private diagnostic field '+$combinedQaNested) {$v=New-CombinedQaFailure;$v[$combinedQaNested]=switch($combinedQaNested){sourceDiagnostic{New-CombinedQaSourceDiagnostic}targetDiagnostic{New-CombinedQaTargetDiagnostic}nativeHistoryDiagnostic{New-CombinedQaNative}};$v[$combinedQaNested].providerText='PUBLIC_CANARY';Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 1}}
 Write-Output ([ordered]@{ok=$true;operation='combined_baseline_preparation_qa';passed=$combinedQaPassed.Count;nativeExecuted=$false;privateOpened=$false}|ConvertTo-Json -Compress)
 exit 0
}catch{
 Write-Output ([ordered]@{ok=$false;operation='combined_baseline_preparation_qa';error='QA_REFUSED';passed=$combinedQaPassed.Count;sourceLine=$_.InvocationInfo.ScriptLineNumber;nativeExecuted=$false;privateOpened=$false}|ConvertTo-Json -Compress)
 exit 1
}finally{if($null -ne $combinedQaBytes){[Array]::Clear($combinedQaBytes,0,$combinedQaBytes.Length)}}
