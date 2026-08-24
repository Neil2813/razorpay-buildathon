import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../api/client';

export interface User {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  tenant_id: string;
}

interface AuthContextType {
  user: User | null;
  login: (userData: any) => Promise<void>;
  register: (userData: any) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('glassbox_token');
      if (token) {
        try {
          const profile = await api.get('/auth/me');
          setUser(profile);
        } catch (error) {
          console.error("Session expired or invalid");
          localStorage.removeItem('glassbox_token');
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (credentials: any) => {
    const res = await api.post('/auth/login', credentials);
    localStorage.setItem('glassbox_token', res.access_token);
    setUser(res.user);
  };

  const register = async (credentials: any) => {
    // Inject defaults for UI
    const payload = {
      ...credentials,
      role: 'buyer',
      tenant_id: 'demo_tenant'
    };
    const res = await api.post('/auth/register', payload);
    localStorage.setItem('glassbox_token', res.access_token);
    setUser(res.user);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('glassbox_token');
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

