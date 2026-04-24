# 🐛 LocalSync
### Professional, Privacy-First Local Communication Ecosystem
**A Product of Lorapok**

<p align="center">
  <img src="frontend/public/logo-transparent.png" alt="LocalSync Logo" width="160">
</p>

<p align="center">
  <a href="https://github.com/Maijied/Lorapok-LocalSync/releases">
    <img src="https://img.shields.io/github/v/release/Maijied/Lorapok-LocalSync?style=for-the-badge&color=00f3ff" alt="Release">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/github/license/Maijied/Lorapok-LocalSync?style=for-the-badge" alt="License">
  </a>
</p>

**LocalSync** is a professional-grade communication suite built for the decentralized future. Designed for speed, privacy, and reliability, it transforms your local network into a secure messaging hub. **No internet, no external servers, no tracking.** Just high-fidelity synchronization between your devices.

---

## ✨ Key Features

- **🐛 Animated Brand Identity**: Features a custom, organic "Larva" theme (Lorapok) with smooth animations and a premium "Cute-Professional" aesthetic.
- **🌐 Zero-Config Discovery**: Automatically identifies the Hub on your router, allowing seamless cross-platform communication between Windows, Linux, and Web clients.
- **🛡️ Secure PIN Access**: AES-256-GCM encryption with secure PIN-based session unlocking and local-only data persistence.
- **📦 Multi-Media Engine**: 
    - **Ultra-Fast Sharing**: Native file streaming for high-quality images and large files.
    - **Link Previews**: Rich metadata cards for shared internal and external URLs.
    - **Glassmorphic UI**: A stunning, blur-heavy interface that feels modern and responsive.
- **📞 HD P2P Calling**: Secure, low-latency voice and video communication powered by WebRTC with smart hardware fallback.
- **🔄 Priority Queueing**: Reliable message delivery with millisecond-precise sequencing and offline persistence.

---

## 💻 Supported Platforms

| Windows (NSIS) | Linux (.deb) | macOS (dmg) | Android (apk) | Web App (PWA) |
| :---: | :---: | :---: | :---: | :---: |
| ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 🛠️ Technology Stack

- **Frontend**: React 19, Vite 6, Lucide Icons, Fredoka Fonts
- **Backend**: Node.js, Socket.io, Better-SQLite3
- **Desktop**: Electron 33 (with Custom Splash & Session Permissions)
- **Design**: Premium Glassmorphism & Cyber-Industrial Aesthetics

---

## 📥 Installation & Usage

### 1. Desktop Users
1. Download and install from the [Releases Page](https://github.com/Maijied/Lorapok-LocalSync/releases).
2. **Open the App**: It will automatically search your network for an active Hub.
3. **Auto-Hosting**: If no Hub is found, your PC will seamlessly become the network's internal Hub.

### 2. Web Users
1. Open your browser and go to the IP address of any PC running LocalSync on your network (e.g., `https://192.168.0.219:5173`).
2. Accept the self-signed certificate to enable secure WebRTC calling.

---

## 💻 For Developers

1. **Clone & Initialize**:
   ```bash
   git clone https://github.com/Maijied/Lorapok-LocalSync.git
   cd Lorapok-LocalSync
   ```

2. **Start the Environment**:
   ```bash
   cd frontend
   npm install
   npm run electron:dev
   ```

---

## 🛡️ Security & Privacy

LocalSync follows a **Zero-Trust Local Network** model:
1. **Air-Gapped by Design**: No global internet connection required.
2. **Local Sovereignty**: Messages and files reside exclusively on your own hardware.
3. **Encrypted Persistence**: Data is stored in secure SQLite databases with 30-day auto-cleanup.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

<p align="center">
  Built with ❤️ for the decentralized future.
</p>
