# Source-only preparation for ONE NEW authenticated source/target baseline observation.
# Default gate is inert, with no private file, executable, SQL or network access.
# NEW source-only package for Root/peer review; not an execution or acceptance.
# Exact source: PR102 diagnostic-only EOF / pinned operational source 6784b9e8f5b27abb664ec0b4f17b96bbffe31b1d / treedb5540fa35ddcb344a364f675fcc9a404391863b.
# One new authorized source archive, readonly target, no new backup/import/mint.
# The child inspector owns ONE inherited 45-second scope; wrapper cap is 90s.
# Kill/ACK never certifies original producer EOF, commit or cleanup.
[CmdletBinding()]
param(
 [bool]$GateExecute = $false,
 [object]$ReviewedCommit = $null,
 [object]$ArchiveBinding = $null,
 [string]$SelfSha256 = ''
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (-not $GateExecute) {
 Write-Output '{"ok":true,"operation":"restore_inspect_combined_baseline_preparation","gateExecute":false,"remoteExecuted":false,"restoreAccepted":false}'
 exit 0
}

$combinedPrepCodes = @('COMBINED_PREP_INPUT_REFUSED','COMBINED_PREP_PLATFORM_REFUSED','COMBINED_PREP_PATH_REFUSED','COMBINED_PREP_PIN_REFUSED','COMBINED_PREP_GIT_REFUSED','COMBINED_PREP_SOURCE_DIRTY','COMBINED_PREP_TIMEOUT','COMBINED_PREP_PROCESS_UNAVAILABLE','COMBINED_PREP_OUTPUT_LIMIT','COMBINED_PREP_PROTOCOL_REFUSED','COMBINED_PREP_NATIVE_REFUSED','COMBINED_PREP_UNAVAILABLE')
$combinedPrepLeases = [Collections.Generic.List[IO.FileStream]]::new()
$combinedPrepWatch = [Diagnostics.Stopwatch]::StartNew()
$combinedPrepProcess = $null
$combinedPrepDocument = $null
$combinedPrepBytes = $null
$combinedPrepOutput = [IO.MemoryStream]::new()
$combinedPrepOutBuffer = [byte[]]::new(4096)
$combinedPrepErrBuffer = [byte[]]::new(4096)
$combinedPrepResult = $null
$combinedPrepExit = 1

function Stop-CombinedPrep([string]$Code) { throw $Code }
function Assert-CombinedPrepDeadline {
 if ($combinedPrepWatch.ElapsedMilliseconds -ge 90000) { Stop-CombinedPrep 'COMBINED_PREP_TIMEOUT' }
}
function Assert-CombinedPrepRegularPath([string]$Path) {
 if (-not [IO.Path]::IsPathFullyQualified($Path) -or $Path.StartsWith('\\') -or $Path.Contains('~')) { Stop-CombinedPrep 'COMBINED_PREP_PATH_REFUSED' }
 $combinedPrepItem = Get-Item -LiteralPath $Path -Force
 if ($combinedPrepItem.PSIsContainer -or -not $combinedPrepItem.FullName.Equals([IO.Path]::GetFullPath($Path),[StringComparison]::OrdinalIgnoreCase)) { Stop-CombinedPrep 'COMBINED_PREP_PATH_REFUSED' }
 $combinedPrepAncestor = $combinedPrepItem
 while ($null -ne $combinedPrepAncestor) {
  if (($combinedPrepAncestor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { Stop-CombinedPrep 'COMBINED_PREP_PATH_REFUSED' }
  if ($combinedPrepAncestor -is [IO.FileInfo]) { $combinedPrepAncestor = $combinedPrepAncestor.Directory } else { $combinedPrepAncestor = $combinedPrepAncestor.Parent }
 }
}
function Open-CombinedPrepPin([string]$Path,[long]$Bytes,[string]$Sha256) {
 Assert-CombinedPrepDeadline
 Assert-CombinedPrepRegularPath $Path
 # Read sharing denies replacement, deletion and writes while this lease lives.
 $combinedPrepStream = [IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 $combinedPrepLeases.Add($combinedPrepStream)
 if ($Bytes -ge 0 -and $combinedPrepStream.Length -ne $Bytes) { Stop-CombinedPrep 'COMBINED_PREP_PIN_REFUSED' }
 $combinedPrepHasher = [Security.Cryptography.SHA256]::Create()
 try { $combinedPrepHashBytes = $combinedPrepHasher.ComputeHash($combinedPrepStream); $combinedPrepHash = [Convert]::ToHexString($combinedPrepHashBytes) } finally { $combinedPrepHasher.Dispose() }
 $combinedPrepStream.Position = 0
 if (-not $combinedPrepHash.Equals($Sha256,[StringComparison]::OrdinalIgnoreCase)) { Stop-CombinedPrep 'COMBINED_PREP_PIN_REFUSED' }
 Assert-CombinedPrepDeadline
}
function Assert-CombinedPrepGit {
 Assert-CombinedPrepDeadline
 $combinedPrepHead = @(& $combinedPrepGit -C $combinedPrepRepo rev-parse --verify HEAD 2>$null)
 if ($LASTEXITCODE -ne 0 -or $combinedPrepHead.Count -ne 1 -or $combinedPrepHead[0] -cne $ReviewedCommit) { Stop-CombinedPrep 'COMBINED_PREP_GIT_REFUSED' }
 $combinedPrepTree = @(& $combinedPrepGit -C $combinedPrepRepo rev-parse --verify 'HEAD^{tree}' 2>$null)
 if ($LASTEXITCODE -ne 0 -or $combinedPrepTree.Count -ne 1 -or $combinedPrepTree[0] -cne 'db5540fa35ddcb344a364f675fcc9a404391863b') { Stop-CombinedPrep 'COMBINED_PREP_GIT_REFUSED' }
 # Only the nineteen reviewed transitive paths are guarded. User WIPs stay outside.
 $combinedPrepStatus = @(& $combinedPrepGit -C $combinedPrepRepo status --porcelain=v1 --untracked-files=all -- @combinedPrepSourcePaths 2>$null)
 if ($LASTEXITCODE -ne 0) { Stop-CombinedPrep 'COMBINED_PREP_GIT_REFUSED' }
 if ($combinedPrepStatus.Count -ne 0) { Stop-CombinedPrep 'COMBINED_PREP_SOURCE_DIRTY' }
 & $combinedPrepGit -C $combinedPrepRepo ls-files --error-unmatch -- @combinedPrepSourcePaths 1>$null 2>$null
 if ($LASTEXITCODE -ne 0) { Stop-CombinedPrep 'COMBINED_PREP_GIT_REFUSED' }
 Assert-CombinedPrepDeadline
}
function Assert-CombinedPrepObject($Value,[string[]]$Keys) {
 if ($Value.ValueKind -ne [Text.Json.JsonValueKind]::Object) { Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED' }
 $combinedPrepSeen = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
 foreach ($combinedPrepProperty in $Value.EnumerateObject()) {
  if (-not $combinedPrepSeen.Add($combinedPrepProperty.Name) -or $Keys -cnotcontains $combinedPrepProperty.Name) { Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED' }
 }
 if ($combinedPrepSeen.Count -ne $Keys.Count) { Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED' }
}
function Assert-CombinedPrepUniqueJson($Value,[int]$Depth = 0) {
 if ($Depth -gt 12) { Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED' }
 if ($Value.ValueKind -eq [Text.Json.JsonValueKind]::Object) {
  $combinedPrepSeen = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  foreach ($combinedPrepProperty in $Value.EnumerateObject()) {
   if (-not $combinedPrepSeen.Add($combinedPrepProperty.Name)) { Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED' }
   Assert-CombinedPrepUniqueJson $combinedPrepProperty.Value ($Depth + 1)
  }
 } elseif ($Value.ValueKind -eq [Text.Json.JsonValueKind]::Array) {
  foreach ($combinedPrepItem in $Value.EnumerateArray()) { Assert-CombinedPrepUniqueJson $combinedPrepItem ($Depth + 1) }
 }
}
function Read-CombinedPrepEnum($Value,[string[]]$Allowed) {
 if ($Value.ValueKind -ne [Text.Json.JsonValueKind]::String) { Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED' }
 $combinedPrepText = $Value.GetString()
 if ($Allowed -cnotcontains $combinedPrepText) { Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED' }
 return $combinedPrepText
}
function Read-CombinedPrepBool($Value) {
 if ($Value.ValueKind -notin @([Text.Json.JsonValueKind]::True,[Text.Json.JsonValueKind]::False)) { Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED' }
 return $Value.GetBoolean()
}
function Read-CombinedPrepCount($Value,[long]$Minimum,[long]$Maximum) {
 $combinedPrepNumber = 0L
 if ($Value.ValueKind -ne [Text.Json.JsonValueKind]::Number -or -not $Value.TryGetInt64([ref]$combinedPrepNumber) -or $combinedPrepNumber -lt $Minimum -or $combinedPrepNumber -gt $Maximum) { Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED' }
 return $combinedPrepNumber
}
function Read-CombinedPrepNullableEnum($Value,[string[]]$Allowed) {
 if ($Value.ValueKind -eq [Text.Json.JsonValueKind]::Null) { return $null }
 return Read-CombinedPrepEnum $Value $Allowed
}
function Read-CombinedPrepDiagnostic($Value,[bool]$Plan) {
 if ($Value.ValueKind -eq [Text.Json.JsonValueKind]::Null) { return $null }
 $combinedPrepScopes = @('app','managed','global','other','unparsed')
 $combinedPrepKinds = @('SEQUENCE OWNED BY','MATERIALIZED VIEW DATA','MATERIALIZED VIEW','DOMAIN CONSTRAINT','FK CONSTRAINT','DEFAULT ACL','TABLE ATTACH','INDEX ATTACH','TABLE DATA','SEQUENCE SET','ROW SECURITY','SHELL TYPE','SECURITY LABEL','DATABASE PROPERTIES','DATABASE','SCHEMA','TABLE','SEQUENCE','DEFAULT','TYPE','DOMAIN','FUNCTION','PROCEDURE','AGGREGATE','CONSTRAINT','INDEX','TRIGGER','POLICY','RULE','ACL','COMMENT','VIEW','COLLATION','ENCODING','STDSTRINGS','SEARCHPATH')
 if ($Plan) {
  Assert-CombinedPrepObject $Value @('version','reason','knownKind','scopeCategory')
  $combinedPrepReasons = @('input_shape','integer_shape','integer_range','dependency_without_entry','dependency_comment_repeated','dependency_comment_shape','count_header_repeated','format_header_repeated','producer_header_repeated','entry_before_selected','entry_shape','entry_id_repeated','format_header_invalid','producer_header_invalid','count_header_invalid','entry_count_mismatch','verbose_dependencies_missing','dependency_self','dependency_missing','database_metadata_repeated','database_metadata_orphan','database_owner_mismatch','database_dependency_shape','customization_repeated','customization_missing','auth_user_data_missing','core_depends_on_delayed_customization','customization_dependency_not_completed')
  return [ordered]@{version=(Read-CombinedPrepCount ($Value.GetProperty('version')) 1 1);reason=(Read-CombinedPrepEnum ($Value.GetProperty('reason')) $combinedPrepReasons);knownKind=(Read-CombinedPrepNullableEnum ($Value.GetProperty('knownKind')) $combinedPrepKinds);scopeCategory=(Read-CombinedPrepEnum ($Value.GetProperty('scopeCategory')) $combinedPrepScopes)}
 }
 Assert-CombinedPrepObject $Value @('reason','knownKind','scopeCategory','tailShape')
 return [ordered]@{reason=(Read-CombinedPrepEnum ($Value.GetProperty('reason')) @('unknown_descriptor','tail_grammar','scope_classification'));knownKind=(Read-CombinedPrepNullableEnum ($Value.GetProperty('knownKind')) $combinedPrepKinds);scopeCategory=(Read-CombinedPrepEnum ($Value.GetProperty('scopeCategory')) $combinedPrepScopes);tailShape=(Read-CombinedPrepEnum ($Value.GetProperty('tailShape')) @('not_parsed','missing_fields','empty_tag','forbidden_tag_character','valid'))}
}
function Read-CombinedPrepSnapshotDiagnostic($Value) {
 if ($Value.ValueKind -eq [Text.Json.JsonValueKind]::Null) { return $null }
 Assert-CombinedPrepObject $Value @('version','mode','phase','protocolError','psql','dump')
 $combinedPrepProtocolCodes = @('INPUT_INVALID','FRAME_INVALID','LIMIT_EXCEEDED','IDENTITY_REFUSED','ACTOR_REFUSED','MODE_REFUSED','RLS_REFUSED','SCOPE_REFUSED','CATALOGUE_REFUSED','TARGET_NOT_EMPTY','HISTORY_REQUIRED','END_REFUSED','START_REQUIRED') | ForEach-Object { 'RESTORE_TARGET_SNAPSHOT_' + $_ }
 $combinedPrepSnapshotProjection = [ordered]@{
  version=(Read-CombinedPrepCount ($Value.GetProperty('version')) 1 1)
  mode=(Read-CombinedPrepEnum ($Value.GetProperty('mode')) @('native'))
  phase=(Read-CombinedPrepEnum ($Value.GetProperty('phase')) @('input','snapshot_start','dump','snapshot_end','qualified'))
  protocolError=(Read-CombinedPrepNullableEnum ($Value.GetProperty('protocolError')) $combinedPrepProtocolCodes)
 }
 foreach ($combinedPrepProducer in @('psql','dump')) {
  $combinedPrepFacts = $Value.GetProperty($combinedPrepProducer)
  if ($combinedPrepFacts.ValueKind -eq [Text.Json.JsonValueKind]::Null) { $combinedPrepSnapshotProjection[$combinedPrepProducer] = $null; continue }
  Assert-CombinedPrepObject $combinedPrepFacts @('spawnObserved','stdinFinishObserved','inputCallbacks','stdoutBytes','stderrBytes','stdoutEofObserved','stderrEofObserved','producerExitZero','producerCloseZero')
  $combinedPrepProducerProjection = [ordered]@{}
  foreach ($combinedPrepFlag in @('spawnObserved','stdinFinishObserved','stdoutEofObserved','stderrEofObserved','producerExitZero','producerCloseZero')) { $combinedPrepProducerProjection[$combinedPrepFlag] = Read-CombinedPrepBool ($combinedPrepFacts.GetProperty($combinedPrepFlag)) }
  $combinedPrepProducerProjection.inputCallbacks = Read-CombinedPrepCount ($combinedPrepFacts.GetProperty('inputCallbacks')) 0 2
  $combinedPrepProducerProjection.stdoutBytes = Read-CombinedPrepCount ($combinedPrepFacts.GetProperty('stdoutBytes')) 0 $(if ($combinedPrepProducer -ceq 'psql') { 2097152 } else { 67108864 })
  $combinedPrepProducerProjection.stderrBytes = Read-CombinedPrepCount ($combinedPrepFacts.GetProperty('stderrBytes')) 0 65536
  if (($combinedPrepProducerProjection.producerCloseZero -and (-not $combinedPrepProducerProjection.producerExitZero -or -not $combinedPrepProducerProjection.stdoutEofObserved -or -not $combinedPrepProducerProjection.stderrEofObserved)) -or ($combinedPrepProducerProjection.producerExitZero -and (-not $combinedPrepProducerProjection.spawnObserved))) { Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED' }
  if ($combinedPrepProducer -ceq 'dump' -and ($combinedPrepProducerProjection.inputCallbacks -ne 0 -or $combinedPrepProducerProjection.stdinFinishObserved)) { Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED' }
  $combinedPrepSnapshotProjection[$combinedPrepProducer] = $combinedPrepProducerProjection
 }
 return $combinedPrepSnapshotProjection
}
function Read-CombinedPrepParserDiagnostic($Value) {
 if ($Value.ValueKind -eq [Text.Json.JsonValueKind]::Null) { return $null }
 Assert-CombinedPrepObject $Value @('version','phase','rule')
 # Exact literal pairs from the pinned B3 export; a rule valid for a different
 # phase is refused. This JSON projection does not mint nominal provenance.
 $combinedPrepRuleByPhase = [ordered]@{
  input=@('toc_required','stdout_type','stdout_size','stdout_nonempty','owned_copy','scratch_allocation')
  profile=@('encoding','standard_strings_entry','standard_strings_definition','search_path_entry','search_path_definition','preserved_data_count','preserved_data_identity','data_dumper','data_section','data_tablespace','data_access_method','data_relation_kind','data_definition','copy_statement','copy_lexical','copy_schema','copy_table','copy_columns')
  preamble=@('banner_restrict','database_version','producer_version','settings_head','search_path','settings_tail')
  block_comment=@('owner_text','exact_comment')
  copy_header=@('exact_original')
  row=@('line_scan','row_count','field_split','field_escape','field_decode','field_count','storage_id_decimal','storage_id_safe','history_shape')
  separator=@('exact_separator')
  footer=@('exact_footer','trailing_bytes')
  binding=@('toc_identity','stdout_digest','owned_digest','handle_required','handle_discarded','retained_bytes','retained_digest')
 }
 $combinedPrepParserPhase = Read-CombinedPrepEnum ($Value.GetProperty('phase')) @($combinedPrepRuleByPhase.Keys)
 return [ordered]@{version=(Read-CombinedPrepCount ($Value.GetProperty('version')) 1 1);phase=$combinedPrepParserPhase;rule=(Read-CombinedPrepEnum ($Value.GetProperty('rule')) $combinedPrepRuleByPhase[$combinedPrepParserPhase])}
}
function Read-CombinedPrepNativeDiagnostic($Value) {
 if ($Value.ValueKind -eq [Text.Json.JsonValueKind]::Null) { return $null }
 Assert-CombinedPrepObject $Value @('version','phase','parserError','parserDiagnostic','stdoutBytes','stderrBytes','spawnObserved','stdinFinishObserved','stdinCallbackSettled','stdinError','stdinCallbackError','stdoutEofObserved','stderrEofObserved','producerExit','producerClose','cleanup')
 # This is a closed projection of the inspector's private nominal diagnostic.
 # It does not turn JSON into authority, infer EOF or carry provider text/SQL.
 $combinedPrepParserCodes = @('RESTORE_MIGRATION_HISTORY_INPUT_INVALID','RESTORE_MIGRATION_HISTORY_TOC_REQUIRED','RESTORE_MIGRATION_HISTORY_BINDING_INVALID','RESTORE_MIGRATION_HISTORY_FORMAT_UNSUPPORTED','RESTORE_MIGRATION_HISTORY_TRUNCATED','RESTORE_MIGRATION_HISTORY_LIMIT_EXCEEDED','RESTORE_MIGRATION_HISTORY_INVALID','RESTORE_MIGRATION_HISTORY_REQUIRED','RESTORE_MIGRATION_HISTORY_DISCARDED')
 $combinedPrepNativeProjection = [ordered]@{
  version=(Read-CombinedPrepCount ($Value.GetProperty('version')) 1 1)
  phase=(Read-CombinedPrepEnum ($Value.GetProperty('phase')) @('input','list','spawn','collect','parse','cleanup','retained'))
  parserError=(Read-CombinedPrepNullableEnum ($Value.GetProperty('parserError')) $combinedPrepParserCodes)
  parserDiagnostic=(Read-CombinedPrepParserDiagnostic ($Value.GetProperty('parserDiagnostic')))
  stdoutBytes=(Read-CombinedPrepCount ($Value.GetProperty('stdoutBytes')) 0 20971521)
  stderrBytes=(Read-CombinedPrepCount ($Value.GetProperty('stderrBytes')) 0 65537)
  spawnObserved=(Read-CombinedPrepBool ($Value.GetProperty('spawnObserved')))
  stdinFinishObserved=(Read-CombinedPrepBool ($Value.GetProperty('stdinFinishObserved')))
  stdinCallbackSettled=(Read-CombinedPrepBool ($Value.GetProperty('stdinCallbackSettled')))
  stdinError=(Read-CombinedPrepEnum ($Value.GetProperty('stdinError')) @('none','EPIPE','other'))
  stdinCallbackError=(Read-CombinedPrepEnum ($Value.GetProperty('stdinCallbackError')) @('pending','none','EPIPE','other'))
  stdoutEofObserved=(Read-CombinedPrepBool ($Value.GetProperty('stdoutEofObserved')))
  stderrEofObserved=(Read-CombinedPrepBool ($Value.GetProperty('stderrEofObserved')))
  producerExit=(Read-CombinedPrepEnum ($Value.GetProperty('producerExit')) @('not_observed','zero','nonzero'))
  producerClose=(Read-CombinedPrepEnum ($Value.GetProperty('producerClose')) @('not_observed','zero','nonzero'))
  cleanup=(Read-CombinedPrepEnum ($Value.GetProperty('cleanup')) @('not_started','pending','completed','failed'))
 }
 # Both direct trusted B3 call sites now return nominal first-refusal metadata.
 # Neither an orphan diagnostic nor a code without that complete shape passes.
 if (($null -eq $combinedPrepNativeProjection.parserError) -ne ($null -eq $combinedPrepNativeProjection.parserDiagnostic)) { Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED' }
 return $combinedPrepNativeProjection
}

function Read-CombinedPrepArchiveBinding($Value) {
 # Builtin dictionaries only; no caller getter, conversion hook or profile IO.
 if ($null -eq $Value -or $Value.GetType() -notin @([hashtable],[Collections.Specialized.OrderedDictionary])) { Stop-CombinedPrep 'COMBINED_PREP_INPUT_REFUSED' }
 $combinedPrepArchiveKeys = @('path','sha256','cipherBytes','plainBytes')
 if ($Value.Count -ne 4 -or @($Value.Keys | Where-Object { $_ -isnot [string] -or $combinedPrepArchiveKeys -cnotcontains $_ }).Count -ne 0) { Stop-CombinedPrep 'COMBINED_PREP_INPUT_REFUSED' }
 $combinedPrepArchivePath = 'C:\Users\Kauan Sousa Barateli\SegundoCerebro-Operations\archives\second-brain-2026-10-17T01-27-25-163Z-6b65e5f5.scbackup'
 $combinedPrepArchiveHash = '21c0e0eb0b60a123854ec4d10d2bdbf69e1cb922bc2ed2591c89ec422262088a'
 if ($Value['path'] -isnot [string] -or $Value['path'] -cne $combinedPrepArchivePath -or $Value['sha256'] -isnot [string] -or $Value['sha256'] -cne $combinedPrepArchiveHash -or $null -eq $Value['cipherBytes'] -or $Value['cipherBytes'].GetType() -notin @([int],[long]) -or $Value['cipherBytes'] -ne 951230 -or $null -eq $Value['plainBytes'] -or $Value['plainBytes'].GetType() -notin @([int],[long]) -or $Value['plainBytes'] -ne 950017) { Stop-CombinedPrep 'COMBINED_PREP_INPUT_REFUSED' }
 return [ordered]@{path=$combinedPrepArchivePath;sha256=$combinedPrepArchiveHash;cipherBytes=[long]$Value['cipherBytes'];plainBytes=950017L}
}
function Read-CombinedPrepFormat($Value) {
 Assert-CombinedPrepObject $Value @('archiveVersion','intSize','offSize','format','compression')
 return [ordered]@{archiveVersion=(Read-CombinedPrepEnum ($Value.GetProperty('archiveVersion')) @('1.16-0'));intSize=(Read-CombinedPrepCount ($Value.GetProperty('intSize')) 4 4);offSize=(Read-CombinedPrepCount ($Value.GetProperty('offSize')) 8 8);format=(Read-CombinedPrepEnum ($Value.GetProperty('format')) @('CUSTOM'));compression=(Read-CombinedPrepEnum ($Value.GetProperty('compression')) @('GZIP'))}
}
function Read-CombinedPrepToc($Value,[bool]$Source) {
 $combinedPrepTocKeys = @('entries','encoding','tocBytes')
 if ($Source) { $combinedPrepTocKeys += 'preservedEntries' }
 Assert-CombinedPrepObject $Value $combinedPrepTocKeys
 $combinedPrepToc = [ordered]@{entries=(Read-CombinedPrepCount ($Value.GetProperty('entries')) 1 10000);encoding=(Read-CombinedPrepEnum ($Value.GetProperty('encoding')) @('UTF8'));tocBytes=(Read-CombinedPrepCount ($Value.GetProperty('tocBytes')) 12 33554432)}
 if ($Source) { $combinedPrepToc.preservedEntries = Read-CombinedPrepCount ($Value.GetProperty('preservedEntries')) 0 10000; if ($combinedPrepToc.preservedEntries -gt $combinedPrepToc.entries) { Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED' } }
 return $combinedPrepToc
}
function Read-CombinedPrepHistory($Value) {
 Assert-CombinedPrepObject $Value @('authRows','storageRows','stdoutBytes','inputTerminal','transportMode')
 $combinedPrepHistory = [ordered]@{authRows=(Read-CombinedPrepCount ($Value.GetProperty('authRows')) 0 10000);storageRows=(Read-CombinedPrepCount ($Value.GetProperty('storageRows')) 0 10000);stdoutBytes=(Read-CombinedPrepCount ($Value.GetProperty('stdoutBytes')) 1 20971520);inputTerminal=(Read-CombinedPrepEnum ($Value.GetProperty('inputTerminal')) @('finish','selected_tail_unconsumed'));transportMode=(Read-CombinedPrepEnum ($Value.GetProperty('transportMode')) @('native'))}
 if ($combinedPrepHistory.authRows + $combinedPrepHistory.storageRows -gt 10000) { Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED' }
 return $combinedPrepHistory
}
function Read-CombinedPrepSnapshot($Value) {
 Assert-CombinedPrepObject $Value @('version','protocolOnly','nativeOrigin','readonlySnapshot','repeatableRead','actorValidated','rlsBypass','schemas','catalogueRelations','ordinaryTables','emptyDataTables','authHistoryRows','storageHistoryRows','allOtherTableDataEmpty','restoreAccepted')
 $combinedPrepSnapshot = [ordered]@{version=(Read-CombinedPrepCount ($Value.GetProperty('version')) 1 1);schemas=(Read-CombinedPrepCount ($Value.GetProperty('schemas')) 3 3)}
 foreach ($combinedPrepFlag in @('protocolOnly','readonlySnapshot','repeatableRead','actorValidated','rlsBypass','allOtherTableDataEmpty')) { if (-not (Read-CombinedPrepBool ($Value.GetProperty($combinedPrepFlag)))) { Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED' };$combinedPrepSnapshot[$combinedPrepFlag]=$true }
 foreach ($combinedPrepFlag in @('nativeOrigin','restoreAccepted')) { if (Read-CombinedPrepBool ($Value.GetProperty($combinedPrepFlag))) { Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED' };$combinedPrepSnapshot[$combinedPrepFlag]=$false }
 $combinedPrepSnapshot.catalogueRelations = Read-CombinedPrepCount ($Value.GetProperty('catalogueRelations')) 2 1000
 $combinedPrepSnapshot.ordinaryTables = Read-CombinedPrepCount ($Value.GetProperty('ordinaryTables')) 2 1000
 $combinedPrepSnapshot.emptyDataTables = Read-CombinedPrepCount ($Value.GetProperty('emptyDataTables')) 0 998
 $combinedPrepSnapshot.authHistoryRows = Read-CombinedPrepCount ($Value.GetProperty('authHistoryRows')) 0 10000
 $combinedPrepSnapshot.storageHistoryRows = Read-CombinedPrepCount ($Value.GetProperty('storageHistoryRows')) 0 10000
 if ($combinedPrepSnapshot.ordinaryTables -gt $combinedPrepSnapshot.catalogueRelations -or $combinedPrepSnapshot.emptyDataTables -ne $combinedPrepSnapshot.ordinaryTables - 2) { Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED' }
 return $combinedPrepSnapshot
}
function Read-CombinedPrepA2($Value) {
 Assert-CombinedPrepObject $Value @('version','matches','reasons')
 $combinedPrepReasons = @('identity_set_mismatch','dependency_scope_unsupported','dependency_vector_mismatch','section_mismatch','dumper_mismatch','definition_mismatch','drop_statement_mismatch','copy_statement_mismatch','owner_mismatch','tablespace_mismatch','table_access_method_mismatch','relation_kind_mismatch','with_oids_mismatch','auth_history_mismatch','storage_history_mismatch')
 $combinedPrepA2 = [ordered]@{version=(Read-CombinedPrepCount ($Value.GetProperty('version')) 1 1);matches=(Read-CombinedPrepBool ($Value.GetProperty('matches')))}
 $combinedPrepArray = $Value.GetProperty('reasons')
 if ($combinedPrepArray.ValueKind -ne [Text.Json.JsonValueKind]::Array -or $combinedPrepArray.GetArrayLength() -gt 15) { Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED' }
 $combinedPrepPrevious = -1;$combinedPrepReasonProjection=[Collections.Generic.List[string]]::new()
 foreach ($combinedPrepReason in $combinedPrepArray.EnumerateArray()) { $combinedPrepLabel=Read-CombinedPrepEnum $combinedPrepReason $combinedPrepReasons;$combinedPrepIndex=[Array]::IndexOf($combinedPrepReasons,$combinedPrepLabel);if($combinedPrepIndex -le $combinedPrepPrevious){Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED'};$combinedPrepPrevious=$combinedPrepIndex;$combinedPrepReasonProjection.Add($combinedPrepLabel) }
 if ($combinedPrepA2.matches -ne ($combinedPrepReasonProjection.Count -eq 0)) { Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED' }
 $combinedPrepA2.reasons=$combinedPrepReasonProjection.ToArray();return $combinedPrepA2
}
function Read-CombinedPrepComparison($Value,$SourceToc,$TargetToc) {
 Assert-CombinedPrepObject $Value @('version','managed','existingApp','coverage','inspectionOnly','baselineQualified','restoreAccepted')
 $combinedPrepComparison = [ordered]@{version=(Read-CombinedPrepCount ($Value.GetProperty('version')) 1 1);managed=(Read-CombinedPrepA2 ($Value.GetProperty('managed')));existingApp=(Read-CombinedPrepA2 ($Value.GetProperty('existingApp')))}
 if (-not (Read-CombinedPrepBool ($Value.GetProperty('inspectionOnly')))) { Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED' };$combinedPrepComparison.inspectionOnly=$true
 foreach($combinedPrepFlag in @('baselineQualified','restoreAccepted')){if(Read-CombinedPrepBool ($Value.GetProperty($combinedPrepFlag))){Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED'};$combinedPrepComparison[$combinedPrepFlag]=$false}
 $combinedPrepCoverage=$Value.GetProperty('coverage')
 Assert-CombinedPrepObject $combinedPrepCoverage @('sourceEntries','sourcePreservedEntries','targetEntries','targetBaselineEntries','targetStateEntries','targetAppEntries','sourceAppCounterparts','coverageComplete')
 $combinedPrepCounts=[ordered]@{}
 foreach($combinedPrepName in @('sourceEntries','sourcePreservedEntries','targetEntries','targetBaselineEntries','targetStateEntries','targetAppEntries','sourceAppCounterparts')){$combinedPrepCounts[$combinedPrepName]=Read-CombinedPrepCount ($combinedPrepCoverage.GetProperty($combinedPrepName)) 0 10000}
 if(-not (Read-CombinedPrepBool ($combinedPrepCoverage.GetProperty('coverageComplete'))) -or $combinedPrepCounts.sourceEntries -ne $SourceToc.entries -or $combinedPrepCounts.sourcePreservedEntries -ne $SourceToc.preservedEntries -or $combinedPrepCounts.targetEntries -ne $TargetToc.entries -or $combinedPrepCounts.targetBaselineEntries + $combinedPrepCounts.targetStateEntries + $combinedPrepCounts.targetAppEntries -ne $combinedPrepCounts.targetEntries -or $combinedPrepCounts.sourceAppCounterparts -gt $combinedPrepCounts.targetAppEntries -or $combinedPrepCounts.sourcePreservedEntries + $combinedPrepCounts.sourceAppCounterparts -gt $combinedPrepCounts.sourceEntries){Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED'}
 $combinedPrepCounts.coverageComplete=$true;$combinedPrepComparison.coverage=$combinedPrepCounts;return $combinedPrepComparison
}
function Read-CombinedPrepSourceDiagnostic($Value) {
 if($Value.ValueKind -eq [Text.Json.JsonValueKind]::Null){return $null}
 Assert-CombinedPrepObject $Value @('stage','authComplete','listStarted','tocDiagnostic','tocPlanDiagnostic','inventory','nativeHistoryDiagnostic')
 # Original aggregate inventory is deliberately not decoded/forwarded, as in
 # the reviewed History v4 preparation. No private text enters this projection.
 return [ordered]@{stage=(Read-CombinedPrepNullableEnum ($Value.GetProperty('stage')) @('archive_path','temporary_path','directory_acl','copy_ciphertext','ciphertext_acl','cipher_authentication','native_toc','plan','custom_header','custom_toc','native_history','cleanup'));authComplete=(Read-CombinedPrepBool ($Value.GetProperty('authComplete')));listStarted=(Read-CombinedPrepBool ($Value.GetProperty('listStarted')));tocDiagnostic=(Read-CombinedPrepDiagnostic ($Value.GetProperty('tocDiagnostic')) $false);tocPlanDiagnostic=(Read-CombinedPrepDiagnostic ($Value.GetProperty('tocPlanDiagnostic')) $true);nativeHistoryDiagnostic=(Read-CombinedPrepNativeDiagnostic ($Value.GetProperty('nativeHistoryDiagnostic')));inventoryIncluded=$false}
}
function Read-CombinedPrepTargetDiagnostic($Value) {
 if($Value.ValueKind -eq [Text.Json.JsonValueKind]::Null){return $null}
 Assert-CombinedPrepObject $Value @('stage','targetConnectionRequested','nativeTargetDiagnostic','nativeHistoryDiagnostic','tocDiagnostic','tocPlanDiagnostic')
 return [ordered]@{stage=(Read-CombinedPrepNullableEnum ($Value.GetProperty('stage')) @('configuration','temporary_path','directory_acl','target_snapshot','native_toc','plan','custom_toc','cleanup'));targetConnectionRequested=(Read-CombinedPrepBool ($Value.GetProperty('targetConnectionRequested')));nativeTargetDiagnostic=(Read-CombinedPrepSnapshotDiagnostic ($Value.GetProperty('nativeTargetDiagnostic')));nativeHistoryDiagnostic=(Read-CombinedPrepNativeDiagnostic ($Value.GetProperty('nativeHistoryDiagnostic')));tocDiagnostic=(Read-CombinedPrepDiagnostic ($Value.GetProperty('tocDiagnostic')) $false);tocPlanDiagnostic=(Read-CombinedPrepDiagnostic ($Value.GetProperty('tocPlanDiagnostic')) $true)}
}
function Test-CombinedPrepSameFact($Left,$Right) {
 if($null -eq $Left -or $null -eq $Right){return $null -eq $Left -and $null -eq $Right}
 if($Left.Count -ne $Right.Count){return $false}
 foreach($combinedPrepKey in $Left.Keys){if(-not $Right.Contains($combinedPrepKey) -or $Left[$combinedPrepKey] -cne $Right[$combinedPrepKey]){return $false}}
 return $true
}
function Read-CombinedPrepSourceTocSnapshot($Value) {
 Assert-CombinedPrepObject $Value @('sequence','overflow','firstError','lastError','events')
 $combinedPrepEventNames=@('spawnRequested','spawn','spawnThrow','stdinEndRequested','stdinCallback','stdinFinish','stdinError','stdinEndThrow','childError','stdoutError','stderrError','stdoutEOF','stdoutClose','stderrEOF','stderrClose','exit','close','stdinDestroyRequested','stdoutDestroyRequested','stderrDestroyRequested','killRequested','unrefRequested')
 $combinedPrepErrorNames=@('spawnThrow','stdinCallback','stdinError','stdinEndThrow','childError','stdoutError','stderrError')
 $combinedPrepErrorCodes=@('EPIPE','ERR_STREAM_DESTROYED','EOF','other','unavailable')
 $combinedPrepState=[ordered]@{sequence=(Read-CombinedPrepCount ($Value.GetProperty('sequence')) 1 64);overflow=(Read-CombinedPrepBool ($Value.GetProperty('overflow')));firstError=$null;lastError=$null;events=[ordered]@{}}
 if($combinedPrepState.overflow -and $combinedPrepState.sequence -ne 64){Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED'}
 $combinedPrepEvents=$Value.GetProperty('events');Assert-CombinedPrepObject $combinedPrepEvents $combinedPrepEventNames
 $combinedPrepSequences=[Collections.Generic.HashSet[long]]::new()
 foreach($combinedPrepName in $combinedPrepEventNames){
  $combinedPrepEvent=$combinedPrepEvents.GetProperty($combinedPrepName)
  if($combinedPrepEvent.ValueKind -eq [Text.Json.JsonValueKind]::Null){$combinedPrepState.events[$combinedPrepName]=$null;continue}
  $combinedPrepCallback=$combinedPrepName -ceq 'stdinCallback';$combinedPrepError=$combinedPrepErrorNames -ccontains $combinedPrepName;$combinedPrepTerminal=$combinedPrepName -cin @('exit','close')
  $combinedPrepKeys=if($combinedPrepCallback){@('sequence','outcome','code')}elseif($combinedPrepError){@('sequence','code')}elseif($combinedPrepTerminal){@('sequence','code','signal')}else{@('sequence')}
  Assert-CombinedPrepObject $combinedPrepEvent $combinedPrepKeys
  $combinedPrepFact=[ordered]@{sequence=(Read-CombinedPrepCount ($combinedPrepEvent.GetProperty('sequence')) 1 $combinedPrepState.sequence)}
  if(-not $combinedPrepSequences.Add($combinedPrepFact.sequence) -and -not ($combinedPrepState.overflow -and $combinedPrepFact.sequence -eq 64)){Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED'}
  if($combinedPrepCallback){
   $combinedPrepFact.outcome=Read-CombinedPrepEnum ($combinedPrepEvent.GetProperty('outcome')) @('ok','error')
   $combinedPrepFact.code=Read-CombinedPrepEnum ($combinedPrepEvent.GetProperty('code')) @('none','EPIPE','ERR_STREAM_DESTROYED','EOF','other','unavailable')
   if(($combinedPrepFact.outcome -ceq 'ok') -ne ($combinedPrepFact.code -ceq 'none')){Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED'}
  }elseif($combinedPrepError){$combinedPrepFact.code=Read-CombinedPrepEnum ($combinedPrepEvent.GetProperty('code')) $combinedPrepErrorCodes}
  elseif($combinedPrepTerminal){$combinedPrepFact.code=Read-CombinedPrepEnum ($combinedPrepEvent.GetProperty('code')) @('zero','nonzero','unavailable');$combinedPrepFact.signal=Read-CombinedPrepEnum ($combinedPrepEvent.GetProperty('signal')) @('none','SIGKILL','SIGTERM','SIGINT','other')}
  $combinedPrepState.events[$combinedPrepName]=$combinedPrepFact
 }
 if($null -eq $combinedPrepState.events.spawnRequested -or $combinedPrepState.events.spawnRequested.sequence -ne 1){Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED'}
 foreach($combinedPrepWhich in @('firstError','lastError')){
  $combinedPrepError=$Value.GetProperty($combinedPrepWhich)
  if($combinedPrepError.ValueKind -eq [Text.Json.JsonValueKind]::Null){continue}
  Assert-CombinedPrepObject $combinedPrepError @('origin','code','sequence')
  $combinedPrepFact=[ordered]@{origin=(Read-CombinedPrepEnum ($combinedPrepError.GetProperty('origin')) $combinedPrepErrorNames);code=(Read-CombinedPrepEnum ($combinedPrepError.GetProperty('code')) $combinedPrepErrorCodes);sequence=(Read-CombinedPrepCount ($combinedPrepError.GetProperty('sequence')) 1 $combinedPrepState.sequence)}
  $combinedPrepOriginal=$combinedPrepState.events[$combinedPrepFact.origin]
  if($null -eq $combinedPrepOriginal -or $combinedPrepOriginal.sequence -gt $combinedPrepFact.sequence){Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED'}
  if($combinedPrepOriginal.sequence -eq $combinedPrepFact.sequence -and -not ($combinedPrepState.overflow -and $combinedPrepFact.sequence -eq 64)){
   if($combinedPrepOriginal.code -cne $combinedPrepFact.code -or ($combinedPrepFact.origin -ceq 'stdinCallback' -and $combinedPrepOriginal.outcome -cne 'error')){Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED'}
  }
  $combinedPrepState[$combinedPrepWhich]=$combinedPrepFact
 }
 if(($null -eq $combinedPrepState.firstError) -ne ($null -eq $combinedPrepState.lastError)){Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED'}
 foreach($combinedPrepName in $combinedPrepErrorNames){
  $combinedPrepOriginal=$combinedPrepState.events[$combinedPrepName]
  if($null -ne $combinedPrepOriginal -and ($combinedPrepName -cne 'stdinCallback' -or $combinedPrepOriginal.outcome -ceq 'error')){
   if($null -eq $combinedPrepState.firstError -or $combinedPrepOriginal.sequence -lt $combinedPrepState.firstError.sequence -or $combinedPrepOriginal.sequence -gt $combinedPrepState.lastError.sequence){Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED'}
  }
 }
 if($null -ne $combinedPrepState.firstError -and $combinedPrepState.firstError.sequence -gt $combinedPrepState.lastError.sequence){Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED'}
 return $combinedPrepState
}
function Read-CombinedPrepSourceTocDiagnostic($Value) {
 if($Value.ValueKind -eq [Text.Json.JsonValueKind]::Null){return $null}
 Assert-CombinedPrepObject $Value @('version','observer','firstRefusal','finalCleanup')
 $combinedPrepDiagnostic=[ordered]@{version=(Read-CombinedPrepCount ($Value.GetProperty('version')) 1 1);observer=(Read-CombinedPrepEnum ($Value.GetProperty('observer')) @('source_toc_original'));firstRefusal=$null;finalCleanup=(Read-CombinedPrepSourceTocSnapshot ($Value.GetProperty('finalCleanup')))}
 $combinedPrepRefusal=$Value.GetProperty('firstRefusal')
 # A successful Source followed by a later phase refusal legitimately has no
 # SourceTOC refusal. This is the full wire reader, not the narrow failure API.
 if($combinedPrepRefusal.ValueKind -eq [Text.Json.JsonValueKind]::Null){return $combinedPrepDiagnostic}
 Assert-CombinedPrepObject $combinedPrepRefusal @('code','state')
 $combinedPrepDiagnostic.firstRefusal=[ordered]@{code=(Read-CombinedPrepEnum ($combinedPrepRefusal.GetProperty('code')) @('INSPECTION_NATIVE_UNAVAILABLE','INSPECTION_NATIVE_FAILED','INSPECTION_INPUT_FAILED','INSPECTION_TIMEOUT','INSPECTION_LIMIT','INSPECTION_TOC_INVALID','INSPECTION_UNAVAILABLE'));state=(Read-CombinedPrepSourceTocSnapshot ($combinedPrepRefusal.GetProperty('state')))}
 $combinedPrepFirst=$combinedPrepDiagnostic.firstRefusal.state;$combinedPrepFinal=$combinedPrepDiagnostic.finalCleanup
 if($combinedPrepFirst.sequence -gt $combinedPrepFinal.sequence -or ($combinedPrepFirst.overflow -and -not $combinedPrepFinal.overflow)){Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED'}
 foreach($combinedPrepName in $combinedPrepFirst.events.Keys){
  $combinedPrepBefore=$combinedPrepFirst.events[$combinedPrepName];$combinedPrepAfter=$combinedPrepFinal.events[$combinedPrepName]
  if($null -ne $combinedPrepBefore){if(-not (Test-CombinedPrepSameFact $combinedPrepBefore $combinedPrepAfter)){Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED'}}
  elseif($null -ne $combinedPrepAfter -and -not ($combinedPrepAfter.sequence -gt $combinedPrepFirst.sequence -or ($combinedPrepAfter.sequence -eq 64 -and $combinedPrepFirst.sequence -eq 64 -and $combinedPrepFinal.overflow))){Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED'}
 }
 if($null -ne $combinedPrepFirst.firstError){if(-not (Test-CombinedPrepSameFact $combinedPrepFirst.firstError $combinedPrepFinal.firstError)){Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED'}}
 elseif($null -ne $combinedPrepFinal.firstError -and -not ($combinedPrepFinal.firstError.sequence -gt $combinedPrepFirst.sequence -or ($combinedPrepFinal.firstError.sequence -eq 64 -and $combinedPrepFirst.sequence -eq 64 -and $combinedPrepFinal.overflow))){Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED'}
 if(-not (Test-CombinedPrepSameFact $combinedPrepFirst.lastError $combinedPrepFinal.lastError)){
  if($null -eq $combinedPrepFinal.lastError -or -not ($combinedPrepFinal.lastError.sequence -gt $combinedPrepFirst.sequence -or ($combinedPrepFinal.lastError.sequence -eq 64 -and $combinedPrepFirst.sequence -eq 64 -and $combinedPrepFinal.overflow))){Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED'}
 }
 return $combinedPrepDiagnostic
}

function Read-CombinedPrepCodes { return @('BACKUP_AUTHENTICATION_FAILED','BACKUP_IDENTITY_MISMATCH','BACKUP_KEY_MUST_BE_INDEPENDENT','BACKUP_KEY_REQUIRED','ENTRY_HASH_MISMATCH','INCOMPLETE_BACKUP','INSPECTION_CLEANUP_FAILED','INSPECTION_INPUT_FAILED','INSPECTION_LIMIT','INSPECTION_NATIVE_FAILED','INSPECTION_NATIVE_UNAVAILABLE','INSPECTION_PATH_REFUSED','INSPECTION_PRIVATE_PATH_REFUSED','INSPECTION_SNAPSHOT_CHANGED','INSPECTION_TIMEOUT','INSPECTION_TOC_INVALID','INSPECTION_UNAVAILABLE','INVALID_ARGUMENTS','INVALID_BACKUP','INVALID_ENTRY','INVALID_FRAME','INVALID_HEADER','INVALID_ORDER','ISOLATED_RESTORE_TARGET_REQUIRED','ISOLATED_STORAGE_CONFIGURATION_REQUIRED','MANIFEST_MISMATCH','MISSING_MANIFEST','PERSONAL_POSTGRES_CONFIGURATION_REQUIRED','RESTORE_ABSOLUTE_EXECUTABLES_REQUIRED','RESTORE_CUSTOM_HEADER_INPUT_INVALID','RESTORE_CUSTOM_HEADER_LIMIT_EXCEEDED','RESTORE_CUSTOM_HEADER_TRUNCATED','RESTORE_CUSTOM_HEADER_UNSUPPORTED','RESTORE_CUSTOM_TOC_BINDING_INVALID','RESTORE_CUSTOM_TOC_DISCARDED','RESTORE_CUSTOM_TOC_FORMAT_UNSUPPORTED','RESTORE_CUSTOM_TOC_INPUT_INVALID','RESTORE_CUSTOM_TOC_INSPECTION_REQUIRED','RESTORE_CUSTOM_TOC_INVALID','RESTORE_CUSTOM_TOC_LIMIT_EXCEEDED','RESTORE_CUSTOM_TOC_PLAN_MISMATCH','RESTORE_CUSTOM_TOC_PLAN_REQUIRED','RESTORE_CUSTOM_TOC_REQUIRED','RESTORE_CUSTOM_TOC_TARGET_REQUIRED','RESTORE_CUSTOM_TOC_TRUNCATED','RESTORE_INSPECTED_BASELINE_AMBIGUOUS','RESTORE_INSPECTED_BASELINE_BINDING_INVALID','RESTORE_INSPECTED_BASELINE_LIMIT_EXCEEDED','RESTORE_INSPECTED_BASELINE_REQUIRED','RESTORE_INSPECTED_BASELINE_SCOPE_UNSUPPORTED','RESTORE_MANAGED_BASELINE_GRAPH_INVALID','RESTORE_MANAGED_BASELINE_INPUT_INVALID','RESTORE_MANAGED_BASELINE_LIMIT_EXCEEDED','RESTORE_MANAGED_BINDING_INVALID','RESTORE_MANAGED_CUSTOM_INVALID','RESTORE_MANAGED_DATABASE_INVALID','RESTORE_MANAGED_TARGET_BASELINE_INVALID','RESTORE_MANAGED_TARGET_BINDING_INVALID','RESTORE_MANAGED_TARGET_INSPECTION_REQUIRED','RESTORE_MANAGED_TARGET_INSPECTION_UNSUPPORTED','RESTORE_MANAGED_TARGET_SCOPE_UNSUPPORTED','RESTORE_MIGRATION_HISTORY_NATIVE_BINDING_INVALID','RESTORE_MIGRATION_HISTORY_NATIVE_CLEANUP_FAILED','RESTORE_MIGRATION_HISTORY_NATIVE_DISCARDED','RESTORE_MIGRATION_HISTORY_NATIVE_INPUT_FAILED','RESTORE_MIGRATION_HISTORY_NATIVE_INPUT_INVALID','RESTORE_MIGRATION_HISTORY_NATIVE_LIST_FAILED','RESTORE_MIGRATION_HISTORY_NATIVE_OUTPUT_LIMIT','RESTORE_MIGRATION_HISTORY_NATIVE_PARSER_REFUSED','RESTORE_MIGRATION_HISTORY_NATIVE_PRODUCER_FAILED','RESTORE_MIGRATION_HISTORY_NATIVE_REQUIRED','RESTORE_MIGRATION_HISTORY_NATIVE_SPAWN_FAILED','RESTORE_MIGRATION_HISTORY_NATIVE_TIMEOUT','RESTORE_MIGRATION_HISTORY_NATIVE_TOC_REFUSED','RESTORE_MIGRATION_HISTORY_NATIVE_UNAVAILABLE','RESTORE_TARGET_SNAPSHOT_NATIVE_COPY_CLAIMED','RESTORE_TARGET_SNAPSHOT_NATIVE_DISCARDED','RESTORE_TARGET_SNAPSHOT_NATIVE_INPUT_FAILED','RESTORE_TARGET_SNAPSHOT_NATIVE_INPUT_INVALID','RESTORE_TARGET_SNAPSHOT_NATIVE_INTEGRITY_FAILED','RESTORE_TARGET_SNAPSHOT_NATIVE_OUTPUT_LIMIT','RESTORE_TARGET_SNAPSHOT_NATIVE_PRODUCER_FAILED','RESTORE_TARGET_SNAPSHOT_NATIVE_PROTOCOL_REFUSED','RESTORE_TARGET_SNAPSHOT_NATIVE_REQUIRED','RESTORE_TARGET_SNAPSHOT_NATIVE_RUNTIME_REFUSED','RESTORE_TARGET_SNAPSHOT_NATIVE_SPAWN_FAILED','RESTORE_TARGET_SNAPSHOT_NATIVE_TARGET_REFUSED','RESTORE_TARGET_SNAPSHOT_NATIVE_TIMEOUT','RESTORE_TOC_DEPENDENCY_INVALID','RESTORE_TOC_INVALID','RESTORE_TOC_UNSUPPORTED','TRAILING_DATA','TRUNCATED_BACKUP','UNSAFE_BACKUP_DESTINATION') }
function Read-CombinedPrepWire([object]$Bytes,[int]$NativeExitCode) {
 $combinedPrepWireDocument=$null
 try {
  if($null -eq $Bytes -or $Bytes.GetType() -ne [byte[]] -or $Bytes.Length -lt 1 -or $Bytes.Length -gt 65536){Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED'}
  $combinedPrepWireText=[Text.UTF8Encoding]::new($false,$true).GetString($Bytes)
  $combinedPrepWireDocument=[Text.Json.JsonDocument]::Parse($combinedPrepWireText)
  return Read-CombinedPrepProjection $combinedPrepWireDocument.RootElement $NativeExitCode
 }catch{
  if($_.Exception.Message -cin @('COMBINED_PREP_PROTOCOL_REFUSED','COMBINED_PREP_NATIVE_REFUSED')){throw}
  Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED'
 }finally{if($null -ne $combinedPrepWireDocument){$combinedPrepWireDocument.Dispose()}}
}
function Read-CombinedPrepProjection($Value,[int]$NativeExitCode) {
 Assert-CombinedPrepUniqueJson $Value
 if($Value.ValueKind -ne [Text.Json.JsonValueKind]::Object){Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED'}
 $combinedPrepOk=Read-CombinedPrepBool ($Value.GetProperty('ok'))
 if($combinedPrepOk){
  if($NativeExitCode -ne 0){Stop-CombinedPrep 'COMBINED_PREP_NATIVE_REFUSED'}
  Assert-CombinedPrepObject $Value @('ok','operation','authenticatedSource','transportMode','source','target','comparison','comparisonCompleted','targetQueried','inspectionOnly','baselineQualified','baselineCompared','remoteMutation','restoreAccepted')
  $combinedPrepProjection=[ordered]@{ok=$true;operation=(Read-CombinedPrepEnum ($Value.GetProperty('operation')) @('managed_restore_combined_baseline_inspect'));transportMode=(Read-CombinedPrepEnum ($Value.GetProperty('transportMode')) @('native'))}
  foreach($combinedPrepFlag in @('authenticatedSource','comparisonCompleted','targetQueried','inspectionOnly','baselineCompared')){if(-not (Read-CombinedPrepBool ($Value.GetProperty($combinedPrepFlag)))){Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED'};$combinedPrepProjection[$combinedPrepFlag]=$true}
  $combinedPrepSource=$Value.GetProperty('source');Assert-CombinedPrepObject $combinedPrepSource @('format','customToc','migrationHistory')
  $combinedPrepSourceProjection=[ordered]@{format=(Read-CombinedPrepFormat ($combinedPrepSource.GetProperty('format')));customToc=(Read-CombinedPrepToc ($combinedPrepSource.GetProperty('customToc')) $true);migrationHistory=(Read-CombinedPrepHistory ($combinedPrepSource.GetProperty('migrationHistory')))}
  $combinedPrepTarget=$Value.GetProperty('target');Assert-CombinedPrepObject $combinedPrepTarget @('format','customToc','snapshot','migrationHistory')
  $combinedPrepTargetProjection=[ordered]@{format=(Read-CombinedPrepFormat ($combinedPrepTarget.GetProperty('format')));customToc=(Read-CombinedPrepToc ($combinedPrepTarget.GetProperty('customToc')) $false);snapshot=(Read-CombinedPrepSnapshot ($combinedPrepTarget.GetProperty('snapshot')));migrationHistory=(Read-CombinedPrepHistory ($combinedPrepTarget.GetProperty('migrationHistory')))}
  if($combinedPrepTargetProjection.snapshot.authHistoryRows -ne $combinedPrepTargetProjection.migrationHistory.authRows -or $combinedPrepTargetProjection.snapshot.storageHistoryRows -ne $combinedPrepTargetProjection.migrationHistory.storageRows){Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED'}
  $combinedPrepProjection.source=$combinedPrepSourceProjection;$combinedPrepProjection.target=$combinedPrepTargetProjection
  $combinedPrepProjection.comparison=Read-CombinedPrepComparison ($Value.GetProperty('comparison')) $combinedPrepSourceProjection.customToc $combinedPrepTargetProjection.customToc
 }else{
  if($NativeExitCode -ne 1){Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED'}
  if($Value.GetProperty('operation').GetString() -ceq 'operator'){Assert-CombinedPrepObject $Value @('ok','operation','error');return [ordered]@{ok=$false;operation='operator';error=(Read-CombinedPrepEnum ($Value.GetProperty('error')) @('OPERATOR_SETUP_FAILED'))}}
  Assert-CombinedPrepObject $Value @('ok','operation','error','stage','sourceDiagnostic','targetDiagnostic','nativeHistoryDiagnostic','sourceTocDiagnostic','comparisonCompleted','inspectionOnly','baselineQualified','baselineCompared','remoteMutation','restoreAccepted')
  $combinedPrepProjection=[ordered]@{ok=$false;operation=(Read-CombinedPrepEnum ($Value.GetProperty('operation')) @('managed_restore_combined_baseline_inspect'));error=(Read-CombinedPrepEnum ($Value.GetProperty('error')) (Read-CombinedPrepCodes));stage=(Read-CombinedPrepNullableEnum ($Value.GetProperty('stage')) @('configuration','source','target','target_history','comparison','cleanup'));sourceDiagnostic=(Read-CombinedPrepSourceDiagnostic ($Value.GetProperty('sourceDiagnostic')));targetDiagnostic=(Read-CombinedPrepTargetDiagnostic ($Value.GetProperty('targetDiagnostic')));nativeHistoryDiagnostic=(Read-CombinedPrepNativeDiagnostic ($Value.GetProperty('nativeHistoryDiagnostic')));sourceTocDiagnostic=(Read-CombinedPrepSourceTocDiagnostic ($Value.GetProperty('sourceTocDiagnostic')))}
  foreach($combinedPrepFlag in @('comparisonCompleted','baselineCompared')){if(Read-CombinedPrepBool ($Value.GetProperty($combinedPrepFlag))){Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED'};$combinedPrepProjection[$combinedPrepFlag]=$false}
  if(-not (Read-CombinedPrepBool ($Value.GetProperty('inspectionOnly')))){Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED'};$combinedPrepProjection.inspectionOnly=$true
 }
 foreach($combinedPrepFlag in @('baselineQualified','remoteMutation','restoreAccepted')){if(Read-CombinedPrepBool ($Value.GetProperty($combinedPrepFlag))){Stop-CombinedPrep 'COMBINED_PREP_PROTOCOL_REFUSED'};$combinedPrepProjection[$combinedPrepFlag]=$false}
 return $combinedPrepProjection
}

try {
 if (-not $IsWindows -or $PSVersionTable.PSVersion.Major -ne 7) { Stop-CombinedPrep 'COMBINED_PREP_PLATFORM_REFUSED' }
 if ($ReviewedCommit -isnot [string] -or $ReviewedCommit -cne '6784b9e8f5b27abb664ec0b4f17b96bbffe31b1d' -or $SelfSha256 -notmatch '^[a-fA-F0-9]{64}$') { Stop-CombinedPrep 'COMBINED_PREP_INPUT_REFUSED' }
 $combinedPrepBoundArchive = Read-CombinedPrepArchiveBinding $ArchiveBinding
 $combinedPrepRepo = 'C:\Users\Kauan Sousa Barateli\Documents\Codex\2026-10-07\inicie-a-constru-o-do-software-2\work\Segundo-Cerebro-restore-eof-source-6784b9e'
 $combinedPrepSelf = 'C:\Users\Kauan Sousa Barateli\Documents\Codex\2026-10-07\inicie-a-constru-o-do-software-2\work\Segundo-Cerebro\work\ci-capture-write-20261021\restore-readonly-eof-prep-20261022\inspect-combined-baseline-preparacao-20261022-v2.ps1'
 if (-not $PSCommandPath.Equals($combinedPrepSelf,[StringComparison]::OrdinalIgnoreCase)) { Stop-CombinedPrep 'COMBINED_PREP_PATH_REFUSED' }
 Open-CombinedPrepPin $combinedPrepSelf -1 $SelfSha256
 $combinedPrepGit = (@(Get-Command git -CommandType Application -ErrorAction Stop)[0]).Source
 if ($combinedPrepGit -isnot [string] -or [string]::IsNullOrWhiteSpace($combinedPrepGit)) { Stop-CombinedPrep 'COMBINED_PREP_GIT_REFUSED' }
 Assert-CombinedPrepRegularPath $combinedPrepGit
 $combinedPrepSources = @(
  @('scripts/operations/run-operator.ps1',6261,'C87851A30AAB63875F62A7E60C6206675728648B4C87E5569240468C55D753AC'),
  @('scripts/operations/restore-managed-inspect.mjs',53685,'9AED1C8F138C96407864F27DE4905E0A1588BA061EEB2A398C3FAC08919D3ED7'),
  @('scripts/operations/backup-format.mjs',10581,'AE711C39EF31660CBDDC50081290C53B57CCE8FE6361E8A5E7846EDD0696AC74'),
  @('scripts/operations/backup-config.mjs',4347,'BB0F9276180C26E9D07253631B233AD8EF9AEAD7CCA07ABDB01D9F0E4C567D78'),
  @('scripts/operations/restore-target.mjs',11357,'F29BD0B5D23F78EDE190C6B85CD467E87DC0048E7172E8C8F686771DF49B4AA0'),
  @('scripts/operations/postgres-process.mjs',5359,'D210AB110390EC8CD14DF2189346F0EEEE1DF3CCD03D13E6476AA00E51991464'),
  @('scripts/operations/backup-sources.mjs',8865,'0533CDBABD16AB168B9F7CA5F23E1E7DDB878104D3230A28825452D085D9246D'),
  @('scripts/operations/restore-managed-plan.mjs',37847,'AE541AF507F58055F50D1CAEFDA09B7409EA872D443ABDA58793744B7BD72B85'),
  @('scripts/operations/restore-custom-header.mjs',3892,'3C1BB314D71CA6FB1240B2E2EBBAB8544D92E46975D66F67FE0CBA3CF63DCB12'),
  @('scripts/operations/restore-custom-toc.mjs',21136,'FF98AC6AC8DE277E459F724D7D54A70D2F0790A57189E62F2FA88C16C4C218A8'),
  @('scripts/operations/restore-migration-history.mjs',26819,'3393E97D8C752DB1077ABCA8C071934DFC9D004666A90B79E7FC50C4FA8D6C72'),
  @('scripts/operations/restore-migration-history-native.mjs',32730,'B251FFA6B49E7E63C3E0836D957DD03CF78FFD37C5C80C7EBDCA0F0F90329BE9'),
  @('scripts/operations/restore-native-binary-output.mjs',23068,'CC8534E1600807A083DFE2F294E26AB39052F2092CEF5EA3FAF889AF67EA981D'),
  @('scripts/operations/restore-managed-native-adapters.mjs',18151,'C8758D6A4B42278784E82EDB0EE2250CF4D5CB9D684F635BE6E4F86311E1EF52'),
  @('scripts/operations/restore-managed-validation-sql.mjs',63650,'9A1786375A22127E4AF1D476FF89C9FB4F99DF97E46AA019549CA8A74004710A'),
  @('scripts/operations/restore-target-snapshot-protocol.mjs',16268,'7A56531CB62BC17973A0472584D27B3EC04B28BE2B246EC8174334381D15CD65'),
  @('scripts/operations/restore-target-snapshot-native.mjs',18155,'93B34FD34BB161684EB818CD4F8EDE53B5633A80A709E789555E7980876F0D4A'),
  @('scripts/operations/restore-managed-baseline.mjs',14785,'B3E1C1DF6A8AF7C9ED8B51F7244C56BA7C45DACD2100AB4331812FE6B1E911E0'),
  @('scripts/operations/restore-inspected-baseline.mjs',12053,'5AD64F4BC5BCF15DAAB3E0E180A3288A693A52E25CB7583419C8E7F79104B66A')
 )
 $combinedPrepSourcePaths = @($combinedPrepSources | ForEach-Object { $_[0] })
 Assert-CombinedPrepGit
 foreach ($combinedPrepSource in $combinedPrepSources) { Open-CombinedPrepPin (Join-Path $combinedPrepRepo $combinedPrepSource[0]) $combinedPrepSource[1] $combinedPrepSource[2] }
 $combinedPrepNode = 'C:\Users\Kauan Sousa Barateli\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
 $combinedPrepPwsh = 'C:\Users\Kauan Sousa Barateli\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe'
 Open-CombinedPrepPin $combinedPrepNode 92825416 '3602F2BB1A10F2CBAB4C36886218A33C1AB3DB87290E73B033C46C77147D0237'
 Open-CombinedPrepPin $combinedPrepPwsh 301368 '362A356CE7F0940EC74F73A8FC2C990A2CC24A38A11C90BBD8ECA947110AD139'
 Open-CombinedPrepPin 'C:\Program Files\PostgreSQL\18\bin\pg_restore.exe' 379392 'E07BDB23F2D2A7E4D2DB7A50386CD43049F4216540FA18E2FAF79B80AB43AC18'
 Open-CombinedPrepPin 'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe' 632320 '46C8AD2E487FA01BB5401AE3B383C09E20789EFDD3A37C6940975647EB1FF574'
 Open-CombinedPrepPin 'C:\Program Files\PostgreSQL\17\bin\psql.exe' 635392 'C290C7F0A3335F290F8C18011A1E5AFA03EE3CDD628697A5F3E767E5F1D3D10D'
 # The materializer derives exactly this PS5 helper from SystemRoot. Bind both
 # the environment and executable rather than pinning an unused alternative.
 $combinedPrepSystemRoot = 'C:\WINDOWS'
 if (-not $combinedPrepSystemRoot.Equals([Environment]::GetEnvironmentVariable('SystemRoot','Process'),[StringComparison]::OrdinalIgnoreCase)) { Stop-CombinedPrep 'COMBINED_PREP_PLATFORM_REFUSED' }
 Open-CombinedPrepPin (Join-Path $combinedPrepSystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') 495616 '60C9B29843624DD8AF6B6A7B26147753BE6AEEF65098B9A503CC50850AFE410F'
 Assert-CombinedPrepGit
 # Private files are not opened until all public review/commit/runtime gates pass.
 # Hashing does not deserialize the profile or print private content.
 $combinedPrepProfile = 'C:\Users\Kauan Sousa Barateli\SegundoCerebro-Operations\profiles\restore-target-pg18-20261012-v2.xml'
 Open-CombinedPrepPin $combinedPrepProfile 3901 'E2CD837487821DD266D5F87223B5D65C56DD4CE0029CC52FE1DD71644EED740B'
 Open-CombinedPrepPin 'C:\Users\Kauan Sousa Barateli\SegundoCerebro-Operations\certificates\prod-ca-2021.crt' -1 '700723581420DD1AC98FD7E9AC529F0EF210EADCAF87FC868A3AD7D114C2F3B7'
 Open-CombinedPrepPin $combinedPrepBoundArchive.path $combinedPrepBoundArchive.cipherBytes $combinedPrepBoundArchive.sha256
 Assert-CombinedPrepGit
 $combinedPrepStart = [Diagnostics.ProcessStartInfo]::new()
 $combinedPrepStart.FileName = $combinedPrepPwsh
 $combinedPrepStart.WorkingDirectory = $combinedPrepRepo
 $combinedPrepStart.UseShellExecute = $false
 $combinedPrepStart.CreateNoWindow = $true
 $combinedPrepStart.RedirectStandardOutput = $true
 $combinedPrepStart.RedirectStandardError = $true
 $combinedPrepStart.Environment.Clear()
 foreach ($combinedPrepEnvName in @('SystemRoot','WINDIR','SystemDrive','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','OneDrive','OneDriveConsumer','OneDriveCommercial')) {
  $combinedPrepEnvValue = [Environment]::GetEnvironmentVariable($combinedPrepEnvName,'Process')
  if ($null -ne $combinedPrepEnvValue) { $combinedPrepStart.Environment[$combinedPrepEnvName] = $combinedPrepEnvValue }
 }
 # No NODE_OPTIONS/NODE_PATH, inherited PG credentials or unrelated MCP tokens.
 $combinedPrepStart.Environment['PATH'] = Join-Path ([Environment]::GetEnvironmentVariable('SystemRoot','Process')) 'System32'
 $combinedPrepStart.Environment['PATHEXT'] = '.EXE'
 foreach ($combinedPrepArgument in @('-NoLogo','-NoProfile','-NonInteractive','-File',(Join-Path $combinedPrepRepo 'scripts\operations\run-operator.ps1'),'-Operation','restore-inspect-baseline','-ProfilePath',$combinedPrepProfile,'-NodePath',$combinedPrepNode,'-Archive',$combinedPrepBoundArchive.path)) { $combinedPrepStart.ArgumentList.Add($combinedPrepArgument) }
 Assert-CombinedPrepDeadline
 $combinedPrepProcess = [Diagnostics.Process]::new()
 $combinedPrepProcess.StartInfo = $combinedPrepStart
 if (-not $combinedPrepProcess.Start()) { Stop-CombinedPrep 'COMBINED_PREP_PROCESS_UNAVAILABLE' }
 $combinedPrepOutDone = $false; $combinedPrepErrDone = $false
 $combinedPrepOutRead = $combinedPrepProcess.StandardOutput.BaseStream.ReadAsync($combinedPrepOutBuffer,0,$combinedPrepOutBuffer.Length)
 $combinedPrepErrRead = $combinedPrepProcess.StandardError.BaseStream.ReadAsync($combinedPrepErrBuffer,0,$combinedPrepErrBuffer.Length)
 while (-not $combinedPrepOutDone -or -not $combinedPrepErrDone -or -not $combinedPrepProcess.HasExited) {
  Assert-CombinedPrepDeadline
  if (-not $combinedPrepOutDone -and $combinedPrepOutRead.IsCompleted) {
   $combinedPrepReadCount = $combinedPrepOutRead.GetAwaiter().GetResult()
   if ($combinedPrepReadCount -eq 0) { $combinedPrepOutDone = $true } else {
    if ($combinedPrepOutput.Length + $combinedPrepReadCount -gt 65536) { Stop-CombinedPrep 'COMBINED_PREP_OUTPUT_LIMIT' }
    $combinedPrepOutput.Write($combinedPrepOutBuffer,0,$combinedPrepReadCount)
    [Array]::Clear($combinedPrepOutBuffer,0,$combinedPrepOutBuffer.Length)
    $combinedPrepOutRead = $combinedPrepProcess.StandardOutput.BaseStream.ReadAsync($combinedPrepOutBuffer,0,$combinedPrepOutBuffer.Length)
   }
  }
  if (-not $combinedPrepErrDone -and $combinedPrepErrRead.IsCompleted) {
   $combinedPrepReadCount = $combinedPrepErrRead.GetAwaiter().GetResult()
   [Array]::Clear($combinedPrepErrBuffer,0,$combinedPrepErrBuffer.Length)
   if ($combinedPrepReadCount -eq 0) { $combinedPrepErrDone = $true } else { $combinedPrepErrRead = $combinedPrepProcess.StandardError.BaseStream.ReadAsync($combinedPrepErrBuffer,0,$combinedPrepErrBuffer.Length) }
  }
  [Threading.Thread]::Sleep(10)
 }
 # Qualification requires BOTH original stream EOFs and original process exit.
 # A timeout or Kill request never enters this branch or certifies cleanup.
 Assert-CombinedPrepDeadline
 Assert-CombinedPrepGit
 $combinedPrepBytes = $combinedPrepOutput.ToArray()
 $combinedPrepProjection = Read-CombinedPrepWire $combinedPrepBytes $combinedPrepProcess.ExitCode
 if ($combinedPrepProjection.ok) { Assert-CombinedPrepDeadline }
 if ($combinedPrepProcess.ExitCode -eq 0 -and $combinedPrepProjection.ok) {
  $combinedPrepResult = [ordered]@{ok=$true;operation='restore_inspect_combined_baseline_preparation';reviewedCommit=$ReviewedCommit;reviewedTree='db5540fa35ddcb344a364f675fcc9a404391863b';inspectionOnly=$true;remoteMutation=$false;restoreAccepted=$false;result=$combinedPrepProjection}
  $combinedPrepExit = 0
 } else {
  $combinedPrepResult = [ordered]@{ok=$false;operation='restore_inspect_combined_baseline_preparation';error='COMBINED_PREP_NATIVE_REFUSED';reviewedCommit=$ReviewedCommit;reviewedTree='db5540fa35ddcb344a364f675fcc9a404391863b';inspectionOnly=$true;remoteMutation=$false;restoreAccepted=$false;diagnostic=$combinedPrepProjection}
 }
} catch {
 $combinedPrepCode = if ($_.Exception.Message -cin $combinedPrepCodes) { $_.Exception.Message } else { 'COMBINED_PREP_UNAVAILABLE' }
 $combinedPrepResult = [ordered]@{ok=$false;operation='restore_inspect_combined_baseline_preparation';error=$combinedPrepCode;inspectionOnly=$true;remoteMutation=$false;restoreAccepted=$false}
} finally {
 if ($null -ne $combinedPrepProcess) {
  try { if (-not $combinedPrepProcess.HasExited) { $combinedPrepProcess.Kill($true) } } catch { }
  # This is a cancellation request only. Do not wait, infer EOF or claim cleanup.
  try { $combinedPrepProcess.Dispose() } catch { }
 }
 if ($null -ne $combinedPrepDocument) { $combinedPrepDocument.Dispose() }
 if ($null -ne $combinedPrepBytes) { [Array]::Clear($combinedPrepBytes,0,$combinedPrepBytes.Length) }
 [Array]::Clear($combinedPrepOutBuffer,0,$combinedPrepOutBuffer.Length)
 [Array]::Clear($combinedPrepErrBuffer,0,$combinedPrepErrBuffer.Length)
 try { $combinedPrepStore = $combinedPrepOutput.GetBuffer(); [Array]::Clear($combinedPrepStore,0,$combinedPrepStore.Length) } catch { }
 $combinedPrepOutput.Dispose()
 foreach ($combinedPrepLease in $combinedPrepLeases) { try { $combinedPrepLease.Dispose() } catch { } }
 $combinedPrepLeases.Clear()
 # Cleanup and JSON projection cannot extend the original cooperative cap.
 # Preserve an existing refusal; only a would-be late success becomes timeout.
 if ($combinedPrepExit -eq 0 -and $combinedPrepWatch.ElapsedMilliseconds -ge 90000) {
  $combinedPrepResult = [ordered]@{ok=$false;operation='restore_inspect_combined_baseline_preparation';error='COMBINED_PREP_TIMEOUT';inspectionOnly=$true;remoteMutation=$false;restoreAccepted=$false}
  $combinedPrepExit = 1
 }
 $combinedPrepWatch.Stop()
}
Write-Output ($combinedPrepResult | ConvertTo-Json -Depth 12 -Compress)
exit $combinedPrepExit
