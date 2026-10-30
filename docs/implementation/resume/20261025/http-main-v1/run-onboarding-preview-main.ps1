#requires -Version 7.5
[CmdletBinding()]
param([ValidateSet('Prepare','Execute')][string]$Mode='Prepare',[string]$RunDirectory,[string]$ExpectedRunnerSha256,[switch]$AllowHostedWrites,[securestring]$SecretKey,[securestring]$PublishableKey,[securestring]$AuthorizedDeploymentLink)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop';$VerbosePreference='SilentlyContinue';$DebugPreference='SilentlyContinue';$ProgressPreference='SilentlyContinue'
$script:ProjectRef='twrydxsdemaykgvdlpyd';$script:Origin='https://twrydxsdemaykgvdlpyd.supabase.co'
$script:RepositoryRoot='C:\Users\Kauan Sousa Barateli\Documents\Codex\2026-10-07\inicie-a-constru-o-do-software-2\work\Segundo-Cerebro-mvp-goals-terminal-20261023'
$script:BodyLimit=1048576;$script:RequestTimeoutMs=15000;$script:TotalDeadlineMs=300000;$script:Utf8=[Text.UTF8Encoding]::new($false,$true)
$script:Client=$null;$script:Secret=$null;$script:Publishable=$null;$script:Clock=$null;$script:Manifest=$null;$script:JournalDirectory=$null;$script:JournalSequence=0;$script:PendingWrite=$false;$script:HaltAfterTransport=$false
$script:Actors=@();$script:SourcePins=[ordered]@{};$script:ActivePoint='SETUP';$script:FailurePoint=$null;$script:FailureCode=$null;$script:CleanupFailure=$null;$script:CleanupConfirmed=$false;$script:AcceptancePassed=$false
$script:Config=$null;$script:Matrix=$null;$script:Ctx=@{};$script:PreviewClients=@{};$script:ProtectionClient=$null;$script:ProtectionJar=$null;$script:ProtectionCookies=@();$script:ProtectionReady=$false;$script:ProtectionPhase='NOT_RUN';$script:ProtectionRequests=0;$script:ProtectionStatus=0;$script:LinkUsed=$false
$script:Counts=[ordered]@{requests=0;writesAttempted=0;usersCreated=0;signIns=0;sqlRefusals=0;profileUpdates=0;explicitReplays=0;profileUpdateEvents=0;logouts=0;usersDeleted=0;usersAbsent=0;previewRequests=0;previewWritesAttempted=0;stepsKnown=0}
$script:Codes=@('PREPARED','PASSED','SETUP_REFUSED','SOURCE_REFUSED','MANIFEST_REFUSED','ENVIRONMENT_REFUSED','STATE_REFUSED','TRANSPORT_FAILED','DEADLINE_EXCEEDED','HTTP_SERVER_FAILURE','REDIRECT_REFUSED','RESPONSE_REFUSED','BODY_LIMIT_REFUSED','OWNERSHIP_REFUSED','ACCESS_STATE_REFUSED','PERSISTENCE_REFUSED','REPLAY_REFUSED','EVENT_COUNT_REFUSED','TOKEN_LIFETIME_REFUSED','CLEANUP_REFUSED','UNEXPECTED_FAILURE','PROTECTION_INPUT_REFUSED','HOLD_PROTECTION','HOLD_AUTH_PREFLIGHT','SNAPSHOT_REFUSED','COMMAND_REFUSED','COMMIT_UNCONFIRMED','COOKIE_REFUSED','CODEC_REFUSED','COOKIE_CLIENT_REFUSED','HOLD_PREVIEW_BINDINGS')
function Refuse([string]$Code) {
    if ($Code -cnotin $script:Codes) { $Code = 'UNEXPECTED_FAILURE' }
    throw [System.InvalidOperationException]::new($Code)
}

function Require([bool]$Condition, [string]$Code) { if (-not $Condition) { Refuse $Code } }

function Known-Code($ErrorRecord) {
    $message = $ErrorRecord.Exception.Message
    if ($message -cin $script:Codes) { return $message }
    return 'UNEXPECTED_FAILURE'
}

function Is-Map($Value) { return $Value -is [System.Collections.IDictionary] }

