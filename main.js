const { app, BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage, protocol } = require('electron');
const path = require('path');
const schedule = require('node-schedule');
const fs = require('fs').promises;
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
let lastHydrationTime = 0; // Adiciona um controle de timestamp para evitar duplicações

// Controle de debug
const DEBUG = false;

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
  console.log('Criando tray...');
  
  if (appTray) {
    console.log('Tray já existe. Retornando...');
    return;
  }
  
  // Usar o ícone de copo
  const iconPath = path.join(__dirname, 'assets', 'cup-icon.svg');
  const icon = nativeImage.createFromPath(iconPath);
  
  // Se o SVG não funcionar, tentar o ícone padrão como fallback
  let trayIcon;
  if (icon.isEmpty()) {
    const fallbackIconPath = path.join(__dirname, 'assets', 'icon-16.png');
    trayIcon = nativeImage.createFromPath(fallbackIconPath);
    
    if (trayIcon.isEmpty()) {
      trayIcon = nativeImage.createEmpty();
    }
  } else {
    trayIcon = icon;
  }
  
  appTray = new Tray(trayIcon);
  appTray.setToolTip('Hidrate-se - Lembrete para beber água');
  
  // Definir menu inicial
  const menu = buildTrayMenu(null);
  appTray.setContextMenu(menu);
  
  console.log('Tray criado com sucesso');
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
  
  // Verificar se já houve um registro recente (menos de 500ms) para evitar duplicações
  const agora = Date.now();
  if (agora - lastHydrationTime < 500) {
    log(`Ignorando registro duplicado (${quantidade}ml) - muito próximo do anterior`);
    
    // Retornar os dados mais recentes sem registrar novamente
    const dadosAtuais = hydrationTracker.obterProgressoHoje();
    return {
      quantidade,
      total: dadosAtuais.consumoTotal,
      metaDiaria: dadosAtuais.metaDiaria,
      progresso: dadosAtuais.progresso
    };
  }
  
  // Atualizar o timestamp do último registro
  lastHydrationTime = agora;
  
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
  
  // Reativar DevTools APENAS para esta janela
  reminderWindow.webContents.openDevTools({ mode: 'detach' });
  
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

// Função para verificar se a configuração inicial está concluída
function isInitialConfigCompleted() {
  return store && store.has('intervalMinutes');
}

// Função para inicializar o contador e o tray
function initializeCounterAndTray() {
  console.log('Inicializando contador e tray...');
  
  // Criar tray se ainda não existir
  if (!appTray) {
    createTray();
  }
  
  // Iniciar contador
  const intervalMinutes = store.get('intervalMinutes', 60);
  remainingTimeSeconds = intervalMinutes * 60;
  
  // Atualizar tray e iniciar contagem
  updateTray(remainingTimeSeconds);
  startCountdown();
  
  console.log(`Contador iniciado com ${intervalMinutes} minutos`);
}

// Atualizar a função initApp
async function initApp() {
  console.log('Inicializando app...');
  
  // Garantir que o store está inicializado
  if (!store) {
    console.log('Store não inicializado. Aguardando...');
    return;
  }
  
  // Inicializar o rastreador de hidratação
  try {
    hydrationTracker = new HydrationTracker();
    console.log('HydrationTracker inicializado com sucesso');
  } catch (error) {
    console.error('Erro ao inicializar HydrationTracker:', error);
  }
  
  // Criar o tray imediatamente
  createTray();
  
  // Verificar configuração inicial
  if (!isInitialConfigCompleted()) {
    console.log('Configuração inicial não concluída. Mostrando janela de configuração.');
    createWindow();
  } else {
    console.log('Configuração já concluída. Iniciando contador.');
    const intervalMinutes = store.get('intervalMinutes', 60);
    remainingTimeSeconds = intervalMinutes * 60;
    updateTray(remainingTimeSeconds);
    startCountdown();
  }
  
  // Configurar handlers IPC
  setupIPCHandlers();
  
  // Carregar dados de hidratação
  await loadHydrationData();
}

