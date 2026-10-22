param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# PUBLIC metadata + original pure function bodies only. No provisioner/main,
# network, DLL, process, PostgreSQL, profile or archive is evaluated by this QA.
$source = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'prepare-public-pg18.ps1'))
$tokens = $null; $parseErrors = $null
$ast = [Management.Automation.Language.Parser]::ParseInput($source,[ref]$tokens,[ref]$parseErrors)
if ($parseErrors.Count -ne 0) { throw 'PUBLIC_QA_SOURCE_SYNTAX' }
$functionNames = @('Assert-PublicManifest','Assert-PublicZipName','Assert-PublicSelectedDigest','New-PublicProvisionDiagnostic','Save-PublicProvisionRefusal')
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

# The ORIGINAL closed projection/latch is extracted above; no HTTP/provision
# main is evaluated. All arguments below are synthetic public RAM values.
$diagnosticCases = 0
$phases = @('runtime','manifest','temp','node-download','node-digest','pg-download','zip-open','zip-entry','selected-extract','selected-digest','binding','output','cleanup')
foreach ($phase in $phases) {
    $projection = New-PublicProvisionDiagnostic $phase 'PUBLIC_PATH_REFUSED' 7 6 $true
    if ($projection.Count -ne 9 -or $projection.phase -cne $phase -or $projection.reason -cne 'PUBLIC_PATH_REFUSED' -or
        $projection.powershellMajor -ne 7 -or $projection.powershellMinor -ne 6 -or $projection.dateKindAvailable -ne $true -or
        $projection.prepared -ne $false -or $projection.restoreAccepted -ne $false -or $projection.code -cne 'PUBLIC_PROVISION_REFUSED') { throw 'PUBLIC_QA_DIAGNOSTIC_PHASE' }
    $diagnosticCases += 1
}
foreach ($reason in @('PUBLIC_RUNTIME_REFUSED','PUBLIC_MANIFEST_REFUSED','PUBLIC_TEMP_REFUSED','PUBLIC_PATH_REFUSED',
    'PUBLIC_DOWNLOAD_STATUS_REFUSED','PUBLIC_DOWNLOAD_HEADER_LENGTH_REFUSED','PUBLIC_DOWNLOAD_BODY_SIZE_REFUSED',
    'PUBLIC_ZIP_REFUSED','PUBLIC_ZIP_ENTRY_REFUSED','PUBLIC_ZIP_DUPLICATE','PUBLIC_ZIP_SELECTED_REFUSED',
    'PUBLIC_SELECTED_SIZE_REFUSED','PUBLIC_SELECTED_DIGEST_REFUSED','PUBLIC_SELECTED_MISSING','PUBLIC_OUTPUT_REFUSED')) {
    $projection = New-PublicProvisionDiagnostic 'node-download' $reason
    if ($projection.Count -ne 6 -or $projection.reason -cne $reason) { throw 'PUBLIC_QA_DIAGNOSTIC_REASON' }
    $diagnosticCases += 1
}
$script:DiagnosticGetterReads = 0
$hostile = [pscustomobject]@{}
$hostile | Add-Member -MemberType ScriptProperty -Name Message -Value { $script:DiagnosticGetterReads += 1; throw 'PRIVATE_CANARY_GETTER' }
$hostile | Add-Member -MemberType ScriptMethod -Name ToString -Value { $script:DiagnosticGetterReads += 1; throw 'PRIVATE_CANARY_COERCION' } -Force
foreach ($bad in @($null,'PRIVATE_CANARY https://private.invalid/path?token=x','public_path_refused',"PUBLIC_PATH_REFUSED`n",("PUBLIC_PATH_REFUSED"+[char]0),99,@('PUBLIC_PATH_REFUSED'),$hostile)) {
    $projection = New-PublicProvisionDiagnostic $bad $bad $bad $bad $bad
    $serialized = $projection | ConvertTo-Json -Compress
    if ($projection.phase -cne 'unavailable' -or $projection.reason -cne 'PUBLIC_UNAVAILABLE' -or $serialized.Contains('PRIVATE_CANARY') -or
        ($projection.Contains('powershellMajor') -and $bad -isnot [int]) -or ($projection.Contains('powershellMinor') -and $bad -isnot [int]) -or $projection.Contains('dateKindAvailable')) { throw 'PUBLIC_QA_DIAGNOSTIC_LEAK' }
    $diagnosticCases += 1
}
foreach ($bad in @(-1,100,[long]7,'7',$null,$hostile)) {
    $projection = New-PublicProvisionDiagnostic 'runtime' 'PUBLIC_RUNTIME_REFUSED' $bad $bad $null
    if ($projection.Count -ne 6) { throw 'PUBLIC_QA_DIAGNOSTIC_RUNTIME_BOUND' }
    $diagnosticCases += 1
}
if ($script:DiagnosticGetterReads -ne 0) { throw 'PUBLIC_QA_DIAGNOSTIC_GETTER' }
$script:ProvisionFailure = $null; $script:ProvisionPhase = 'node-download'
$script:RuntimeMajor = 7; $script:RuntimeMinor = 6; $script:DateKindAvailable = $true
Save-PublicProvisionRefusal 'PUBLIC_DOWNLOAD_HEADER_LENGTH_REFUSED'
$firstProjection = $script:ProvisionFailure | ConvertTo-Json -Compress
$script:ProvisionPhase = 'output'; Save-PublicProvisionRefusal 'PUBLIC_OUTPUT_REFUSED'
if (($script:ProvisionFailure | ConvertTo-Json -Compress) -cne $firstProjection) { throw 'PUBLIC_QA_FIRST_REFUSAL_CHANGED' }
$script:ProvisionPhase = 'temp'; Save-PublicProvisionRefusal 'PRIVATE_CANARY_DISPOSE'
if (($script:ProvisionFailure | ConvertTo-Json -Compress) -cne $firstProjection) { throw 'PUBLIC_QA_CLEANUP_REPLACED_REFUSAL' }
$diagnosticCases += 2

# Static gate checks supplement the original pure validators; they do not
# replace a Windows native run or mock a private operational qualification.
$gate = $source.IndexOf('if (-not $Execute)',[StringComparison]::Ordinal)
$firstRead = $source.IndexOf('$manifestPath = Join-Path',[StringComparison]::Ordinal)
if ($gate -lt 0 -or $firstRead -lt $gate -or $source -notmatch 'AllowAutoRedirect = \$false' -or
    $source -notmatch "337444127" -or $source -notmatch "4898ebc2a3390ef2d2d9627c30fccc919186fd9c9e1b1280c763be5c089be1f0" -or
    $source -match '(?i)Start-Process|Invoke-Expression|cmd /c|SkipCertificateCheck|Set-Acl|pg_ctl|initdb') { throw 'PUBLIC_QA_GATE_DRIFT' }
[Console]::Out.WriteLine((@{schemaVersion=1;purpose='PUBLIC_PURE_QA';negativeCases=$negativeCount;diagnosticCases=$diagnosticCases;nativeExecuted=$false;privateInspection=$false;restoreAccepted=$false}|ConvertTo-Json -Compress))
