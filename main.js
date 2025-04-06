const { app, BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage, protocol } = require('electron');
const path = require('path');
const schedule = require('node-schedule');
const fs = require('fs');
const HydrationTracker = require('./hydration-tracker');
let Store;
let store = null;

(async () => {
  try {
    const { default: ElectronStore } = await import('electron-store');
    Store = ElectronStore;
    
    // Inicializar o store após o import assíncrono
    store = new Store();
    
    // Verificar se devemos inicializar o app
    if (app.isReady()) {
      initApp();
    }
  } catch (error) {
    console.error('Erro ao carregar electron-store:', error);
  }
})();

let mainWindow = null;
let reminderWindow = null;
let hydrationDialogWindow = null;
let hydrationReportWindow = null;
let appTray = null;
let currentJob = null;
let remainingTimeSeconds = 0;
let countdownInterval = null;
let shouldShowReminder = false;
let hydrationTracker = null;

// Controle de debug
const DEBUG = true;

function log(...args) {
  if (DEBUG) {
    console.log('[AGUA]', ...args);
  }
}

// Função para obter a data atual formatada como YYYY-MM-DD
function getFormattedDate(date = new Date()) {
  return date.toISOString().split('T')[0];
}

// Função para obter o nome do dia da semana em português
function getDayOfWeek(date = new Date()) {
  const diasDaSemana = [
    'Domingo', 'Segunda-feira', 'Terça-feira', 
    'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'
  ];
  return diasDaSemana[date.getDay()];
}

