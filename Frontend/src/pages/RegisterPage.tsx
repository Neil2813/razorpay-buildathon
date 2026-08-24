import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff } from 'lucide-react';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await register({ email, password, full_name: name });
      navigate('/checkout');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    }
  };

  return (
    <div className="flex flex-col h-screen justify-center items-center text-center">
      <div className="glass-box" style={{ maxWidth: '400px', width: '90%' }}>
        <h2>Create Account</h2>
        <p className="mb-4" style={{ opacity: 0.8 }}>Join GlassBox today</p>
        
        {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input 
            type="text" 
            placeholder="Full Name" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ padding: '0.8rem', borderRadius: '4px', border: '1px solid var(--color-bg-gray)', width: '100%' }}
          />
          <input 
            type="email" 
            placeholder="Email Address" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ padding: '0.8rem', borderRadius: '4px', border: '1px solid var(--color-bg-gray)', width: '100%' }}
          />
          <div style={{ position: 'relative' }}>
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ padding: '0.8rem', paddingRight: '2.5rem', borderRadius: '4px', border: '1px solid var(--color-bg-gray)', width: '100%' }}
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: '0.8rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'gray', padding: 0 }}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
            Register
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', margin: '1.25rem 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--color-bg-gray)' }}></div>
          <span style={{ padding: '0 10px', fontSize: '0.9rem', color: 'gray' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--color-bg-gray)' }}></div>
        </div>
        
        <button type="button" onClick={() => {/* handle google register */}} style={{ width: '100%', padding: '0.8rem', borderRadius: '4px', border: '1px solid #ccc', background: 'white', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
          <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/><path d="M1 1h22v22H1z" fill="none"/></svg>
          Sign in with Google
        </button>
        
        <div style={{ marginTop: '1.5rem', fontSize: '0.9rem' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--color-primary)' }}>Log In</Link>
        </div>
      </div>
    </div>
  );
}
