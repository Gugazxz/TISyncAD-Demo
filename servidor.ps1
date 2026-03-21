<#
.SYNOPSIS
    Servidor backend PowerShell para a aplicação TIsyncAD.
.DESCRIPTION
    Este script cria um servidor HTTP local usando HttpListener para receber requisições do frontend web.
    Ele processa as chamadas e executa comandos no Active Directory On-Premises e no Microsoft Entra ID (via Graph API).
    
    ATENÇÃO: Este é um código de referência sanitizado. Para uso em produção, preencha as variáveis globais 
    abaixo com as informações reais do seu ambiente e garanta que o script rode com privilégios adequados.
#>

# =========================================================================
# CONFIGURAÇÕES DO AMBIENTE (PREENCHER ANTES DE USAR EM PRODUÇÃO)
# =========================================================================

# Configurações de Autenticação para o Microsoft Graph
$Global:clientId = "[INSIRA_SEU_CLIENT_ID_AQUI]"
$Global:tenantId = "[INSIRA_SEU_TENANT_ID_AQUI]"
$Global:certThumbprint = "[INSIRA_O_THUMBPRINT_DO_CERTIFICADO_AQUI]"

# Ambiente AD
$Global:ADConnectServer = "[NOME_DO_SERVIDOR_AD_CONNECT]" # Ex: SRV-ADSYNC01
$Global:caminhoBaseDasOUs = "OU=Usuarios,OU=SuaEmpresa,DC=dominio,DC=local"
$Global:defaultDomain = "exemplo.com.br"
$Global:telefonePadrao = "+55 (00) 0000-0000"
$Global:sitePadrao = "www.exemplo.com.br"
$Global:grupoVpnPadrao = "VPN_Acesso_Padrao"

# =========================================================================

try {
    Import-Module Microsoft.PowerShell.Security -ErrorAction Stop
} catch {
    Write-Host "ERRO CRÍTICO: Não foi possível carregar o módulo Microsoft.PowerShell.Security. Erro: $($_.Exception.Message)" -ForegroundColor Red
    pause
    exit
}

function Remove-Accents {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$String
    )
    $normalizedString = $String.Normalize([System.Text.NormalizationForm]::FormD)
    $stringBuilder = New-Object System.Text.StringBuilder
    foreach ($char in $normalizedString.ToCharArray()) {
        if ([System.Globalization.CharUnicodeInfo]::GetUnicodeCategory($char) -ne 'NonSpacingMark') {
            $stringBuilder.Append($char) | Out-Null
        }
    }
    return $stringBuilder.ToString()
}

# Módulos
try {
    Write-Host "Verificando e carregando módulos necessários..."
    if ($PSVersionTable.PSVersion.Major -ge 7 -and $PSVersionTable.PSVersion.Minor -ge 4) {
        $session = New-PSSession -ConfigurationName Microsoft.PowerShell -ErrorAction Stop
        Import-PSSession -Session $session -Module ActiveDirectory -Prefix "Compat" -ErrorAction Stop | Out-Null
        Get-Command -Module ($session.Name) | ForEach-Object { if ($_.Name -match "^Compat") { $newName = $_.Name -replace "Compat"; if (-not (Get-Command $newName -ErrorAction SilentlyContinue)) { New-Alias -Name $newName -Value $_.Name -Force } } }
    } else {
       if ($PSVersionTable.PSVersion.Major -ge 7) {
            $session = New-PSSession -ConfigurationName Microsoft.PowerShell -ErrorAction Stop
            Import-PSSession -Session $session -Module ActiveDirectory -Prefix "Compat" -ErrorAction Stop | Out-Null
            Get-Command -Module ($session.Name) | ForEach-Object {
                if ($_.Name -match "^Compat") {
                    $newName = $_.Name -replace "Compat", ""
                    if (-not (Get-Command $newName -ErrorAction SilentlyContinue)) {
                        New-Alias -Name $newName -Value $_.Name -Force
                    }
                }
            }
        } else {
            Import-Module ActiveDirectory -ErrorAction Stop
        }
    }
    $requiredGraphModules = @("Microsoft.Graph.Authentication", "Microsoft.Graph.Users", "Microsoft.Graph.Users.Actions")
    foreach ($module in $requiredGraphModules) {
        if (-not (Get-Module -ListAvailable -Name $module)) {
            throw "Módulo '$module' não encontrado. Por favor, instale-o com 'Install-Module $module'."
        }
        Import-Module $module -ErrorAction Stop
    }
    Write-Host "Módulos carregados com sucesso." -ForegroundColor Green
} catch {
    Write-Host "ERRO CRÍTICO AO CARREGAR MÓDULOS: $($_.Exception.Message)" -ForegroundColor Red
    pause
    exit
}