// Função para formatar a data para display (DD/MM/YYYY)
function formatDateForDisplay(dateStr) {
  const parts = dateStr.split('-');
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatRemainingTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

function updateTrayText() {
  if (appTray) {
    appTray.setTitle(`🚰 ${formatRemainingTime(remainingTimeSeconds)}`);
  }
}

function createTray() {
  // Usar o novo ícone de copo
  const iconPath = path.join(__dirname, 'assets', 'cup-icon.svg');
  const icon = nativeImage.createFromPath(iconPath);
  
  // Se o SVG não funcionar, tentar o ícone padrão como fallback
  let trayIcon;
  if (icon.isEmpty()) {
    const fallbackIconPath = path.join(__dirname, 'assets', 'icon-16.png');
    trayIcon = nativeImage.createFromPath(fallbackIconPath);
    
    // Se ambos falharem, criar um ícone vazio
    if (trayIcon.isEmpty()) {
      trayIcon = nativeImage.createEmpty();
    }
  } else {
    trayIcon = icon;
  }
  
  appTray = new Tray(trayIcon);
  appTray.setToolTip('Hidrate-se - Lembrete para beber água');
  
  // Inicialmente sem tempo definido
  updateTray(remainingTimeSeconds);
  
  // Começa a contagem regressiva somente se a configuração inicial estiver concluída
  if (isInitialConfigCompleted()) {
    resetCountdown();
    scheduleReminder();
  }
}

// Atualizar o ícone da bandeja com o tempo restante
function updateTray(remainingTime) {
  if (appTray) {
    let nextReminderTime = null;
    if (remainingTime > 0) {
      // Calcular o horário do próximo lembrete
      nextReminderTime = new Date();
      nextReminderTime.setSeconds(nextReminderTime.getSeconds() + remainingTime);
    }
    
    // Atualizar menu com informações atualizadas
    appTray.setContextMenu(buildTrayMenu(nextReminderTime));
    
    // Atualizar o texto do ícone na bandeja
    if (remainingTime > 0) {
      const minutes = Math.floor(remainingTime / 60);
      const seconds = remainingTime % 60;
      appTray.setTitle(`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);
    } else {
      appTray.setTitle('');
    }
  }
}

// Reiniciar o contador do zero
function resetCountdown() {
  log('Reiniciando contagem regressiva...');
  const intervalMinutes = store.get('intervalMinutes', 60);
  remainingTimeSeconds = intervalMinutes * 60;
  
  updateTray(remainingTimeSeconds);
  startCountdown();
}

function startCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
  
  // Atualizar a cada segundo
  countdownInterval = setInterval(() => {
    if (remainingTimeSeconds > 0) {
      remainingTimeSeconds--;
      updateTray(remainingTimeSeconds);
      
      // Se o contador chegar a zero, mostra o lembrete
      if (remainingTimeSeconds === 0) {
        log('Contador chegou a zero. Mostrando lembrete...');
        shouldShowReminder = true;
        createOrFocusReminderWindow();
      }
    }
  }, 1000);
}

// Gerenciamento de hidratação usando o HydrationTracker

// Obter as configurações de hidratação
function getHydrationSettings() {
  if (!hydrationTracker) return { metaDiaria: 4000, opcoesPadrao: [200, 300, 500] };
  
  return {
    metaDiaria: hydrationTracker.obterMetaDiaria(),
    opcoesPadrao: hydrationTracker.obterOpcoesPadrao()
  };
}

// Salvar as configurações de hidratação
function saveHydrationSettings(settings) {
  if (!hydrationTracker) return false;
  
  hydrationTracker.definirMetaDiaria(settings.metaDiaria);
  
  // As opções padrão são armazenadas com um nome de propriedade diferente no tracker
  hydrationTracker.store.set('configuracoes.opcoesPadraoML', settings.opcoesPadrao);
  
  return true;
}

// Adicionar um registro de hidratação
function addHydrationRecord(quantidade) {
  if (!hydrationTracker) return { total: 0, metaDiaria: 4000, progresso: 0 };
  
  const resultado = hydrationTracker.registrarConsumo(quantidade);
  log(`Hidratação registrada: ${quantidade}ml (Total do dia: ${resultado.totalHoje}ml)`);
  
  return {
    quantidade,
    total: resultado.totalHoje,
    metaDiaria: resultado.metaDiaria,
    progresso: resultado.progresso
  };
}

// Obter os dados de hidratação para hoje
function getTodayHydration() {
  if (!hydrationTracker) return {
    data: getFormattedDate(),
    dataFormatada: formatDateForDisplay(getFormattedDate()),
    total: 0,
    metaDiaria: 4000,
    opcoesPadrao: [200, 300, 500],
    progresso: 0,
    registros: []
  };
  
  const dados = hydrationTracker.obterProgressoHoje();
  return {
    data: dados.data,
    dataFormatada: dados.dataFormatada,
    total: dados.consumoTotal,
    metaDiaria: dados.metaDiaria,
    opcoesPadrao: hydrationTracker.obterOpcoesPadrao(),
    progresso: dados.progresso,
    registros: dados.registros
  };
}

// Gerar relatório de hidratação
function generateHydrationReport(dias = 7) {
  if (!hydrationTracker) {
    // Se o tracker não estiver disponível, retorna um relatório vazio
    return {
      periodo: {
        inicio: formatDateForDisplay(getFormattedDate(new Date(Date.now() - (dias-1) * 86400000))),
        fim: formatDateForDisplay(getFormattedDate())
      },
      metaDiaria: 4000,
      consumoTotal: 0,
      mediaDiaria: 0,
      cumprimentoMedio: 0,
      dias: []
    };
  }
  
  return hydrationTracker.gerarRelatorio(dias);
}

function createWindow() {
  // Se a janela já existir, apenas mostre-a e retorne
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: true, // Mostrar imediatamente
    title: "Hidrate-se - Configurações"
  });

  mainWindow.loadFile('index.html');
  
  log('Janela principal criada');
  
  // Abrir DevTools em ambiente de desenvolvimento
  if (DEBUG) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
  
  // Em vez de fechar a janela, apenas esconda-a
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });
  
  // Quando a janela é fechada de fato
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createReminderWindow() {
  // Se já existir uma janela de lembrete, apenas a mostre e retorne
  if (reminderWindow) {
    reminderWindow.show();
    reminderWindow.focus();
    return;
  }
  
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  reminderWindow = new BrowserWindow({
    width: width,
    height: height,
    frame: false,
    fullscreen: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: "Hidrate-se - Hora de beber água!"
  });
  
  reminderWindow.loadFile('reminder.html');
  
  log('Janela de lembrete criada');
  
  if (DEBUG) {
    reminderWindow.webContents.openDevTools({ mode: 'detach' });
  }
  
  reminderWindow.on('closed', () => {
    reminderWindow = null;
  });
}

// Criar janela de diálogo de hidratação
function createHydrationDialog() {
  if (hydrationDialogWindow) {
    hydrationDialogWindow.show();
    hydrationDialogWindow.focus();
    return;
  }
  
  hydrationDialogWindow = new BrowserWindow({
    width: 500,
    height: 600,
    resizable: true,
    title: 'Hidrate-se - Registrar Consumo',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  
  hydrationDialogWindow.loadFile('hydration-dialog.html');
  
  log('Janela de registro de hidratação criada');
  
  if (DEBUG) {
    hydrationDialogWindow.webContents.openDevTools({ mode: 'detach' });
  }
  
  hydrationDialogWindow.on('closed', () => {
    hydrationDialogWindow = null;
  });
}

// Criar janela de relatório de hidratação
function createHydrationReport() {
  if (hydrationReportWindow) {
    hydrationReportWindow.show();
    hydrationReportWindow.focus();
    return;
  }
  
  hydrationReportWindow = new BrowserWindow({
    width: 800,
    height: 700,
    resizable: true,
    title: 'Hidrate-se - Relatório',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  
  hydrationReportWindow.loadFile('hydration-report.html');
  
  log('Janela de relatório de hidratação criada');
  
  if (DEBUG) {
    hydrationReportWindow.webContents.openDevTools({ mode: 'detach' });
  }
  
  hydrationReportWindow.on('closed', () => {
    hydrationReportWindow = null;
  });
}

function cancelCurrentJob() {
  if (currentJob) {
    currentJob.cancel();
    currentJob = null;
  }
}

function scheduleReminder() {
  // Cancelar o trabalho atual se houver
  cancelCurrentJob();
  
  // Buscar intervalo de minutos da configuração
  const intervalMinutes = store.get('intervalMinutes', 60);
  log(`Agendando lembrete para cada ${intervalMinutes} minutos.`);
  
  if (DEBUG) {
    log('Criando reminder window para teste...');
  } else {
    // Agendar o próximo lembrete usando o formato de expressão cron
    currentJob = schedule.scheduleJob(`*/${intervalMinutes} * * * *`, () => {
      log(`Execução agendada: ${new Date().toLocaleTimeString()}`);
      shouldShowReminder = true;
      createOrFocusReminderWindow();
    });
  }
}

function initApp() {
  log('Inicializando app...');
  
  // Inicializar o rastreador de hidratação
  try {
    hydrationTracker = new HydrationTracker();
    log('HydrationTracker inicializado com sucesso');
  } catch (error) {
    console.error('Erro ao inicializar HydrationTracker:', error);
    
    // Tentar novamente após um curto delay (dar tempo para importações dinâmicas)
    setTimeout(() => {
      try {
        if (!hydrationTracker) {
          hydrationTracker = new HydrationTracker();
          log('HydrationTracker inicializado com sucesso após retry');
        }
      } catch (retryError) {
        console.error('Erro ao inicializar HydrationTracker (retry):', retryError);
      }
    }, 1000);
  }
  
  createTray();
  
  // Verificar configuração inicial
  if (!isInitialConfigCompleted()) {
    log('Configuração inicial não concluída. Mostrando janela de configuração.');
    createWindow();
  }
  
  // Eventos IPC entre renderer e main processes
  
  // Evento quando detecção de água é confirmada
  ipcMain.on('close-reminder', () => {
    log('Evento close-reminder recebido, fechando janela de lembrete...');
    
    if (reminderWindow) {
      reminderWindow.close();
      reminderWindow = null;
    }
    
    // Reiniciar a contagem após beber água
    resetCountdown();
    
    // Mostrar diálogo para registrar hidratação
    createHydrationDialog();
  });
  
  // Registrar consumo de água
  ipcMain.on('register-hydration', (event, quantidade) => {
    const resultado = addHydrationRecord(quantidade);
    
    // Enviar confirmação com total atualizado
    event.reply('hydration-updated', resultado);
  });
  
  // Obter dados de hidratação do dia atual
  ipcMain.on('get-today-hydration', (event) => {
    const dados = getTodayHydration();
    event.reply('today-hydration', dados);
  });
  
  // Obter relatório de hidratação
  ipcMain.on('get-hydration-report', (event, dias) => {
    const relatorio = generateHydrationReport(dias);
    event.reply('hydration-report', relatorio);
  });
  
  // Obter configurações de hidratação
  ipcMain.on('get-hydration-settings', (event) => {
    event.reply('hydration-settings', getHydrationSettings());
  });
  
  // Salvar configurações de hidratação
  ipcMain.on('save-hydration-settings', (event, settings) => {
    const resultado = saveHydrationSettings(settings);
    event.reply('hydration-settings-saved', resultado);
  });
  
  // Atualizar o intervalo de lembretes
  ipcMain.on('update-interval', (event, minutes) => {
    log(`Atualizando intervalo para ${minutes} minutos`);
    
    // Validação básica
    if (typeof minutes !== 'number' || minutes < 15 || minutes > 180) {
      log('Intervalo inválido. Deve estar entre 15 e 180 minutos.');
      event.reply('interval-updated', { success: false, error: 'Intervalo inválido' });
      return;
    }
    
    // Salvar o novo intervalo
    store.set('intervalMinutes', minutes);
    
    // Atualizar o agendamento e reiniciar o contador
    scheduleReminder();
    resetCountdown();
    
    event.reply('interval-updated', { success: true });
  });
  
  // Mostrar configurações
  ipcMain.on('show-settings', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });
  
  // Mostrar diálogo de hidratação
  ipcMain.on('show-hydration-dialog', () => {
    createHydrationDialog();
  });
  
  // Mostrar relatório de hidratação
  ipcMain.on('show-hydration-report', () => {
    createHydrationReport();
  });
  
  // Ouvir evento para forçar um lembrete (teste)
  ipcMain.on('force-reminder', () => {
    log('Evento force-reminder recebido, mostrando lembrete de teste...');
    shouldShowReminder = true;
    createOrFocusReminderWindow();
  });
  
  // Obter intervalo atual
  ipcMain.on('get-current-interval', (event) => {
    const intervalMinutes = store.get('intervalMinutes', 60);
    log(`Enviando intervalo atual (${intervalMinutes} minutos) para a janela de configuração`);
    
    if (mainWindow) {
      mainWindow.webContents.send('current-interval', intervalMinutes);
    }
  });
}

// Verificar se a configuração inicial está concluída
function isInitialConfigCompleted() {
  return store && store.has('intervalMinutes');
}

// Função para definir o conteúdo do menu do tray
function buildTrayMenu(nextReminderTime) {
  // Garantir que store existe antes de usar
  const intervalMinutes = store ? store.get('intervalMinutes', 60) : 60;
  const timeFormatStr = nextReminderTime ? nextReminderTime.toLocaleTimeString() : '(não definido)';
  
  return Menu.buildFromTemplate([
    { 
      label: `Próximo lembrete: ${timeFormatStr}`, 
      enabled: false 
    },
    { 
      label: `Intervalo atual: ${intervalMinutes} minutos`, 
      enabled: false 
    },
    { type: 'separator' },
    { 
      label: 'Configurações', 
      click: () => {
        // Mostrar a janela de configuração
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      } 
    },
    { 
      label: 'Registrar consumo de água', 
      click: () => {
        createHydrationDialog();
      } 
    },
    { 
      label: 'Ver relatório de hidratação', 
      click: () => {
        createHydrationReport();
      } 
    },
    { 
      label: 'Beber água agora', 
      click: () => {
        shouldShowReminder = true;
        createOrFocusReminderWindow();
      } 
    },
    { type: 'separator' },
    { 
      label: 'Sair', 
      click: () => { 
        app.quit(); 
      } 
    }
  ]);
}

// Criar ou focar na janela de lembrete
function createOrFocusReminderWindow() {
  if (reminderWindow) {
    reminderWindow.focus();
    return;
  }
  
  log('Criando janela de lembrete...');
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  reminderWindow = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
    fullscreen: true,
    center: true,
    resizable: false,
    maximizable: false,
    title: 'Hidrate-se - Hora de Beber Água!',
    backgroundColor: '#001e40',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  
  reminderWindow.loadFile('reminder.html');
  
  // Abrir DevTools em modo de desenvolvimento
  if (DEBUG) {
    reminderWindow.webContents.openDevTools({mode: 'detach'});
  }
  
  reminderWindow.on('closed', () => {
    reminderWindow = null;
  });
}

// Eventos do ciclo de vida da aplicação
app.on('ready', () => {
  initApp();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});
