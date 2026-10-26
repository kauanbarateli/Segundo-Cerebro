#requires -Version 7.5
$ErrorActionPreference='Stop';$checks=0
function Assert-Static([bool]$ok){$script:checks++;if(-not $ok){throw 'STATIC_CONTRACT_REFUSED'}}
$entry=Join-Path $PSScriptRoot 'run-onboarding-preview-main.ps1';$runtime=Join-Path $PSScriptRoot 'Main.Runtime.ps1';$c=Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'main-config.json')|ConvertFrom-Json -AsHashtable -DateKind String
function Parse-Only([string]$p){$e=$null;$t=$null;$a=[Management.Automation.Language.Parser]::ParseFile($p,[ref]$t,[ref]$e);Assert-Static (@($e).Count -eq 0);return $a}
$a=Parse-Only $entry;$b=Parse-Only $runtime;$old=Parse-Only $c.authDonorPath
function Definition($ast,[string]$name){$found=@($ast.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst]},$true)|Where-Object {$_.Name -ceq $name});Assert-Static ($found.Count -eq 1);return $found[0].Extent.Text}
$names=@('Refuse','Require','Known-Code','Is-Map','Has','Is-Uuid','Sha256','File-Sha256','Check-LocalPath','Write-NewJson','Read-Json','Check-Source','Journal','Confirm-Operation','New-Actor','Require-TokenLive','Check-User','Set-Session','Operation-Spec','Require-Access','Logout-Actor','Cleanup-Actors')
foreach($n in $names){Assert-Static ((Definition $a $n) -ceq (Definition $old $n))}
$newIo=Definition $a 'Invoke-Operation';$cap="`n    Require ((`$script:Counts.requests+`$script:Counts.previewRequests) -lt 64) 'STATE_REFUSED'";Assert-Static ($newIo.Replace($cap,'') -ceq (Definition $old 'Invoke-Operation'))
foreach($n in @('Invoke-Preview','Protection-Get')){$text=Definition $b $n;Assert-Static ($text -cnotmatch "TryAddWithoutValidation\('(?:apikey|Authorization)'");Assert-Static ($text -cnotmatch 'x-vercel-protection-bypass|x-vercel-trusted-oidc-idp-token')}
$m=Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'MATRIX.json')|ConvertFrom-Json -AsHashtable -DateKind String;Assert-Static ($m.requests.Count -eq 64 -and @($m.requests.id|Sort-Object -Unique).Count -eq 64);Assert-Static (@($m.requests|Where-Object {$_.transport -ceq 'AUTH'}).Count -eq 19);Assert-Static (@($m.requests|Where-Object {$_.transport -ceq 'PREVIEW'}).Count -eq 45);Assert-Static (@($m.requests|Where-Object {$_.id -ceq 'ABSENCE_A'}).Count -eq 0);Assert-Static (@($m.requests|Where-Object {$_.id -cmatch '^ADVANCE_A_[1-7]$'}).Count -eq 7)
$entryText=[IO.File]::ReadAllText($entry);Assert-Static ($entryText.IndexOf("Protection-Preflight `$AuthorizedDeploymentLink") -lt $entryText.IndexOf("`$script:Secret=[Net.NetworkCredential]::new"));Assert-Static ($entryText -cnotmatch 'Get-Content.*\.env|Read-SelectedEnvironment')
$codec=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'PreviewCookieCodec.psm1'));Assert-Static ($codec.Contains("`$p.Name -cne '_vercel_jwt'"));Assert-Static ($codec.Contains('UseDefaultCredentials=$false'))
[ordered]@{code='MAIN_STATIC_CONTRACTS_PASSED';assertions=$script:checks;network=0;entryExecuted=$false;credentialsRead=$false}|ConvertTo-Json -Compress
