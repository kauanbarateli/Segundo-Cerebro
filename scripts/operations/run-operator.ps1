param(
 [Parameter(Mandatory=$true)][ValidateSet('create','verify','restore','check')][string]$Operation,
 [Parameter(Mandatory=$true)][string]$ProfilePath,
 [Parameter(Mandatory=$true)][string]$NodePath,
 [string]$Archive
)
$ErrorActionPreference='Stop'
$operatorRepoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$operatorWorkRoot=[IO.Path]::GetDirectoryName($operatorRepoRoot)
function Assert-ExternalProfile([string]$Candidate) {
 if(-not [IO.Path]::IsPathRooted($Candidate) -or $Candidate.StartsWith('\\') -or $Candidate.Contains('~') -or $Candidate -match '(?i)(^|[\\/])OneDrive[^\\/]*([\\/]|$)'){throw 'OPERATOR_PROFILE_PATH_REJECTED'}
 $resolvedProfile=[IO.Path]::GetFullPath($Candidate)
 foreach($forbiddenRoot in @($operatorRepoRoot,$operatorWorkRoot,$env:OneDrive,$env:OneDriveConsumer,$env:OneDriveCommercial)) {
  if($forbiddenRoot){$absoluteRoot=[IO.Path]::GetFullPath($forbiddenRoot).TrimEnd('\','/');if($resolvedProfile.Equals($absoluteRoot,[StringComparison]::OrdinalIgnoreCase) -or $resolvedProfile.StartsWith($absoluteRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'OPERATOR_PROFILE_PATH_REJECTED'}}
 }
 $ancestor=Get-Item -LiteralPath $resolvedProfile
 if($ancestor.PSIsContainer){throw 'OPERATOR_PROFILE_FILE_REQUIRED'}
 while($ancestor){if(($ancestor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'OPERATOR_PROFILE_REPARSE_REJECTED'};if($ancestor -is [IO.FileInfo]){$ancestor=$ancestor.Directory}else{$ancestor=$ancestor.Parent}}
 $currentSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
 foreach($accessRule in (Get-Acl -LiteralPath $resolvedProfile).Access) {
  if($accessRule.AccessControlType -eq 'Allow'){$sid=$accessRule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value;if($sid -notin @($currentSid,'S-1-5-18','S-1-5-32-544')){throw 'OPERATOR_PROFILE_ACL_REJECTED'}}
 }
 return $resolvedProfile
}
$operatorPrior=@{};$operatorProfile=$null
try {
 if(-not [IO.Path]::IsPathRooted($NodePath) -or -not (Test-Path -LiteralPath $NodePath -PathType Leaf)){throw 'NODE_ABSOLUTE_EXECUTABLE_REQUIRED'}
 $operatorProfile=Import-Clixml -LiteralPath (Assert-ExternalProfile $ProfilePath)
 if($operatorProfile -isnot [Collections.IDictionary]){throw 'OPERATOR_PROFILE_INVALID'}
 $operatorAllowed=@('SC_BACKUP_ENCRYPTION_KEY','SC_BACKUP_KEY_ID','SC_BACKUP_DESTINATION','SC_BACKUP_PG_DUMP','SC_BACKUP_QUIESCED','SC_BACKUP_SUPABASE_URL','SC_BACKUP_SUPABASE_KEY','SC_BACKUP_APP_SERVING_ROOT','SC_BACKUP_WORK_ROOT','PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGSSLMODE','PGSSLROOTCERT','SC_RESTORE_PROJECT_REF','SC_RESTORE_CONFIRM_PROJECT','SC_RESTORE_ISOLATED','SC_RESTORE_PG_RESTORE','SC_RESTORE_PSQL','SC_RESTORE_SUPABASE_URL','SC_RESTORE_SUPABASE_KEY','SC_RESTORE_PGHOST','SC_RESTORE_PGPORT','SC_RESTORE_PGDATABASE','SC_RESTORE_PGUSER','SC_RESTORE_PGPASSWORD','SC_RESTORE_PGSSLMODE','SC_RESTORE_PGSSLROOTCERT','SC_RELEASE_PSQL','SC_RELEASE_REPORT_DIRECTORY')
 foreach($entry in $operatorProfile.GetEnumerator()) {
  $name=[string]$entry.Key;if($name -notin $operatorAllowed){throw 'OPERATOR_PROFILE_FIELD_REJECTED'}
  $value=$entry.Value;$operatorPrior[$name]=[Environment]::GetEnvironmentVariable($name,'Process')
  if($name -match '(KEY$|PASSWORD$)' -and $value -isnot [Security.SecureString]){throw 'OPERATOR_SECRET_MUST_USE_DPAPI'}
  if($value -is [Security.SecureString]){$pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($value);try{[Environment]::SetEnvironmentVariable($name,[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer),'Process')}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)}}
  elseif($value -is [string]){[Environment]::SetEnvironmentVariable($name,$value,'Process')}
  else{throw 'OPERATOR_PROFILE_VALUE_REJECTED'}
 }
 $operatorScript=if($Operation -eq 'check'){Join-Path $PSScriptRoot 'release-checks.mjs'}else{Join-Path $PSScriptRoot 'backup.mjs'}
 $operatorArguments=@($Operation);if($Operation -in @('verify','restore')){if(-not $Archive){throw 'ARCHIVE_REQUIRED'};$operatorArguments+=@($Archive)}elseif($Archive){throw 'UNEXPECTED_ARCHIVE'}
 & $NodePath $operatorScript @operatorArguments
 $operatorExit=$LASTEXITCODE
} catch { Write-Output '{"ok":false,"operation":"operator","error":"OPERATOR_SETUP_FAILED"}';$operatorExit=1 }
finally {
 foreach($name in $operatorPrior.Keys){[Environment]::SetEnvironmentVariable($name,$operatorPrior[$name],'Process')}
 if($operatorProfile -is [Collections.IDictionary]){foreach($value in $operatorProfile.Values){if($value -is [Security.SecureString]){$value.Dispose()}};$operatorProfile.Clear()}
}
exit $operatorExit