// Separar os handlers IPC em uma função própria
function setupIPCHandlers() {
  // Atualizar o intervalo de lembretes
  ipcMain.on('update-interval', (event, minutes) => {
    console.log(`Atualizando intervalo para ${minutes} minutos`);
    
    // Validação básica
    if (typeof minutes !== 'number' || minutes < 15 || minutes > 180) {
      console.log('Intervalo inválido. Deve estar entre 15 e 180 minutos.');
      event.reply('interval-updated', { success: false, error: 'Intervalo inválido' });
      return;
    }
    
    // Salvar o novo intervalo
    store.set('intervalMinutes', minutes);
    
    // Inicializar contador e tray se ainda não existirem
    initializeCounterAndTray();
    
    event.reply('interval-updated', { success: true });
  });
  
  // Evento quando detecção de água é confirmada
  ipcMain.on('close-reminder', () => {
    log('Evento close-reminder recebido, fechando janela de lembrete...');
    
    // Apenas processar se a janela de lembrete existir
    if (reminderWindow) {
      reminderWindow.close();
      reminderWindow = null;
      
      // Reiniciar a contagem após beber água
      resetCountdown();
      
      // Mostrar diálogo para registrar hidratação
      createHydrationDialog();
    }
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

  // Fechar diálogo de hidratação
  ipcMain.on('close-hydration-dialog', () => {
    console.log('Fechando diálogo de hidratação');
    if (hydrationDialogWindow && !hydrationDialogWindow.isDestroyed()) {
      hydrationDialogWindow.close();
    }
  });
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
  
  reminderWindow.on('closed', () => {
    reminderWindow = null;
  });
}

// Eventos do ciclo de vida da aplicação
app.whenReady().then(async () => {
  console.log('App está pronto. Iniciando...');
  
  // Garantir que o store está inicializado antes de continuar
  if (!store) {
    console.log('Aguardando inicialização do store...');
    const storeInterval = setInterval(() => {
      if (store) {
        clearInterval(storeInterval);
        initApp();
      }
    }, 100);
  } else {
    initApp();
  }
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

// Armazenamento de dados de hidratação
let hydrationStore = {
  records: [],
  lastAmount: 0,
  lastTime: 0,
  totalConsumed: 0
};

// Carregar dados de hidratação do arquivo
async function loadHydrationData() {
  try {
    console.log('Tentando carregar dados de hidratação...');
    const data = await fs.readFile(path.join(app.getPath('userData'), 'hydration.json'), 'utf8');
    const parsed = JSON.parse(data);
    hydrationStore = {
      records: parsed.records || [],
      lastAmount: parsed.lastAmount || 0,
      lastTime: parsed.lastTime || 0,
      totalConsumed: parsed.totalConsumed || 0
    };
    console.log('Dados de hidratação carregados:', hydrationStore);
  } catch (error) {
    console.log('Nenhum dado de hidratação encontrado, iniciando novo armazenamento');
  }
}

// Salvar dados de hidratação no arquivo
async function saveHydrationData() {
  try {
    console.log('Salvando dados de hidratação...');
    await fs.writeFile(
      path.join(app.getPath('userData'), 'hydration.json'),
      JSON.stringify(hydrationStore, null, 2)
    );
    console.log('Dados de hidratação salvos com sucesso');
  } catch (error) {
    console.error('Erro ao salvar dados de hidratação:', error);
  }
}

// Inicializar dados de hidratação
loadHydrationData();

// Handlers para hidratação
ipcMain.handle('add-hydration-record', async (event, { amount, timestamp }) => {
  console.log('Recebido pedido para adicionar registro:', { amount, timestamp });
  try {
    const record = {
      amount,
      timestamp,
      id: Date.now().toString()
    };
    
    hydrationStore.records.push(record);
    hydrationStore.lastAmount = amount;
    hydrationStore.lastTime = Date.now();
    hydrationStore.totalConsumed += amount;
    
    await saveHydrationData();
    console.log('Registro adicionado com sucesso');
    
    return {
      success: true,
      totalConsumed: hydrationStore.totalConsumed
    };
  } catch (error) {
    console.error('Erro ao adicionar registro de hidratação:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-last-hydration', async (event, { oldAmount, newAmount, timestamp }) => {
  console.log('Recebido pedido para atualizar registro:', { oldAmount, newAmount, timestamp });
  try {
    const lastRecord = hydrationStore.records[hydrationStore.records.length - 1];
    if (!lastRecord) {
      throw new Error('Nenhum registro encontrado para atualizar');
    }
    
    lastRecord.amount = newAmount;
    lastRecord.timestamp = timestamp;
    
    hydrationStore.totalConsumed = hydrationStore.totalConsumed - oldAmount + newAmount;
    hydrationStore.lastAmount = newAmount;
    hydrationStore.lastTime = Date.now();
    
    await saveHydrationData();
    console.log('Registro atualizado com sucesso');
    
    return {
      success: true,
      totalConsumed: hydrationStore.totalConsumed
    };
  } catch (error) {
    console.error('Erro ao atualizar registro de hidratação:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-hydration-data', async () => {
  console.log('Recebido pedido para obter dados de hidratação');
  try {
    return {
      totalConsumed: hydrationStore.totalConsumed,
      lastAmount: hydrationStore.lastAmount,
      lastTime: hydrationStore.lastTime,
      records: hydrationStore.records
    };
  } catch (error) {
    console.error('Erro ao obter dados de hidratação:', error);
    return { success: false, error: error.message };
  }
});

// Enviar detecção automática de hidratação
function sendAutoHydrationDetection(amount) {
  console.log('Enviando detecção automática:', amount);
  if (hydrationDialogWindow && !hydrationDialogWindow.isDestroyed()) {
    hydrationDialogWindow.webContents.send('auto-hydration-detected', amount);
  }
}

// Receber detecção de hidratação do reminder
ipcMain.on('hydration-detected', (event, amount) => {
  console.log('Recebida detecção de hidratação:', amount);
  sendAutoHydrationDetection(amount);
});

// Adicionar handle para save-hydration-data
ipcMain.handle('save-hydration-data', async () => {
  console.log('Salvando dados de hidratação...');
  try {
    await hydrationTracker.saveData();
    return { success: true };
  } catch (error) {
    console.error('Erro ao salvar dados:', error);
    return { success: false, error: error.message };
  }
});
