import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    // Simulate registration and auto-login
    login({ email, name, role: 'buyer' });
    navigate('/checkout');
  };

  return (
    <div className="flex flex-col h-screen justify-center items-center text-center">
      <div className="glass-box" style={{ maxWidth: '400px', width: '90%' }}>
        <h2>Create Account</h2>
        <p className="mb-4" style={{ opacity: 0.8 }}>Join GlassBox today</p>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input 
            type="text" 
            placeholder="Full Name" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ padding: '0.8rem', borderRadius: '4px', border: '1px solid var(--color-bg-gray)' }}
          />
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
            Register
          </button>
        </form>
        
        <div style={{ marginTop: '1.5rem', fontSize: '0.9rem' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--color-primary)' }}>Log In</Link>
        </div>
      </div>
    </div>
  );
}
