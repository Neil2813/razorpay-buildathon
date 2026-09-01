import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { soundFX } from '../lib/soundFX';
import { Volume2, VolumeX, Command, Sparkles } from 'lucide-react';

interface NavbarProps {
  onOpenCommandPalette?: () => void;
}

export default function Navbar({ onOpenCommandPalette }: NavbarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [soundEnabled, setSoundEnabled] = useState(soundFX.isEnabled());

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    soundFX.playClick();
    logout();
    navigate('/');
  };

  const toggleSound = () => {
    const next = soundFX.toggle();
    setSoundEnabled(next);
  };

  const isLanding = location.pathname === '/';

  if (isLanding) {
    return (
      <nav className="navbar">
        {/* Brand */}
        <Link to="/" className="navbar-brand" style={{ textDecoration: 'none' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '26px', height: '26px', borderRadius: '5px',
            background: 'linear-gradient(135deg, #0149ae 0%, #032676 100%)',
            color: '#ffffff', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.02em',
            flexShrink: 0,
          }}>
            GB
          </span>
          <span>GLASSBOX</span>
        </Link>

        {/* Nav Links */}
        <div className="navbar-links" style={{ flex: 1, justifyContent: 'center' }}>
          {!isLanding && (
            <Link to="/checkout" className={`nav-link${isActive('/checkout') ? ' active' : ''}`} style={{ textDecoration: 'none' }}>
              Checkout Cockpit
            </Link>
          )}
          
          {user && !isLanding && (
            <>
              {user.role === 'merchant_admin' && (
                <Link to="/dashboard" className={`nav-link${isActive('/dashboard') ? ' active' : ''}`} style={{ textDecoration: 'none' }}>
                  Revenue Intel
                </Link>
              )}
              <Link to="/history" className={`nav-link${isActive('/history') ? ' active' : ''}`} style={{ textDecoration: 'none' }}>
                Audit Ledger
              </Link>
            </>
          )}
        </div>

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          {/* Sound FX Toggle */}
          <button
            onClick={toggleSound}
            title={soundEnabled ? 'Mute Sound FX' : 'Enable Sound FX'}
            style={{
              background: 'transparent',
              border: '1px solid rgba(1,73,174,0.2)',
              borderRadius: '6px',
              padding: '0.35rem 0.6rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: soundEnabled ? '#0149ae' : '#71717a'
            }}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {user ? (
            <>
              {isLanding && (
                <Link to="/checkout" className="btn-primary" style={{ textDecoration: 'none', padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}>
                  Enter Cockpit
                </Link>
              )}
              {!isLanding && (
                <>
                  <Link to="/profile" className="btn-ghost" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', textDecoration: 'none', borderRadius: '6px' }}>
                    Profile
                  </Link>
                  <button onClick={handleLogout} className="btn-ghost" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid rgba(1,73,174,0.15)', cursor: 'pointer' }}>
                    Logout
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <Link to="/login" className={isLanding ? "btn-primary" : "btn-ghost"} style={{ textDecoration: 'none', padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}>
                Login
              </Link>
              {!isLanding && (
                <Link to="/register" className="btn-primary" style={{ textDecoration: 'none', padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}>
                  Get Started
                </Link>
              )}
            </>
          )}
        </div>
      </nav>
    );
  }

  const isCheckout = location.pathname === '/checkout';

  // Premium Minimalist Brutalist Typography Navbar for other pages
  return (
    <nav style={{
      background: isCheckout ? '#060e26' : '#ffffff',
      borderBottom: isCheckout ? '1px solid rgba(255,255,255,0.2)' : '1px solid #111111',
      display: 'grid',
      gridTemplateColumns: '260px 1fr 260px',
      height: '60px',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      {/* Brand Cell */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 1.5rem', borderRight: isCheckout ? '1px solid rgba(255,255,255,0.2)' : '1px solid #111111' }}>
        <Link to="/" style={{ textDecoration: 'none', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '28px', height: '28px', borderRadius: '4px',
            background: '#0044ff',
            color: '#ffffff', fontSize: '0.78rem', fontWeight: 900,
            flexShrink: 0,
          }}>
            GB
          </span>
          <span style={{ color: isCheckout ? '#ffffff' : '#111111', fontWeight: 900, fontSize: '1.2rem', letterSpacing: '0.06em', fontFamily: "'Space Grotesk', sans-serif" }}>
            GLASSBOX
          </span>
        </Link>
      </div>

      {/* Nav Links Cell (Centered) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', height: '100%' }}>
        {user?.role === 'merchant_admin' ? (
          <Link to="/dashboard" onClick={() => soundFX.playClick()} style={{ 
            textDecoration: 'none', 
            color: isCheckout ? '#ffffff' : (isActive('/dashboard') ? '#0044ff' : '#111111'),
            fontSize: '0.85rem',
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            fontFamily: "'Space Grotesk', sans-serif"
          }}>
            REVENUE INTEL
          </Link>
        ) : (
          <>
            <Link to="/checkout" onClick={() => soundFX.playClick()} style={{ 
              textDecoration: 'none', 
              color: isCheckout ? '#ffffff' : (isActive('/checkout') ? '#0044ff' : '#111111'),
              fontSize: '0.85rem',
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontFamily: "'Space Grotesk', sans-serif"
            }}>
              CHECKOUT COCKPIT
            </Link>
            
            {user && (
              <>
                <span style={{ color: isCheckout ? '#ffffff' : '#111111', fontWeight: 700, opacity: 0.6 }}>|</span>
                <Link to="/history" onClick={() => soundFX.playClick()} style={{ 
                  textDecoration: 'none', 
                  color: isCheckout ? '#ffffff' : (isActive('/history') ? '#0044ff' : '#111111'),
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  fontFamily: "'Space Grotesk', sans-serif"
                }}>
                  AUDIT LEDGER
                </Link>
              </>
            )}
          </>
        )}
      </div>

      {/* Right User Controls Cell */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.6rem', padding: '0 1.5rem', borderLeft: isCheckout ? '1px solid rgba(255,255,255,0.2)' : '1px solid #111111' }}>
        {user ? (
          <>
            <Link to="/profile" onClick={() => soundFX.playClick()} style={{
              background: '#ffffff',
              border: '2px solid #000000',
              borderRadius: '0px',
              padding: '0.4rem 0.85rem',
              fontSize: '0.72rem',
              fontWeight: 800,
              color: '#060e26',
              textDecoration: 'none',
              fontFamily: "'Space Grotesk', sans-serif"
            }}>
              PROFILE
            </Link>
            <button onClick={handleLogout} style={{
              background: isCheckout ? '#060e26' : '#111111',
              border: '2px solid #ffffff',
              borderRadius: '0px',
              padding: '0.4rem 0.85rem',
              fontSize: '0.72rem',
              fontWeight: 800,
              color: '#ffffff',
              cursor: 'pointer',
              fontFamily: "'Space Grotesk', sans-serif"
            }}>
              LOGOUT
            </button>
          </>
        ) : (
          <>
            <Link to="/login" onClick={() => soundFX.playClick()} style={{
              background: '#ffffff', border: '2px solid #000000', borderRadius: '0px', padding: '0.4rem 0.85rem', fontSize: '0.72rem', fontWeight: 800, color: '#060e26', textDecoration: 'none'
            }}>
              LOGIN
            </Link>
            <Link to="/register" onClick={() => soundFX.playClick()} style={{
              background: '#0044ff', border: '2px solid #000000', borderRadius: '0px', padding: '0.4rem 0.85rem', fontSize: '0.72rem', fontWeight: 800, color: '#ffffff', textDecoration: 'none'
            }}>
              REGISTER
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}