function Has($Value, [string]$Name) { return (Is-Map $Value) -and $Value.Contains($Name) }

function Is-Uuid($Value) { return $Value -is [string] -and $Value -cmatch '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' }

function Sha256([byte[]]$Bytes) { return [System.Convert]::ToHexString([System.Security.Cryptography.SHA256]::HashData($Bytes)).ToLowerInvariant() }

function File-Sha256([string]$Path) { return Sha256 ([System.IO.File]::ReadAllBytes($Path)) }

function Check-LocalPath([string]$Path, [bool]$MustExist) {
    Require ([System.IO.Path]::IsPathFullyQualified($Path)) 'SETUP_REFUSED'
    $full = [System.IO.Path]::GetFullPath($Path)
    Require ($full -cnotmatch '(?i)(?:^|[\\/])OneDrive(?:[\\/]|$)') 'SETUP_REFUSED'
    $walk = $full
    while ($walk) {
        if ([System.IO.File]::Exists($walk) -or [System.IO.Directory]::Exists($walk)) {
            Require (([System.IO.File]::GetAttributes($walk) -band [System.IO.FileAttributes]::ReparsePoint) -eq 0) 'SETUP_REFUSED'
        }
        $parent = [System.IO.Directory]::GetParent($walk)
        if ($null -eq $parent) { break }
        $walk = $parent.FullName
    }
    if ($MustExist) { Require ([System.IO.File]::Exists($full) -or [System.IO.Directory]::Exists($full)) 'SETUP_REFUSED' }
    return $full
}

function Write-NewJson([string]$Path, $Value) {
    $bytes = $script:Utf8.GetBytes(($Value | ConvertTo-Json -Depth 32 -Compress))
    Require ($bytes.Length -le $script:BodyLimit) 'BODY_LIMIT_REFUSED'
    $stream = [System.IO.FileStream]::new($Path, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
    try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) } finally { $stream.Dispose(); [System.Array]::Clear($bytes, 0, $bytes.Length) }
}

function Read-Json([string]$Path) {
    $bytes = [System.IO.File]::ReadAllBytes((Check-LocalPath $Path $true))
    Require ($bytes.Length -gt 0 -and $bytes.Length -le $script:BodyLimit) 'MANIFEST_REFUSED'
    try { return ($script:Utf8.GetString($bytes) | ConvertFrom-Json -AsHashtable -Depth 32 -DateKind String) } finally { [System.Array]::Clear($bytes, 0, $bytes.Length) }
}

function Check-Source {
    foreach ($entry in $script:SourcePins.GetEnumerator()) {
        $path = Check-LocalPath (Join-Path $script:RepositoryRoot $entry.Key) $true
        Require ((File-Sha256 $path) -ceq $entry.Value) 'SOURCE_REFUSED'
    }
}

function Journal([string]$Phase, [string]$Operation, [string]$Actor, [bool]$Write, [string]$Outcome, [int]$Status = 0) {
    $script:JournalSequence++
    Write-NewJson (Join-Path $script:JournalDirectory ('{0:d4}.json' -f $script:JournalSequence)) ([ordered]@{
        schemaVersion = 1; runId = $script:Manifest.runId; sequence = $script:JournalSequence; phase = $Phase; operation = $Operation; actor = $Actor; stateChanging = $Write; outcome = $Outcome; httpStatus = $Status; atUtc = [System.DateTimeOffset]::UtcNow.ToString('o')
    })
}

function Confirm-Operation($Result, [string]$Outcome = 'KNOWN') {
    Journal 'after' $Result.Operation $Result.Actor $Result.Write $Outcome $Result.Status
    $script:PendingWrite = $false
}

