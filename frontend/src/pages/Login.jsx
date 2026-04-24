import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, User, Camera } from 'lucide-react';
import Logo from '../components/Logo';

const AVATARS = Array.from({ length: 60 }, (_, i) => {
  if (i < 50) return `./avatars/anime_${i + 1}.svg`;
  return `./avatars/animal_${i - 49}.svg`;
});

export default function Login() {
  const { register, unlock, isRegistered, isUnlocked, user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState(isRegistered ? 'unlock' : 'register');

  useEffect(() => {
    if (isUnlocked) {
      navigate('/');
    }
  }, [isUnlocked, navigate]);

  useEffect(() => {
    if (isRegistered) {
      setMode('unlock');
    } else {
      // Auto-detect device name for registration
      const detectName = async () => {
        if (window.electronAPI) {
          try {
            const hostname = await window.electronAPI.getHostname();
            setName(hostname);
          } catch (err) {
            console.error('Failed to get hostname:', err);
            setName(`User-${Math.floor(Math.random() * 1000)}`);
          }
        } else {
          setName(`User-${Math.floor(Math.random() * 1000)}`);
        }
      };
      detectName();
    }
  }, [isRegistered]);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [selectedDp, setSelectedDp] = useState(AVATARS[0]);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (name.length < 2) return setError('Name too short');
    if (pin.length !== 4) return setError('PIN must be 4 digits');
    await register(name, pin, selectedDp);
  };

  const handleUnlock = async (e) => {
    e.preventDefault();
    const success = await unlock(pin, rememberMe);
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
            <h2 style={styles.welcomeText}>Welcome back, {user?.name}</h2>
            <p style={styles.subtitleText}>Enter your 4-digit PIN to unlock LocalSync</p>
          </div>
          <form onSubmit={handleUnlock} style={styles.form}>
            <div style={styles.pinWrapper}>
              <input
                type="password"
                className="input-field"
                placeholder="••••"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                style={styles.pinInput}
              />
            </div>

            <div style={styles.rememberMeContainer}>
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={styles.checkbox}
              />
              <label htmlFor="rememberMe" style={styles.rememberMeLabel}>
                Remember me for 30 days
              </label>
            </div>

            {error && <p style={styles.error}>{error}</p>}
            <button type="submit" className="btn-primary" style={styles.button}>
              Unlock LocalSync
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div className="glass-panel login-card" style={styles.cardWide}>
        <div style={styles.header}>
          <Logo size={80} style={{margin: '0 auto 20px'}} />
          <h1 className="login-title">LocalSync</h1>
          <p style={{opacity: 0.8, fontWeight: 600, fontSize: '0.9rem'}}>A Product of Lorapok</p>
          <p style={{fontSize: '0.8rem', marginTop: '6px', opacity: 0.5}}>Secure encrypted communication for your local network</p>
        </div>
        
        <div style={styles.registerForm}>
          <div style={styles.avatarSection}>
            <div style={styles.selectedPreview}>
               <img src={selectedDp} alt="selected" style={styles.dpPreview} />
            </div>
            <p style={{...styles.subtitleText, margin: '20px 0 10px 0', fontSize: '0.8rem'}}>Swipe to Choose Avatar</p>
            <div className="hide-scrollbar" style={styles.avatarStrip}>
              {AVATARS.map((src) => (
                <div 
                  key={src} 
                  style={{
                    ...styles.avatarStripItem,
                    opacity: selectedDp === src ? 1 : 0.4,
                    transform: selectedDp === src ? 'scale(1.1)' : 'scale(0.95)',
                    border: selectedDp === src ? '2px solid var(--primary-color)' : '2px solid transparent',
                    boxShadow: selectedDp === src ? '0 0 15px rgba(0, 243, 255, 0.4)' : 'none'
                  }}
                  onClick={() => setSelectedDp(src)}
                >
                  <img src={src} alt="avatar" style={styles.avatarImg} />
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleRegister} style={styles.formCenter}>
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
              <div style={styles.pinWrapper}>
                <input
                  type="password"
                  className="input-field"
                  placeholder="••••"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  style={styles.pinInput}
                />
              </div>
            </div>

            {error && <p style={styles.error}>{error}</p>}
            
            <button type="submit" className="btn-primary" style={{...styles.button, marginTop: '20px'}}>
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
    minHeight: '100vh',
    height: '100%',
    overflowY: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-dark)',
    padding: '40px 20px',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    padding: '48px 40px',
    textAlign: 'center',
    background: 'linear-gradient(145deg, rgba(20,20,20,0.95) 0%, rgba(10,10,10,0.95) 100%)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '24px',
    boxShadow: '0 20px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
  },
  cardWide: {
    width: '100%',
    maxWidth: '500px',
    padding: '40px',
    background: 'linear-gradient(145deg, rgba(20,20,20,0.95) 0%, rgba(10,10,10,0.95) 100%)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '24px',
    boxShadow: '0 20px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
  },
  header: {
    marginBottom: '32px',
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: 'var(--text-light)',
    margin: '16px 0 8px 0',
    letterSpacing: '0.5px',
  },
  subtitleText: {
    color: 'var(--text-muted)',
    fontSize: '0.95rem',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    fontWeight: '600',
  },
  logo: {
    width: '80px',
    height: '80px',
    marginBottom: '20px',
    objectFit: 'contain',
  },
  dpLarge: {
    width: '110px',
    height: '110px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    margin: '0 auto 24px',
    overflow: 'hidden',
    border: '3px solid transparent',
    backgroundImage: 'linear-gradient(var(--bg-surface), var(--bg-surface)), linear-gradient(135deg, var(--primary-color), var(--secondary-color))',
    backgroundOrigin: 'border-box',
    backgroundClip: 'content-box, border-box',
    boxShadow: '0 10px 30px rgba(0, 243, 255, 0.2)',
    padding: '4px',
  },
  dpImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  pinWrapper: {
    background: 'rgba(0,0,0,0.3)',
    borderRadius: '12px',
    padding: '4px',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  pinInput: {
    textAlign: 'center',
    fontSize: '32px',
    letterSpacing: '24px',
    fontWeight: '900',
    color: 'var(--primary-color)',
    border: 'none',
    backgroundColor: 'transparent',
    boxShadow: 'none',
    padding: '16px 0',
    width: '100%',
    textShadow: '0 0 10px rgba(0, 243, 255, 0.5)',
  },
  button: {
    marginTop: '10px',
  },
  error: {
    color: '#ff0055',
    fontSize: '12px',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  registerForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
    marginTop: '20px',
  },
  avatarSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
  },
  avatarStrip: {
    display: 'flex',
    overflowX: 'auto',
    gap: '16px',
    width: '100%',
    padding: '20px 10px',
    scrollSnapType: 'x mandatory',
    WebkitOverflowScrolling: 'touch',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.02)',
  },
  avatarStripItem: {
    flex: '0 0 60px',
    height: '60px',
    borderRadius: '50%',
    cursor: 'pointer',
    overflow: 'hidden',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    scrollSnapAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  formCenter: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    width: '100%',
  },
  selectedPreview: {
    width: '130px',
    height: '130px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    margin: '0 auto',
    overflow: 'hidden',
    border: '3px solid transparent',
    backgroundImage: 'linear-gradient(var(--bg-surface), var(--bg-surface)), linear-gradient(135deg, var(--primary-color), var(--secondary-color))',
    backgroundOrigin: 'border-box',
    backgroundClip: 'content-box, border-box',
    boxShadow: '0 10px 30px rgba(0, 243, 255, 0.2)',
    padding: '4px',
  },
  dpPreview: {
    width: '100%',
    height: '100%',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    textTransform: 'uppercase',
    fontSize: '11px',
    letterSpacing: '1px',
    fontWeight: 'bold',
  },
  rememberMeContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: 'var(--text-muted)',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
    accentColor: 'var(--primary-color)',
    borderRadius: '4px',
  },
  rememberMeLabel: {
    cursor: 'pointer',
    userSelect: 'none',
  }
};
