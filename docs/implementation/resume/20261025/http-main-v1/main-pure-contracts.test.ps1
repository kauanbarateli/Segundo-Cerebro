#requires -Version 7.5
$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
$script:Codes=@('RESPONSE_REFUSED','SNAPSHOT_REFUSED','OWNERSHIP_REFUSED','ACCESS_STATE_REFUSED','PERSISTENCE_REFUSED','REPLAY_REFUSED','STATE_REFUSED','MANIFEST_REFUSED','COMMAND_REFUSED','COMMIT_UNCONFIRMED','UNEXPECTED_FAILURE','HOLD_PROTECTION')
function Install-Pure([string]$File,[string[]]$Names){$e=$null;$t=$null;$a=[Management.Automation.Language.Parser]::ParseFile($File,[ref]$t,[ref]$e);if(@($e).Count){throw 'AST_REFUSED'};foreach($n in $Names){$f=@($a.FindAll({param($x)$x -is [Management.Automation.Language.FunctionDefinitionAst]},$true)|Where-Object {$_.Name -ceq $n});if($f.Count -ne 1){throw 'AST_REFUSED'};. ([scriptblock]::Create($f[0].Extent.Text))}}
# Each installed definition is placed in this script's scope, never Invoke-Main.
$entry=Join-Path $PSScriptRoot 'run-onboarding-preview-main.ps1';$runtime=Join-Path $PSScriptRoot 'Main.Runtime.ps1'
foreach($pair in @(@($entry,@('Refuse','Require','Is-Map','Has','Is-Uuid')),@($runtime,@('Exact-Keys','Canonical','Same','Clone','Round-Proof','Time-Value','Assert-Snapshot','Is-AppUnauthorized','Command-Body','Check-PreviewStep')))){
 $e=$null;$t=$null;$a=[Management.Automation.Language.Parser]::ParseFile($pair[0],[ref]$t,[ref]$e);if(@($e).Count){throw 'AST_REFUSED'};foreach($n in $pair[1]){$f=@($a.FindAll({param($x)$x -is [Management.Automation.Language.FunctionDefinitionAst]},$true)|Where-Object {$_.Name -ceq $n});if($f.Count -ne 1){throw 'AST_REFUSED'};. ([scriptblock]::Create($f[0].Extent.Text))}
}
$script:Checks=0;function Assert-Case([bool]$Value){$script:Checks++;if(-not $Value){throw 'PURE_ASSERTION_FAILED'}}
$owner='11111111-1111-4111-8111-111111111111';$actor=[pscustomobject]@{Id=$owner;Label='A';DisplayName='Synthetic'}
$s=@{schemaVersion=1;ownerId=$owner;today='2026-10-25';timeZone='America/Sao_Paulo';eligibility=@{kind='existing_opt_in';canStart=$true;offerPending=$false;reason=$null};capabilities=@{configuracoes=$true;calendario=$true;habitos=$true;projetos=$true;tarefas=$true;conhecimento=$true;financeiro=$true;cofre=$true};profile=@{displayName=$null;focus=$null;revision='opaque'};round=$null;calendar=@{status='ready';canConnect=$true;accounts=@();sources=@()};recovery=@()}
Assert-Case ((Assert-Snapshot (Clone $s) $actor).ownerId -ceq $owner)
Assert-Case (Same @{b=@(1,2);a='x'} @{a='x';b=@(1,2)})
Assert-Case (-not (Same @{revision='0'} @{revision=0}))
foreach($kind in @('owner','timezone','civil','extra')){$bad=Clone $s;switch($kind){owner{$bad.ownerId='22222222-2222-4222-8222-222222222222'}timezone{$bad.timeZone='UTC'}civil{$bad.today='2026-02-31'}extra{$bad.extra=$true}};$refused=$false;try{$null=Assert-Snapshot $bad $actor}catch{$refused=$true};Assert-Case $refused}
$err=@{ok=$false;code='UNAUTHENTICATED';message='Não foi possível confirmar esta operação.'};Assert-Case (Is-AppUnauthorized 401 'application/json' $err)
foreach($bad in @(@(401,'text/html',$err),@(403,'application/json',$err),@(401,'application/json',@{ok=$true;code='UNAUTHENTICATED';message=$err.message}),@(401,'application/json',@{ok=$false;code='UNAUTHENTICATED';message='ARBITRARY'}),@(401,'application/json',@{ok=$false;code='UNAUTHENTICATED';message=$err.message;extra=$true}))){Assert-Case (-not (Is-AppUnauthorized $bad[0] $bad[1] $bad[2]))}
$script:Manifest=@{clientIds=@{SAVE_REPLAY_A='x';ADVANCE_REPLAY_A='y'}};$script:Ctx=@{A=@{round=@{id=$owner;revision='12'}};SaveValid=@{command='onboarding.save';input=@{clientId='same';expectedRevision='2';draft=@{profile=@{focus='personal'}}}};LastAdvance=@{command='onboarding.advance';input=@{clientId='last';roundId=$owner}}}
Assert-Case (Same (Command-Body @{id='SAVE_REPLAY_A';method='POST'} $actor) $script:Ctx.SaveValid)
Assert-Case (Same (Command-Body @{id='ADVANCE_REPLAY_A';method='POST'} $actor) $script:Ctx.LastAdvance)
# This test suite does not construct any client or load the SDK, entry or secrets.
[ordered]@{code='MAIN_PURE_CONTRACTS_PASSED';assertions=$script:Checks;network=0;sdkClientInstantiated=$false;entryExecuted=$false}|ConvertTo-Json -Compress
