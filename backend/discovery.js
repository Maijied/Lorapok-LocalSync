const dgram = require('dgram');
const os = require('os');

class DiscoveryService {
  constructor(port = 4001, hubPort = 4000) {
    this.port = port;
    this.hubPort = hubPort;
    this.server = dgram.createSocket('udp4');
    this.hostname = os.hostname();
  }

  start() {
    this.server.on('error', (err) => {
      console.error(`Discovery Server error:\n${err.stack}`);
      this.server.close();
    });

    this.server.on('message', (msg, rinfo) => {
      if (msg.toString() === 'LORAPOK_DISCOVER') {
        const response = JSON.stringify({
          type: 'LORAPOK_HUB',
          hostname: this.hostname,
          port: this.hubPort
        });
        this.server.send(response, rinfo.port, rinfo.address);
      }
    });

    this.server.on('listening', () => {
      const address = this.server.address();
      console.log(`Discovery service listening on ${address.address}:${address.port}`);
    });

    this.server.bind(this.port);
  }

  stop() {
    this.server.close();
  }
}

module.exports = DiscoveryService;
