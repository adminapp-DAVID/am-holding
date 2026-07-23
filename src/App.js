import React, { useState, useEffect } from 'react';

export default function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);

  useEffect(() => {
    const savedUsers = localStorage.getItem('amUsers');
    const savedRoles = localStorage.getItem('amRoles');
    
    if (!savedUsers) {
      const defaultUsers = [{ id: 1, nombre: 'Admin', email: 'admin@amholding.com', password: 'admin123', rol: 'admin' }];
      setUsers(defaultUsers);
      localStorage.setItem('amUsers', JSON.stringify(defaultUsers));
    } else {
      setUsers(JSON.parse(savedUsers));
    }
    
    if (!savedRoles) {
      const defaultRoles = [
        { id: 'admin', nombre: 'Administrador' },
        { id: 'responsable', nombre: 'Responsable' },
        { id: 'revisor', nombre: 'Revisor' },
        { id: 'contador', nombre: 'Contador' }
      ];
      setRoles(defaultRoles);
      localStorage.setItem('amRoles', JSON.stringify(defaultRoles));
    } else {
      setRoles(JSON.parse(savedRoles));
    }
  }, []);

  const handleLogin = () => {
    const found = users.find(u => u.email === email && u.password === password);
    if (found) {
      setUser(found);
      setEmail('');
      setPassword('');
    } else {
      alert('Email o contraseña incorrectos');
    }
  };

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ backgroundColor: '#1a1a1a', border: '2px solid #C4A747', borderRadius: '8px', padding: '3rem 2rem', textAlign: 'center', maxWidth: '500px' }}>
          <h1 style={{ fontSize: '3rem', color: '#C4A747', margin: 0 }}>AM HOLDING</h1>
          <p style={{ color: '#a0a0a0', margin: '1rem 0 2rem 0' }}>Control de Gastos</p>
          
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #C4A747', borderRadius: '4px', color: '#C4A747', marginBottom: '1rem', boxSizing: 'border-box' }} />
          <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleLogin()} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #C4A747', borderRadius: '4px', color: '#C4A747', marginBottom: '2rem', boxSizing: 'border-box' }} />
          
          <button onClick={handleLogin} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
            Iniciar sesión
          </button>

          <p style={{ color: '#7a7a7a', margin: '2rem 0 0 0', fontSize: '0.85rem' }}>Demo: admin@amholding.com / admin123</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', color: '#fff' }}>
      <header style={{ backgroundColor: '#1a1a1a', borderBottom: '2px solid #C4A747', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', color: '#C4A747', margin: 0 }}>AM HOLDING</h1>
            <p style={{ fontSize: '0.85rem', color: '#a0a0a0', margin: 0 }}>{user.nombre} • {user.rol}</p>
          </div>
          <button onClick={() => setUser(null)} style={{ backgroundColor: 'rgba(196, 167, 71, 0.1)', border: '1px solid #C4A747', borderRadius: '4px', padding: '0.75rem 1.25rem', color: '#C4A747', cursor: 'pointer', fontWeight: 'bold' }}>
            Salir
          </button>
        </div>
      </header>

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
          <div style={{ backgroundColor: '#1a1a1a', padding: '1.75rem', borderRadius: '4px', border: '1px solid #2a2a2a', borderLeft: '4px solid #C4A747' }}>
            <p style={{ fontSize: '0.85rem', color: '#a0a0a0', margin: 0 }}>USUARIO</p>
            <p style={{ fontSize: '2rem', fontWeight: '700', color: '#C4A747', margin: '0.5rem 0 0 0' }}>{user.nombre}</p>
          </div>
          <div style={{ backgroundColor: '#1a1a1a', padding: '1.75rem', borderRadius: '4px', border: '1px solid #2a2a2a', borderLeft: '4px solid #C4A747' }}>
            <p style={{ fontSize: '0.85rem', color: '#a0a0a0', margin: 0 }}>ROL</p>
            <p style={{ fontSize: '2rem', fontWeight: '700', color: '#C4A747', margin: '0.5rem 0 0 0' }}>{user.rol}</p>
          </div>
          <div style={{ backgroundColor: '#1a1a1a', padding: '1.75rem', borderRadius: '4px', border: '1px solid #2a2a2a', borderLeft: '4px solid #C4A747' }}>
            <p style={{ fontSize: '0.85rem', color: '#a0a0a0', margin: 0 }}>ROLES DISPONIBLES</p>
            <p style={{ fontSize: '2rem', fontWeight: '700', color: '#C4A747', margin: '0.5rem 0 0 0' }}>{roles.length}</p>
          </div>
        </div>

        <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', marginTop: '2rem', textAlign: 'center' }}>
          <h2 style={{ color: '#C4A747', margin: 0 }}>✅ Sistema Operativo</h2>
          <p style={{ color: '#a0a0a0', margin: '1rem 0 0 0' }}>Sistema de Roles Dinámicos Activo</p>
        </div>
      </main>
    </div>
  );
}
