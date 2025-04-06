# Hidrate-se

Um aplicativo desktop para lembretes de hidratação com detecção inteligente de copos e garrafas via câmera.

![Banner Hidrate-se](./assets/app-screenshot.png)

## 📋 Sobre o Projeto

**Hidrate-se** é um aplicativo desenvolvido em Electron que ajuda você a manter uma rotina saudável de hidratação através de lembretes periódicos. O diferencial do aplicativo é sua capacidade de detectar, através da câmera, quando você está realmente bebendo água, usando tecnologia de inteligência artificial para reconhecer copos e garrafas.

### Principais Funcionalidades

- ⏰ **Lembretes Personalizáveis**: Configure o intervalo entre os lembretes de acordo com sua rotina.
- 📷 **Detecção Inteligente**: Utiliza TensorFlow.js para detectar copos e garrafas através da câmera.
- 📊 **Controle de Hidratação**: Registra sua ingestão diária de água e monitora o progresso.
- 📈 **Relatórios Detalhados**: Visualize estatísticas de consumo dos últimos 7, 15 ou 30 dias.
- 🎯 **Metas Personalizáveis**: Configure sua meta diária de hidratação.
- 🔔 **Notificações na Bandeja do Sistema**: Acompanhe o tempo até o próximo lembrete.

## 🚀 Instalação

### Pré-requisitos

- [Node.js](https://nodejs.org/) (v14 ou superior)
- [npm](https://www.npmjs.com/) (v6 ou superior)

### Passos para Instalação

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/hidrate-se.git

# Entre no diretório
cd hidrate-se

# Instale as dependências
npm install

# Execute o aplicativo
npm start
```

## 🖥️ Uso

### Primeira Execução

Na primeira execução, você será solicitado a configurar o intervalo entre os lembretes. Por padrão, o aplicativo está configurado para lembretes a cada 60 minutos.

### Detecção de Hidratação

Quando o lembrete aparecer:
1. Beba água normalmente, mantendo o copo ou garrafa visível para a câmera
2. O aplicativo detectará automaticamente o objeto e registrará o consumo
3. Você poderá então informar a quantidade exata consumida

### Relatórios

Acesse estatísticas detalhadas do seu consumo de água:
- Visualize seu progresso diário
- Acompanhe tendências semanais ou mensais
- Verifique se você está atingindo suas metas de hidratação

## 🛠️ Tecnologias Utilizadas

- [Electron](https://www.electronjs.org/) - Framework para desenvolvimento de aplicações desktop
- [TensorFlow.js](https://www.tensorflow.org/js) - Biblioteca de machine learning para JavaScript
- [COCO-SSD](https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd) - Modelo pré-treinado para detecção de objetos
- [Node.js](https://nodejs.org/) - Ambiente de execução JavaScript server-side
- [Moment.js](https://momentjs.com/) - Biblioteca para manipulação de datas

## 📚 Estrutura do Projeto

```
hidrate-se/
├── assets/              # Ícones e recursos gráficos
├── models/              # Modelos pré-treinados de TensorFlow.js
├── main.js              # Processo principal do Electron
├── preload.js           # Script de preload para comunicação segura
├── hydration-tracker.js # Lógica para rastreamento de hidratação
├── index.html           # Interface de configuração
├── reminder.html        # Interface de lembrete com detecção
├── hydration-dialog.html # Interface para registro de consumo
└── hydration-report.html # Interface para visualização de relatórios
```

## ⚙️ Configuração

### Personalização de Metas

Você pode personalizar sua meta diária de hidratação e as opções de volume através da interface de relatórios, clicando no botão "Ajustar Meta Diária".

### Configuração de Intervalos

Para alterar o intervalo entre os lembretes, acesse a tela de configurações através do menu da bandeja do sistema.

## 🤝 Contribuição

Contribuições são bem-vindas! Para contribuir:

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Faça commit das suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Faça push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🙏 Agradecimentos

- [TensorFlow.js](https://www.tensorflow.org/js) pela biblioteca de machine learning
- [Electron](https://www.electronjs.org/) pelo framework de desenvolvimento desktop
- Todos os desenvolvedores que contribuíram para as bibliotecas utilizadas

---

Desenvolvido com ❤️ para manter você hidratado! 