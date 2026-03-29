[CmdletBinding()]
param(
    [string]$MainBranch = "main",
    [string]$Remote = "origin",
    [string]$VersionScript = "version:minor",
    [string]$SourceBranch,
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

function Ensure-BranchMergedIntoHead {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BranchName
    )

    $null = Get-GitOutput -Arguments @("merge-base", "--is-ancestor", $BranchName, "HEAD")
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

function Start-RepoDeletion {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RepoRoot
    )

    $parentDirectory = Split-Path -Path $RepoRoot -Parent
    $cleanupScriptPath = Join-Path $env:TEMP ("repo-cleanup-{0}.ps1" -f [Guid]::NewGuid().ToString("N"))
    $cleanupScript = @'
param(
    [Parameter(Mandatory = $true)]
    [string]$TargetPath,
    [Parameter(Mandatory = $true)]
    [string]$CleanupScriptPath
)

Start-Sleep -Seconds 3

if (Test-Path -LiteralPath $TargetPath) {
    Remove-Item -LiteralPath $TargetPath -Recurse -Force
}

if (Test-Path -LiteralPath $CleanupScriptPath) {
    Remove-Item -LiteralPath $CleanupScriptPath -Force -ErrorAction SilentlyContinue
}
'@

    Set-Content -LiteralPath $cleanupScriptPath -Value $cleanupScript -Encoding ascii
    Start-Process -FilePath "powershell.exe" `
        -WorkingDirectory $parentDirectory `
        -ArgumentList @(
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            $cleanupScriptPath,
            "-TargetPath",
            $RepoRoot,
            "-CleanupScriptPath",
            $cleanupScriptPath
        ) | Out-Null
}

$repoRoot = Get-GitOutput -Arguments @("rev-parse", "--show-toplevel")
Set-Location -LiteralPath $repoRoot

Assert-CleanWorkingTree

Ensure-BranchExists -BranchName $MainBranch
$currentBranch = Get-GitOutput -Arguments @("branch", "--show-current")
$branchToMerge = if ($SourceBranch) { $SourceBranch } else { $currentBranch }

if ([string]::IsNullOrWhiteSpace($branchToMerge)) {
    throw "Unable to determine the source branch to merge."
}

if ($branchToMerge -eq $MainBranch) {
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

Ensure-BranchMergedIntoHead -BranchName $branchToMerge
Assert-CleanWorkingTree
Write-Host ("Verified: {0} is merged into local {1}." -f $branchToMerge, $MainBranch)

Invoke-GitMutation -Description "Push local $MainBranch to $Remote/$MainBranch" -Arguments @("push", $Remote, $MainBranch)
Invoke-GitMutation -Description "Refresh $Remote/$MainBranch after push" -Arguments @("fetch", $Remote, $MainBranch)
Ensure-LocalAndRemoteMainMatch -MainBranchName $MainBranch -RemoteName $Remote
Write-Host ("Verified: local {0} and {1}/{0} are in sync." -f $MainBranch, $Remote)

if ($DeleteRepoAfterSuccess) {
    Start-RepoDeletion -RepoRoot $repoRoot
    Write-Host ("Deletion scheduled for {0}" -f $repoRoot)
}
else {
    Write-Host "DeleteRepoAfterSuccess was not provided, so the local repository was kept."
}






