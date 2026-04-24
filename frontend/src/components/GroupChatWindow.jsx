import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { getMessagesByChatId, saveMessage } from '../utils/db';
import { Send, Paperclip, Users, ArrowLeft } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import LinkPreview from './LinkPreview';

export default function GroupChatWindow({ selectedGroup, onBack }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
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
      if (data.chatId === selectedGroup.id) {
        setMessages(prev => [...prev, data]);
        await saveMessage(data);
        scrollToBottom();
      } else {
        await saveMessage(data);
      }
    };

    socket.on('group_message', handleGroupMessage);

    return () => {
      socket.off('group_message', handleGroupMessage);
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
      chatId: selectedGroup.id, // Group ID is the chat ID
      groupId: selectedGroup.id, // For backend routing
      from: user.id,
      fromName: user.name, // To show sender's name in group chat
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

    try {
      const host = window.location.hostname;
      const baseUrl = `http://${host}:4000`;
      
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${baseUrl}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
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
    } catch (error) {
      console.error('Group upload failed:', error);
    }
    
    e.target.value = null; // reset
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
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
               <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                 {selectedGroup.members.length} members
               </p>
               <span style={{ fontSize: '0.7rem', backgroundColor: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', color: 'var(--primary-color)', fontWeight: 'bold' }}>
                  KEY: {selectedGroup.secretKey}
               </span>
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
                    <video src={msg.fileData} style={styles.imageAttachment} />
                  </div>
                ) : msg.type === 'file' ? (
                  <a href={msg.fileData} download={msg.text} style={styles.fileLink}>
                    📄 {msg.text}
                  </a>
                ) : (
                  <div>
                    {msg.text}
                    {msg.text.match(/(https?:\/\/[^\s]+)/g) && (
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
    padding: '20px',
    borderBottom: '1px solid var(--glass-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: 'var(--primary-hover)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
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
    color: 'white',
    textDecoration: 'underline',
  },
  inputArea: {
    padding: '20px',
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
