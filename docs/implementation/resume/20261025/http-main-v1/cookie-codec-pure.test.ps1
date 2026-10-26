#requires -Version 7.5
# Proposed pure tests. No HTTP client is constructed, no SDK/session is loaded.
$ErrorActionPreference='Stop';Import-Module (Join-Path $PSScriptRoot 'PreviewCookieCodec.psm1') -Force
$script:ChecksExecuted=0;function Assert-Closed([bool]$ok){$script:ChecksExecuted++;if(-not $ok){throw [InvalidOperationException]::new('PURE_ASSERTION_FAILED')}}
foreach($fixture in @(@('foo','base64-Zm9v'),@('{}','base64-e30'),@('café','base64-Y2Fmw6k'),@('😀','base64-8J-YgA'))){
 $out=@(ConvertTo-PreviewAuthCookieChunks -StorageValue $fixture[0]);Assert-Closed ($out.Count -eq 1 -and $out[0].Name -ceq 'sc-auth' -and $out[0].Value -ceq $fixture[1])
}
$small=@(ConvertTo-PreviewAuthCookieChunks -StorageValue ('a'*2379));Assert-Closed ($small.Count -eq 1 -and $small[0].Value.Length -eq 3179)
$split=@(ConvertTo-PreviewAuthCookieChunks -StorageValue ('a'*2380));Assert-Closed ($split.Count -eq 2 -and $split[0].Name -ceq 'sc-auth.0' -and $split[1].Name -ceq 'sc-auth.1' -and $split[0].Value.Length -eq 3180 -and $split[1].Value.Length -eq 1)
$joined=($split.Value -join '');$v=$joined.Substring(7).Replace('-','+').Replace('_','/');$v=$v.PadRight($v.Length+(4-$v.Length%4)%4,'=');Assert-Closed ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($v)) -ceq ('a'*2380))
foreach($bad in @('',('a'*9600),([string][char]0xD800))){$refused=$false;try{$null=ConvertTo-PreviewAuthCookieChunks -StorageValue $bad}catch{$refused=$true};Assert-Closed $refused}
# All of these inputs must fail before the HttpClient constructor.
$part=[pscustomobject]@{Name='sc-auth';Value='base64-e30'}
foreach($origin in @('http://example.vercel.app','https://example.vercel.app/path','https://example.vercel.app?x=1','https://example.vercel.app#x','https://user@example.vercel.app','https://example.vercel.app.evil.test','https://example.vercel.app:444')){
 $refused=$false;try{$client=New-PreviewActorCookieClient -PreviewOrigin ([uri]$origin) -Cookies @($part);$client.Client.Dispose()}catch{$refused=$true};Assert-Closed $refused
}
$script:GetterCalls=0;$hostile=[pscustomobject]@{Name='sc-auth'};$hostile|Add-Member -MemberType ScriptProperty -Name Value -Value {$script:GetterCalls++;throw 'CANARY_GETTER'}
foreach($parts in @(@([pscustomobject]@{Name='sc-auth';Value="base64-e30`r`nInjected"}),@([pscustomobject]@{Name='sc-auth.1';Value='base64-e30'},[pscustomobject]@{Name='sc-auth.0';Value='x'}),@($hostile))){
 $refused=$false;try{$client=New-PreviewActorCookieClient -PreviewOrigin ([uri]'https://example.vercel.app') -Cookies $parts;$client.Client.Dispose()}catch{$refused=$true};Assert-Closed $refused
}
Assert-Closed ($script:GetterCalls -eq 0)
foreach($name in @('sc-auth','other','_vercel_jwt_bad')){
 $refused=$false;try{$p=[Net.Cookie]::new($name,'FAKE','/');$client=New-PreviewActorCookieClient -PreviewOrigin ([uri]'https://example.vercel.app') -Cookies @([pscustomobject]@{Name='sc-auth';Value='base64-e30'}) -ProtectionCookies @($p);$client.Client.Dispose()}catch{$refused=$true};Assert-Closed $refused
}
# Only the authenticated platform cookie received by the new preflight may be
# supplied in real execution; these fake negatives make no request.
# Official JS utility oracle is separate, not an Auth/SDK-runtime acceptance.
[ordered]@{code='PURE_CODEC_TESTS_PASSED';network=0;clientsCreated=0;sdkRuntime=$false}|ConvertTo-Json -Compress
