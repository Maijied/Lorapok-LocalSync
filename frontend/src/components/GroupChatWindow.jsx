import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, CheckCheck, Clock3, Paperclip, Send, Users } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { getMessagesByChatId, saveMessage, updateMessageStatus } from '../utils/db';
import ConnectionBanner from './ConnectionBanner';
import MediaViewer from './MediaViewer';
import TypingIndicator from './TypingIndicator';
import { renderMessageText } from '../utils/messageFormatter';

const TYPING_IDLE_MS = 1500;

const GroupStatusIcon = ({ status }) => {
  if (status === 'delivered') {
    return <CheckCheck size={14} color="var(--primary-color)" />;
  }
  if (status === 'sent') {
    return <Check size={14} color="rgba(255,255,255,0.7)" />;
  }
  return <Clock3 size={14} color="rgba(255,255,255,0.6)" />;
};

export default function GroupChatWindow({ selectedGroup, onBack }) {
  const { user } = useAuth();
  const { socket, connectionStatus, connectionError, isConnected } = useSocket();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [typingUser, setTypingUser] = useState(null);
  const [activeMedia, setActiveMedia] = useState(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
  };

  useEffect(() => {
    if (!selectedGroup?.id) {
      return undefined;
    }

    let active = true;
    const hydrate = async () => {
      const localMessages = await getMessagesByChatId(selectedGroup.id);
      if (!active) {
        return;
      }

      setMessages(localMessages);
      scrollToBottom();
    };

    hydrate();

    return () => {
      active = false;
    };
  }, [selectedGroup?.id]);

  useEffect(() => {
    if (!socket || !selectedGroup?.id) {
      return undefined;
    }

    socket.emit('sync_group_history', { groupId: selectedGroup.id });

    const handleHistory = async (payload) => {
      if (payload.groupId !== selectedGroup.id) {
        return;
      }

      const nextMessages = [];
      for (const message of payload.messages || []) {
        const saved = await saveMessage(message);
        nextMessages.push(saved);
      }
      setMessages(nextMessages);
      scrollToBottom();
    };

    const handleGroupMessage = async (message) => {
      if (message.groupId !== selectedGroup.id) {
        await saveMessage(message);
        return;
      }

      const saved = await saveMessage(message);
      setMessages((current) => {
        const deduped = current.filter((entry) => entry.id !== saved.id);
        return [...deduped, saved].sort((a, b) => a.timestamp - b.timestamp);
      });
      scrollToBottom();
    };

    const handleDelivered = async (payload) => {
      const saved = await updateMessageStatus(payload.messageId, {
        status: payload.status,
        deliveredAt: payload.timestamp,
      });
      if (!saved || saved.groupId !== selectedGroup.id) {
        return;
      }

      setMessages((current) => current.map((entry) => (entry.id === saved.id ? saved : entry)));
    };

    const handleTyping = (payload) => {
      if (payload.groupId === selectedGroup.id && payload.from !== user.id) {
        setTypingUser(payload.fromName || 'Someone');
      }
    };

    const handleStoppedTyping = (payload) => {
      if (payload.groupId === selectedGroup.id && payload.from !== user.id) {
        setTypingUser(null);
      }
    };

    socket.on('sync_group_history', handleHistory);
    socket.on('group_message', handleGroupMessage);
    socket.on('message_delivered', handleDelivered);
    socket.on('user_typing', handleTyping);
    socket.on('user_stopped_typing', handleStoppedTyping);

    return () => {
      socket.emit('user_stopped_typing', { groupId: selectedGroup.id });
      socket.off('sync_group_history', handleHistory);
      socket.off('group_message', handleGroupMessage);
      socket.off('message_delivered', handleDelivered);
      socket.off('user_typing', handleTyping);
      socket.off('user_stopped_typing', handleStoppedTyping);
    };
  }, [socket, selectedGroup?.id, user.id]);

  const emitTyping = (value) => {
    if (!socket || !selectedGroup?.id || !isConnected) {
      return;
    }

    if (value.trim()) {
      socket.emit('user_typing', { groupId: selectedGroup.id });
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = window.setTimeout(() => {
        socket.emit('user_stopped_typing', { groupId: selectedGroup.id });
      }, TYPING_IDLE_MS);
    } else {
      socket.emit('user_stopped_typing', { groupId: selectedGroup.id });
      window.clearTimeout(typingTimeoutRef.current);
    }
  };

  const sendMessage = async (event) => {
    event?.preventDefault();
    if (!inputText.trim() || !selectedGroup?.id || !socket) {
      return;
    }

    const message = {
      id: uuidv4(),
      chatId: selectedGroup.id,
      groupId: selectedGroup.id,
      from: user.id,
      fromName: user.name,
      text: inputText.trim(),
      type: 'text',
      timestamp: Date.now(),
      status: 'pending',
    };

    const saved = await saveMessage(message);
    setMessages((current) => [...current, saved]);
    socket.emit('group_message', message);
    socket.emit('user_stopped_typing', { groupId: selectedGroup.id });
    window.clearTimeout(typingTimeoutRef.current);
    setInputText('');
    scrollToBottom();
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file || !selectedGroup?.id || !socket) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (loadEvent) => {
      const message = {
        id: uuidv4(),
        chatId: selectedGroup.id,
        groupId: selectedGroup.id,
        from: user.id,
        fromName: user.name,
        text: file.name,
        fileData: loadEvent.target?.result,
        type: file.type.startsWith('image/') ? 'image' : 'file',
        timestamp: Date.now(),
        status: 'pending',
      };

      const saved = await saveMessage(message);
      setMessages((current) => [...current, saved]);
      socket.emit('group_message', message);
      scrollToBottom();
    };

    reader.readAsDataURL(file);
    event.target.value = null;
  };

  if (!selectedGroup) {
    return null;
  }

  return (
    <div style={styles.container}>
      <MediaViewer media={activeMedia} onClose={() => setActiveMedia(null)} />
      <ConnectionBanner status={connectionStatus} error={connectionError} />

      <div style={styles.header}>
        <div style={styles.headerInfo}>
          <button className="mobile-back-btn" onClick={onBack}>
            <ArrowLeft size={24} />
          </button>
          <div style={styles.avatar}>
            <Users size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0 }}>{selectedGroup.name}</h3>
            <div style={styles.groupMeta}>
              <p style={styles.subtleText}>{selectedGroup.members.length} members</p>
              <span style={styles.secretKey}>KEY: {selectedGroup.secretKey}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.messageList}>
        {messages.map((message) => {
          const isMine = message.from === user.id;
          return (
            <div
              key={message.id}
              style={{
                ...styles.messageWrapper,
                justifyContent: isMine ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  ...styles.messageBubble,
                  backgroundColor: isMine ? 'var(--primary-color)' : 'var(--bg-surface)',
                  borderBottomRightRadius: isMine ? '4px' : '16px',
                  borderBottomLeftRadius: isMine ? '16px' : '4px',
                }}
              >
                {!isMine && <div style={styles.senderName}>{message.fromName || 'Member'}</div>}
                {message.type === 'image' ? (
                  <button
                    type="button"
                    style={styles.mediaButton}
                    onClick={() =>
                      setActiveMedia({
                        src: message.fileData,
                        type: 'image',
                        name: message.text,
                      })
                    }
                  >
                    <img src={message.fileData} alt="attachment" style={styles.imageAttachment} />
                  </button>
                ) : message.type === 'file' ? (
                  <button
                    type="button"
                    style={styles.filePreviewButton}
                    onClick={() =>
                      setActiveMedia({
                        src: message.fileData,
                        type: 'file',
                        name: message.text,
                      })
                    }
                  >
                    <span style={styles.fileLink}>File: {message.text}</span>
                  </button>
                ) : (
                  renderMessageText(message.text)
                )}

                <div style={styles.metaRow}>
                  <span style={styles.timeText}>{new Date(message.timestamp).toLocaleTimeString()}</span>
                  {isMine && <GroupStatusIcon status={message.status} />}
                </div>
              </div>
            </div>
          );
        })}

        <TypingIndicator label={typingUser ? `${typingUser} is typing` : ''} />
        <div ref={messagesEndRef} />
      </div>

      <form style={styles.inputArea} onSubmit={sendMessage}>
        <button
          type="button"
          className="btn-primary"
          style={{ ...styles.iconButton, backgroundColor: 'var(--bg-surface)' }}
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip size={20} color="var(--text-light)" />
        </button>
        <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileUpload} />
        <input
          type="text"
          className="input-field"
          style={styles.input}
          placeholder="Type a group message..."
          value={inputText}
          onChange={(event) => {
            setInputText(event.target.value);
            emitTyping(event.target.value);
          }}
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
    width: '100%',
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
  groupMeta: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  subtleText: {
    margin: 0,
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  secretKey: {
    fontSize: '0.7rem',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: '2px 6px',
    borderRadius: '4px',
    color: 'var(--primary-color)',
    fontWeight: 'bold',
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
  mediaButton: {
    border: 'none',
    background: 'transparent',
    padding: 0,
    cursor: 'pointer',
  },
  filePreviewButton: {
    border: 'none',
    background: 'transparent',
    padding: 0,
    cursor: 'pointer',
    textAlign: 'left',
  },
  fileLink: {
    color: 'white',
    textDecoration: 'underline',
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '6px',
    marginTop: '8px',
    fontSize: '0.74rem',
    opacity: 0.85,
  },
  timeText: {
    fontSize: '0.72rem',
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
  },
};
