[CmdletBinding()]
param(
    [string]$MainBranch = "main",
    [string]$Remote = "origin",
    [string]$VersionScript = "version:minor",
    [string]$SourceBranch,
    [Alias("DeleteSourceBranchAfterSuccess")]
    [switch]$DeleteRepoAfterSuccess
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-ExecutableCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Candidates
    )

    foreach ($candidate in $Candidates) {
        $resolvedCommand = Get-Command -Name $candidate -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($resolvedCommand) {
            if ($resolvedCommand.Path) {
                return $resolvedCommand.Path
            }

            return $resolvedCommand.Name
        }
    }

    throw ("Unable to resolve command. Tried: {0}" -f ($Candidates -join ", "))
}

$script:GitCommand = Resolve-ExecutableCommand -Candidates @("git.exe", "git")
$script:NpmCommand = Resolve-ExecutableCommand -Candidates @("npm.cmd", "npm")

function Join-ArgumentDisplay {
    param(
        [string[]]$Arguments
    )

    return ($Arguments | ForEach-Object {
        if ($_ -match '\s') {
            '"' + $_ + '"'
        }
        else {
            $_
        }
    }) -join ' '
}

function Join-ProcessArgumentString {
    param(
        [string[]]$Arguments
    )

    return ($Arguments | ForEach-Object {
        $value = [string]$_
        if ($value -match '[\s"]') {
            '"' + ($value -replace '(\\*)"', '$1$1\\"') + '"'
        }
        else {
            $value
        }
    }) -join ' '
}

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Command,
        [string[]]$Arguments = @(),
        [switch]$CaptureOutput
    )

    $processInfo = New-Object System.Diagnostics.ProcessStartInfo
    $processInfo.FileName = $Command
    $processInfo.Arguments = Join-ProcessArgumentString -Arguments $Arguments
    $processInfo.RedirectStandardOutput = $true
    $processInfo.RedirectStandardError = $true
    $processInfo.UseShellExecute = $false
    $processInfo.CreateNoWindow = $true

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $processInfo
    $null = $process.Start()

    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    $combinedOutput = @($stdout, $stderr) -join ''
    $combinedOutput = $combinedOutput.TrimEnd("`r", "`n")

    if ($process.ExitCode -ne 0) {
        $details = if ($combinedOutput) { $combinedOutput } else { "(no output)" }
        throw ("Command failed: {0} {1}{2}{3}" -f $Command, (Join-ArgumentDisplay -Arguments $Arguments), [Environment]::NewLine, $details)
    }

    if ($CaptureOutput) {
        return $combinedOutput.Trim()
    }

    if ($stdout) {
        $stdout.TrimEnd("`r", "`n") | Write-Host
    }

    if ($stderr) {
        $stderr.TrimEnd("`r", "`n") | Write-Host
    }
}

function Get-GitOutput {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    return Invoke-CheckedCommand -Command $script:GitCommand -Arguments $Arguments -CaptureOutput
}

function Invoke-GitMutation {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Description,
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    Write-Host ("-> {0}" -f $Description)
    Invoke-CheckedCommand -Command $script:GitCommand -Arguments $Arguments
}

function Invoke-NpmMutation {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Description,
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    Write-Host ("-> {0}" -f $Description)
    Invoke-CheckedCommand -Command $script:NpmCommand -Arguments $Arguments
}

function Assert-CleanWorkingTree {
    $status = Get-GitOutput -Arguments @("status", "--porcelain")
    if ($status) {
        throw "Working tree is not clean. Commit or stash your changes before running this script."
    }
}

function Get-PackageVersion {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RepoRoot
    )

    $packageJsonPath = Join-Path $RepoRoot "package.json"
    return (Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json).version
}

function Ensure-BranchExists {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BranchName
    )

    $null = Get-GitOutput -Arguments @("show-ref", "--verify", "--quiet", "refs/heads/$BranchName")
}

function Ensure-RemoteBranchExists {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RemoteName,
        [Parameter(Mandatory = $true)]
        [string]$BranchName
    )

    $null = Get-GitOutput -Arguments @("show-ref", "--verify", "--quiet", "refs/remotes/$RemoteName/$BranchName")
}

function Ensure-BranchMergedIntoTarget {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BranchName,
        [Parameter(Mandatory = $true)]
        [string]$TargetRef
    )

    $null = Get-GitOutput -Arguments @("merge-base", "--is-ancestor", $BranchName, $TargetRef)
}

function Ensure-LocalAndRemoteMainMatch {
    param(
        [Parameter(Mandatory = $true)]
        [string]$MainBranchName,
        [Parameter(Mandatory = $true)]
        [string]$RemoteName
    )

    $localSha = Get-GitOutput -Arguments @("rev-parse", $MainBranchName)
    $remoteSha = Get-GitOutput -Arguments @("rev-parse", "$RemoteName/$MainBranchName")

    if ($localSha -ne $remoteSha) {
        throw ("Local {0} ({1}) is not in sync with {2}/{0} ({3})." -f $MainBranchName, $localSha, $RemoteName, $remoteSha)
    }
}

