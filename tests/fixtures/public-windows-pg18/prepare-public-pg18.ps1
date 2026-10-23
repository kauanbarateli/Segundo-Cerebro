param([switch]$Execute)

# Inert before filesystem/network/binary access, including the public manifest.
if (-not $Execute) {
    [Console]::Out.WriteLine('{"schemaVersion":1,"prepared":false,"executed":false,"restoreAccepted":false}')
    return
}

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:ExpectedManifestSha = '4898ebc2a3390ef2d2d9627c30fccc919186fd9c9e1b1280c763be5c089be1f0'
$script:NodeSha = '3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237'
$script:ManifestPurpose = 'Observed public PostgreSQL 18 local executable and bin DLL byte pins; no private data inspected'
$script:ManifestProvenance = 'Local public PostgreSQL installation; does not attest a signature or digest of the complete EDB distribution'

function New-PublicProvisionDiagnostic {
    param([object]$Phase,[object]$Reason,[object]$Major=$null,[object]$Minor=$null,[object]$DateKind=$null)
    $phases = @('runtime','manifest','temp','node-download','node-digest','pg-download','zip-open','zip-entry','selected-extract','selected-digest','binding','output','cleanup')
    $reasons = @('PUBLIC_RUNTIME_REFUSED','PUBLIC_MANIFEST_REFUSED','PUBLIC_TEMP_REFUSED','PUBLIC_PATH_REFUSED',
        'PUBLIC_DOWNLOAD_STATUS_REFUSED','PUBLIC_DOWNLOAD_HEADER_LENGTH_REFUSED','PUBLIC_DOWNLOAD_BODY_SIZE_REFUSED',
        'PUBLIC_ZIP_REFUSED','PUBLIC_ZIP_ENTRY_REFUSED','PUBLIC_ZIP_DUPLICATE','PUBLIC_ZIP_SELECTED_REFUSED',
        'PUBLIC_SELECTED_SIZE_REFUSED','PUBLIC_SELECTED_DIGEST_REFUSED','PUBLIC_SELECTED_MISSING','PUBLIC_OUTPUT_REFUSED')
    $closedPhase = if ($Phase -is [string] -and [Array]::IndexOf($phases,$Phase) -ge 0) { $Phase } else { 'unavailable' }
    $closedReason = if ($Reason -is [string] -and [Array]::IndexOf($reasons,$Reason) -ge 0) { $Reason } else { 'PUBLIC_UNAVAILABLE' }
    $result = [ordered]@{schemaVersion=1;prepared=$false;code='PUBLIC_PROVISION_REFUSED';phase=$closedPhase;reason=$closedReason;restoreAccepted=$false}
    if ($Major -is [int] -and $Major -ge 0 -and $Major -le 99) { $result.powershellMajor = $Major }
    if ($Minor -is [int] -and $Minor -ge 0 -and $Minor -le 99) { $result.powershellMinor = $Minor }
    if ($DateKind -is [bool]) { $result.dateKindAvailable = $DateKind }
    return $result
}

# First closed refusal only. Trusted catch messages are compared to own literals;
# no exception text, URL, header value or path can enter the projected record.
function Save-PublicProvisionRefusal {
    param([object]$Reason)
    if ($null -eq $script:ProvisionFailure) {
        $script:ProvisionFailure = New-PublicProvisionDiagnostic $script:ProvisionPhase $Reason $script:RuntimeMajor $script:RuntimeMinor $script:DateKindAvailable
    }
}

