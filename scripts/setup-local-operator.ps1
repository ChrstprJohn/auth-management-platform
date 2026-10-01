param([switch]$ExistingAccount, [switch]$Terminal)

$ErrorActionPreference = 'Stop'
$setupRoot = Split-Path -Parent $PSScriptRoot
$securePassword = $null
$secureConfirmation = $null
$plainPassword = $null
$confirmation = $null
$guiMode = -not $Terminal

function Read-OperatorCredentials {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    [System.Windows.Forms.Application]::EnableVisualStyles()
    $form = New-Object System.Windows.Forms.Form
    $form.Text = 'Local operator setup'
    $form.ClientSize = New-Object System.Drawing.Size(480, 350)
    $form.StartPosition = 'CenterScreen'
    $form.FormBorderStyle = 'FixedDialog'
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $form.AutoScaleMode = 'Dpi'
    $fields = @{}
    $captions = @('Email', 'Password', 'Confirm password')
    for ($index = 0; $index -lt $captions.Count; $index++) {
        $label = New-Object System.Windows.Forms.Label
        $label.Text = $captions[$index]
        $label.Location = New-Object System.Drawing.Point(20, (20 + $index * 65))
        $label.AutoSize = $true
        $field = New-Object System.Windows.Forms.TextBox
        $field.Location = New-Object System.Drawing.Point(20, (42 + $index * 65))
        $field.Size = New-Object System.Drawing.Size(440, 25)
        $field.ShortcutsEnabled = $true
        $field.UseSystemPasswordChar = $index -gt 0
        $field.MaxLength = if ($index -eq 0) { 254 } else { 144 }
        $field.TabIndex = $index
        $fields[$captions[$index]] = $field
        $form.Controls.Add($label)
        $form.Controls.Add($field)
    }
    $existing = New-Object System.Windows.Forms.CheckBox
    $existing.Text = 'I already created this account (skip signup)'
    $existing.Location = New-Object System.Drawing.Point(20, 218)
    $existing.Size = New-Object System.Drawing.Size(440, 25)
    $existing.TabIndex = 3
    $existing.Checked = [bool]$ExistingAccount
    $fields['Confirm password'].Enabled = -not $existing.Checked
    $existing.Add_CheckedChanged({ $fields['Confirm password'].Enabled = -not $existing.Checked }.GetNewClosure())
    $form.Controls.Add($existing)
    $hint = New-Object System.Windows.Forms.Label
    $hint.Text = 'Use Ctrl+V or right-click Paste. Passwords are not saved.'
    $hint.Location = New-Object System.Drawing.Point(20, 250)
    $hint.Size = New-Object System.Drawing.Size(440, 35)
    $form.Controls.Add($hint)
    $continue = New-Object System.Windows.Forms.Button
    $continue.Text = 'Continue'
    $continue.Location = New-Object System.Drawing.Point(250, 300)
    $continue.Size = New-Object System.Drawing.Size(100, 30)
    $continue.TabIndex = 4
    $continue.Add_Click({
        if (-not $fields['Email'].Text.Trim() -or -not $fields['Password'].Text) {
            [void][System.Windows.Forms.MessageBox]::Show('Enter your email and password.', 'Local operator setup')
            return
        }
        if (-not $existing.Checked -and $fields['Password'].Text -cne $fields['Confirm password'].Text) {
            [void][System.Windows.Forms.MessageBox]::Show('Passwords do not match.', 'Local operator setup')
            return
        }
        $form.Tag = @{ email = $fields['Email'].Text.Trim(); password = $fields['Password'].Text; existing = $existing.Checked }
        $form.DialogResult = 'OK'
        $form.Close()
    }.GetNewClosure())
    $form.Controls.Add($continue)
    $cancel = New-Object System.Windows.Forms.Button
    $cancel.Text = 'Cancel'
    $cancel.Location = New-Object System.Drawing.Point(360, 300)
    $cancel.Size = New-Object System.Drawing.Size(100, 30)
    $cancel.DialogResult = 'Cancel'
    $cancel.TabIndex = 5
    $form.Controls.Add($cancel)
    $form.AcceptButton = $continue
    $form.CancelButton = $cancel
    try {
        if ($form.ShowDialog() -eq 'OK') { return $form.Tag }
        return $null
    } finally {
        foreach ($field in $fields.Values) { $field.Clear() }
        $form.Tag = $null
        $form.Dispose()
    }
}

