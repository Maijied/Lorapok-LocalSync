import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/CallContext';
import { getMessagesByChatId, saveMessage } from '../utils/db';
import { Send, Paperclip, Phone, Video, ArrowLeft, UserPlus, Check, CheckCheck } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { getGroups } from '../utils/db';
import TypingIndicator from './TypingIndicator';
import MediaViewer from './MediaViewer';
import LinkPreview from './LinkPreview';
import { getBackendUrlSync } from '../utils/api';

export default function ChatWindow({ selectedUser, onBack }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { startCall } = useCall();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [showInviteMenu, setShowInviteMenu] = useState(false);
  const [myGroups, setMyGroups] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!selectedUser || !socket) return;

    // Load local messages
    const loadMessages = async () => {
      const chatId = [user.id, selectedUser.id].sort().join('_');
      const localMessages = await getMessagesByChatId(chatId);
      setMessages(localMessages);
      scrollToBottom();
    };
    
    loadMessages();

    // Listen for incoming messages
    const handlePrivateMessage = async (data) => {
      const isForCurrentChat = data.from === selectedUser.id || data.to === selectedUser.id;
      
      if (isForCurrentChat) {
        setMessages(prev => [...prev, data]);
        await saveMessage(data);
        scrollToBottom();
      } else {
        await saveMessage(data);
      }
    };

    socket.on('private_message', handlePrivateMessage);

    const handleInvite = async (data) => {
       if (data.from.id === selectedUser.id) {
          const inviteMsg = {
             id: uuidv4(),
             from: data.from.id,
             text: `INVITED YOU TO JOIN: ${data.group.name}`,
             type: 'invite',
             group: data.group,
             timestamp: Date.now()
          };
          setMessages(prev => [...prev, inviteMsg]);
          scrollToBottom();
       }
    };
    socket.on('group_invite', handleInvite);
    const handleTypingStart = (data) => {
      if (data.userId === selectedUser.id) setIsTyping(true);
      scrollToBottom();
    };

    const handleTypingStop = (data) => {
      if (data.userId === selectedUser.id) setIsTyping(false);
    };

    const handleMessageStatus = (data) => {
      setMessages(prev => prev.map(m => 
        m.id === data.messageId ? { ...m, status: data.status } : m
      ));
    };

    socket.on('typing_start', handleTypingStart);
    socket.on('typing_stop', handleTypingStop);
    socket.on('message_status_update', handleMessageStatus);

    // Send read receipts for unseen messages
    messages.forEach(msg => {
      if (msg.from === selectedUser.id && msg.status !== 'seen') {
        socket.emit('message_read', { messageId: msg.id, from: msg.from });
      }
    });

    // Load my groups for invitation menu
    getGroups().then(setMyGroups);

    return () => {
      socket.off('private_message', handlePrivateMessage);
      socket.off('group_invite', handleInvite);
      socket.off('typing_start', handleTypingStart);
      socket.off('typing_stop', handleTypingStop);
      socket.off('message_status_update', handleMessageStatus);
    };
  }, [selectedUser, socket, user.id]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const sendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const chatId = [user.id, selectedUser.id].sort().join('_');
    const newMsg = {
      id: uuidv4(),
      chatId,
      from: user.id,
      to: selectedUser.id,
      text: inputText,
      type: 'text',
      status: 'sent',
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, newMsg]);
    await saveMessage(newMsg);
    socket.emit('private_message', newMsg);
    
    
    setInputText('');
    socket.emit('typing_stop', { to: selectedUser.id });
    scrollToBottom();
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    
    // Typing indicator logic
    socket.emit('typing_start', { to: selectedUser.id });
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing_stop', { to: selectedUser.id });
    }, 2000);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Use FormData for file upload to backend
    const formData = new FormData();
    formData.append('file', file);
    
    setUploadProgress(1); // Start progress
    
    try {
      const baseUrl = getBackendUrlSync();
      
      const response = await fetch(`${baseUrl}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      setUploadProgress(0); // Reset progress
      
      if (data.url) {
        const chatId = [user.id, selectedUser.id].sort().join('_');
        
        let type = 'file';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('video/')) type = 'video';
        
        // Use full URL to backend for the file
        const fullUrl = `${baseUrl}${data.url}`;
        
        const newMsg = {
          id: uuidv4(),
          chatId,
          from: user.id,
          to: selectedUser.id,
          text: data.filename,
          fileData: fullUrl,
          type: type,
          status: 'sent',
          timestamp: Date.now(),
        };

        setMessages(prev => [...prev, newMsg]);
        await saveMessage(newMsg);
        socket.emit('private_message', newMsg);
        scrollToBottom();
      }
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadProgress(0);
    }
    
    e.target.value = null; // reset
  };

  const renderMessageTextWithLinks = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, index) => {
      if (part.match(urlRegex)) {
        return <a key={index} href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: 'underline' }}>{part}</a>;
      }
      return part;
    });
  };

  const sendInvite = (group) => {
     socket.emit('send_group_invite', { toUserId: selectedUser.id, group });
     setShowInviteMenu(false);
     const msg = { id: uuidv4(), from: user.id, text: `Sent invite for group: ${group.name}`, type: 'system', timestamp: Date.now() };
     setMessages(prev => [...prev, msg]);
  };

  const acceptInvite = (group) => {
     socket.emit('join_group', group.id);
     // In a real app, we'd save the group to DB here too
     const msg = { id: uuidv4(), from: user.id, text: `You joined ${group.name}`, type: 'system', timestamp: Date.now() };
     setMessages(prev => [...prev, msg]);
  };

  if (!selectedUser) {
    return (
      <div style={styles.emptyState}>
        <h3>Select a user to start chatting</h3>
      </div>
    );
  }


  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerInfo}>
          <button className="mobile-back-btn" onClick={onBack}>
            <ArrowLeft size={24} />
          </button>
          <div style={styles.avatarCircle}>
             <img src={selectedUser.dp} alt="avatar" style={styles.avatarImg} />
          </div>
          <h3>{selectedUser.name}</h3>
        </div>
        <div style={styles.headerActions}>
          <div style={{position: 'relative'}}>
            <button style={styles.actionIconButton} onClick={() => setShowInviteMenu(!showInviteMenu)}>
              <UserPlus size={20} color="var(--text-light)" />
            </button>
            {showInviteMenu && (
              <div className="glass-panel" style={styles.inviteMenu}>
                <p style={{fontSize: '12px', marginBottom: '8px', opacity: 0.7}}>Invite to Group:</p>
                {myGroups.map(g => (
                  <div key={g.id} style={styles.inviteItem} onClick={() => sendInvite(g)}>
                    {g.name}
                  </div>
                ))}
                {myGroups.length === 0 && <p style={{fontSize: '12px'}}>No groups yet</p>}
              </div>
            )}
          </div>
          <button style={styles.actionIconButton} onClick={() => startCall(selectedUser, false)}>
            <Phone size={20} color="var(--text-light)" />
          </button>
          <button style={styles.actionIconButton} onClick={() => startCall(selectedUser, true)}>
            <Video size={20} color="var(--text-light)" />
          </button>
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
                {msg.type === 'image' ? (
                  <div onClick={() => setSelectedMedia({ url: msg.fileData, name: msg.text, type: 'image' })} style={{cursor: 'pointer'}}>
                    <img src={msg.fileData} alt="attachment" style={styles.imageAttachment} />
                  </div>
                ) : msg.type === 'video' ? (
                  <div onClick={() => setSelectedMedia({ url: msg.fileData, name: msg.text, type: 'video' })} style={{cursor: 'pointer'}}>
                    <video src={msg.fileData} style={styles.imageAttachment} />
                  </div>
                ) : msg.type === 'file' ? (
                  <a href={msg.fileData} download={msg.text} style={styles.fileLink}>
                    📄 {msg.text}
                  </a>
                ) : msg.type === 'invite' ? (
                  <div style={styles.inviteBubble}>
                     <p>{msg.text}</p>
                     <button className="btn-primary" style={styles.miniBtn} onClick={() => acceptInvite(msg.group)}>Accept</button>
                  </div>
                ) : (
                  <span style={{ fontStyle: msg.type === 'system' ? 'italic' : 'normal', opacity: msg.type === 'system' ? 0.7 : 1 }}>
                    {renderMessageTextWithLinks(msg.text)}
                    {msg.type === 'text' && msg.text.match(/(https?:\/\/[^\s]+)/g) && (
                       <LinkPreview url={msg.text.match(/(https?:\/\/[^\s]+)/g)[0]} />
                    )}
                  </span>
                )}
                {isMine && msg.type !== 'system' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px', opacity: 0.7 }}>
                    {msg.status === 'seen' ? (
                      <CheckCheck size={14} color="#4ade80" /> // Green check for seen
                    ) : msg.status === 'delivered' ? (
                      <CheckCheck size={14} color="#94a3b8" /> // Gray double check for delivered
                    ) : (
                      <Check size={14} color="#94a3b8" /> // Single gray check for sent
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {isTyping && (
          <div style={{...styles.messageWrapper, justifyContent: 'flex-start'}}>
            <TypingIndicator />
          </div>
        )}
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
          onChange={handleInputChange}
        />
        <button type="submit" className="btn-primary" style={styles.sendButton}>
          <Send size={20} />
        </button>
      </form>

      {selectedMedia && (
        <MediaViewer 
          fileUrl={selectedMedia.url} 
          fileName={selectedMedia.name} 
          type={selectedMedia.type} 
          onClose={() => setSelectedMedia(null)} 
        />
      )}
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
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  headerActions: {
    display: 'flex',
    gap: '12px',
  },
  actionIconButton: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--glass-border)',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  avatarCircle: {
    width: '40px',
    height: '40px',
    borderRadius: '4px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    border: '1px solid var(--primary-color)',
    boxShadow: '0 0 10px rgba(0, 243, 255, 0.2)',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  inviteMenu: {
    position: 'absolute',
    top: '50px',
    right: 0,
    width: '200px',
    zIndex: 100,
    padding: '10px',
    textAlign: 'left',
  },
  inviteItem: {
    padding: '8px',
    cursor: 'pointer',
    borderRadius: '4px',
    transition: 'background 0.2s',
    fontSize: '14px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  inviteBubble: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  miniBtn: {
    padding: '4px 12px',
    fontSize: '12px',
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
