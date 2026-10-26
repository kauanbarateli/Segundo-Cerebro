Set-StrictMode -Version Latest
# Pure port of @supabase/ssr0.12.7: base64url string encoding + createChunks.
# It encodes an existing real GoTrue Session serialized by the caller. It does
# NOT authenticate, create/sign a JWT, infer a role, refresh or send a request.
function ConvertTo-PreviewAuthCookieChunks {
 [CmdletBinding()]
 param([Parameter(Mandatory)][string]$StorageValue)
 $utf8=[Text.UTF8Encoding]::new($false,$true);$bytes=$null
 try{
  if($StorageValue.Length -eq 0 -or $StorageValue.Length -gt 49152){throw [InvalidOperationException]::new('CODEC_REFUSED')}
  $bytes=$utf8.GetBytes($StorageValue)
  $encoded='base64-'+[Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
  if($encoded.Length -gt 12720 -or $encoded -cnotmatch '^base64-[A-Za-z0-9_-]+$'){throw [InvalidOperationException]::new('CODEC_REFUSED')}
  # Base64url is URI-safe ASCII, so official encodeURIComponent(value) is the
  # identity. The official3180 split has no percent/unicode escape to repair.
  if($encoded.Length -le 3180){return ,([pscustomobject]@{Name='sc-auth';Value=$encoded})}
  $parts=[Collections.Generic.List[object]]::new()
  for($at=0;$at -lt $encoded.Length;$at+=3180){$parts.Add([pscustomobject]@{Name=('sc-auth.'+$parts.Count);Value=$encoded.Substring($at,[Math]::Min(3180,$encoded.Length-$at))})}
  return $parts.ToArray()
 }finally{if($null -ne $bytes){[Array]::Clear($bytes,0,$bytes.Length)}}
}
function New-PreviewActorCookieClient {
 [CmdletBinding()]
 param([Parameter(Mandatory)][uri]$PreviewOrigin,[Parameter(Mandatory)][object[]]$Cookies,[Net.Cookie[]]$ProtectionCookies=@())
 # Caller must additionally bind this exact public origin to the reviewed
 # deployment/source/project in the sealed run plan, before credentials exist.
 if($PreviewOrigin.Scheme -cne 'https' -or $PreviewOrigin.Port -ne 443 -or $PreviewOrigin.UserInfo -ne '' -or $PreviewOrigin.Query -ne '' -or $PreviewOrigin.Fragment -ne '' -or $PreviewOrigin.AbsolutePath -cne '/' -or $PreviewOrigin.Host -cnotmatch '^[a-z0-9][a-z0-9-]*\.vercel\.app$' -or $Cookies.Count -lt 1 -or $Cookies.Count -gt 4){throw [InvalidOperationException]::new('COOKIE_CLIENT_REFUSED')}
 $jar=[Net.CookieContainer]::new();$headerChars=0
 for($i=0;$i -lt $Cookies.Count;$i++){
  $part=$Cookies[$i];$props=@($part.psobject.Properties)
  if($props.Count -ne 2 -or @($props|Where-Object {$_.Name -cnotin @('Name','Value') -or $_.MemberType -ne 'NoteProperty'}).Count -ne 0){throw [InvalidOperationException]::new('COOKIE_CLIENT_REFUSED')}
  $expected=if($Cookies.Count -eq 1){'sc-auth'}else{'sc-auth.'+$i}
  if($part.Name -cne $expected -or $part.Value -isnot [string] -or $part.Value.Length -gt 3180 -or $part.Value -cnotmatch '^[A-Za-z0-9_-]+$' -or ($i -eq 0 -and -not $part.Value.StartsWith('base64-'))){throw [InvalidOperationException]::new('COOKIE_CLIENT_REFUSED')}
  $headerChars+=$part.Name.Length+$part.Value.Length+2;$cookie=[Net.Cookie]::new($part.Name,$part.Value,'/');$cookie.Secure=$true;$cookie.HttpOnly=$true;$jar.Add($PreviewOrigin,$cookie)
 }
 foreach($p in $ProtectionCookies){
  if($p.Name -cne '_vercel_jwt' -or $p.Value.Length -eq 0 -or $p.Value.Length -gt 4096 -or $p.Value -cmatch '[\x00-\x20\x7f;]'){throw [InvalidOperationException]::new('COOKIE_CLIENT_REFUSED')}
  $headerChars+=$p.Name.Length+$p.Value.Length+2;$scoped=[Net.Cookie]::new($p.Name,$p.Value,'/');$scoped.Secure=$true;$scoped.HttpOnly=$true;$jar.Add($PreviewOrigin,$scoped)
 }
 if($headerChars -gt 16384){throw [InvalidOperationException]::new('COOKIE_CLIENT_REFUSED')}
 $handler=[Net.Http.HttpClientHandler]::new();$handler.AllowAutoRedirect=$false;$handler.UseCookies=$true;$handler.CookieContainer=$jar;$handler.UseDefaultCredentials=$false;$handler.MaxResponseHeadersLength=16;$handler.AutomaticDecompression=[Net.DecompressionMethods]::None
 $client=[Net.Http.HttpClient]::new($handler,$true);$client.Timeout=[TimeSpan]::FromSeconds(15)
 # No Authorization/apikey/default credentials. Every request still needs the
 # bounded reader and exact-origin check from the approved transport.
 return [pscustomobject]@{Client=$client;CookieCount=$Cookies.Count}
}
Export-ModuleMember -Function ConvertTo-PreviewAuthCookieChunks,New-PreviewActorCookieClient
