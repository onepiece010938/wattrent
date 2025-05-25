# WattRent 防火牆設定腳本
# 需要以管理員身份執行

Write-Host "設定 WattRent 防火牆規則..." -ForegroundColor Yellow

# 檢查是否以管理員身份執行
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator"))
{
    Write-Host "此腳本需要管理員權限。" -ForegroundColor Red
    Write-Host "請以管理員身份執行 PowerShell，然後再次執行此腳本。" -ForegroundColor Yellow
    pause
    exit
}

# 添加防火牆規則
try {
    # 移除舊規則（如果存在）
    Remove-NetFirewallRule -DisplayName "WattRent Backend" -ErrorAction SilentlyContinue
    
    # 添加新規則
    New-NetFirewallRule -DisplayName "WattRent Backend" `
                        -Direction Inbound `
                        -Protocol TCP `
                        -LocalPort 8080 `
                        -Action Allow `
                        -Profile Any
    
    Write-Host "✓ 防火牆規則已成功建立！" -ForegroundColor Green
    Write-Host "  端口 8080 現在已開放入站連線。" -ForegroundColor Green
} catch {
    Write-Host "✗ 建立防火牆規則時發生錯誤：" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

pause 