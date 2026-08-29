import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff } from 'lucide-react';
import Navbar from '../components/Navbar';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const loggedUser = await login({ email, password });
      if (loggedUser?.role === 'merchant_admin') {
        navigate('/dashboard');
      } else {
        navigate('/checkout');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#faf9f6' }}>
      <Navbar />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem' }}>
        <div className="minimal-card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <div className="brutalist-subtitle" style={{ marginBottom: '0.5rem', color: '#0044ff' }}>GLASSBOX</div>
          <h2 className="brutalist-title" style={{ margin: '0 0 0.5rem 0', fontSize: '2rem' }}>Welcome Back</h2>
          <p className="brutalist-text" style={{ margin: '0 0 1.5rem 0', color: '#71717a', fontSize: '0.9rem' }}>Log in to access your account</p>

          {error && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '2px', color: '#ef4444', fontSize: '0.85rem', textAlign: 'left', fontFamily: 'Space Grotesk' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
            <input type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} required
              className="minimal-input"
            />
            <div style={{ position: 'relative' }}>
              <input type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required
                className="minimal-input"
                style={{ paddingRight: '2.8rem' }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '0.8rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', padding: 0, lineHeight: 0 }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button type="submit" className="minimal-btn minimal-btn-primary" style={{ width: '100%', marginTop: '0.25rem' }}>
              Log In
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', margin: '1.25rem 0' }}>
            <div style={{ flex: 1, height: '1px', background: '#e4e4e7' }} />
            <span className="brutalist-subtitle" style={{ padding: '0 10px', fontSize: '0.75rem', color: '#a1a1aa' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: '#e4e4e7' }} />
          </div>

          <button type="button" className="minimal-btn minimal-btn-ghost"
            style={{ width: '100%', padding: '0.65rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <span style={{ width: '18px', height: '18px', borderRadius: '2px', background: '#111111', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontSize: '0.65rem', fontWeight: 800, flexShrink: 0 }}>G</span>
            Sign in with Google
          </button>

          <div className="brutalist-text" style={{ marginTop: '1.5rem', fontSize: '0.875rem', color: '#71717a' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: '#0044ff', fontWeight: 700, textDecoration: 'none' }}>Register</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
