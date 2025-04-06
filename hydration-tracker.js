const moment = require('moment');
let electronStore = null;

class HydrationTracker {
  constructor() {
    this.store = null;
    this.initialized = false;
    this.initStore();
  }
  
  // Inicializar o store de forma assíncrona
  async initStore() {
    try {
      // Usar importação dinâmica para electron-store
      const { default: Store } = await import('electron-store');
      
      this.store = new Store({
        name: 'hydration-data',
        defaults: {
          meta: {
            diaria: 4000, // Meta diária em ml (padrão: 4L)
            ultimaAtualizacao: null
          },
          registros: {},
          configuracoes: {
            opcoesPadraoML: [200, 300, 500] // Opções padrão para consumo de água em ml
          }
        }
      });
      
      this.initialized = true;
      
      // Inicializar dados para hoje
      this.inicializarDiaAtual();
      
      console.log('HydrationTracker: Store inicializado com sucesso');
    } catch (error) {
      console.error('HydrationTracker: Erro ao inicializar store:', error);
      throw error;
    }
  }
  
  // Inicializa o dia atual no registro se ainda não existir
  inicializarDiaAtual() {
    if (!this.initialized || !this.store) return;
    
    const hoje = moment().format('YYYY-MM-DD');
    const registros = this.store.get('registros');
    
    if (!registros[hoje]) {
      registros[hoje] = {
        consumoTotal: 0,
        registrosIndividuais: []
      };
      this.store.set('registros', registros);
    }
  }
  
  // Adiciona um registro de consumo de água
  registrarConsumo(quantidade) {
    if (!this.initialized || !this.store) return {
      totalHoje: 0,
      metaDiaria: 4000,
      progresso: 0
    };
    
    this.inicializarDiaAtual();
    const hoje = moment().format('YYYY-MM-DD');
    const registros = this.store.get('registros');
    
    // Adicionar registro individual
    registros[hoje].registrosIndividuais.push({
      timestamp: Date.now(),
      hora: moment().format('HH:mm'),
      quantidade: quantidade
    });
    
    // Atualizar consumo total
    registros[hoje].consumoTotal += quantidade;
    
    // Salvar registros atualizados
    this.store.set('registros', registros);
    this.store.set('meta.ultimaAtualizacao', Date.now());
    
    return {
      totalHoje: registros[hoje].consumoTotal,
      metaDiaria: this.store.get('meta').diaria,
      progresso: (registros[hoje].consumoTotal / this.store.get('meta').diaria) * 100
    };
  }
  
  // Obtém a meta diária
  obterMetaDiaria() {
    if (!this.initialized || !this.store) return 4000;
    
    return this.store.get('meta').diaria;
  }
  
  // Define uma nova meta diária
  definirMetaDiaria(novaMetaML) {
    if (!this.initialized || !this.store) return novaMetaML;
    
    this.store.set('meta.diaria', novaMetaML);
    return novaMetaML;
  }
  
  // Obtém as opções padrão para consumo
  obterOpcoesPadrao() {
    if (!this.initialized || !this.store) return [200, 300, 500];
    
    return this.store.get('configuracoes').opcoesPadraoML;
  }
  
  // Obtém o progresso de hoje
  obterProgressoHoje() {
    if (!this.initialized || !this.store) {
      const hoje = moment().format('YYYY-MM-DD');
      return {
        data: hoje,
        dataFormatada: moment(hoje).format('DD/MM/YYYY'),
        consumoTotal: 0,
        metaDiaria: 4000,
        progresso: 0,
        registros: [],
        restante: 4000
      };
    }
    
    this.inicializarDiaAtual();
    const hoje = moment().format('YYYY-MM-DD');
    const registros = this.store.get('registros');
    const metaDiaria = this.store.get('meta').diaria;
    
    return {
      data: hoje,
      dataFormatada: moment(hoje).format('DD/MM/YYYY'),
      consumoTotal: registros[hoje].consumoTotal,
      metaDiaria: metaDiaria,
      progresso: (registros[hoje].consumoTotal / metaDiaria) * 100,
      registros: registros[hoje].registrosIndividuais,
      restante: Math.max(0, metaDiaria - registros[hoje].consumoTotal)
    };
  }
  
  // Gera relatório dos últimos dias
  gerarRelatorio(dias = 7) {
    if (!this.initialized || !this.store) {
      return {
        periodo: {
          inicio: moment().subtract(dias-1, 'days').format('DD/MM/YYYY'),
          fim: moment().format('DD/MM/YYYY')
        },
        dias: [],
        consumoTotal: 0,
        mediaDiaria: 0,
        metaDiaria: 4000,
        cumprimentoMedio: 0
      };
    }
    
    const relatorio = {
      periodo: {
        inicio: moment().subtract(dias-1, 'days').format('DD/MM/YYYY'),
        fim: moment().format('DD/MM/YYYY')
      },
      dias: [],
      consumoTotal: 0,
      mediaDiaria: 0,
      metaDiaria: this.store.get('meta').diaria,
      cumprimentoMedio: 0
    };
    
    // Calcular dados para cada dia no período
    for (let i = 0; i < dias; i++) {
      const data = moment().subtract(i, 'days').format('YYYY-MM-DD');
      const registros = this.store.get('registros');
      const dadosDia = registros[data] || { consumoTotal: 0, registrosIndividuais: [] };
      
      const progresso = (dadosDia.consumoTotal / relatorio.metaDiaria) * 100;
      
      relatorio.dias.unshift({
        data: data,
        dataFormatada: moment(data).format('DD/MM/YYYY'),
        diaDaSemana: moment(data).format('dddd'),
        consumoTotal: dadosDia.consumoTotal,
        progresso: progresso,
        atingiuMeta: progresso >= 100,
        registros: dadosDia.registrosIndividuais
      });
      
      relatorio.consumoTotal += dadosDia.consumoTotal;
    }
    
    // Calcular médias
    relatorio.mediaDiaria = relatorio.consumoTotal / dias;
    relatorio.cumprimentoMedio = (relatorio.mediaDiaria / relatorio.metaDiaria) * 100;
    
    return relatorio;
  }
}

module.exports = HydrationTracker; 