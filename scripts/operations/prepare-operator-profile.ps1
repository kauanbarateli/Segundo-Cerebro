<#
.SYNOPSIS
Prepare a NEW Windows DPAPI operator profile with PowerShell 7 on Windows,
without any remote operation. Run this helper with pwsh.exe, not powershell.exe.
.NOTES
Run interactively without transcript. Prepare the private parent directory first.
No existing .env/profile is read and no key is printed or copied to clipboard.
Backup generates a new key; Restore asks privately for the ORIGINAL key and ID.
After preparation, the user must arrange a protected offline copy of the new key
with their own local secret tool, separate from DPAPI and the backup disk. This
helper does not perform that transfer or certify custody/backup/restore. Losing
the Windows identity/machine without independent custody can lose the archives.
TEMP/TMP belong to the dedicated operator process, never this profile. Actual
server/tool compatibility and a writer-free window are checked before later use.
#>
param(
 [ValidateSet('Check','Backup','Restore')][string]$Mode,
 [string]$ProfilePath
)
$ErrorActionPreference='Stop'
$operatorPersonalRef='rishenjoikgmfubmnfiu'
$operatorRepoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$operatorWorkRoot=[IO.Path]::GetDirectoryName($operatorRepoRoot)

function Stop-ProfilePreparation([string]$Code) { throw [InvalidOperationException]::new($Code) }
function Get-OperatorSid { [Security.Principal.WindowsIdentity]::GetCurrent().User }
function Assert-PrivateOperatorAcl([string]$Path) {
 $allowed=@((Get-OperatorSid).Value,'S-1-5-18','S-1-5-32-544')
 foreach($rule in (Get-Acl -LiteralPath $Path).Access){
  if($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -notin $allowed){Stop-ProfilePreparation 'PROFILE_ACL_REFUSED'}
 }
}
function Assert-OperatorProfilePath([string]$Path,[string[]]$AdditionalForbiddenRoots=@()) {
 if(-not $Path -or -not [IO.Path]::IsPathRooted($Path) -or $Path.StartsWith('\\') -or $Path.Contains('~') -or $Path -match '(?i)(^|[\\/])OneDrive[^\\/]*([\\/]|$)' -or $Path -match '[\r\n\x00]'){Stop-ProfilePreparation 'PROFILE_PATH_REFUSED'}
 $full=[IO.Path]::GetFullPath($Path)
 if(-not $full.Equals($Path.Replace('/','\'),[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($full) -match '[:\x00-\x1f]|[ .]$'){Stop-ProfilePreparation 'PROFILE_CANONICAL_PATH_REQUIRED'}
 $roots=@($operatorRepoRoot,$operatorWorkRoot,$env:OneDrive,$env:OneDriveConsumer,$env:OneDriveCommercial)+$AdditionalForbiddenRoots
 foreach($root in $roots){if($root){$fixed=[IO.Path]::GetFullPath($root).TrimEnd('\','/');if($full.Equals($fixed,[StringComparison]::OrdinalIgnoreCase) -or $full.StartsWith($fixed+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){Stop-ProfilePreparation 'PROFILE_PATH_REFUSED'}}}
 if(Test-Path -LiteralPath $full){Stop-ProfilePreparation 'PROFILE_ALREADY_EXISTS'}
 $parent=[IO.Path]::GetDirectoryName($full)
 if(-not(Test-Path -LiteralPath $parent -PathType Container)){Stop-ProfilePreparation 'PROFILE_PRIVATE_PARENT_REQUIRED'}
 $ancestor=Get-Item -LiteralPath $parent -Force
 if(-not $ancestor.FullName.Equals($parent,[StringComparison]::OrdinalIgnoreCase)){Stop-ProfilePreparation 'PROFILE_CANONICAL_PATH_REQUIRED'}
 while($ancestor){if(($ancestor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){Stop-ProfilePreparation 'PROFILE_REPARSE_REFUSED'};$ancestor=$ancestor.Parent}
 Assert-PrivateOperatorAcl $parent
 return $full
}
function Assert-PrivateOperatorDirectory([string]$Path,[string[]]$AdditionalForbiddenRoots=@()) {
 # Reuse the same boundary without creating, changing ACLs, or reading any profile.
 if(-not(Test-Path -LiteralPath $Path -PathType Container)){Stop-ProfilePreparation 'PROFILE_DIRECTORY_REQUIRED'}
 $probe=Join-Path $Path ('profile-probe-'+[Guid]::NewGuid().ToString('N')+'.xml')
 $null=Assert-OperatorProfilePath $probe $AdditionalForbiddenRoots
 return [IO.Path]::GetFullPath($Path)
}
function Read-OperatorSecret([string]$Label) { Read-Host -Prompt $Label -AsSecureString }
function Read-OperatorText([string]$Label,[string]$Default='') {
 $value=Read-Host -Prompt $(if($Default){$Label+' ['+$Default+']'}else{$Label})
 if(-not $value){$value=$Default};return $value
}
function Use-OperatorSecret([Security.SecureString]$Secret,[scriptblock]$Action) {
 if(-not $Secret -or $Secret.Length -eq 0){Stop-ProfilePreparation 'PROFILE_SECRET_REQUIRED'}
 $pointer=[IntPtr]::Zero
 try{$pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secret);$text=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer);& $Action $text}
 finally{$text=$null;if($pointer -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)}}
}
function New-OperatorBackupKey {
 $bytes=New-Object byte[] 32;$rng=[Security.Cryptography.RandomNumberGenerator]::Create()
 try{$rng.GetBytes($bytes);ConvertTo-SecureString -String ([Convert]::ToBase64String($bytes)) -AsPlainText -Force}
 finally{[Array]::Clear($bytes,0,$bytes.Length);$rng.Dispose()}
}
function Assert-OperatorExecutable([string]$Path,[string]$Name) {
 if(-not [IO.Path]::IsPathRooted($Path) -or $Path.Contains('~') -or $Path.StartsWith('\\') -or -not(Test-Path -LiteralPath $Path -PathType Leaf) -or [IO.Path]::GetFileName($Path) -ne $Name){Stop-ProfilePreparation 'PROFILE_EXECUTABLE_REFUSED'}
 $item=Get-Item -LiteralPath $Path -Force
 while($item){if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){Stop-ProfilePreparation 'PROFILE_REPARSE_REFUSED'};if($item -is [IO.FileInfo]){$item=$item.Directory}else{$item=$item.Parent}}
}
function Assert-OperatorProfile([string]$SelectedMode,[Collections.IDictionary]$Profile) {
 if($SelectedMode -notin @('Check','Backup','Restore') -or -not $Profile){Stop-ProfilePreparation 'PROFILE_SHAPE_REFUSED'}
 $pg=@('PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGSSLMODE','PGSSLROOTCERT')
 $allowed=if($SelectedMode -eq 'Restore'){@('SC_BACKUP_ENCRYPTION_KEY','SC_BACKUP_KEY_ID','SC_RESTORE_PROJECT_REF','SC_RESTORE_CONFIRM_PROJECT','SC_RESTORE_ISOLATED','SC_RESTORE_PG_RESTORE','SC_RESTORE_PSQL','SC_RESTORE_SUPABASE_URL','SC_RESTORE_SUPABASE_KEY')+@($pg|ForEach-Object{'SC_RESTORE_'+$_})}else{$pg+@('SC_RELEASE_PSQL','SC_RELEASE_REPORT_DIRECTORY')}
 if($SelectedMode -eq 'Backup'){$allowed+=@('SC_BACKUP_ENCRYPTION_KEY','SC_BACKUP_KEY_ID','SC_BACKUP_DESTINATION','SC_BACKUP_PG_DUMP','SC_BACKUP_SUPABASE_URL','SC_BACKUP_SUPABASE_KEY','SC_BACKUP_APP_SERVING_ROOT','SC_BACKUP_WORK_ROOT')}
 if($Profile.Count -ne $allowed.Count -or @($Profile.Keys|Where-Object{$_ -isnot [string] -or $_ -notin $allowed}).Count){Stop-ProfilePreparation 'PROFILE_FIELDS_REFUSED'}
 foreach($name in $allowed){
  if(-not $Profile.Contains($name)){Stop-ProfilePreparation 'PROFILE_FIELDS_REFUSED'}
  $value=$Profile[$name]
  if($name -match '(KEY$|PASSWORD$)'){
   if($value -isnot [Security.SecureString]){Stop-ProfilePreparation 'PROFILE_SECRET_TYPE_REFUSED'}
   $null=Use-OperatorSecret $value {param($v) if(-not $v -or $v.Length -gt 8192 -or $v -match '[\r\n\x00]'){Stop-ProfilePreparation 'PROFILE_SECRET_REFUSED'}}
  }elseif($value -isnot [string] -or $value.Length -gt 8192 -or $value -match '[\r\n\x00]'){Stop-ProfilePreparation 'PROFILE_VALUE_REFUSED'}
 }
 $ref=$operatorPersonalRef;$prefix=''
 $extraRoots=@();if($SelectedMode -eq 'Backup'){$extraRoots=@($Profile['SC_BACKUP_APP_SERVING_ROOT'],$Profile['SC_BACKUP_WORK_ROOT']);foreach($root in $extraRoots){if($root -and -not [IO.Path]::IsPathRooted($root)){Stop-ProfilePreparation 'PROFILE_PATH_REFUSED'}}}
 if($SelectedMode -eq 'Restore'){
  $ref=$Profile['SC_RESTORE_PROJECT_REF'];$prefix='SC_RESTORE_'
  if($ref -notmatch '^[a-z]{20}$' -or $ref -eq $operatorPersonalRef -or $Profile['SC_RESTORE_CONFIRM_PROJECT'] -cne $ref -or $Profile['SC_RESTORE_ISOLATED'] -cne 'YES'){Stop-ProfilePreparation 'PROFILE_RESTORE_TARGET_REFUSED'}
  if($Profile['SC_RESTORE_SUPABASE_URL'] -cne ('https://'+$ref+'.supabase.co')){Stop-ProfilePreparation 'PROFILE_ORIGIN_REFUSED'}
  Assert-OperatorExecutable $Profile['SC_RESTORE_PG_RESTORE'] 'pg_restore.exe';Assert-OperatorExecutable $Profile['SC_RESTORE_PSQL'] 'psql.exe'
 }
 $hostValue=$Profile[$prefix+'PGHOST'];$userValue=$Profile[$prefix+'PGUSER'];$portValue=$Profile[$prefix+'PGPORT']
 if(-not(($hostValue -ceq ('db.'+$ref+'.supabase.co') -and $userValue -ceq 'postgres') -or ($hostValue -cmatch '^[a-z0-9-]+\.pooler\.supabase\.com$' -and $userValue -ceq ('postgres.'+$ref))) -or $Profile[$prefix+'PGDATABASE'] -cne 'postgres' -or $portValue -notmatch '^\d{1,5}$' -or [int]$portValue -lt 1 -or [int]$portValue -gt 65535 -or $Profile[$prefix+'PGSSLMODE'] -cnotin @('verify-full','require')){Stop-ProfilePreparation 'PROFILE_POSTGRES_REFUSED'}
 $certificate=$Profile[$prefix+'PGSSLROOTCERT'];if($certificate -and (-not [IO.Path]::IsPathRooted($certificate) -or -not(Test-Path -LiteralPath $certificate -PathType Leaf))){Stop-ProfilePreparation 'PROFILE_CERTIFICATE_REFUSED'}
 if($SelectedMode -ne 'Restore'){Assert-OperatorExecutable $Profile['SC_RELEASE_PSQL'] 'psql.exe';$null=Assert-PrivateOperatorDirectory $Profile['SC_RELEASE_REPORT_DIRECTORY'] $extraRoots}
 if($SelectedMode -eq 'Backup'){
  if($Profile['SC_BACKUP_SUPABASE_URL'] -cne ('https://'+$operatorPersonalRef+'.supabase.co')){Stop-ProfilePreparation 'PROFILE_ORIGIN_REFUSED'}
  Assert-OperatorExecutable $Profile['SC_BACKUP_PG_DUMP'] 'pg_dump.exe';$null=Assert-PrivateOperatorDirectory $Profile['SC_BACKUP_DESTINATION'] $extraRoots
 }
 if($SelectedMode -ne 'Check'){
  if($Profile['SC_BACKUP_KEY_ID'] -notmatch '^[A-Za-z0-9_-]{1,50}$'){Stop-ProfilePreparation 'PROFILE_KEY_ID_REFUSED'}
  $null=Use-OperatorSecret $Profile['SC_BACKUP_ENCRYPTION_KEY'] {param($v) $decoded=$null;try{$decoded=[Convert]::FromBase64String($v);if($decoded.Length -ne 32 -or [Convert]::ToBase64String($decoded) -cne $v -or @($decoded|Select-Object -Unique).Count -lt 8){Stop-ProfilePreparation 'PROFILE_KEY_REFUSED'}}catch{Stop-ProfilePreparation 'PROFILE_KEY_REFUSED'}finally{if($decoded){[Array]::Clear($decoded,0,$decoded.Length)}}}
  $storageName=if($SelectedMode -eq 'Backup'){'SC_BACKUP_SUPABASE_KEY'}else{'SC_RESTORE_SUPABASE_KEY'}
  $null=Use-OperatorSecret $Profile[$storageName] {param($v) if($v -cnotmatch '^sb_secret_[A-Za-z0-9_-]+$'){Stop-ProfilePreparation 'PROFILE_STORAGE_KEY_REFUSED'}}
 }
 return $true
}
function Publish-OperatorProfile([string]$SelectedMode,[string]$Path,[Collections.IDictionary]$Profile) {
 $null=Assert-OperatorProfile $SelectedMode $Profile
 $additional=@();if($SelectedMode -eq 'Backup'){$additional=@($Profile['SC_BACKUP_APP_SERVING_ROOT'],$Profile['SC_BACKUP_WORK_ROOT'])}
 $full=Assert-OperatorProfilePath $Path $additional;$stream=$null;$bytes=$null
 try{
  # Serialize only the new in-memory profile. Windows SecureString uses DPAPI;
  # no key/password is emitted, and no pre-existing profile is opened.
  $xml=[Management.Automation.PSSerializer]::Serialize($Profile,4)
  $bytes=(New-Object Text.UTF8Encoding($false)).GetBytes($xml)
  $acl=New-Object Security.AccessControl.FileSecurity;$acl.SetAccessRuleProtection($true,$false)
  foreach($sid in @((Get-OperatorSid),[Security.Principal.SecurityIdentifier]::new('S-1-5-18'),[Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))){$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,[Security.AccessControl.FileSystemRights]::FullControl,[Security.AccessControl.AccessControlType]::Allow))}
  $stream=[IO.FileSystemAclExtensions]::Create([IO.FileInfo]::new($full),[IO.FileMode]::CreateNew,[Security.AccessControl.FileSystemRights]::FullControl,[IO.FileShare]::None,4096,[IO.FileOptions]::None,$acl)
  $stream.Write($bytes,0,$bytes.Length);$stream.Flush($true);$stream.Dispose();$stream=$null
  Assert-PrivateOperatorAcl $full
  $hash=(Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash.ToLowerInvariant()
  return [pscustomobject]@{ok=$true;mode=$SelectedMode;profilePath=$full;profileSha256=$hash;configuredFields=$Profile.Count;quiescenceDeclared=$false;remoteExecuted=$false}
 }finally{if($stream){$stream.Dispose()};if($bytes){[Array]::Clear($bytes,0,$bytes.Length)};$xml=$null}
}
function Read-OperatorProfile([string]$SelectedMode) {
 $ref=$operatorPersonalRef;$prefix='';$profile=@{}
 try{
 if($SelectedMode -eq 'Restore'){
  $ref=Read-OperatorText 'Ref do NOVO projeto pessoal descartavel (diferente da origem)'
  if($ref -notmatch '^[a-z]{20}$' -or $ref -eq $operatorPersonalRef){Stop-ProfilePreparation 'PROFILE_RESTORE_TARGET_REFUSED'}
  $profile['SC_RESTORE_PROJECT_REF']=$ref;$profile['SC_RESTORE_CONFIRM_PROJECT']=Read-OperatorText 'Repita exatamente o ref alvo'
  $profile['SC_RESTORE_ISOLATED']=Read-OperatorText 'Alvo pessoal isolado e descartavel confirmado? Digite YES'
  $profile['SC_RESTORE_SUPABASE_URL']='https://'+$ref+'.supabase.co';$profile['SC_RESTORE_SUPABASE_KEY']=Read-OperatorSecret 'Chave sb_secret do ALVO'
  $profile['SC_RESTORE_PG_RESTORE']=Read-OperatorText 'Caminho absoluto pg_restore.exe';$profile['SC_RESTORE_PSQL']=Read-OperatorText 'Caminho absoluto psql.exe';$prefix='SC_RESTORE_'
 }
 $profile[$prefix+'PGHOST']=Read-OperatorText 'Host exato de Connect (direct ou session pooler)' ('db.'+$ref+'.supabase.co')
 $profile[$prefix+'PGPORT']=Read-OperatorText 'Porta de Connect' '5432';$profile[$prefix+'PGDATABASE']='postgres'
 $profile[$prefix+'PGUSER']=Read-OperatorText 'Usuario de Connect: postgres ou postgres.ref no pooler' 'postgres'
 $profile[$prefix+'PGPASSWORD']=Read-OperatorSecret 'Senha PostgreSQL do projeto selecionado'
 $profile[$prefix+'PGSSLMODE']=Read-OperatorText 'TLS: verify-full (preferido) ou require explicitamente' 'verify-full'
 $profile[$prefix+'PGSSLROOTCERT']=Read-OperatorText 'Caminho absoluto certificado CA, se necessario'
 if($SelectedMode -ne 'Restore'){$profile['SC_RELEASE_PSQL']=Read-OperatorText 'Caminho absoluto psql.exe';$profile['SC_RELEASE_REPORT_DIRECTORY']=Read-OperatorText 'Diretorio privado EXISTENTE para reports readonly'}
 if($SelectedMode -eq 'Backup'){
  $profile['SC_BACKUP_SUPABASE_URL']='https://'+$operatorPersonalRef+'.supabase.co';$profile['SC_BACKUP_SUPABASE_KEY']=Read-OperatorSecret 'Chave sb_secret SOMENTE do projeto pessoal origem'
  $profile['SC_BACKUP_DESTINATION']=Read-OperatorText 'Diretorio privado EXISTENTE para archives';$profile['SC_BACKUP_PG_DUMP']=Read-OperatorText 'Caminho absoluto pg_dump.exe'
  $profile['SC_BACKUP_APP_SERVING_ROOT']=Read-OperatorText 'Raiz servida adicional proibida, se houver';$profile['SC_BACKUP_WORK_ROOT']=Read-OperatorText 'Raiz de trabalho adicional proibida, se houver'
  $profile['SC_BACKUP_ENCRYPTION_KEY']=New-OperatorBackupKey
 }
 if($SelectedMode -eq 'Restore'){$profile['SC_BACKUP_ENCRYPTION_KEY']=Read-OperatorSecret 'Chave base64 ORIGINAL do archive (nao gerar nova)'}
 if($SelectedMode -ne 'Check'){$profile['SC_BACKUP_KEY_ID']=Read-OperatorText 'ID da chave: novo para Backup, ORIGINAL para Restore'}
 return $profile
 }catch{foreach($value in $profile.Values){if($value -is [Security.SecureString]){$value.Dispose()}};$profile.Clear();throw}
}
function Invoke-OperatorProfilePreparation([string]$SelectedMode,[string]$Path) {
 $profile=$null
 try{
  if($env:OS -ne 'Windows_NT'){Stop-ProfilePreparation 'PROFILE_WINDOWS_REQUIRED'}
  if($PSVersionTable.PSVersion.Major -lt 7){Stop-ProfilePreparation 'PROFILE_POWERSHELL_REQUIRED'}
  if($SelectedMode -notin @('Check','Backup','Restore')){Stop-ProfilePreparation 'PROFILE_MODE_REQUIRED'}
  $null=Assert-OperatorProfilePath $Path
  $profile=Read-OperatorProfile $SelectedMode
  Publish-OperatorProfile $SelectedMode $Path $profile
 }finally{if($profile){foreach($value in $profile.Values){if($value -is [Security.SecureString]){$value.Dispose()}};$profile.Clear()}}
}
if($MyInvocation.InvocationName -ne '.'){
 try{Invoke-OperatorProfilePreparation $Mode $ProfilePath | ConvertTo-Json -Compress;exit 0}
 catch{$code=if($_.Exception.Message -cmatch '^PROFILE_[A-Z_]+$'){$_.Exception.Message}else{'PROFILE_PREPARATION_FAILED'};[pscustomobject]@{ok=$false;code=$code;remoteExecuted=$false}|ConvertTo-Json -Compress;exit 1}
}