function New-Actor($Fixture) {
    $random = [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
    try { $password = 'Sc9!' + [System.Convert]::ToBase64String($random).TrimEnd('=').Replace('+', '-').Replace('/', '_') } finally { [System.Array]::Clear($random, 0, $random.Length) }
    return [pscustomobject]@{ Label = $Fixture.label; Id = $Fixture.userId; Email = $Fixture.email; Marker = $Fixture.appMetadata; ClientId = $Fixture.clientId; DisplayName = $Fixture.displayName; Password = $password; Token = $null; SessionId = $null; ExpiresAt = 0L; CreateConfirmed = $false; SignInConfirmed = $false; LoggedOut = $false; Deleted = $false; Absent = $false }
}

function Require-TokenLive($Actor) {
    Require ($null -ne $Actor -and $Actor.Token -is [string] -and $Actor.Token.Length -gt 0 -and $Actor.ExpiresAt -gt ([System.DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + 60)) 'TOKEN_LIFETIME_REFUSED'
}

function Check-User($User, $Actor) {
    Require ((Is-Map $User) -and (Has $User 'id') -and $User.id -ceq $Actor.Id -and (Has $User 'email') -and $User.email -ceq $Actor.Email -and (Has $User 'role') -and $User.role -ceq 'authenticated' -and (Has $User 'is_anonymous') -and $User.is_anonymous -ceq $false -and (Has $User 'email_confirmed_at') -and $User.email_confirmed_at -is [string] -and $User.email_confirmed_at.Length -gt 0 -and (Has $User 'app_metadata')) 'OWNERSHIP_REFUSED'
    foreach ($entry in $Actor.Marker.GetEnumerator()) { Require ((Has $User.app_metadata $entry.Key) -and $User.app_metadata[$entry.Key] -ceq $entry.Value) 'OWNERSHIP_REFUSED' }
}

function Set-Session($Data, $Actor) {
    Require ((Is-Map $Data) -and (Has $Data 'access_token') -and $Data.access_token -is [string] -and $Data.access_token.Length -le 32768 -and $Data.access_token -cmatch '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' -and (Has $Data 'user')) 'RESPONSE_REFUSED'
    Check-User $Data.user $Actor
    $pieces = $Data.access_token.Split('.')
    $payload = $pieces[1].Replace('-', '+').Replace('_', '/')
    switch ($payload.Length % 4) { 2 { $payload += '==' } 3 { $payload += '=' } 1 { Refuse 'RESPONSE_REFUSED' } }
    $rawClaims = [System.Convert]::FromBase64String($payload)
    try { $claims = $script:Utf8.GetString($rawClaims) | ConvertFrom-Json -AsHashtable -Depth 16 -DateKind String } finally { [System.Array]::Clear($rawClaims, 0, $rawClaims.Length) }
    Require ((Is-Map $claims) -and (Has $claims 'sub') -and $claims.sub -ceq $Actor.Id -and (Has $claims 'role') -and $claims.role -ceq 'authenticated' -and (Has $claims 'session_id') -and (Is-Uuid $claims.session_id) -and (Has $claims 'iss') -and $claims.iss -ceq ($script:Origin + '/auth/v1') -and (Has $claims 'exp') -and ($claims.exp -is [long] -or $claims.exp -is [int])) 'RESPONSE_REFUSED'
    $Actor.Token = $Data.access_token; $Actor.SessionId = $claims.session_id; $Actor.ExpiresAt = $claims.exp
    Require-TokenLive $Actor
    if (Has $Data 'refresh_token') { [void]$Data.Remove('refresh_token') }
}

function Operation-Spec([string]$Operation, $Actor, $Other) {
    $own = if ($null -ne $Actor) { Require (Is-Uuid $Actor.Id) 'STATE_REFUSED'; $Actor.Id } else { '' }
    $foreign = if ($null -ne $Other) { Require (Is-Uuid $Other.Id) 'STATE_REFUSED'; $Other.Id } else { '' }
    $profile = '/rest/v1/profiles?select=user_id%2Cdisplay_name&limit=2'
    switch -CaseSensitive ($Operation) {
        'SETTINGS' { return @{ Method = 'GET'; Path = '/auth/v1/settings'; Credential = 'public'; Write = $false } }
        'ADMIN_ABSENCE' { return @{ Method = 'GET'; Path = '/auth/v1/admin/users/' + $own; Credential = 'secret'; Write = $false } }
        'ADMIN_CREATE' { return @{ Method = 'POST'; Path = '/auth/v1/admin/users'; Credential = 'secret'; Write = $true } }
        'SIGN_IN' { return @{ Method = 'POST'; Path = '/auth/v1/token?grant_type=password'; Credential = 'public'; Write = $true } }
        'GET_USER' { return @{ Method = 'GET'; Path = '/auth/v1/user'; Credential = 'actor'; Write = $false } }
        'ACCESS' { return @{ Method = 'POST'; Path = '/rest/v1/rpc/my_access_state'; Credential = 'actor'; Write = $false } }
        'OWN_PROFILE' { return @{ Method = 'GET'; Path = $profile + '&user_id=eq.' + $own; Credential = 'actor'; Write = $false } }
        'FOREIGN_PROFILE' { Require ($foreign -cne $own) 'STATE_REFUSED'; return @{ Method = 'GET'; Path = $profile + '&user_id=eq.' + $foreign; Credential = 'actor'; Write = $false } }
        'DIRECT_ROLE_WRITE' { return @{ Method = 'PATCH'; Path = '/rest/v1/user_roles?user_id=eq.' + $own; Credential = 'actor'; Write = $true } }
        'DIRECT_MODERATION_WRITE' { return @{ Method = 'PATCH'; Path = '/rest/v1/user_moderation?user_id=eq.' + $own; Credential = 'actor'; Write = $true } }
        'PROFILE_UPDATE' { return @{ Method = 'POST'; Path = '/rest/v1/rpc/update_identity'; Credential = 'actor'; Write = $true } }
        'PROFILE_EVENTS' { return @{ Method = 'GET'; Path = '/rest/v1/domain_events?select=id%2Cuser_id%2Centity_type%2Centity_id%2Caction%2Ccanal&user_id=eq.' + $own + '&entity_type=eq.profile&entity_id=eq.' + $own + '&action=eq.updated&canal=eq.api&limit=2'; Credential = 'actor'; Write = $false } }
        'LOGOUT' { return @{ Method = 'POST'; Path = '/auth/v1/logout?scope=global'; Credential = 'actor'; Write = $true } }
        'ADMIN_GET' { return @{ Method = 'GET'; Path = '/auth/v1/admin/users/' + $own; Credential = 'secret'; Write = $false } }
        'ADMIN_DELETE' { return @{ Method = 'DELETE'; Path = '/auth/v1/admin/users/' + $own; Credential = 'secret'; Write = $true } }
        default { Refuse 'STATE_REFUSED' }
    }
}

function Invoke-Operation([string]$Operation, $Actor = $null, $Other = $null, $Body = $null) {
    Require (($script:Counts.requests+$script:Counts.previewRequests) -lt 64) 'STATE_REFUSED'
    Require (-not $script:PendingWrite -and -not $script:HaltAfterTransport) 'STATE_REFUSED'
    Require ($script:Clock.ElapsedMilliseconds -lt $script:TotalDeadlineMs) 'DEADLINE_EXCEEDED'
    $spec = Operation-Spec $Operation $Actor $Other
    $label = if ($null -eq $Actor) { 'NONE' } else { $Actor.Label }
    $uri = [System.Uri]::new($script:Origin + $spec.Path, [System.UriKind]::Absolute)
    Require ($uri.Scheme -ceq 'https' -and $uri.Host -ceq ($script:ProjectRef + '.supabase.co') -and $uri.Port -eq 443 -and $uri.UserInfo.Length -eq 0 -and $uri.Fragment.Length -eq 0 -and $uri.GetLeftPart([System.UriPartial]::Authority) -ceq $script:Origin -and $uri.AbsoluteUri -ceq ($script:Origin + $spec.Path)) 'ENVIRONMENT_REFUSED'
    $request = $null; $response = $null; $stream = $null; $buffer = $null; $bytes = $null; $memory = $null
    $cancel = [System.Threading.CancellationTokenSource]::new()
    $cancel.CancelAfter([System.Math]::Min($script:RequestTimeoutMs, $script:TotalDeadlineMs - [int]$script:Clock.ElapsedMilliseconds))
    try {
        $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($spec.Method), $uri)
        [void]$request.Headers.TryAddWithoutValidation('User-Agent', 'SegundoCerebro-Homologation-ApiProbe/1.0')
        [void]$request.Headers.TryAddWithoutValidation('Accept', 'application/json')
        [void]$request.Headers.TryAddWithoutValidation('Accept-Encoding', 'identity')
        [void]$request.Headers.TryAddWithoutValidation('Cache-Control', 'no-cache, no-store')
        $apiKey = if ($spec.Credential -ceq 'secret') { $script:Secret } else { $script:Publishable }
        [void]$request.Headers.TryAddWithoutValidation('apikey', $apiKey)
        if ($spec.Credential -ceq 'secret') { [void]$request.Headers.TryAddWithoutValidation('Authorization', ('Bearer ' + $script:Secret)) }
        elseif ($spec.Credential -ceq 'actor') { Require-TokenLive $Actor; [void]$request.Headers.TryAddWithoutValidation('Authorization', ('Bearer ' + $Actor.Token)) }
        if ($null -ne $Body) {
            $bodyBytes = $script:Utf8.GetBytes(($Body | ConvertTo-Json -Depth 16 -Compress))
            Require ($bodyBytes.Length -le $script:BodyLimit) 'BODY_LIMIT_REFUSED'
            $request.Content = [System.Net.Http.ByteArrayContent]::new($bodyBytes)
            $request.Content.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::new('application/json')
        }
        if ($spec.Method -ceq 'PATCH') { [void]$request.Headers.TryAddWithoutValidation('Prefer', 'return=minimal') }
        Journal 'before' $Operation $label $spec.Write 'PLANNED'
        $script:Counts.requests++
        if ($spec.Write) { $script:Counts.writesAttempted++; $script:PendingWrite = $true }
        $response = $script:Client.SendAsync($request, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead, $cancel.Token).GetAwaiter().GetResult()
        $status = [int]$response.StatusCode
        Require ($response.RequestMessage.RequestUri.AbsoluteUri -ceq $uri.AbsoluteUri) 'REDIRECT_REFUSED'
        if ($status -ge 300 -and $status -lt 400) { $script:HaltAfterTransport = $true; Refuse 'REDIRECT_REFUSED' }
        if ($status -ge 500) { $script:HaltAfterTransport = $true; Refuse 'HTTP_SERVER_FAILURE' }
        $declaredLength = $response.Content.Headers.ContentLength
        if ($null -ne $declaredLength) { Require ($declaredLength -ge 0 -and $declaredLength -le $script:BodyLimit) 'BODY_LIMIT_REFUSED' }
        $stream = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
        $memory = [System.IO.MemoryStream]::new()
        $buffer = [byte[]]::new(16384)
        while ($true) {
            $read = $stream.ReadAsync($buffer, 0, $buffer.Length, $cancel.Token).GetAwaiter().GetResult()
            if ($read -eq 0) { break }
            Require ($memory.Length + $read -le $script:BodyLimit) 'BODY_LIMIT_REFUSED'
            $memory.Write($buffer, 0, $read)
        }
        $cancel.Token.ThrowIfCancellationRequested()
        $bytes = $memory.ToArray()
        $data = $null
        if ($bytes.Length -gt 0) {
            Require ($null -ne $response.Content.Headers.ContentType -and $response.Content.Headers.ContentType.MediaType -ceq 'application/json') 'RESPONSE_REFUSED'
            $data = $script:Utf8.GetString($bytes) | ConvertFrom-Json -AsHashtable -Depth 32 -NoEnumerate -DateKind String
        }
        return [pscustomobject]@{ Operation = $Operation; Actor = $label; Write = $spec.Write; Status = $status; Data = $data; BodyBytes = $bytes.Length; BodySha256 = (Sha256 $bytes) }
    } catch {
        $code = Known-Code $_
        if ($code -ceq 'UNEXPECTED_FAILURE') {
            $script:HaltAfterTransport = $true
            if ($cancel.IsCancellationRequested) { Refuse 'DEADLINE_EXCEEDED' }
            Refuse 'TRANSPORT_FAILED'
        }
        throw
    } finally {
        if ($null -ne $stream) { $stream.Dispose() }; if ($null -ne $memory) { $memory.Dispose() }; if ($null -ne $response) { $response.Dispose() }; if ($null -ne $request) { $request.Dispose() }; $cancel.Dispose()
        if ($null -ne $buffer) { [System.Array]::Clear($buffer, 0, $buffer.Length) }; if ($null -ne $bytes) { [System.Array]::Clear($bytes, 0, $bytes.Length) }
        if (Get-Variable -Name bodyBytes -Scope Local -ErrorAction SilentlyContinue) { [System.Array]::Clear($bodyBytes, 0, $bodyBytes.Length) }
        $apiKey = $null
    }
}

function Require-Access($Result, $Actor) {
    Require ($Result.Status -eq 200 -and (Is-Map $Result.Data) -and $Result.Data.Count -eq 4 -and (Has $Result.Data 'user_id') -and $Result.Data.user_id -ceq $Actor.Id -and (Has $Result.Data 'role') -and $Result.Data.role -ceq 'user' -and (Has $Result.Data 'must_change_password') -and $Result.Data.must_change_password -ceq $false -and (Has $Result.Data 'entitlements') -and (Is-Map $Result.Data.entitlements) -and $Result.Data.entitlements.Count -eq 0) 'ACCESS_STATE_REFUSED'
    Confirm-Operation $Result
}

function Logout-Actor($Actor) {
    Require-TokenLive $Actor
    $result = Invoke-Operation 'LOGOUT' $Actor
    Require ($result.Status -eq 204 -and $result.BodyBytes -eq 0) 'RESPONSE_REFUSED'
    Confirm-Operation $result
    $Actor.LoggedOut = $true; $script:Counts.logouts++
}

function Cleanup-Actors {
    if ($script:PendingWrite -or $script:HaltAfterTransport) { $script:CleanupFailure = 'UNCERTAIN_HOLD'; return }
    foreach ($actor in $script:Actors) {
        if (-not $actor.CreateConfirmed) { continue }
        $script:ActivePoint = 'CLEANUP_' + $actor.Label
        try {
            if ($actor.SignInConfirmed -and -not $actor.LoggedOut) { Logout-Actor $actor }
            $read = Invoke-Operation 'ADMIN_GET' $actor
            Require ($read.Status -eq 200) 'CLEANUP_REFUSED'; Check-User $read.Data $actor; Confirm-Operation $read
            $deleted = Invoke-Operation 'ADMIN_DELETE' $actor -Body @{ should_soft_delete = $false }
            Require ($deleted.Status -eq 200 -and (Is-Map $deleted.Data)) 'CLEANUP_REFUSED'
            if ($deleted.Data.Count -gt 0) { Check-User $deleted.Data $actor }
            Confirm-Operation $deleted
            $actor.Deleted = $true; $script:Counts.usersDeleted++
            $absent = Invoke-Operation 'ADMIN_ABSENCE' $actor
            Require ($absent.Status -eq 404 -and (Is-Map $absent.Data) -and (Has $absent.Data 'error_code') -and $absent.Data.error_code -ceq 'user_not_found') 'CLEANUP_REFUSED'
            Confirm-Operation $absent 'ABSENT_404'
            $actor.Absent = $true; $script:Counts.usersAbsent++
        } catch { $script:CleanupFailure = Known-Code $_; return }
    }
    $script:CleanupConfirmed = (@($script:Actors | Where-Object { $_.CreateConfirmed -and -not $_.Absent }).Count -eq 0 -and -not $script:PendingWrite -and -not $script:HaltAfterTransport)
}
$runPath=$null;$prepared=$false;$hold=$false
try{
 Require ($PSVersionTable.PSVersion.Major -eq 7 -and $MyInvocation.InvocationName -cne '.') 'SETUP_REFUSED'
 Require ((File-Sha256 (Join-Path $PSScriptRoot 'Main.Runtime.ps1')) -ceq '8ded5861996dbd8c9fec058c87e2b67b463231d4d7f3e3717964281d14429000') 'SOURCE_REFUSED'
 . (Join-Path $PSScriptRoot 'Main.Runtime.ps1')
 $script:Config=Read-Json (Join-Path $PSScriptRoot 'main-config.json');$runnerHash=File-Sha256 $PSCommandPath;$configHash=File-Sha256 (Join-Path $PSScriptRoot 'main-config.json');$probe=Check-MainInputs
 Import-Module (Join-Path $PSScriptRoot 'PreviewCookieCodec.psm1') -Force
 if($Mode -ceq 'Prepare'){
  Require (-not $AllowHostedWrites -and [string]::IsNullOrEmpty($RunDirectory) -and [string]::IsNullOrEmpty($ExpectedRunnerSha256) -and $null -eq $SecretKey -and $null -eq $PublishableKey -and $null -eq $AuthorizedDeploymentLink) 'SETUP_REFUSED'
  $id=Prepare-MainManifest $probe $runnerHash $configHash;[ordered]@{code='PREPARED';runId=$id;fixtures=2;mainRequestsPlanned=64;protectionRequestsMaximum=3;requests=0;writes=0;secretsRead=$false;remoteExecuted=$false}|ConvertTo-Json -Compress;$prepared=$true
 }else{
  Require ($AllowHostedWrites -and $ExpectedRunnerSha256 -cmatch '^[a-f0-9]{64}$' -and $ExpectedRunnerSha256 -ceq $runnerHash) 'SETUP_REFUSED';Check-ExecuteBindings $probe
  $script:Manifest=Read-MainManifest $RunDirectory $probe $runnerHash $configHash;$runPath=Check-LocalPath $RunDirectory $true;$script:JournalDirectory=Join-Path $runPath 'journal';[void][IO.Directory]::CreateDirectory($script:JournalDirectory);Journal 'control' 'EXECUTION' 'NONE' $false 'STARTED_NO_RESUME';$script:Clock=[Diagnostics.Stopwatch]::StartNew()
  $script:ActivePoint='PROTECTION_PREFLIGHT';Protection-Preflight $AuthorizedDeploymentLink
  # No Auth key/password/actor exists in runner state until this proof succeeds.
  Require $script:ProtectionReady 'HOLD_PROTECTION';$script:ActivePoint='CREDENTIALS';Require ($null -ne $SecretKey -and $null -ne $PublishableKey) 'ENVIRONMENT_REFUSED'
  $script:Secret=[Net.NetworkCredential]::new('',$SecretKey).Password;$script:Publishable=[Net.NetworkCredential]::new('',$PublishableKey).Password;Require ($script:Secret -cmatch '^sb_secret_[A-Za-z0-9_-]{8,256}$' -and $script:Publishable -cmatch '^sb_publishable_[A-Za-z0-9_-]{8,256}$') 'ENVIRONMENT_REFUSED'
  $handler=[Net.Http.HttpClientHandler]::new();$handler.AllowAutoRedirect=$false;$handler.UseCookies=$false;$handler.UseDefaultCredentials=$false;$handler.MaxResponseHeadersLength=16;$handler.AutomaticDecompression=[Net.DecompressionMethods]::None;$script:Client=[Net.Http.HttpClient]::new($handler,$true);$script:Client.Timeout=[Threading.Timeout]::InfiniteTimeSpan
  foreach($fixture in $script:Manifest.actors){$actor=New-Actor $fixture;foreach($name in @('SessionJson')){$actor|Add-Member -NotePropertyName $name -NotePropertyValue $null};foreach($name in @('UserVerified','AccessVerified')){$actor|Add-Member -NotePropertyName $name -NotePropertyValue $false};$script:Actors+=$actor}
  foreach($step in $script:Matrix.requests){if($step.id -cmatch '^CLEANUP_'){continue};Invoke-MainStep $step}
  Require ($script:Counts.stepsKnown -eq 58 -and $script:Ctx.A.round.status -ceq 'complete' -and $script:Ctx.B.round.status -ceq 'complete') 'STATE_REFUSED'

  $script:AcceptancePassed=$true
 }
}catch{$script:FailureCode=Known-Code $_;$script:FailurePoint=$script:ActivePoint;$hold=$script:FailureCode -cin @('HOLD_PROTECTION','HOLD_AUTH_PREFLIGHT','HOLD_PREVIEW_BINDINGS')}
finally{
 $exportOk=$true
 if($null -ne $runPath -and $script:Actors.Count -gt 0){try{Export-KnownFixtureBindings $runPath 'fixture-bindings.json'}catch{$exportOk=$false;if(-not $script:FailureCode){$script:FailureCode='MANIFEST_REFUSED';$script:FailurePoint='BINDINGS_EXPORT'};$script:CleanupFailure='MANIFEST_REFUSED'}}
 if($Mode -ceq 'Execute' -and $null -ne $script:Client -and $script:Actors.Count -gt 0 -and $exportOk){Cleanup-Actors;try{Export-KnownFixtureBindings $runPath 'fixture-cleanup.json'}catch{if(-not $script:FailureCode){$script:FailureCode='MANIFEST_REFUSED';$script:FailurePoint='CLEANUP_EXPORT'}}}
 foreach($key in $script:PreviewClients.Keys){$client=$script:PreviewClients[$key];if($null -ne $client -and -not [object]::ReferenceEquals($client,$script:ProtectionClient)){$client.Dispose()}}
 if($null -ne $script:ProtectionClient){$script:ProtectionClient.Dispose()};if($null -ne $script:Client){$script:Client.Dispose()};foreach($actor in $script:Actors){$actor.Password=$null;$actor.Token=$null;$actor.SessionId=$null;$actor.SessionJson=$null};$script:Secret=$null;$script:Publishable=$null;$script:ProtectionCookies=@();$script:ProtectionJar=$null
}
if($prepared){exit 0}
$exact=($script:Counts.requests -eq 19 -and $script:Counts.previewRequests -eq 45 -and $script:Counts.usersCreated -eq 2 -and $script:Counts.signIns -eq 2 -and $script:Counts.logouts -eq 2 -and $script:Counts.usersDeleted -eq 2 -and $script:Counts.usersAbsent -eq 2 -and $script:Counts.stepsKnown -eq 58 -and $script:ProtectionRequests -le 3)
if($script:AcceptancePassed -and $script:CleanupConfirmed -and -not $exact){$script:FailureCode='STATE_REFUSED';$script:FailurePoint='FINAL_COUNTS'}
$withinBudget=($null -eq $script:Clock -or $script:Clock.ElapsedMilliseconds -lt 300000);if(-not $withinBudget){$script:FailureCode='DEADLINE_EXCEEDED';$script:FailurePoint='FINAL_ADMISSION'};$ok=$script:AcceptancePassed -and $script:CleanupConfirmed -and $exact -and $withinBudget -and [string]::IsNullOrEmpty($script:FailureCode)
$report=@{kind='sc-onboarding-preview-main-v1';source='3403a5aa1901c166e6cfc1206848bfdc1c34957a';ok=$ok;authEffectsStarted=($script:Counts.writesAttempted -gt 0);hold=$hold;admissionWithinBudget=$withinBudget;code=if($ok){'PASSED'}elseif($script:FailureCode){$script:FailureCode}else{'CLEANUP_REFUSED'};failurePoint=$script:FailurePoint;cleanupFailure=$script:CleanupFailure;protection=@{ready=$script:ProtectionReady;phase=$script:ProtectionPhase;httpStatus=$script:ProtectionStatus;requests=$script:ProtectionRequests;authorizedLinkUsed=$script:LinkUsed};counts=$script:Counts;exactCounts=$exact;writeOutcomeUncertain=$script:PendingWrite;transportHalted=$script:HaltAfterTransport;cleanupAuthConfirmed=$script:CleanupConfirmed;cleanupCascadeVerified=$null;rootReadOnlyProofPending=($script:Counts.usersCreated -gt 0 -or $script:PendingWrite);moduleReceiptKindsConfirmedA=if($script:AcceptancePassed){7}else{$null};moduleReceiptKindsConfirmedB=if($script:AcceptancePassed){0}else{$null};uiAccepted=$false;googleAccepted=$false;storageAccepted=$false;productionTouched=$false;existingQaTargeted=$false;credentialsPersisted=$false;rawDataEmitted=$false}
try{if($null -ne $runPath){Write-NewJson (Join-Path $runPath 'result.json') $report}}catch{$report.ok=$false;$report.code='MANIFEST_REFUSED'}
$report|ConvertTo-Json -Depth 12 -Compress
if($report.ok){exit 0}else{exit 1}
