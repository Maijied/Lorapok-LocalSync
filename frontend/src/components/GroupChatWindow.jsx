import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { getMessagesByChatId, saveMessage } from '../utils/db';
import { Send, Paperclip, Users, ArrowLeft } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import LinkPreview from './LinkPreview';
import { getBackendUrlSync } from '../utils/api';

export default function GroupChatWindow({ selectedGroup, onBack }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!selectedGroup || !socket) return;

    // Load local messages for this group
    const loadMessages = async () => {
      const localMessages = await getMessagesByChatId(selectedGroup.id);
      setMessages(localMessages);
      scrollToBottom();
    };
    
    loadMessages();

    // Listen for incoming group messages
    const handleGroupMessage = async (data) => {
      if (data.chatId === selectedGroup.id || data.groupId === selectedGroup.id) {
        setMessages(prev => {
          // Avoid duplicates
          if (prev.find(m => m.id === data.id)) return prev;
          return [...prev, data];
        });
        await saveMessage(data);
        scrollToBottom();
      } else {
        await saveMessage(data);
      }
    };

    // Handle group history (previous messages for new members)
    const handleGroupHistory = async (data) => {
      if (data.groupId === selectedGroup.id && data.messages?.length > 0) {
        const historyMsgs = data.messages.map(m => ({
          id: m.id,
          chatId: data.groupId,
          groupId: data.groupId,
          from: m.from_user_id || m.from,
          fromName: m.fromName || m.from_user_id || 'Member',
          text: m.content || m.text,
          type: m.type || 'text',
          timestamp: m.timestamp,
        }));

        // Merge with existing, avoiding duplicates
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const newMsgs = historyMsgs.filter(m => !existingIds.has(m.id));
          if (newMsgs.length === 0) return prev;
          
          // Save new messages locally
          newMsgs.forEach(msg => saveMessage(msg));
          
          const merged = [...newMsgs, ...prev];
          merged.sort((a, b) => a.timestamp - b.timestamp);
          return merged;
        });
        scrollToBottom();
      }
    };

    socket.on('group_message', handleGroupMessage);
    socket.on('group_history', handleGroupHistory);

    return () => {
      socket.off('group_message', handleGroupMessage);
      socket.off('group_history', handleGroupHistory);
    };
  }, [selectedGroup, socket]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const sendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const newMsg = {
      id: uuidv4(),
      chatId: selectedGroup.id,
      groupId: selectedGroup.id,
      from: user.id,
      fromName: user.name,
      text: inputText,
      type: 'text',
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, newMsg]);
    await saveMessage(newMsg);
    socket.emit('group_message', newMsg);
    
    setInputText('');
    scrollToBottom();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 200 * 1024 * 1024) { // 200MB limit
      alert('File is too large! Please select a file smaller than 200MB.');
      e.target.value = null;
      return;
    }

    setUploadProgress(1);
    const baseUrl = getBackendUrlSync();
    
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${baseUrl}/api/upload`, true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percentComplete);
      }
    };

    xhr.onload = async () => {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data.url) {
            let type = 'file';
            if (file.type.startsWith('image/')) type = 'image';
            else if (file.type.startsWith('video/')) type = 'video';
            
            const fullUrl = `${baseUrl}${data.url}`;
            const newMsg = {
              id: uuidv4(),
              chatId: selectedGroup.id,
              groupId: selectedGroup.id,
              from: user.id,
              fromName: user.name,
              text: data.filename,
              fileData: fullUrl,
              type: type,
              timestamp: Date.now(),
            };

            setMessages(prev => [...prev, newMsg]);
            await saveMessage(newMsg);
            socket.emit('group_message', newMsg);
            scrollToBottom();
          }
        } catch (err) {
          console.error('Failed to parse group upload response');
        }
      } else {
        alert('Upload failed.');
      }
      setUploadProgress(0);
    };

    xhr.onerror = () => {
      console.error('Group upload failed');
      alert('File upload failed. Make sure the server is running.');
      setUploadProgress(0);
    };

    xhr.send(formData);
    e.target.value = null;
  };

  const handleDownload = (e, msg) => {
    e.preventDefault();
    if (downloadingId) return;
    
    setDownloadingId(msg.id);
    setDownloadProgress(1);
    
    const xhr = new XMLHttpRequest();
    xhr.open('GET', msg.fileData, true);
    xhr.responseType = 'blob';
    
    xhr.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setDownloadProgress(percentComplete);
      }
    };
    
    xhr.onload = () => {
      if (xhr.status === 200) {
        const url = window.URL.createObjectURL(xhr.response);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = msg.text;
        document.body.appendChild(a);
        a.click();
        
        // Delay cleanup so Electron has time to trigger the native save dialog
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          a.remove();
        }, 1000);
      } else {
        alert('Download failed.');
      }
      setDownloadingId(null);
      setDownloadProgress(0);
    };
    
    xhr.onerror = () => {
      alert('Download failed. Check your connection.');
      setDownloadingId(null);
      setDownloadProgress(0);
    };
    
    xhr.send();
  };

  if (!selectedGroup) return null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerInfo}>
          <button className="mobile-back-btn" onClick={onBack}>
            <ArrowLeft size={24} />
          </button>
          <div style={styles.avatar}><Users size={20} /></div>
          <div style={{flex: 1}}>
            <h3 style={{ margin: 0 }}>{selectedGroup.name}</h3>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
               <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                 {selectedGroup.members.length} members
               </p>
               {selectedGroup.secretKey && (
                 <span style={{ fontSize: '0.7rem', backgroundColor: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', color: 'var(--primary-color)', fontWeight: 'bold' }}>
                   KEY: {selectedGroup.secretKey}
                 </span>
               )}
            </div>
          </div>
        </div>
      </div>

      <div style={styles.messageList}>
        {messages.map((msg) => {
          const isMine = msg.from === user.id;
          return (
            <div key={msg.id} style={{
              ...styles.messageWrapper,
              justifyContent: isMine ? 'flex-end' : 'flex-start'
            }}>
              <div style={{
                ...styles.messageBubble,
                backgroundColor: isMine ? 'var(--primary-color)' : 'var(--bg-surface)',
                color: isMine ? '#000' : 'var(--text-light)',
                borderBottomRightRadius: isMine ? '4px' : '16px',
                borderBottomLeftRadius: isMine ? '16px' : '4px',
              }}>
                {!isMine && <div style={styles.senderName}>{msg.fromName}</div>}
                {msg.type === 'image' ? (
                  <div>
                    <img src={msg.fileData} alt="attachment" style={styles.imageAttachment} />
                  </div>
                ) : msg.type === 'video' ? (
                  <div>
                    <video src={msg.fileData} controls style={styles.imageAttachment} />
                  </div>
                ) : msg.type === 'file' ? (
                  <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                    <div onClick={(e) => handleDownload(e, msg)} style={{...styles.fileLink, color: 'inherit', cursor: 'pointer'}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.1)', padding: '8px 12px', borderRadius: '8px'}}>
                        <span>📄</span>
                        <span style={{wordBreak: 'break-all'}}>{msg.text}</span>
                      </div>
                    </div>
                    {downloadingId === msg.id && (
                      <div style={{width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', marginTop: '4px'}}>
                        <div style={{width: `${downloadProgress}%`, height: '100%', backgroundColor: 'var(--primary-color)', transition: 'width 0.2s'}} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {msg.text}
                    {msg.text && msg.text.match(/(https?:\/\/[^\s]+)/g) && (
                       <LinkPreview url={msg.text.match(/(https?:\/\/[^\s]+)/g)[0]} />
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {uploadProgress > 0 && (
        <div style={{padding: '0 20px', width: '100%'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px'}}>
            <span>Uploading...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div style={{width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden'}}>
            <div style={{width: `${uploadProgress}%`, height: '100%', backgroundColor: 'var(--primary-color)', transition: 'width 0.2s'}} />
          </div>
        </div>
      )}

      <form style={styles.inputArea} onSubmit={sendMessage}>
        <button 
          type="button" 
          className="btn-primary" 
          style={{...styles.iconButton, backgroundColor: 'var(--bg-surface)'}}
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip size={20} color="var(--text-light)" />
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt,.json"
          onChange={handleFileUpload} 
        />
        <input
          type="text"
          className="input-field"
          style={styles.input}
          placeholder="Type a message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />
        <button type="submit" className="btn-primary" style={styles.sendButton}>
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
  },
  header: {
    padding: '15px 20px',
    borderBottom: '1px solid var(--glass-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: 'rgba(188, 19, 254, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    flexShrink: 0,
  },
  messageList: {
    flex: 1,
    padding: '20px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  messageWrapper: {
    display: 'flex',
    width: '100%',
  },
  messageBubble: {
    padding: '12px 16px',
    borderRadius: '16px',
    maxWidth: '70%',
    wordBreak: 'break-word',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  senderName: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: '4px',
    fontWeight: 'bold',
  },
  imageAttachment: {
    maxWidth: '100%',
    maxHeight: '200px',
    borderRadius: '8px',
  },
  fileLink: {
    textDecoration: 'none',
    fontWeight: '500',
  },
  inputArea: {
    padding: '15px 20px',
    borderTop: '1px solid var(--glass-border)',
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  input: {
    flex: 1,
  },
  sendButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 20px',
    height: '46px',
  },
  iconButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 12px',
    height: '46px',
    border: '1px solid var(--glass-border)',
  }
};
