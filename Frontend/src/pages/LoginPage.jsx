import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    // Simulate login for now
    login({ email, role: 'buyer' });
    navigate('/checkout');
  };

  return (
    <div className="flex flex-col h-screen justify-center items-center text-center">
      <div className="glass-box" style={{ maxWidth: '400px', width: '90%' }}>
        <h2>Welcome Back</h2>
        <p className="mb-4" style={{ opacity: 0.8 }}>Log in to access your account</p>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input 
            type="email" 
            placeholder="Email Address" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ padding: '0.8rem', borderRadius: '4px', border: '1px solid var(--color-bg-gray)' }}
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ padding: '0.8rem', borderRadius: '4px', border: '1px solid var(--color-bg-gray)' }}
          />
          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
            Log In
          </button>
        </form>
        
        <div style={{ marginTop: '1.5rem', fontSize: '0.9rem' }}>
          Don't have an account? <Link to="/register" style={{ color: 'var(--color-primary)' }}>Register</Link>
        </div>
      </div>
    </div>
  );
}