function Test-LocalBranchExists {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BranchName
    )

    $output = Get-GitOutput -Arguments @("branch", "--list", $BranchName)
    return -not [string]::IsNullOrWhiteSpace($output)
}

function Test-RemoteBranchExists {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RemoteName,
        [Parameter(Mandatory = $true)]
        [string]$BranchName
    )

    $output = Get-GitOutput -Arguments @("branch", "-r", "--list", "$RemoteName/$BranchName")
    return -not [string]::IsNullOrWhiteSpace($output)
}

function Resolve-RecentMergedBranch {
    param(
        [Parameter(Mandatory = $true)]
        [string]$MainBranchName
    )

    $headMessage = Get-GitOutput -Arguments @("log", "-1", "--pretty=%B", $MainBranchName)
    $standardMergeMatch = [regex]::Match($headMessage, "Merge branch '([^']+)' into " + [regex]::Escape($MainBranchName))
    if ($standardMergeMatch.Success) {
        return $standardMergeMatch.Groups[1].Value
    }

    $legacyMergeMatch = [regex]::Match($headMessage.Trim(), '^Merge\s+([^\s]+)$')
    if ($legacyMergeMatch.Success) {
        return $legacyMergeMatch.Groups[1].Value
    }

    throw "Unable to infer the merged feature branch from the latest main-branch commit. Pass -SourceBranch explicitly."
}

function Remove-MergedBranch {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RepoRoot,
        [Parameter(Mandatory = $true)]
        [string]$MainBranchName,
        [Parameter(Mandatory = $true)]
        [string]$RemoteName,
        [Parameter(Mandatory = $true)]
        [string]$BranchName
    )

    Write-Host ("Repository: {0}" -f $RepoRoot)
    Write-Host ("Main branch: {0}" -f $MainBranchName)
    Write-Host ("Remote: {0}" -f $RemoteName)
    Write-Host ("Branch to delete: {0}" -f $BranchName)

    if ($BranchName -eq $MainBranchName) {
        throw "Refusing to delete the main branch."
    }

    Invoke-GitMutation -Description "Fetch $RemoteName/$MainBranchName" -Arguments @("fetch", $RemoteName, $MainBranchName)
    Ensure-RemoteBranchExists -RemoteName $RemoteName -BranchName $MainBranchName
    Ensure-LocalAndRemoteMainMatch -MainBranchName $MainBranchName -RemoteName $RemoteName
    Write-Host ("Verified: local {0} and {1}/{0} are in sync." -f $MainBranchName, $RemoteName)

    $activeBranch = Get-GitOutput -Arguments @("branch", "--show-current")
    if ($activeBranch -ne $MainBranchName) {
        Invoke-GitMutation -Description "Switch to $MainBranchName" -Arguments @("switch", $MainBranchName)
    }

    $localBranchExists = Test-LocalBranchExists -BranchName $BranchName
    $remoteBranchExists = Test-RemoteBranchExists -RemoteName $RemoteName -BranchName $BranchName

    if ($localBranchExists) {
        Ensure-BranchMergedIntoTarget -BranchName $BranchName -TargetRef $MainBranchName
        Write-Host ("Verified: {0} is merged into local {1}." -f $BranchName, $MainBranchName)
    }
    elseif ($remoteBranchExists) {
        Ensure-BranchMergedIntoTarget -BranchName "$RemoteName/$BranchName" -TargetRef "$RemoteName/$MainBranchName"
        Write-Host ("Verified: {0}/{1} is merged into {0}/{2}." -f $RemoteName, $BranchName, $MainBranchName)
    }
    else {
        Write-Host ("Branch {0} was not found locally or on {1}. Nothing to delete." -f $BranchName, $RemoteName)
        return
    }

    if ($remoteBranchExists) {
        Invoke-GitMutation -Description "Delete $RemoteName/$BranchName" -Arguments @("push", $RemoteName, "--delete", $BranchName)
    }
    else {
        Write-Host ("Remote branch {0}/{1} was not found. Skipping remote deletion." -f $RemoteName, $BranchName)
    }

    if ($localBranchExists) {
        Invoke-GitMutation -Description "Delete local branch $BranchName" -Arguments @("branch", "-D", $BranchName)
    }
    else {
        Write-Host ("Local branch {0} was not found. Skipping local deletion." -f $BranchName)
    }

    Invoke-GitMutation -Description "Prune deleted remote refs from $RemoteName" -Arguments @("fetch", $RemoteName, "--prune")
    Write-Host ("Branch cleanup completed for {0}" -f $BranchName)
}

