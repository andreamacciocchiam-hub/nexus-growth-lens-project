import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await login(email, password);
      window.location.href = '/';
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0a1628' }}>
      <div style={{ background:'rgba(255,255,255,0.1)', padding:'2rem', borderRadius:'1rem', width:'320px' }}>
        <h1 style={{ color:'white', marginBottom:'1.5rem', fontSize:'1.25rem', fontWeight:'bold' }}>TIM BI App</h1>
        {error && <p style={{ color:'#f87171', marginBottom:'1rem', fontSize:'0.875rem' }}>{error}</p>}
        <input
          style={{ width:'100%', padding:'0.5rem', borderRadius:'0.5rem', background:'rgba(255,255,255,0.2)', color:'white', border:'none', marginBottom:'0.75rem', boxSizing:'border-box' }}
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          type="password"
          style={{ width:'100%', padding:'0.5rem', borderRadius:'0.5rem', background:'rgba(255,255,255,0.2)', color:'white', border:'none', marginBottom:'1rem', boxSizing:'border-box' }}
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{ width:'100%', padding:'0.5rem', borderRadius:'0.5rem', background:'#2563eb', color:'white', border:'none', cursor:'pointer' }}
        >
          {loading ? 'Accesso...' : 'Accedi'}
        </button>
      </div>
    </div>
  );
}