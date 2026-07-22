import React, { useState } from 'react';

function App() {
  const [user, setUser] = useState(null);

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
        <div style={{ backgroundColor: '#1a1a1a', border: '2px solid #C4A747', borderRadius: '8px', padding: '3rem 2rem', textAlign: 'center', maxWidth: '500px' }}>
          <h1 style={{ fontSize: '2.5rem', color: '#C4A747', margin: '0 0 1rem 0' }}>🏆 AM HOLDING</h1>
          <p style={{ color: '#a0a0a0', margin: '0 0 2rem 0', fontSize: '1rem' }}>Control de Gastos Corporativos</p>
          <button onClick={() => setUser('admin')} style={{ width: '100%', padding: '1rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '1rem', fontSize: '1rem', fontFamily: 'inherit' }}>👨‍💼 Admin</button>
          <button onClick={() => setUser('gerente')} style={{ width: '100%', padding: '1rem', backgroundColor: '#2a2a2a', color: '#C4A747', border: '2px solid #C4A747', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '1rem', fontSize: '1rem', fontFamily: 'inherit' }}>📊 Gerente</button>
          <button onClick={() => setUser('contadora')} style={{ width: '100%', padding: '1rem', backgroundColor: '#2a2a2a', color: '#C4A747', border: '2px solid #C4A747', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', fontFamily: 'inherit' }}>📋 Contadora</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', color: '#fff', fontFamily: 'system-ui' }}>
      <header style={{ backgroundColor: '#1a1a1a', borderBottom: '2px solid #C4A747', padding: '1.5rem 1rem' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', color: '#C4A747', margin: 0 }}>AM HOLDING</h1>
          <button onClick={() => setUser(null)} style={{ backgroundColor: 'rgba(196, 167, 71, 0.1)', border: '1px solid #C4A747', borderRadius: '4px', padding: '0.75rem 1.25rem', color: '#C4A747', cursor: 'pointer', fontWeight: 'bold', fontFamily: 'inherit' }}>Salir</button>
        </div>
      </header>

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 1rem' }}>
        <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', textAlign: 'center' }}>
          <h2 style={{ color: '#C4A747', margin: '0 0 1rem 0' }}>✅ App Funcionando</h2>
          <p style={{ color: '#a0a0a0', margin: 0 }}>Rol actual: <strong>{user === 'admin' ? 'Administrador' : user === 'gerente' ? 'Gerente' : 'Contadora'}</strong></p>
          <p style={{ color: '#10b981', margin: '1rem 0 0 0' }}>Tu app está en línea y lista para personalizarse</p>
        </div>
      </main>
    </div>
  );
}

export default App;
