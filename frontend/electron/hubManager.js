import dgram from 'dgram';
import { fork } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class HubManager {
  constructor(app) {
    this.app = app;
    this.hubProcess = null;
    this.foundHub = null;
  }

  async discoverHub(timeout = 3000) {
    return new Promise((resolve) => {
      const client = dgram.createSocket('udp4');
      client.on('error', (err) => {
         console.error('UDP Discovery error:', err);
         resolve(null);
      });
      
      client.bind();
      
      const timer = setTimeout(() => {
        try { client.close(); } catch(e) {}
        resolve(null);
      }, timeout);

      client.on('message', (msg, rinfo) => {
        try {
          const data = JSON.parse(msg.toString());
          if (data.type === 'LORAPOK_HUB') {
            clearTimeout(timer);
            try { client.close(); } catch(e) {}
            this.foundHub = { ip: rinfo.address, port: data.port };
            resolve(this.foundHub);
          }
        } catch (e) {}
      });

      client.on('listening', () => {
        client.setBroadcast(true);
        const message = Buffer.from('LORAPOK_DISCOVER');
        client.send(message, 4001, '255.255.255.255');
      });
    });
  }

  startInternalHub() {
    console.log('Starting internal Hub...');
    
    let backendPath;
    if (this.app.isPackaged) {
      backendPath = path.join(process.resourcesPath, 'backend', 'server.js');
    } else {
      backendPath = path.join(__dirname, '..', '..', 'backend', 'server.js');
    }

    if (!fs.existsSync(backendPath)) {
      console.error('Backend script not found at:', backendPath);
      return;
    }

    // Fork the backend process
    this.hubProcess = fork(backendPath, [], {
      env: { ...process.env, PORT: 4000 },
      stdio: 'inherit'
    });

    this.hubProcess.on('error', (err) => {
      console.error('Failed to fork internal Hub:', err);
    });

    this.hubProcess.on('exit', (code) => {
      console.log(`Internal Hub exited with code ${code}`);
    });
  }

  stop() {
    if (this.hubProcess) {
      this.hubProcess.kill();
    }
  }
}

export default HubManager;
