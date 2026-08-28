import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate('/');
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

  // Premium Minimalist Brutalist Typography Navbar for other pages
  return (
    <nav style={{
      background: '#ffffff',
      borderBottom: '1px solid #111111',
      display: 'grid',
      gridTemplateColumns: '240px 1fr auto auto',
      height: '60px',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      {/* Brand Cell */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 1.5rem', borderRight: '1px solid #111111' }}>
        <Link to="/" className="brutalist-title" style={{ textDecoration: 'none', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#111111' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '26px', height: '26px', borderRadius: '2px',
            background: '#0044ff',
            color: '#ffffff', fontSize: '0.75rem', fontWeight: 800,
            flexShrink: 0,
          }}>
            GB
          </span>
          <span>GLASSBOX</span>
        </Link>
      </div>

      {/* Nav Links Cell */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0px', height: '100%' }}>
        <Link to="/checkout" className="brutalist-subtitle" style={{ 
          textDecoration: 'none', 
          color: isActive('/checkout') ? '#0044ff' : '#71717a',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          padding: '0 1.5rem',
          borderRight: '1px solid #e4e4e7',
          background: isActive('/checkout') ? '#faf9f6' : 'transparent',
          transition: 'all 0.15s'
        }}>
          Checkout Cockpit
        </Link>
        
        {user && (
          <>
            {user.role === 'merchant_admin' && (
              <Link to="/dashboard" className="brutalist-subtitle" style={{ 
                textDecoration: 'none', 
                color: isActive('/dashboard') ? '#0044ff' : '#71717a',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                padding: '0 1.5rem',
                borderRight: '1px solid #e4e4e7',
                background: isActive('/dashboard') ? '#faf9f6' : 'transparent',
                transition: 'all 0.15s'
              }}>
                Revenue Intel
              </Link>
            )}
            <Link to="/history" className="brutalist-subtitle" style={{ 
              textDecoration: 'none', 
              color: isActive('/history') ? '#0044ff' : '#71717a',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              padding: '0 1.5rem',
              borderRight: '1px solid #e4e4e7',
              background: isActive('/history') ? '#faf9f6' : 'transparent',
              transition: 'all 0.15s'
            }}>
              Audit Ledger
            </Link>
          </>
        )}
      </div>



      {/* Right User Controls Cell */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 1.5rem', borderLeft: '1px solid #111111' }}>
        {user ? (
          <>
            <Link to="/profile" className="minimal-btn minimal-btn-ghost" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderRadius: '2px' }}>
              Profile
            </Link>
            <button onClick={handleLogout} className="minimal-btn" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderRadius: '2px' }}>
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="minimal-btn minimal-btn-ghost" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderRadius: '2px' }}>
              Login
            </Link>
            <Link to="/register" className="minimal-btn minimal-btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderRadius: '2px' }}>
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
