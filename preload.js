const { contextBridge, ipcRenderer } = require('electron');

// Console log para debug
console.log('Preload.js carregado com sucesso');

// Expor API segura para a janela de renderização
contextBridge.exposeInMainWorld('electron', {
  // Enviar mensagens para o processo principal
  send: (channel, data) => {
    // Lista de canais permitidos
    const validChannels = [
      'update-interval', 
      'close-reminder', 
      'get-current-interval', 
      'force-reminder',
      // Novos canais para funcionalidades de hidratação
      'register-hydration',
      'get-today-hydration',
      'get-hydration-report',
      'get-hydration-settings',
      'save-hydration-settings',
      'show-hydration-dialog',
      'show-hydration-report'
    ];
    
    if (validChannels.includes(channel)) {
      console.log(`[preload] Enviando mensagem para canal: ${channel}`, data);
      ipcRenderer.send(channel, data);
    } else {
      console.warn(`[preload] Canal não permitido: ${channel}`);
    }
  },
  
  // Receber mensagens do processo principal
  receive: (channel, func) => {
    // Lista de canais permitidos para receber
    const validChannels = [
      'current-interval', 
      'reminder-scheduled',
      'close-reminder-response',
      // Novos canais para funcionalidades de hidratação
      'hydration-updated',
      'today-hydration',
      'hydration-report',
      'hydration-settings',
      'hydration-settings-saved'
    ];
    
    if (validChannels.includes(channel)) {
      console.log(`[preload] Registrando listener para canal: ${channel}`);
      
      // Remover listeners antigos para evitar duplicações
      ipcRenderer.removeAllListeners(channel);
      
      // Adicionar novo listener
      ipcRenderer.on(channel, (event, ...args) => {
        console.log(`[preload] Recebida mensagem no canal: ${channel}`, args);
        func(...args);
      });
    } else {
      console.warn(`[preload] Canal de recebimento não permitido: ${channel}`);
    }
  },
  
  // Método para testar se a API do Electron está disponível
  ping: () => {
    console.log('[preload] Ping chamado');
    return 'pong';
  }
});
