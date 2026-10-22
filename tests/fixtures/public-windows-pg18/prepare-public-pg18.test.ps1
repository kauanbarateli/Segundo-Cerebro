param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# PUBLIC metadata + original pure function bodies only. No provisioner/main,
# network, DLL, process, PostgreSQL, profile or archive is evaluated by this QA.
$source = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'prepare-public-pg18.ps1'))
$tokens = $null; $parseErrors = $null
$ast = [Management.Automation.Language.Parser]::ParseInput($source,[ref]$tokens,[ref]$parseErrors)
if ($parseErrors.Count -ne 0) { throw 'PUBLIC_QA_SOURCE_SYNTAX' }
$functionNames = @('Assert-PublicManifest','Assert-PublicZipName','Assert-PublicSelectedDigest')
foreach ($name in $functionNames) {
    $definitions = @($ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name },$false))
    if ($definitions.Count -ne 1) { throw 'PUBLIC_QA_SOURCE_FUNCTION' }
    . ([scriptblock]::Create($definitions[0].Extent.Text))
}
$script:ManifestPurpose = 'Observed public PostgreSQL 18 local executable and bin DLL byte pins; no private data inspected'
$script:ManifestProvenance = 'Local public PostgreSQL installation; does not attest a signature or digest of the complete EDB distribution'
function Must-Refuse([scriptblock]$Action,[string]$Code) {
    $caught = $false
    try { & $Action } catch { $caught = $true; if ($_.Exception.Message -cne $Code) { throw 'PUBLIC_QA_UNEXPECTED_REFUSAL' } }
    if (-not $caught) { throw 'PUBLIC_QA_EXPECTED_REFUSAL' }
}
$manifestText = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'pg18-public-manifest.json'))
$original = $manifestText | ConvertFrom-Json -AsHashtable -Depth 10 -DateKind String
Assert-PublicManifest $original
$negativeCount = 0
foreach ($case in @('wrong-purpose','invented-zip-authority','executed','missing-file','duplicate','path','unlisted-exe','wrong-pg','hash','bytes','extra-field')) {
    $value = $manifestText | ConvertFrom-Json -AsHashtable -Depth 10 -DateKind String
    switch ($case) {
        'wrong-purpose' { $value.purpose = 'RESTORE_ACCEPTED' }
        'invented-zip-authority' { $value.provenance = 'OFFICIAL_EDB_ZIP_SIGNATURE' }
        'executed' { $value.executed = $true }
        'missing-file' { $value.files = @($value.files | Select-Object -Skip 1) }
        'duplicate' { $value.files[1].name = 'PG_RESTORE.EXE' }
        'path' { $value.files[1].name = '..\private.dll' }
        'unlisted-exe' { $value.files[1].name = 'psql.exe' }
        'wrong-pg' { $value.files[0].productVersion = '18.6' }
        'hash' { $value.files[0].sha256 = 'a' * 64 }
        'bytes' { $value.files[0].bytes += 1 }
        'extra-field' { $value.files[0].privatePath = 'PRIVATE_CANARY' }
    }
    Must-Refuse { Assert-PublicManifest $value } 'PUBLIC_MANIFEST_REFUSED'; $negativeCount += 1
}
Assert-PublicZipName 'pgsql/bin/pg_restore.exe' 0
Assert-PublicZipName 'pgsql/bin/libpq.dll' 0
foreach ($name in @('../private','/pgsql/bin/x','pgsql/../x','pgsql/bin/./x','pgsql\bin\x','pgsql/bin/x:stream')) {
    Must-Refuse { Assert-PublicZipName $name 0 } 'PUBLIC_ZIP_ENTRY_REFUSED'; $negativeCount += 1
}
Must-Refuse { Assert-PublicZipName 'pgsql/bin/x.dll' 2684354560 } 'PUBLIC_ZIP_ENTRY_REFUSED'; $negativeCount += 1
Must-Refuse { Assert-PublicZipName 'pgsql/bin/x.dll' 1024 } 'PUBLIC_ZIP_ENTRY_REFUSED'; $negativeCount += 1
Assert-PublicSelectedDigest 10 ('a'*64) 10 ('a'*64)
Must-Refuse { Assert-PublicSelectedDigest 9 ('a'*64) 10 ('a'*64) } 'PUBLIC_SELECTED_DIGEST_REFUSED'; $negativeCount += 1
Must-Refuse { Assert-PublicSelectedDigest 10 ('b'*64) 10 ('a'*64) } 'PUBLIC_SELECTED_DIGEST_REFUSED'; $negativeCount += 1

# Static gate checks supplement the original pure validators; they do not
# replace a Windows native run or mock a private operational qualification.
$gate = $source.IndexOf('if (-not $Execute)',[StringComparison]::Ordinal)
$firstRead = $source.IndexOf('$manifestPath = Join-Path',[StringComparison]::Ordinal)
if ($gate -lt 0 -or $firstRead -lt $gate -or $source -notmatch 'AllowAutoRedirect = \$false' -or
    $source -notmatch "337444127" -or $source -notmatch "4898ebc2a3390ef2d2d9627c30fccc919186fd9c9e1b1280c763be5c089be1f0" -or
    $source -match '(?i)Start-Process|Invoke-Expression|cmd /c|SkipCertificateCheck|Set-Acl|pg_ctl|initdb') { throw 'PUBLIC_QA_GATE_DRIFT' }
[Console]::Out.WriteLine((@{schemaVersion=1;purpose='PUBLIC_PURE_QA';negativeCases=$negativeCount;nativeExecuted=$false;privateInspection=$false;restoreAccepted=$false}|ConvertTo-Json -Compress))
