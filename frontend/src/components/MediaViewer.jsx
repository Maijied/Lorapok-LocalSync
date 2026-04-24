import React from 'react';
import { Download, X } from 'lucide-react';

export default function MediaViewer({ fileUrl, fileName, type, onClose }) {
  if (!fileUrl) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4">
      <div className="absolute top-4 right-4 flex gap-4">
        <a 
          href={fileUrl} 
          download={fileName}
          className="p-2 rounded-full bg-slate-800 text-white hover:bg-slate-700 transition"
        >
          <Download size={24} />
        </a>
        <button 
          onClick={onClose}
          className="p-2 rounded-full bg-slate-800 text-white hover:bg-slate-700 transition"
        >
          <X size={24} />
        </button>
      </div>
      
      <div className="max-w-4xl max-h-screen flex items-center justify-center">
        {type === 'image' ? (
          <img 
            src={fileUrl} 
            alt={fileName} 
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
          />
        ) : type === 'video' ? (
          <video 
            src={fileUrl} 
            controls 
            autoPlay 
            className="max-w-full max-h-[90vh] rounded-lg"
          />
        ) : (
          <div className="text-white text-center">
            <p className="mb-4">Cannot preview this file type.</p>
            <a href={fileUrl} download={fileName} className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 transition">
              Download File
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
