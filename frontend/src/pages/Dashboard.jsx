import React, { useEffect, useState } from 'react';
import { ArrowRight, HelpCircle, Info, Key, LogOut, Users } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { getGroups, saveGroup, saveGroups } from '../utils/db';
import { apiFetch } from '../utils/network';
import ChatWindow from '../components/ChatWindow';
import GroupChatWindow from '../components/GroupChatWindow';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { socket, onlineUsers, connectionStatus } = useSocket();
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groups, setGroups] = useState([]);
  const [publicGroups, setPublicGroups] = useState([]);
  const [showHelp, setShowHelp] = useState(false);
  const [runtimeInfo, setRuntimeInfo] = useState(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isJoiningWithKey, setIsJoiningWithKey] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [joinKey, setJoinKey] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isPublicGroup, setIsPublicGroup] = useState(false);

  useEffect(() => {
    let active = true;
    getGroups().then((localGroups) => {
      if (active) {
        setGroups(localGroups);
      }
    });

    apiFetch('/meta')
      .then((meta) => {
        if (active) {
          setRuntimeInfo(meta);
        }
      })
      .catch((error) => {
        console.error('Failed to load runtime info:', error);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const handleSessionReady = async (payload) => {
      setGroups(payload.groups || []);
      setPublicGroups(payload.publicGroups || []);
      await saveGroups(payload.groups || []);
    };

    const handleGroupCreated = async (group) => {
      await saveGroup(group);
      setGroups((current) => {
        if (current.some((entry) => entry.id === group.id)) {
          return current.map((entry) => (entry.id === group.id ? group : entry));
        }
        return [...current, group];
      });
    };

    const handlePublicGroupsUpdate = (nextGroups) => {
      setPublicGroups(nextGroups);
    };

    socket.on('session_ready', handleSessionReady);
    socket.on('group_created', handleGroupCreated);
    socket.on('public_groups_update', handlePublicGroupsUpdate);

    return () => {
      socket.off('session_ready', handleSessionReady);
      socket.off('group_created', handleGroupCreated);
      socket.off('public_groups_update', handlePublicGroupsUpdate);
    };
  }, [socket]);

  const handleCreateGroup = async (event) => {
    event.preventDefault();
    if (!newGroupName.trim() || (!isPublicGroup && selectedMembers.length === 0)) {
      return;
    }

    const group = {
      id: uuidv4(),
      name: newGroupName.trim(),
      members: [user.id, ...selectedMembers],
      createdBy: user.id,
      isPublic: isPublicGroup,
    };

    socket.emit('create_group', group);
    setIsCreatingGroup(false);
    setNewGroupName('');
    setSelectedMembers([]);
    setIsPublicGroup(false);
  };

  const joinPublicGroup = (groupId) => {
    socket.emit('join_public_group', { groupId });
  };

  const handleJoinWithKey = (event) => {
    event.preventDefault();
    if (!joinKey.trim()) {
      return;
    }

    socket.emit('join_group_with_key', joinKey.toUpperCase());
    setJoinKey('');
    setIsJoiningWithKey(false);
  };

  const toggleMemberSelection = (userId) => {
    setSelectedMembers((current) =>
      current.includes(userId) ? current.filter((entry) => entry !== userId) : [...current, userId]
    );
  };

  return (
    <div className="dashboard-container" style={styles.container}>
      {showHelp && (
        <div style={styles.modalOverlay} onClick={() => setShowHelp(false)}>
          <div className="glass-panel" style={styles.modal} onClick={(event) => event.stopPropagation()}>
            <h2 style={{ color: 'var(--primary-color)', marginBottom: '20px' }}>Lorapok Communicator Guide</h2>
            <div style={styles.helpGrid}>
              <div style={styles.helpItem}>
                <Key size={24} color="var(--primary-color)" />
                <div>
                  <h4>Secret Keys</h4>
                  <p>Every group has a six-character key in the header. Use the Key button in the sidebar to join instantly.</p>
                </div>
              </div>
              <div style={styles.helpItem}>
                <Users size={24} color="var(--primary-color)" />
                <div>
                  <h4>Reliable Sync</h4>
                  <p>Private and group messages are stored server-side, so offline users receive them after reconnecting.</p>
                </div>
              </div>
              <div style={styles.helpItem}>
                <Info size={24} color="var(--primary-color)" />
                <div>
                  <h4>Runtime Address</h4>
                  <p>
                    {runtimeInfo?.primaryUrl
                      ? `Current server address: ${runtimeInfo.primaryUrl}`
                      : 'Runtime information is loading from the server.'}
                  </p>
                </div>
              </div>
            </div>
            <button className="btn-primary" style={{ width: '100%', marginTop: '20px' }} onClick={() => setShowHelp(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      <div className={`glass-panel sidebar ${selectedUser || selectedGroup ? 'hidden-mobile' : ''}`} style={styles.sidebar}>
        <div style={styles.header}>
          <div style={styles.headerTop}>
            <div>
              <p style={styles.brandEyebrow}>Lorapok Communicator</p>
              <h2 style={{ margin: 0 }}>Chats</h2>
            </div>
            <div style={styles.headerActions}>
              <HelpCircle size={20} style={styles.headerIcon} onClick={() => setShowHelp(true)} />
              <LogOut size={20} style={styles.headerIcon} onClick={logout} />
            </div>
          </div>
          <p style={styles.connectionText}>
            {connectionStatus === 'connected'
              ? `Connected to ${runtimeInfo?.primaryUrl || 'server'}`
              : 'Disconnected from server'}
          </p>
        </div>

        <div style={styles.userList}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>Groups</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-primary" style={{ ...styles.smallBtn, backgroundColor: 'var(--bg-surface)' }} onClick={() => setIsJoiningWithKey((open) => !open)}>
                Key
              </button>
              <button className="btn-primary" style={styles.smallBtn} onClick={() => setIsCreatingGroup((open) => !open)}>
                +
              </button>
            </div>
          </div>

          {isJoiningWithKey && (
            <form onSubmit={handleJoinWithKey} style={styles.createGroupForm}>
              <input
                type="text"
                className="input-field"
                placeholder="6-character group key"
                value={joinKey}
                onChange={(event) => setJoinKey(event.target.value)}
                style={{ marginBottom: '8px' }}
              />
              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '8px' }}>
                Join Group
              </button>
            </form>
          )}

          {isCreatingGroup && (
            <form style={styles.createGroupForm} onSubmit={handleCreateGroup}>
              <input
                type="text"
                className="input-field"
                placeholder="Group Name"
                value={newGroupName}
                onChange={(event) => setNewGroupName(event.target.value)}
                style={{ marginBottom: '8px' }}
              />
              <label style={styles.checkboxRow}>
                <input type="checkbox" checked={isPublicGroup} onChange={(event) => setIsPublicGroup(event.target.checked)} />
                Make Public
              </label>
              {!isPublicGroup && (
                <div style={styles.memberSelectScroll}>
                  <p style={styles.memberPrompt}>Select Members:</p>
                  {onlineUsers.map((entry) => (
                    <label key={entry.id} style={styles.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(entry.id)}
                        onChange={() => toggleMemberSelection(entry.id)}
                      />
                      {entry.name}
                    </label>
                  ))}
                </div>
              )}
              <button className="btn-primary" style={{ width: '100%', padding: '8px' }} type="submit">
                Create Group
              </button>
            </form>
          )}

          {groups.map((group) => (
            <div
              key={group.id}
              style={{
                ...styles.userItem,
                backgroundColor: selectedGroup?.id === group.id ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
              }}
              onClick={() => {
                setSelectedGroup(group);
                setSelectedUser(null);
              }}
            >
              <div style={styles.avatarItemMini}>G</div>
              <span>{group.name}</span>
            </div>
          ))}

          {publicGroups.filter((group) => !groups.some((entry) => entry.id === group.id)).length > 0 && (
            <>
              <h3 style={{ ...styles.sectionTitle, marginTop: '16px' }}>Discover Public Groups</h3>
              {publicGroups
                .filter((group) => !groups.some((entry) => entry.id === group.id))
                .map((group) => (
                  <div key={group.id} style={styles.userItem}>
                    <div style={{ ...styles.avatarItemMini, backgroundColor: '#64748b' }}>P</div>
                    <span style={{ flex: 1 }}>{group.name}</span>
                    <button
                      className="btn-primary"
                      style={{ ...styles.smallBtn, fontSize: '0.8rem', padding: '4px 8px' }}
                      onClick={() => joinPublicGroup(group.id)}
                    >
                      Join
                    </button>
                  </div>
                ))}
            </>
          )}

          <hr style={styles.divider} />

          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>Online on Router</h3>
            <span style={styles.onlineCount}>{onlineUsers.length}</span>
          </div>

          {onlineUsers.length === 0 ? (
            <p style={styles.noUsers}>No one else is online right now.</p>
          ) : (
            onlineUsers.map((entry) => (
              <div
                key={entry.id}
                style={{
                  ...styles.userItem,
                  backgroundColor: selectedUser?.id === entry.id ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                }}
                onClick={() => {
                  setSelectedUser(entry);
                  setSelectedGroup(null);
                }}
              >
                <div style={styles.avatarCircle}>
                  <img src={entry.dp} alt="avatar" style={styles.avatarImg} />
                </div>
                <span>{entry.name}</span>
                <span style={styles.onlineIndicator} />
              </div>
            ))
          )}
        </div>

        <div style={styles.profileSection}>
          <div style={styles.avatarCircle}>
            <img src={user.dp} alt="my-avatar" style={styles.avatarImg} />
          </div>
          <div>
            <div>{user.name}</div>
            <div style={styles.profileSubtle}>You</div>
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
            <h3>Select a user or group to start chatting</h3>
            <p style={{ marginTop: '8px' }}>
              {runtimeInfo?.primaryUrl ? `Server ready at ${runtimeInfo.primaryUrl}` : 'Fetching server details...'}
            </p>
            <p style={{ marginTop: '8px', fontSize: '0.82rem', opacity: 0.85 }}>
              Messages sync automatically across reconnects.
            </p>
            <ArrowRight size={28} style={{ marginTop: '18px', opacity: 0.65 }} />
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
  },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerActions: {
    display: 'flex',
    gap: '12px',
  },
  headerIcon: {
    cursor: 'pointer',
    opacity: 0.8,
  },
  brandEyebrow: {
    margin: '0 0 6px 0',
    fontSize: '0.72rem',
    color: 'var(--primary-color)',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    fontWeight: '800',
  },
  connectionText: {
    marginTop: '10px',
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
  },
  userList: {
    flex: 1,
    padding: '15px',
    overflowY: 'auto',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    color: 'var(--primary-color)',
    margin: 0,
    fontWeight: '800',
  },
  onlineCount: {
    fontSize: '0.76rem',
    color: 'var(--text-muted)',
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
  checkboxRow: {
    display: 'flex',
    gap: '8px',
    cursor: 'pointer',
    marginBottom: '8px',
    fontSize: '0.9rem',
  },
  memberSelectScroll: {
    maxHeight: '100px',
    overflowY: 'auto',
    marginBottom: '8px',
    padding: '8px',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  memberPrompt: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    marginBottom: '6px',
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
  profileSubtle: {
    color: 'var(--text-muted)',
    fontSize: '0.78rem',
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
    maxWidth: '440px',
    padding: '24px',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
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
  },
};
