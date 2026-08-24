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
      await login({ email, password });
      navigate('/checkout');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f8f6f0' }}>
      <Navbar />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem' }}>
        <div className="glass-box" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <div style={{ marginBottom: '0.25rem', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#0149ae' }}>GLASSBOX</div>
          <h2 style={{ margin: '0 0 0.35rem 0' }}>Welcome Back</h2>
          <p style={{ margin: '0 0 1.5rem 0', color: 'rgba(30,30,30,0.5)', fontSize: '0.9rem' }}>Log in to access your account</p>

          {error && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'rgba(3,38,118,0.07)', border: '1px solid rgba(3,38,118,0.2)', borderRadius: '6px', color: '#032676', fontSize: '0.85rem', textAlign: 'left' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
            <input type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} required
              style={{ padding: '0.8rem', borderRadius: '6px', border: '1px solid rgba(1,73,174,0.15)', width: '100%', fontFamily: 'inherit', fontSize: '0.9rem', outline: 'none', color: '#1e1e1e', background: '#ffffff', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = '#0149ae'}
              onBlur={e => e.target.style.borderColor = 'rgba(1,73,174,0.15)'}
            />
            <div style={{ position: 'relative' }}>
              <input type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required
                style={{ padding: '0.8rem', paddingRight: '2.8rem', borderRadius: '6px', border: '1px solid rgba(1,73,174,0.15)', width: '100%', fontFamily: 'inherit', fontSize: '0.9rem', outline: 'none', color: '#1e1e1e', background: '#ffffff', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#0149ae'}
                onBlur={e => e.target.style.borderColor = 'rgba(1,73,174,0.15)'}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '0.8rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(30,30,30,0.4)', padding: 0, lineHeight: 0 }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.25rem' }}>
              Log In
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', margin: '1.25rem 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(1,73,174,0.12)' }} />
            <span style={{ padding: '0 10px', fontSize: '0.85rem', color: 'rgba(30,30,30,0.35)' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(1,73,174,0.12)' }} />
          </div>

          {/* Google sign-in — rendered in on-palette style */}
          <button type="button"
            style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid rgba(1,73,174,0.2)', background: '#ffffff', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.875rem', color: '#1e1e1e', fontFamily: 'inherit' }}>
            {/* G icon represented using approved palette */}
            <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#032676', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontSize: '0.65rem', fontWeight: 800, flexShrink: 0 }}>G</span>
            Sign in with Google
          </button>

          <div style={{ marginTop: '1.5rem', fontSize: '0.875rem', color: 'rgba(30,30,30,0.55)' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: '#0149ae', fontWeight: 600, textDecoration: 'none' }}>Register</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
