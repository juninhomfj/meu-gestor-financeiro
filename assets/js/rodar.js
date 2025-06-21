// rodar.js
import os from 'os';
import { exec } from 'child_process';
import path from 'path';

// Função para obter o IP local da sua rede
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const porta = 5500;
const ip = getLocalIP();
const pasta = path.resolve('.');

console.log(`🔧 Servidor iniciado com sucesso!
👉 Acesse no seu navegador de outro dispositivo da rede:
   👉 http://${ip}:${porta}
`);

// Inicia o http-server no diretório atual
exec(`http-server "${pasta}" -p ${porta}`, (err, stdout, stderr) => {
  if (err) {
    console.error(`Erro ao iniciar servidor: ${err.message}`);
  }
});
    