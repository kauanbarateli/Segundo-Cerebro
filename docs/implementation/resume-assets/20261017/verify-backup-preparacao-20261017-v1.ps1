# Public preparation for ONE NEW separate read-only verify. No create/restore.
# Gate false returns before files/private metadata/processes. The old window
# is CLOSED. This operation does not require or declare a writer window.
[CmdletBinding()]
param(
 [bool]$GateExecute = $false,
 [object]$ReviewedCommit = $null,
 [string]$SelfSha256 = '',
 [object]$ArchiveBinding = $null
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (-not $GateExecute) {
 Write-Output '{"ok":true,"operation":"new_backup_verify_preparation","gateExecute":false,"remoteExecuted":false,"backupQualified":false}'
 exit 0
}
$verifyPrepCodes = @('VERIFY_PREP_INPUT_REFUSED','VERIFY_PREP_PLATFORM_REFUSED','VERIFY_PREP_PATH_REFUSED','VERIFY_PREP_PIN_REFUSED','VERIFY_PREP_GIT_REFUSED','VERIFY_PREP_SOURCE_DIRTY','VERIFY_PREP_BINDING_REFUSED','VERIFY_PREP_PRIVATE_PATH_REFUSED','VERIFY_PREP_TIMEOUT_INDETERMINATE','VERIFY_PREP_PROCESS_UNAVAILABLE','VERIFY_PREP_OUTPUT_LIMIT','VERIFY_PREP_PROTOCOL_REFUSED','VERIFY_PREP_NATIVE_REFUSED','VERIFY_PREP_UNAVAILABLE')
$verifyPrepLeases = [Collections.Generic.List[IO.FileStream]]::new()
$verifyPrepWatch = [Diagnostics.Stopwatch]::StartNew()
$verifyPrepProcess = $null
$verifyPrepDocument = $null
$verifyPrepBytes = $null
$verifyPrepOutput = [IO.MemoryStream]::new()
$verifyPrepOutBuffer = [byte[]]::new(4096)
$verifyPrepErrBuffer = [byte[]]::new(4096)
$verifyPrepResult = $null
$verifyPrepExit = 1
function Stop-VerifyPrep([string]$Code) { throw $Code }
function Assert-VerifyPrepDeadline {
 if ($verifyPrepWatch.ElapsedMilliseconds -ge 600000) { Stop-VerifyPrep 'VERIFY_PREP_TIMEOUT_INDETERMINATE' }
}
function Assert-VerifyPrepRegularPath([string]$Path) {
 if (-not [IO.Path]::IsPathFullyQualified($Path) -or $Path.StartsWith('\\') -or $Path.Contains('~')) { Stop-VerifyPrep 'VERIFY_PREP_PATH_REFUSED' }
 $verifyPrepItem = Get-Item -LiteralPath $Path -Force
 if ($verifyPrepItem.PSIsContainer -or -not $verifyPrepItem.FullName.Equals([IO.Path]::GetFullPath($Path),[StringComparison]::OrdinalIgnoreCase)) { Stop-VerifyPrep 'VERIFY_PREP_PATH_REFUSED' }
 $verifyPrepAncestor = $verifyPrepItem
 while ($null -ne $verifyPrepAncestor) {
  if (($verifyPrepAncestor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { Stop-VerifyPrep 'VERIFY_PREP_PATH_REFUSED' }
  if ($verifyPrepAncestor -is [IO.FileInfo]) { $verifyPrepAncestor = $verifyPrepAncestor.Directory } else { $verifyPrepAncestor = $verifyPrepAncestor.Parent }
 }
}
function Open-VerifyPrepPin([string]$Path,[long]$Bytes,[string]$Sha256) {
 Assert-VerifyPrepDeadline
 Assert-VerifyPrepRegularPath $Path
 # Read sharing denies replacement, deletion and writes while this lease lives.
 $verifyPrepStream = [IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 $verifyPrepLeases.Add($verifyPrepStream)
 if ($Bytes -ge 0 -and $verifyPrepStream.Length -ne $Bytes) { Stop-VerifyPrep 'VERIFY_PREP_PIN_REFUSED' }
 $verifyPrepHasher = [Security.Cryptography.SHA256]::Create()
 try { $verifyPrepHashBytes = $verifyPrepHasher.ComputeHash($verifyPrepStream); $verifyPrepHash = [Convert]::ToHexString($verifyPrepHashBytes) } finally { $verifyPrepHasher.Dispose() }
 $verifyPrepStream.Position = 0
 if (-not $verifyPrepHash.Equals($Sha256,[StringComparison]::OrdinalIgnoreCase)) { Stop-VerifyPrep 'VERIFY_PREP_PIN_REFUSED' }
 Assert-VerifyPrepDeadline
}
function Assert-VerifyPrepGit {
 Assert-VerifyPrepDeadline
 $verifyPrepHead = @(& $verifyPrepGit -C $verifyPrepRepo rev-parse --verify HEAD 2>$null)
 if ($LASTEXITCODE -ne 0 -or $verifyPrepHead.Count -ne 1 -or $verifyPrepHead[0] -cne $ReviewedCommit) { Stop-VerifyPrep 'VERIFY_PREP_GIT_REFUSED' }
 # Only the eight reviewed transitive paths are guarded. User WIPs stay outside.
 $verifyPrepStatus = @(& $verifyPrepGit -C $verifyPrepRepo status --porcelain=v1 --untracked-files=all -- @verifyPrepSourcePaths 2>$null)
 if ($LASTEXITCODE -ne 0) { Stop-VerifyPrep 'VERIFY_PREP_GIT_REFUSED' }
 if ($verifyPrepStatus.Count -ne 0) { Stop-VerifyPrep 'VERIFY_PREP_SOURCE_DIRTY' }
 & $verifyPrepGit -C $verifyPrepRepo ls-files --error-unmatch -- @verifyPrepSourcePaths 1>$null 2>$null
 if ($LASTEXITCODE -ne 0) { Stop-VerifyPrep 'VERIFY_PREP_GIT_REFUSED' }
 Assert-VerifyPrepDeadline
}
function Assert-VerifyPrepObject($Value,[string[]]$Keys) {
 if ($Value.ValueKind -ne [Text.Json.JsonValueKind]::Object) { Stop-VerifyPrep 'VERIFY_PREP_PROTOCOL_REFUSED' }
 $verifyPrepSeen = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
 foreach ($verifyPrepProperty in $Value.EnumerateObject()) {
  if (-not $verifyPrepSeen.Add($verifyPrepProperty.Name) -or $Keys -cnotcontains $verifyPrepProperty.Name) { Stop-VerifyPrep 'VERIFY_PREP_PROTOCOL_REFUSED' }
 }
 if ($verifyPrepSeen.Count -ne $Keys.Count) { Stop-VerifyPrep 'VERIFY_PREP_PROTOCOL_REFUSED' }
}
function Assert-VerifyPrepUniqueJson($Value,[int]$Depth = 0) {
 if ($Depth -gt 12) { Stop-VerifyPrep 'VERIFY_PREP_PROTOCOL_REFUSED' }
 if ($Value.ValueKind -eq [Text.Json.JsonValueKind]::Object) {
  $verifyPrepSeen = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  foreach ($verifyPrepProperty in $Value.EnumerateObject()) {
   if (-not $verifyPrepSeen.Add($verifyPrepProperty.Name)) { Stop-VerifyPrep 'VERIFY_PREP_PROTOCOL_REFUSED' }
   Assert-VerifyPrepUniqueJson $verifyPrepProperty.Value ($Depth + 1)
  }
 } elseif ($Value.ValueKind -eq [Text.Json.JsonValueKind]::Array) {
  foreach ($verifyPrepItem in $Value.EnumerateArray()) { Assert-VerifyPrepUniqueJson $verifyPrepItem ($Depth + 1) }
 }
}
function Read-VerifyPrepEnum($Value,[string[]]$Allowed) {
 if ($Value.ValueKind -ne [Text.Json.JsonValueKind]::String) { Stop-VerifyPrep 'VERIFY_PREP_PROTOCOL_REFUSED' }
 $verifyPrepText = $Value.GetString()
 if ($Allowed -cnotcontains $verifyPrepText) { Stop-VerifyPrep 'VERIFY_PREP_PROTOCOL_REFUSED' }
 return $verifyPrepText
}
function Read-VerifyPrepBool($Value) {
 if ($Value.ValueKind -notin @([Text.Json.JsonValueKind]::True,[Text.Json.JsonValueKind]::False)) { Stop-VerifyPrep 'VERIFY_PREP_PROTOCOL_REFUSED' }
 return $Value.GetBoolean()
}
function Read-VerifyPrepCount($Value,[long]$Minimum,[long]$Maximum) {
 $verifyPrepNumber = 0L
 if ($Value.ValueKind -ne [Text.Json.JsonValueKind]::Number -or -not $Value.TryGetInt64([ref]$verifyPrepNumber) -or $verifyPrepNumber -lt $Minimum -or $verifyPrepNumber -gt $Maximum) { Stop-VerifyPrep 'VERIFY_PREP_PROTOCOL_REFUSED' }
 return $verifyPrepNumber
}
function Read-VerifyPrepNullableEnum($Value,[string[]]$Allowed) {
 if ($Value.ValueKind -eq [Text.Json.JsonValueKind]::Null) { return $null }
 return Read-VerifyPrepEnum $Value $Allowed
}

function Assert-VerifyPrepPrivateDirectory([string]$Path) {
 Assert-VerifyPrepDeadline
 if (-not [IO.Path]::IsPathFullyQualified($Path) -or $Path.StartsWith('\\') -or $Path.Contains('~') -or $Path -match '(?i)(^|[\\/])OneDrive[^\\/]*([\\/]|$)') { Stop-VerifyPrep 'VERIFY_PREP_PRIVATE_PATH_REFUSED' }
 $verifyPrepResolved = [IO.Path]::GetFullPath($Path)
 foreach ($verifyPrepRoot in @($verifyPrepRepo,[IO.Path]::GetDirectoryName($verifyPrepRepo),$env:OneDrive,$env:OneDriveConsumer,$env:OneDriveCommercial)) {
  if ($verifyPrepRoot) {
   $verifyPrepRoot = [IO.Path]::GetFullPath($verifyPrepRoot).TrimEnd('\','/')
   if ($verifyPrepResolved.Equals($verifyPrepRoot,[StringComparison]::OrdinalIgnoreCase) -or $verifyPrepResolved.StartsWith($verifyPrepRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { Stop-VerifyPrep 'VERIFY_PREP_PRIVATE_PATH_REFUSED' }
  }
 }
 $verifyPrepDirectory = Get-Item -LiteralPath $Path -Force
 if (-not $verifyPrepDirectory.PSIsContainer -or -not $verifyPrepDirectory.FullName.Equals($verifyPrepResolved,[StringComparison]::OrdinalIgnoreCase)) { Stop-VerifyPrep 'VERIFY_PREP_PRIVATE_PATH_REFUSED' }
 $verifyPrepAncestor = $verifyPrepDirectory
 while ($null -ne $verifyPrepAncestor) {
  if (($verifyPrepAncestor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { Stop-VerifyPrep 'VERIFY_PREP_PRIVATE_PATH_REFUSED' }
  $verifyPrepAncestor = $verifyPrepAncestor.Parent
 }
 $verifyPrepSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
 $verifyPrepAllowedSids = @($verifyPrepSid,'S-1-5-18','S-1-5-32-544')
 $verifyPrepAcl = Get-Acl -LiteralPath $verifyPrepResolved
 if ($verifyPrepAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value -notin $verifyPrepAllowedSids) { Stop-VerifyPrep 'VERIFY_PREP_PRIVATE_PATH_REFUSED' }
 foreach ($verifyPrepRule in $verifyPrepAcl.Access) {
  if ($verifyPrepRule.AccessControlType -eq 'Allow' -and $verifyPrepRule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -notin $verifyPrepAllowedSids) { Stop-VerifyPrep 'VERIFY_PREP_PRIVATE_PATH_REFUSED' }
 }
 $verifyPrepVolume = @(Get-Volume -DriveLetter ([IO.Path]::GetPathRoot($verifyPrepResolved).Substring(0,1)) -ErrorAction Stop)
 if ($verifyPrepVolume.Count -ne 1 -or $verifyPrepVolume[0].FileSystemType -cne 'NTFS') { Stop-VerifyPrep 'VERIFY_PREP_PRIVATE_PATH_REFUSED' }
 Assert-VerifyPrepDeadline
}
function Read-VerifyPrepDigest($Value) {
 if ($Value.ValueKind -ne [Text.Json.JsonValueKind]::String -or $Value.GetString() -cnotmatch '^[a-f0-9]{64}$') { Stop-VerifyPrep 'VERIFY_PREP_PROTOCOL_REFUSED' }
 return $Value.GetString()
}
function Read-VerifyPrepBinding($Value) {
 if ($Value -isnot [Collections.IDictionary]) { Stop-VerifyPrep 'VERIFY_PREP_BINDING_REFUSED' }
 $verifyKeys = @('path','bytes','sha256','entries','databaseEntries','storageObjects','plaintextBytes','manifestSha256','keyId')
 if ($Value.Count -ne $verifyKeys.Count) { Stop-VerifyPrep 'VERIFY_PREP_BINDING_REFUSED' }
 foreach ($key in $Value.Keys) { if ($key -isnot [string] -or $verifyKeys -cnotcontains $key) { Stop-VerifyPrep 'VERIFY_PREP_BINDING_REFUSED' } }
 # Only the ONE newly created archive supplied by Root; never newest-file search.
 $verifyExpected = [ordered]@{
  path='C:\Users\Kauan Sousa Barateli\SegundoCerebro-Operations\archives\second-brain-2026-10-17T01-27-25-163Z-6b65e5f5.scbackup'
  bytes=951230L;sha256='21c0e0eb0b60a123854ec4d10d2bdbf69e1cb922bc2ed2591c89ec422262088a'
  entries=1L;databaseEntries=1L;storageObjects=0L;plaintextBytes=950017L
  manifestSha256='c6be061d96acf15f6d1303f88efde6807911b09e9e8d6ee858dfe24969aa646e';keyId='SC-20261012-001'
 }
 foreach ($key in $verifyKeys) {
  if ($verifyExpected[$key] -is [string]) {
   if ($Value[$key] -isnot [string] -or $Value[$key] -cne $verifyExpected[$key]) { Stop-VerifyPrep 'VERIFY_PREP_BINDING_REFUSED' }
  } else {
   if (($Value[$key] -isnot [int] -and $Value[$key] -isnot [long]) -or $Value[$key] -ne $verifyExpected[$key]) { Stop-VerifyPrep 'VERIFY_PREP_BINDING_REFUSED' }
  }
 }
 return $verifyExpected
}
function Read-VerifyPrepProjection($Value,[int]$NativeExitCode,$Binding) {
 $verifyBound = Read-VerifyPrepBinding $Binding
 Assert-VerifyPrepUniqueJson $Value
 $verifyPrepOk = Read-VerifyPrepBool ($Value.GetProperty('ok'))
 if ($verifyPrepOk) {
  Assert-VerifyPrepObject $Value @('ok','operation','entries','database_entries','storage_objects','plaintext_bytes','manifest_sha256','archive_sha256','key_id')
  if ($NativeExitCode -ne 0) { Stop-VerifyPrep 'VERIFY_PREP_PROTOCOL_REFUSED' }
  $verifyOperation = Read-VerifyPrepEnum ($Value.GetProperty('operation')) @('verify')
  $verifyEntries = Read-VerifyPrepCount ($Value.GetProperty('entries')) 1 1000001
  $verifyDatabase = Read-VerifyPrepCount ($Value.GetProperty('database_entries')) 1 1
  $verifyObjects = Read-VerifyPrepCount ($Value.GetProperty('storage_objects')) 0 1000000
  $verifyPlaintext = Read-VerifyPrepCount ($Value.GetProperty('plaintext_bytes')) 1 9007199254740991
  $verifyManifest = Read-VerifyPrepDigest ($Value.GetProperty('manifest_sha256'))
  $verifyArchiveHash = Read-VerifyPrepDigest ($Value.GetProperty('archive_sha256'))
  $verifyKeyId = Read-VerifyPrepEnum ($Value.GetProperty('key_id')) @('SC-20261012-001')
  if ($verifyEntries -ne $verifyObjects+1 -or $verifyEntries -ne $verifyBound.entries -or $verifyDatabase -ne $verifyBound.databaseEntries -or $verifyObjects -ne $verifyBound.storageObjects -or $verifyPlaintext -ne $verifyBound.plaintextBytes -or $verifyManifest -cne $verifyBound.manifestSha256 -or $verifyArchiveHash -cne $verifyBound.sha256 -or $verifyKeyId -cne $verifyBound.keyId) { Stop-VerifyPrep 'VERIFY_PREP_PROTOCOL_REFUSED' }
  return [ordered]@{ok=$true;operation=$verifyOperation;archive_name=[IO.Path]::GetFileName($verifyBound.path);entries=$verifyEntries;database_entries=$verifyDatabase;storage_objects=$verifyObjects;plaintext_bytes=$verifyPlaintext;manifest_sha256=$verifyManifest;archive_sha256=$verifyArchiveHash;key_id=$verifyKeyId;archiveVerified=$true;targetQueried=$false;remoteExecuted=$false;restoreAccepted=$false}
 }
 Assert-VerifyPrepObject $Value @('ok','operation','error')
 if ($NativeExitCode -eq 0) { Stop-VerifyPrep 'VERIFY_PREP_PROTOCOL_REFUSED' }
 $verifyOperation = Read-VerifyPrepEnum ($Value.GetProperty('operation')) @('backup','operator')
 if ($verifyOperation -ceq 'operator') { return [ordered]@{ok=$false;operation=$verifyOperation;error=(Read-VerifyPrepEnum ($Value.GetProperty('error')) @('OPERATOR_SETUP_FAILED'));archiveVerified=$false} }
 $verifyCodes = @('INVALID_ARGUMENTS','BACKUP_UNAVAILABLE','BACKUP_KEY_REQUIRED','BACKUP_KEY_MUST_BE_INDEPENDENT','BACKUP_IDENTITY_MISMATCH','INVALID_BACKUP_KEY','INVALID_HEADER','FRAME_LIMIT','INVALID_ENTRY','DUPLICATE_ENTRY','BYTE_LIMIT','INCOMPLETE_BACKUP','INVALID_BACKUP','TRUNCATED_BACKUP','MISSING_MANIFEST','INVALID_FRAME','BACKUP_AUTHENTICATION_FAILED','INVALID_ORDER','ENTRY_HASH_MISMATCH','MANIFEST_MISMATCH','TRAILING_DATA','INVALID_RECORD')
 return [ordered]@{ok=$false;operation=$verifyOperation;error=(Read-VerifyPrepEnum ($Value.GetProperty('error')) $verifyCodes);archiveVerified=$false}
}
try {
 if (-not $IsWindows -or $PSVersionTable.PSVersion.Major -ne 7) { Stop-VerifyPrep 'VERIFY_PREP_PLATFORM_REFUSED' }
 if ($ReviewedCommit -isnot [string] -or $ReviewedCommit -cnotmatch '^[a-f0-9]{40}$' -or $SelfSha256 -notmatch '^[a-fA-F0-9]{64}$') { Stop-VerifyPrep 'VERIFY_PREP_INPUT_REFUSED' }
 $verifyPrepBinding = Read-VerifyPrepBinding $ArchiveBinding
 $verifyPrepRepo = 'C:\Users\Kauan Sousa Barateli\Documents\Codex\2026-10-07\inicie-a-constru-o-do-software-2\work\Segundo-Cerebro'
 $verifyPrepSelf = Join-Path $verifyPrepRepo 'work\verify-backup-preparacao-20261017-v1.ps1'
 if (-not $PSCommandPath.Equals($verifyPrepSelf,[StringComparison]::OrdinalIgnoreCase)) { Stop-VerifyPrep 'VERIFY_PREP_PATH_REFUSED' }
 Open-VerifyPrepPin $verifyPrepSelf -1 $SelfSha256
 $verifyPrepGit = (@(Get-Command git -CommandType Application -ErrorAction Stop)[0]).Source
 if ($verifyPrepGit -isnot [string] -or [string]::IsNullOrWhiteSpace($verifyPrepGit)) { Stop-VerifyPrep 'VERIFY_PREP_GIT_REFUSED' }
 Assert-VerifyPrepRegularPath $verifyPrepGit
 $verifyPrepSources = @(
  @('scripts/operations/run-operator.ps1',6111,'7311AEC2E11F747C7D3204821EF22748BDA9CCAB85608D6B3EDB854C44BF196C'),
  @('scripts/operations/backup.mjs',5828,'A8CAA0F5D4341B45FD9DC3B6CF209892E9C687894E7D1811C2056464632091FE'),
  @('scripts/operations/backup-config.mjs',4347,'BB0F9276180C26E9D07253631B233AD8EF9AEAD7CCA07ABDB01D9F0E4C567D78'),
  @('scripts/operations/backup-sources.mjs',8865,'0533CDBABD16AB168B9F7CA5F23E1E7DDB878104D3230A28825452D085D9246D'),
  @('scripts/operations/backup-format.mjs',10581,'AE711C39EF31660CBDDC50081290C53B57CCE8FE6361E8A5E7846EDD0696AC74'),
  @('scripts/operations/restore-verify.mjs',1634,'3D7F21D25E8654ADF59B553FA0EB93231F816427E9B0B1088C1F6CC764ED7B9D'),
  @('scripts/operations/restore-target.mjs',11357,'F29BD0B5D23F78EDE190C6B85CD467E87DC0048E7172E8C8F686771DF49B4AA0'),
  @('scripts/operations/postgres-process.mjs',5359,'D210AB110390EC8CD14DF2189346F0EEEE1DF3CCD03D13E6476AA00E51991464')
 )
 $verifyPrepSourcePaths = @($verifyPrepSources | ForEach-Object { $_[0] })
 Assert-VerifyPrepGit
 foreach ($verifyPrepSource in $verifyPrepSources) { Open-VerifyPrepPin (Join-Path $verifyPrepRepo $verifyPrepSource[0]) $verifyPrepSource[1] $verifyPrepSource[2] }
 $verifyPrepNode = 'C:\Users\Kauan Sousa Barateli\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
 $verifyPrepPwsh = 'C:\Users\Kauan Sousa Barateli\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe'
 Open-VerifyPrepPin $verifyPrepNode 92825416 '3602F2BB1A10F2CBAB4C36886218A33C1AB3DB87290E73B033C46C77147D0237'
 Open-VerifyPrepPin $verifyPrepPwsh 301368 '362A356CE7F0940EC74F73A8FC2C990A2CC24A38A11C90BBD8ECA947110AD139'
 if (-not 'C:\WINDOWS'.Equals([Environment]::GetEnvironmentVariable('SystemRoot','Process'),[StringComparison]::OrdinalIgnoreCase)) { Stop-VerifyPrep 'VERIFY_PREP_PLATFORM_REFUSED' }
 Assert-VerifyPrepGit
 $verifyPrepProfile = 'C:\Users\Kauan Sousa Barateli\SegundoCerebro-Operations\profiles\backup-source-pg18-20261012-v1.xml'
 $verifyPrepDestination = 'C:\Users\Kauan Sousa Barateli\SegundoCerebro-Operations\archives'
 Assert-VerifyPrepPrivateDirectory $verifyPrepDestination
 Open-VerifyPrepPin $verifyPrepProfile 4206 '5D9C83138241DBBF3EA94722E46BF4A67EA52B2EF22D72F7F05055BBC214F32C'
 Open-VerifyPrepPin $verifyPrepBinding.path $verifyPrepBinding.bytes $verifyPrepBinding.sha256
 Assert-VerifyPrepGit
 $verifyPrepStart = [Diagnostics.ProcessStartInfo]::new()
 $verifyPrepStart.FileName = $verifyPrepPwsh
 $verifyPrepStart.WorkingDirectory = $verifyPrepRepo
 $verifyPrepStart.UseShellExecute = $false
 $verifyPrepStart.CreateNoWindow = $true
 $verifyPrepStart.RedirectStandardOutput = $true
 $verifyPrepStart.RedirectStandardError = $true
 $verifyPrepStart.Environment.Clear()
 foreach ($verifyPrepEnvName in @('SystemRoot','WINDIR','SystemDrive','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','OneDrive','OneDriveConsumer','OneDriveCommercial')) {
  $verifyPrepEnvValue = [Environment]::GetEnvironmentVariable($verifyPrepEnvName,'Process')
  if ($null -ne $verifyPrepEnvValue) { $verifyPrepStart.Environment[$verifyPrepEnvName] = $verifyPrepEnvValue }
 }
 # No NODE_OPTIONS/NODE_PATH, inherited PG credentials or unrelated MCP tokens.
 $verifyPrepStart.Environment['PATH'] = Join-Path ([Environment]::GetEnvironmentVariable('SystemRoot','Process')) 'System32'
 $verifyPrepStart.Environment['PATHEXT'] = '.EXE'
 foreach ($verifyPrepArgument in @('-NoLogo','-NoProfile','-NonInteractive','-File',(Join-Path $verifyPrepRepo 'scripts\operations\run-operator.ps1'),'-Operation','verify','-ProfilePath',$verifyPrepProfile,'-NodePath',$verifyPrepNode,'-Archive',$verifyPrepBinding.path)) { $verifyPrepStart.ArgumentList.Add($verifyPrepArgument) }
 Assert-VerifyPrepDeadline
 $verifyPrepProcess = [Diagnostics.Process]::new()
 $verifyPrepProcess.StartInfo = $verifyPrepStart
 if (-not $verifyPrepProcess.Start()) { Stop-VerifyPrep 'VERIFY_PREP_PROCESS_UNAVAILABLE' }
 $verifyPrepOutDone = $false; $verifyPrepErrDone = $false
 $verifyPrepOutRead = $verifyPrepProcess.StandardOutput.BaseStream.ReadAsync($verifyPrepOutBuffer,0,$verifyPrepOutBuffer.Length)
 $verifyPrepErrRead = $verifyPrepProcess.StandardError.BaseStream.ReadAsync($verifyPrepErrBuffer,0,$verifyPrepErrBuffer.Length)
 while (-not $verifyPrepOutDone -or -not $verifyPrepErrDone -or -not $verifyPrepProcess.HasExited) {
  Assert-VerifyPrepDeadline
  if (-not $verifyPrepOutDone -and $verifyPrepOutRead.IsCompleted) {
   $verifyPrepReadCount = $verifyPrepOutRead.GetAwaiter().GetResult()
   if ($verifyPrepReadCount -eq 0) { $verifyPrepOutDone = $true } else {
    if ($verifyPrepOutput.Length + $verifyPrepReadCount -gt 65536) { Stop-VerifyPrep 'VERIFY_PREP_OUTPUT_LIMIT' }
    $verifyPrepOutput.Write($verifyPrepOutBuffer,0,$verifyPrepReadCount)
    [Array]::Clear($verifyPrepOutBuffer,0,$verifyPrepOutBuffer.Length)
    $verifyPrepOutRead = $verifyPrepProcess.StandardOutput.BaseStream.ReadAsync($verifyPrepOutBuffer,0,$verifyPrepOutBuffer.Length)
   }
  }
  if (-not $verifyPrepErrDone -and $verifyPrepErrRead.IsCompleted) {
   $verifyPrepReadCount = $verifyPrepErrRead.GetAwaiter().GetResult()
   [Array]::Clear($verifyPrepErrBuffer,0,$verifyPrepErrBuffer.Length)
   if ($verifyPrepReadCount -eq 0) { $verifyPrepErrDone = $true } else { $verifyPrepErrRead = $verifyPrepProcess.StandardError.BaseStream.ReadAsync($verifyPrepErrBuffer,0,$verifyPrepErrBuffer.Length) }
  }
  [Threading.Thread]::Sleep(10)
 }
 # Qualification requires BOTH original stream EOFs and original process exit.
 # A timeout or Kill request never enters this branch or certifies cleanup.
 Assert-VerifyPrepDeadline
 Assert-VerifyPrepGit
 Assert-VerifyPrepPrivateDirectory $verifyPrepDestination
 Open-VerifyPrepPin $verifyPrepBinding.path $verifyPrepBinding.bytes $verifyPrepBinding.sha256
 $verifyPrepBytes = $verifyPrepOutput.ToArray()
 $verifyPrepText = [Text.UTF8Encoding]::new($false,$true).GetString($verifyPrepBytes)
 try { $verifyPrepDocument = [Text.Json.JsonDocument]::Parse($verifyPrepText); $verifyPrepProjection = Read-VerifyPrepProjection $verifyPrepDocument.RootElement $verifyPrepProcess.ExitCode $verifyPrepBinding } catch { if ($_.Exception.Message -cin $verifyPrepCodes) { throw }; Stop-VerifyPrep 'VERIFY_PREP_PROTOCOL_REFUSED' }
 if ($verifyPrepProcess.ExitCode -eq 0 -and $verifyPrepProjection.ok) {
  $verifyPrepResult = [ordered]@{ok=$true;operation='new_backup_verify_preparation';reviewedCommit=$ReviewedCommit;result=$verifyPrepProjection;backupQualified=$false;archiveVerified=$true}
  $verifyPrepExit = 0
 } else {
  $verifyPrepResult = [ordered]@{ok=$false;operation='new_backup_verify_preparation';error='VERIFY_PREP_NATIVE_REFUSED';reviewedCommit=$ReviewedCommit;diagnostic=$verifyPrepProjection;backupQualified=$false}
 }
} catch {
 $verifyPrepCode = if ($_.Exception.Message -cin $verifyPrepCodes) { $_.Exception.Message } else { 'VERIFY_PREP_UNAVAILABLE' }
 $verifyPrepResult = [ordered]@{ok=$false;operation='new_backup_verify_preparation';error=$verifyPrepCode;backupQualified=$false}
} finally {
 if ($null -ne $verifyPrepProcess) {
  try { if (-not $verifyPrepProcess.HasExited) { $verifyPrepProcess.Kill($true) } } catch { }
  # This is a cancellation request only. Do not wait, infer EOF or claim cleanup.
  try { $verifyPrepProcess.Dispose() } catch { }
 }
 if ($null -ne $verifyPrepDocument) { $verifyPrepDocument.Dispose() }
 if ($null -ne $verifyPrepBytes) { [Array]::Clear($verifyPrepBytes,0,$verifyPrepBytes.Length) }
 [Array]::Clear($verifyPrepOutBuffer,0,$verifyPrepOutBuffer.Length)
 [Array]::Clear($verifyPrepErrBuffer,0,$verifyPrepErrBuffer.Length)
 try { $verifyPrepStore = $verifyPrepOutput.GetBuffer(); [Array]::Clear($verifyPrepStore,0,$verifyPrepStore.Length) } catch { }
 $verifyPrepOutput.Dispose()
 foreach ($verifyPrepLease in $verifyPrepLeases) { try { $verifyPrepLease.Dispose() } catch { } }
 $verifyPrepLeases.Clear()
 $verifyPrepWatch.Stop()
}
Write-Output ($verifyPrepResult | ConvertTo-Json -Depth 12 -Compress)
exit $verifyPrepExit
