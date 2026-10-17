# Public preparation for ONE NEW create. No restore or combined verify.
# Gate false returns before files/private metadata/processes. The old window
# is CLOSED. The existing key/profile/USB are never regenerated or recopied.
[CmdletBinding()]
param(
 [bool]$GateExecute = $false,
 [object]$ReviewedCommit = $null,
 [string]$SelfSha256 = '',
 [bool]$NewQuiescenceDeclared = $false
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (-not $GateExecute) {
 Write-Output '{"ok":true,"operation":"new_backup_create_preparation","gateExecute":false,"remoteExecuted":false,"backupQualified":false}'
 exit 0
}
$backupPrepCodes = @('BACKUP_PREP_INPUT_REFUSED','BACKUP_PREP_PLATFORM_REFUSED','BACKUP_PREP_PATH_REFUSED','BACKUP_PREP_PIN_REFUSED','BACKUP_PREP_GIT_REFUSED','BACKUP_PREP_SOURCE_DIRTY','BACKUP_PREP_QUIESCENCE_REQUIRED','BACKUP_PREP_TRANSPORT_UNREVIEWED','BACKUP_PREP_PRIVATE_PATH_REFUSED','BACKUP_PREP_TIMEOUT_INDETERMINATE','BACKUP_PREP_PROCESS_UNAVAILABLE','BACKUP_PREP_OUTPUT_LIMIT','BACKUP_PREP_PROTOCOL_REFUSED','BACKUP_PREP_NATIVE_REFUSED','BACKUP_PREP_UNAVAILABLE')
$backupPrepLeases = [Collections.Generic.List[IO.FileStream]]::new()
$backupPrepWatch = [Diagnostics.Stopwatch]::StartNew()
$backupPrepProcess = $null
$backupPrepDocument = $null
$backupPrepBytes = $null
$backupPrepOutput = [IO.MemoryStream]::new()
$backupPrepOutBuffer = [byte[]]::new(4096)
$backupPrepErrBuffer = [byte[]]::new(4096)
$backupPrepResult = $null
$backupPrepExit = 1
# Root reviewed the strict pgDumpSource patch at the two exact pins below,
# with its own 36 tests/lint. This is source review, not connected acceptance.
$backupPrepTransportReviewed = $true
function Stop-BackupPrep([string]$Code) { throw $Code }
function Assert-BackupPrepDeadline {
 if ($backupPrepWatch.ElapsedMilliseconds -ge 600000) { Stop-BackupPrep 'BACKUP_PREP_TIMEOUT_INDETERMINATE' }
}
function Assert-BackupPrepRegularPath([string]$Path) {
 if (-not [IO.Path]::IsPathFullyQualified($Path) -or $Path.StartsWith('\\') -or $Path.Contains('~')) { Stop-BackupPrep 'BACKUP_PREP_PATH_REFUSED' }
 $backupPrepItem = Get-Item -LiteralPath $Path -Force
 if ($backupPrepItem.PSIsContainer -or -not $backupPrepItem.FullName.Equals([IO.Path]::GetFullPath($Path),[StringComparison]::OrdinalIgnoreCase)) { Stop-BackupPrep 'BACKUP_PREP_PATH_REFUSED' }
 $backupPrepAncestor = $backupPrepItem
 while ($null -ne $backupPrepAncestor) {
  if (($backupPrepAncestor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { Stop-BackupPrep 'BACKUP_PREP_PATH_REFUSED' }
  if ($backupPrepAncestor -is [IO.FileInfo]) { $backupPrepAncestor = $backupPrepAncestor.Directory } else { $backupPrepAncestor = $backupPrepAncestor.Parent }
 }
}
function Open-BackupPrepPin([string]$Path,[long]$Bytes,[string]$Sha256) {
 Assert-BackupPrepDeadline
 Assert-BackupPrepRegularPath $Path
 # Read sharing denies replacement, deletion and writes while this lease lives.
 $backupPrepStream = [IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 $backupPrepLeases.Add($backupPrepStream)
 if ($Bytes -ge 0 -and $backupPrepStream.Length -ne $Bytes) { Stop-BackupPrep 'BACKUP_PREP_PIN_REFUSED' }
 $backupPrepHasher = [Security.Cryptography.SHA256]::Create()
 try { $backupPrepHashBytes = $backupPrepHasher.ComputeHash($backupPrepStream); $backupPrepHash = [Convert]::ToHexString($backupPrepHashBytes) } finally { $backupPrepHasher.Dispose() }
 $backupPrepStream.Position = 0
 if (-not $backupPrepHash.Equals($Sha256,[StringComparison]::OrdinalIgnoreCase)) { Stop-BackupPrep 'BACKUP_PREP_PIN_REFUSED' }
 Assert-BackupPrepDeadline
}
function Assert-BackupPrepGit {
 Assert-BackupPrepDeadline
 $backupPrepHead = @(& $backupPrepGit -C $backupPrepRepo rev-parse --verify HEAD 2>$null)
 if ($LASTEXITCODE -ne 0 -or $backupPrepHead.Count -ne 1 -or $backupPrepHead[0] -cne $ReviewedCommit) { Stop-BackupPrep 'BACKUP_PREP_GIT_REFUSED' }
 # Only the eight reviewed transitive paths are guarded. User WIPs stay outside.
 $backupPrepStatus = @(& $backupPrepGit -C $backupPrepRepo status --porcelain=v1 --untracked-files=all -- @backupPrepSourcePaths 2>$null)
 if ($LASTEXITCODE -ne 0) { Stop-BackupPrep 'BACKUP_PREP_GIT_REFUSED' }
 if ($backupPrepStatus.Count -ne 0) { Stop-BackupPrep 'BACKUP_PREP_SOURCE_DIRTY' }
 & $backupPrepGit -C $backupPrepRepo ls-files --error-unmatch -- @backupPrepSourcePaths 1>$null 2>$null
 if ($LASTEXITCODE -ne 0) { Stop-BackupPrep 'BACKUP_PREP_GIT_REFUSED' }
 Assert-BackupPrepDeadline
}
function Assert-BackupPrepObject($Value,[string[]]$Keys) {
 if ($Value.ValueKind -ne [Text.Json.JsonValueKind]::Object) { Stop-BackupPrep 'BACKUP_PREP_PROTOCOL_REFUSED' }
 $backupPrepSeen = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
 foreach ($backupPrepProperty in $Value.EnumerateObject()) {
  if (-not $backupPrepSeen.Add($backupPrepProperty.Name) -or $Keys -cnotcontains $backupPrepProperty.Name) { Stop-BackupPrep 'BACKUP_PREP_PROTOCOL_REFUSED' }
 }
 if ($backupPrepSeen.Count -ne $Keys.Count) { Stop-BackupPrep 'BACKUP_PREP_PROTOCOL_REFUSED' }
}
function Assert-BackupPrepUniqueJson($Value,[int]$Depth = 0) {
 if ($Depth -gt 12) { Stop-BackupPrep 'BACKUP_PREP_PROTOCOL_REFUSED' }
 if ($Value.ValueKind -eq [Text.Json.JsonValueKind]::Object) {
  $backupPrepSeen = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  foreach ($backupPrepProperty in $Value.EnumerateObject()) {
   if (-not $backupPrepSeen.Add($backupPrepProperty.Name)) { Stop-BackupPrep 'BACKUP_PREP_PROTOCOL_REFUSED' }
   Assert-BackupPrepUniqueJson $backupPrepProperty.Value ($Depth + 1)
  }
 } elseif ($Value.ValueKind -eq [Text.Json.JsonValueKind]::Array) {
  foreach ($backupPrepItem in $Value.EnumerateArray()) { Assert-BackupPrepUniqueJson $backupPrepItem ($Depth + 1) }
 }
}
function Read-BackupPrepEnum($Value,[string[]]$Allowed) {
 if ($Value.ValueKind -ne [Text.Json.JsonValueKind]::String) { Stop-BackupPrep 'BACKUP_PREP_PROTOCOL_REFUSED' }
 $backupPrepText = $Value.GetString()
 if ($Allowed -cnotcontains $backupPrepText) { Stop-BackupPrep 'BACKUP_PREP_PROTOCOL_REFUSED' }
 return $backupPrepText
}
function Read-BackupPrepBool($Value) {
 if ($Value.ValueKind -notin @([Text.Json.JsonValueKind]::True,[Text.Json.JsonValueKind]::False)) { Stop-BackupPrep 'BACKUP_PREP_PROTOCOL_REFUSED' }
 return $Value.GetBoolean()
}
function Read-BackupPrepCount($Value,[long]$Minimum,[long]$Maximum) {
 $backupPrepNumber = 0L
 if ($Value.ValueKind -ne [Text.Json.JsonValueKind]::Number -or -not $Value.TryGetInt64([ref]$backupPrepNumber) -or $backupPrepNumber -lt $Minimum -or $backupPrepNumber -gt $Maximum) { Stop-BackupPrep 'BACKUP_PREP_PROTOCOL_REFUSED' }
 return $backupPrepNumber
}
function Read-BackupPrepNullableEnum($Value,[string[]]$Allowed) {
 if ($Value.ValueKind -eq [Text.Json.JsonValueKind]::Null) { return $null }
 return Read-BackupPrepEnum $Value $Allowed
}

function Assert-BackupPrepPrivateDirectory([string]$Path) {
 Assert-BackupPrepDeadline
 if (-not [IO.Path]::IsPathFullyQualified($Path) -or $Path.StartsWith('\\') -or $Path.Contains('~') -or $Path -match '(?i)(^|[\\/])OneDrive[^\\/]*([\\/]|$)') { Stop-BackupPrep 'BACKUP_PREP_PRIVATE_PATH_REFUSED' }
 $backupPrepResolved = [IO.Path]::GetFullPath($Path)
 foreach ($backupPrepRoot in @($backupPrepRepo,[IO.Path]::GetDirectoryName($backupPrepRepo),$env:OneDrive,$env:OneDriveConsumer,$env:OneDriveCommercial)) {
  if ($backupPrepRoot) {
   $backupPrepRoot = [IO.Path]::GetFullPath($backupPrepRoot).TrimEnd('\','/')
   if ($backupPrepResolved.Equals($backupPrepRoot,[StringComparison]::OrdinalIgnoreCase) -or $backupPrepResolved.StartsWith($backupPrepRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { Stop-BackupPrep 'BACKUP_PREP_PRIVATE_PATH_REFUSED' }
  }
 }
 $backupPrepDirectory = Get-Item -LiteralPath $Path -Force
 if (-not $backupPrepDirectory.PSIsContainer -or -not $backupPrepDirectory.FullName.Equals($backupPrepResolved,[StringComparison]::OrdinalIgnoreCase)) { Stop-BackupPrep 'BACKUP_PREP_PRIVATE_PATH_REFUSED' }
 $backupPrepAncestor = $backupPrepDirectory
 while ($null -ne $backupPrepAncestor) {
  if (($backupPrepAncestor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { Stop-BackupPrep 'BACKUP_PREP_PRIVATE_PATH_REFUSED' }
  $backupPrepAncestor = $backupPrepAncestor.Parent
 }
 $backupPrepSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
 $backupPrepAllowedSids = @($backupPrepSid,'S-1-5-18','S-1-5-32-544')
 $backupPrepAcl = Get-Acl -LiteralPath $backupPrepResolved
 if ($backupPrepAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value -notin $backupPrepAllowedSids) { Stop-BackupPrep 'BACKUP_PREP_PRIVATE_PATH_REFUSED' }
 foreach ($backupPrepRule in $backupPrepAcl.Access) {
  if ($backupPrepRule.AccessControlType -eq 'Allow' -and $backupPrepRule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -notin $backupPrepAllowedSids) { Stop-BackupPrep 'BACKUP_PREP_PRIVATE_PATH_REFUSED' }
 }
 $backupPrepVolume = @(Get-Volume -DriveLetter ([IO.Path]::GetPathRoot($backupPrepResolved).Substring(0,1)) -ErrorAction Stop)
 if ($backupPrepVolume.Count -ne 1 -or $backupPrepVolume[0].FileSystemType -cne 'NTFS') { Stop-BackupPrep 'BACKUP_PREP_PRIVATE_PATH_REFUSED' }
 Assert-BackupPrepDeadline
}
function Read-BackupPrepDigest($Value) {
 if ($Value.ValueKind -ne [Text.Json.JsonValueKind]::String -or $Value.GetString() -cnotmatch '^[a-f0-9]{64}$') { Stop-BackupPrep 'BACKUP_PREP_PROTOCOL_REFUSED' }
 return $Value.GetString()
}
function Read-BackupPrepProjection($Value,[int]$NativeExitCode) {
 Assert-BackupPrepUniqueJson $Value
 $backupPrepOk = Read-BackupPrepBool ($Value.GetProperty('ok'))
 if ($backupPrepOk) {
  Assert-BackupPrepObject $Value @('ok','operation','archive_name','entries','database_entries','storage_objects','plaintext_bytes','manifest_sha256','archive_sha256','key_id')
  if ($NativeExitCode -ne 0) { Stop-BackupPrep 'BACKUP_PREP_PROTOCOL_REFUSED' }
  $backupPrepOperation = Read-BackupPrepEnum ($Value.GetProperty('operation')) @('encrypted_backup')
  $backupPrepNameValue = $Value.GetProperty('archive_name')
  if ($backupPrepNameValue.ValueKind -ne [Text.Json.JsonValueKind]::String -or $backupPrepNameValue.GetString() -cnotmatch '^second-brain-[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}-[0-9]{3}Z-[a-f0-9]{8}[.]scbackup$') { Stop-BackupPrep 'BACKUP_PREP_PROTOCOL_REFUSED' }
  $backupPrepEntries = Read-BackupPrepCount ($Value.GetProperty('entries')) 1 1000001
  $backupPrepObjects = Read-BackupPrepCount ($Value.GetProperty('storage_objects')) 0 1000000
  if ($backupPrepEntries -ne $backupPrepObjects + 1) { Stop-BackupPrep 'BACKUP_PREP_PROTOCOL_REFUSED' }
  return [ordered]@{
   ok=$true;operation=$backupPrepOperation;archive_name=$backupPrepNameValue.GetString()
   entries=$backupPrepEntries;database_entries=(Read-BackupPrepCount ($Value.GetProperty('database_entries')) 1 1)
   storage_objects=$backupPrepObjects;plaintext_bytes=(Read-BackupPrepCount ($Value.GetProperty('plaintext_bytes')) 1 9007199254740991)
   manifest_sha256=(Read-BackupPrepDigest ($Value.GetProperty('manifest_sha256')));archive_sha256=(Read-BackupPrepDigest ($Value.GetProperty('archive_sha256')))
   key_id=(Read-BackupPrepEnum ($Value.GetProperty('key_id')) @('SC-20261012-001'))
   separateVerifyRequired=$true;backupQualified=$false;restoreAccepted=$false
  }
 }
 Assert-BackupPrepObject $Value @('ok','operation','error')
 if ($NativeExitCode -eq 0) { Stop-BackupPrep 'BACKUP_PREP_PROTOCOL_REFUSED' }
 $backupPrepOperation = Read-BackupPrepEnum ($Value.GetProperty('operation')) @('backup','operator')
 if ($backupPrepOperation -ceq 'operator') {
  return [ordered]@{ok=$false;operation=$backupPrepOperation;error=(Read-BackupPrepEnum ($Value.GetProperty('error')) @('OPERATOR_SETUP_FAILED'));backupQualified=$false}
 }
 $backupPrepCliErrors = @('INVALID_ARGUMENTS','BACKUP_UNAVAILABLE','BACKUP_KEY_REQUIRED','BACKUP_KEY_MUST_BE_INDEPENDENT','QUIESCED_BACKUP_REQUIRED','PERSONAL_STORAGE_CONFIGURATION_REQUIRED','PG_DUMP_ABSOLUTE_EXECUTABLE_REQUIRED','PERSONAL_POSTGRES_CONFIGURATION_REQUIRED','UNSAFE_BACKUP_DESTINATION','PG_DUMP_UNAVAILABLE','PG_DUMP_FAILED','BACKUP_SOURCE_REQUIRED','BACKUP_SOURCE_INCOMPLETE','BACKUP_REPORT_CLEANUP_FAILED','INVALID_STORAGE_PATH','STORAGE_UNAVAILABLE','STORAGE_REQUEST_FAILED','INVALID_STORAGE_INVENTORY','PRIVATE_BUCKETS_REQUIRED','INVENTORY_LIMIT','STORAGE_CHANGED_DURING_BACKUP','INVALID_BACKUP_KEY','INVALID_HEADER','FRAME_LIMIT','FRAME_TOO_LARGE','INVALID_ENTRY','DUPLICATE_ENTRY','BYTE_LIMIT','OBJECT_SIZE_CHANGED','INCOMPLETE_BACKUP','INVALID_BACKUP','TRUNCATED_BACKUP','MISSING_MANIFEST','INVALID_FRAME','BACKUP_AUTHENTICATION_FAILED','INVALID_ORDER','ENTRY_HASH_MISMATCH','MANIFEST_MISMATCH','TRAILING_DATA','INVALID_RECORD','POST_WRITE_VERIFICATION_FAILED')
 return [ordered]@{ok=$false;operation=$backupPrepOperation;error=(Read-BackupPrepEnum ($Value.GetProperty('error')) $backupPrepCliErrors);backupQualified=$false}
}
try {
 if (-not $IsWindows -or $PSVersionTable.PSVersion.Major -ne 7) { Stop-BackupPrep 'BACKUP_PREP_PLATFORM_REFUSED' }
 if ($ReviewedCommit -isnot [string] -or $ReviewedCommit -cnotmatch '^[a-f0-9]{40}$' -or $SelfSha256 -notmatch '^[a-fA-F0-9]{64}$') { Stop-BackupPrep 'BACKUP_PREP_INPUT_REFUSED' }
 if (-not $NewQuiescenceDeclared) { Stop-BackupPrep 'BACKUP_PREP_QUIESCENCE_REQUIRED' }
 $backupPrepRepo = 'C:\Users\Kauan Sousa Barateli\Documents\Codex\2026-10-07\inicie-a-constru-o-do-software-2\work\Segundo-Cerebro'
 $backupPrepSelf = Join-Path $backupPrepRepo 'work\create-backup-preparacao-20261017-v1.ps1'
 if (-not $PSCommandPath.Equals($backupPrepSelf,[StringComparison]::OrdinalIgnoreCase)) { Stop-BackupPrep 'BACKUP_PREP_PATH_REFUSED' }
 Open-BackupPrepPin $backupPrepSelf -1 $SelfSha256
 $backupPrepGit = (@(Get-Command git -CommandType Application -ErrorAction Stop)[0]).Source
 if ($backupPrepGit -isnot [string] -or [string]::IsNullOrWhiteSpace($backupPrepGit)) { Stop-BackupPrep 'BACKUP_PREP_GIT_REFUSED' }
 Assert-BackupPrepRegularPath $backupPrepGit
 $backupPrepSources = @(
  @('scripts/operations/run-operator.ps1',6111,'7311AEC2E11F747C7D3204821EF22748BDA9CCAB85608D6B3EDB854C44BF196C'),
  @('scripts/operations/backup.mjs',5828,'A8CAA0F5D4341B45FD9DC3B6CF209892E9C687894E7D1811C2056464632091FE'),
  @('scripts/operations/backup-config.mjs',4347,'BB0F9276180C26E9D07253631B233AD8EF9AEAD7CCA07ABDB01D9F0E4C567D78'),
  @('scripts/operations/backup-sources.mjs',8865,'0533CDBABD16AB168B9F7CA5F23E1E7DDB878104D3230A28825452D085D9246D'),
  @('scripts/operations/backup-format.mjs',10581,'AE711C39EF31660CBDDC50081290C53B57CCE8FE6361E8A5E7846EDD0696AC74'),
  @('scripts/operations/restore-verify.mjs',1634,'3D7F21D25E8654ADF59B553FA0EB93231F816427E9B0B1088C1F6CC764ED7B9D'),
  @('scripts/operations/restore-target.mjs',11357,'F29BD0B5D23F78EDE190C6B85CD467E87DC0048E7172E8C8F686771DF49B4AA0'),
  @('scripts/operations/postgres-process.mjs',5359,'D210AB110390EC8CD14DF2189346F0EEEE1DF3CCD03D13E6476AA00E51991464')
 )
 $backupPrepSourcePaths = @($backupPrepSources | ForEach-Object { $_[0] })
 Assert-BackupPrepGit
 foreach ($backupPrepSource in $backupPrepSources) { Open-BackupPrepPin (Join-Path $backupPrepRepo $backupPrepSource[0]) $backupPrepSource[1] $backupPrepSource[2] }
 $backupPrepNode = 'C:\Users\Kauan Sousa Barateli\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
 $backupPrepPwsh = 'C:\Users\Kauan Sousa Barateli\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe'
 Open-BackupPrepPin $backupPrepNode 92825416 '3602F2BB1A10F2CBAB4C36886218A33C1AB3DB87290E73B033C46C77147D0237'
 Open-BackupPrepPin $backupPrepPwsh 301368 '362A356CE7F0940EC74F73A8FC2C990A2CC24A38A11C90BBD8ECA947110AD139'
 Open-BackupPrepPin 'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe' 632320 '46C8AD2E487FA01BB5401AE3B383C09E20789EFDD3A37C6940975647EB1FF574'
 if (-not 'C:\WINDOWS'.Equals([Environment]::GetEnvironmentVariable('SystemRoot','Process'),[StringComparison]::OrdinalIgnoreCase)) { Stop-BackupPrep 'BACKUP_PREP_PLATFORM_REFUSED' }
 Assert-BackupPrepGit
 # This closed review gate precedes ANY private metadata/input or native process.
 if (-not $backupPrepTransportReviewed) { Stop-BackupPrep 'BACKUP_PREP_TRANSPORT_UNREVIEWED' }
 $backupPrepProfile = 'C:\Users\Kauan Sousa Barateli\SegundoCerebro-Operations\profiles\backup-source-pg18-20261012-v1.xml'
 $backupPrepDestination = 'C:\Users\Kauan Sousa Barateli\SegundoCerebro-Operations\archives'
 Assert-BackupPrepPrivateDirectory $backupPrepDestination
 Open-BackupPrepPin $backupPrepProfile 4206 '5D9C83138241DBBF3EA94722E46BF4A67EA52B2EF22D72F7F05055BBC214F32C'
 Open-BackupPrepPin 'C:\Users\Kauan Sousa Barateli\SegundoCerebro-Operations\certificates\prod-ca-2021.crt' -1 '700723581420DD1AC98FD7E9AC529F0EF210EADCAF87FC868A3AD7D114C2F3B7'
 Assert-BackupPrepGit
 $backupPrepStart = [Diagnostics.ProcessStartInfo]::new()
 $backupPrepStart.FileName = $backupPrepPwsh
 $backupPrepStart.WorkingDirectory = $backupPrepRepo
 $backupPrepStart.UseShellExecute = $false
 $backupPrepStart.CreateNoWindow = $true
 $backupPrepStart.RedirectStandardOutput = $true
 $backupPrepStart.RedirectStandardError = $true
 $backupPrepStart.Environment.Clear()
 foreach ($backupPrepEnvName in @('SystemRoot','WINDIR','SystemDrive','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','OneDrive','OneDriveConsumer','OneDriveCommercial')) {
  $backupPrepEnvValue = [Environment]::GetEnvironmentVariable($backupPrepEnvName,'Process')
  if ($null -ne $backupPrepEnvValue) { $backupPrepStart.Environment[$backupPrepEnvName] = $backupPrepEnvValue }
 }
 # No NODE_OPTIONS/NODE_PATH, inherited PG credentials or unrelated MCP tokens.
 $backupPrepStart.Environment['PATH'] = Join-Path ([Environment]::GetEnvironmentVariable('SystemRoot','Process')) 'System32'
 $backupPrepStart.Environment['PATHEXT'] = '.EXE'
 # Set only for this child after the NEW explicit operator declaration.
 $backupPrepStart.Environment['SC_BACKUP_QUIESCED'] = 'YES'
 foreach ($backupPrepArgument in @('-NoLogo','-NoProfile','-NonInteractive','-File',(Join-Path $backupPrepRepo 'scripts\operations\run-operator.ps1'),'-Operation','create','-ProfilePath',$backupPrepProfile,'-NodePath',$backupPrepNode)) { $backupPrepStart.ArgumentList.Add($backupPrepArgument) }
 Assert-BackupPrepDeadline
 $backupPrepProcess = [Diagnostics.Process]::new()
 $backupPrepProcess.StartInfo = $backupPrepStart
 if (-not $backupPrepProcess.Start()) { Stop-BackupPrep 'BACKUP_PREP_PROCESS_UNAVAILABLE' }
 $backupPrepOutDone = $false; $backupPrepErrDone = $false
 $backupPrepOutRead = $backupPrepProcess.StandardOutput.BaseStream.ReadAsync($backupPrepOutBuffer,0,$backupPrepOutBuffer.Length)
 $backupPrepErrRead = $backupPrepProcess.StandardError.BaseStream.ReadAsync($backupPrepErrBuffer,0,$backupPrepErrBuffer.Length)
 while (-not $backupPrepOutDone -or -not $backupPrepErrDone -or -not $backupPrepProcess.HasExited) {
  Assert-BackupPrepDeadline
  if (-not $backupPrepOutDone -and $backupPrepOutRead.IsCompleted) {
   $backupPrepReadCount = $backupPrepOutRead.GetAwaiter().GetResult()
   if ($backupPrepReadCount -eq 0) { $backupPrepOutDone = $true } else {
    if ($backupPrepOutput.Length + $backupPrepReadCount -gt 65536) { Stop-BackupPrep 'BACKUP_PREP_OUTPUT_LIMIT' }
    $backupPrepOutput.Write($backupPrepOutBuffer,0,$backupPrepReadCount)
    [Array]::Clear($backupPrepOutBuffer,0,$backupPrepOutBuffer.Length)
    $backupPrepOutRead = $backupPrepProcess.StandardOutput.BaseStream.ReadAsync($backupPrepOutBuffer,0,$backupPrepOutBuffer.Length)
   }
  }
  if (-not $backupPrepErrDone -and $backupPrepErrRead.IsCompleted) {
   $backupPrepReadCount = $backupPrepErrRead.GetAwaiter().GetResult()
   [Array]::Clear($backupPrepErrBuffer,0,$backupPrepErrBuffer.Length)
   if ($backupPrepReadCount -eq 0) { $backupPrepErrDone = $true } else { $backupPrepErrRead = $backupPrepProcess.StandardError.BaseStream.ReadAsync($backupPrepErrBuffer,0,$backupPrepErrBuffer.Length) }
  }
  [Threading.Thread]::Sleep(10)
 }
 # Qualification requires BOTH original stream EOFs and original process exit.
 # A timeout or Kill request never enters this branch or certifies cleanup.
 Assert-BackupPrepDeadline
 Assert-BackupPrepGit
 Assert-BackupPrepPrivateDirectory $backupPrepDestination
 $backupPrepBytes = $backupPrepOutput.ToArray()
 $backupPrepText = [Text.UTF8Encoding]::new($false,$true).GetString($backupPrepBytes)
 try { $backupPrepDocument = [Text.Json.JsonDocument]::Parse($backupPrepText); $backupPrepProjection = Read-BackupPrepProjection $backupPrepDocument.RootElement $backupPrepProcess.ExitCode } catch { if ($_.Exception.Message -cin $backupPrepCodes) { throw }; Stop-BackupPrep 'BACKUP_PREP_PROTOCOL_REFUSED' }
 if ($backupPrepProcess.ExitCode -eq 0 -and $backupPrepProjection.ok) {
  $backupPrepResult = [ordered]@{ok=$true;operation='new_backup_create_preparation';reviewedCommit=$ReviewedCommit;newQuiescenceDeclared=$true;result=$backupPrepProjection;backupQualified=$false;separateVerifyRequired=$true}
  $backupPrepExit = 0
 } else {
  $backupPrepResult = [ordered]@{ok=$false;operation='new_backup_create_preparation';error='BACKUP_PREP_NATIVE_REFUSED';reviewedCommit=$ReviewedCommit;diagnostic=$backupPrepProjection;backupQualified=$false}
 }
} catch {
 $backupPrepCode = if ($_.Exception.Message -cin $backupPrepCodes) { $_.Exception.Message } else { 'BACKUP_PREP_UNAVAILABLE' }
 $backupPrepResult = [ordered]@{ok=$false;operation='new_backup_create_preparation';error=$backupPrepCode;backupQualified=$false}
} finally {
 if ($null -ne $backupPrepProcess) {
  try { if (-not $backupPrepProcess.HasExited) { $backupPrepProcess.Kill($true) } } catch { }
  # This is a cancellation request only. Do not wait, infer EOF or claim cleanup.
  try { $backupPrepProcess.Dispose() } catch { }
 }
 if ($null -ne $backupPrepDocument) { $backupPrepDocument.Dispose() }
 if ($null -ne $backupPrepBytes) { [Array]::Clear($backupPrepBytes,0,$backupPrepBytes.Length) }
 [Array]::Clear($backupPrepOutBuffer,0,$backupPrepOutBuffer.Length)
 [Array]::Clear($backupPrepErrBuffer,0,$backupPrepErrBuffer.Length)
 try { $backupPrepStore = $backupPrepOutput.GetBuffer(); [Array]::Clear($backupPrepStore,0,$backupPrepStore.Length) } catch { }
 $backupPrepOutput.Dispose()
 foreach ($backupPrepLease in $backupPrepLeases) { try { $backupPrepLease.Dispose() } catch { } }
 $backupPrepLeases.Clear()
 $backupPrepWatch.Stop()
}
Write-Output ($backupPrepResult | ConvertTo-Json -Depth 12 -Compress)
exit $backupPrepExit