function Assert-PublicManifest {
    param([System.Collections.IDictionary]$Value)
    $keys = @('purpose','observedUtc','provenance','executed','files')
    if ($Value.Count -ne 5 -or @($keys | Where-Object { -not $Value.Contains($_) }).Count -ne 0 -or
        $Value.purpose -cne $script:ManifestPurpose -or $Value.provenance -cne $script:ManifestProvenance -or
        $Value.executed -isnot [bool] -or $Value.executed -ne $false -or
        $Value.observedUtc -isnot [string] -or $Value.observedUtc -cnotmatch '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3,7}Z$' -or
        $Value.files -isnot [array] -or $Value.files.Count -ne 30) { throw 'PUBLIC_MANIFEST_REFUSED' }
    $names = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    [long]$total = 0
    foreach ($item in $Value.files) {
        $fileKeys = @('name','bytes','sha256','fileVersion','productVersion')
        if ($item -isnot [System.Collections.IDictionary] -or $item.Count -ne 5 -or
            @($fileKeys | Where-Object { -not $item.Contains($_) }).Count -ne 0 -or
            $item.name -isnot [string] -or $item.name -cnotmatch '^(?:pg_restore\.exe|[A-Za-z0-9][A-Za-z0-9_.-]{0,100}\.dll)$' -or
            -not $names.Add($item.name) -or ($item.bytes -isnot [long] -and $item.bytes -isnot [int]) -or
            $item.bytes -lt 1 -or $item.bytes -gt 67108864 -or $item.sha256 -isnot [string] -or $item.sha256 -cnotmatch '^[a-f0-9]{64}$') { throw 'PUBLIC_MANIFEST_REFUSED' }
        foreach ($version in @($item.fileVersion,$item.productVersion)) {
            if ($null -ne $version -and ($version -isnot [string] -or $version -cnotmatch '^[0-9., ]{1,40}$')) { throw 'PUBLIC_MANIFEST_REFUSED' }
        }
        $total += $item.bytes
    }
    $exe = @($Value.files | Where-Object name -CEQ 'pg_restore.exe')
    if ($total -gt 268435456 -or $exe.Count -ne 1 -or $exe[0].bytes -ne 379392 -or
        $exe[0].sha256 -cne 'e07bdb23f2d2a7e4d2db7a50386cd43049f4216540fa18e2faf79b80ab43ac18' -or
        $exe[0].fileVersion -cne '18.4' -or $exe[0].productVersion -cne '18.4') { throw 'PUBLIC_MANIFEST_REFUSED' }
}

