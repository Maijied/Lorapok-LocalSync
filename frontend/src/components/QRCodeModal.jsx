import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X } from 'lucide-react';

export default function QRCodeModal({ onClose }) {
  const [ipAddress, setIpAddress] = useState('');

  useEffect(() => {
    // Attempt to get local IP (mocked for browser environment)
    // In a real local network app, the server would provide its IP
    setIpAddress(window.location.host);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
      <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-2xl relative max-w-sm w-full mx-4">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition"
        >
          <X size={20} />
        </button>
        
        <h2 className="text-xl font-bold text-white mb-2 text-center">Scan to Connect</h2>
        <p className="text-slate-400 text-sm text-center mb-6">
          Scan this QR code with another device on the same network to join the chat.
        </p>
        
        <div className="bg-white p-4 rounded-xl flex justify-center mb-6">
          <QRCodeSVG 
            value={`http://${ipAddress}`}
            size={200}
            bgColor={"#ffffff"}
            fgColor={"#000000"}
            level={"L"}
            includeMargin={false}
          />
        </div>
        
        <div className="text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Server Address</p>
          <p className="text-blue-400 font-mono bg-slate-900/50 py-2 px-4 rounded-lg inline-block border border-blue-900/30">
            http://{ipAddress}
          </p>
        </div>
      </div>
    </div>
  );
}