function Stop-OperatorWorker {
    param([System.Diagnostics.Process]$Process)
    if (-not $Process.HasExited) {
        # Windows PowerShell's .NET runtime lacks Kill(entireProcessTree).
        & taskkill.exe /PID $Process.Id /T /F 2>&1 | Out-Null
        if (-not $Process.HasExited) { $Process.Kill() }
        $Process.WaitForExit()
    }
}

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
    # Fixed arguments work in Windows PowerShell 5.1 as well as PowerShell 7.
    # Credentials are passed only over stdin, never through command arguments.
    $startInfo.Arguments = '--import tsx scripts/setup-local-operator.ts'
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
            Stop-OperatorWorker -Process $process
            Write-Host 'Setup timed out. The signup may already exist; inspect Mailpit before trying again.'
            return $false
        }
        $output = $outputTask.GetAwaiter().GetResult()
        [void]$errorTask.GetAwaiter().GetResult()
        if ($output) {
            $message = ($output | ConvertFrom-Json).message
            Write-Host $message
            if ($guiMode -and ($process.ExitCode -ne 0 -or $Action -eq 'authorize')) {
                [void][System.Windows.Forms.MessageBox]::Show($message, 'Local operator setup')
            }
        }
        else { Write-Host 'Setup worker failed; no credentials were printed.' }
        return $process.ExitCode -eq 0
    } finally {
        if ($started -and -not $process.HasExited) {
            Stop-OperatorWorker -Process $process
        }
        $process.Dispose()
    }
}

try {
    Write-Host 'Local operator setup. Passwords are hidden and are not saved.'
    if ($guiMode) {
        $credentials = Read-OperatorCredentials
        if ($null -eq $credentials) { exit 0 }
        $operatorEmail = $credentials.email
        $plainPassword = $credentials.password
        $ExistingAccount = [bool]$credentials.existing
        $credentials.Clear()
        $credentials = $null
    } else {
        $operatorEmail = Read-Host 'Operator email (a controlled local test address, such as operator@example.test)'
        $securePassword = Read-Host 'Operator password (8-72 UTF-8 bytes)' -AsSecureString
        $plainPassword = [System.Net.NetworkCredential]::new('', $securePassword).Password
    }
    if (-not $ExistingAccount) {
        if (-not $guiMode) {
            $secureConfirmation = Read-Host 'Confirm password' -AsSecureString
            $confirmation = [System.Net.NetworkCredential]::new('', $secureConfirmation).Password
            if ($plainPassword -cne $confirmation) { Write-Host 'Passwords do not match. No account was submitted.'; exit 1 }
            $confirmation = $null
        }
        if (-not (Invoke-OperatorStep -Action 'signup' -Email $operatorEmail -Password $plainPassword)) { exit 1 }
        Write-Host 'Open http://localhost:8025, open your confirmation email, and click its verification link.'
        Write-Host 'The frontend redirect may fail because no frontend exists yet; email confirmation can still have completed.'
        if ($guiMode) {
            $result = [System.Windows.Forms.MessageBox]::Show('Open http://localhost:8025 and click the verification link in the newest email. Then click OK here to verify login and save your operator UUID automatically. If a link fails, you can still try OK: login checks whether verification already succeeded.', 'Verify email in Mailpit', 'OKCancel')
            if ($result -ne 'OK') { exit 0 }
        } else {
            [void](Read-Host 'After verifying, press Enter to save your operator UUID')
        }
    }
    if (-not (Invoke-OperatorStep -Action 'authorize' -Email $operatorEmail -Password $plainPassword)) { exit 1 }
} catch {
    Write-Host 'Operator setup stopped. No password was saved or printed.'
    if ($guiMode -and ('System.Windows.Forms.MessageBox' -as [type])) {
        [void][System.Windows.Forms.MessageBox]::Show('Operator setup stopped. Check that local GoTrue is running. No password was saved or printed.', 'Local operator setup')
    }
    exit 1
} finally {
    $plainPassword = $null
    $confirmation = $null
    if ($securePassword) { $securePassword.Dispose() }
    if ($secureConfirmation) { $secureConfirmation.Dispose() }
}
