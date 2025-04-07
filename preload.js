const { contextBridge, ipcRenderer } = require('electron');

// Log de inicialização
console.log('Preload script iniciando...');

// Expor API segura para a janela de renderização
contextBridge.exposeInMainWorld('electron', {
  // Enviar mensagens
  send: (channel, data) => {
    const validChannels = [
      'hydration-detected',
      'show-hydration-dialog',
      'show-reminder',
      'close-reminder',
      'close-hydration-dialog',
      'get-hydration-settings'
    ];
    if (validChannels.includes(channel)) {
      console.log(`[preload] Enviando mensagem para canal ${channel}:`, data);
      ipcRenderer.send(channel, data);
    }
  },
  
  // Receber mensagens
  receive: (channel, func) => {
    const validChannels = ['auto-hydration-detected'];
    if (validChannels.includes(channel)) {
      console.log(`[preload] Registrando listener para canal ${channel}`);
      ipcRenderer.on(channel, (event, ...args) => {
        console.log(`[preload] Recebida mensagem no canal ${channel}:`, args);
        func(...args);
      });
    }
  },
  
  // Invocar métodos
  invoke: (channel, data) => {
    const validChannels = [
      'add-hydration-record',
      'update-last-hydration',
      'get-hydration-data',
      'save-hydration-data'
    ];
    if (validChannels.includes(channel)) {
      console.log(`[preload] Invocando método ${channel}:`, data);
      return ipcRenderer.invoke(channel, data);
    }
  }
});

console.log('Preload script concluído.');
