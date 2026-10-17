# Source-only preparation for ONE NEW target-only readonly inventory inspection.
# Default gate is inert, with no private file, executable, SQL or network access.
# Root reviews/commits the exact union before copying this prep from Review to Main.
# No source archive, new backup, restore, application data or capability mint.
# The child inspector owns ONE inherited 45-second scope; wrapper cap is 60s.
# Kill/ACK never certifies original producer EOF, commit or cleanup.
[CmdletBinding()]
param(
 [bool]$GateExecute = $false,
 [object]$ReviewedCommit = $null,
 [string]$SelfSha256 = ''
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (-not $GateExecute) {
 Write-Output '{"ok":true,"operation":"restore_inspect_target_inventory_preparation","gateExecute":false,"remoteExecuted":false}'
 exit 0
}

$targetPrepCodes = @('TARGET_PREP_INPUT_REFUSED','TARGET_PREP_PLATFORM_REFUSED','TARGET_PREP_PATH_REFUSED','TARGET_PREP_PIN_REFUSED','TARGET_PREP_GIT_REFUSED','TARGET_PREP_SOURCE_DIRTY','TARGET_PREP_TIMEOUT','TARGET_PREP_PROCESS_UNAVAILABLE','TARGET_PREP_OUTPUT_LIMIT','TARGET_PREP_PROTOCOL_REFUSED','TARGET_PREP_NATIVE_REFUSED','TARGET_PREP_UNAVAILABLE')
$targetPrepLeases = [Collections.Generic.List[IO.FileStream]]::new()
$targetPrepWatch = [Diagnostics.Stopwatch]::StartNew()
$targetPrepProcess = $null
$targetPrepDocument = $null
$targetPrepBytes = $null
$targetPrepOutput = [IO.MemoryStream]::new()
$targetPrepOutBuffer = [byte[]]::new(4096)
$targetPrepErrBuffer = [byte[]]::new(4096)
$targetPrepResult = $null
$targetPrepExit = 1

function Stop-TargetPrep([string]$Code) { throw $Code }
function Assert-TargetPrepDeadline {
 if ($targetPrepWatch.ElapsedMilliseconds -ge 60000) { Stop-TargetPrep 'TARGET_PREP_TIMEOUT' }
}
function Assert-TargetPrepRegularPath([string]$Path) {
 if (-not [IO.Path]::IsPathFullyQualified($Path) -or $Path.StartsWith('\\') -or $Path.Contains('~')) { Stop-TargetPrep 'TARGET_PREP_PATH_REFUSED' }
 $targetPrepItem = Get-Item -LiteralPath $Path -Force
 if ($targetPrepItem.PSIsContainer -or -not $targetPrepItem.FullName.Equals([IO.Path]::GetFullPath($Path),[StringComparison]::OrdinalIgnoreCase)) { Stop-TargetPrep 'TARGET_PREP_PATH_REFUSED' }
 $targetPrepAncestor = $targetPrepItem
 while ($null -ne $targetPrepAncestor) {
  if (($targetPrepAncestor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { Stop-TargetPrep 'TARGET_PREP_PATH_REFUSED' }
  if ($targetPrepAncestor -is [IO.FileInfo]) { $targetPrepAncestor = $targetPrepAncestor.Directory } else { $targetPrepAncestor = $targetPrepAncestor.Parent }
 }
}
function Open-TargetPrepPin([string]$Path,[long]$Bytes,[string]$Sha256) {
 Assert-TargetPrepDeadline
 Assert-TargetPrepRegularPath $Path
 # Read sharing denies replacement, deletion and writes while this lease lives.
 $targetPrepStream = [IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 $targetPrepLeases.Add($targetPrepStream)
 if ($Bytes -ge 0 -and $targetPrepStream.Length -ne $Bytes) { Stop-TargetPrep 'TARGET_PREP_PIN_REFUSED' }
 $targetPrepHasher = [Security.Cryptography.SHA256]::Create()
 try { $targetPrepHashBytes = $targetPrepHasher.ComputeHash($targetPrepStream); $targetPrepHash = [Convert]::ToHexString($targetPrepHashBytes) } finally { $targetPrepHasher.Dispose() }
 $targetPrepStream.Position = 0
 if (-not $targetPrepHash.Equals($Sha256,[StringComparison]::OrdinalIgnoreCase)) { Stop-TargetPrep 'TARGET_PREP_PIN_REFUSED' }
 Assert-TargetPrepDeadline
}
function Assert-TargetPrepGit {
 Assert-TargetPrepDeadline
 $targetPrepHead = @(& $targetPrepGit -C $targetPrepRepo rev-parse --verify HEAD 2>$null)
 if ($LASTEXITCODE -ne 0 -or $targetPrepHead.Count -ne 1 -or $targetPrepHead[0] -cne $ReviewedCommit) { Stop-TargetPrep 'TARGET_PREP_GIT_REFUSED' }
 # Only the seventeen reviewed transitive paths are guarded. User WIPs stay outside.
 $targetPrepStatus = @(& $targetPrepGit -C $targetPrepRepo status --porcelain=v1 --untracked-files=all -- @targetPrepSourcePaths 2>$null)
 if ($LASTEXITCODE -ne 0) { Stop-TargetPrep 'TARGET_PREP_GIT_REFUSED' }
 if ($targetPrepStatus.Count -ne 0) { Stop-TargetPrep 'TARGET_PREP_SOURCE_DIRTY' }
 & $targetPrepGit -C $targetPrepRepo ls-files --error-unmatch -- @targetPrepSourcePaths 1>$null 2>$null
 if ($LASTEXITCODE -ne 0) { Stop-TargetPrep 'TARGET_PREP_GIT_REFUSED' }
 Assert-TargetPrepDeadline
}
function Assert-TargetPrepObject($Value,[string[]]$Keys) {
 if ($Value.ValueKind -ne [Text.Json.JsonValueKind]::Object) { Stop-TargetPrep 'TARGET_PREP_PROTOCOL_REFUSED' }
 $targetPrepSeen = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
 foreach ($targetPrepProperty in $Value.EnumerateObject()) {
  if (-not $targetPrepSeen.Add($targetPrepProperty.Name) -or $Keys -cnotcontains $targetPrepProperty.Name) { Stop-TargetPrep 'TARGET_PREP_PROTOCOL_REFUSED' }
 }
 if ($targetPrepSeen.Count -ne $Keys.Count) { Stop-TargetPrep 'TARGET_PREP_PROTOCOL_REFUSED' }
}
function Assert-TargetPrepUniqueJson($Value,[int]$Depth = 0) {
 if ($Depth -gt 12) { Stop-TargetPrep 'TARGET_PREP_PROTOCOL_REFUSED' }
 if ($Value.ValueKind -eq [Text.Json.JsonValueKind]::Object) {
  $targetPrepSeen = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  foreach ($targetPrepProperty in $Value.EnumerateObject()) {
   if (-not $targetPrepSeen.Add($targetPrepProperty.Name)) { Stop-TargetPrep 'TARGET_PREP_PROTOCOL_REFUSED' }
   Assert-TargetPrepUniqueJson $targetPrepProperty.Value ($Depth + 1)
  }
 } elseif ($Value.ValueKind -eq [Text.Json.JsonValueKind]::Array) {
  foreach ($targetPrepItem in $Value.EnumerateArray()) { Assert-TargetPrepUniqueJson $targetPrepItem ($Depth + 1) }
 }
}
function Read-TargetPrepEnum($Value,[string[]]$Allowed) {
 if ($Value.ValueKind -ne [Text.Json.JsonValueKind]::String) { Stop-TargetPrep 'TARGET_PREP_PROTOCOL_REFUSED' }
 $targetPrepText = $Value.GetString()
 if ($Allowed -cnotcontains $targetPrepText) { Stop-TargetPrep 'TARGET_PREP_PROTOCOL_REFUSED' }
 return $targetPrepText
}
function Read-TargetPrepBool($Value) {
 if ($Value.ValueKind -notin @([Text.Json.JsonValueKind]::True,[Text.Json.JsonValueKind]::False)) { Stop-TargetPrep 'TARGET_PREP_PROTOCOL_REFUSED' }
 return $Value.GetBoolean()
}
function Read-TargetPrepCount($Value,[long]$Minimum,[long]$Maximum) {
 $targetPrepNumber = 0L
 if ($Value.ValueKind -ne [Text.Json.JsonValueKind]::Number -or -not $Value.TryGetInt64([ref]$targetPrepNumber) -or $targetPrepNumber -lt $Minimum -or $targetPrepNumber -gt $Maximum) { Stop-TargetPrep 'TARGET_PREP_PROTOCOL_REFUSED' }
 return $targetPrepNumber
}
function Read-TargetPrepNullableEnum($Value,[string[]]$Allowed) {
 if ($Value.ValueKind -eq [Text.Json.JsonValueKind]::Null) { return $null }
 return Read-TargetPrepEnum $Value $Allowed
}
function Read-TargetPrepDiagnostic($Value,[bool]$Plan) {
 if ($Value.ValueKind -eq [Text.Json.JsonValueKind]::Null) { return $null }
 $targetPrepScopes = @('app','managed','global','other','unparsed')
 $targetPrepKinds = @('SEQUENCE OWNED BY','MATERIALIZED VIEW DATA','MATERIALIZED VIEW','DOMAIN CONSTRAINT','FK CONSTRAINT','DEFAULT ACL','TABLE ATTACH','INDEX ATTACH','TABLE DATA','SEQUENCE SET','ROW SECURITY','SHELL TYPE','SECURITY LABEL','DATABASE PROPERTIES','DATABASE','SCHEMA','TABLE','SEQUENCE','DEFAULT','TYPE','DOMAIN','FUNCTION','PROCEDURE','AGGREGATE','CONSTRAINT','INDEX','TRIGGER','POLICY','RULE','ACL','COMMENT','VIEW','COLLATION','ENCODING','STDSTRINGS','SEARCHPATH')
 if ($Plan) {
  Assert-TargetPrepObject $Value @('version','reason','knownKind','scopeCategory')
  $targetPrepReasons = @('input_shape','integer_shape','integer_range','dependency_without_entry','dependency_comment_repeated','dependency_comment_shape','count_header_repeated','format_header_repeated','producer_header_repeated','entry_before_selected','entry_shape','entry_id_repeated','format_header_invalid','producer_header_invalid','count_header_invalid','entry_count_mismatch','verbose_dependencies_missing','dependency_self','dependency_missing','database_metadata_repeated','database_metadata_orphan','database_owner_mismatch','database_dependency_shape','customization_repeated','customization_missing','auth_user_data_missing','core_depends_on_delayed_customization','customization_dependency_not_completed')
  return [ordered]@{version=(Read-TargetPrepCount ($Value.GetProperty('version')) 1 1);reason=(Read-TargetPrepEnum ($Value.GetProperty('reason')) $targetPrepReasons);knownKind=(Read-TargetPrepNullableEnum ($Value.GetProperty('knownKind')) $targetPrepKinds);scopeCategory=(Read-TargetPrepEnum ($Value.GetProperty('scopeCategory')) $targetPrepScopes)}
 }
 Assert-TargetPrepObject $Value @('reason','knownKind','scopeCategory','tailShape')
 return [ordered]@{reason=(Read-TargetPrepEnum ($Value.GetProperty('reason')) @('unknown_descriptor','tail_grammar','scope_classification'));knownKind=(Read-TargetPrepNullableEnum ($Value.GetProperty('knownKind')) $targetPrepKinds);scopeCategory=(Read-TargetPrepEnum ($Value.GetProperty('scopeCategory')) $targetPrepScopes);tailShape=(Read-TargetPrepEnum ($Value.GetProperty('tailShape')) @('not_parsed','missing_fields','empty_tag','forbidden_tag_character','valid'))}
}
function Read-TargetPrepSnapshotDiagnostic($Value) {
 if ($Value.ValueKind -eq [Text.Json.JsonValueKind]::Null) { return $null }
 Assert-TargetPrepObject $Value @('version','mode','phase','protocolError','psql','dump')
 $targetPrepProtocolCodes = @('INPUT_INVALID','FRAME_INVALID','LIMIT_EXCEEDED','IDENTITY_REFUSED','ACTOR_REFUSED','MODE_REFUSED','RLS_REFUSED','SCOPE_REFUSED','CATALOGUE_REFUSED','TARGET_NOT_EMPTY','HISTORY_REQUIRED','END_REFUSED','START_REQUIRED') | ForEach-Object { 'RESTORE_TARGET_SNAPSHOT_' + $_ }
 $targetPrepSnapshotProjection = [ordered]@{
  version=(Read-TargetPrepCount ($Value.GetProperty('version')) 1 1)
  mode=(Read-TargetPrepEnum ($Value.GetProperty('mode')) @('native'))
  phase=(Read-TargetPrepEnum ($Value.GetProperty('phase')) @('input','snapshot_start','dump','snapshot_end','qualified'))
  protocolError=(Read-TargetPrepNullableEnum ($Value.GetProperty('protocolError')) $targetPrepProtocolCodes)
 }
 foreach ($targetPrepProducer in @('psql','dump')) {
  $targetPrepFacts = $Value.GetProperty($targetPrepProducer)
  if ($targetPrepFacts.ValueKind -eq [Text.Json.JsonValueKind]::Null) { $targetPrepSnapshotProjection[$targetPrepProducer] = $null; continue }
  Assert-TargetPrepObject $targetPrepFacts @('spawnObserved','stdinFinishObserved','inputCallbacks','stdoutBytes','stderrBytes','stdoutEofObserved','stderrEofObserved','producerExitZero','producerCloseZero')
  $targetPrepProducerProjection = [ordered]@{}
  foreach ($targetPrepFlag in @('spawnObserved','stdinFinishObserved','stdoutEofObserved','stderrEofObserved','producerExitZero','producerCloseZero')) { $targetPrepProducerProjection[$targetPrepFlag] = Read-TargetPrepBool ($targetPrepFacts.GetProperty($targetPrepFlag)) }
  $targetPrepProducerProjection.inputCallbacks = Read-TargetPrepCount ($targetPrepFacts.GetProperty('inputCallbacks')) 0 2
  $targetPrepProducerProjection.stdoutBytes = Read-TargetPrepCount ($targetPrepFacts.GetProperty('stdoutBytes')) 0 $(if ($targetPrepProducer -ceq 'psql') { 2097152 } else { 67108864 })
  $targetPrepProducerProjection.stderrBytes = Read-TargetPrepCount ($targetPrepFacts.GetProperty('stderrBytes')) 0 65536
  if (($targetPrepProducerProjection.producerCloseZero -and (-not $targetPrepProducerProjection.producerExitZero -or -not $targetPrepProducerProjection.stdoutEofObserved -or -not $targetPrepProducerProjection.stderrEofObserved)) -or ($targetPrepProducerProjection.producerExitZero -and (-not $targetPrepProducerProjection.spawnObserved))) { Stop-TargetPrep 'TARGET_PREP_PROTOCOL_REFUSED' }
  if ($targetPrepProducer -ceq 'dump' -and ($targetPrepProducerProjection.inputCallbacks -ne 0 -or $targetPrepProducerProjection.stdinFinishObserved)) { Stop-TargetPrep 'TARGET_PREP_PROTOCOL_REFUSED' }
  $targetPrepSnapshotProjection[$targetPrepProducer] = $targetPrepProducerProjection
 }
 return $targetPrepSnapshotProjection
}
function Read-TargetPrepInventory($Value,[long]$Entries) {
 Assert-TargetPrepObject $Value @('version','headersValid','dumpEntries','countObserved','unknownClassCount','malformedRowCount','classes')
 $targetPrepInventory = [ordered]@{version=(Read-TargetPrepCount ($Value.GetProperty('version')) 1 1);headersValid=(Read-TargetPrepBool ($Value.GetProperty('headersValid')));dumpEntries=(Read-TargetPrepCount ($Value.GetProperty('dumpEntries')) 1 10000);countObserved=(Read-TargetPrepCount ($Value.GetProperty('countObserved')) 1 10000);unknownClassCount=(Read-TargetPrepCount ($Value.GetProperty('unknownClassCount')) 0 0);malformedRowCount=(Read-TargetPrepCount ($Value.GetProperty('malformedRowCount')) 0 0)}
 if (-not $targetPrepInventory.headersValid -or $targetPrepInventory.dumpEntries -ne $Entries -or $targetPrepInventory.countObserved -ne $Entries) { Stop-TargetPrep 'TARGET_PREP_PROTOCOL_REFUSED' }
 # This operation's nominal planner/B2 support these exact public classes.
 # Class names and scope/tail labels are literals, never arbitrary TOC text.
 $targetPrepKinds = @('ACL','COMMENT','CONSTRAINT','DATABASE','DATABASE PROPERTIES','DEFAULT','DEFAULT ACL','ENCODING','FK CONSTRAINT','FUNCTION','INDEX','POLICY','ROW SECURITY','SCHEMA','SEARCHPATH','SEQUENCE','SEQUENCE OWNED BY','SEQUENCE SET','STDSTRINGS','TABLE','TABLE DATA','TRIGGER','TYPE','VIEW')
 $targetPrepClasses = $Value.GetProperty('classes')
 if ($targetPrepClasses.ValueKind -ne [Text.Json.JsonValueKind]::Array -or $targetPrepClasses.GetArrayLength() -lt 1 -or $targetPrepClasses.GetArrayLength() -gt $targetPrepKinds.Count) { Stop-TargetPrep 'TARGET_PREP_PROTOCOL_REFUSED' }
 $targetPrepClassProjection = [Collections.Generic.List[object]]::new()
 $targetPrepPreviousKind = -1; $targetPrepClassSum = 0
 foreach ($targetPrepClass in $targetPrepClasses.EnumerateArray()) {
  Assert-TargetPrepObject $targetPrepClass @('kind','count','scopes','tails')
  $targetPrepKind = Read-TargetPrepEnum ($targetPrepClass.GetProperty('kind')) $targetPrepKinds
  $targetPrepKindIndex = [Array]::IndexOf($targetPrepKinds,$targetPrepKind)
  if ($targetPrepKindIndex -le $targetPrepPreviousKind) { Stop-TargetPrep 'TARGET_PREP_PROTOCOL_REFUSED' }
  $targetPrepPreviousKind = $targetPrepKindIndex
  $targetPrepCount = Read-TargetPrepCount ($targetPrepClass.GetProperty('count')) 1 10000
  $targetPrepScopes = $targetPrepClass.GetProperty('scopes')
  $targetPrepScopeKinds = @('app','managed','global','other')
  if ($targetPrepScopes.ValueKind -ne [Text.Json.JsonValueKind]::Array -or $targetPrepScopes.GetArrayLength() -lt 1 -or $targetPrepScopes.GetArrayLength() -gt 4) { Stop-TargetPrep 'TARGET_PREP_PROTOCOL_REFUSED' }
  $targetPrepScopesProjection = [Collections.Generic.List[object]]::new()
  $targetPrepPreviousScope = -1; $targetPrepScopeSum = 0
  foreach ($targetPrepScope in $targetPrepScopes.EnumerateArray()) {
   Assert-TargetPrepObject $targetPrepScope @('category','count')
   $targetPrepCategory = Read-TargetPrepEnum ($targetPrepScope.GetProperty('category')) $targetPrepScopeKinds
   $targetPrepScopeIndex = [Array]::IndexOf($targetPrepScopeKinds,$targetPrepCategory)
   if ($targetPrepScopeIndex -le $targetPrepPreviousScope) { Stop-TargetPrep 'TARGET_PREP_PROTOCOL_REFUSED' }
   $targetPrepPreviousScope = $targetPrepScopeIndex
   $targetPrepScopeCount = Read-TargetPrepCount ($targetPrepScope.GetProperty('count')) 1 10000
   $targetPrepScopeSum += $targetPrepScopeCount
   $targetPrepScopesProjection.Add([ordered]@{category=$targetPrepCategory;count=$targetPrepScopeCount})
  }
  if ($targetPrepScopeSum -ne $targetPrepCount) { Stop-TargetPrep 'TARGET_PREP_PROTOCOL_REFUSED' }
  $targetPrepTails = $targetPrepClass.GetProperty('tails')
  if ($targetPrepTails.ValueKind -ne [Text.Json.JsonValueKind]::Array -or $targetPrepTails.GetArrayLength() -ne 1) { Stop-TargetPrep 'TARGET_PREP_PROTOCOL_REFUSED' }
  $targetPrepTail = $targetPrepTails[0]
  Assert-TargetPrepObject $targetPrepTail @('shape','count')
  $targetPrepShape = Read-TargetPrepEnum ($targetPrepTail.GetProperty('shape')) @('valid')
  $targetPrepTailCount = Read-TargetPrepCount ($targetPrepTail.GetProperty('count')) 1 10000
  if ($targetPrepTailCount -ne $targetPrepCount) { Stop-TargetPrep 'TARGET_PREP_PROTOCOL_REFUSED' }
  $targetPrepClassProjection.Add([ordered]@{kind=$targetPrepKind;count=$targetPrepCount;scopes=$targetPrepScopesProjection.ToArray();tails=@([ordered]@{shape=$targetPrepShape;count=$targetPrepTailCount})})
  $targetPrepClassSum += $targetPrepCount
 }
 if ($targetPrepClassSum -ne $Entries) { Stop-TargetPrep 'TARGET_PREP_PROTOCOL_REFUSED' }
 $targetPrepInventory.classes = $targetPrepClassProjection.ToArray()
 return $targetPrepInventory
}
function Read-TargetPrepProjection($Value,[int]$NativeExitCode) {
 Assert-TargetPrepUniqueJson $Value
 if ($Value.ValueKind -ne [Text.Json.JsonValueKind]::Object) { Stop-TargetPrep 'TARGET_PREP_PROTOCOL_REFUSED' }
 $targetPrepOk = Read-TargetPrepBool ($Value.GetProperty('ok'))
 if ($targetPrepOk) {
  if ($NativeExitCode -ne 0) { Stop-TargetPrep 'TARGET_PREP_NATIVE_REFUSED' }
  Assert-TargetPrepObject $Value @('ok','operation','format','snapshot','transportMode','customToc','inventory','inspectionOnly','baselineQualified','targetQueried','remoteMutation','baselineCompared','restoreAccepted')
  $targetPrepProjection = [ordered]@{ok=$true;operation=(Read-TargetPrepEnum ($Value.GetProperty('operation')) @('managed_restore_target_inventory_inspect'));transportMode=(Read-TargetPrepEnum ($Value.GetProperty('transportMode')) @('native'))}
  $targetPrepFormat = $Value.GetProperty('format')
  Assert-TargetPrepObject $targetPrepFormat @('archiveVersion','intSize','offSize','format','compression')
  $targetPrepProjection.format = [ordered]@{archiveVersion=(Read-TargetPrepEnum ($targetPrepFormat.GetProperty('archiveVersion')) @('1.16-0'));intSize=(Read-TargetPrepCount ($targetPrepFormat.GetProperty('intSize')) 4 4);offSize=(Read-TargetPrepCount ($targetPrepFormat.GetProperty('offSize')) 8 8);format=(Read-TargetPrepEnum ($targetPrepFormat.GetProperty('format')) @('CUSTOM'));compression=(Read-TargetPrepEnum ($targetPrepFormat.GetProperty('compression')) @('GZIP'))}
  $targetPrepSnapshot = $Value.GetProperty('snapshot')
  Assert-TargetPrepObject $targetPrepSnapshot @('version','protocolOnly','nativeOrigin','readonlySnapshot','repeatableRead','actorValidated','rlsBypass','schemas','catalogueRelations','ordinaryTables','emptyDataTables','authHistoryRows','storageHistoryRows','allOtherTableDataEmpty','restoreAccepted')
  $targetPrepSnapshotProjection = [ordered]@{version=(Read-TargetPrepCount ($targetPrepSnapshot.GetProperty('version')) 1 1);schemas=(Read-TargetPrepCount ($targetPrepSnapshot.GetProperty('schemas')) 3 3)}
  foreach ($targetPrepFlag in @('protocolOnly','readonlySnapshot','repeatableRead','actorValidated','rlsBypass','allOtherTableDataEmpty')) {
   if (-not (Read-TargetPrepBool ($targetPrepSnapshot.GetProperty($targetPrepFlag)))) { Stop-TargetPrep 'TARGET_PREP_PROTOCOL_REFUSED' }
   $targetPrepSnapshotProjection[$targetPrepFlag] = $true
  }
  foreach ($targetPrepFlag in @('nativeOrigin','restoreAccepted')) {
   if (Read-TargetPrepBool ($targetPrepSnapshot.GetProperty($targetPrepFlag))) { Stop-TargetPrep 'TARGET_PREP_PROTOCOL_REFUSED' }
   $targetPrepSnapshotProjection[$targetPrepFlag] = $false
  }
  $targetPrepSnapshotProjection.catalogueRelations = Read-TargetPrepCount ($targetPrepSnapshot.GetProperty('catalogueRelations')) 2 1000
  $targetPrepSnapshotProjection.ordinaryTables = Read-TargetPrepCount ($targetPrepSnapshot.GetProperty('ordinaryTables')) 2 1000
  $targetPrepSnapshotProjection.emptyDataTables = Read-TargetPrepCount ($targetPrepSnapshot.GetProperty('emptyDataTables')) 0 998
  $targetPrepSnapshotProjection.authHistoryRows = Read-TargetPrepCount ($targetPrepSnapshot.GetProperty('authHistoryRows')) 0 10000
  $targetPrepSnapshotProjection.storageHistoryRows = Read-TargetPrepCount ($targetPrepSnapshot.GetProperty('storageHistoryRows')) 0 10000
  if ($targetPrepSnapshotProjection.ordinaryTables -gt $targetPrepSnapshotProjection.catalogueRelations -or $targetPrepSnapshotProjection.emptyDataTables -ne $targetPrepSnapshotProjection.ordinaryTables - 2) { Stop-TargetPrep 'TARGET_PREP_PROTOCOL_REFUSED' }
  $targetPrepProjection.snapshot = $targetPrepSnapshotProjection
  $targetPrepToc = $Value.GetProperty('customToc')
  Assert-TargetPrepObject $targetPrepToc @('entries','encoding','tocBytes')
  $targetPrepProjection.customToc = [ordered]@{entries=(Read-TargetPrepCount ($targetPrepToc.GetProperty('entries')) 1 10000);encoding=(Read-TargetPrepEnum ($targetPrepToc.GetProperty('encoding')) @('UTF8'));tocBytes=(Read-TargetPrepCount ($targetPrepToc.GetProperty('tocBytes')) 12 33554432)}
  $targetPrepProjection.inventory = Read-TargetPrepInventory ($Value.GetProperty('inventory')) $targetPrepProjection.customToc.entries
  if (-not (Read-TargetPrepBool ($Value.GetProperty('targetQueried')))) { Stop-TargetPrep 'TARGET_PREP_PROTOCOL_REFUSED' }
  $targetPrepProjection.targetQueried = $true
 } else {
  if ($NativeExitCode -ne 1) { Stop-TargetPrep 'TARGET_PREP_PROTOCOL_REFUSED' }
  if ($Value.GetProperty('operation').GetString() -ceq 'operator') {
   Assert-TargetPrepObject $Value @('ok','operation','error')
   return [ordered]@{ok=$false;operation=(Read-TargetPrepEnum ($Value.GetProperty('operation')) @('operator'));error=(Read-TargetPrepEnum ($Value.GetProperty('error')) @('OPERATOR_SETUP_FAILED'))}
  }
  Assert-TargetPrepObject $Value @('ok','operation','error','stage','targetConnectionRequested','nativeTargetDiagnostic','nativeHistoryDiagnostic','tocDiagnostic','tocPlanDiagnostic','inspectionOnly','baselineQualified','remoteMutation','baselineCompared','restoreAccepted')
  $targetPrepCliErrors = @('INVALID_ARGUMENTS','ISOLATED_RESTORE_TARGET_REQUIRED','ISOLATED_STORAGE_CONFIGURATION_REQUIRED','RESTORE_ABSOLUTE_EXECUTABLES_REQUIRED','PERSONAL_POSTGRES_CONFIGURATION_REQUIRED','UNSAFE_BACKUP_DESTINATION','INSPECTION_PATH_REFUSED','INSPECTION_PRIVATE_PATH_REFUSED','INSPECTION_TIMEOUT','INSPECTION_LIMIT','INSPECTION_NATIVE_FAILED','INSPECTION_NATIVE_UNAVAILABLE','INSPECTION_INPUT_FAILED','INSPECTION_TOC_INVALID','INSPECTION_SNAPSHOT_CHANGED','INSPECTION_CLEANUP_FAILED','INSPECTION_UNAVAILABLE','RESTORE_MANAGED_DATABASE_INVALID','RESTORE_MANAGED_BINDING_INVALID','RESTORE_MANAGED_TARGET_BINDING_INVALID','RESTORE_MANAGED_TARGET_SCOPE_UNSUPPORTED','RESTORE_MANAGED_TARGET_BASELINE_INVALID','RESTORE_TOC_INVALID','RESTORE_TOC_UNSUPPORTED','RESTORE_TOC_DEPENDENCY_INVALID','RESTORE_MANAGED_CUSTOM_INVALID','RESTORE_CUSTOM_HEADER_INPUT_INVALID','RESTORE_CUSTOM_HEADER_LIMIT_EXCEEDED','RESTORE_CUSTOM_HEADER_TRUNCATED','RESTORE_CUSTOM_HEADER_UNSUPPORTED','RESTORE_CUSTOM_TOC_INPUT_INVALID','RESTORE_CUSTOM_TOC_PLAN_REQUIRED','RESTORE_CUSTOM_TOC_BINDING_INVALID','RESTORE_CUSTOM_TOC_FORMAT_UNSUPPORTED','RESTORE_CUSTOM_TOC_TRUNCATED','RESTORE_CUSTOM_TOC_LIMIT_EXCEEDED','RESTORE_CUSTOM_TOC_INVALID','RESTORE_CUSTOM_TOC_PLAN_MISMATCH','RESTORE_CUSTOM_TOC_REQUIRED','RESTORE_CUSTOM_TOC_DISCARDED','RESTORE_CUSTOM_TOC_TARGET_REQUIRED')
  $targetPrepCliErrors = @($targetPrepCliErrors | Where-Object { $_ -notin @('RESTORE_MANAGED_TARGET_SCOPE_UNSUPPORTED','RESTORE_MANAGED_TARGET_BASELINE_INVALID') })
  $targetPrepCliErrors += @('RESTORE_MANAGED_TARGET_INSPECTION_REQUIRED','RESTORE_MANAGED_TARGET_INSPECTION_UNSUPPORTED','RESTORE_CUSTOM_TOC_INSPECTION_REQUIRED')
  $targetPrepCliErrors += @('INPUT_INVALID','RUNTIME_REFUSED','TARGET_REFUSED','TIMEOUT','SPAWN_FAILED','PRODUCER_FAILED','INPUT_FAILED','OUTPUT_LIMIT','PROTOCOL_REFUSED','REQUIRED','DISCARDED','COPY_CLAIMED','INTEGRITY_FAILED') | ForEach-Object { 'RESTORE_TARGET_SNAPSHOT_NATIVE_' + $_ }
  if ($Value.GetProperty('nativeHistoryDiagnostic').ValueKind -ne [Text.Json.JsonValueKind]::Null) { Stop-TargetPrep 'TARGET_PREP_PROTOCOL_REFUSED' }
  $targetPrepProjection = [ordered]@{ok=$false;operation=(Read-TargetPrepEnum ($Value.GetProperty('operation')) @('managed_restore_target_inventory_inspect'));error=(Read-TargetPrepEnum ($Value.GetProperty('error')) $targetPrepCliErrors);stage=(Read-TargetPrepNullableEnum ($Value.GetProperty('stage')) @('configuration','temporary_path','directory_acl','target_snapshot','native_toc','plan','custom_toc','cleanup'));targetConnectionRequested=(Read-TargetPrepBool ($Value.GetProperty('targetConnectionRequested')));nativeTargetDiagnostic=(Read-TargetPrepSnapshotDiagnostic ($Value.GetProperty('nativeTargetDiagnostic')));nativeHistoryDiagnostic=$null;tocDiagnostic=(Read-TargetPrepDiagnostic ($Value.GetProperty('tocDiagnostic')) $false);tocPlanDiagnostic=(Read-TargetPrepDiagnostic ($Value.GetProperty('tocPlanDiagnostic')) $true)}
 }
 if (-not (Read-TargetPrepBool ($Value.GetProperty('inspectionOnly')))) { Stop-TargetPrep 'TARGET_PREP_PROTOCOL_REFUSED' }
 $targetPrepProjection.inspectionOnly = $true
 foreach ($targetPrepFlag in @('remoteMutation','baselineQualified','baselineCompared','restoreAccepted')) {
  if (Read-TargetPrepBool ($Value.GetProperty($targetPrepFlag))) { Stop-TargetPrep 'TARGET_PREP_PROTOCOL_REFUSED' }
  $targetPrepProjection[$targetPrepFlag] = $false
 }
 return $targetPrepProjection
}

try {
 if (-not $IsWindows -or $PSVersionTable.PSVersion.Major -ne 7) { Stop-TargetPrep 'TARGET_PREP_PLATFORM_REFUSED' }
 if ($ReviewedCommit -isnot [string] -or $ReviewedCommit -cnotmatch '^[a-f0-9]{40}$' -or $SelfSha256 -notmatch '^[a-fA-F0-9]{64}$') { Stop-TargetPrep 'TARGET_PREP_INPUT_REFUSED' }
 $targetPrepRepo = 'C:\Users\Kauan Sousa Barateli\Documents\Codex\2026-10-07\inicie-a-constru-o-do-software-2\work\Segundo-Cerebro'
 $targetPrepSelf = Join-Path $targetPrepRepo 'work\inspect-target-inventory-preparacao-20261016-v1.ps1'
 if (-not $PSCommandPath.Equals($targetPrepSelf,[StringComparison]::OrdinalIgnoreCase)) { Stop-TargetPrep 'TARGET_PREP_PATH_REFUSED' }
 Open-TargetPrepPin $targetPrepSelf -1 $SelfSha256
 $targetPrepGit = (@(Get-Command git -CommandType Application -ErrorAction Stop)[0]).Source
 if ($targetPrepGit -isnot [string] -or [string]::IsNullOrWhiteSpace($targetPrepGit)) { Stop-TargetPrep 'TARGET_PREP_GIT_REFUSED' }
 Assert-TargetPrepRegularPath $targetPrepGit
 $targetPrepSources = @(
  @('scripts/operations/run-operator.ps1',6111,'7311AEC2E11F747C7D3204821EF22748BDA9CCAB85608D6B3EDB854C44BF196C'),
  @('scripts/operations/restore-managed-inspect.mjs',37980,'B2B7E21A6E3FC2A4A3FDD715F561C5216C8E7811A06268A03BC2BF2AF51B0209'),
  @('scripts/operations/backup-format.mjs',10581,'AE711C39EF31660CBDDC50081290C53B57CCE8FE6361E8A5E7846EDD0696AC74'),
  @('scripts/operations/backup-config.mjs',4347,'BB0F9276180C26E9D07253631B233AD8EF9AEAD7CCA07ABDB01D9F0E4C567D78'),
  @('scripts/operations/restore-target.mjs',11357,'F29BD0B5D23F78EDE190C6B85CD467E87DC0048E7172E8C8F686771DF49B4AA0'),
  @('scripts/operations/postgres-process.mjs',5359,'D210AB110390EC8CD14DF2189346F0EEEE1DF3CCD03D13E6476AA00E51991464'),
  @('scripts/operations/backup-sources.mjs',5367,'F3AAF3D29FF465CCFF074B2626A6A0304700FFBD3847FE57B7003EB7F2E90F41'),
  @('scripts/operations/restore-managed-plan.mjs',37847,'AE541AF507F58055F50D1CAEFDA09B7409EA872D443ABDA58793744B7BD72B85'),
  @('scripts/operations/restore-custom-header.mjs',3892,'3C1BB314D71CA6FB1240B2E2EBBAB8544D92E46975D66F67FE0CBA3CF63DCB12'),
  @('scripts/operations/restore-custom-toc.mjs',21136,'FF98AC6AC8DE277E459F724D7D54A70D2F0790A57189E62F2FA88C16C4C218A8'),
  @('scripts/operations/restore-migration-history.mjs',24469,'12B9DF82A346C9060D53653DD7DF4AEFA56A0B0186F6F66F48C2343DB2650F2E'),
  @('scripts/operations/restore-migration-history-native.mjs',30873,'7524C248628734C9EECC5B051AE83D0617BD3EC5416B9BB631E6C9EB90EB8B5C'),
  @('scripts/operations/restore-native-binary-output.mjs',23068,'CC8534E1600807A083DFE2F294E26AB39052F2092CEF5EA3FAF889AF67EA981D'),
  @('scripts/operations/restore-managed-native-adapters.mjs',18151,'C8758D6A4B42278784E82EDB0EE2250CF4D5CB9D684F635BE6E4F86311E1EF52'),
  @('scripts/operations/restore-managed-validation-sql.mjs',28551,'D117843975EBCEA4D1998DEA79E52B5165DA4B7CB5E91C3A46994679CD57FCBC'),
  @('scripts/operations/restore-target-snapshot-protocol.mjs',16268,'7A56531CB62BC17973A0472584D27B3EC04B28BE2B246EC8174334381D15CD65'),
  @('scripts/operations/restore-target-snapshot-native.mjs',18155,'93B34FD34BB161684EB818CD4F8EDE53B5633A80A709E789555E7980876F0D4A')
 )
 $targetPrepSourcePaths = @($targetPrepSources | ForEach-Object { $_[0] })
 Assert-TargetPrepGit
 foreach ($targetPrepSource in $targetPrepSources) { Open-TargetPrepPin (Join-Path $targetPrepRepo $targetPrepSource[0]) $targetPrepSource[1] $targetPrepSource[2] }
 $targetPrepNode = 'C:\Users\Kauan Sousa Barateli\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
 $targetPrepPwsh = 'C:\Users\Kauan Sousa Barateli\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe'
 Open-TargetPrepPin $targetPrepNode 92825416 '3602F2BB1A10F2CBAB4C36886218A33C1AB3DB87290E73B033C46C77147D0237'
 Open-TargetPrepPin $targetPrepPwsh 301368 '362A356CE7F0940EC74F73A8FC2C990A2CC24A38A11C90BBD8ECA947110AD139'
 Open-TargetPrepPin 'C:\Program Files\PostgreSQL\18\bin\pg_restore.exe' 379392 'E07BDB23F2D2A7E4D2DB7A50386CD43049F4216540FA18E2FAF79B80AB43AC18'
 Open-TargetPrepPin 'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe' 632320 '46C8AD2E487FA01BB5401AE3B383C09E20789EFDD3A37C6940975647EB1FF574'
 Open-TargetPrepPin 'C:\Program Files\PostgreSQL\17\bin\psql.exe' 635392 'C290C7F0A3335F290F8C18011A1E5AFA03EE3CDD628697A5F3E767E5F1D3D10D'
 # The materializer derives exactly this PS5 helper from SystemRoot. Bind both
 # the environment and executable rather than pinning an unused alternative.
 $targetPrepSystemRoot = 'C:\WINDOWS'
 if (-not $targetPrepSystemRoot.Equals([Environment]::GetEnvironmentVariable('SystemRoot','Process'),[StringComparison]::OrdinalIgnoreCase)) { Stop-TargetPrep 'TARGET_PREP_PLATFORM_REFUSED' }
 Open-TargetPrepPin (Join-Path $targetPrepSystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') 495616 '60C9B29843624DD8AF6B6A7B26147753BE6AEEF65098B9A503CC50850AFE410F'
 Assert-TargetPrepGit
 # Private files are not opened until all public review/commit/runtime gates pass.
 # Hashing does not deserialize the profile or print private content.
 $targetPrepProfile = 'C:\Users\Kauan Sousa Barateli\SegundoCerebro-Operations\profiles\restore-target-pg18-20261012-v2.xml'
 Open-TargetPrepPin $targetPrepProfile 3901 'E2CD837487821DD266D5F87223B5D65C56DD4CE0029CC52FE1DD71644EED740B'
 Open-TargetPrepPin 'C:\Users\Kauan Sousa Barateli\SegundoCerebro-Operations\certificates\prod-ca-2021.crt' -1 '700723581420DD1AC98FD7E9AC529F0EF210EADCAF87FC868A3AD7D114C2F3B7'
 Assert-TargetPrepGit
 $targetPrepStart = [Diagnostics.ProcessStartInfo]::new()
 $targetPrepStart.FileName = $targetPrepPwsh
 $targetPrepStart.WorkingDirectory = $targetPrepRepo
 $targetPrepStart.UseShellExecute = $false
 $targetPrepStart.CreateNoWindow = $true
 $targetPrepStart.RedirectStandardOutput = $true
 $targetPrepStart.RedirectStandardError = $true
 $targetPrepStart.Environment.Clear()
 foreach ($targetPrepEnvName in @('SystemRoot','WINDIR','SystemDrive','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','OneDrive','OneDriveConsumer','OneDriveCommercial')) {
  $targetPrepEnvValue = [Environment]::GetEnvironmentVariable($targetPrepEnvName,'Process')
  if ($null -ne $targetPrepEnvValue) { $targetPrepStart.Environment[$targetPrepEnvName] = $targetPrepEnvValue }
 }
 # No NODE_OPTIONS/NODE_PATH, inherited PG credentials or unrelated MCP tokens.
 $targetPrepStart.Environment['PATH'] = Join-Path ([Environment]::GetEnvironmentVariable('SystemRoot','Process')) 'System32'
 $targetPrepStart.Environment['PATHEXT'] = '.EXE'
 foreach ($targetPrepArgument in @('-NoLogo','-NoProfile','-NonInteractive','-File',(Join-Path $targetPrepRepo 'scripts\operations\run-operator.ps1'),'-Operation','restore-inspect-target-inventory','-ProfilePath',$targetPrepProfile,'-NodePath',$targetPrepNode)) { $targetPrepStart.ArgumentList.Add($targetPrepArgument) }
 Assert-TargetPrepDeadline
 $targetPrepProcess = [Diagnostics.Process]::new()
 $targetPrepProcess.StartInfo = $targetPrepStart
 if (-not $targetPrepProcess.Start()) { Stop-TargetPrep 'TARGET_PREP_PROCESS_UNAVAILABLE' }
 $targetPrepOutDone = $false; $targetPrepErrDone = $false
 $targetPrepOutRead = $targetPrepProcess.StandardOutput.BaseStream.ReadAsync($targetPrepOutBuffer,0,$targetPrepOutBuffer.Length)
 $targetPrepErrRead = $targetPrepProcess.StandardError.BaseStream.ReadAsync($targetPrepErrBuffer,0,$targetPrepErrBuffer.Length)
 while (-not $targetPrepOutDone -or -not $targetPrepErrDone -or -not $targetPrepProcess.HasExited) {
  Assert-TargetPrepDeadline
  if (-not $targetPrepOutDone -and $targetPrepOutRead.IsCompleted) {
   $targetPrepReadCount = $targetPrepOutRead.GetAwaiter().GetResult()
   if ($targetPrepReadCount -eq 0) { $targetPrepOutDone = $true } else {
    if ($targetPrepOutput.Length + $targetPrepReadCount -gt 65536) { Stop-TargetPrep 'TARGET_PREP_OUTPUT_LIMIT' }
    $targetPrepOutput.Write($targetPrepOutBuffer,0,$targetPrepReadCount)
    [Array]::Clear($targetPrepOutBuffer,0,$targetPrepOutBuffer.Length)
    $targetPrepOutRead = $targetPrepProcess.StandardOutput.BaseStream.ReadAsync($targetPrepOutBuffer,0,$targetPrepOutBuffer.Length)
   }
  }
  if (-not $targetPrepErrDone -and $targetPrepErrRead.IsCompleted) {
   $targetPrepReadCount = $targetPrepErrRead.GetAwaiter().GetResult()
   [Array]::Clear($targetPrepErrBuffer,0,$targetPrepErrBuffer.Length)
   if ($targetPrepReadCount -eq 0) { $targetPrepErrDone = $true } else { $targetPrepErrRead = $targetPrepProcess.StandardError.BaseStream.ReadAsync($targetPrepErrBuffer,0,$targetPrepErrBuffer.Length) }
  }
  [Threading.Thread]::Sleep(10)
 }
 # Qualification requires BOTH original stream EOFs and original process exit.
 # A timeout or Kill request never enters this branch or certifies cleanup.
 Assert-TargetPrepDeadline
 Assert-TargetPrepGit
 $targetPrepBytes = $targetPrepOutput.ToArray()
 $targetPrepText = [Text.UTF8Encoding]::new($false,$true).GetString($targetPrepBytes)
 try { $targetPrepDocument = [Text.Json.JsonDocument]::Parse($targetPrepText); $targetPrepProjection = Read-TargetPrepProjection $targetPrepDocument.RootElement $targetPrepProcess.ExitCode } catch { if ($_.Exception.Message -cin $targetPrepCodes) { throw }; Stop-TargetPrep 'TARGET_PREP_PROTOCOL_REFUSED' }
 if ($targetPrepProcess.ExitCode -eq 0 -and $targetPrepProjection.ok) {
  $targetPrepResult = [ordered]@{ok=$true;operation='restore_inspect_target_inventory_preparation';reviewedCommit=$ReviewedCommit;result=$targetPrepProjection}
  $targetPrepExit = 0
 } else {
  $targetPrepResult = [ordered]@{ok=$false;operation='restore_inspect_target_inventory_preparation';error='TARGET_PREP_NATIVE_REFUSED';reviewedCommit=$ReviewedCommit;diagnostic=$targetPrepProjection}
 }
} catch {
 $targetPrepCode = if ($_.Exception.Message -cin $targetPrepCodes) { $_.Exception.Message } else { 'TARGET_PREP_UNAVAILABLE' }
 $targetPrepResult = [ordered]@{ok=$false;operation='restore_inspect_target_inventory_preparation';error=$targetPrepCode}
} finally {
 if ($null -ne $targetPrepProcess) {
  try { if (-not $targetPrepProcess.HasExited) { $targetPrepProcess.Kill($true) } } catch { }
  # This is a cancellation request only. Do not wait, infer EOF or claim cleanup.
  try { $targetPrepProcess.Dispose() } catch { }
 }
 if ($null -ne $targetPrepDocument) { $targetPrepDocument.Dispose() }
 if ($null -ne $targetPrepBytes) { [Array]::Clear($targetPrepBytes,0,$targetPrepBytes.Length) }
 [Array]::Clear($targetPrepOutBuffer,0,$targetPrepOutBuffer.Length)
 [Array]::Clear($targetPrepErrBuffer,0,$targetPrepErrBuffer.Length)
 try { $targetPrepStore = $targetPrepOutput.GetBuffer(); [Array]::Clear($targetPrepStore,0,$targetPrepStore.Length) } catch { }
 $targetPrepOutput.Dispose()
 foreach ($targetPrepLease in $targetPrepLeases) { try { $targetPrepLease.Dispose() } catch { } }
 $targetPrepLeases.Clear()
 $targetPrepWatch.Stop()
}
Write-Output ($targetPrepResult | ConvertTo-Json -Depth 12 -Compress)
exit $targetPrepExit
