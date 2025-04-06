# Guia de Contribuição

Obrigado pelo interesse em contribuir com o projeto Hidrate-se! Este documento fornece diretrizes e instruções para contribuir de forma efetiva.

## Código de Conduta

Ao participar deste projeto, você concorda em manter um ambiente respeitoso e colaborativo. Seja gentil, profissional e receptivo a diferentes pontos de vista.

## Como Contribuir

### Reportando Bugs

Se você encontrou um bug, por favor, crie uma issue fornecendo:

1. Uma descrição clara do bug
2. Passos para reproduzir o problema
3. Comportamento esperado vs. comportamento atual
4. Screenshots (se aplicável)
5. Informações sobre o ambiente (OS, versão do Node.js, etc.)

### Sugerindo Melhorias

Para sugerir melhorias ou novas funcionalidades:

1. Descreva claramente a melhoria
2. Explique por que essa melhoria seria útil
3. Sugira uma abordagem para implementação (opcional)

### Contribuindo com Código

1. Faça um fork do repositório
2. Clone o fork para sua máquina local
3. Crie um branch para sua feature: `git checkout -b feature/nome-da-feature`
4. Implemente suas mudanças seguindo o estilo de código do projeto
5. Certifique-se de que o código funciona conforme esperado
6. Faça commit das mudanças: `git commit -m 'Adiciona nova feature'`
7. Envie para o GitHub: `git push origin feature/nome-da-feature`
8. Abra um Pull Request descrevendo suas mudanças

## Estilo de Código

Por favor, mantenha o estilo de código consistente com o resto do projeto:

- Use 2 espaços para indentação
- Termine arquivos com uma nova linha
- Use nomes descritivos para variáveis e funções
- Inclua comentários para códigos complexos
- Siga as melhores práticas de JavaScript/Node.js

## Estrutura do Projeto

Familiarize-se com a estrutura do projeto antes de contribuir:

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

## Processo de Revisão

Após a submissão de um Pull Request:

1. Os mantenedores do projeto revisarão suas mudanças
2. Poderão ser solicitados ajustes ou esclarecimentos
3. Uma vez aprovado, seu código será mesclado ao projeto

## Dicas para uma Contribuição Bem-sucedida

- Antes de começar a trabalhar, verifique se já não existe uma issue ou PR para a mesma funcionalidade/correção
- Mantenha seus PRs focados em uma única funcionalidade ou correção
- Teste suas mudanças em diferentes plataformas (se possível)
- Documente novas funcionalidades ou comportamentos
- Atualize o README.md se necessário

Agradecemos seu tempo e esforço para melhorar o projeto Hidrate-se! 