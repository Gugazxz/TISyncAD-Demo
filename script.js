document.addEventListener('DOMContentLoaded', () => {
    // Na versão demo, não usamos uma API real. 
    // const API_BASE_URL = 'http://localhost:8080';

    const ui = {
        telas: {
            dadosUsuario: document.getElementById('tela-dados-usuario'),
            computadores: document.getElementById('tela-computadores'),
            licencas: document.getElementById('tela-licencas'),
            grupos: document.getElementById('tela-grupos'),
            sucesso: document.getElementById('tela-sucesso'),
            lote: document.getElementById('tela-lote'),
            sucessoLote: document.getElementById('tela-sucesso-lote'),
            gerenciamento: document.getElementById('tela-gerenciamento')
        },
        mainContent: document.getElementById('main-content'),
        form: document.getElementById('createUserForm'),
        status: {
            dadosUsuario: document.getElementById('status-dados-usuario'),
            licencas: document.getElementById('status-licencas'),
            lote: document.getElementById('multi-user-status'),
            gerenciamento: document.getElementById('status-gerenciamento')
        },
        popupContainer: document.getElementById('popup-container'),
        subtitulo: document.getElementById('subtitulo'),
        menu: {
            openBtn: document.getElementById('open-menu-btn'),
            closeBtn: document.getElementById('close-menu-btn'),
            menuPanel: document.getElementById('app-menu'),
            padraoBtn: document.getElementById('menu-criacao-padrao'),
            loteBtn: document.getElementById('menu-criacao-lote'),
            gerenciarBtn: document.getElementById('menu-gerenciar-usuario'),
            syncBtn: document.getElementById('menu-forcar-sincronizacao')
        },
        inputs: {
            nomeCompleto: document.getElementById('nomeCompleto'),
            domainSelect: document.getElementById('domainSelect'),
            cargo: document.getElementById('cargo'),
            setor: document.getElementById('setor'),
            gestorSearch: document.getElementById('gestorSearch'),
            gestorHidden: document.getElementById('gestor'),
            ouSearch: document.getElementById('ouSearch'),
            ouHidden: document.getElementById('centroCusto'),
            groupSearch: document.getElementById('groupSearch'),
            logonWorkstationsSearch: document.getElementById('logonWorkstationsSearch'),
            logonWorkstationsHidden: document.getElementById('logonWorkstations')
        },
        lote: {
            nameList: document.getElementById('multi-user-name-list'),
            addNameBtn: document.getElementById('add-user-name-field-btn'),
            ouSearch: document.getElementById('multiOuSearch'),
            ouHidden: document.getElementById('multiCentroCusto'),
            ouSugestoes: document.getElementById('multiOuSugestoes'),
            domainSelect: document.getElementById('multiDomainSelect'),
            spinnerOU: document.getElementById('spinnerMultiOU'),
            createBtn: document.getElementById('btnCriarMultiplosUsuarios'),
            successResults: document.getElementById('multi-success-results'),
            copyAllBtn: document.getElementById('btnCopiarMultiplosDados'),
            createNewBtn: document.getElementById('btnCriarNovoMulti')
        },
        gerenciamento: {
            userSearch: document.getElementById('userSearch'),
            spinner: document.getElementById('spinnerUserSearch'),
            detailsContainer: document.getElementById('userDetails'),
            displayName: document.getElementById('manageDisplayName'),
            cargo: document.getElementById('manageCargo'),
            setor: document.getElementById('manageSetor'),
            centroCusto: document.getElementById('manageCentroCusto'),
            gestorSearch: document.getElementById('manageGestorSearch'),
            gestorHidden: document.getElementById('manageGestor'),
            btnSalvar: document.getElementById('btnSalvarAlteracoes'),
            btnRedefinirSenha: document.getElementById('btnRedefinirSenha'),
            btnAlternarStatus: document.getElementById('btnAlternarStatus'),
            gestorAtual: document.getElementById('manageGestorAtual'),
            displayGestorContainer: document.getElementById('displayGestorContainer'),
            searchGestorContainer: document.getElementById('searchGestorContainer'),
            btnEditarGestor: document.getElementById('btnEditarGestor'),
            passwordModal: {
                overlay: document.getElementById('password-modal-overlay'),
                input: document.getElementById('new-password-input'),
                confirmBtn: document.getElementById('btn-confirm-password'),
                cancelBtn: document.getElementById('btn-cancel-password'),
                toggleVisibilityBtn: document.getElementById('toggle-password-visibility'),
                reqs: {
                    length: document.getElementById('req-length'),
                    letter: document.getElementById('req-letter'),
                    number: document.getElementById('req-number'),
                    special: document.getElementById('req-special')
                }
            }
        },
        sugestoes: {
            gestor: document.getElementById('gestorSugestoes'),
            ou: document.getElementById('ouSugestoes'),
            grupo: document.getElementById('groupSugestoes'),
            loteOU: document.getElementById('multiOuSugestoes'),
            manageGestor: document.getElementById('manageGestorSugestoes'),
            userSearch: document.getElementById('userSearchSugestoes'),
            logonWorkstations: document.getElementById('logonWorkstationsSugestoes')
        },
        spinners: {
            gestor: document.getElementById('spinnerGestor'),
            ou: document.getElementById('spinnerOU'),
            grupo: document.getElementById('spinnerGroup'),
            loteOU: document.getElementById('spinnerMultiOU'),
            manageGestor: document.getElementById('spinnerManageGestor'),
            logonWorkstations: document.getElementById('spinnerLogonWorkstations')
        },
        botoes: {
            proximoComputadores: document.getElementById('btnProximoComputadores'),
            voltarDados: document.getElementById('btnVoltarDados'),
            proximoLicencas: document.getElementById('btnProximoLicencas'),
            voltarComputadores: document.getElementById('btnVoltarComputadores'),
            proximoGrupos: document.getElementById('btnProximoGrupos'),
            voltarLicencas: document.getElementById('btnVoltarLicencas'),
            criarUsuario: document.getElementById('btnCriarUsuario'),
            criarNovo: document.getElementById('btnCriarNovo'),
            copiarDados: document.getElementById('btnCopiarDados')
        },
        contadoresLicenca: {
            e3: document.getElementById('e3-disponiveis'),
            standard: document.getElementById('standard-disponiveis'),
            basic: document.getElementById('basic-disponiveis')
        },
        dadosSucesso: {
            email: document.getElementById('success-email'),
            usuario: document.getElementById('success-usuario'),
            senha: document.getElementById('success-senha'),
            details: document.getElementById('success-details')
        },
        licencaCards: document.querySelectorAll('.licenca-card'),
        selectedGroupsList: document.getElementById('selectedGroupsList'),
        charCounter: document.getElementById('char-counter'),
        usernameStatusIcon: document.getElementById('username-status-icon')
    };

    let isSelectionInProgress = false;
    let debounceTimer;
    let selectedGroups = [];
    let licenseAvailability = {};
    let isUsernameAvailable = false;
    let multiUserSuccessData = [];
    let isSyncing = false;
    let currentUserSamAccountName = null;
    let isSaving = false;
    let hasInitializedSelects = false;

    // Função auxiliar para simular delay de rede
    const simulateDelay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

    // Lógica para senha
    function checkPasswordRequirements() {
        const password = ui.gerenciamento.passwordModal.input.value;
        const reqs = ui.gerenciamento.passwordModal.reqs;
        const isLengthValid = password.length >= 10;
        const hasLetter = /[a-zA-Z]/.test(password);
        const hasNumber = /\d/.test(password);
        const hasSpecial = /[^a-zA-Z0-9]/.test(password);
        reqs.length.classList.toggle('valid', isLengthValid);
        reqs.letter.classList.toggle('valid', hasLetter);
        reqs.number.classList.toggle('valid', hasNumber);
        reqs.special.classList.toggle('valid', hasSpecial);
        const isAllValid = isLengthValid && hasLetter && hasNumber && hasSpecial;
        ui.gerenciamento.passwordModal.confirmBtn.disabled = !isAllValid;
        return isAllValid;
    }

    function openPasswordModal() {
        ui.gerenciamento.passwordModal.input.value = '';
        checkPasswordRequirements();
        ui.gerenciamento.passwordModal.overlay.classList.remove('hidden');
        setTimeout(() => ui.gerenciamento.passwordModal.input.focus(), 50);
    }

    function closePasswordModal() {
        ui.gerenciamento.passwordModal.overlay.classList.add('hidden');
    }

    async function handleConfirmPassword() {
        if (!checkPasswordRequirements()) return;
        closePasswordModal();
        showPopup('Redefinindo senha (Simulação)...', 'loading');
        await simulateDelay(1500);
        showPopup(`Senha redefinida com sucesso! (Modo Demo)`, 'success', 5000);
    }

    //Select
    function updateCustomSelectsDisplay() {
        document.querySelectorAll('.custom-select-wrapper').forEach(wrapper => {
            const selectId = wrapper.dataset.selectId;
            const originalSelect = document.getElementById(selectId);
            const displayElement = wrapper.querySelector('.custom-select-display');
            if (originalSelect && displayElement && originalSelect.options.length > 0) {
                displayElement.textContent = originalSelect.options[originalSelect.selectedIndex].textContent;
            }
        });
    }

    function initializeCustomSelects() {
        if (hasInitializedSelects) return;
        hasInitializedSelects = true;
        document.querySelectorAll('.custom-select-wrapper').forEach(wrapper => {
            const selectId = wrapper.dataset.selectId;
            const originalSelect = document.getElementById(selectId);
            const displayElement = wrapper.querySelector('.custom-select-display');
            const optionsContainer = wrapper.querySelector('.custom-select-options');
            Array.from(originalSelect.options).forEach(option => {
                const optionElement = document.createElement('div');
                optionElement.className = 'option';
                optionElement.textContent = option.textContent;
                optionElement.dataset.value = option.value;
                optionElement.addEventListener('click', () => {
                    displayElement.textContent = option.textContent;
                    originalSelect.value = option.value;
                    wrapper.classList.remove('open');
                    optionsContainer.classList.add('hidden');
                });
                optionsContainer.appendChild(optionElement);
            });
            displayElement.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.custom-select-wrapper.open').forEach(openWrapper => {
                    if (openWrapper !== wrapper) {
                        openWrapper.classList.remove('open');
                        openWrapper.querySelector('.custom-select-options').classList.add('hidden');
                    }
                });
                const isOpen = wrapper.classList.toggle('open');
                optionsContainer.classList.toggle('hidden', !isOpen);
            });
        });
        document.addEventListener('click', () => {
            document.querySelectorAll('.custom-select-wrapper.open').forEach(wrapper => {
                wrapper.classList.remove('open');
                wrapper.querySelector('.custom-select-options').classList.add('hidden');
            });
        });
    }

    //Lógica menu - navegação
    function mostrarTela(nomeTela) {
        const container = document.querySelector('.container');
        if (nomeTela === 'gerenciamento') {
            container.classList.add('wide-container');
        } else {
            container.classList.remove('wide-container');
        }
        Object.values(ui.telas).forEach(tela => tela.classList.add('hidden'));
        if (ui.telas[nomeTela]) {
            ui.telas[nomeTela].classList.remove('hidden');
        }
        const subtitulos = {
            dadosUsuario: "Criação de Usuário Padrão",
            computadores: "Restrição de Acesso",
            licencas: "Atribuição de Licenças",
            grupos: "Associação de Grupos",
            sucesso: "Dados de Acesso",
            lote: "Criação Rápida",
            sucessoLote: "Resultado da Criação",
            gerenciamento: "Gerenciamento de Usuário"
        };
        ui.subtitulo.textContent = subtitulos[nomeTela] || "Ferramenta de Criação";
        ui.menu.menuPanel.classList.remove('visible');
    }

    function resetarFormularioPrincipal() {
        ui.form.reset();
        selectedGroups = [];
        renderSelectedGroups();
        Object.values(ui.status).forEach(s => { if(s) s.innerHTML = ''; });
        ui.charCounter.textContent = '';
        ui.charCounter.className = 'char-counter';
        ui.usernameStatusIcon.innerHTML = '';
        isUsernameAvailable = false;
        updateCustomSelectsDisplay();
        mostrarTela('dadosUsuario');
    }
    
    function resetarFormularioLote() {
        const nameFields = ui.lote.nameList.querySelectorAll('.dynamic-input-group');
        nameFields.forEach((field, index) => {
            if (index > 0) field.remove();
            else field.querySelector('input').value = '';
        });
        ui.lote.ouSearch.value = '';
        ui.lote.ouHidden.value = '';
        ui.lote.domainSelect.selectedIndex = 0;
        updateCustomSelectsDisplay();
        if(ui.status.lote) ui.status.lote.innerHTML = '';
        mostrarTela('lote');
    }

    // Funções de Gerenciamento
    function resetarTelaGerenciamento() {
        ui.gerenciamento.userSearch.value = '';
        ui.gerenciamento.detailsContainer.classList.add('hidden');
        ui.status.gerenciamento.innerHTML = '';
        currentUserSamAccountName = null;
        mostrarTela('gerenciamento');
    }
    
    const selecionarUsuarioParaGerenciar = (item) => {
        isSelectionInProgress = true;
        ui.gerenciamento.userSearch.value = item.SamAccountName;
        ui.sugestoes.userSearch.classList.add('hidden');
        buscarUsuarioMockado(item.SamAccountName);
        setTimeout(() => { isSelectionInProgress = false; }, 100);
    };

    async function buscarUsuarioMockado(samAccountName) {
        ui.gerenciamento.spinner.classList.remove('hidden');
        ui.status.gerenciamento.innerHTML = '';
        await simulateDelay(600); // Mock delay

        // Cria um usuário fictício na hora baseado no que foi digitado! Nunca trava.
        const nomeExibicao = samAccountName.replace(/\./g, ' ').replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase());
        
        const user = { 
            SamAccountName: samAccountName, 
            DisplayName: nomeExibicao || 'Usuário Teste', 
            Title: 'Cargo Simulado', 
            Department: 'Setor Simulado', 
            Description: 'CC-Demo', 
            ManagerName: 'Gestor Demo', 
            Enabled: true 
        };
        
        ui.gerenciamento.spinner.classList.add('hidden');
        renderizarDetalhesUsuario(user);
    }

    function renderizarDetalhesUsuario(user) {
        currentUserSamAccountName = user.SamAccountName;
        const displayNameElement = document.getElementById('manageDisplayName');
        const statusBadge = document.getElementById('userStatusBadge');
        displayNameElement.textContent = user.DisplayName;
        ui.gerenciamento.cargo.value = user.Title || '';
        ui.gerenciamento.setor.value = user.Department || '';
        ui.gerenciamento.centroCusto.value = user.Description || '';
        if (user.ManagerName) {
            ui.gerenciamento.gestorAtual.textContent = user.ManagerName;
        } else {
            ui.gerenciamento.gestorAtual.textContent = 'Nenhum gestor atribuído';
        }
        ui.gerenciamento.displayGestorContainer.classList.remove('hidden');
        ui.gerenciamento.searchGestorContainer.classList.add('hidden');
        ui.gerenciamento.gestorSearch.value = '';
        ui.gerenciamento.gestorHidden.value = '';
        
        ui.gerenciamento.btnAlternarStatus.onclick = async () => {
            showPopup('Alterando status...', 'loading');
            await simulateDelay(800);
            user.Enabled = !user.Enabled; 
            showPopup('Status alterado com sucesso! (Modo Demo)', 'success');
            renderizarDetalhesUsuario(user); 
        };

        if (user.Enabled) {
            statusBadge.textContent = 'Ativo';
            statusBadge.className = 'status-badge active';
            ui.gerenciamento.btnAlternarStatus.innerHTML = '<i class="fas fa-user-slash"></i> Desativar';
            ui.gerenciamento.btnAlternarStatus.className = 'button-secondary disable-style';
        } else {
            statusBadge.textContent = 'Inativo';
            statusBadge.className = 'status-badge inactive';
            ui.gerenciamento.btnAlternarStatus.innerHTML = '<i class="fas fa-user-check"></i> Ativar';
            ui.gerenciamento.btnAlternarStatus.className = 'button-secondary enable-style';
        }
        ui.gerenciamento.detailsContainer.classList.remove('hidden');
    }

    function redefinirSenha() {
        if (!currentUserSamAccountName) return;
        openPasswordModal();
    }

    async function salvarAlteracoes() {
        if (isSaving || !currentUserSamAccountName) return;
        isSaving = true;
        const saveButton = ui.gerenciamento.btnSalvar;
        const originalButtonHTML = saveButton.innerHTML;
        saveButton.innerHTML = `Salvando... <div class="spinner"></div>`;
        saveButton.disabled = true;
        
        await simulateDelay(1000); 
        
        showPopup('Alterações salvas com sucesso! (Modo Demo)', 'success');
        
        isSaving = false;
        saveButton.innerHTML = originalButtonHTML;
        saveButton.disabled = false;
    }

    function showPopup(message, type = 'loading', duration = 4000) {
        const popup = document.createElement('div');
        popup.className = `popup-notification ${type}`;
        popup.textContent = message;
        ui.popupContainer.appendChild(popup);
        setTimeout(() => {
            popup.classList.add('hiding');
            popup.addEventListener('transitionend', () => popup.remove());
        }, duration);
    }

    async function forcarSincronizacao() {
        if (isSyncing) {
            showPopup('Aguarde, uma sincronização já está em andamento.', 'loading');
            return;
        }
        isSyncing = true;
        ui.menu.menuPanel.classList.remove('visible');
        showPopup('Iniciando sincronização simulada...', 'loading', 3000);
        
        await simulateDelay(2500);
        
        showPopup('Sincronização com M365 concluída (Modo Demo).', 'success');
        isSyncing = false;
    }

    // Criação rápida em lote
    function addNameField() {
        const fieldCount = ui.lote.nameList.querySelectorAll('.dynamic-input-group').length;
        const newField = document.createElement('div');
        newField.className = 'dynamic-input-group';
        newField.innerHTML = `<input type="text" name="nomeCompletoMulti" class="multi-user-name-input" placeholder="Nome completo do usuário ${fieldCount + 1}"><button type="button" class="button-remove" aria-label="Remover campo de nome"><i class="fas fa-minus"></i></button>`;
        newField.querySelector('.button-remove').addEventListener('click', () => newField.remove());
        ui.lote.nameList.appendChild(newField);
    }

    async function criarMultiplosUsuarios() {
        const nameInputs = ui.lote.nameList.querySelectorAll('.multi-user-name-input');
        const nomes = Array.from(nameInputs).map(input => input.value.trim()).filter(name => name);
        const dominio = ui.lote.domainSelect.value;
        
        if (nomes.length === 0) {
            ui.status.lote.innerHTML = `<div class="status-box error">Adicione pelo menos um nome completo.</div>`;
            return;
        }
        
        ui.status.lote.innerHTML = '';
        const createButton = ui.lote.createBtn;
        const originalButtonHTML = createButton.innerHTML;
        createButton.innerHTML = `Criando (Demo)... <div class="spinner"></div>`;
        createButton.disabled = true;
        
        await simulateDelay(2000); 
        
        const resultadosMock = {
            usuariosCriados: nomes.map(n => ({
                NomeCompleto: n,
                Username: gerarSamAccountName(n) + '@' + dominio,
                InitialPassword: 'Demo@' + Math.floor(Math.random() * 10000)
            })),
            erros: []
        };
        
        renderMultiUserResults(resultadosMock);
        
        createButton.innerHTML = originalButtonHTML;
        createButton.disabled = false;
    }

    function renderMultiUserResults(result) {
        let tableHTML = `<table class="result-table"><thead><tr><th>Nome Completo</th><th>Usuário</th><th>Senha Inicial</th><th>Status</th></tr></thead><tbody>`;
        multiUserSuccessData = result.usuariosCriados || [];
        if (multiUserSuccessData.length > 0) {
            multiUserSuccessData.forEach(user => {
                tableHTML += `<tr><td>${user.NomeCompleto}</td><td>${user.Username}</td><td>${user.InitialPassword}</td><td class="result-status-success">Sucesso</td></tr>`;
            });
        }
        tableHTML += '</tbody></table>';
        ui.lote.successResults.innerHTML = tableHTML;
        mostrarTela('sucessoLote');
    }
    
    function copiarMultiplosDados() {
        if (multiUserSuccessData.length === 0) return;
        const textoParaCopiar = multiUserSuccessData.map(user => `Nome: ${user.NomeCompleto}\nUsuário: ${user.Username}\nSenha: ${user.InitialPassword}`).join('\n\n');
        navigator.clipboard.writeText(textoParaCopiar).then(() => {
            const btn = ui.lote.copyAllBtn;
            const originalText = btn.innerHTML;
            btn.innerHTML = 'Copiado! <i class="fas fa-check"></i>';
            btn.classList.add('copied');
            setTimeout(() => { btn.innerHTML = originalText; btn.classList.remove('copied'); }, 2000);
        });
    }

    //Formulário Principal
    function validarTelaDadosUsuario() {
        const erros = [];
        const nomeCompletoValue = ui.inputs.nomeCompleto.value.trim();
        
        if (!nomeCompletoValue) {
            erros.push('Nome Completo');
        } else if (nomeCompletoValue.split(' ').filter(n => n).length < 2) {
            erros.push('Nome Completo (informe pelo menos nome e sobrenome)');
        }
        
        if (!isUsernameAvailable) {
            erros.push('Nome de Usuário (já em uso ou inválido)');
        }
        
        if (!ui.inputs.cargo.value.trim()) erros.push('Cargo');
        if (!ui.inputs.setor.value.trim()) erros.push('Setor/Departamento');
        
        // Remoção da trava do Gestor e Centro de Custo!
        // if (!ui.inputs.gestorHidden.value) erros.push('Gestor');
        // if (!ui.inputs.ouSearch.value) erros.push('Centro de Custo');
        
        if (erros.length > 0) {
            ui.status.dadosUsuario.innerHTML = `<div class="status-box error">Corrija: ${erros.join(', ')}.</div>`;
            return false;
        }
        ui.status.dadosUsuario.innerHTML = '';
        return true;
    }
    
    function buscarComDebounce(callback) { clearTimeout(debounceTimer); debounceTimer = setTimeout(callback, 400); }

    function gerarSamAccountName(nomeCompleto) {
        if (!nomeCompleto) return null;
        const removerAcentos = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const palavrasIgnoradas = ['de', 'da', 'do', 'dos', 'das'];
        const partesNome = removerAcentos(nomeCompleto.toLowerCase().trim()).split(' ').filter(p => p && !palavrasIgnoradas.includes(p));
        if (partesNome.length < 2) return null;
        return `${partesNome[0]}.${partesNome[partesNome.length - 1]}`;
    }

    async function verificarNomeDeUsuario() {
        const nomeCompleto = ui.inputs.nomeCompleto.value;
        const iconContainer = ui.usernameStatusIcon;
        const samAccountName = gerarSamAccountName(nomeCompleto);
        if (!samAccountName) { iconContainer.innerHTML = ''; isUsernameAvailable = false; return; }
        iconContainer.innerHTML = '<div class="spinner-inline"></div>';
        
        await simulateDelay(600); 

        // Permite 100% dos nomes na Demo
        iconContainer.innerHTML = `<i class="fas fa-check-circle status-icon success" title="Usuário '${samAccountName}' disponível."></i>`;
        isUsernameAvailable = true;
    }

    // --- FUNÇÃO DE BUSCA MOCKADA TOTALMENTE PERMISSIVA ---
    // Agora ela SEMPRE retorna o que o usuário digitou, sem nunca dar "Nenhum resultado"
    async function buscarSugestoesMock(termo, listaSugestoes, spinner, callbackSelecao) {
        if (isSelectionInProgress || !termo || termo.trim().length === 0) { 
            listaSugestoes.classList.add('hidden'); 
            return; 
        }
        
        listaSugestoes.innerHTML = '<li class="no-results">Buscando...</li>';
        listaSugestoes.classList.remove('hidden');
        spinner.classList.remove('hidden');
        
        await simulateDelay(300); 

        // Retorna o que foi digitado como se fosse um resultado do banco de dados
        let results = [
            { 
                DisplayName: termo, 
                Name: termo,
                SamAccountName: termo.replace(/\s+/g, '.').toLowerCase(),
                DistinguishedName: `CN=${termo},OU=Demo,DC=exemplo,DC=com`
            }
        ];

        renderSugestoes(results, listaSugestoes, callbackSelecao);
        spinner.classList.add('hidden');
    }

    function renderSugestoes(results, listaSugestoes, callbackSelecao) {
        listaSugestoes.innerHTML = '';
        const resultsArray = Array.isArray(results) ? results : (results ? [results] : []);
        if (resultsArray.length === 0) {
            listaSugestoes.innerHTML = '<li class="no-results">Nenhum resultado de teste encontrado</li>';
            return;
        }
        resultsArray.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item.DisplayName || item.SamAccountName || item.Name;
            li.addEventListener('click', () => callbackSelecao(item));
            listaSugestoes.appendChild(li);
        });
    }

    function renderSelectedGroups() {
        ui.selectedGroupsList.innerHTML = '';
        if (selectedGroups.length === 0) { ui.selectedGroupsList.innerHTML = '<span class="placeholder-text">Nenhum grupo</span>'; }
        else {
            selectedGroups.forEach(groupName => {
                const groupElement = document.createElement('div');
                groupElement.className = 'selected-item';
                groupElement.textContent = groupName;
                const removeElement = document.createElement('i');
                removeElement.className = 'remove-item';
                removeElement.textContent = 'x';
                removeElement.onclick = () => { selectedGroups = selectedGroups.filter(g => g !== groupName); renderSelectedGroups(); };
                groupElement.appendChild(removeElement);
                ui.selectedGroupsList.appendChild(groupElement);
            });
        }
    }

    const selecionarGrupo = (item) => {
        if (!selectedGroups.includes(item.Name)) { selectedGroups.push(item.Name); renderSelectedGroups(); }
        ui.inputs.groupSearch.value = '';
        ui.sugestoes.grupo.classList.add('hidden');
    };

    const selecionarGestor = (item) => {
        isSelectionInProgress = true;
        ui.inputs.gestorSearch.value = item.DisplayName;
        ui.inputs.gestorHidden.value = item.DistinguishedName;
        ui.sugestoes.gestor.classList.add('hidden');
        setTimeout(() => { isSelectionInProgress = false; }, 100);
    };
    
    const selecionarGestorGerenciamento = (item) => {
        isSelectionInProgress = true;
        ui.gerenciamento.gestorSearch.value = item.DisplayName;
        ui.gerenciamento.gestorHidden.value = item.DistinguishedName;
        ui.sugestoes.manageGestor.classList.add('hidden');
        setTimeout(() => { isSelectionInProgress = false; }, 100);
    };

    const selecionarOU = (item) => {
        isSelectionInProgress = true;
        ui.inputs.ouSearch.value = item.Name;
        ui.inputs.ouHidden.value = item.DistinguishedName;
        ui.sugestoes.ou.classList.add('hidden');
        setTimeout(() => { isSelectionInProgress = false; }, 100);
    };

    const selecionarMultiOU = (item) => {
        isSelectionInProgress = true;
        ui.lote.ouSearch.value = item.Name;
        ui.lote.ouHidden.value = item.DistinguishedName;
        ui.sugestoes.loteOU.classList.add('hidden');
        setTimeout(() => { isSelectionInProgress = false; }, 100);
    };

    const selecionarNotebook = (item) => {
        isSelectionInProgress = true;
        ui.inputs.logonWorkstationsSearch.value = item.Name;
        ui.inputs.logonWorkstationsHidden.value = item.Name;
        ui.sugestoes.logonWorkstations.classList.add('hidden');
        setTimeout(() => { isSelectionInProgress = false; }, 100);
    };

    async function fetchLicenses() {
        mostrarTela('licencas');
        ui.status.licencas.innerHTML = '';
        ui.botoes.proximoGrupos.disabled = true;
        ['e3', 'standard', 'basic'].forEach(l => ui.contadoresLicenca[l].textContent = 'Buscando...');
        
        await simulateDelay(1000);

        licenseAvailability = {
            E3: Math.floor(Math.random() * 50) + 1,
            Standard: Math.floor(Math.random() * 20),
            Basic: Math.floor(Math.random() * 100)
        };

        ui.contadoresLicenca.e3.textContent = `${licenseAvailability.E3} disponíveis`;
        ui.contadoresLicenca.standard.textContent = `${licenseAvailability.Standard} disponíveis`;
        ui.contadoresLicenca.basic.textContent = `${licenseAvailability.Basic} disponíveis`;
        
        ui.botoes.proximoGrupos.disabled = false;
    }

    async function criarUsuario() {
        if (!validarTelaDadosUsuario()) { return; }
        const createButton = ui.botoes.criarUsuario;
        const originalButtonHTML = createButton.innerHTML;
        createButton.innerHTML = `Criando (Demo)... <div class="spinner"></div>`;
        createButton.disabled = true;
        
        const dominio = ui.inputs.domainSelect.value;
        const samAccountName = gerarSamAccountName(ui.inputs.nomeCompleto.value);

        await simulateDelay(2500); 
        
        ui.dadosSucesso.email.textContent = `${samAccountName}@${dominio}`;
        ui.dadosSucesso.usuario.textContent = `${dominio.split('.')[0]}\\${samAccountName}`;
        ui.dadosSucesso.senha.textContent = 'Demo@' + Math.floor(Math.random() * 10000) + 'Az';

        const licencaSelecionada = ui.form.querySelector('input[name="licenca"]:checked').value;
        if (licencaSelecionada !== 'None') {
            ui.dadosSucesso.details.textContent = 'Licenciamento iniciado em segundo plano (Simulado). Seguem os dados de acesso:';
        } else {
            ui.dadosSucesso.details.textContent = 'Usuário criado (Simulado). Seguem os dados de acesso:';
        }

        resetarFormularioPrincipal();
        mostrarTela('sucesso');
        
        createButton.innerHTML = originalButtonHTML;
        createButton.disabled = false;
    }

    function copiarDados() {
        const texto = `E-mail: ${ui.dadosSucesso.email.textContent}\nUsuário: ${ui.dadosSucesso.usuario.textContent}\nSenha Inicial: ${ui.dadosSucesso.senha.textContent}`;
        navigator.clipboard.writeText(texto).then(() => {
            const btn = ui.botoes.copiarDados;
            const originalText = btn.innerHTML;
            btn.innerHTML = 'Copiado! <i class="fas fa-check"></i>';
            btn.classList.add('copied');
            setTimeout(() => { btn.innerHTML = originalText; btn.classList.remove('copied'); }, 2000);
        });
    }
    
    // Eventos de Menu
    ui.menu.openBtn.addEventListener('click', () => ui.menu.menuPanel.classList.add('visible'));
    ui.menu.closeBtn.addEventListener('click', () => ui.menu.menuPanel.classList.remove('visible'));
    ui.menu.padraoBtn.addEventListener('click', (e) => { e.preventDefault(); resetarFormularioPrincipal(); });
    ui.menu.loteBtn.addEventListener('click', (e) => { e.preventDefault(); resetarFormularioLote(); });
    ui.menu.gerenciarBtn.addEventListener('click', (e) => { e.preventDefault(); resetarTelaGerenciamento(); });
    ui.menu.syncBtn.addEventListener('click', (e) => { e.preventDefault(); forcarSincronizacao(); });

    // Eventos Lote
    ui.lote.addNameBtn.addEventListener('click', addNameField);
    ui.lote.createBtn.addEventListener('click', criarMultiplosUsuarios);
    ui.lote.copyAllBtn.addEventListener('click', copiarMultiplosDados);
    ui.lote.createNewBtn.addEventListener('click', resetarFormularioLote);
    ui.lote.ouSearch.addEventListener('input', () => buscarComDebounce(() => buscarSugestoesMock(ui.lote.ouSearch.value, ui.sugestoes.loteOU, ui.spinners.loteOU, selecionarMultiOU)));
    
    // Eventos Formulário
    ui.inputs.nomeCompleto.addEventListener('input', () => {
        buscarComDebounce(verificarNomeDeUsuario);
        const remaining = 50 - ui.inputs.nomeCompleto.value.length;
        ui.charCounter.textContent = `${remaining} restantes`;
        ui.charCounter.className = `char-counter ${remaining <= 0 ? 'error' : remaining <= 20 ? 'warning' : ''}`;
    });
    
    // TODAS as buscas agora usam o Mock Permissivo
    ui.inputs.gestorSearch.addEventListener('input', () => buscarComDebounce(() => buscarSugestoesMock(ui.inputs.gestorSearch.value, ui.sugestoes.gestor, ui.spinners.gestor, selecionarGestor)));
    ui.inputs.ouSearch.addEventListener('input', () => buscarComDebounce(() => buscarSugestoesMock(ui.inputs.ouSearch.value, ui.sugestoes.ou, ui.spinners.ou, selecionarOU)));
    ui.inputs.groupSearch.addEventListener('input', () => buscarComDebounce(() => buscarSugestoesMock(ui.inputs.groupSearch.value, ui.sugestoes.grupo, ui.spinners.grupo, selecionarGrupo)));
    ui.inputs.logonWorkstationsSearch.addEventListener('input', () => buscarComDebounce(() => buscarSugestoesMock(ui.inputs.logonWorkstationsSearch.value, ui.sugestoes.logonWorkstations, ui.spinners.logonWorkstations, selecionarNotebook)));
    
    // Gerenciamento de Usuário
    ui.gerenciamento.userSearch.addEventListener('input', () => {
        if (isSelectionInProgress) return;
        buscarComDebounce(() => buscarSugestoesMock(ui.gerenciamento.userSearch.value, ui.sugestoes.userSearch, ui.gerenciamento.spinner, selecionarUsuarioParaGerenciar));
    });
    ui.gerenciamento.gestorSearch.addEventListener('input', () => buscarComDebounce(() => buscarSugestoesMock(ui.gerenciamento.gestorSearch.value, ui.sugestoes.manageGestor, ui.spinners.manageGestor, selecionarGestorGerenciamento)));
    ui.gerenciamento.btnSalvar.addEventListener('click', salvarAlteracoes);
    ui.gerenciamento.btnRedefinirSenha.addEventListener('click', redefinirSenha);
    
    ui.gerenciamento.btnEditarGestor.addEventListener('click', () => {
        ui.gerenciamento.displayGestorContainer.classList.add('hidden');
        ui.gerenciamento.searchGestorContainer.classList.remove('hidden');
        ui.gerenciamento.gestorSearch.focus();
    });

    // Senha
    ui.gerenciamento.passwordModal.input.addEventListener('input', checkPasswordRequirements);
    ui.gerenciamento.passwordModal.confirmBtn.addEventListener('click', handleConfirmPassword);
    ui.gerenciamento.passwordModal.cancelBtn.addEventListener('click', closePasswordModal);
    ui.gerenciamento.passwordModal.overlay.addEventListener('click', (e) => {
        if (e.target === ui.gerenciamento.passwordModal.overlay) {
            closePasswordModal();
        }
    });
    ui.gerenciamento.passwordModal.toggleVisibilityBtn.addEventListener('click', () => {
        const input = ui.gerenciamento.passwordModal.input;
        const icon = ui.gerenciamento.passwordModal.toggleVisibilityBtn.querySelector('i');
        
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    });
    
    // Botões de Navegação
    ui.botoes.proximoComputadores.addEventListener('click', () => { if (validarTelaDadosUsuario()) mostrarTela('computadores'); });
    ui.botoes.voltarDados.addEventListener('click', () => mostrarTela('dadosUsuario'));
    ui.botoes.proximoLicencas.addEventListener('click', fetchLicenses);
    ui.botoes.voltarComputadores.addEventListener('click', () => mostrarTela('computadores'));
    ui.botoes.proximoGrupos.addEventListener('click', () => {
        const licencaSelecionada = ui.form.querySelector('input[name="licenca"]:checked');
        if (!licencaSelecionada) {
            ui.status.licencas.innerHTML = `<div class="status-box error">Selecione uma opção de licença.</div>`;
            return;
        }
        mostrarTela('grupos');
    });
    ui.botoes.voltarLicencas.addEventListener('click', () => mostrarTela('licencas'));
    ui.botoes.criarUsuario.addEventListener('click', criarUsuario);
    ui.botoes.criarNovo.addEventListener('click', resetarFormularioPrincipal);
    ui.botoes.copiarDados.addEventListener('click', copiarDados);
    
    ui.licencaCards.forEach(card => card.addEventListener('click', () => { const radio = card.querySelector('input[type="radio"]'); if (radio) radio.checked = true; }));

    initializeCustomSelects(); 
    updateCustomSelectsDisplay();
    renderSelectedGroups();
    mostrarTela('dadosUsuario');
});