import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, CheckCheck, Clock3, Eye, Paperclip, Phone, Send, UserPlus, Video } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/CallContext';
import { useSocket } from '../context/SocketContext';
import { getGroups, getMessagesByChatId, saveMessage, updateMessageStatus } from '../utils/db';
import ConnectionBanner from './ConnectionBanner';
import MediaViewer from './MediaViewer';
import TypingIndicator from './TypingIndicator';
import { renderMessageText } from '../utils/messageFormatter';

const TYPING_IDLE_MS = 1500;

const createChatId = (userA, userB) => [userA, userB].sort().join('_');

const formatStatusTitle = (message) => {
  const pieces = [`Status: ${message.status || 'pending'}`];
  if (message.deliveredAt) {
    pieces.push(`Delivered: ${new Date(message.deliveredAt).toLocaleString()}`);
  }
  if (message.seenAt) {
    pieces.push(`Seen: ${new Date(message.seenAt).toLocaleString()}`);
  }
  return pieces.join('\n');
};

const MessageStatus = ({ message }) => {
  const commonProps = {
    size: 14,
    strokeWidth: 2.4,
    title: formatStatusTitle(message),
  };

  if (message.status === 'seen') {
    return <Eye {...commonProps} color="#60a5fa" />;
  }
  if (message.status === 'delivered') {
    return <CheckCheck {...commonProps} color="var(--primary-color)" />;
  }
  if (message.status === 'sent') {
    return <Check {...commonProps} color="rgba(255,255,255,0.7)" />;
  }
  return <Clock3 {...commonProps} color="rgba(255,255,255,0.6)" />;
};

