#requires -Version 7.5
[CmdletBinding()]
param(
    [ValidateSet('Prepare', 'Execute')][string]$Mode = 'Prepare',
    [string]$RunDirectory,
    [string]$ExpectedRunnerSha256,
    [switch]$AllowHostedWrites
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$VerbosePreference = 'SilentlyContinue'
$DebugPreference = 'SilentlyContinue'
$ProgressPreference = 'SilentlyContinue'

# One project, one pair of private input files. No caller-supplied URL, SQL,
# identity, email, role, password, key, redirect or transport is accepted.
$script:ProjectRef = 'twrydxsdemaykgvdlpyd'
$script:Origin = 'https://twrydxsdemaykgvdlpyd.supabase.co'
$script:PreviewOrigin = 'https://segundo-cerebro-of-git-codex-homo-efc4bb-kauanbarateli-projects.vercel.app'
$script:RepositoryRoot = 'C:\Users\Kauan Sousa Barateli\Documents\Codex\2026-10-07\inicie-a-constru-o-do-software-2\work\Segundo-Cerebro-homologacao-20261022'
$script:SecretEnvironment = Join-Path $script:RepositoryRoot '.env.local'
$script:PreviewEnvironment = Join-Path $script:RepositoryRoot 'work\private-homologacao-20261022\.env.preview'
$script:BodyLimit = 1048576
$script:RequestTimeoutMs = 15000
$script:TotalDeadlineMs = 300000
$script:Utf8 = [System.Text.UTF8Encoding]::new($false, $true)
$script:Client = $null
$script:Publishable = $null
$script:Secret = $null
$script:Manifest = $null
$script:JournalDirectory = $null
$script:JournalSequence = 0
$script:PendingWrite = $false
$script:HaltAfterTransport = $false
$script:Clock = $null
$script:Actors = @()
$script:SourcePins = [ordered]@{
    'src/lib/auth/runtime.ts' = '8bab54c26549c6c2785d899106444f223908d9fa082ee9894f8592964620a161'
    'src/lib/auth/policy.ts' = '30e867da8ac000e593ad5630de4ed3be92469b0b9c082ca6ef84fa8d8a925a59'
    'src/adapters/db/admin-runtime.ts' = '2def19ef96c91a2d5399c5289225ce1e39664bd8f9d3d1c2d07dd59f2ce4e37f'
    'supabase/migrations/20261007151834_identity_foundation.sql' = '7a5bc2b2b7f1fc953159ab31820ec734a5e0d9554ce92ca952465ddfc0fdddfc'
    'supabase/migrations/20261009151557_account_preferences.sql' = 'd183f660303227d21ceb11dd84a676d3ebeefb233d3a76802b2d0b380c58806c'
    'supabase/migrations/20261011113751_own_sessions.sql' = '0cab745bbb315ca700921db9addc13e113fb450eb08095fc37ec1e8ada1aae57'
    'supabase/migrations/20261022042432_spec08_calendar_participants.sql' = 'b7a0a3f893e1cf5ac5f95c3fe36d46a234fa372c24104df9af9535f350326b8c'
}
$script:Codes = @('PREPARED', 'PASSED', 'SETUP_REFUSED', 'SOURCE_REFUSED', 'MANIFEST_REFUSED', 'ENVIRONMENT_REFUSED', 'STATE_REFUSED', 'TRANSPORT_FAILED', 'DEADLINE_EXCEEDED', 'HTTP_SERVER_FAILURE', 'REDIRECT_REFUSED', 'RESPONSE_REFUSED', 'BODY_LIMIT_REFUSED', 'OWNERSHIP_REFUSED', 'ACCESS_STATE_REFUSED', 'SQL_REFUSAL_NOT_PROVEN', 'PERSISTENCE_REFUSED', 'REPLAY_REFUSED', 'EVENT_COUNT_REFUSED', 'TOKEN_LIFETIME_REFUSED', 'CLEANUP_REFUSED', 'UNEXPECTED_FAILURE')
$script:Checks = [ordered]@{}
$script:Counts = [ordered]@{ requests = 0; writesAttempted = 0; usersCreated = 0; signIns = 0; sqlRefusals = 0; profileUpdates = 0; explicitReplays = 0; profileUpdateEvents = 0; logouts = 0; usersDeleted = 0; usersAbsent = 0 }
$script:ActivePoint = 'SETUP'
$script:FailurePoint = $null
$script:FailureCode = $null
$script:CleanupFailure = $null
$script:AcceptancePassed = $false
$script:CleanupConfirmed = $false

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
function Mark-Check([string]$Name) { $script:Checks[$Name] = $true }

# This parser is called only by Execute, after the immutable run manifest exists.
# It does not evaluate dotenv syntax or export values to the process environment.
function Read-SelectedEnvironment([string]$Path, [string[]]$Names) {
    $pathChecked = Check-LocalPath $Path $true
    $bytes = [System.IO.File]::ReadAllBytes($pathChecked)
    Require ($bytes.Length -gt 0 -and $bytes.Length -le 65536) 'ENVIRONMENT_REFUSED'
    $selected = @{}
    try {
        $raw = $script:Utf8.GetString($bytes)
        foreach ($line in ($raw -split '\r?\n')) {
            if ($line -match '^\s*(?:#|$)') { continue }
            if ($line -notmatch '^([A-Z][A-Z0-9_]*)=(.*)$') { Refuse 'ENVIRONMENT_REFUSED' }
            $name = $Matches[1]
            if ($name -cnotin $Names) { continue }
            Require (-not $selected.ContainsKey($name)) 'ENVIRONMENT_REFUSED'
            $value = $Matches[2]
            if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) { $value = $value.Substring(1, $value.Length - 2) }
            Require ($value.Length -gt 0 -and $value.Length -le 4096 -and $value.Trim() -ceq $value -and $value -cnotmatch '[\x00-\x20\x7f"''\\]') 'ENVIRONMENT_REFUSED'
            $selected[$name] = $value
            $value = $null
        }
        foreach ($name in $Names) { Require ($selected.ContainsKey($name)) 'ENVIRONMENT_REFUSED' }
        return $selected
    } finally { $raw = $null; $line = $null; [System.Array]::Clear($bytes, 0, $bytes.Length) }
}
function New-Credentials {
    $key = Read-SelectedEnvironment $script:SecretEnvironment @('SUPABASE_SECRET_KEY')
    $preview = Read-SelectedEnvironment $script:PreviewEnvironment @('SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'APP_URL', 'APP_DEPLOYMENT_TARGET', 'APP_MODE')
    Require ($preview.SUPABASE_URL -ceq $script:Origin -and $preview.APP_URL -ceq $script:PreviewOrigin -and $preview.APP_DEPLOYMENT_TARGET -ceq 'homologation' -and $preview.APP_MODE -ceq 'supabase') 'ENVIRONMENT_REFUSED'
    Require ($key.SUPABASE_SECRET_KEY -cmatch '^sb_secret_[A-Za-z0-9_-]{8,256}$' -and $preview.SUPABASE_PUBLISHABLE_KEY -cmatch '^sb_publishable_[A-Za-z0-9_-]{8,256}$') 'ENVIRONMENT_REFUSED'
    $script:Secret = $key.SUPABASE_SECRET_KEY
    $script:Publishable = $preview.SUPABASE_PUBLISHABLE_KEY
    $key.Clear(); $preview.Clear()
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
function Require-SqlRefusal($Result) {
    Require ($Result.Status -eq 403 -and (Is-Map $Result.Data) -and (Has $Result.Data 'code') -and $Result.Data.code -ceq '42501') 'SQL_REFUSAL_NOT_PROVEN'
    Confirm-Operation $Result 'SQL_42501'
    $script:Counts.sqlRefusals++
}
function Require-Profile($Result, $Actor, [int]$ExpectedCount, $ExpectedName) {
    Require ($Result.Status -eq 200 -and $Result.Data -is [array] -and $Result.Data.Count -eq $ExpectedCount) 'PERSISTENCE_REFUSED'
    foreach ($row in $Result.Data) {
        Require ((Is-Map $row) -and $row.Count -eq 2 -and (Has $row 'user_id') -and $row.user_id -ceq $Actor.Id -and (Has $row 'display_name') -and $row.display_name -ceq $ExpectedName) 'OWNERSHIP_REFUSED'
    }
    Confirm-Operation $Result
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

try {
    Require ($PSVersionTable.PSVersion.Major -eq 7 -and $MyInvocation.InvocationName -cne '.') 'SETUP_REFUSED'
    $packageRoot = Check-LocalPath $PSScriptRoot $true
    Check-Source
    $runnerHash = File-Sha256 $PSCommandPath
    $runsRoot = Join-Path $packageRoot 'runs'
    if ($Mode -ceq 'Prepare') {
        Require (-not $AllowHostedWrites -and [string]::IsNullOrEmpty($RunDirectory) -and [string]::IsNullOrEmpty($ExpectedRunnerSha256)) 'SETUP_REFUSED'
        $runId = [System.Guid]::NewGuid().ToString('D')
        $runPath = Check-LocalPath (Join-Path $runsRoot $runId) $false
        Require (-not [System.IO.Directory]::Exists($runPath)) 'MANIFEST_REFUSED'
        [void][System.IO.Directory]::CreateDirectory($runPath)
        $fixtures = @()
        foreach ($label in @('A', 'B')) {
            $fixtures += [ordered]@{ label = $label; userId = [System.Guid]::NewGuid().ToString('D'); email = ('sc-homolog-' + $label.ToLowerInvariant() + '-' + $runId.Replace('-', '') + '@example.invalid'); appMetadata = [ordered]@{ sc_homologation_api_run = $runId; sc_homologation_api_actor = $label; sc_homologation_api_project = $script:ProjectRef }; clientId = ('sc-homolog-api-' + [System.Guid]::NewGuid().ToString('D')); displayName = ('Homologacao API ' + $label + ' ' + $runId.Replace('-', '').Substring(0, 12)) }
        }
        $manifest = [ordered]@{ schemaVersion = 1; kind = 'sc-homolog-api-v1'; runId = $runId; projectRef = $script:ProjectRef; origin = $script:Origin; previewOrigin = $script:PreviewOrigin; preparedAtUtc = [System.DateTimeOffset]::UtcNow.ToString('o'); runnerSha256 = $runnerHash; sourcePins = $script:SourcePins; actors = $fixtures; noUiAcceptance = $true; noAutomaticResume = $true }
        $manifestPath = Join-Path $runPath 'manifest.json'
        Write-NewJson $manifestPath $manifest
        $seal = [ordered]@{ schemaVersion = 1; manifestSha256 = File-Sha256 $manifestPath; runnerSha256 = $runnerHash }
        Write-NewJson (Join-Path $runPath 'manifest-seal.json') $seal
        [ordered]@{ ok = $true; mode = 'Prepare'; code = 'PREPARED'; runId = $runId; fixtureCount = 2; requests = 0; writes = 0; secretsRead = $false; remoteExecuted = $false } | ConvertTo-Json -Compress
        exit 0
    }
    Require ($AllowHostedWrites -and $ExpectedRunnerSha256 -cmatch '^[a-f0-9]{64}$' -and $ExpectedRunnerSha256 -ceq $runnerHash) 'SETUP_REFUSED'
    $runPath = Check-LocalPath $RunDirectory $true
    Require ([System.IO.Directory]::GetParent($runPath).FullName -ceq $runsRoot -and (Is-Uuid ([System.IO.Path]::GetFileName($runPath)))) 'MANIFEST_REFUSED'
    $script:Manifest = Read-Json (Join-Path $runPath 'manifest.json')
    $seal = Read-Json (Join-Path $runPath 'manifest-seal.json')
    Require ((Is-Map $script:Manifest) -and $script:Manifest.kind -ceq 'sc-homolog-api-v1' -and $script:Manifest.schemaVersion -eq 1 -and $script:Manifest.runId -ceq [System.IO.Path]::GetFileName($runPath) -and $script:Manifest.projectRef -ceq $script:ProjectRef -and $script:Manifest.origin -ceq $script:Origin -and $script:Manifest.previewOrigin -ceq $script:PreviewOrigin -and $script:Manifest.runnerSha256 -ceq $runnerHash -and $seal.runnerSha256 -ceq $runnerHash -and $seal.manifestSha256 -ceq (File-Sha256 (Join-Path $runPath 'manifest.json')) -and $script:Manifest.actors -is [array] -and $script:Manifest.actors.Count -eq 2) 'MANIFEST_REFUSED'
    Require ((Is-Map $script:Manifest.sourcePins) -and $script:Manifest.sourcePins.Count -eq $script:SourcePins.Count) 'SOURCE_REFUSED'
    foreach ($entry in $script:SourcePins.GetEnumerator()) { Require ((Has $script:Manifest.sourcePins $entry.Key) -and $script:Manifest.sourcePins[$entry.Key] -ceq $entry.Value) 'SOURCE_REFUSED' }
    for ($index = 0; $index -lt 2; $index++) {
        $fixture = $script:Manifest.actors[$index]; $label = @('A', 'B')[$index]
        Require ($fixture.label -ceq $label -and (Is-Uuid $fixture.userId) -and $fixture.email -ceq ('sc-homolog-' + $label.ToLowerInvariant() + '-' + $script:Manifest.runId.Replace('-', '') + '@example.invalid') -and $fixture.clientId -cmatch '^sc-homolog-api-[a-f0-9-]{36}$' -and $fixture.displayName -ceq ('Homologacao API ' + $label + ' ' + $script:Manifest.runId.Replace('-', '').Substring(0, 12)) -and (Is-Map $fixture.appMetadata) -and $fixture.appMetadata.Count -eq 3 -and $fixture.appMetadata.sc_homologation_api_run -ceq $script:Manifest.runId -and $fixture.appMetadata.sc_homologation_api_actor -ceq $label -and $fixture.appMetadata.sc_homologation_api_project -ceq $script:ProjectRef) 'MANIFEST_REFUSED'
    }
    Require ($script:Manifest.actors[0].userId -cne $script:Manifest.actors[1].userId -and $script:Manifest.actors[0].clientId -cne $script:Manifest.actors[1].clientId) 'MANIFEST_REFUSED'
    $script:JournalDirectory = Join-Path $runPath 'journal'
    Require (-not [System.IO.Directory]::Exists($script:JournalDirectory) -and -not [System.IO.File]::Exists((Join-Path $runPath 'result.json'))) 'MANIFEST_REFUSED'
    [void][System.IO.Directory]::CreateDirectory($script:JournalDirectory)
    Journal 'control' 'EXECUTION' 'NONE' $false 'STARTED_NO_RESUME'
    New-Credentials
    $handler = [System.Net.Http.HttpClientHandler]::new()
    $handler.AllowAutoRedirect = $false; $handler.UseCookies = $false; $handler.UseDefaultCredentials = $false; $handler.MaxResponseHeadersLength = 16; $handler.AutomaticDecompression = [System.Net.DecompressionMethods]::None
    $script:Client = [System.Net.Http.HttpClient]::new($handler, $true)
    $script:Client.Timeout = [System.Threading.Timeout]::InfiniteTimeSpan
    $script:Clock = [System.Diagnostics.Stopwatch]::StartNew()
    foreach ($fixture in $script:Manifest.actors) { $script:Actors += New-Actor $fixture }
    $a = $script:Actors[0]; $b = $script:Actors[1]
    $script:ActivePoint = 'SETTINGS'
    $settings = Invoke-Operation 'SETTINGS'
    Require ($settings.Status -eq 200 -and (Has $settings.Data 'disable_signup') -and $settings.Data.disable_signup -ceq $true -and (Has $settings.Data 'external') -and (Has $settings.Data.external 'email') -and $settings.Data.external.email -ceq $true -and (Has $settings.Data.external 'anonymous_users') -and $settings.Data.external.anonymous_users -ceq $false) 'ENVIRONMENT_REFUSED'
    Confirm-Operation $settings; Mark-Check 'signupDisabledEmailEnabledAnonymousDisabled'
    foreach ($actor in $script:Actors) {
        $script:ActivePoint = 'PRECREATE_' + $actor.Label
        $missing = Invoke-Operation 'ADMIN_ABSENCE' $actor
        Require ($missing.Status -eq 404 -and (Has $missing.Data 'error_code') -and $missing.Data.error_code -ceq 'user_not_found') 'OWNERSHIP_REFUSED'
        Confirm-Operation $missing 'ABSENT_404'
    }
    foreach ($actor in $script:Actors) {
        $script:ActivePoint = 'CREATE_' + $actor.Label
        $created = Invoke-Operation 'ADMIN_CREATE' $actor -Body @{ id = $actor.Id; email = $actor.Email; password = $actor.Password; email_confirm = $true; app_metadata = $actor.Marker }
        Require ($created.Status -eq 200 -or $created.Status -eq 201) 'RESPONSE_REFUSED'; Check-User $created.Data $actor
        Confirm-Operation $created; $actor.CreateConfirmed = $true; $script:Counts.usersCreated++
        $script:ActivePoint = 'SIGNIN_' + $actor.Label
        $signed = Invoke-Operation 'SIGN_IN' $actor -Body @{ email = $actor.Email; password = $actor.Password }
        Require ($signed.Status -eq 200) 'RESPONSE_REFUSED'; Set-Session $signed.Data $actor
        Confirm-Operation $signed; $actor.SignInConfirmed = $true; $actor.Password = $null; $script:Counts.signIns++
        $script:ActivePoint = 'GET_USER_' + $actor.Label
        $user = Invoke-Operation 'GET_USER' $actor
        Require ($user.Status -eq 200) 'RESPONSE_REFUSED'; Check-User $user.Data $actor; Confirm-Operation $user
        Require-Access (Invoke-Operation 'ACCESS' $actor -Body @{}) $actor
        Mark-Check ('ordinarySession' + $actor.Label)
    }
    Require ($a.SessionId -cne $b.SessionId -and $a.Token -cne $b.Token) 'ACCESS_STATE_REFUSED'
    $script:ActivePoint = 'RLS_BEFORE'
    Require-Profile (Invoke-Operation 'OWN_PROFILE' $a) $a 1 $null
    Require-Profile (Invoke-Operation 'FOREIGN_PROFILE' $a $b) $b 0 $null
    Require-Profile (Invoke-Operation 'OWN_PROFILE' $b) $b 1 $null
    Require-Profile (Invoke-Operation 'FOREIGN_PROFILE' $b $a) $a 0 $null
    Mark-Check 'ownProfilesOneForeignProfilesZero'
    $script:ActivePoint = 'DIRECT_ROLE_WRITE'
    Require-SqlRefusal (Invoke-Operation 'DIRECT_ROLE_WRITE' $a -Body @{ role = 'user' })
    $script:ActivePoint = 'DIRECT_MODERATION_WRITE'
    Require-SqlRefusal (Invoke-Operation 'DIRECT_MODERATION_WRITE' $a -Body @{ must_change_password = $false })
    Require-Access (Invoke-Operation 'ACCESS' $a -Body @{}) $a
    Mark-Check 'directRoleModerationWritesDenied42501'
    $script:ActivePoint = 'EVENT_BASELINE'
    $events = Invoke-Operation 'PROFILE_EVENTS' $a
    Require ($events.Status -eq 200 -and $events.Data -is [array] -and $events.Data.Count -eq 0) 'EVENT_COUNT_REFUSED'; Confirm-Operation $events
    $body = @{ p_resource = 'profile'; p_patch = @{ display_name = $a.DisplayName }; p_client_id = $a.ClientId; p_canal = 'api' }
    $script:ActivePoint = 'PROFILE_UPDATE'
    $updated = Invoke-Operation 'PROFILE_UPDATE' $a -Body $body
    Require ($updated.Status -eq 200 -and (Has $updated.Data 'user_id') -and $updated.Data.user_id -ceq $a.Id -and (Has $updated.Data 'display_name') -and $updated.Data.display_name -ceq $a.DisplayName) 'PERSISTENCE_REFUSED'
    Confirm-Operation $updated; $script:Counts.profileUpdates++
    $script:ActivePoint = 'PROFILE_REPLAY'
    $replayed = Invoke-Operation 'PROFILE_UPDATE' $a -Body $body
    Require ($replayed.Status -eq 200 -and $replayed.BodySha256 -ceq $updated.BodySha256) 'REPLAY_REFUSED'
    Confirm-Operation $replayed; $script:Counts.explicitReplays++
    Require-Profile (Invoke-Operation 'OWN_PROFILE' $a) $a 1 $a.DisplayName
    $events = Invoke-Operation 'PROFILE_EVENTS' $a
    Require ($events.Status -eq 200 -and $events.Data -is [array] -and $events.Data.Count -eq 1) 'EVENT_COUNT_REFUSED'
    $event = $events.Data[0]
    Require ($event.Count -eq 6 -and $event.user_id -ceq $a.Id -and $event.entity_id -ceq $a.Id -and $event.entity_type -ceq 'profile' -and $event.action -ceq 'updated' -and $event.canal -ceq 'api' -and (Is-Uuid $event.id)) 'EVENT_COUNT_REFUSED'
    Confirm-Operation $events; $script:Counts.profileUpdateEvents = 1
    Mark-Check 'canonicalProfileUpdateReplayAndSingleEvent'
    $script:ActivePoint = 'LOGOUT_A'
    Logout-Actor $a
    Require-TokenLive $a
    Require-Profile (Invoke-Operation 'OWN_PROFILE' $a) $a 0 $null
    Require-SqlRefusal (Invoke-Operation 'ACCESS' $a -Body @{})
    Require-TokenLive $a
    Mark-Check 'revokedSessionDeniedWhileOriginalJwtUnexpired'
    $script:ActivePoint = 'B_UNCHANGED'
    Require-Profile (Invoke-Operation 'OWN_PROFILE' $b) $b 1 $null
    Require-Profile (Invoke-Operation 'FOREIGN_PROFILE' $b $a) $a 0 $null
    Require-Access (Invoke-Operation 'ACCESS' $b -Body @{}) $b
    Mark-Check 'otherUserIntactAfterGlobalLogoutA'
    $script:ActivePoint = 'LOGOUT_B'
    Logout-Actor $b
    Mark-Check 'bothGlobalLogoutsConfirmed'
    $script:AcceptancePassed = $true
} catch {
    $script:FailureCode = Known-Code $_
    $script:FailurePoint = $script:ActivePoint
} finally {
    if ($Mode -ceq 'Execute' -and $null -ne $script:Client -and $script:Actors.Count -gt 0) { Cleanup-Actors }
    if ($null -ne $script:Client) { $script:Client.Dispose() }
    foreach ($actor in $script:Actors) { $actor.Password = $null; $actor.Token = $null; $actor.SessionId = $null }
    $script:Secret = $null; $script:Publishable = $null
}

$expectedCounts = @{ requests = 36; writesAttempted = 12; usersCreated = 2; signIns = 2; sqlRefusals = 3; profileUpdates = 1; explicitReplays = 1; profileUpdateEvents = 1; logouts = 2; usersDeleted = 2; usersAbsent = 2 }
$exactCounts = $script:Checks.Count -eq 9
foreach ($entry in $expectedCounts.GetEnumerator()) { if ($script:Counts[$entry.Key] -ne $entry.Value) { $exactCounts = $false } }
if ($script:AcceptancePassed -and $script:CleanupConfirmed -and -not $exactCounts) { $script:FailureCode = 'STATE_REFUSED'; $script:FailurePoint = 'FINAL_COUNTS' }
$report = [ordered]@{ schemaVersion = 1; kind = 'sc-homolog-api-v1'; mode = $Mode; ok = ($script:AcceptancePassed -and $script:CleanupConfirmed -and $exactCounts); code = if ($script:FailureCode) { $script:FailureCode } elseif (-not $script:CleanupConfirmed) { 'CLEANUP_REFUSED' } else { 'PASSED' }; failurePoint = $script:FailurePoint; cleanupFailure = $script:CleanupFailure; checks = $script:Checks; counts = $script:Counts; exactCounts = $exactCounts; writeOutcomeUncertain = $script:PendingWrite; transportHalted = $script:HaltAfterTransport; cleanupConfirmed = $script:CleanupConfirmed; uiAccepted = $false; previewAppAccepted = $false; productionTouched = $false; atUtc = [System.DateTimeOffset]::UtcNow.ToString('o') }
try { if ($null -ne $script:JournalDirectory) { Write-NewJson (Join-Path ([System.IO.Directory]::GetParent($script:JournalDirectory).FullName) 'result.json') $report } } catch { $report.ok = $false; $report.code = 'MANIFEST_REFUSED' }
$report | ConvertTo-Json -Depth 12 -Compress
if ($report.ok) { exit 0 } else { exit 1 }
