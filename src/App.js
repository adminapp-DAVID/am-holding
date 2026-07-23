import React, { useState, useEffect } from 'react';

function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [newRole, setNewRole] = useState({ nombre: '', descripcion: '' });
  const [newUser, setNewUser] = useState({ nombre: '', email: '', rol_id: '', empresa: '', password: '' });

  const defaultRoles = [
    { id: 'admin', nombre: 'Administrador', descripcion: 'Super usuario' },
    { id: 'responsable', nombre: 'Responsable', descripcion: 'Usuario básico' },
    { id: 'revisor', nombre: 'Revisor', descripcion: 'Aprueba solicitudes' },
    { id: 'contador', nombre: 'Contador', descripcion: 'Exporta reportes' }
  ];

  const defaultUsers = [
    { id: 1, nombre: 'Admin', email: 'admin@amholding.com', password: 'admin123', rol_id: 'admin', empresa: 'AM HOLDING', activo: true }
  ];

  useEffect(() => {
    const savedRoles = localStorage.getItem('amRoles');
    const savedUsers = localStorage.getItem('amUsers');
    setRoles(savedRoles ? JSON.parse(savedRoles) : defaultRoles);
    setUsers(savedUsers ? JSON.parse(savedUsers) : defaultUsers);
  }, []);

  useEffect(() => {
    localStorage.setItem('amRoles', JSON.stringify(roles));
  }, [roles]);

  useEffect(() => {
    localStorage.setItem('amUsers', JSON.stringify(users));
  }, [users]);

  const getUserRole = () => {
    if (!user) return null;
    return roles.find(r => r.id === user.rol_id);
  };

  const isAdmin = user && user.rol_id === 'admin';

  const handleLogin = () => {
    const usuarioEncontrado = users.find(u => u.email === email && u.password === password && u.activo);
    if (usuarioEncontrado) {
      setUser(usuarioEncontrado);
      setError('');
      setEmail('');
      setPassword('');
    } else {
      setError('Email o contraseña incorrectos');
    }
  };

  const handleCreateRole = () => {
    if (!newRole.nombre) {
      alert('Ingresa el nombre del rol');
      return;
    }
    setRoles([...roles, { id: Date.now().toString(), ...newRole }]);
    setNewRole({ nombre: '', descripcion: '' });
    setShowRoleForm(false);
  };

  const handleDeleteRole = (roleId) => {
    if (users.some(u => u.rol_id === roleId)) {
      alert('No puedes eliminar un rol que tiene usuarios asignados');
      return;
    }
    setRoles(roles.filter(r => r.id !== roleId));
  };

  const handleCreateUser = () => {
    if (!newUser.nombre || !newUser.email || !newUser.rol_id || !newUser.empresa) {
      alert('Completa todos los campos');
      return;
    }
    if (!newUser.password) {
      newUser.password = Math.random().toString(36).slice(-8);
    }
    setUsers([...users, { id: Date.now(), ...newUser, activo: true }]);
    setNewUser({ nombre: '', email: '', rol_id: '', empresa: '', password: '' });
    setShowUserForm(false);
  };

  const handleDeleteUser = (userId) => {
    if (userId === user.id) {
      alert('No puedes eliminar tu propio usuario');
      return;
    }
    setUsers(users.filter(u => u.id !== userId));
  };

  const handleLogout = () => {
    setUser(null);
    setActiveTab('dashboard');
  };

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
        <div style={{ backgroundColor: '#1a1a1a', border: '2px solid #C4A747', borderRadius: '8px', padding: '3rem 2rem', textAlign: 'center', maxWidth: '500px' }}>
          <h1 style={{ fontSize: '3.5rem', color: '#C4A747', margin: '0 0 1rem 0', fontWeight: '700' }}>AM HOLDING</h1>
          <p style={{ color: '#a0a0a0', margin: '0 0 2rem 0' }}>Control de Gastos Corporativos</p>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #C4A747', borderRadius: '4px', color: '#C4A747', marginBottom: '1rem', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleLogin()} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #C4A747', borderRadius: '4px', color: '#C4A747', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>

          {error && <p style={{ color: '#dc2626', margin: '0 0 1rem 0' }}>❌ {error}</p>}

          <button onClick={handleLogin} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>
            Iniciar sesión
          </button>

          <p style={{ color: '#7a7a7a', margin: '1.5rem 0 0 0', fontSize: '0.85rem' }}>
            Demo: admin@amholding.com / admin123
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
            <p style={{ fontSize: '0.85rem', color: '#a0a0a0', margin: '0.25rem 0 0 0' }}>{user.nombre} • {getUserRole()?.nombre}</p>
          </div>
          <button onClick={handleLogout} style={{ backgroundColor: 'rgba(196, 167, 71, 0.1)', border: '1px solid #C4A747', borderRadius: '4px', padding: '0.75rem 1.25rem', color: '#C4A747', cursor: 'pointer', fontWeight: 'bold', fontFamily: 'inherit' }}>
            Salir
          </button>
        </div>

        <nav style={{ maxWidth: '1400px', margin: '1rem auto 0', display: 'flex', gap: '2rem', borderTop: '1px solid rgba(196, 167, 71, 0.2)', paddingTop: '1rem', flexWrap: 'wrap' }}>
          <button onClick={() => setActiveTab('dashboard')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'dashboard' ? '3px solid #C4A747' : 'none', color: activeTab === 'dashboard' ? '#C4A747' : '#a0a0a0', cursor: 'pointer', fontWeight: '500', paddingBottom: '0.5rem' }}>
            📊 Dashboard
          </button>
          
          {isAdmin && (
            <>
              <button onClick={() => setActiveTab('roles')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'roles' ? '3px solid #C4A747' : 'none', color: activeTab === 'roles' ? '#C4A747' : '#a0a0a0', cursor: 'pointer', fontWeight: '500', paddingBottom: '0.5rem' }}>
                ⚙️ Roles
              </button>

              <button onClick={() => setActiveTab('usuarios')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'usuarios' ? '3px solid #C4A747' : 'none', color: activeTab === 'usuarios' ? '#C4A747' : '#a0a0a0', cursor: 'pointer', fontWeight: '500', paddingBottom: '0.5rem' }}>
                👤 Usuarios
              </button>
            </>
          )}
        </nav>
      </header>

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 1rem' }}>
        
        {activeTab === 'dashboard' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              <div style={{ backgroundColor: '#1a1a1a', padding: '1.75rem', borderRadius: '4px', border: '1px solid #2a2a2a', borderLeft: '4px solid #C4A747' }}>
                <p style={{ fontSize: '0.85rem', color: '#a0a0a0', margin: 0, textTransform: 'uppercase' }}>Usuarios Activos</p>
                <p style={{ fontSize: '2rem', fontWeight: '700', color: '#C4A747', margin: '0.5rem 0 0 0' }}>{users.filter(u => u.activo).length}</p>
              </div>
              <div style={{ backgroundColor: '#1a1a1a', padding: '1.75rem', borderRadius: '4px', border: '1px solid #2a2a2a', borderLeft: '4px solid #C4A747' }}>
                <p style={{ fontSize: '0.85rem', color: '#a0a0a0', margin: 0, textTransform: 'uppercase' }}>Roles Disponibles</p>
                <p style={{ fontSize: '2rem', fontWeight: '700', color: '#C4A747', margin: '0.5rem 0 0 0' }}>{roles.length}</p>
              </div>
              <div style={{ backgroundColor: '#1a1a1a', padding: '1.75rem', borderRadius: '4px', border: '1px solid #2a2a2a', borderLeft: '4px solid #C4A747' }}>
                <p style={{ fontSize: '0.85rem', color: '#a0a0a0', margin: 0, textTransform: 'uppercase' }}>Tu Rol</p>
                <p style={{ fontSize: '2rem', fontWeight: '700', color: '#C4A747', margin: '0.5rem 0 0 0' }}>{getUserRole()?.nombre}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'roles' && isAdmin && (
          <div>
            <button onClick={() => setShowRoleForm(!showRoleForm)} style={{ backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', padding: '0.75rem 1.5rem', fontWeight: 'bold', cursor: 'pointer', marginBottom: '2rem', fontFamily: 'inherit' }}>
              ➕ Crear Rol
            </button>

            {showRoleForm && (
              <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', marginBottom: '2rem' }}>
                <h2 style={{ color: '#C4A747', marginBottom: '1rem' }}>Crear Nuevo Rol</h2>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', display: 'block', marginBottom: '0.5rem' }}>NOMBRE</label>
                  <input type="text" value={newRole.nombre} onChange={(e) => setNewRole({...newRole, nombre: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }} placeholder="Ej: Revisor Especializado" />
                </div>
                <div style={{ marginBottom: '2rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', display: 'block', marginBottom: '0.5rem' }}>DESCRIPCIÓN</label>
                  <input type="text" value={newRole.descripcion} onChange={(e) => setNewRole({...newRole, descripcion: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }} placeholder="Descripción" />
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button onClick={handleCreateRole} style={{ flex: 1, padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>💾 Crear</button>
                  <button onClick={() => setShowRoleForm(false)} style={{ flex: 1, padding: '0.75rem', backgroundColor: '#2a2a2a', color: '#a0a0a0', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>❌ Cancelar</button>
                </div>
              </div>
            )}

            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
              <h2 style={{ color: '#C4A747', marginBottom: '1rem' }}>Roles ({roles.length})</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#0f0f0f', borderBottom: '2px solid #C4A747' }}>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '600', color: '#C4A747', textTransform: 'uppercase' }}>Nombre</th>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '600', color: '#C4A747', textTransform: 'uppercase' }}>Descripción</th>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'center', fontWeight: '600', color: '#C4A747', textTransform: 'uppercase' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles.map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                        <td style={{ padding: '1rem 0.75rem', color: '#d0d0d0' }}>{r.nombre}</td>
                        <td style={{ padding: '1rem 0.75rem', color: '#d0d0d0' }}>{r.descripcion}</td>
                        <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                          {!['admin', 'responsable', 'revisor', 'contador'].includes(r.id) && (
                            <button onClick={() => handleDeleteRole(r.id)} style={{ background: 'rgba(220, 53, 69, 0.15)', border: '1px solid #dc3545', borderRadius: '4px', padding: '0.5rem 0.75rem', cursor: 'pointer', color: '#ff6b6b', fontFamily: 'inherit' }}>🗑️</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'usuarios' && isAdmin && (
          <div>
            <button onClick={() => setShowUserForm(!showUserForm)} style={{ backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', padding: '0.75rem 1.5rem', fontWeight: 'bold', cursor: 'pointer', marginBottom: '2rem', fontFamily: 'inherit' }}>
              ➕ Crear Usuario
            </button>

            {showUserForm && (
              <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', marginBottom: '2rem' }}>
                <h2 style={{ color: '#C4A747', marginBottom: '1rem' }}>Crear Usuario</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', display: 'block', marginBottom: '0.5rem' }}>NOMBRE</label>
                    <input type="text" value={newUser.nombre} onChange={(e) => setNewUser({...newUser, nombre: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', display: 'block', marginBottom: '0.5rem' }}>EMAIL</label>
                    <input type="email" value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', display: 'block', marginBottom: '0.5rem' }}>ROL</label>
                    <select value={newUser.rol_id} onChange={(e) => setNewUser({...newUser, rol_id: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }}>
                      <option value="">Seleccionar</option>
                      {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', display: 'block', marginBottom: '0.5rem' }}>EMPRESA</label>
                    <input type="text" value={newUser.empresa} onChange={(e) => setNewUser({...newUser, empresa: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button onClick={handleCreateUser} style={{ flex: 1, padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>💾 Crear</button>
                  <button onClick={() => setShowUserForm(false)} style={{ flex: 1, padding: '0.75rem', backgroundColor: '#2a2a2a', color: '#a0a0a0', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>❌ Cancelar</button>
                </div>
              </div>
            )}

            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
              <h2 style={{ color: '#C4A747', marginBottom: '1rem' }}>Usuarios ({users.length})</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#0f0f0f', borderBottom: '2px solid #C4A747' }}>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '600', color: '#C4A747', textTransform: 'uppercase' }}>Nombre</th>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '600', color: '#C4A747', textTransform: 'uppercase' }}>Email</th>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '600', color: '#C4A747', textTransform: 'uppercase' }}>Rol</th>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '600', color: '#C4A747', textTransform: 'uppercase' }}>Empresa</th>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'center', fontWeight: '600', color: '#C4A747', textTransform: 'uppercase' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={{ borderBottom: '1px solid #2a2a2a', opacity: u.activo ? 1 : 0.5 }}>
                        <td style={{ padding: '1rem 0.75rem', color: '#d0d0d0' }}>{u.nombre}</td>
                        <td style={{ padding: '1rem 0.75rem', color: '#d0d0d0' }}>{u.email}</td>
                        <td style={{ padding: '1rem 0.75rem', color: '#d0d0d0' }}>{roles.find(r => r.id === u.rol_id)?.nombre}</td>
                        <td style={{ padding: '1rem 0.75rem', color: '#d0d0d0' }}>{u.empresa}</td>
                        <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                          {u.id !== user.id && (
                            <button onClick={() => handleDeleteUser(u.id)} style={{ background: 'rgba(220, 53, 69, 0.15)', border: '1px solid #dc3545', borderRadius: '4px', padding: '0.5rem 0.75rem', cursor: 'pointer', color: '#ff6b6b', fontFamily: 'inherit' }}>🗑️</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
