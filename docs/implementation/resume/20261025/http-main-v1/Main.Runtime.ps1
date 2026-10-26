function Is-AppUnauthorized($Status,$MediaType,$Data){return $Status -eq 401 -and $MediaType -ceq 'application/json' -and (Is-Map $Data) -and $Data.Count -eq 3 -and (Has $Data 'ok') -and $Data.ok -ceq $false -and (Has $Data 'code') -and $Data.code -ceq 'UNAUTHENTICATED' -and (Has $Data 'message') -and $Data.message -ceq 'Não foi possível confirmar esta operação.'}
# Functions only. Loaded by the pinned entry after hash verification.
function Exact-Keys($Value,[string[]]$Keys){Require ((Is-Map $Value) -and $Value.Count -eq $Keys.Count) 'RESPONSE_REFUSED';foreach($key in $Value.Keys){Require ($key -is [string] -and $key -cin $Keys) 'RESPONSE_REFUSED'}}
function Canonical($Value){
 if($null -eq $Value){return 'null'}
 if(Is-Map $Value){$keys=[string[]]@($Value.Keys);[Array]::Sort($keys,[StringComparer]::Ordinal);$items=@(foreach($key in $keys){($key|ConvertTo-Json -Compress)+':'+(Canonical $Value[$key])});return '{'+($items -join ',')+'}'}
 if($Value -is [array] -or $Value -is [Collections.IList]){return '['+(@(foreach($v in $Value){Canonical $v}) -join ',')+']'}
 Require ($Value -is [string] -or $Value -is [bool] -or $Value -is [int] -or $Value -is [long] -or $Value -is [decimal] -or $Value -is [double]) 'RESPONSE_REFUSED';return ($Value|ConvertTo-Json -Compress)
}
function Same($Left,$Right){return (Canonical $Left) -ceq (Canonical $Right)}
function Clone($Value){return ((Canonical $Value)|ConvertFrom-Json -AsHashtable -Depth 32 -NoEnumerate -DateKind String)}
function Round-Proof($Snapshot){return @{round=$Snapshot.round;recovery=$Snapshot.recovery}}
function Time-Value($Value){Require ($Value -is [string] -and $Value -cmatch '^\d{4}-\d{2}-\d{2}T') 'RESPONSE_REFUSED';try{return [DateTimeOffset]::Parse($Value,[Globalization.CultureInfo]::InvariantCulture)}catch{Refuse 'RESPONSE_REFUSED'}}
function Assert-Snapshot($Data,$Actor){
 Exact-Keys $Data @('schemaVersion','ownerId','today','timeZone','eligibility','capabilities','profile','round','calendar','recovery')
 Require ($Data.schemaVersion -eq 1 -and $Data.ownerId -ceq $Actor.Id -and $Data.today -is [string] -and $Data.today -cmatch '^\d{4}-\d{2}-\d{2}$' -and $Data.timeZone -ceq 'America/Sao_Paulo') 'SNAPSHOT_REFUSED'
 try{[void][DateOnly]::ParseExact($Data.today,'yyyy-MM-dd',[Globalization.CultureInfo]::InvariantCulture)}catch{Refuse 'SNAPSHOT_REFUSED'}
 Exact-Keys $Data.eligibility @('kind','canStart','offerPending','reason');Require ($Data.eligibility.kind -ceq 'existing_opt_in' -and $Data.eligibility.canStart -is [bool] -and $Data.eligibility.offerPending -ceq $false) 'ACCESS_STATE_REFUSED'
 Exact-Keys $Data.capabilities @('configuracoes','calendario','habitos','projetos','tarefas','conhecimento','financeiro','cofre');foreach($v in $Data.capabilities.Values){Require ($v -is [bool]) 'RESPONSE_REFUSED'}
 Exact-Keys $Data.profile @('displayName','focus','revision');Require ($Data.profile.revision -is [string] -and $Data.profile.revision.Length -ge 1 -and $Data.profile.revision.Length -le 256 -and ($null -eq $Data.profile.focus -or $Data.profile.focus -cin @('work','study','personal','mixed'))) 'RESPONSE_REFUSED'
 Exact-Keys $Data.calendar @('status','canConnect','accounts','sources');Require ($Data.calendar.status -cin @('ready','not_configured') -and $Data.calendar.accounts -is [array] -and $Data.calendar.accounts.Count -eq 0 -and $Data.calendar.sources -is [array] -and $Data.calendar.sources.Count -eq 0 -and $Data.recovery -is [array]) 'SNAPSHOT_REFUSED'
 if($null -ne $Data.round){Exact-Keys $Data.round @('id','revision','status','step','draft','editedAt','expiresAt','receipts');Require ((Is-Uuid $Data.round.id) -and $Data.round.revision -is [string] -and $Data.round.revision -cmatch '^(0|[1-9][0-9]{0,18})$' -and $Data.round.status -cin @('active','paused','executing','partial','complete','expired') -and $Data.round.receipts -is [array] -and $Data.round.receipts.Count -le 7) 'SNAPSHOT_REFUSED';Require (((Time-Value $Data.round.expiresAt)-(Time-Value $Data.round.editedAt)).TotalHours -eq 720) 'SNAPSHOT_REFUSED';foreach($receipt in $Data.round.receipts){Exact-Keys $receipt @('intentId','itemKey','kind','status','entityId','reason');Require ((Is-Uuid $receipt.intentId) -and $receipt.kind -cin @('profile','habit','project','task','notebook','page','link') -and $receipt.status -cin @('ready','pending','confirmed','blocked','failed','unknown','omitted')) 'SNAPSHOT_REFUSED'}}
 return $Data
}
function Assert-Envelope($Result,$Step,$Actor){
 Require ($Result.Status -eq $Step.expectedHttpStatus -and (Is-Map $Result.Data)) 'COMMAND_REFUSED'
 if($Result.Status -ne 200){Exact-Keys $Result.Data @('ok','code','message');Require ($Result.Data.ok -ceq $false -and $Result.Data.code -ceq $Step.expectedCodeOrShape) 'COMMAND_REFUSED';Confirm-Operation $Result 'EXPECTED_REFUSAL';return $null}
 Exact-Keys $Result.Data @('ok','result');Require ($Result.Data.ok -ceq $true) 'RESPONSE_REFUSED'
 if($Step.expectedCodeOrShape -ceq 'SNAPSHOT'){return Assert-Snapshot $Result.Data.result $Actor}
 return $Result.Data.result
}
function New-FullDraft($Actor,$Snapshot){$k=$script:Manifest.items;return @{profile=@{displayName=$Actor.DisplayName;focus='personal'};habits=@(@{key=$k.habit;name='Pratica sintetica';cadence='daily';startedOn=$Snapshot.today});projects=@(@{key=$k.project;name='Projeto sintetico';context='personal'});tasks=@(@{key=$k.task;title='Tarefa sintetica';project=@{kind='draft';key=$k.project};due=@{kind='day';day=$Snapshot.today}});notes=@{notebook=@{kind='new';key=$k.notebook;name='Caderno sintetico'};page=@{key=$k.page;title='Pagina sintetica';text='Texto artificial do ensaio.';project=@{kind='draft';key=$k.project}}}}}
function New-EmptyDraft{return @{profile=@{};habits=@();projects=@();tasks=@();notes=$null}}
function Capture-Session($Data,$Actor){
 Require ((Has $Data 'refresh_token') -and $Data.refresh_token -is [string] -and $Data.refresh_token.Length -gt 0 -and (Has $Data 'expires_at') -and ($Data.expires_at -is [int] -or $Data.expires_at -is [long])) 'RESPONSE_REFUSED'
 $real=Clone $Data;Set-Session $Data $Actor;Require ($real.expires_at -eq $Actor.ExpiresAt) 'RESPONSE_REFUSED';$Actor.SessionJson=Canonical $real;$real=$null
}
function Install-ActorClients{
 Require ($script:ProtectionReady -and $script:Actors.Count -eq 2 -and $script:Actors[0].SessionId -cne $script:Actors[1].SessionId -and $script:Actors[0].Token -cne $script:Actors[1].Token) 'ACCESS_STATE_REFUSED'
 foreach($actor in $script:Actors){Require ($actor.UserVerified -and $actor.AccessVerified -and $actor.SessionJson -is [string]) 'ACCESS_STATE_REFUSED';$chunks=@(ConvertTo-PreviewAuthCookieChunks -StorageValue $actor.SessionJson);$client=New-PreviewActorCookieClient -PreviewOrigin ([uri]$script:Config.previewOrigin) -Cookies $chunks -ProtectionCookies $script:ProtectionCookies;$script:PreviewClients[$actor.Label]=$client.Client;if($actor.Label -ceq 'A'){$other=New-PreviewActorCookieClient -PreviewOrigin ([uri]$script:Config.previewOrigin) -Cookies $chunks -ProtectionCookies $script:ProtectionCookies;$script:PreviewClients.A2=$other.Client};$actor.SessionJson=$null;$chunks=$null}
 $script:PreviewClients.NONE=$script:ProtectionClient
}
function Protection-Get([string]$Operation,[uri]$Uri){
 Require ($script:ProtectionRequests -lt 3 -and $script:Counts.usersCreated -eq 0 -and $script:Counts.requests -eq 0 -and $script:Clock.ElapsedMilliseconds -lt $script:TotalDeadlineMs) 'STATE_REFUSED'
 Require ($Uri.Scheme -ceq 'https' -and $Uri.GetLeftPart([UriPartial]::Authority) -ceq $script:Config.previewOrigin -and $Uri.UserInfo -eq '' -and $Uri.Fragment -eq '') 'PROTECTION_INPUT_REFUSED'
 $request=$null;$response=$null;$stream=$null;$memory=$null;$buffer=$null;$bytes=$null;$cancel=[Threading.CancellationTokenSource]::new();$cancel.CancelAfter([Math]::Min(15000,300000-[int]$script:Clock.ElapsedMilliseconds))
 try{
  $request=[Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Get,$Uri);[void]$request.Headers.TryAddWithoutValidation('Accept','application/json');[void]$request.Headers.TryAddWithoutValidation('Accept-Encoding','identity');[void]$request.Headers.TryAddWithoutValidation('Cache-Control','no-cache, no-store');[void]$request.Headers.TryAddWithoutValidation('X-Expected-User-ID',$script:Manifest.actors[0].userId)
  Journal 'before' $Operation 'NONE' $false 'PLANNED';$script:ProtectionRequests++
  $response=$script:ProtectionClient.SendAsync($request,[Net.Http.HttpCompletionOption]::ResponseHeadersRead,$cancel.Token).GetAwaiter().GetResult();$status=[int]$response.StatusCode;$script:ProtectionStatus=$status
  Require ($response.RequestMessage.RequestUri.AbsoluteUri -ceq $Uri.AbsoluteUri) 'REDIRECT_REFUSED'
  $declared=$response.Content.Headers.ContentLength;if($null -ne $declared){Require ($declared -ge 0 -and $declared -le 1048576) 'BODY_LIMIT_REFUSED'}
  $stream=$response.Content.ReadAsStreamAsync().GetAwaiter().GetResult();$memory=[IO.MemoryStream]::new();$buffer=[byte[]]::new(16384)
  while($true){$n=$stream.ReadAsync($buffer,0,$buffer.Length,$cancel.Token).GetAwaiter().GetResult();if($n -eq 0){break};Require ($memory.Length+$n -le 1048576) 'BODY_LIMIT_REFUSED';$memory.Write($buffer,0,$n)}
  $cancel.Token.ThrowIfCancellationRequested();$bytes=$memory.ToArray();$appDenied=$false
  if($status -eq 401 -and $null -ne $response.Content.Headers.ContentType -and $response.Content.Headers.ContentType.MediaType -ceq 'application/json'){
   try{$data=$script:Utf8.GetString($bytes)|ConvertFrom-Json -AsHashtable -Depth 16 -NoEnumerate -DateKind String;$appDenied=Is-AppUnauthorized $status $response.Content.Headers.ContentType.MediaType $data}catch{$appDenied=$false};$data=$null
  }
  $safeLocation=$true;if($status -ge 300 -and $status -lt 400){$location=$response.Headers.Location;$safeLocation=$null -ne $location;if($safeLocation){try{$target=[uri]::new([uri]($script:Config.previewOrigin+'/'),$location);$safeLocation=$target.GetLeftPart([UriPartial]::Authority) -ceq $script:Config.previewOrigin -and $target.UserInfo -eq '' -and $target.Fragment -eq '' -and $target.Query -eq '' -and $target.AbsolutePath -cin @('/','/entrar')}catch{$safeLocation=$false}}}
  Journal 'after' $Operation 'NONE' $false $(if($appDenied){'APP_UNAUTHENTICATED'}else{'CHANNEL_NOT_PROVEN'}) $status
  return [pscustomobject]@{AppDenied=$appDenied;Status=$status;SafeLocation=$safeLocation}
 }catch{$script:HaltAfterTransport=$true;$code=Known-Code $_;if($code -ceq 'UNEXPECTED_FAILURE'){if($cancel.IsCancellationRequested){Refuse 'DEADLINE_EXCEEDED'};Refuse 'TRANSPORT_FAILED'};throw}
 finally{if($null -ne $stream){$stream.Dispose()};if($null -ne $memory){$memory.Dispose()};if($null -ne $response){$response.Dispose()};if($null -ne $request){$request.Dispose()};$cancel.Dispose();if($null -ne $buffer){[Array]::Clear($buffer,0,$buffer.Length)};if($null -ne $bytes){[Array]::Clear($bytes,0,$bytes.Length)}}
}
function Protection-Preflight($PrivateLink){
 $handler=[Net.Http.HttpClientHandler]::new();$handler.AllowAutoRedirect=$false;$handler.UseCookies=$true;$handler.UseDefaultCredentials=$false;$handler.MaxResponseHeadersLength=16;$handler.AutomaticDecompression=[Net.DecompressionMethods]::None;$script:ProtectionJar=[Net.CookieContainer]::new();$handler.CookieContainer=$script:ProtectionJar;$script:ProtectionClient=[Net.Http.HttpClient]::new($handler,$true);$script:ProtectionClient.Timeout=[Threading.Timeout]::InfiniteTimeSpan
 $script:ProtectionPhase='DIRECT';$direct=Protection-Get 'PROTECTION_DIRECT' ([uri]($script:Config.previewOrigin+'/api/onboarding'))
 if(-not $direct.AppDenied){
  if($null -eq $PrivateLink -or $PrivateLink.Length -eq 0){Refuse 'HOLD_PROTECTION'}
  Require ($script:Config.temporaryLinkApprovedByRoot -ceq $true -and $script:Config.temporaryLinkDeploymentId -ceq $script:Config.deploymentId) 'PROTECTION_INPUT_REFUSED'
  $until=Time-Value $script:Config.temporaryLinkApprovalExpiresAtUtc;Require ($until -gt [DateTimeOffset]::UtcNow.AddMinutes(5)) 'PROTECTION_INPUT_REFUSED'
  $linkText=[Net.NetworkCredential]::new('',$PrivateLink).Password
  try{$uri=[uri]::new($linkText,[UriKind]::Absolute);Require ($uri.GetLeftPart([UriPartial]::Authority) -ceq $script:Config.previewOrigin -and $uri.Scheme -ceq 'https' -and $uri.Port -eq 443 -and $uri.UserInfo -eq '' -and $uri.Fragment -eq '' -and $uri.AbsolutePath -eq '/' -and $uri.Query -cmatch '^\?_vercel_share=[A-Za-z0-9._~-]{16,2048}$' -and $uri.AbsoluteUri -ceq $linkText) 'PROTECTION_INPUT_REFUSED';$script:ProtectionPhase='AUTHORIZED_LINK';$share=Protection-Get 'PROTECTION_AUTHORIZED_LINK' $uri;Require ($share.Status -cin @(200,302,303) -and $share.SafeLocation) 'HOLD_PROTECTION';$script:LinkUsed=$true}finally{$linkText=$null;$uri=$null}
  $script:ProtectionPhase='CONFIRM';$confirmed=Protection-Get 'PROTECTION_CONFIRM' ([uri]($script:Config.previewOrigin+'/api/onboarding'));Require $confirmed.AppDenied 'HOLD_PROTECTION'
 }
 foreach($cookie in $script:ProtectionJar.GetCookies([uri]$script:Config.previewOrigin)){if($cookie.Name -ceq '_vercel_jwt'){Require ($cookie.Expires -eq [DateTime]::MinValue -or $cookie.Expires.ToUniversalTime() -gt [DateTime]::UtcNow.AddMinutes(5)) 'HOLD_PROTECTION';$script:ProtectionCookies+=([Net.Cookie]::new($cookie.Name,$cookie.Value,'/'))}}
 Require ($script:ProtectionCookies.Count -le 1) 'PROTECTION_INPUT_REFUSED';$script:ProtectionReady=$true;$script:ProtectionPhase='READY'
}
function Preview-Spec($Step){
 Require ($Step.transport -ceq 'PREVIEW' -and $Step.id -cin @($script:Matrix.requests.id)) 'STATE_REFUSED'
 $path=switch -CaseSensitive ($Step.route){
  'ONBOARDING' {'/api/onboarding'}
  {$_ -cin @('ONBOARDING_START','ONBOARDING_SAVE','ONBOARDING_PAUSE','ONBOARDING_CONFIRM','ONBOARDING_ADVANCE')} {'/api/onboarding'}
  'PROFILE_ATTRIBUTES' {'/api/onboarding/attributes?kind=profile'}
  'PROJECT_ATTRIBUTES_A' {Require (Is-Uuid $script:Ctx.ProjectId) 'STATE_REFUSED';'/api/onboarding/attributes?kind=project&id='+$script:Ctx.ProjectId}
  'PROJECT_CHOICES' {'/api/onboarding?choices=projects'}
  'NOTEBOOK_CHOICES' {'/api/onboarding?choices=notebooks'}
  default {Refuse 'STATE_REFUSED'}
 }
 if($Step.method -ceq 'PATCH'){$path='/api/onboarding/attributes';Require ($Step.id -ceq 'INVALID_FOCUS_A') 'STATE_REFUSED'}
 Require ($Step.method -cin @('GET','POST','PATCH') -and (($Step.method -ceq 'GET') -or $Step.route -cin @('ONBOARDING_START','ONBOARDING_SAVE','ONBOARDING_PAUSE','ONBOARDING_CONFIRM','ONBOARDING_ADVANCE','PROFILE_ATTRIBUTES'))) 'STATE_REFUSED'
 return @{Method=$Step.method;Path=$path;Write=($Step.method -cne 'GET')}
}
function Invoke-Preview($Step,$Actor,$Body){
 Require ($script:ProtectionReady -and -not $script:PendingWrite -and -not $script:HaltAfterTransport -and ($script:Counts.requests+$script:Counts.previewRequests) -lt 64 -and $script:Clock.ElapsedMilliseconds -lt 300000) 'STATE_REFUSED'
 $spec=Preview-Spec $Step;$uri=[uri]::new($script:Config.previewOrigin+$spec.Path);Require ($uri.GetLeftPart([UriPartial]::Authority) -ceq $script:Config.previewOrigin -and $uri.UserInfo -eq '' -and $uri.Fragment -eq '' -and $uri.AbsoluteUri -ceq ($script:Config.previewOrigin+$spec.Path)) 'ENVIRONMENT_REFUSED'
 $client=$script:PreviewClients[$Step.actor];Require ($null -ne $client) 'STATE_REFUSED'
 $request=$null;$response=$null;$stream=$null;$memory=$null;$buffer=$null;$bytes=$null;$bodyBytes=$null;$cancel=[Threading.CancellationTokenSource]::new();$cancel.CancelAfter([Math]::Min(15000,300000-[int]$script:Clock.ElapsedMilliseconds))
 try{
  $request=[Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::new($spec.Method),$uri)
  [void]$request.Headers.TryAddWithoutValidation('Accept','application/json');[void]$request.Headers.TryAddWithoutValidation('Accept-Encoding','identity');[void]$request.Headers.TryAddWithoutValidation('Cache-Control','no-cache, no-store');[void]$request.Headers.TryAddWithoutValidation('User-Agent','SegundoCerebro-Onboarding-IsolatedProbe/1.0')
  $expected=if($Step.id -ceq 'EXPECTED_USER_MISMATCH'){$script:Actors[1].Id}elseif($null -ne $Actor){$Actor.Id}else{$script:Actors[0].Id};[void]$request.Headers.TryAddWithoutValidation('X-Expected-User-ID',$expected)
  if($spec.Write){$origin=if($Step.id -ceq 'WRONG_ORIGIN_A'){'https://invalid.example'}else{$script:Config.previewOrigin};[void]$request.Headers.TryAddWithoutValidation('Origin',$origin)}
  if($null -ne $Body){$bodyBytes=$script:Utf8.GetBytes((Canonical $Body));Require ($bodyBytes.Length -le 65536) 'BODY_LIMIT_REFUSED';$request.Content=[Net.Http.ByteArrayContent]::new($bodyBytes);$request.Content.Headers.ContentType=[Net.Http.Headers.MediaTypeHeaderValue]::new('application/json')}
  # Cookie-only app transport: no apikey or Authorization header exists here.
  Journal 'before' $Step.id $Step.actor $spec.Write 'PLANNED';$script:Counts.previewRequests++;if($spec.Write){$script:Counts.previewWritesAttempted++;$script:PendingWrite=$true}
  $response=$client.SendAsync($request,[Net.Http.HttpCompletionOption]::ResponseHeadersRead,$cancel.Token).GetAwaiter().GetResult();$status=[int]$response.StatusCode
  Require ($response.RequestMessage.RequestUri.AbsoluteUri -ceq $uri.AbsoluteUri) 'REDIRECT_REFUSED';if($status -ge 300 -and $status -lt 400){$script:HaltAfterTransport=$true;Refuse 'REDIRECT_REFUSED'};if($status -ge 500){$script:HaltAfterTransport=$true;Refuse 'HTTP_SERVER_FAILURE'}
  $declared=$response.Content.Headers.ContentLength;if($null -ne $declared){Require ($declared -ge 0 -and $declared -le 1048576) 'BODY_LIMIT_REFUSED'}
  $stream=$response.Content.ReadAsStreamAsync().GetAwaiter().GetResult();$memory=[IO.MemoryStream]::new();$buffer=[byte[]]::new(16384)
  while($true){$n=$stream.ReadAsync($buffer,0,$buffer.Length,$cancel.Token).GetAwaiter().GetResult();if($n -eq 0){break};Require ($memory.Length+$n -le 1048576) 'BODY_LIMIT_REFUSED';$memory.Write($buffer,0,$n)}
  $cancel.Token.ThrowIfCancellationRequested();$bytes=$memory.ToArray();Require ($bytes.Length -gt 0 -and $null -ne $response.Content.Headers.ContentType -and $response.Content.Headers.ContentType.MediaType -ceq 'application/json') 'RESPONSE_REFUSED'
  $data=$script:Utf8.GetString($bytes)|ConvertFrom-Json -AsHashtable -Depth 32 -NoEnumerate -DateKind String
  return [pscustomobject]@{Operation=$Step.id;Actor=$Step.actor;Write=$spec.Write;Status=$status;Data=$data;BodyBytes=$bytes.Length}
 }catch{$code=Known-Code $_;if($code -ceq 'UNEXPECTED_FAILURE'){$script:HaltAfterTransport=$true;if($cancel.IsCancellationRequested){Refuse 'DEADLINE_EXCEEDED'};Refuse 'TRANSPORT_FAILED'};throw}
 finally{if($null -ne $stream){$stream.Dispose()};if($null -ne $memory){$memory.Dispose()};if($null -ne $response){$response.Dispose()};if($null -ne $request){$request.Dispose()};$cancel.Dispose();if($null -ne $buffer){[Array]::Clear($buffer,0,$buffer.Length)};if($null -ne $bytes){[Array]::Clear($bytes,0,$bytes.Length)};if($null -ne $bodyBytes){[Array]::Clear($bodyBytes,0,$bodyBytes.Length)}}
}
function Command-Body($Step,$Actor){
 $id=$Step.id;$a=$script:Ctx['A'];$cid=$script:Manifest.clientIds[$id]
 switch -CaseSensitive ($id){
  'START_A' {$script:Ctx.StartA=@{command='onboarding.start';input=@{clientId=$cid}};return Clone $script:Ctx.StartA}
  {$_ -cin @('START_REPLAY_A','REENTER_ORIGINAL_A','REVOKED_REPLAY_A')} {return Clone $script:Ctx.StartA}
  'SAVE_PARTIAL_A' {$draft=New-EmptyDraft;$draft.projects=@(@{key=$script:Manifest.items.project;name=''});$script:Ctx.Partial=$draft;return @{command='onboarding.save';input=@{roundId=$a.round.id;expectedRevision=$a.round.revision;clientId=$cid;draft=$draft;step='projects'}}}
  {$_ -cin @('CONFIRM_INCOMPLETE_A','PAUSE_A','WRONG_ORIGIN_A')} {return @{command=if($id -ceq 'CONFIRM_INCOMPLETE_A'){'onboarding.confirm'}else{'onboarding.pause'};input=@{roundId=$a.round.id;expectedRevision=$a.round.revision;clientId=$cid}}}
  'SAVE_VALID_A' {$script:Ctx.Full=New-FullDraft $Actor $script:Ctx.FirstA;$script:Ctx.SaveValid=@{command='onboarding.save';input=@{roundId=$a.round.id;expectedRevision=$a.round.revision;clientId=$cid;draft=$script:Ctx.Full;step='summary'}};return Clone $script:Ctx.SaveValid}
  'SAVE_STALE_A' {$copy=Clone $script:Ctx.SaveValid;$copy.input.clientId=$cid;$copy.input.draft.tasks[0].title='Edicao concorrente sintetica';return $copy}
  'SAVE_REPLAY_A' {return Clone $script:Ctx.SaveValid}
  'SAVE_DIFFERENT_REPLAY_A' {$copy=Clone $script:Ctx.SaveValid;$copy.input.draft.tasks[0].title='Corpo divergente sintetico';return $copy}
  'FOREIGN_ROUND_WRITE' {return @{command='onboarding.save';input=@{roundId=$a.round.id;expectedRevision=$a.round.revision;clientId=$cid;draft=(New-EmptyDraft);step='summary'}}}
  'INVALID_FOCUS_A' {return @{kind='profile';clientId=$cid;expectedRevision=$script:Ctx.ProfileA.revision;patch=@{focus='outside_enum'}}}
  'CONFIRM_VALID_A' {$script:Ctx.ConfirmA=@{command='onboarding.confirm';input=@{roundId=$a.round.id;expectedRevision=$a.round.revision;clientId=$cid}};return Clone $script:Ctx.ConfirmA}
  'CONFIRM_REPLAY_A' {return Clone $script:Ctx.ConfirmA}
  {$_ -cmatch '^ADVANCE_A_[1-7]$'} {$body=@{command='onboarding.advance';input=@{roundId=$a.round.id;clientId=$cid}};$script:Ctx.LastAdvance=$body;return $body}
  'ADVANCE_REPLAY_A' {return Clone $script:Ctx.LastAdvance}
  'START_B' {return @{command='onboarding.start';input=@{clientId=$cid}}}
  'CONFIRM_EMPTY_B' {return @{command='onboarding.confirm';input=@{roundId=$script:Ctx.B.round.id;expectedRevision=$script:Ctx.B.round.revision;clientId=$cid}}}
  'ADVANCE_EMPTY_B' {return @{command='onboarding.advance';input=@{roundId=$script:Ctx.B.round.id;clientId=$cid}}}
  default {Require ($Step.method -ceq 'GET') 'STATE_REFUSED';return $null}
 }
}
function Check-PreviewStep($Step,$Actor,$Result,$Before){
 $data=Assert-Envelope $Result $Step $Actor;if($Result.Status -ne 200){return}
 $id=$Step.id
 if($Step.expectedCodeOrShape -ceq 'SNAPSHOT'){
  if($id -cin @('LOAD_A','LOAD_B')){Require ($null -eq $data.round -and $data.eligibility.canStart) 'SNAPSHOT_REFUSED';$script:Ctx[('First'+$Actor.Label)]=Clone $data}
  if($id -cin @('START_A','START_B')){Require ($null -ne $data.round -and $data.round.status -ceq 'active' -and $data.round.receipts.Count -eq 0 -and (Same $data.round.draft (New-EmptyDraft))) 'SNAPSHOT_REFUSED'}
  if($id -cin @('START_REPLAY_A','LOAD_AFTER_INVALID_A','READ_SECOND_CLIENT_A','LOAD_AFTER_CAS_A','CONFIRM_REPLAY_A','ADVANCE_REPLAY_A','REENTER_ORIGINAL_A','B_STILL_VALID')){Require (Same (Round-Proof $data) (Round-Proof $Before)) 'REPLAY_REFUSED'}
  if($id -ceq 'LOAD_B_UNCHANGED'){Require ($null -eq $data.round -and (Same $data.profile $script:Ctx.FirstB.profile)) 'OWNERSHIP_REFUSED'}
  if($id -ceq 'SAVE_PARTIAL_A'){Require ($data.round.status -ceq 'active' -and $data.round.receipts.Count -eq 0 -and (Same $data.round.draft $script:Ctx.Partial)) 'PERSISTENCE_REFUSED'}
  if($id -ceq 'PAUSE_A'){Require ($data.round.status -ceq 'paused' -and (Same $data.round.draft $Before.round.draft) -and $data.round.editedAt -ceq $Before.round.editedAt -and $data.round.expiresAt -ceq $Before.round.expiresAt) 'PERSISTENCE_REFUSED'}
  if($id -ceq 'SAVE_VALID_A'){Require ($data.round.status -ceq 'active' -and (Same $data.round.draft $script:Ctx.Full) -and $data.round.receipts.Count -eq 0) 'PERSISTENCE_REFUSED'}
  if($id -ceq 'SAVE_REPLAY_A'){Require (Same (Round-Proof $data) (Round-Proof $Before)) 'REPLAY_REFUSED'}
  if($id -ceq 'CONFIRM_VALID_A'){Require ($data.round.status -ceq 'executing' -and $data.round.receipts.Count -eq 7 -and (@($data.round.receipts.kind|Sort-Object -Unique).Count -eq 7) -and @($data.round.receipts|Where-Object {$_.status -cne 'ready'}).Count -eq 0) 'SNAPSHOT_REFUSED'}
  if($id -cmatch '^ADVANCE_A_([1-7])$'){$n=[int]$Matches[1];$confirmed=@($data.round.receipts|Where-Object {$_.status -ceq 'confirmed'});if(@($data.round.receipts|Where-Object {$_.status -cin @('unknown','pending')}).Count -gt 0){$script:PendingWrite=$true;Refuse 'COMMIT_UNCONFIRMED'};Require ($confirmed.Count -eq $n -and @($data.round.receipts|Where-Object {$_.status -cin @('blocked','failed','omitted')}).Count -eq 0) 'PERSISTENCE_REFUSED';foreach($prior in @($Before.round.receipts|Where-Object {$_.status -ceq 'confirmed'})){$now=@($confirmed|Where-Object {$_.intentId -ceq $prior.intentId});Require ($now.Count -eq 1 -and (Same $now[0] $prior)) 'REPLAY_REFUSED'};$expected=@('profile','habit','project','task','notebook','page','link');foreach($kind in $expected[0..($n-1)]){Require (@($confirmed|Where-Object {$_.kind -ceq $kind}).Count -eq 1) 'PERSISTENCE_REFUSED'};if($n -eq 7){Require ($data.round.status -ceq 'complete' -and $null -eq $data.round.draft -and $data.recovery.Count -eq 0 -and $data.profile.displayName -ceq $Actor.DisplayName -and $data.profile.focus -ceq 'personal') 'PERSISTENCE_REFUSED';$script:Ctx.ProjectId=@($confirmed|Where-Object {$_.kind -ceq 'project'})[0].entityId;$script:Ctx.NotebookId=@($confirmed|Where-Object {$_.kind -ceq 'notebook'})[0].entityId;Require ((Is-Uuid $script:Ctx.ProjectId) -and (Is-Uuid $script:Ctx.NotebookId)) 'PERSISTENCE_REFUSED'}}
  if($id -ceq 'LOAD_COMPLETE_A'){Require ($data.round.status -ceq 'complete' -and $data.round.receipts.Count -eq 7 -and (Same (Round-Proof $data) (Round-Proof $Before))) 'PERSISTENCE_REFUSED'}
  if($id -ceq 'CONFIRM_EMPTY_B'){Require ($data.round.status -ceq 'executing' -and $data.round.receipts.Count -eq 0) 'SNAPSHOT_REFUSED'}
  if($id -cin @('ADVANCE_EMPTY_B','LOAD_COMPLETE_B')){Require ($data.round.status -ceq 'complete' -and $null -eq $data.round.draft -and $data.round.receipts.Count -eq 0 -and $data.recovery.Count -eq 0 -and (Same $data.profile $script:Ctx.FirstB.profile)) 'PERSISTENCE_REFUSED'}
  $script:Ctx[$Actor.Label]=Clone $data
 }elseif($Step.expectedCodeOrShape -ceq 'PROFILE_ATTRIBUTES'){
  Exact-Keys $data @('displayName','focus','revision');Require (Same $data $script:Ctx[$Actor.Label].profile) 'PERSISTENCE_REFUSED';$script:Ctx[('Profile'+$Actor.Label)]=Clone $data
 }elseif($Step.expectedCodeOrShape -ceq 'PROJECT_ATTRIBUTES'){
  Exact-Keys $data @('projectId','context','revision');Require ($data.projectId -ceq $script:Ctx.ProjectId -and $data.context -ceq 'personal' -and $data.revision -is [string]) 'PERSISTENCE_REFUSED'
 }elseif($Step.expectedCodeOrShape -ceq 'CHOICES'){
  Exact-Keys $data @('kind','items','nextCursor');Require ($data.items -is [array] -and $data.items.Count -eq 0 -and $null -eq $data.nextCursor -and $data.kind -ceq $(if($Step.route -ceq 'PROJECT_CHOICES'){'projects'}else{'notebooks'})) 'OWNERSHIP_REFUSED'
 }else{Refuse 'STATE_REFUSED'}
 Confirm-Operation $Result
}
function Invoke-MainStep($Step){
 $script:ActivePoint=$Step.id;Require (($script:Counts.requests+$script:Counts.previewRequests) -lt 64) 'STATE_REFUSED'
 $actor=if($Step.actor -cin @('A','A2')){$script:Actors[0]}elseif($Step.actor -ceq 'B'){$script:Actors[1]}else{$null}
 if($Step.transport -ceq 'PREVIEW'){
  if($script:PreviewClients.Count -eq 0){Install-ActorClients};$before=if($null -ne $actor -and $script:Ctx.ContainsKey($actor.Label)){Clone $script:Ctx[$actor.Label]}else{$null};$body=Command-Body $Step $actor;$r=Invoke-Preview $Step $actor $body;Check-PreviewStep $Step $actor $r $before
 }else{
  switch -CaseSensitive ($Step.id){
   'RLS_FOREIGN_PROFILE_A' {$r=Invoke-Operation 'FOREIGN_PROFILE' $actor $script:Actors[1];Require ($r.Status -eq 200 -and $r.Data -is [array] -and $r.Data.Count -eq 0) 'OWNERSHIP_REFUSED';Confirm-Operation $r}
   'AUTH_SETTINGS' {$r=Invoke-Operation 'SETTINGS';Require ($r.Status -eq 200 -and (Has $r.Data 'disable_signup') -and $r.Data.disable_signup -ceq $true -and (Has $r.Data 'external') -and $r.Data.external.email -ceq $true -and $r.Data.external.anonymous_users -ceq $false) 'ENVIRONMENT_REFUSED';Confirm-Operation $r}
   {$_ -cmatch '^ABSENCE_[AB]$'} {$r=Invoke-Operation 'ADMIN_ABSENCE' $actor;Require ($r.Status -eq 404 -and (Has $r.Data 'error_code') -and $r.Data.error_code -ceq 'user_not_found') 'OWNERSHIP_REFUSED';Confirm-Operation $r 'ABSENT_404'}
   {$_ -cmatch '^CREATE_[AB]$'} {$r=Invoke-Operation 'ADMIN_CREATE' $actor -Body @{id=$actor.Id;email=$actor.Email;password=$actor.Password;email_confirm=$true;app_metadata=$actor.Marker};Require ($r.Status -eq 200 -or $r.Status -eq 201) 'RESPONSE_REFUSED';Check-User $r.Data $actor;Confirm-Operation $r;$actor.CreateConfirmed=$true;$script:Counts.usersCreated++}
   {$_ -cmatch '^SIGNIN_[AB]$'} {$r=Invoke-Operation 'SIGN_IN' $actor -Body @{email=$actor.Email;password=$actor.Password};Require ($r.Status -eq 200) 'RESPONSE_REFUSED';Capture-Session $r.Data $actor;Confirm-Operation $r;$actor.SignInConfirmed=$true;$actor.Password=$null;$script:Counts.signIns++}
   {$_ -cmatch '^VERIFY_USER_[AB]$'} {$r=Invoke-Operation 'GET_USER' $actor;Require ($r.Status -eq 200) 'RESPONSE_REFUSED';Check-User $r.Data $actor;Confirm-Operation $r;$actor.UserVerified=$true}
   {$_ -cmatch '^ACCESS_[AB]$'} {Require-Access (Invoke-Operation 'ACCESS' $actor -Body @{}) $actor;$actor.AccessVerified=$true}
   {$_ -cmatch '^LOGOUT_[AB]$'} {Logout-Actor $actor;Require-TokenLive $actor}
   default {Refuse 'STATE_REFUSED'}
  }
 }
 $script:Counts.stepsKnown++
}
function Read-CompletedProbe{
 $fixed='C:\Users\Kauan Sousa Barateli\Documents\Codex\2026-10-07\inicie-a-constru-o-do-software-2\work\Segundo-Cerebro\work\ci-capture-write-20261021\parallel-delivery-20261025\onboarding-auth-admin-absence-once'
 $expected=@{plan=(Join-Path $fixed 'plan.json');result=(Join-Path $fixed 'probe-output\result.json');before=(Join-Path $fixed 'probe-output\journal\0002.json');after=(Join-Path $fixed 'probe-output\journal\0003.json')}
 foreach($key in $expected.Keys){Require ($script:Config.probeEvidence[$key].path -ceq $expected[$key] -and (File-Sha256 $expected[$key]) -ceq $script:Config.probeEvidence[$key].sha256) 'HOLD_AUTH_PREFLIGHT'}
 $p=Read-Json $expected.plan;$r=Read-Json $expected.result;$before=Read-Json $expected.before;$after=Read-Json $expected.after
 Require ($p.source -ceq $script:Config.source -and $p.projectRef -ceq $script:ProjectRef -and (Is-Uuid $p.actors.A) -and (Is-Uuid $p.actors.B) -and $p.actors.A -cne $p.actors.B -and $p.probe.userId -ceq $p.actors.A) 'HOLD_AUTH_PREFLIGHT'
 Require ($r.code -ceq 'AUTH_ADMIN_READ_ACCEPTED' -and $r.authAdminReadAccepted -ceq $true -and $r.httpStatus -eq 404 -and $r.requests -eq 1 -and $r.writesAttempted -eq 0 -and $r.usersCreated -eq 0 -and $r.usersDeleted -eq 0 -and $r.transportHalted -ceq $false -and $r.shapeUserNotFound -ceq $true) 'HOLD_AUTH_PREFLIGHT'
 Require ($before.runId -ceq $p.runId -and $after.runId -ceq $p.runId -and $before.sequence -eq 2 -and $after.sequence -eq 3 -and $before.operation -ceq 'ADMIN_ABSENCE' -and $after.operation -ceq 'ADMIN_ABSENCE' -and $before.actor -ceq 'A' -and $after.actor -ceq 'A' -and $before.phase -ceq 'before' -and $after.phase -ceq 'after' -and $after.outcome -ceq 'ABSENT_404' -and $after.httpStatus -eq 404 -and $before.stateChanging -ceq $false -and $after.stateChanging -ceq $false) 'HOLD_AUTH_PREFLIGHT'
 return @{A=$p.actors.A;B=$p.actors.B;atUtc=$after.atUtc}
}
function Check-MainInputs{
 Require ($script:Config.source -ceq '3403a5aa1901c166e6cfc1206848bfdc1c34957a' -and $script:Config.sourceTree -ceq '7fdeb63d76d30058c260ba1579e55f94c6f1c2ca' -and $script:Config.projectRef -ceq $script:ProjectRef -and $script:Config.deploymentId -ceq 'dpl_5SAkeYyRFkWYRSaStkfrQHJjL1N4') 'SOURCE_REFUSED'
 Require ((File-Sha256 (Join-Path $PSScriptRoot 'SOURCE-PINS.json')) -ceq $script:Config.sourcePinsFileSha256 -and (File-Sha256 (Join-Path $PSScriptRoot 'MATRIX.json')) -ceq $script:Config.matrixSha256 -and (File-Sha256 (Join-Path $PSScriptRoot 'PreviewCookieCodec.psm1')) -ceq $script:Config.codecSha256 -and (File-Sha256 $script:Config.authDonorPath) -ceq '61e7bbfd8369a674323853c3b652c8d3ae92bc03bb59f8445c18d38b9d451c84') 'SOURCE_REFUSED'
 $pins=Read-Json (Join-Path $PSScriptRoot 'SOURCE-PINS.json');Require ($pins.source -ceq $script:Config.source -and $pins.publicInstalledSdkVersion -ceq '0.12.7' -and $pins.git.Count -eq 15) 'SOURCE_REFUSED'
 foreach($pin in $pins.git){Require ((Has $script:Config.sourceFileSha256 $pin.path)) 'SOURCE_REFUSED';$script:SourcePins[$pin.path]=$script:Config.sourceFileSha256[$pin.path]};Check-Source
 foreach($pin in $pins.sdk){Require ((File-Sha256 (Join-Path $script:RepositoryRoot $pin.path)) -ceq $pin.sha256) 'SOURCE_REFUSED'}
 $script:Matrix=Read-Json (Join-Path $PSScriptRoot 'MATRIX.json');Require ($script:Matrix.source -ceq $script:Config.source -and $script:Matrix.requests -is [array] -and $script:Matrix.requests.Count -eq 64 -and @($script:Matrix.requests.id|Sort-Object -Unique).Count -eq 64 -and @($script:Matrix.requests|Where-Object {$_.id -ceq 'ABSENCE_A'}).Count -eq 0) 'MANIFEST_REFUSED'
 for($i=0;$i -lt 64;$i++){Require ($script:Matrix.requests[$i].sequence -eq ($i+1) -and $script:Matrix.requests[$i].automaticRetry -ceq $false) 'MANIFEST_REFUSED'}
 return Read-CompletedProbe
}
function Check-ExecuteBindings($Probe){
 Require ($script:Config.approvedByRoot -ceq $true -and $script:Config.rootConfirmedAppUrlAndDeploymentOriginSame -ceq $true -and $script:Config.rootConfirmedTargetAndSource -ceq $true) 'HOLD_PREVIEW_BINDINGS'
 try{$uri=[uri]::new($script:Config.previewOrigin,[UriKind]::Absolute)}catch{Refuse 'ENVIRONMENT_REFUSED'}
 Require ($uri.Scheme -ceq 'https' -and $uri.Port -eq 443 -and $uri.UserInfo -eq '' -and $uri.Query -eq '' -and $uri.Fragment -eq '' -and $uri.AbsolutePath -eq '/' -and $uri.Host -cmatch '^[a-z0-9][a-z0-9-]*\.vercel\.app$' -and $uri.GetLeftPart([UriPartial]::Authority) -ceq $script:Config.previewOrigin) 'ENVIRONMENT_REFUSED'
 Require (-not [string]::IsNullOrWhiteSpace($script:Config.executionWindowEndsUtc)) 'HOLD_PREVIEW_BINDINGS';$from=Time-Value $script:Config.executionWindowStartsUtc;$until=Time-Value $script:Config.executionWindowEndsUtc;$at=Time-Value $Probe.atUtc;$now=[DateTimeOffset]::UtcNow
 Require ($from -le $at -and $at -le $now -and $from -le $now -and $now.AddMinutes(5) -lt $until) 'HOLD_AUTH_PREFLIGHT'
}
function Prepare-MainManifest($Probe,[string]$RunnerHash,[string]$ConfigHash){
 $runId=[Guid]::NewGuid().ToString('D');$runs=Join-Path $PSScriptRoot 'runs';$path=Check-LocalPath (Join-Path $runs $runId) $false;Require (-not (Test-Path -LiteralPath $path)) 'MANIFEST_REFUSED';[void][IO.Directory]::CreateDirectory($path)
 $fixtures=@();foreach($label in @('A','B')){$fixtures+=@{label=$label;userId=$Probe[$label];email=('sc-onboarding-'+$label.ToLowerInvariant()+'-'+$runId.Replace('-','')+'@example.invalid');appMetadata=@{sc_homologation_api_run=$runId;sc_homologation_api_actor=$label;sc_homologation_api_project=$script:ProjectRef};clientId=[Guid]::NewGuid().ToString('D');displayName=('Homologacao onboarding '+$label+' '+$runId.Replace('-','').Substring(0,12))}}
 $clientIds=@{};foreach($step in $script:Matrix.requests){$clientIds[$step.id]=[Guid]::NewGuid().ToString('D')};$items=@{};foreach($kind in @('habit','project','task','notebook','page')){$items[$kind]=[Guid]::NewGuid().ToString('D')}
 $manifest=@{kind='sc-onboarding-preview-main-v1';schemaVersion=1;runId=$runId;source=$script:Config.source;sourceTree=$script:Config.sourceTree;projectRef=$script:ProjectRef;previewOrigin=$script:Config.previewOrigin;deploymentId=$script:Config.deploymentId;runnerSha256=$RunnerHash;configSha256=$ConfigHash;actors=$fixtures;clientIds=$clientIds;items=$items;probeAtUtc=$Probe.atUtc;noAutomaticResume=$true;googleOperations=0;existingQaTargeted=$false}
 Write-NewJson (Join-Path $path 'manifest.json') $manifest;Write-NewJson (Join-Path $path 'manifest-seal.json') @{runnerSha256=$RunnerHash;configSha256=$ConfigHash;manifestSha256=(File-Sha256 (Join-Path $path 'manifest.json'))}
 return $runId
}
function Read-MainManifest([string]$Path,$Probe,[string]$RunnerHash,[string]$ConfigHash){
 $run=Check-LocalPath $Path $true;Require ([IO.Directory]::GetParent($run).FullName -ceq (Join-Path $PSScriptRoot 'runs') -and (Is-Uuid ([IO.Path]::GetFileName($run)))) 'MANIFEST_REFUSED'
 $manifest=Read-Json (Join-Path $run 'manifest.json');$seal=Read-Json (Join-Path $run 'manifest-seal.json')
 Require ($manifest.kind -ceq 'sc-onboarding-preview-main-v1' -and $manifest.runId -ceq [IO.Path]::GetFileName($run) -and $manifest.source -ceq $script:Config.source -and $manifest.projectRef -ceq $script:ProjectRef -and $manifest.previewOrigin -ceq $script:Config.previewOrigin -and $manifest.deploymentId -ceq $script:Config.deploymentId -and $manifest.runnerSha256 -ceq $RunnerHash -and $manifest.configSha256 -ceq $ConfigHash -and $seal.runnerSha256 -ceq $RunnerHash -and $seal.configSha256 -ceq $ConfigHash -and $seal.manifestSha256 -ceq (File-Sha256 (Join-Path $run 'manifest.json')) -and $manifest.noAutomaticResume -ceq $true -and $manifest.actors.Count -eq 2) 'MANIFEST_REFUSED'
 for($i=0;$i -lt 2;$i++){$f=$manifest.actors[$i];$label=@('A','B')[$i];Require ($f.label -ceq $label -and $f.userId -ceq $Probe[$label] -and $f.email -ceq ('sc-onboarding-'+$label.ToLowerInvariant()+'-'+$manifest.runId.Replace('-','')+'@example.invalid') -and (Is-Uuid $f.clientId) -and $f.displayName -ceq ('Homologacao onboarding '+$label+' '+$manifest.runId.Replace('-','').Substring(0,12)) -and (Is-Map $f.appMetadata) -and $f.appMetadata.Count -eq 3 -and $f.appMetadata.sc_homologation_api_run -ceq $manifest.runId -and $f.appMetadata.sc_homologation_api_actor -ceq $label -and $f.appMetadata.sc_homologation_api_project -ceq $script:ProjectRef) 'OWNERSHIP_REFUSED'}
 foreach($step in $script:Matrix.requests){Require ((Has $manifest.clientIds $step.id)) 'MANIFEST_REFUSED'};foreach($key in @('habit','project','task','notebook','page')){Require ((Has $manifest.items $key)) 'MANIFEST_REFUSED'};Require ($manifest.clientIds.Count -eq 64 -and @($manifest.clientIds.Values|Sort-Object -Unique).Count -eq 64 -and $manifest.items.Count -eq 5) 'MANIFEST_REFUSED';foreach($v in @($manifest.clientIds.Values)+@($manifest.items.Values)){Require (Is-Uuid $v) 'MANIFEST_REFUSED'}
 Require (-not (Test-Path -LiteralPath (Join-Path $run 'journal')) -and -not (Test-Path -LiteralPath (Join-Path $run 'result.json'))) 'MANIFEST_REFUSED';return $manifest
}
function Export-KnownFixtureBindings([string]$RunPath,[string]$Filename){
 $known=@{};foreach($label in @('A','B')){if($script:Ctx.ContainsKey($label)){$snap=$script:Ctx[$label];$known[$label]=@{roundId=if($null -ne $snap.round){$snap.round.id}else{$null};receipts=if($null -ne $snap.round){$snap.round.receipts}else{@()}}}}
 Write-NewJson (Join-Path $RunPath $Filename) @{source=$script:Config.source;runId=$script:Manifest.runId;actors=@($script:Actors|ForEach-Object{@{label=$_.Label;userId=$_.Id;createConfirmed=$_.CreateConfirmed;signInConfirmed=$_.SignInConfirmed;loggedOut=$_.LoggedOut;deleted=$_.Deleted;absent=$_.Absent}});knownCoordinatorBindings=$known;containsOnlyDisposableFixtureBindings=$true;credentialsIncluded=$false}
}