# Criação em massa função
function Start-ADMultipleUserCreation {
    param(
        [Parameter(Mandatory)] [array]$Nomes,
        [Parameter(Mandatory)] [string]$CentroCusto,
        [Parameter(Mandatory)] [string]$Dominio
    )

    $usuariosCriados = @()
    $erros = @()

    try {
        $ouObject = Get-ADOrganizationalUnit -Filter "Name -eq '$CentroCusto'"
        if (-not $ouObject) { throw "O Centro de Custo '$CentroCusto' não foi encontrado para nenhum dos usuários." }
        $ouPath = $ouObject.DistinguishedName
    } catch {
        foreach($nome in $Nomes){
            $erros += [PSCustomObject]@{
                NomeCompleto = $nome
                Message      = "Centro de Custo '$CentroCusto' inválido ou não encontrado."
            }
        }
        return [PSCustomObject]@{ usuariosCriados = $usuariosCriados; erros = $erros }
    }


    foreach ($nome in $Nomes) {
        try {
            # Lógica para dados do user
            $NomeCompletoFormatado = (Get-Culture).TextInfo.ToTitleCase($nome.ToLower())
            
            $partesNomeParaSam = $NomeCompletoFormatado.Split(' ') | Where-Object { $_ -notin @('de', 'da', 'do', 'dos', 'das') }
            if ($partesNomeParaSam.Length -lt 2) {
                throw "O nome '$nome' deve conter pelo menos um nome e um sobrenome."
            }
            $primeiroNomeSam = (Remove-Accents -String $partesNomeParaSam[0]).ToLower()
            $ultimoNomeSam = (Remove-Accents -String $partesNomeParaSam[-1]).ToLower()
            $samAccountName = "$primeiroNomeSam.$ultimoNomeSam"
            
            if (Get-ADUser -Filter "SamAccountName -eq '$samAccountName'" -ErrorAction SilentlyContinue) {
                throw "O usuário '$samAccountName' já existe no Active Directory."
            }

            $partesNomeCompleto = $NomeCompletoFormatado.Split(' ', 2)
            $givenName = $partesNomeCompleto[0]
            $surname = if ($partesNomeCompleto.Length -gt 1) { $partesNomeCompleto[1] } else { "" }

            $userPrincipalName = "$samAccountName@$Dominio"
            $senhaInicial = "$($primeiroNomeSam.Substring(0, 3).ToUpper())$($ultimoNomeSam.Substring(0, 3).ToLower())123*"
            $securePassword = ConvertTo-SecureString $senhaInicial -AsPlainText -Force

            # Parâmetros do usuário
            $userParams = @{
                Name                  = $NomeCompletoFormatado
                DisplayName           = $NomeCompletoFormatado
                GivenName             = $givenName            
                Surname               = $surname          
                SamAccountName        = $samAccountName
                UserPrincipalName     = $userPrincipalName
                Path                  = $ouPath
                Description           = $CentroCusto        
                EmailAddress          = $userPrincipalName
                OfficePhone           = $Global:telefonePadrao   
                HomePage              = $Global:sitePadrao
                AccountPassword       = $securePassword
                Enabled               = $true
                ChangePasswordAtLogon = $false
            }
            $novoUsuario = New-ADUser @userParams -ErrorAction Stop -PassThru
            
            Set-ADAccountPassword -Identity $novoUsuario.SamAccountName -NewPassword $securePassword -ErrorAction Stop

            try { Add-ADGroupMember -Identity $Global:grupoVpnPadrao -Members $samAccountName -ErrorAction Stop } catch {}

            $usuariosCriados += [PSCustomObject]@{
                NomeCompleto    = $NomeCompletoFormatado
                Username        = $samAccountName
                InitialPassword = $senhaInicial
            }

        } catch {
            $erros += [PSCustomObject]@{
                NomeCompleto = $nome
                Message      = $_.Exception.Message
            }
            continue 
        }
    }

    return [PSCustomObject]@{
        usuariosCriados = $usuariosCriados
        erros           = $erros
    }
}


