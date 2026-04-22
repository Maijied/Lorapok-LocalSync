import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { getGroups, saveGroup } from '../utils/db';
import ChatWindow from '../components/ChatWindow';
import GroupChatWindow from '../components/GroupChatWindow';
import { v4 as uuidv4 } from 'uuid';

export default function Dashboard() {
  const { user } = useAuth();
  const { socket, onlineUsers } = useSocket();
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  
  const [groups, setGroups] = useState([]);
  const [publicGroups, setPublicGroups] = useState([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isJoiningWithKey, setIsJoiningWithKey] = useState(false);
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

    const handleGroupCreated = async (groupData) => {
      // Check if we already have this group locally
      setGroups(prev => {
        if (!prev.find(g => g.id === groupData.id)) {
          saveGroup(groupData);
          return [...prev, groupData];
        }
        return prev;
      });
      socket.emit('join_group', groupData.id);
    };

    const handlePublicGroupsUpdate = (pgroups) => {
      setPublicGroups(pgroups);
    };

    socket.on('group_created', handleGroupCreated);
    socket.on('public_groups_update', handlePublicGroupsUpdate);

    return () => {
      socket.off('group_created', handleGroupCreated);
      socket.off('public_groups_update', handlePublicGroupsUpdate);
    };
  }, [socket]);

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
      <div className={`glass-panel sidebar ${selectedUser || selectedGroup ? 'hidden-mobile' : ''}`} style={styles.sidebar}>
        <div style={styles.header}>
          <h2>Chats</h2>
        </div>
        
        <div style={styles.userList}>
          {/* Groups Section */}
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
            <h3 style={styles.sectionTitle}>Groups</h3>
            <div style={{display: 'flex', gap: '8px'}}>
              <button 
                className="btn-primary" 
                style={{...styles.smallBtn, backgroundColor: 'var(--bg-surface)'}} 
                onClick={() => setIsJoiningWithKey(!isJoiningWithKey)}
              >
                Key
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
                Make Public (Anyone can join)
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
              style={{
                ...styles.userItem,
                backgroundColor: selectedGroup?.id === g.id ? 'rgba(99, 102, 241, 0.2)' : 'transparent'
              }}
              onClick={() => { setSelectedGroup(g); setSelectedUser(null); }}
            >
              <div style={styles.avatarItemMini}>G</div>
              <span>{g.name}</span>
            </div>
          ))}

          {/* Public Groups Not Joined */}
          {publicGroups.filter(pg => !groups.find(g => g.id === pg.id)).length > 0 && (
            <>
              <h3 style={{...styles.sectionTitle, marginTop: '16px'}}>Discover Public Groups</h3>
              {publicGroups.filter(pg => !groups.find(g => g.id === pg.id)).map(pg => (
                <div key={pg.id} style={styles.userItem}>
                  <div style={{...styles.avatarItemMini, backgroundColor: '#64748b'}}>P</div>
                  <span style={{flex: 1}}>{pg.name}</span>
                  <button 
                    className="btn-primary" 
                    style={{...styles.smallBtn, fontSize: '0.8rem', padding: '4px 8px'}} 
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
          <h3 style={styles.sectionTitle}>Online on Router</h3>
          {onlineUsers.length === 0 ? (
            <p style={styles.noUsers}>No one else is online right now.</p>
          ) : (
            onlineUsers.map(u => (
              <div 
                key={u.id} 
                style={{
                  ...styles.userItem,
                  backgroundColor: selectedUser?.id === u.id ? 'rgba(99, 102, 241, 0.2)' : 'transparent'
                }}
                onClick={() => { setSelectedUser(u); setSelectedGroup(null); }}
              >
                <div style={styles.avatarCircle}>
                  <img src={u.dp} alt="avatar" style={styles.avatarImg} />
                </div>
                <span>{u.name}</span>
                <span style={styles.onlineIndicator}></span>
              </div>
            ))
          )}
        </div>
        
        <div style={styles.profileSection}>
          <div style={styles.avatarCircle}>
             <img src={user.dp} alt="my-avatar" style={styles.avatarImg} />
          </div>
          <span>{user.name} (You)</span>
        </div>
      </div>
      
      <div className={`glass-panel main-content ${!(selectedUser || selectedGroup) ? 'hidden-mobile' : ''}`} style={styles.mainContent}>
        {selectedGroup ? (
          <GroupChatWindow selectedGroup={selectedGroup} onBack={() => setSelectedGroup(null)} />
        ) : selectedUser ? (
          <ChatWindow selectedUser={selectedUser} onBack={() => setSelectedUser(null)} />
        ) : (
          <div style={styles.emptyState}>
            <h3>Select a user or group to start chatting</h3>
            <p>End-to-end local network communication</p>
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
    padding: '20px',
    gap: '20px',
    background: 'linear-gradient(135deg, var(--bg-dark) 0%, #0f172a 100%)',
  },
  sidebar: {
    width: '320px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '20px',
    borderBottom: '1px solid var(--glass-border)',
  },
  userList: {
    flex: 1,
    padding: '20px',
    overflowY: 'auto',
  },
  sectionTitle: {
    fontSize: '0.875rem',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    color: 'var(--text-muted)',
    margin: 0,
  },
  smallBtn: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '1rem',
    lineHeight: 1,
  },
  createGroupForm: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '16px',
    border: '1px solid var(--glass-border)',
  },
  memberSelectScroll: {
    maxHeight: '100px',
    overflowY: 'auto',
    marginBottom: '8px',
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
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background 0.2s',
    marginBottom: '8px',
    position: 'relative',
  },
  avatarCircle: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: 'var(--bg-surface)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: '12px',
    overflow: 'hidden',
    border: '2px solid var(--primary-color)',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  avatarItemMini: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    backgroundColor: 'var(--primary-hover)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    marginRight: '12px',
  },
  onlineIndicator: {
    width: '10px',
    height: '10px',
    backgroundColor: '#10b981',
    borderRadius: '50%',
    position: 'absolute',
    right: '16px',
  },
  noUsers: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    fontStyle: 'italic',
    marginTop: '8px',
  },
  profileSection: {
    padding: '20px',
    borderTop: '1px solid var(--glass-border)',
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emptyState: {
    textAlign: 'center',
    color: 'var(--text-muted)',
  }
};
