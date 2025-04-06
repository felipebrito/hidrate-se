const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');

// Criar diretório para modelos
const modelsDir = path.join(__dirname, 'models');
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

// Função para baixar arquivo
const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Falha ao baixar, código de status: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Baixado: ${dest}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
    
    file.on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
};

// Função para copiar arquivo
const copyFile = (source, dest) => {
  return new Promise((resolve, reject) => {
    fs.copyFile(source, dest, (err) => {
      if (err) {
        console.error(`Erro ao copiar ${source} para ${dest}:`, err);
        reject(err);
        return;
      }
      console.log(`Copiado: ${source} -> ${dest}`);
      resolve();
    });
  });
};

async function downloadTensorflowModels() {
  console.log('Iniciando download dos modelos TensorFlow.js...');
  
  // Lista de arquivos TensorFlow.js para baixar
  const files = [
    {
      url: 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core@2.0.0/dist/tf-core.min.js',
      dest: path.join(modelsDir, 'tf-core.min.js'),
      alternativeDests: [
        path.join(__dirname, 'tf-core.min.js')
      ]
    },
    {
      url: 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-cpu@2.0.0/dist/tf-backend-cpu.min.js',
      dest: path.join(modelsDir, 'tf-backend-cpu.min.js'),
      alternativeDests: [
        path.join(__dirname, 'tf-backend-cpu.min.js')
      ]
    },
    {
      url: 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-converter@2.0.0/dist/tf-converter.min.js',
      dest: path.join(modelsDir, 'tf-converter.min.js'),
      alternativeDests: [
        path.join(__dirname, 'tf-converter.min.js')
      ]
    },
    {
      url: 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@2.0.0/dist/tf.min.js',
      dest: path.join(modelsDir, 'tensorflow.min.js'),
      alternativeDests: [
        path.join(__dirname, 'tensorflow.min.js')
      ]
    },
    {
      url: 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.0.3/dist/coco-ssd.min.js',
      dest: path.join(modelsDir, 'coco-ssd.min.js'),
      alternativeDests: [
        path.join(__dirname, 'coco-ssd.min.js')
      ]
    }
  ];
  
  // Baixar todos os arquivos em sequência
  for (const file of files) {
    try {
      console.log(`Baixando ${file.url}...`);
      await downloadFile(file.url, file.dest);
      
      // Copiar para locais alternativos
      for (const altDest of file.alternativeDests) {
        try {
          await copyFile(file.dest, altDest);
        } catch (copyError) {
          console.error(`Erro ao copiar para ${altDest}:`, copyError);
        }
      }
    } catch (error) {
      console.error(`Erro ao baixar ${file.url}:`, error);
    }
  }
  
  console.log('Download dos modelos TensorFlow.js concluído!');
  console.log(`Arquivos salvos em: ${modelsDir}`);
  
  // Instalar wasm backend (opcional)
  console.log('Instalando pacotes TensorFlow.js...');
  exec('npm install @tensorflow/tfjs-backend-cpu @tensorflow/tfjs-backend-wasm --save', (error, stdout, stderr) => {
    if (error) {
      console.error(`Erro ao instalar pacotes TensorFlow.js: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`stderr: ${stderr}`);
      return;
    }
    console.log(`stdout: ${stdout}`);
    console.log('Instalação dos pacotes TensorFlow.js concluída!');
  });
}

// Executar o download
downloadTensorflowModels(); 