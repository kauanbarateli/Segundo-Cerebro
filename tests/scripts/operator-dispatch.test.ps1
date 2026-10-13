param([Parameter(Mandatory=$true)][string]$NodePath)
$ErrorActionPreference='Stop'
$sourcePath=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\scripts\operations\run-operator.ps1'))
$tokens=$null;$parseErrors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($sourcePath,[ref]$tokens,[ref]$parseErrors)
if($parseErrors.Count){throw 'OPERATOR_PARSE_FAILED'}
$assignments=@($ast.FindAll({param($node) $node-is [Management.Automation.Language.AssignmentStatementAst] -and $node.Operator-eq [Management.Automation.Language.TokenKind]::Equals -and $node.Left-is [Management.Automation.Language.VariableExpressionAst] -and $node.Left.VariablePath.UserPath-eq 'operatorArguments'},$true))
$archiveGuards=@($ast.FindAll({param($node) $node-is [Management.Automation.Language.IfStatementAst] -and $node.Extent.Text.StartsWith("if(`$Operation -in @('verify','restore'))")},$true))
if($assignments.Count-ne 1-or $archiveGuards.Count-ne 1){throw 'OPERATOR_DISPATCH_SOURCE_AMBIGUOUS'}
# Execute only the original public assignment/archive guard, with synthetic
# arguments. No profile loader, credentials, backup CLI or network is invoked.
$dispatch=[ScriptBlock]::Create($assignments[0].Extent.Text+';'+$archiveGuards[0].Extent.Text)
$passed=0;$nativeCalls=0
foreach($case in @(
 @{Operation='create';Archive=$null;Expected=@('create')},
 @{Operation='check';Archive=$null;Expected=@('check')},
 @{Operation='restore-preflight';Archive=$null;Expected=@('restore-preflight')},
 @{Operation='restore-capabilities';Archive=$null;Expected=@('check')},
 @{Operation='restore-delegation';Archive=$null;Expected=@('check')},
 @{Operation='verify';Archive='SYNTHETIC.scbackup';Expected=@('verify','SYNTHETIC.scbackup')},
 @{Operation='restore';Archive='SYNTHETIC.scbackup';Expected=@('restore','SYNTHETIC.scbackup')}
)){
 $Operation=$case.Operation;$Archive=$case.Archive;$operatorArguments=$null
 . $dispatch
 if($operatorArguments-isnot [Array]){throw 'OPERATOR_ARGUMENT_ARRAY_REQUIRED'}
 $actual=& $NodePath -e 'process.stdout.write(JSON.stringify(process.argv.slice(1)))' @operatorArguments
 $nativeCalls++
 if($LASTEXITCODE-ne 0){throw 'SYNTHETIC_NODE_FAILED'}
 $values=ConvertFrom-Json -InputObject $actual -NoEnumerate
 if(($values|ConvertTo-Json -Compress)-cne ($case.Expected|ConvertTo-Json -Compress)){throw 'OPERATOR_ARGUMENTS_SPLIT_OR_CHANGED'}
 $passed++
}
foreach($case in @(
 @{Operation='verify';Archive=$null;Error='ARCHIVE_REQUIRED'},
 @{Operation='restore';Archive=$null;Error='ARCHIVE_REQUIRED'},
 @{Operation='create';Archive='SYNTHETIC.scbackup';Error='UNEXPECTED_ARCHIVE'},
 @{Operation='check';Archive='SYNTHETIC.scbackup';Error='UNEXPECTED_ARCHIVE'},
 @{Operation='restore-preflight';Archive='SYNTHETIC.scbackup';Error='UNEXPECTED_ARCHIVE'},
 @{Operation='restore-capabilities';Archive='SYNTHETIC.scbackup';Error='UNEXPECTED_ARCHIVE'},
 @{Operation='restore-delegation';Archive='SYNTHETIC.scbackup';Error='UNEXPECTED_ARCHIVE'}
)){
 $Operation=$case.Operation;$Archive=$case.Archive;$operatorArguments=$null;$refused=$false
 try{. $dispatch}catch{if($_.Exception.Message-cne $case.Error){throw 'OPERATOR_REFUSAL_CHANGED'};$refused=$true}
 if(-not $refused){throw 'OPERATOR_ARCHIVE_GUARD_BYPASSED'}
 $passed++
}
[pscustomobject]@{ok=$true;passed=$passed;nativeSyntheticCalls=$nativeCalls;profilesRead=$false;remoteExecuted=$false}|ConvertTo-Json -Compress
