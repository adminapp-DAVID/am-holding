import React, { useState } from 'react';

function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const usuarios = [
    { email: 'admin@amholding.com', password: 'admin123', role: 'Administradores' },
    { email: 'gerente@amholding.com', password: 'gerente123', role: 'Gerentes' },
    { email: 'contador@amholding.com', password: 'contador123', role: 'Contadores' }
  ];

  const handleLogin = () => {
    const usuarioEncontrado = usuarios.find(u => u.email === email && u.password === password);
    
    if (usuarioEncontrado) {
      setUser({ email, role: usuarioEncontrado.role });
      setError('');
    } else {
      setError('Email o contraseña incorrectos');
    }
  };

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
        <div style={{ backgroundColor: '#1a1a1a', border: '2px solid #C4A747', borderRadius: '8px', padding: '3rem 2rem', textAlign: 'center', maxWidth: '500px' }}>
          <h1 style={{ fontSize: '3.5rem', color: '#C4A747', margin: '0 0 1rem 0', fontWeight: '700', letterSpacing: '2px' }}>AM HOLDING</h1>
          <p style={{ color: '#a0a0a0', margin: '0 0 2rem 0', fontSize: '1rem' }}>Control de Gastos Corporativos</p>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #C4A747', borderRadius: '4px', color: '#C4A747', marginBottom: '1rem', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #C4A747', borderRadius: '4px', color: '#C4A747', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>

          {error && <p style={{ color: '#dc2626', margin: '0 0 1rem 0', fontSize: '0.9rem' }}>❌ {error}</p>}

          <button onClick={handleLogin} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', fontFamily: 'inherit' }}>
            Iniciar sesión
          </button>

          <p style={{ color: '#7a7a7a', margin: '1.5rem 0 0 0', fontSize: '0.85rem' }}>
            Demo:<br/>
            admin@amholding.com / admin123<br/>
            gerente@amholding.com / gerente123<br/>
            contador@amholding.com / contador123
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', color: '#fff', fontFamily: 'system-ui' }}>
      <header style={{ backgroundColor: '#1a1a1a', borderBottom: '2px solid #C4A747', padding: '1.5rem 1rem' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', color: '#C4A747', margin: 0 }}>AM HOLDING</h1>
            <p style={{ fontSize: '0.85rem', color: '#a0a0a0', margin: '0.25rem 0 0 0' }}>{user.email} • {user.role}</p>
          </div>
          <button onClick={() => setUser(null)} style={{ backgroundColor: 'rgba(196, 167, 71, 0.1)', border: '1px solid #C4A747', borderRadius: '4px', padding: '0.75rem 1.25rem', color: '#C4A747', cursor: 'pointer', fontWeight: 'bold', fontFamily: 'inherit' }}>
            Salir
          </button>
        </div>
      </header>

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 1rem' }}>
        <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', textAlign: 'center' }}>
          <h2 style={{ color: '#C4A747', margin: '0 0 1rem 0' }}>✅ App Funcionando</h2>
          <p style={{ color: '#a0a0a0', margin: 0 }}>Rol actual: <strong>{user.role}</strong></p>
          <p style={{ color: '#10b981', margin: '1rem 0 0 0' }}>Tu app está en línea y lista para personalizarse</p>
        </div>
      </main>
    </div>
  );
}

export default App;
