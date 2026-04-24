# 📶 Lorapok LocalSync
### High-Performance, Privacy-First Local Network Ecosystem

<p align="center">
  <img src="frontend/public/icon.png" alt="Lorapok Logo" width="128" height="128">
</p>

<p align="center">
  <a href="https://github.com/Maijied/Lorapok-LocalSync/releases">
    <img src="https://img.shields.io/github/v/release/Maijied/Lorapok-LocalSync?style=for-the-badge&color=00f3ff" alt="Release">
  </a>
  <a href="https://github.com/Maijied/Lorapok-LocalSync/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/Maijied/Lorapok-LocalSync/release.yml?style=for-the-badge" alt="Build Status">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/github/license/Maijied/Lorapok-LocalSync?style=for-the-badge" alt="License">
  </a>
</p>

**Lorapok LocalSync** is a professional-grade communication suite designed for environments where privacy, speed, and reliability are paramount. It transforms your local Wi-Fi router into a powerful, secure messaging hub. **No internet, no external servers, no tracking.** Just pure, encrypted synchronization between your devices.

---

## ✨ Premium Features

- **🌐 Dynamic Network Discovery**: No more hardcoded IPs. The system automatically identifies the host on your router, allowing seamless cross-platform communication between Windows, Linux, Android, and Web clients.
- **🛡️ Root Identity Protocol**: Automatically identifies users based on their system hostname, ensuring zero-configuration setup for office and home environments.
- **🔐 Cyber-Industrial Security**: AES-256-GCM encryption with secure PIN-based session unlocking and local-only data persistence.
- **📦 Multi-Media Engine**: 
    - **Ultra-Fast Sharing**: Native file streaming for high-quality images and 4K video.
    - **Link Previews**: Rich, automated metadata cards for shared internal and external URLs.
    - **Glassmorphic Viewer**: A stunning, centered media viewer with native video playback controls.
- **📞 HD P2P Calling**: Secure, low-latency voice and video communication powered by WebRTC.
- **🔄 Universal Sync**: Real-time message queuing and delivery status across the entire local network.

---

## 💻 Supported Platforms

| Windows (NSIS) | Linux (.deb/.AppImage) | Android (.apk) | Web App (PWA) |
| :---: | :---: | :---: | :---: |
| ✅ | ✅ | ✅ | ✅ |

---

## 🛠️ Technology Stack

- **Frontend**: React 19, Vite 6, Lucide Icons
- **Backend**: Node.js, Express, Socket.io, SQLite
- **Desktop**: Electron 33 (with Neon Splash Screen & NSIS)
- **Mobile**: Capacitor 6 (Android/iOS)
- **Database**: IndexedDB (Client) & Better-SQLite3 (Server)

---

## 📥 Installation

### For Users
Download the latest installers for your platform from the [Releases Page](https://github.com/Maijied/Lorapok-LocalSync/releases).

### For Developers
1. **Clone & Initialize**:
   ```bash
   git clone https://github.com/Maijied/Lorapok-LocalSync.git
   cd Lorapok-LocalSync
   ```

2. **Start the Backend Hub**:
   ```bash
   cd backend
   npm install
   npm start
   ```

3. **Launch the Frontend Experience**:
   ```bash
   cd ../frontend
   npm install
   npm run dev # For Web
   npm run electron:start # For Desktop
   ```

---

## 🛡️ Security & Privacy Architecture

Lorapok follows a **Zero-Trust Local Network** model:
1. **Air-Gapped by Design**: The core application logic never attempts to connect to the global internet.
2. **Local Sovereignty**: All cryptographic keys, messages, and files reside exclusively on your own hardware.
3. **Encrypted Persistence**: Data is stored in encrypted SQLite databases on the server and secured IndexedDB on the client.

---

## 🤝 Contributing

We welcome contributions from the community!
1. Fork the Project.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

<p align="center">
  Built with ❤️ for the decentralized future.
</p>
