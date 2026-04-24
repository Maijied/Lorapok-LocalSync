# 🐛 Lorapok Communicator
### Decentralized, Encrypted Local Network Chat

![Lorapok Logo](logo.png)

[![Release](https://img.shields.io/github/v/release/Maijied/Lorapok-LocalSync?style=for-the-badge)](https://github.com/Maijied/Lorapok-LocalSync/releases)
[![Build Status](https://img.shields.io/github/actions/workflow/status/Maijied/Lorapok-LocalSync/release.yml?style=for-the-badge)](https://github.com/Maijied/Lorapok-LocalSync/actions)
[![License](https://img.shields.io/github/license/Maijied/Lorapok-LocalSync?style=for-the-badge)](LICENSE)

**Lorapok** is a high-performance communication platform designed for privacy-conscious users who need secure messaging over a local router (LAN/Wi-Fi) without any internet connection. No servers, no tracking, just pure peer-to-peer (P2P) interaction.

---

## 🚀 Key Features

- **🔐 End-to-End Encryption**: Powered by the native Web Crypto API (AES-256-GCM) and secure PIN-based session unlocking.
- **📁 Advanced Media System**: Chunked file uploads for sharing high-quality images and videos instantly over your local network.
- **📞 P2P HD Calling**: Ultra-low latency voice and video calls using WebRTC.
- **🔍 Global Full-Text Search**: Find any message or contact instantly with an indexed local search.
- **📶 QR Sync**: Seamlessly connect mobile devices to your local host by scanning a QR code.
- **🔄 Offline Sync Manager**: Queue messages while offline; they'll automatically sync as soon as you reconnect to the router.

---

## 💻 Platforms

| Windows | macOS | Linux | Android | iOS |
| :---: | :---: | :---: | :---: | :---: |
| ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 🛠 Installation & Setup

### Prerequisites
- Node.js (v18+)
- Local Wi-Fi Router

### For Developers
1. **Clone the Repo**:
   ```bash
   git clone https://github.com/Maijied/Lorapok-LocalSync.git
   cd Lorapok-LocalSync
   ```

2. **Setup Backend**:
   ```bash
   cd backend
   npm install
   npm start
   ```

3. **Setup Frontend**:
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

---

## 🛡 Security Architecture

Lorapok follows a "Zero-Trust" local model:
1. **Local Storage**: All messages and cryptographic keys are stored in IndexedDB (frontend) and SQLite (backend) on your local machine.
2. **Key Exchange**: Uses Diffie-Hellman inspired local key exchange for group encryption.
3. **No External API**: The app never connects to the global internet, making it immune to remote data breaches.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Built with ❤️ for the privacy-conscious community.
</p>
