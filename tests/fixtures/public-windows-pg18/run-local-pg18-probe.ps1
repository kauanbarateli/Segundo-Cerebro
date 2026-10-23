param([switch]$Execute)

# No argument means no filesystem, manifest, Node or PostgreSQL access.
if (-not $Execute) {
    [Console]::Out.WriteLine('{"schemaVersion":1,"executed":false,"restoreAccepted":false}')
    return
}
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-LocalNoReparse {
    param([string]$Path)
    if (-not [IO.Path]::IsPathFullyQualified($Path) -or $Path -cnotmatch '^C:\\' -or $Path -match '[\r\n\0]' -or $Path.Contains('/')) { throw 'LOCAL_PATH_REFUSED' }
    $current = [IO.Path]::GetFullPath($Path)
    while ($current) {
        # Missing, inaccessible and IO errors all refuse here. No Exists=false shortcut.
        $attributes = [IO.File]::GetAttributes($current)
        if (($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'LOCAL_PATH_REFUSED' }
        $parent = [IO.Path]::GetDirectoryName($current)
        if ($parent -eq $current) { break }
        $current = $parent
    }
}

function Open-LocalPinnedLease {
    param([string]$Path,[long]$Bytes,[string]$Sha256)
    Assert-LocalNoReparse $Path
    $stream = $null
    try {
        # Read-sharing permits the image loader, but excludes replacement/write
        # while the new Node process and its public PG children are running.
        $stream = [IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
        if ($stream.Length -ne $Bytes -or [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($stream)).ToLowerInvariant() -cne $Sha256) { throw 'LOCAL_PIN_REFUSED' }
        $stream.Position = 0
        return $stream
    } catch { if ($null -ne $stream) { $stream.Dispose() }; throw }
}

$leases = [Collections.Generic.List[IDisposable]]::new()
$child = $null; $timedOut = $false; $exitCode = $null; $leaseCleanupConfirmed = $true
$first = $null; $phase = 'runtime'; $reportPath = $null; $started = $false; $treeCleanupUnconfirmed = $false
try {
    if ($args.Count -ne 0 -or -not $IsWindows -or -not [Environment]::Is64BitProcess -or $PSVersionTable.PSVersion.Major -lt 7 -or
        -not [string]::IsNullOrEmpty($env:GITHUB_ACTIONS) -or -not [string]::IsNullOrEmpty($env:NODE_OPTIONS) -or
        -not [string]::IsNullOrEmpty($env:NODE_PATH) -or $env:SystemRoot -cne 'C:\Windows') { throw 'LOCAL_RUNTIME_REFUSED' }
    $nodePath = 'C:\Program Files\nodejs\node.exe'
    $binPath = 'C:\Program Files\PostgreSQL\18\bin'
    $wrapperPath = Join-Path $PSScriptRoot 'local-pg18-stdin-probe.mjs'
    $controllerPath = Join-Path $PSScriptRoot 'public-pg18-stdin-probe.mjs'
    $manifestPath = Join-Path $PSScriptRoot 'pg18-public-manifest.json'
    $phase = 'node-pin'
    $leases.Add((Open-LocalPinnedLease $nodePath 92825416 '3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237'))
    $phase = 'wrapper-pin'
    $leases.Add((Open-LocalPinnedLease $wrapperPath 15854 'f6e4bc739d0701d58ed98dd0388c278ca5c881d7a62ac3e5b1ae179132a6c228'))
    $phase = 'controller-pin'
    $leases.Add((Open-LocalPinnedLease $controllerPath 19070 '38c2410896c7e2874cc5b739f2c01f7ac562c6af53a3502d198037f25f69d3b9'))
    $phase = 'manifest-pin'
    $leases.Add((Open-LocalPinnedLease $manifestPath 7136 '4898ebc2a3390ef2d2d9627c30fccc919186fd9c9e1b1280c763be5c089be1f0'))
    $manifest = [IO.File]::ReadAllText($manifestPath,[Text.UTF8Encoding]::new($false,$true)) | ConvertFrom-Json -AsHashtable -Depth 10
    if ($manifest.files.Count -ne 30) { throw 'LOCAL_PIN_REFUSED' }
    $phase = 'postgres-pins'
    foreach ($file in $manifest.files) { $leases.Add((Open-LocalPinnedLease (Join-Path $binPath $file.name) $file.bytes $file.sha256)) }
    $phase = 'paths'
    $temporaryParent = [IO.Path]::GetTempPath().TrimEnd([IO.Path]::DirectorySeparatorChar)
    Assert-LocalNoReparse $temporaryParent
    $ownedRoot = Join-Path $temporaryParent ('sc-local-pg18-' + [Guid]::NewGuid().ToString('N'))
    $reportPath = $ownedRoot + '.json'
    # Node creates its cwd atomically with mkdir. The launcher never deletes it.
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $nodePath; $start.UseShellExecute = $false; $start.CreateNoWindow = $true
    $start.WindowStyle = [Diagnostics.ProcessWindowStyle]::Hidden
    $start.WorkingDirectory = $PSScriptRoot
    $start.ArgumentList.Add($wrapperPath); $start.ArgumentList.Add('--execute-local-public-probe')
    $start.Environment.Clear()
    $start.Environment['SystemRoot'] = 'C:\Windows'
    $start.Environment['PATH'] = $binPath + ';C:\Windows\System32'
    $start.Environment['SC_LOCAL_PROBE_PARENT'] = $temporaryParent
    $start.Environment['SC_LOCAL_PROBE_ROOT'] = $ownedRoot
    $child = [Diagnostics.Process]::new(); $child.StartInfo = $start
    $phase = 'launch'
    if (-not $child.Start()) { throw 'LOCAL_RUNTIME_REFUSED' }
    $started = $true
    # An outer watchdog cannot convert forced termination into a natural result.
    # The original controller still owns unchanged 45s/case and 90s/batch limits.
    $phase = 'wait'
    if (-not $child.WaitForExit(120000)) {
        $timedOut = $true; $treeCleanupUnconfirmed = $true
        try { $child.Kill($true); [void]$child.WaitForExit(5000) } catch { }
        throw 'LOCAL_OUTER_DEADLINE_REFUSED'
    }
    $exitCode = $child.ExitCode
} catch {
    $allowed = @('LOCAL_PATH_REFUSED','LOCAL_PIN_REFUSED','LOCAL_RUNTIME_REFUSED','LOCAL_OUTER_DEADLINE_REFUSED')
    $code = $_.Exception.Message
    $first = [ordered]@{phase=$phase;code=$(if ($code -cin $allowed) { $code } else { 'LOCAL_PREFLIGHT_REFUSED' })}
} finally {
    if ($null -ne $child) { try { $child.Dispose() } catch { $leaseCleanupConfirmed = $false } }
    foreach ($lease in $leases) { try { $lease.Dispose() } catch { $leaseCleanupConfirmed = $false } }
}
$receipt = [ordered]@{schemaVersion=1;purpose='LOCAL_PUBLIC_PG18_LAUNCHER_NOT_RESTORE';started=$started;firstRefusal=$first;
    nodeExitCode=$exitCode;outerDeadlineExpired=$timedOut;outerWatchdogTreeCleanupUnconfirmed=$treeCleanupUnconfirmed;
    pinsVerified=$leases.Count;pinnedLeasesClosed=$leaseCleanupConfirmed;publicReportPath=$reportPath;privateInspection=$false;restoreAccepted=$false}
[Console]::Out.WriteLine(($receipt | ConvertTo-Json -Compress))
if ($null -ne $first -or $exitCode -ne 0 -or -not $leaseCleanupConfirmed -or $treeCleanupUnconfirmed) { exit 1 }
exit 0
