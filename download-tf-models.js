const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// Criar diretório models se não existir
const modelsDir = path.join(__dirname, 'models');
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir);
}

// Função para baixar arquivos
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Download concluído: ${dest}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

// Função para baixar os modelos do TensorFlow.js
async function downloadTensorflowModels() {
  console.log('Iniciando download dos modelos do TensorFlow.js...');
  
  const files = [
    {
      url: 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js',
      dest: path.join(modelsDir, 'tf.min.js')
    },
    {
      url: 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-cpu@4.22.0/dist/tf-backend-cpu.min.js',
      dest: path.join(modelsDir, 'tf-backend-cpu.min.js')
    },
    {
      url: 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.22.0/dist/tf-backend-wasm.min.js',
      dest: path.join(modelsDir, 'tf-backend-wasm.min.js')
    },
    {
      url: 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.2/dist/coco-ssd.min.js',
      dest: path.join(modelsDir, 'coco-ssd.min.js')
    }
  ];

  for (const file of files) {
    try {
      await downloadFile(file.url, file.dest);
    } catch (error) {
      console.error(`Erro ao baixar ${file.url}:`, error);
    }
  }

  console.log('Download dos modelos concluído!');
}

// Instalar o backend WASM do TensorFlow.js
try {
  console.log('Instalando backend WASM do TensorFlow.js...');
  execSync('npm install @tensorflow/tfjs-backend-wasm@4.22.0 --save', { stdio: 'inherit' });
  console.log('Backend WASM instalado com sucesso!');
} catch (error) {
  console.error('Erro ao instalar backend WASM:', error);
}

// Executar o download dos modelos
downloadTensorflowModels().catch(console.error); 