function Start-ADUserCreationAndSync {
    param(
        [Parameter(Mandatory)] [string]$NomeCompleto,
        [Parameter(Mandatory)] [string]$Cargo,
        [Parameter(Mandatory)] [string]$Setor,
        [Parameter(Mandatory)] [string]$CentroCusto,
        [Parameter(Mandatory)] [string]$Gestor,
        [Parameter(Mandatory)] [string]$Dominio,
        [Parameter(Mandatory)] [string]$Licenca,
        [Parameter(Mandatory=$false)] [array]$GruposSelecionados,
        [Parameter(Mandatory=$false)] [string]$LogonWorkstations
    )
    try {
        $NomeCompletoFormatado = (Get-Culture).TextInfo.ToTitleCase($NomeCompleto.ToLower())

        $partesNomeParaSam = $NomeCompletoFormatado.Split(' ') | Where-Object { $_ -notin @('de', 'da', 'do', 'dos', 'das') }
        $primeiroNomeSam = (Remove-Accents -String $partesNomeParaSam[0]).ToLower()
        $ultimoNomeSam = (Remove-Accents -String $partesNomeParaSam[-1]).ToLower()
        $samAccountName = "$primeiroNomeSam.$ultimoNomeSam"

        $partesNomeCompleto = $NomeCompletoFormatado.Split(' ', 2)
        $givenName = $partesNomeCompleto[0]
        $surname = if ($partesNomeCompleto.Length -gt 1) { $partesNomeCompleto[1] } else { "" }
        
        $userPrincipalName = "$samAccountName@$Dominio"
        
        if (Get-ADUser -Filter "SamAccountName -eq '$samAccountName'" -ErrorAction SilentlyContinue) {
            throw "O usuário '$samAccountName' já existe no Active Directory."
        }

        $senhaInicial = "$($primeiroNomeSam.Substring(0, 3).ToUpper())$($ultimoNomeSam.Substring(0, 3).ToLower())123*"
        $securePassword = ConvertTo-SecureString $senhaInicial -AsPlainText -Force
        
        $ouPath = (Get-ADOrganizationalUnit -Filter "Name -eq '$CentroCusto'").DistinguishedName
        if (-not $ouPath) { throw "O Centro de Custo '$CentroCusto' não foi encontrado." }

        $userParams = @{
            Name                 = $NomeCompletoFormatado
            DisplayName          = $NomeCompletoFormatado
            GivenName            = $givenName
            Surname              = $surname
            SamAccountName       = $samAccountName
            UserPrincipalName    = $userPrincipalName
            Path                 = $ouPath
            Description          = $CentroCusto
            Department           = $Setor
            Title                = $Cargo
            Manager              = $Gestor
            OfficePhone          = $Global:telefonePadrao
            EmailAddress         = $userPrincipalName
            HomePage             = $Global:sitePadrao
            AccountPassword      = $securePassword
            Enabled              = $true
            ChangePasswordAtLogon = $false
        }
        $novoUsuario = New-ADUser @userParams -ErrorAction Stop -PassThru

        Set-ADAccountPassword -Identity $novoUsuario.SamAccountName -NewPassword $securePassword -ErrorAction Stop

        $licenseGroupMap = @{
            "E3"       = "Microsoft 365 E3"
            "Standard" = "Microsoft 365 Business Standard"
            "Basic"    = "Microsoft 365 Business Basic"
        }

        if ($licenseGroupMap.ContainsKey($Licenca)) {
            $groupName = $licenseGroupMap[$Licenca]
            try { Add-ADGroupMember -Identity $groupName -Members $novoUsuario.SamAccountName -ErrorAction Stop } catch {}
        }

        if (-not [string]::IsNullOrWhiteSpace($LogonWorkstations)) {
            try {
                Set-ADUser -Identity $novoUsuario.SamAccountName -LogonWorkstations $LogonWorkstations -ErrorAction Stop
                Write-Host "Restrição de logon para '$samAccountName' definida como '$LogonWorkstations'." -ForegroundColor Green
                try {
                    $computerExists = Get-ADComputer -Identity $LogonWorkstations -ErrorAction SilentlyContinue
                    if ($computerExists) {
                        $managerDN = $novoUsuario.DistinguishedName
                        Set-ADComputer -Identity $LogonWorkstations -ManagedBy $managerDN -Description $samAccountName -ErrorAction Stop
                        Write-Host "No computador '$($LogonWorkstations)', 'Gerenciado por' e 'Descrição' foram atualizados." -ForegroundColor Green
                    } else {
                        Write-Warning "Computador '$LogonWorkstations' não encontrado."
                    }
                } catch {
                    Write-Warning "FALHA ao atualizar os campos do computador '$LogonWorkstations'. Erro: $($_.Exception.Message)"
                }
            } catch {
                Write-Warning "Usuário '$samAccountName' criado, mas FALHOU ao definir estações de trabalho. Erro: $($_.Exception.Message)"
            }
        }

        try { Add-ADGroupMember -Identity $Global:grupoVpnPadrao -Members $novoUsuario.SamAccountName -ErrorAction Stop } catch {}

        if ($null -ne $GruposSelecionados) {
            foreach ($grupo in $GruposSelecionados) {
                try { Add-ADGroupMember -Identity $grupo -Members $novoUsuario.SamAccountName -ErrorAction Stop } catch {}
            }
        }

        try { Invoke-Command -ComputerName $Global:ADConnectServer -ScriptBlock { Start-ADSyncSyncCycle -PolicyType Delta } -ErrorAction Stop | Out-Null } catch {}

        return [PSCustomObject]@{ Success = $true; Message = "Usuário criado no AD."; Username = $samAccountName; InitialPassword = $senhaInicial; Email = $userParams.UserPrincipalName }
    } catch {
        return [PSCustomObject]@{ Success = $false; Message = "Falha na criação: $($_.Exception.Message)" }
    }
}

