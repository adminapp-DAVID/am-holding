import React, { useState } from 'react';

export default function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');

  const users = [{ id: 1, nombre: 'Admin', email: 'admin@amholding.com', password: 'admin123', rol: 'admin' }];

  const handleLogin = () => {
    const found = users.find(u => u.email === email && u.password === password);
    if (found) {
      setUser(found);
      setEmail('');
      setPassword('');
    } else {
      alert('Incorrecto');
    }
  };

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ backgroundColor: '#1a1a1a', border: '2px solid #C4A747', borderRadius: '8px', padding: '3rem 2rem', textAlign: 'center', maxWidth: '400px' }}>
          <h1 style={{ color: '#C4A747', fontSize: '2.5rem', margin: 0 }}>AM HOLDING</h1>
          <p style={{ color: '#a0a0a0', margin: '1rem 0 2rem 0' }}>Control de Gastos</p>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #C4A747', color: '#C4A747', marginBottom: '1rem', boxSizing: 'border-box', borderRadius: '4px' }} />
          <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleLogin()} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #C4A747', color: '#C4A747', marginBottom: '2rem', boxSizing: 'border-box', borderRadius: '4px' }} />
          <button onClick={handleLogin} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Entrar</button>
          <p style={{ color: '#7a7a7a', fontSize: '0.85rem', margin: '1.5rem 0 0 0' }}>admin@amholding.com / admin123</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', color: '#fff' }}>
      <header style={{ backgroundColor: '#1a1a1a', borderBottom: '2px solid #C4A747', padding: '1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between' }}>
          <h1 style={{ color: '#C4A747', margin: 0 }}>AM HOLDING</h1>
          <button onClick={() => setUser(null)} style={{ backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Salir</button>
        </div>
      </header>

      <main style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid #2a2a2a', paddingBottom: '1rem' }}>
          <button onClick={() => setActiveTab('dashboard')} style={{ background: 'none', border: 'none', color: activeTab === 'dashboard' ? '#C4A747' : '#a0a0a0', cursor: 'pointer', fontWeight: '500', fontSize: '1rem', paddingBottom: '0.5rem', borderBottom: activeTab === 'dashboard' ? '2px solid #C4A747' : 'none' }}>Dashboard</button>
          <button onClick={() => setActiveTab('responsables')} style={{ background: 'none', border: 'none', color: activeTab === 'responsables' ? '#C4A747' : '#a0a0a0', cursor: 'pointer', fontWeight: '500', fontSize: '1rem', paddingBottom: '0.5rem', borderBottom: activeTab === 'responsables' ? '2px solid #C4A747' : 'none' }}>Responsables</button>
        </div>

        {activeTab === 'dashboard' && (
          <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', textAlign: 'center' }}>
            <h2 style={{ color: '#C4A747', margin: 0 }}>Sistema Operativo</h2>
            <p style={{ color: '#a0a0a0', margin: '1rem 0 0 0' }}>Usuario: {user.nombre}</p>
          </div>
        )}

        {activeTab === 'responsables' && (
          <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
            <h2 style={{ color: '#C4A747', marginBottom: '1.5rem' }}>Responsables</h2>
            <p style={{ color: '#a0a0a0' }}>Módulo en desarrollo</p>
          </div>
        )}
      </main>
    </div>
  );
}