function Assert-PublicZipName {
    param([string]$Name, [long]$Attributes)
    if ($Name.Length -lt 1 -or $Name.Length -gt 512 -or $Name -cnotmatch '^pgsql/' -or
        $Name.Contains('\') -or $Name.Contains(':') -or $Name.Contains([char]0) -or
        @($Name.Split('/') | Where-Object { $_ -eq '..' -or $_ -eq '.' }).Count -ne 0 -or
        (($Attributes -shr 16) -band 61440) -eq 40960 -or ($Attributes -band 1024) -ne 0) { throw 'PUBLIC_ZIP_ENTRY_REFUSED' }
}

function Assert-PublicSelectedDigest {
    param([long]$ActualBytes,[string]$ActualSha,[long]$ExpectedBytes,[string]$ExpectedSha)
    if ($ActualBytes -ne $ExpectedBytes -or $ActualSha -cne $ExpectedSha -or $ExpectedSha -cnotmatch '^[a-f0-9]{64}$') { throw 'PUBLIC_SELECTED_DIGEST_REFUSED' }
}

# The public EOCD observation declares 22043 entries; this is a format pin,
# not a signature or an independently enumerated archive/DLL authentication.
function Assert-PublicZipEntryCount {
    param([object]$Value)
    if ($Value -isnot [int] -or $Value -ne 22043) { throw 'PUBLIC_ZIP_REFUSED' }
}

function Assert-PublicPath {
    param([string]$Path)
    $current = [IO.Path]::GetFullPath($Path)
    while ($current) {
        if ([IO.File]::Exists($current) -or [IO.Directory]::Exists($current)) {
            if (([IO.File]::GetAttributes($current) -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'PUBLIC_PATH_REFUSED' }
        }
        $parent = [IO.Path]::GetDirectoryName($current)
        if ($parent -eq $current) { break }
        $current = $parent
    }
}

function Get-PublicSha {
    param([string]$Path)
    $stream = [IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
    try { return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($stream)).ToLowerInvariant() } finally { $stream.Dispose() }
}

function Receive-PublicFile {
    param([Net.Http.HttpClient]$Client,[string]$Url,[string]$Destination,[long]$ExpectedBytes,[Threading.CancellationToken]$Token)
    $response = $null; $source = $null; $target = $null
    try {
        $response = $Client.GetAsync($Url,[Net.Http.HttpCompletionOption]::ResponseHeadersRead,$Token).GetAwaiter().GetResult()
        if ([int]$response.StatusCode -ne 200) { throw 'PUBLIC_DOWNLOAD_STATUS_REFUSED' }
        if ($response.Content.Headers.ContentLength -ne $ExpectedBytes) { throw 'PUBLIC_DOWNLOAD_HEADER_LENGTH_REFUSED' }
        $source = $response.Content.ReadAsStreamAsync($Token).GetAwaiter().GetResult()
        $target = [IO.File]::Open($Destination,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
        $buffer = [byte[]]::new(65536); [long]$count = 0
        try {
            while (($read = $source.ReadAsync($buffer,0,$buffer.Length,$Token).GetAwaiter().GetResult()) -gt 0) {
                $count += $read
                if ($count -gt $ExpectedBytes) { throw 'PUBLIC_DOWNLOAD_BODY_SIZE_REFUSED' }
                $target.WriteAsync($buffer,0,$read,$Token).GetAwaiter().GetResult()
            }
            if ($count -ne $ExpectedBytes) { throw 'PUBLIC_DOWNLOAD_BODY_SIZE_REFUSED' }
        } finally { [Array]::Clear($buffer,0,$buffer.Length) }
    } catch { Save-PublicProvisionRefusal $_.Exception.Message; throw } finally { if ($null -ne $target) { $target.Dispose() }; if ($null -ne $source) { $source.Dispose() }; if ($null -ne $response) { $response.Dispose() } }
}

$script:ProvisionFailure = $null; $script:ProvisionPhase = 'runtime'
$script:RuntimeMajor = $null; $script:RuntimeMinor = $null; $script:DateKindAvailable = $null
$ownedRoot = $null; $prepared = $false; $failurePublished = $false; $client = $null; $handler = $null; $budget = $null
try {
    $script:RuntimeMajor = $PSVersionTable.PSVersion.Major
    $script:RuntimeMinor = $PSVersionTable.PSVersion.Minor
    $script:DateKindAvailable = (Get-Command ConvertFrom-Json).Parameters.ContainsKey('DateKind')
    if (-not $IsWindows -or $PSVersionTable.PSVersion.Major -lt 7 -or -not $script:DateKindAvailable -or $env:GITHUB_ACTIONS -cne 'true' -or
        $env:RUNNER_OS -cne 'Windows' -or $env:GITHUB_REPOSITORY -cne 'kauanbarateli/Segundo-Cerebro') { throw 'PUBLIC_RUNTIME_REFUSED' }
    $script:ProvisionPhase = 'manifest'
    $manifestPath = Join-Path $PSScriptRoot 'pg18-public-manifest.json'
    Assert-PublicPath $manifestPath
    if ((Get-Item -LiteralPath $manifestPath).Length -ne 7136 -or (Get-PublicSha $manifestPath) -cne $script:ExpectedManifestSha) { throw 'PUBLIC_MANIFEST_REFUSED' }
    $manifest = [IO.File]::ReadAllText($manifestPath,[Text.UTF8Encoding]::new($false,$true)) | ConvertFrom-Json -AsHashtable -Depth 10 -DateKind String
    Assert-PublicManifest $manifest
    $script:ProvisionPhase = 'temp'
    if (-not [IO.Path]::IsPathFullyQualified($env:RUNNER_TEMP)) { throw 'PUBLIC_TEMP_REFUSED' }
    $temporaryRoot = [IO.Path]::GetFullPath($env:RUNNER_TEMP); Assert-PublicPath $temporaryRoot
    $ownedRoot = Join-Path $temporaryRoot ('sc-public-pg18-' + [Guid]::NewGuid().ToString('N'))
    if ([IO.Directory]::Exists($ownedRoot) -or [IO.File]::Exists($ownedRoot)) { throw 'PUBLIC_TEMP_REFUSED' }
    [void][IO.Directory]::CreateDirectory($ownedRoot)
    $binRoot = Join-Path $ownedRoot 'bin'; [void][IO.Directory]::CreateDirectory($binRoot)
    $nodePath = Join-Path $ownedRoot 'node.exe'; $zipPath = Join-Path $ownedRoot 'edb-public.zip'
    $budget = [Threading.CancellationTokenSource]::new([TimeSpan]::FromSeconds(240))
    $handler = [Net.Http.HttpClientHandler]::new(); $handler.AllowAutoRedirect = $false
    $client = [Net.Http.HttpClient]::new($handler); $client.Timeout = [Threading.Timeout]::InfiniteTimeSpan
    $script:ProvisionPhase = 'node-download'
    Receive-PublicFile $client 'https://nodejs.org/download/release/v24.19.0/win-x64/node.exe' $nodePath 92825416 $budget.Token
    $script:ProvisionPhase = 'node-digest'
    Assert-PublicSelectedDigest (Get-Item -LiteralPath $nodePath).Length (Get-PublicSha $nodePath) 92825416 $script:NodeSha
    $script:ProvisionPhase = 'pg-download'
    Receive-PublicFile $client 'https://get.enterprisedb.com/postgresql/postgresql-18.4-1-windows-x64-binaries.zip' $zipPath 337444127 $budget.Token
    $script:ProvisionPhase = 'zip-open'
    $zipSha = Get-PublicSha $zipPath
    $selected = [Collections.Generic.Dictionary[string,object]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach ($file in $manifest.files) { $selected.Add(('pgsql/bin/' + $file.name),$file) }
    $zipStream = [IO.File]::Open($zipPath,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
    try {
        $zip = [IO.Compression.ZipArchive]::new($zipStream,[IO.Compression.ZipArchiveMode]::Read,$true)
        try {
            Assert-PublicZipEntryCount $zip.Entries.Count
            $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
            $found = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
            foreach ($entry in $zip.Entries) {
                $script:ProvisionPhase = 'zip-entry'
                $budget.Token.ThrowIfCancellationRequested()
                Assert-PublicZipName $entry.FullName $entry.ExternalAttributes
                if (-not $seen.Add($entry.FullName)) { throw 'PUBLIC_ZIP_DUPLICATE' }
                if (-not $selected.ContainsKey($entry.FullName)) { continue }
                $expected = $selected[$entry.FullName]
                if ($entry.FullName -cne ('pgsql/bin/' + $expected.name) -or $entry.Length -ne $expected.bytes) { throw 'PUBLIC_ZIP_SELECTED_REFUSED' }
                $script:ProvisionPhase = 'selected-extract'
                $destination = Join-Path $binRoot $expected.name
                $source = $entry.Open(); $target = $null; $buffer = [byte[]]::new(65536); [long]$written = 0
                try {
                    $target = [IO.File]::Open($destination,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
                    while (($read = $source.Read($buffer,0,$buffer.Length)) -gt 0) {
                        $budget.Token.ThrowIfCancellationRequested(); $written += $read
                        if ($written -gt $expected.bytes) { throw 'PUBLIC_SELECTED_SIZE_REFUSED' }
                        $target.Write($buffer,0,$read)
                    }
                } catch { Save-PublicProvisionRefusal $_.Exception.Message; throw } finally { [Array]::Clear($buffer,0,$buffer.Length); if ($null -ne $target) { $target.Dispose() }; $source.Dispose() }
                $script:ProvisionPhase = 'selected-digest'
                Assert-PublicSelectedDigest $written (Get-PublicSha $destination) $expected.bytes $expected.sha256
                [void]$found.Add($expected.name)
            }
            if ($found.Count -ne 30) { throw 'PUBLIC_SELECTED_MISSING' }
        } catch { Save-PublicProvisionRefusal $_.Exception.Message; throw } finally { $zip.Dispose() }
    } catch { Save-PublicProvisionRefusal $_.Exception.Message; throw } finally { $zipStream.Dispose() }
    $script:ProvisionPhase = 'binding'
    $budget.Token.ThrowIfCancellationRequested()
    # ALL selected files have matched before ANY downloaded executable can run.
    $bindingPath = Join-Path $ownedRoot 'public-probe-binding.json'; $reportPath = Join-Path $ownedRoot 'public-probe-report.json'
    $binding = [ordered]@{schemaVersion=1;purpose='PUBLIC_PG18_PROVISIONED_SELECTED_FILES';workRoot=$ownedRoot;nodePath=$nodePath;binPath=$binRoot;
        manifestPath=$manifestPath;manifestSha256=$script:ExpectedManifestSha;zipBytes=337444127;zipSha256=$zipSha}
    [IO.File]::WriteAllText($bindingPath,($binding|ConvertTo-Json -Depth 5 -Compress),[Text.UTF8Encoding]::new($false))
    [IO.File]::Delete($zipPath)
    $script:ProvisionPhase = 'output'
    if (-not [IO.File]::Exists($env:GITHUB_OUTPUT)) { throw 'PUBLIC_OUTPUT_REFUSED' }; Assert-PublicPath $env:GITHUB_OUTPUT
    [IO.File]::AppendAllText($env:GITHUB_OUTPUT,("node=$nodePath`nbinding=$bindingPath`nreport=$reportPath`nroot=$ownedRoot`n"),[Text.UTF8Encoding]::new($false))
    $prepared = $true
    [Console]::Out.WriteLine('{"schemaVersion":1,"prepared":true,"selectedFiles":30,"binaryExecuted":false,"officialZipSignatureAttested":false,"restoreAccepted":false}')
} catch {
    Save-PublicProvisionRefusal $_.Exception.Message
    [Console]::Out.WriteLine(($script:ProvisionFailure | ConvertTo-Json -Depth 4 -Compress))
    $failurePublished = $true
    exit 1
} finally {
    $script:ProvisionPhase = 'cleanup'; $cleanupRefused = $false
    foreach ($resource in @($client,$handler,$budget)) {
        if ($null -ne $resource) { try { $resource.Dispose() } catch { Save-PublicProvisionRefusal $_.Exception.Message; $cleanupRefused = $true } }
    }
    if (-not $prepared -and $null -ne $ownedRoot) {
        # Verify the final absolute recursive target before removing our PUBLIC files.
        $candidate = [IO.Path]::GetFullPath($ownedRoot)
        if ([IO.Path]::GetDirectoryName($candidate) -ceq [IO.Path]::GetFullPath($env:RUNNER_TEMP) -and
            [IO.Path]::GetFileName($candidate) -cmatch '^sc-public-pg18-[a-f0-9]{32}$') {
            try { Assert-PublicPath $candidate; [IO.Directory]::Delete($candidate,$true) } catch { [Console]::Out.WriteLine('{"schemaVersion":1,"publicCleanupUnconfirmed":true,"restoreAccepted":false}') }
        }
    }
    if ($cleanupRefused) {
        if (-not $failurePublished) { [Console]::Out.WriteLine(($script:ProvisionFailure | ConvertTo-Json -Depth 4 -Compress)) }
        exit 1
    }
}