function Start-M365UserLicensing {
    param([Parameter(Mandatory)][string]$UserPrincipalName, [Parameter(Mandatory)][string]$Licenca)
    Start-Job -ScriptBlock {
        param($UserPrincipalName, $Licenca, $clientId, $tenantId, $certThumbprint)
        try {
            Import-Module Microsoft.Graph.Authentication, Microsoft.Graph.Users -ErrorAction Stop
            Connect-MgGraph -ClientId $clientId -TenantId $tenantId -CertificateThumbprint $certThumbprint -NoWelcome
            foreach ($i in 1..6) {
                $usuarioAzure = Get-MgUser -UserId $UserPrincipalName -ErrorAction SilentlyContinue
                if ($usuarioAzure) { break }
                Start-Sleep -Seconds 30
            }
            if (-not $usuarioAzure) { throw "Usuário não encontrado no Azure AD." }
            Update-MgUser -UserId $UserPrincipalName -UsageLocation "BR"
            $skuMap = @{ "E3" = "ENTERPRISEPACK"; "Standard" = "O365_BUSINESS_PREMIUM"; "Basic" = "O365_BUSINESS_ESSENTIALS" }
            $skuParaAtribuir = $skuMap[$Licenca]
            if (-not $skuParaAtribuir) { throw "Licença '$Licenca' inválida."}
            $skuObject = Get-MgSubscribedSku | Where-Object { $_.SkuPartNumber -eq $skuParaAtribuir }
            if (-not $skuObject) { throw "SKU '$skuParaAtribuir' não encontrada." }
            $params = @{ AddLicenses = @(@{ SkuId = $skuObject.SkuId }); RemoveLicenses = @() }
            Set-MgUserLicense -UserId $UserPrincipalName -BodyParameter $params -ErrorAction Stop | Out-Null
        } catch {} finally { 
            Disconnect-MgGraph 
        }
    } -ArgumentList $UserPrincipalName, $Licenca, $Global:clientId, $Global:tenantId, $Global:certThumbprint | Out-Null
}

