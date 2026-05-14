# WattRent firewall setup script
# Must be run as Administrator

Write-Host "Setting up WattRent firewall rules..." -ForegroundColor Yellow

# Verify the script is running with administrator privileges
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator"))
{
    Write-Host "This script requires administrator privileges." -ForegroundColor Red
    Write-Host "Please run PowerShell as Administrator, then re-run this script." -ForegroundColor Yellow
    pause
    exit
}

# Add firewall rules
try {
    # Remove the old rule if it exists
    Remove-NetFirewallRule -DisplayName "WattRent Backend" -ErrorAction SilentlyContinue
    
    # Add the new rule
    New-NetFirewallRule -DisplayName "WattRent Backend" `
                        -Direction Inbound `
                        -Protocol TCP `
                        -LocalPort 8080 `
                        -Action Allow `
                        -Profile Any
    
    Write-Host "Firewall rule created successfully." -ForegroundColor Green
    Write-Host "  Port 8080 is now open for inbound connections." -ForegroundColor Green
} catch {
    Write-Host "Failed to create firewall rule:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

pause