function Complete-DeleteAfterSuccess {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RepoRoot,
        [Parameter(Mandatory = $true)]
        [string]$MainBranchName,
        [Parameter(Mandatory = $true)]
        [string]$RemoteName,
        [string]$SourceBranchName
    )

    $branchToDelete = if ($SourceBranchName) { $SourceBranchName } else { Resolve-RecentMergedBranch -MainBranchName $MainBranchName }
    Write-Host "DeleteRepoAfterSuccess was provided, so the script will verify main and delete the merged feature branch."
    Remove-MergedBranch -RepoRoot $RepoRoot -MainBranchName $MainBranchName -RemoteName $RemoteName -BranchName $branchToDelete
}

$repoRoot = Get-GitOutput -Arguments @("rev-parse", "--show-toplevel")
Set-Location -LiteralPath $repoRoot

Assert-CleanWorkingTree

Ensure-BranchExists -BranchName $MainBranch
$currentBranch = Get-GitOutput -Arguments @("branch", "--show-current")

if ($DeleteRepoAfterSuccess -and -not $PSBoundParameters.ContainsKey("SourceBranch") -and $currentBranch -eq $MainBranch) {
    Complete-DeleteAfterSuccess -RepoRoot $repoRoot -MainBranchName $MainBranch -RemoteName $Remote
    return
}

$branchToMerge = if ($SourceBranch) { $SourceBranch } else { $currentBranch }

if ([string]::IsNullOrWhiteSpace($branchToMerge)) {
    throw "Unable to determine the source branch to merge."
}

if ($branchToMerge -eq $MainBranch) {
    if ($DeleteRepoAfterSuccess) {
        Complete-DeleteAfterSuccess -RepoRoot $repoRoot -MainBranchName $MainBranch -RemoteName $Remote -SourceBranchName $SourceBranch
        return
    }

    throw "Source branch matches the main branch. Run this from the feature branch, or pass -SourceBranch explicitly."
}

Ensure-BranchExists -BranchName $branchToMerge

Write-Host ("Repository: {0}" -f $repoRoot)
Write-Host ("Source branch: {0}" -f $branchToMerge)
Write-Host ("Main branch: {0}" -f $MainBranch)
Write-Host ("Remote: {0}" -f $Remote)

$startingVersion = Get-PackageVersion -RepoRoot $repoRoot
Write-Host ("Starting version: {0}" -f $startingVersion)

if ($currentBranch -ne $branchToMerge) {
    Invoke-GitMutation -Description "Switch to source branch $branchToMerge" -Arguments @("switch", $branchToMerge)
}

Invoke-NpmMutation -Description "Bump package version with npm run $VersionScript" -Arguments @("run", $VersionScript)

$endingVersion = Get-PackageVersion -RepoRoot $repoRoot
if ($endingVersion -ne $startingVersion) {
    $versionFiles = @("package.json")
    if (Test-Path -LiteralPath (Join-Path $repoRoot "package-lock.json")) {
        $versionFiles += "package-lock.json"
    }

    $stageArguments = @("add", "--") + $versionFiles
    Invoke-GitMutation -Description "Stage version files" -Arguments $stageArguments
    Invoke-GitMutation -Description "Commit version bump" -Arguments @("commit", "-m", "chore: bump version to $endingVersion")
}
else {
    Write-Host "Version did not change, so no version-bump commit was created."
}

Invoke-GitMutation -Description "Fetch $Remote/$MainBranch" -Arguments @("fetch", $Remote, $MainBranch)
Ensure-RemoteBranchExists -RemoteName $Remote -BranchName $MainBranch

Invoke-GitMutation -Description "Switch to $MainBranch" -Arguments @("switch", $MainBranch)
Invoke-GitMutation -Description "Fast-forward local $MainBranch from $Remote/$MainBranch" -Arguments @("merge", "--ff-only", "$Remote/$MainBranch")
Invoke-GitMutation -Description "Merge $branchToMerge into $MainBranch" -Arguments @("merge", "--no-ff", $branchToMerge, "-m", "Merge branch '$branchToMerge' into $MainBranch")

Ensure-BranchMergedIntoTarget -BranchName $branchToMerge -TargetRef $MainBranch
Assert-CleanWorkingTree
Write-Host ("Verified: {0} is merged into local {1}." -f $branchToMerge, $MainBranch)

Invoke-GitMutation -Description "Push local $MainBranch to $Remote/$MainBranch" -Arguments @("push", $Remote, $MainBranch)
Invoke-GitMutation -Description "Refresh $Remote/$MainBranch after push" -Arguments @("fetch", $Remote, $MainBranch)
Ensure-LocalAndRemoteMainMatch -MainBranchName $MainBranch -RemoteName $Remote
Write-Host ("Verified: local {0} and {1}/{0} are in sync." -f $MainBranch, $Remote)

if ($DeleteRepoAfterSuccess) {
    Remove-MergedBranch -RepoRoot $repoRoot -MainBranchName $MainBranch -RemoteName $Remote -BranchName $branchToMerge
}
else {
    Write-Host "DeleteRepoAfterSuccess was not provided, so the merged feature branch was kept."
}
