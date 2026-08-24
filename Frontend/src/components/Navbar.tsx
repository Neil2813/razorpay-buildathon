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
        {user && (
          <>
            <Link to="/checkout" className={`nav-link${isActive('/checkout') ? ' active' : ''}`} style={{ textDecoration: 'none' }}>
              Checkout Cockpit
            </Link>
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
            <Link to="/profile" className="btn-ghost" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', textDecoration: 'none', borderRadius: '6px' }}>
              Profile
            </Link>
            <button onClick={handleLogout} className="btn-ghost" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid rgba(1,73,174,0.15)', cursor: 'pointer' }}>
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn-ghost" style={{ textDecoration: 'none', padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}>
              Login
            </Link>
            <Link to="/register" className="btn-primary" style={{ textDecoration: 'none', padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}>
              Get Started
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
