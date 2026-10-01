param([switch]$ExistingAccount)

$ErrorActionPreference = 'Stop'
$setupRoot = Split-Path -Parent $PSScriptRoot
$securePassword = $null
$secureConfirmation = $null
$plainPassword = $null
$confirmation = $null

function Invoke-OperatorStep {
    param([string]$Action, [string]$Email, [string]$Password)
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = (Get-Command node -ErrorAction Stop).Source
    $startInfo.WorkingDirectory = $setupRoot
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardInput = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.ArgumentList.Add('--import')
    $startInfo.ArgumentList.Add('tsx')
    $startInfo.ArgumentList.Add('scripts/setup-local-operator.ts')
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    $started = $false
    try {
        [void]$process.Start()
        $started = $true
        $outputTask = $process.StandardOutput.ReadToEndAsync()
        $errorTask = $process.StandardError.ReadToEndAsync()
        $process.StandardInput.WriteLine((@{ action = $Action; email = $Email; password = $Password } | ConvertTo-Json -Compress))
        $process.StandardInput.Close()
        if (-not $process.WaitForExit(15000)) {
            $process.Kill($true)
            $process.WaitForExit()
            Write-Host 'Setup timed out. The signup may already exist; inspect Mailpit before trying again.'
            return $false
        }
        $output = $outputTask.GetAwaiter().GetResult()
        [void]$errorTask.GetAwaiter().GetResult()
        if ($output) { Write-Host (($output | ConvertFrom-Json).message) }
        else { Write-Host 'Setup worker failed; no credentials were printed.' }
        return $process.ExitCode -eq 0
    } finally {
        if ($started -and -not $process.HasExited) {
            $process.Kill($true)
            $process.WaitForExit()
        }
        $process.Dispose()
    }
}

try {
    Write-Host 'Local operator setup. Passwords are hidden and are not saved.'
    $operatorEmail = Read-Host 'Operator email (a controlled local test address, such as operator@example.test)'
    $securePassword = Read-Host 'Operator password (8-72 UTF-8 bytes)' -AsSecureString
    $plainPassword = [System.Net.NetworkCredential]::new('', $securePassword).Password
    if (-not $ExistingAccount) {
        $secureConfirmation = Read-Host 'Confirm password' -AsSecureString
        $confirmation = [System.Net.NetworkCredential]::new('', $secureConfirmation).Password
        if ($plainPassword -cne $confirmation) { Write-Host 'Passwords do not match. No account was submitted.'; exit 1 }
        $confirmation = $null
        if (-not (Invoke-OperatorStep -Action 'signup' -Email $operatorEmail -Password $plainPassword)) { exit 1 }
        Write-Host 'Open http://localhost:8025, open your confirmation email, and click its verification link.'
        Write-Host 'The frontend redirect may fail because no frontend exists yet; email confirmation can still have completed.'
        [void](Read-Host 'After verifying, press Enter to save your operator UUID')
    }
    if (-not (Invoke-OperatorStep -Action 'authorize' -Email $operatorEmail -Password $plainPassword)) { exit 1 }
} catch {
    Write-Host 'Operator setup stopped. No password was saved or printed.'
    exit 1
} finally {
    $plainPassword = $null
    $confirmation = $null
    if ($securePassword) { $securePassword.Dispose() }
    if ($secureConfirmation) { $secureConfirmation.Dispose() }
}
