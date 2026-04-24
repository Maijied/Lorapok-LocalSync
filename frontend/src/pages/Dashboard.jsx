import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { getGroups, saveGroup } from '../utils/db';
import ChatWindow from '../components/ChatWindow';
import GroupChatWindow from '../components/GroupChatWindow';
import Logo from '../components/Logo';
import { v4 as uuidv4 } from 'uuid';
import { LogOut, HelpCircle, Key, Users, Info, ArrowRight } from 'lucide-react';
import { formatAssetUrl } from '../utils/api';

export default function Dashboard() {
  const { user } = useAuth();
  const { socket, onlineUsers } = useSocket();
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  
  const [groups, setGroups] = useState([]);
  const [publicGroups, setPublicGroups] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({}); // { chatId -> count }
  
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isJoiningWithKey, setIsJoiningWithKey] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [joinKey, setJoinKey] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isPublicGroup, setIsPublicGroup] = useState(false);

  useEffect(() => {
    if (!socket) return;

    // Load local groups
    const loadGroups = async () => {
      const localGroups = await getGroups();
      setGroups(localGroups);
      // Re-join groups on socket
      localGroups.forEach(g => socket.emit('join_group', g.id));
    };
    loadGroups();

    const handleMessage = (msg) => {
      // Check if message is from someone not currently selected
      const isCurrentChat = (selectedUser && msg.from === selectedUser.id) || 
                          (selectedGroup && msg.groupId === selectedGroup.id);
      
      if (!isCurrentChat) {
        const chatId = msg.groupId || msg.from;
        setUnreadCounts(prev => ({
          ...prev,
          [chatId]: (prev[chatId] || 0) + 1
        }));
      }
    };

    const handleGroupCreated = async (groupData) => {
      setGroups(prev => {
        const existing = prev.find(g => g.id === groupData.id);
        if (existing) {
          const updated = { ...existing, ...groupData };
          saveGroup(updated);
          return prev.map(g => g.id === groupData.id ? updated : g);
        } else {
          saveGroup(groupData);
          return [...prev, groupData];
        }
      });
      socket.emit('join_group', groupData.id);
    };

    const handlePublicGroupsUpdate = (pgroups) => {
      setPublicGroups(pgroups);
    };

    socket.on('private_message', handleMessage);
    socket.on('group_message', handleMessage);
    socket.on('group_created', handleGroupCreated);
    socket.on('public_groups_update', handlePublicGroupsUpdate);

    return () => {
      socket.off('private_message', handleMessage);
      socket.off('group_message', handleMessage);
      socket.off('group_created', handleGroupCreated);
      socket.off('public_groups_update', handlePublicGroupsUpdate);
    };
  }, [socket, selectedUser, selectedGroup]);

  // Clear unread count when chat is selected
  useEffect(() => {
    const activeId = selectedUser?.id || selectedGroup?.id;
    if (activeId && unreadCounts[activeId]) {
      setUnreadCounts(prev => {
        const next = { ...prev };
        delete next[activeId];
        return next;
      });
    }
  }, [selectedUser, selectedGroup]);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim() || (!isPublicGroup && selectedMembers.length === 0)) return;

    const newGroup = {
      id: uuidv4(),
      name: newGroupName,
      members: [user.id, ...selectedMembers],
      createdBy: user.id,
      isPublic: isPublicGroup
    };

    setGroups(prev => [...prev, newGroup]);
    await saveGroup(newGroup);
    socket.emit('create_group', newGroup);
    
    setIsCreatingGroup(false);
    setNewGroupName('');
    setSelectedMembers([]);
    setIsPublicGroup(false);
    setSelectedGroup(newGroup);
    setSelectedUser(null);
  };

  const toggleMemberSelection = (userId) => {
    setSelectedMembers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const joinPublicGroup = (groupId) => {
    socket.emit('join_public_group', { groupId, user });
  };

  const handleJoinWithKey = (e) => {
    e.preventDefault();
    if (!joinKey.trim()) return;
    socket.emit('join_group_with_key', joinKey.toUpperCase());
    setIsJoiningWithKey(false);
    setJoinKey('');
  };

  return (
    <div className="dashboard-container" style={styles.container}>
      {showHelp && (
        <div style={styles.modalOverlay} onClick={() => setShowHelp(false)}>
          <div className="glass-panel" style={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 style={{color: 'var(--primary-color)', marginBottom: '20px'}}>How to Use LocalSync</h2>
            <div style={styles.helpGrid}>
              <div style={styles.helpItem}>
                <Key size={24} color="var(--primary-color)" />
                <div>
                  <h4>Secret Keys</h4>
                  <p>Every group has a 6-digit key in the header. Use the <strong>Key</strong> button in the sidebar to join groups instantly.</p>
                </div>
              </div>
              <div style={styles.helpItem}>
                <Users size={24} color="var(--primary-color)" />
                <div>
                  <h4>Group Invites</h4>
                  <p>In a private chat, click the <strong>Invite</strong> icon to send a direct group invitation to your contact.</p>
                </div>
              </div>
              <div style={styles.helpItem}>
                <Info size={24} color="var(--primary-color)" />
                <div>
                  <h4>Mobile Connection</h4>
                  <p>To connect your phone, ensure it is on the same Wi-Fi and enter your PC's IP address followed by the port (e.g., <strong>http://192.168.0.219:5173</strong>).</p>
                </div>
              </div>
            </div>
            <button className="btn-primary" style={{width: '100%', marginTop: '20px'}} onClick={() => setShowHelp(false)}>Got it!</button>
          </div>
        </div>
      )}

      <div className={`glass-panel sidebar ${selectedUser || selectedGroup ? 'hidden-mobile' : ''}`} style={styles.sidebar}>
        <div style={styles.header}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
              <Logo size={32} />
              <h2 style={{margin: 0, fontSize: '1.2rem', fontWeight: 800, letterSpacing: '0.5px'}}>LocalSync</h2>
            </div>
            <HelpCircle size={20} style={{cursor: 'pointer', opacity: 0.7}} onClick={() => setShowHelp(true)} />
          </div>
        </div>
        
        <div style={styles.userList}>
          {/* Groups Section */}
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '0 8px'}}>
            <h3 style={styles.sectionTitle}>Groups</h3>
            <div style={{display: 'flex', gap: '8px'}}>
              <button 
                className="btn-primary" 
                style={{...styles.smallBtn, backgroundColor: 'rgba(255,255,255,0.05)', color: 'white'}} 
                onClick={() => setIsJoiningWithKey(!isJoiningWithKey)}
              >
                <Key size={14} />
              </button>
              <button 
                className="btn-primary" 
                style={styles.smallBtn} 
                onClick={() => setIsCreatingGroup(!isCreatingGroup)}
              >
                +
              </button>
            </div>
          </div>

          {isJoiningWithKey && (
            <form onSubmit={handleJoinWithKey} style={styles.createGroupForm}>
               <input 
                type="text" 
                className="input-field" 
                placeholder="6-Digit Secret Key" 
                value={joinKey}
                onChange={(e) => setJoinKey(e.target.value)}
                style={{marginBottom: '8px'}}
              />
              <button type="submit" className="btn-primary" style={{width: '100%', padding: '8px'}}>
                Join Group
              </button>
            </form>
          )}

          {isCreatingGroup && (
            <div style={styles.createGroupForm}>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Group Name" 
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                style={{marginBottom: '8px'}}
              />
              <label style={{display: 'flex', gap: '8px', cursor: 'pointer', marginBottom: '8px', fontSize: '0.9rem'}}>
                <input 
                  type="checkbox" 
                  checked={isPublicGroup} 
                  onChange={(e) => setIsPublicGroup(e.target.checked)}
                />
                Make Public
              </label>
              {!isPublicGroup && (
                <div style={styles.memberSelectScroll}>
                  <p style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>Select Members:</p>
                  {onlineUsers.map(u => (
                    <label key={u.id} style={{display: 'flex', gap: '8px', cursor: 'pointer', margin: '4px 0'}}>
                      <input 
                        type="checkbox" 
                        checked={selectedMembers.includes(u.id)} 
                        onChange={() => toggleMemberSelection(u.id)}
                      />
                      {u.name}
                    </label>
                  ))}
                </div>
              )}
              <button className="btn-primary" style={{width: '100%', padding: '8px'}} onClick={handleCreateGroup}>
                Create
              </button>
            </div>
          )}

          {/* My Groups */}
          {groups.map(g => (
            <div 
              key={g.id} 
              className={`chat-list-item ${selectedGroup?.id === g.id ? 'active' : ''}`}
              onClick={() => { setSelectedGroup(g); setSelectedUser(null); }}
            >
              <div style={styles.avatarItemMini}>G</div>
              <span style={{flex: 1}}>{g.name}</span>
              {unreadCounts[g.id] > 0 && (
                <span className="unread-badge">{unreadCounts[g.id]}</span>
              )}
            </div>
          ))}

          {/* Public Groups Not Joined */}
          {publicGroups.filter(pg => !groups.find(g => g.id === pg.id)).length > 0 && (
            <>
              <h3 style={{...styles.sectionTitle, marginTop: '16px', padding: '0 8px'}}>Public Groups</h3>
              {publicGroups.filter(pg => !groups.find(g => g.id === pg.id)).map(pg => (
                <div key={pg.id} className="chat-list-item">
                  <div style={{...styles.avatarItemMini, backgroundColor: '#64748b'}}>P</div>
                  <span style={{flex: 1}}>{pg.name}</span>
                  <button 
                    className="btn-primary" 
                    style={{...styles.smallBtn, fontSize: '0.7rem', padding: '4px 8px'}} 
                    onClick={() => joinPublicGroup(pg.id)}
                  >
                    Join
                  </button>
                </div>
              ))}
            </>
          )}

          <hr style={styles.divider} />

          {/* Online Users Section */}
          <h3 style={{...styles.sectionTitle, padding: '0 8px'}}>Online Users</h3>
          {onlineUsers.length === 0 ? (
            <p style={styles.noUsers}>No one else is online.</p>
          ) : (
            onlineUsers.map(u => (
              <div 
                key={u.id} 
                className={`chat-list-item ${selectedUser?.id === u.id ? 'active' : ''}`}
                onClick={() => { setSelectedUser(u); setSelectedGroup(null); }}
              >
                <div style={styles.avatarCircle}>
                  <img src={formatAssetUrl(u.dp)} alt="avatar" style={styles.avatarImg} />
                </div>
                <span style={{flex: 1}}>{u.name}</span>
                {unreadCounts[u.id] > 0 && (
                  <span className="unread-badge">{unreadCounts[u.id]}</span>
                )}
                <span style={styles.onlineIndicator}></span>
              </div>
            ))
          )}
        </div>
        
        <div style={styles.profileSection}>
          <div style={styles.avatarCircle}>
             <img src={formatAssetUrl(user.dp)} alt="my-avatar" style={styles.avatarImg} />
          </div>
          <div style={{display: 'flex', flexDirection: 'column'}}>
            <span style={{fontWeight: 700}}>{user.name}</span>
            <span style={{fontSize: '0.7rem', color: 'var(--primary-color)'}}>Online</span>
          </div>
        </div>
      </div>
      
      <div className={`glass-panel main-content ${!(selectedUser || selectedGroup) ? 'hidden-mobile' : ''}`} style={styles.mainContent}>
        {selectedGroup ? (
          <GroupChatWindow selectedGroup={selectedGroup} onBack={() => setSelectedGroup(null)} />
        ) : selectedUser ? (
          <ChatWindow selectedUser={selectedUser} onBack={() => setSelectedUser(null)} />
        ) : (
          <div style={styles.emptyState}>
            <div className="glass-panel" style={{padding: '50px 40px', borderRadius: '32px', textAlign: 'center', maxWidth: '400px'}}>
               <Logo size={100} style={{marginBottom: '24px'}} />
               <h3 style={{fontSize: '1.8rem', color: 'var(--primary-color)', marginBottom: '8px'}}>LocalSync</h3>
               <p style={{opacity: 0.8, fontSize: '0.9rem', fontWeight: 600}}>A Product of Lorapok</p>
               <p style={{opacity: 0.5, fontSize: '0.8rem', marginTop: '12px'}}>Secure encrypted communication for your local network</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    padding: '10px',
    gap: '10px',
    background: 'var(--bg-dark)',
  },
  sidebar: {
    width: '320px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    border: '1px solid rgba(0, 243, 255, 0.1)',
  },
  header: {
    padding: '20px',
    borderBottom: '1px solid var(--glass-border)',
    background: 'rgba(255,255,255,0.02)',
    textTransform: 'uppercase',
    letterSpacing: '2px',
  },
  userList: {
    flex: 1,
    padding: '15px',
    overflowY: 'auto',
  },
  sectionTitle: {
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    color: 'var(--primary-color)',
    margin: 0,
    fontWeight: '800',
  },
  smallBtn: {
    padding: '4px 8px',
    borderRadius: '2px',
    fontSize: '0.9rem',
    lineHeight: 1,
  },
  createGroupForm: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: '12px',
    borderRadius: '4px',
    marginBottom: '16px',
    border: '1px solid rgba(0, 243, 255, 0.2)',
  },
  memberSelectScroll: {
    maxHeight: '100px',
    overflowY: 'auto',
    marginBottom: '8px',
    padding: '8px',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  divider: {
    borderColor: 'var(--glass-border)',
    borderStyle: 'solid',
    borderWidth: '1px 0 0 0',
    margin: '16px 0',
  },
  userItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginBottom: '4px',
    position: 'relative',
    border: '1px solid transparent',
  },
  avatarCircle: {
    width: '40px',
    height: '40px',
    borderRadius: '4px',
    backgroundColor: 'var(--bg-surface)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: '12px',
    overflow: 'hidden',
    border: '1px solid rgba(0, 243, 255, 0.3)',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  avatarItemMini: {
    width: '40px',
    height: '40px',
    borderRadius: '4px',
    backgroundColor: 'rgba(188, 19, 254, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    marginRight: '12px',
    border: '1px solid var(--secondary-color)',
    color: 'var(--secondary-color)',
  },
  onlineIndicator: {
    width: '8px',
    height: '8px',
    backgroundColor: 'var(--primary-color)',
    borderRadius: '50%',
    position: 'absolute',
    right: '16px',
    boxShadow: '0 0 10px var(--primary-color)',
  },
  noUsers: {
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: '20px',
  },
  profileSection: {
    padding: '15px',
    borderTop: '1px solid var(--glass-border)',
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: '12px',
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    border: '1px solid rgba(0, 243, 255, 0.1)',
  },
  emptyState: {
    textAlign: 'center',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '2px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  modal: {
    maxWidth: '500px',
    width: '100%',
    padding: '40px',
  },
  helpGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  helpItem: {
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-start',
  }
};