# Servidor LocalHost
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8080/")
Write-Host "Iniciando servidor na porta 8080. Acesse http://localhost:8080. Pressione CTRL+C para parar." -ForegroundColor Green
try { $listener.Start() } catch { Write-Host "ERRO CRÍTICO: Não foi possível iniciar o listener. Erro: $($_.Exception.Message)" -ForegroundColor Red; pause; exit }

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    $response.Headers.Add("Access-Control-Allow-Origin", "*")
    $response.Headers.Add("Access-control-Allow-Methods", "GET, POST, OPTIONS")
    $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")

    try {
        $endpoint = $request.Url.AbsolutePath
        $isApiRequest = $endpoint -match "^/(buscar-gestor|buscar-ou|buscar-grupos|buscar-notebooks|get-licenses|criar-usuario-ad|licenciar-usuario|verificar-usuario|criar-multiplos-usuarios|forcar-sincronizacao|buscar-usuario-detalhes|redefinir-senha|alternar-status-usuario|atualizar-usuario|buscar-usuario-sugestoes)$"

        if ($isApiRequest) {
            $requestBody = [System.IO.StreamReader]::new($request.InputStream).ReadToEnd()
            $jsonData = if ($requestBody) { $requestBody | ConvertFrom-Json } else { $null }
            $result = $null
            
            switch ($endpoint) {
                "/buscar-gestor"     { 
                    $filter = "((Name -like '*$($jsonData.searchTerm)*') -and (Enabled -eq `$true) -and (EmailAddress -like '*'))"
                    $result = @(Get-ADUser -Filter $filter -Properties DisplayName, EmailAddress | Select-Object DisplayName, DistinguishedName)
                }
                "/buscar-ou"         { 
                    $result = @(Get-ADOrganizationalUnit -SearchBase $Global:caminhoBaseDasOUs -Filter "Name -like '*$($jsonData.searchTerm)*'" -SearchScope Subtree | Select-Object Name, DistinguishedName)
                }
                "/buscar-grupos"     { 
                    $result = @(Get-ADGroup -Filter "((Name -like 'G-*') -and (Name -like '*$($jsonData.searchTerm)*'))" | Select-Object Name) 
                }
                "/buscar-notebooks"  {
                    $filter = "((Name -like 'N*') -and (Name -like '*$($jsonData.searchTerm)*'))"
                    $result = @(Get-ADComputer -Filter $filter | Select-Object Name)
                }
                "/buscar-usuario-sugestoes" {
                    try {
                        $filter = "(anr -eq '$($jsonData.searchTerm)')"
                        $result = @(Get-ADUser -Filter $filter | Select-Object DisplayName, SamAccountName | Sort-Object DisplayName | Select-Object -First 10)
                    } catch {
                        $result = @()
                    }
                }
                "/get-licenses"      { 
                    Connect-MgGraph -ClientId $Global:clientId -TenantId $global:tenantId -CertificateThumbprint $Global:certThumbprint -NoWelcome
                    try { 
                        $result = @(Get-MgSubscribedSku | Select-Object SkuPartNumber, ConsumedUnits, @{N='EnabledUnits';E={ if ($_.PrepaidUnits) { $_.PrepaidUnits.Enabled } else { 0 } }})
                    } finally { 
                        Disconnect-MgGraph 
                    } 
                }

                "/criar-usuario-ad"  { $result = Start-ADUserCreationAndSync -NomeCompleto $jsonData.nomeCompleto -Dominio $jsonData.dominio -Cargo $jsonData.cargo -Setor $jsonData.setor -CentroCusto $jsonData.centroCusto -Gestor $jsonData.gestor -GruposSelecionados $jsonData.grupos -LogonWorkstations $jsonData.logonWorkstations -Licenca $jsonData.licenca }
                "/licenciar-usuario" { Start-M365UserLicensing -UserPrincipalName $jsonData.userPrincipalName -Licenca $jsonData.licenca; $result = [PSCustomObject]@{ Success = $true } }
                "/verificar-usuario" { $user = Get-ADUser -Filter "SamAccountName -eq '$($jsonData.samAccountName)'" -ErrorAction SilentlyContinue; $result = [PSCustomObject]@{ Exists = ($null -ne $user) } }
                "/criar-multiplos-usuarios" {
                    $result = Start-ADMultipleUserCreation -Nomes $jsonData.nomes -CentroCusto $jsonData.centroCusto -Dominio $jsonData.dominio
                }
                "/forcar-sincronizacao" {
                    try {
                        Invoke-Command -ComputerName $Global:ADConnectServer -ScriptBlock { Start-ADSyncSyncCycle -PolicyType Delta } -ErrorAction Stop | Out-Null
                        $result = [PSCustomObject]@{ Success = $true; Message = "Sincronização iniciada com sucesso." }
                    } catch {
                        $result = [PSCustomObject]@{ Success = $false; Message = "Falha ao iniciar a sincronização: $($_.Exception.Message)" }
                    }
                }
                 "/buscar-usuario-detalhes" {
                    try {
                        $user = Get-ADUser -Identity $jsonData.searchTerm -Properties DisplayName, SamAccountName, Enabled, Title, Department, Manager, Description
                        if ($user) {
                            $managerName = $null
                            if (-not [string]::IsNullOrWhiteSpace($user.Manager)) {
                                try {
                                    $manager = Get-ADUser -Identity $user.Manager -Properties DisplayName -ErrorAction SilentlyContinue
                                    if ($manager) {
                                        $managerName = $manager.DisplayName
                                    }
                                } catch {}
                            }
                            $result = [PSCustomObject]@{ 
                                Success = $true
                                User = $user | Select-Object DisplayName, SamAccountName, Enabled, Title, Department, @{N='ManagerDN'; E={$_.Manager}}, Description, @{N='ManagerName'; E={$managerName}}
                            }
                        } else {
                            throw "Usuário não encontrado."
                        }
                    } catch {
                        $result = [PSCustomObject]@{ Success = $false; Message = $_.Exception.Message }
                    }
                }

                "/redefinir-senha" {
                    try {
                        $samAccountName = $jsonData.samAccountName
                        $novaSenha = $jsonData.newPassword

                        if ([string]::IsNullOrWhiteSpace($novaSenha)) {
                            throw "A nova senha não pode estar em branco."
                        }

                        $securePassword = ConvertTo-SecureString $novaSenha -AsPlainText -Force
                        Set-ADAccountPassword -Identity $samAccountName -NewPassword $securePassword
                        Set-ADUser -Identity $samAccountName -ChangePasswordAtLogon $false
                        
                        $result = [PSCustomObject]@{ Success = $true; Message = "Senha redefinida com sucesso." }
                    } catch {
                        $result = [PSCustomObject]@{ Success = $false; Message = $_.Exception.Message }
                    }
                }

                "/alternar-status-usuario" {
                    try {
                        $samAccountName = $jsonData.samAccountName
                        $user = Get-ADUser -Identity $samAccountName
                        if ($user.Enabled) {
                            Disable-ADAccount -Identity $samAccountName
                            $status = "desabilitado"
                        } else {
                            Enable-ADAccount -Identity $samAccountName
                            $status = "habilitado"
                        }
                        $result = [PSCustomObject]@{ Success = $true; Message = "Usuário $status com sucesso." }
                    } catch {
                        $result = [PSCustomObject]@{ Success = $false; Message = $_.Exception.Message }
                    }
                }
                
                "/atualizar-usuario" {
                    try {
                        $samAccountName = $jsonData.samAccountName
                        $paramsObject = $jsonData.params[0]
                        $managerDN = $null
                        $paramsToSet = @{}
                        foreach ($property in $paramsObject.PSObject.Properties) {
                            $paramsToSet[$property.Name] = $property.Value
                        }
                        
                        if ($paramsToSet.ContainsKey('Manager')) {
                            $managerDN = $paramsToSet['Manager']
                            $paramsToSet.Remove('Manager')
                        }
                        
                        if ($paramsToSet.Keys.Count -gt 0) {
                            Set-ADUser -Identity $samAccountName -Replace $paramsToSet
                        }

                        if ($managerDN) {
                            Set-ADUser -Identity $samAccountName -Manager $managerDN
                        }

                        $result = [PSCustomObject]@{ Success = $true; Message = "Usuário atualizado com sucesso." }
                    } catch {
                        $result = [PSCustomObject]@{ Success = $false; Message = $_.Exception.Message }
                    }
                }
            }
            $responseBody = $result | ConvertTo-Json -Depth 5
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseBody)
            $contentType = "application/json; charset=utf-8"

        } else {
            $filePath = Join-Path $PSScriptRoot ($endpoint -replace '^/', ''); if ($endpoint -eq '/') { $filePath = Join-Path $PSScriptRoot 'index.html' }
            if (Test-Path $filePath) {
                $extension = [System.IO.Path]::GetExtension($filePath).ToLower()
                $contentType = switch ($extension) { ".css" { "text/css" } ".js" { "application/javascript" } ".png" { "image/png" } default { "text/html; charset=utf-8" } }
                $buffer = if ($contentType -like "image/*") { [System.IO.File]::ReadAllBytes($filePath) } else { [System.Text.Encoding]::UTF8.GetBytes((Get-Content -Path $filePath -Raw)) }
            } else {
                $response.StatusCode = 404
                $buffer = [System.Text.Encoding]::UTF8.GetBytes("404 - Arquivo Nao Encontrado: $filePath")
            }
        }
    } catch {
        $response.StatusCode = 500
        $errorMessage = [PSCustomObject]@{ Message = "Erro interno no servidor: $($_.Exception.Message)" } | ConvertTo-Json -Depth 5
        $buffer = [System.Text.Encoding]::UTF8.GetBytes($errorMessage)
        $contentType = "application/json; charset=utf-8"
    }
    $response.ContentType = $contentType
    if ($buffer) {
        $response.ContentLength64 = $buffer.Length
        try {
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        } catch {
            Write-Warning "Não foi possível enviar a resposta. A conexão pode ter sido fechada. Erro: $($_.Exception.Message)"
        }
    }
    $response.Close()
}