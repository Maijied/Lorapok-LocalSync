import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, User, Camera } from 'lucide-react';

const AVATARS = Array.from({ length: 60 }, (_, i) => {
  if (i < 50) return `/avatars/anime_${i + 1}.svg`;
  return `/avatars/animal_${i - 49}.svg`;
});

export default function Login() {
  const { register, unlock, isRegistered, user } = useAuth();
  const [mode, setMode] = useState(isRegistered ? 'unlock' : 'register');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [selectedDp, setSelectedDp] = useState(AVATARS[0]);
  const [error, setError] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    if (name.length < 2) return setError('Name too short');
    if (pin.length !== 4) return setError('PIN must be 4 digits');
    await register(name, pin, selectedDp);
  };

  const handleUnlock = async (e) => {
    e.preventDefault();
    const success = await unlock(pin);
    if (!success) setError('Incorrect PIN');
  };

  if (mode === 'unlock') {
    return (
      <div style={styles.container}>
        <div className="glass-panel" style={styles.card}>
          <div style={styles.header}>
            <div style={styles.dpLarge}>
              <img src={user?.dp} alt="avatar" style={styles.dpImg} />
            </div>
            <h2>Welcome back, {user?.name}</h2>
            <p>Enter your 4-digit PIN to unlock</p>
          </div>
          <form onSubmit={handleUnlock} style={styles.form}>
            <input
              type="password"
              className="input-field"
              placeholder="0 0 0 0"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              style={styles.pinInput}
            />
            {error && <p style={styles.error}>{error}</p>}
            <button type="submit" className="btn-primary" style={styles.button}>
              Unlock Lorapok
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div className="glass-panel" style={styles.cardWide}>
        <div style={styles.header}>
          <h1>Lorapok LocalSync</h1>
          <p>Create your local network identity</p>
        </div>
        
        <div style={styles.registerSplit}>
          <div style={styles.avatarSection}>
            <h3>Choose your Anime DP</h3>
            <div style={styles.avatarGrid}>
              {AVATARS.map((src) => (
                <div 
                  key={src} 
                  style={{
                    ...styles.avatarItem,
                    border: selectedDp === src ? '2px solid var(--primary-color)' : '1px solid var(--glass-border)'
                  }}
                  onClick={() => setSelectedDp(src)}
                >
                  <img src={src} alt="avatar" style={styles.avatarImg} />
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleRegister} style={styles.formSplit}>
            <div style={styles.selectedPreview}>
               <img src={selectedDp} alt="selected" style={styles.dpPreview} />
            </div>
            
            <div style={styles.inputGroup}>
              <label>Display Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ex: Kirito"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div style={styles.inputGroup}>
              <label>Set 4-Digit PIN</label>
              <input
                type="password"
                className="input-field"
                placeholder="0000"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                style={styles.pinInput}
              />
            </div>

            {error && <p style={styles.error}>{error}</p>}
            
            <button type="submit" className="btn-primary" style={styles.button}>
              Create Account
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
    padding: '20px',
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    padding: '40px',
    textAlign: 'center',
  },
  cardWide: {
    width: '100%',
    maxWidth: '900px',
    padding: '40px',
  },
  header: {
    marginBottom: '30px',
    textAlign: 'center',
  },
  dpLarge: {
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    backgroundColor: 'var(--bg-surface)',
    margin: '0 auto 20px',
    overflow: 'hidden',
    border: '3px solid var(--primary-color)',
  },
  dpImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  pinInput: {
    textAlign: 'center',
    fontSize: '24px',
    letterSpacing: '10px',
  },
  button: {
    marginTop: '10px',
  },
  error: {
    color: '#ef4444',
    fontSize: '14px',
  },
  registerSplit: {
    display: 'flex',
    gap: '40px',
    marginTop: '20px',
  },
  avatarSection: {
    flex: 1,
  },
  avatarGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))',
    gap: '10px',
    maxHeight: '400px',
    overflowY: 'auto',
    padding: '10px',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: '12px',
    marginTop: '10px',
  },
  avatarItem: {
    width: '60px',
    height: '60px',
    borderRadius: '8px',
    cursor: 'pointer',
    overflow: 'hidden',
    transition: 'transform 0.2s',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  formSplit: {
    width: '300px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  selectedPreview: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    backgroundColor: 'var(--bg-surface)',
    margin: '0 auto',
    overflow: 'hidden',
    border: '4px solid var(--primary-color)',
  },
  dpPreview: {
    width: '100%',
    height: '100%',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  }
};