export default function ChatWindow({ selectedUser, onBack }) {
  const { user } = useAuth();
  const { socket, connectionStatus, connectionError, isConnected } = useSocket();
  const { startCall } = useCall();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [showInviteMenu, setShowInviteMenu] = useState(false);
  const [myGroups, setMyGroups] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const [activeMedia, setActiveMedia] = useState(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const chatId = selectedUser ? createChatId(user.id, selectedUser.id) : null;

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
  };

  const emitReadReceipts = useCallback((items) => {
    if (!socket || !selectedUser) {
      return;
    }

    items
      .filter((message) => message.from === selectedUser.id && message.status !== 'seen')
      .forEach((message) => {
        socket.emit('message_read', {
          messageId: message.id,
          from: message.from,
        });
      });
  }, [selectedUser, socket]);

  useEffect(() => {
    if (!selectedUser || !chatId) {
      return undefined;
    }

    let active = true;

    const hydrate = async () => {
      const localMessages = await getMessagesByChatId(chatId);
      if (!active) {
        return;
      }

      setMessages(localMessages);
      emitReadReceipts(localMessages);
      scrollToBottom();
    };

    hydrate();
    getGroups().then(setMyGroups);

    return () => {
      active = false;
    };
  }, [chatId, emitReadReceipts, selectedUser]);

  useEffect(() => {
    if (!socket || !selectedUser || !chatId) {
      return undefined;
    }

    socket.emit('sync_private_history', { withUserId: selectedUser.id });

    const handleHistory = async (payload) => {
      if (payload.chatId !== chatId) {
        return;
      }

      const nextMessages = [];
      for (const message of payload.messages || []) {
        const saved = await saveMessage(message);
        nextMessages.push(saved);
      }
      setMessages(nextMessages);
      emitReadReceipts(nextMessages);
      scrollToBottom();
    };

    const handlePrivateMessage = async (message) => {
      const belongsToChat = message.chatId === chatId;
      const saved = await saveMessage(message);

      if (belongsToChat) {
        setMessages((current) => {
          const deduped = current.filter((entry) => entry.id !== saved.id);
          return [...deduped, saved].sort((a, b) => a.timestamp - b.timestamp);
        });
        scrollToBottom();

        if (message.from === selectedUser.id) {
          socket.emit('message_read', {
            messageId: message.id,
            from: message.from,
          });
        }
      }
    };

    const handleDelivered = async (payload) => {
      const saved = await updateMessageStatus(payload.messageId, {
        status: payload.status,
        deliveredAt: payload.status === 'delivered' ? payload.timestamp : undefined,
      });
      if (!saved || saved.chatId !== chatId) {
        return;
      }

      setMessages((current) => current.map((entry) => (entry.id === saved.id ? saved : entry)));
    };

    const handleRead = async (payload) => {
      const saved = await updateMessageStatus(payload.messageId, {
        status: payload.status,
        seenAt: payload.timestamp,
      });
      if (!saved || saved.chatId !== chatId) {
        return;
      }

      setMessages((current) => current.map((entry) => (entry.id === saved.id ? saved : entry)));
    };

    const handleTyping = (payload) => {
      if (payload.from === selectedUser.id && payload.to === user.id) {
        setTypingUser(payload.fromName || selectedUser.name);
      }
    };

    const handleStoppedTyping = (payload) => {
      if (payload.from === selectedUser.id && payload.to === user.id) {
        setTypingUser(null);
      }
    };

    const handleInvite = (payload) => {
      if (payload.from.id !== selectedUser.id) {
        return;
      }

      const invite = {
        id: uuidv4(),
        chatId,
        from: payload.from.id,
        to: user.id,
        text: `INVITED YOU TO JOIN: ${payload.group.name}`,
        type: 'invite',
        group: payload.group,
        timestamp: Date.now(),
        status: 'seen',
      };

      setMessages((current) => [...current, invite]);
      scrollToBottom();
    };

    socket.on('sync_private_history', handleHistory);
    socket.on('private_message', handlePrivateMessage);
    socket.on('message_delivered', handleDelivered);
    socket.on('message_read', handleRead);
    socket.on('user_typing', handleTyping);
    socket.on('user_stopped_typing', handleStoppedTyping);
    socket.on('group_invite', handleInvite);

    return () => {
      socket.emit('user_stopped_typing', { to: selectedUser.id });
      socket.off('sync_private_history', handleHistory);
      socket.off('private_message', handlePrivateMessage);
      socket.off('message_delivered', handleDelivered);
      socket.off('message_read', handleRead);
      socket.off('user_typing', handleTyping);
      socket.off('user_stopped_typing', handleStoppedTyping);
      socket.off('group_invite', handleInvite);
    };
  }, [chatId, emitReadReceipts, selectedUser, socket, user.id]);

  const emitTyping = (value) => {
    if (!socket || !selectedUser || !isConnected) {
      return;
    }

    if (value.trim()) {
      socket.emit('user_typing', { to: selectedUser.id });
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = window.setTimeout(() => {
        socket.emit('user_stopped_typing', { to: selectedUser.id });
      }, TYPING_IDLE_MS);
    } else {
      socket.emit('user_stopped_typing', { to: selectedUser.id });
      window.clearTimeout(typingTimeoutRef.current);
    }
  };

  const sendMessage = async (event) => {
    event?.preventDefault();
    if (!inputText.trim() || !socket || !selectedUser) {
      return;
    }

    const message = {
      id: uuidv4(),
      chatId,
      from: user.id,
      to: selectedUser.id,
      text: inputText.trim(),
      type: 'text',
      timestamp: Date.now(),
      status: 'pending',
    };

    const saved = await saveMessage(message);
    setMessages((current) => [...current, saved]);
    socket.emit('private_message', message);
    socket.emit('user_stopped_typing', { to: selectedUser.id });
    window.clearTimeout(typingTimeoutRef.current);
    setInputText('');
    scrollToBottom();
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file || !socket || !selectedUser) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (loadEvent) => {
      const message = {
        id: uuidv4(),
        chatId,
        from: user.id,
        to: selectedUser.id,
        text: file.name,
        fileData: loadEvent.target?.result,
        type: file.type.startsWith('image/') ? 'image' : 'file',
        timestamp: Date.now(),
        status: 'pending',
      };

      const saved = await saveMessage(message);
      setMessages((current) => [...current, saved]);
      socket.emit('private_message', message);
      scrollToBottom();
    };

    reader.readAsDataURL(file);
    event.target.value = null;
  };

  const sendInvite = (group) => {
    socket.emit('send_group_invite', { toUserId: selectedUser.id, group });
    setShowInviteMenu(false);
  };

  const acceptInvite = (group) => {
    socket.emit('join_group', group.id);
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
      <MediaViewer media={activeMedia} onClose={() => setActiveMedia(null)} />
      <ConnectionBanner status={connectionStatus} error={connectionError} />

      <div style={styles.header}>
        <div style={styles.headerInfo}>
          <button className="mobile-back-btn" onClick={onBack}>
            <ArrowLeft size={24} />
          </button>
          <div style={styles.avatarCircle}>
            <img src={selectedUser.dp} alt="avatar" style={styles.avatarImg} />
          </div>
          <div>
            <h3>{selectedUser.name}</h3>
            <p style={styles.headerSubText}>
              {connectionStatus === 'connected' ? 'Live chat synced' : 'Waiting for reconnection'}
            </p>
          </div>
        </div>

        <div style={styles.headerActions}>
          <div style={{ position: 'relative' }}>
            <button style={styles.actionIconButton} onClick={() => setShowInviteMenu((open) => !open)}>
              <UserPlus size={20} color="var(--text-light)" />
            </button>
            {showInviteMenu && (
              <div className="glass-panel" style={styles.inviteMenu}>
                <p style={styles.inviteLabel}>Invite to Group:</p>
                {myGroups.map((group) => (
                  <div key={group.id} style={styles.inviteItem} onClick={() => sendInvite(group)}>
                    {group.name}
                  </div>
                ))}
                {myGroups.length === 0 && <p style={styles.inviteEmpty}>No groups yet</p>}
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
                ) : message.type === 'invite' ? (
                  <div style={styles.inviteBubble}>
                    <p>{message.text}</p>
                    <button className="btn-primary" style={styles.miniBtn} onClick={() => acceptInvite(message.group)}>
                      Accept
                    </button>
                  </div>
                ) : (
                  <span style={{ opacity: message.type === 'system' ? 0.72 : 1 }}>{renderMessageText(message.text)}</span>
                )}

                <div style={styles.metaRow}>
                  <span style={styles.timeText}>{new Date(message.timestamp).toLocaleTimeString()}</span>
                  {isMine && <MessageStatus message={message} />}
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
          placeholder="Type a message..."
          value={inputText}
          onChange={(event) => {
            setInputText(event.target.value);
            emitTyping(event.target.value);
          }}
        />
        <button type="submit" className="btn-primary" style={styles.sendButton} disabled={!isConnected && !inputText.trim()}>
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
  emptyState: {
    display: 'grid',
    placeItems: 'center',
    height: '100%',
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
  headerSubText: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    marginTop: '4px',
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
  inviteLabel: {
    fontSize: '12px',
    marginBottom: '8px',
    opacity: 0.7,
  },
  inviteItem: {
    padding: '8px',
    cursor: 'pointer',
    borderRadius: '4px',
    fontSize: '14px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  inviteEmpty: {
    fontSize: '12px',
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
