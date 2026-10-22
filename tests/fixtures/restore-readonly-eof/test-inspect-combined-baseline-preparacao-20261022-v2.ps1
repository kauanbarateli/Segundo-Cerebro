# Pure RAM/AST QA. Reads ONLY the new public template, never its operative body.
# No profile/archive, process, dispatcher, SQL, native producer or service access.
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$combinedQaPassed=[Collections.Generic.List[string]]::new()
$combinedQaBytes=$null
try {
 if($PSVersionTable.PSVersion.Major -ne 7){throw 'QA_PS7_REQUIRED'}
 $combinedQaPath=Join-Path $PSScriptRoot 'inspect-combined-baseline-preparacao-20261022-v2.ps1'
 $combinedQaBytes=[IO.File]::ReadAllBytes($combinedQaPath)
 if($combinedQaBytes.Length -ne 59999 -or [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($combinedQaBytes)) -cne 'E4E0468FA4212FE22A2F283AF0A85F7B747CDEC0CA52A0EA4034B1263F27CFCB'){throw 'QA_SOURCE_PIN_REFUSED'}
 $combinedQaText=[Text.UTF8Encoding]::new($false,$true).GetString($combinedQaBytes)
 $combinedQaTokens=$null;$combinedQaErrors=$null
 $combinedQaAst=[Management.Automation.Language.Parser]::ParseInput($combinedQaText,[ref]$combinedQaTokens,[ref]$combinedQaErrors)
 if($combinedQaErrors.Count -ne 0){throw 'QA_SOURCE_PARSE_REFUSED'}
 $combinedQaNames=@('Stop-CombinedPrep','Assert-CombinedPrepObject','Assert-CombinedPrepUniqueJson','Read-CombinedPrepEnum','Read-CombinedPrepBool','Read-CombinedPrepCount','Read-CombinedPrepNullableEnum','Read-CombinedPrepDiagnostic','Read-CombinedPrepSnapshotDiagnostic','Read-CombinedPrepParserDiagnostic','Read-CombinedPrepNativeDiagnostic','Read-CombinedPrepArchiveBinding','Read-CombinedPrepFormat','Read-CombinedPrepToc','Read-CombinedPrepHistory','Read-CombinedPrepSnapshot','Read-CombinedPrepA2','Read-CombinedPrepComparison','Read-CombinedPrepSourceDiagnostic','Read-CombinedPrepTargetDiagnostic','Test-CombinedPrepSameFact','Read-CombinedPrepSourceTocSnapshot','Read-CombinedPrepSourceTocDiagnostic','Read-CombinedPrepCodes','Read-CombinedPrepWire','Read-CombinedPrepProjection')
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
 $combinedQaPassed.Add('exact public pin and 26 exclusive pure AST functions')
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
  'db5540fa35ddcb344a364f675fcc9a404391863b','6784b9e8f5b27abb664ec0b4f17b96bbffe31b1d',
  '[IO.FileShare]::Read','ls-files --error-unmatch -- @combinedPrepSourcePaths',
  '$combinedPrepGit = (@(Get-Command git -CommandType Application -ErrorAction Stop)[0]).Source',
  '$combinedPrepWatch.ElapsedMilliseconds -ge 90000',
  '$combinedPrepProjection = Read-CombinedPrepWire $combinedPrepBytes $combinedPrepProcess.ExitCode'+[char]10+' if ($combinedPrepProjection.ok) { Assert-CombinedPrepDeadline }',
  'if ($combinedPrepExit -eq 0 -and $combinedPrepWatch.ElapsedMilliseconds -ge 90000)',
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
 function Invoke-CombinedQaProjection([string]$Json,[int]$ExitCode){return Read-CombinedPrepWire ([Text.UTF8Encoding]::new($false,$true).GetBytes($Json)) $ExitCode}
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
 function New-CombinedQaFailure{return [ordered]@{ok=$false;operation='managed_restore_combined_baseline_inspect';error='INSPECTION_TIMEOUT';stage='source';sourceDiagnostic=$null;targetDiagnostic=$null;nativeHistoryDiagnostic=$null;sourceTocDiagnostic=$null;comparisonCompleted=$false;inspectionOnly=$true;baselineQualified=$false;baselineCompared=$false;remoteMutation=$false;restoreAccepted=$false}}
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
 # The operative collector uses this same pure byte reader; no fake parser.
 foreach($badBytes in @([byte[]]@(),[byte[]]@(0xc3,0x28),[byte[]]::new(65537))){Assert-CombinedQaRefused 'strict UTF8 and byte bounds' {Read-CombinedPrepWire $badBytes 1}}
 Assert-CombinedQaRefused 'wire null' {Read-CombinedPrepWire $null 1}
 Assert-CombinedQaRefused 'wire ordinary array' {Read-CombinedPrepWire @(123,125) 1}
 Assert-CombinedQaRefused 'wire double JSON' {Read-CombinedPrepWire ([Text.Encoding]::UTF8.GetBytes('{}{}')) 1}
 Assert-CombinedQaRefused 'wire truncated JSON' {Read-CombinedPrepWire ([Text.Encoding]::UTF8.GetBytes('{')) 1}
 # Every vector below is synthetic JSON in RAM, not a captured native run.
 function Copy-CombinedQaWire($Value){return $Value|ConvertTo-Json -Depth 12 -Compress|ConvertFrom-Json -AsHashtable}
 function New-CombinedQaTocState {
  $events=[ordered]@{}
  foreach($name in @('spawnRequested','spawn','spawnThrow','stdinEndRequested','stdinCallback','stdinFinish','stdinError','stdinEndThrow','childError','stdoutError','stderrError','stdoutEOF','stdoutClose','stderrEOF','stderrClose','exit','close','stdinDestroyRequested','stdoutDestroyRequested','stderrDestroyRequested','killRequested','unrefRequested')){$events[$name]=$null}
  $events.spawnRequested=[ordered]@{sequence=1};$events.spawn=[ordered]@{sequence=2};$events.stdinEndRequested=[ordered]@{sequence=3};$events.stdinError=[ordered]@{sequence=4;code='ERR_STREAM_DESTROYED'}
  return [ordered]@{sequence=4;overflow=$false;firstError=[ordered]@{origin='stdinError';code='ERR_STREAM_DESTROYED';sequence=4};lastError=[ordered]@{origin='stdinError';code='ERR_STREAM_DESTROYED';sequence=4};events=$events}
 }
 function New-CombinedQaTocFailure {
  $v=New-CombinedQaFailure;$v.error='INSPECTION_INPUT_FAILED'
  $v.sourceDiagnostic=[ordered]@{stage='native_toc';authComplete=$true;listStarted=$true;tocDiagnostic=$null;tocPlanDiagnostic=$null;inventory=$null;nativeHistoryDiagnostic=$null}
  $first=New-CombinedQaTocState;$final=Copy-CombinedQaWire $first;$final.sequence=8
  $final.events.stdinDestroyRequested=[ordered]@{sequence=5};$final.events.stdoutDestroyRequested=[ordered]@{sequence=6};$final.events.killRequested=[ordered]@{sequence=7};$final.events.close=[ordered]@{sequence=8;code='unavailable';signal='none'}
  $v.sourceTocDiagnostic=[ordered]@{version=1;observer='source_toc_original';firstRefusal=[ordered]@{code='INSPECTION_INPUT_FAILED';state=$first};finalCleanup=$final}
  return $v
 }
 $v=New-CombinedQaTocFailure;$p=Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 1
 if($p.sourceTocDiagnostic.firstRefusal.state.sequence -ne 4 -or $p.sourceTocDiagnostic.finalCleanup.sequence -ne 8 -or $p.sourceTocDiagnostic.firstRefusal.state.events.stdinError.code -cne 'ERR_STREAM_DESTROYED' -or $null -ne $p.sourceTocDiagnostic.finalCleanup.events.stdoutEOF){throw 'QA_TOC_FACTS_LOST'}
 $combinedQaPassed.Add('SourceTOC first refusal and final cleanup preserved; missing EOF stays null')
 $v=New-CombinedQaTocFailure;$v.stage='target';$v.sourceDiagnostic=$null;$v.targetDiagnostic=New-CombinedQaTargetDiagnostic;$v.sourceTocDiagnostic.firstRefusal=$null
 $p=Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 1
 if($null -ne $p.sourceTocDiagnostic.firstRefusal){throw 'QA_TOC_NULL_REFUSAL_LOST'}
 $combinedQaPassed.Add('later Target refusal admits SourceTOC with no first refusal without mint or acceptance')
 foreach($code in @('EPIPE','ERR_STREAM_DESTROYED','EOF','other','unavailable')){
  $v=New-CombinedQaTocFailure
  foreach($state in @($v.sourceTocDiagnostic.firstRefusal.state,$v.sourceTocDiagnostic.finalCleanup)){$state.events.stdinError.code=$code;$state.firstError.code=$code;$state.lastError.code=$code}
  $null=Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 1;$combinedQaPassed.Add('SourceTOC closed error '+$code)
 }
 # A native error-code literal is passive metadata, not the stdout EOF event.
 $v=New-CombinedQaTocFailure
 foreach($state in @($v.sourceTocDiagnostic.firstRefusal.state,$v.sourceTocDiagnostic.finalCleanup)){
  $state.events.stdinError=$null
  $state.events.stdinCallback=[ordered]@{sequence=4;outcome='error';code='EOF'}
  $state.firstError=[ordered]@{origin='stdinCallback';code='EOF';sequence=4}
  $state.lastError=[ordered]@{origin='stdinCallback';code='EOF';sequence=4}
 }
 $p=Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 1
 if($p.error -cne 'INSPECTION_INPUT_FAILED' -or $p.sourceTocDiagnostic.firstRefusal.code -cne 'INSPECTION_INPUT_FAILED' -or $p.baselineQualified -or $p.remoteMutation -or $p.restoreAccepted){throw 'QA_TOC_EOF_AUTHORITY_REFUSED'}
 foreach($state in @($p.sourceTocDiagnostic.firstRefusal.state,$p.sourceTocDiagnostic.finalCleanup)){
  if($state.events.stdinCallback.code -cne 'EOF' -or $state.events.stdinCallback.outcome -cne 'error' -or $state.firstError.code -cne 'EOF' -or $state.lastError.code -cne 'EOF' -or $state.firstError.origin -cne 'stdinCallback' -or $state.lastError.origin -cne 'stdinCallback'){throw 'QA_TOC_EOF_FACTS_LOST'}
  if($null -ne $state.events.stdinError -or $null -ne $state.events.stdoutEOF -or $null -ne $state.events.stderrEOF -or $null -ne $state.events.exit){throw 'QA_TOC_EOF_TERMINAL_INVENTED'}
 }
 if($null -ne $p.sourceTocDiagnostic.firstRefusal.state.events.close -or $p.sourceTocDiagnostic.finalCleanup.events.close.code -cne 'unavailable'){throw 'QA_TOC_EOF_CLOSE_INVENTED'}
 $combinedQaPassed.Add('literal EOF callback/firstError/lastError remains input refusal without invented EOF/exit or authority')
 # A legitimate callback can disagree with the earlier channel error. Preserve
 # both observations, never replace firstError with the cleanup callback.
 $v=New-CombinedQaTocFailure;$final=$v.sourceTocDiagnostic.finalCleanup;$final.sequence=9;$final.events.stdinCallback=[ordered]@{sequence=9;outcome='error';code='EPIPE'};$final.lastError=[ordered]@{origin='stdinCallback';sequence=9;code='EPIPE'}
 $p=Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 1
 if($p.sourceTocDiagnostic.finalCleanup.firstError.code -cne 'ERR_STREAM_DESTROYED' -or $p.sourceTocDiagnostic.finalCleanup.lastError.code -cne 'EPIPE'){throw 'QA_TOC_FIRST_LAST_LOST'}
 $combinedQaPassed.Add('different late callback cannot overwrite first observed error')
 $v=New-CombinedQaTocFailure;$v.sourceTocDiagnostic.firstRefusal.state.sequence=64;$v.sourceTocDiagnostic.firstRefusal.state.overflow=$true;$v.sourceTocDiagnostic.finalCleanup.sequence=64;$v.sourceTocDiagnostic.finalCleanup.overflow=$true
 foreach($name in @('stdinDestroyRequested','stdoutDestroyRequested','killRequested','close')){$v.sourceTocDiagnostic.finalCleanup.events[$name].sequence=64}
 $null=Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 1;$combinedQaPassed.Add('saturated sequence admits only explicit bounded overflow without ordering invented')
 foreach($signal in @('none','SIGKILL','SIGTERM','SIGINT','other')){
  $v=New-CombinedQaTocFailure;$v.sourceTocDiagnostic.finalCleanup.events.close.signal=$signal;$null=Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 1;$combinedQaPassed.Add('SourceTOC signal enum '+$signal)
 }
 foreach($class in @('zero','nonzero','unavailable')){
  $v=New-CombinedQaTocFailure;$v.sourceTocDiagnostic.finalCleanup.events.close.code=$class;$null=Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 1;$combinedQaPassed.Add('SourceTOC exit class '+$class)
 }
 foreach($mutation in @('missing-root','extra-root','observer','version','missing-event','extra-event','extra-code','sequence-zero','sequence-over','sequence-fraction','overflow-without64','repeated-unsaturated','spawn-not-first','callback-none-error','terminal-raw-code','terminal-raw-signal','first-lost','last-lost','error-origin','error-code','error-before-event','first-last-order','error-after-last','first-event-rewritten','first-error-rewritten','last-regressed','new-event-before-refusal','final-before-first','overflow-regressed','first-refusal-provider-code','first-refusal-extra','snapshot-extra','event-extra','error-extra','final-null')){
  Assert-CombinedQaRefused ('SourceTOC negative '+$mutation) {
   $v=New-CombinedQaTocFailure;$d=$v.sourceTocDiagnostic;$first=$d.firstRefusal.state;$final=$d.finalCleanup
   switch($mutation){
    'missing-root'{$v.Remove('sourceTocDiagnostic')}
    'extra-root'{$d.private='PUBLIC_CANARY'}
    observer{$d.observer='PRIVATE_URL_CANARY'}
    version{$d.version=2}
    'missing-event'{$final.events.Remove('stdoutEOF')}
    'extra-event'{$final.events.private='PUBLIC_CANARY'}
    'extra-code'{$final.events.stdinError.code='PUBLIC_CANARY'}
    'sequence-zero'{$first.sequence=0}
    'sequence-over'{$final.sequence=65}
    'sequence-fraction'{$final.sequence=8.5}
    'overflow-without64'{$final.overflow=$true}
    'repeated-unsaturated'{$final.events.close.sequence=7}
    'spawn-not-first'{$first.events.spawnRequested.sequence=2}
    'callback-none-error'{$final.sequence=9;$final.events.stdinCallback=[ordered]@{sequence=9;outcome='error';code='none'}}
    'terminal-raw-code'{$final.events.close.code=0}
    'terminal-raw-signal'{$final.events.close.signal='SIGPRIVATE'}
    'first-lost'{$final.firstError=$null}
    'last-lost'{$final.lastError=$null}
    'error-origin'{$first.firstError.origin='PRIVATE_CANARY'}
    'error-code'{$first.firstError.code='PRIVATE_CANARY'}
    'error-before-event'{$first.firstError.sequence=3}
    'first-last-order'{$final.firstError.sequence=5}
    'error-after-last'{$final.events.stderrError=[ordered]@{sequence=9;code='other'};$final.sequence=9}
    'first-event-rewritten'{$final.events.stdinError.code='EPIPE';$final.firstError.code='EPIPE';$final.lastError.code='EPIPE'}
    'first-error-rewritten'{$final.sequence=9;$final.events.stderrError=[ordered]@{sequence=9;code='other'};$final.firstError=[ordered]@{sequence=9;origin='stderrError';code='other'};$final.lastError=$final.firstError}
    'last-regressed'{$final.lastError=$null}
    'new-event-before-refusal'{$final.events.stdinDestroyRequested.sequence=4}
    'final-before-first'{$final.sequence=3}
    'overflow-regressed'{$first.sequence=64;$first.overflow=$true;$final.sequence=64}
    'first-refusal-provider-code'{$d.firstRefusal.code='PRIVATE_CANARY'}
    'first-refusal-extra'{$d.firstRefusal.message='PUBLIC_CANARY'}
    'snapshot-extra'{$first.url='PUBLIC_CANARY'}
    'event-extra'{$first.events.stdinError.message='PUBLIC_CANARY'}
    'error-extra'{$first.firstError.path='PUBLIC_CANARY'}
    'final-null'{$d.finalCleanup=$null}
   }
   Invoke-CombinedQaProjection ($v|ConvertTo-Json -Depth 12 -Compress) 1
  }
 }
 foreach($mutation in @('duplicate-event','escaped-duplicate','duplicate-error','duplicate-root')){
  Assert-CombinedQaRefused ('SourceTOC JSON '+$mutation) {
   $j=(New-CombinedQaTocFailure)|ConvertTo-Json -Depth 12 -Compress
   switch($mutation){
    'duplicate-event'{$j=$j.Replace('"spawnRequested":{"sequence":1}','"spawnRequested":{"sequence":1},"spawnRequested":{"sequence":1}')}
    'escaped-duplicate'{$j=$j.Replace('"spawnRequested":{"sequence":1}','"spawnRequested":{"sequence":1},"spawn\u0052equested":{"sequence":1}')}
    'duplicate-error'{$j=$j.Replace('"code":"ERR_STREAM_DESTROYED"','"code":"ERR_STREAM_DESTROYED","code":"ERR_STREAM_DESTROYED"')}
    'duplicate-root'{$j=$j.Replace('"sourceTocDiagnostic":','"sourceTocDiagnostic":null,"sourceTocDiagnostic":')}
   }
   Invoke-CombinedQaProjection $j 1
  }
 }

 Write-Output ([ordered]@{ok=$true;operation='combined_baseline_preparation_qa';passed=$combinedQaPassed.Count;nativeExecuted=$false;privateOpened=$false}|ConvertTo-Json -Compress)
 exit 0
}catch{
 Write-Output ([ordered]@{ok=$false;operation='combined_baseline_preparation_qa';error='QA_REFUSED';passed=$combinedQaPassed.Count;sourceLine=$_.InvocationInfo.ScriptLineNumber;nativeExecuted=$false;privateOpened=$false}|ConvertTo-Json -Compress)
 exit 1
}finally{if($null -ne $combinedQaBytes){[Array]::Clear($combinedQaBytes,0,$combinedQaBytes.Length)}}
