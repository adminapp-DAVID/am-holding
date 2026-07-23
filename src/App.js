import React, { useState, useEffect } from 'react';

function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [responsables, setResponsables] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [cuentasCobro, setCuentasCobro] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [editingUser, setEditingUser] = useState(null);

  // Roles y usuarios iniciales
  const defaultRoles = [
    {
      id: 'admin',
      nombre: 'Administrador',
      descripcion: 'Super usuario con acceso total',
      permisos: {
        gastos: { ver: true, crear: true, editar: true, eliminar: true, exportar: true },
        responsables: { ver: true, crear: true, editar: true, eliminar: true, asignar_roles: true },
        solicitudes: { ver: true, crear: true, aprobar: true, rechazar: true },
        cuentas_cobro: { ver: true, crear: true, aprobar: true, marcar_pagada: true },
        dashboard: { ver: true, ver_analytics: true },
        roles: { crear: true, editar: true, eliminar: true, asignar: true }
      }
    },
    {
      id: 'responsable',
      nombre: 'Responsable',
      descripcion: 'Usuario básico',
      permisos: {
        gastos: { ver: false, crear: false, editar: false, eliminar: false, exportar: false },
        responsables: { ver: false, crear: false, editar: false, eliminar: false, asignar_roles: false },
        solicitudes: { ver: true, crear: true, aprobar: false, rechazar: false },
        cuentas_cobro: { ver: true, crear: true, aprobar: false, marcar_pagada: false },
        dashboard: { ver: true, ver_analytics: false },
        roles: { crear: false, editar: false, eliminar: false, asignar: false }
      }
    },
    {
      id: 'revisor',
      nombre: 'Revisor',
      descripcion: 'Aprueba solicitudes',
      permisos: {
        gastos: { ver: true, crear: false, editar: false, eliminar: false, exportar: false },
        responsables: { ver: true, crear: false, editar: false, eliminar: false, asignar_roles: false },
        solicitudes: { ver: true, crear: false, aprobar: true, rechazar: true },
        cuentas_cobro: { ver: true, crear: false, aprobar: false, marcar_pagada: false },
        dashboard: { ver: true, ver_analytics: false },
        roles: { crear: false, editar: false, eliminar: false, asignar: false }
      }
    },
    {
      id: 'contador',
      nombre: 'Contador',
      descripcion: 'Exporta y genera reportes',
      permisos: {
        gastos: { ver: true, crear: false, editar: false, eliminar: false, exportar: true },
        responsables: { ver: true, crear: false, editar: false, eliminar: false, asignar_roles: false },
        solicitudes: { ver: true, crear: false, aprobar: false, rechazar: false },
        cuentas_cobro: { ver: true, crear: false, aprobar: false, marcar_pagada: false },
        dashboard: { ver: true, ver_analytics: true },
        roles: { crear: false, editar: false, eliminar: false, asignar: false }
      }
    }
  ];

  const defaultUsers = [
    { id: 1, nombre: 'Admin', email: 'admin@amholding.com', password: 'admin123', rol_id: 'admin', empresa: 'AM HOLDING', activo: true }
  ];

  useEffect(() => {
    const savedRoles = localStorage.getItem('amRoles');
    const savedUsers = localStorage.getItem('amUsers');
    const savedTransactions = localStorage.getItem('amTransactions');
    const savedResponsables = localStorage.getItem('amResponsables');
    const savedSolicitudes = localStorage.getItem('amSolicitudes');
    const savedCuentasCobro = localStorage.getItem('amCuentasCobro');

    setRoles(savedRoles ? JSON.parse(savedRoles) : defaultRoles);
    setUsers(savedUsers ? JSON.parse(savedUsers) : defaultUsers);
    setTransactions(savedTransactions ? JSON.parse(savedTransactions) : []);
    setResponsables(savedResponsables ? JSON.parse(savedResponsables) : []);
    setSolicitudes(savedSolicitudes ? JSON.parse(savedSolicitudes) : []);
    setCuentasCobro(savedCuentasCobro ? JSON.parse(savedCuentasCobro) : []);
  }, []);

  useEffect(() => {
    localStorage.setItem('amRoles', JSON.stringify(roles));
  }, [roles]);

  useEffect(() => {
    localStorage.setItem('amUsers', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('amTransactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('amResponsables', JSON.stringify(responsables));
  }, [responsables]);

  useEffect(() => {
    localStorage.setItem('amSolicitudes', JSON.stringify(solicitudes));
  }, [solicitudes]);

  useEffect(() => {
    localStorage.setItem('amCuentasCobro', JSON.stringify(cuentasCobro));
  }, [cuentasCobro]);

  // Obtener permisos del usuario actual
  const getUserRole = () => {
    if (!user) return null;
    return roles.find(r => r.id === user.rol_id);
  };

  const canAccess = (module, permission) => {
    const userRole = getUserRole();
    if (!userRole) return false;
    if (user.rol_id === 'admin') return true;
    return userRole.permisos[module] && userRole.permisos[module][permission];
  };

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

  const handleCreateRole = (roleData) => {
    if (editingRole) {
      setRoles(roles.map(r => r.id === editingRole.id ? { ...roleData, id: editingRole.id } : r));
      setEditingRole(null);
    } else {
      setRoles([...roles, { ...roleData, id: Date.now().toString() }]);
    }
    setShowRoleForm(false);
  };

  const handleDeleteRole = (roleId) => {
    if (users.some(u => u.rol_id === roleId)) {
      alert('No puedes eliminar un rol que tiene usuarios asignados');
      return;
    }
    setRoles(roles.filter(r => r.id !== roleId));
  };

  const handleCreateUser = (userData) => {
    if (editingUser) {
      setUsers(users.map(u => u.id === editingUser.id ? { ...userData, id: editingUser.id } : u));
      setEditingUser(null);
    } else {
      setUsers([...users, { ...userData, id: Date.now() }]);
    }
    setShowUserForm(false);
  };

  const handleDeleteUser = (userId) => {
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
          <h1 style={{ fontSize: '3.5rem', color: '#C4A747', margin: '0 0 1rem 0', fontWeight: '700', letterSpacing: '2px' }}>AM HOLDING</h1>
          <p style={{ color: '#a0a0a0', margin: '0 0 2rem 0', fontSize: '1rem' }}>Control de Gastos Corporativos</p>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #C4A747', borderRadius: '4px', color: '#C4A747', marginBottom: '1rem', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleLogin()} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #C4A747', borderRadius: '4px', color: '#C4A747', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>

          {error && <p style={{ color: '#dc2626', margin: '0 0 1rem 0', fontSize: '0.9rem' }}>❌ {error}</p>}

          <button onClick={handleLogin} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', fontFamily: 'inherit' }}>
            Iniciar sesión
          </button>

          <p style={{ color: '#7a7a7a', margin: '1.5rem 0 0 0', fontSize: '0.85rem' }}>
            Demo:<br/>
            admin@amholding.com / admin123
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
            <p style={{ fontSize: '0.85rem', color: '#a0a0a0', margin: '0.25rem 0 0 0' }}>{user.nombre} • {getUserRole()?.nombre || 'Sin rol'}</p>
          </div>
          <button onClick={handleLogout} style={{ backgroundColor: 'rgba(196, 167, 71, 0.1)', border: '1px solid #C4A747', borderRadius: '4px', padding: '0.75rem 1.25rem', color: '#C4A747', cursor: 'pointer', fontWeight: 'bold', fontFamily: 'inherit' }}>
            Salir
          </button>
        </div>

        <nav style={{ maxWidth: '1400px', margin: '1rem auto 0', display: 'flex', gap: '2rem', borderTop: '1px solid rgba(196, 167, 71, 0.2)', paddingTop: '1rem', overflowX: 'auto', flexWrap: 'wrap' }}>
          {canAccess('dashboard', 'ver') && (
            <button onClick={() => setActiveTab('dashboard')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'dashboard' ? '3px solid #C4A747' : 'none', color: activeTab === 'dashboard' ? '#C4A747' : '#a0a0a0', cursor: 'pointer', fontWeight: '500', paddingBottom: '0.5rem', whiteSpace: 'nowrap' }}>
              📊 Dashboard
            </button>
          )}
          
          {canAccess('gastos', 'crear') && (
            <button onClick={() => setActiveTab('registro')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'registro' ? '3px solid #C4A747' : 'none', color: activeTab === 'registro' ? '#C4A747' : '#a0a0a0', cursor: 'pointer', fontWeight: '500', paddingBottom: '0.5rem', whiteSpace: 'nowrap' }}>
              ➕ Nuevo Gasto
            </button>
          )}

          {canAccess('gastos', 'ver') && (
            <button onClick={() => setActiveTab('movimientos')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'movimientos' ? '3px solid #C4A747' : 'none', color: activeTab === 'movimientos' ? '#C4A747' : '#a0a0a0', cursor: 'pointer', fontWeight: '500', paddingBottom: '0.5rem', whiteSpace: 'nowrap' }}>
              📋 Movimientos
            </button>
          )}

          {canAccess('responsables', 'crear') && (
            <button onClick={() => setActiveTab('responsables')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'responsables' ? '3px solid #C4A747' : 'none', color: activeTab === 'responsables' ? '#C4A747' : '#a0a0a0', cursor: 'pointer', fontWeight: '500', paddingBottom: '0.5rem', whiteSpace: 'nowrap' }}>
              👥 Responsables
            </button>
          )}

          {canAccess('cuentas_cobro', 'ver') && (
            <button onClick={() => setActiveTab('cuentas')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'cuentas' ? '3px solid #C4A747' : 'none', color: activeTab === 'cuentas' ? '#C4A747' : '#a0a0a0', cursor: 'pointer', fontWeight: '500', paddingBottom: '0.5rem', whiteSpace: 'nowrap' }}>
              💰 Cuentas Cobro
            </button>
          )}

          {canAccess('roles', 'crear') && (
            <>
              <button onClick={() => setActiveTab('roles')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'roles' ? '3px solid #C4A747' : 'none', color: activeTab === 'roles' ? '#C4A747' : '#a0a0a0', cursor: 'pointer', fontWeight: '500', paddingBottom: '0.5rem', whiteSpace: 'nowrap' }}>
                ⚙️ Roles
              </button>

              <button onClick={() => setActiveTab('usuarios')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'usuarios' ? '3px solid #C4A747' : 'none', color: activeTab === 'usuarios' ? '#C4A747' : '#a0a0a0', cursor: 'pointer', fontWeight: '500', paddingBottom: '0.5rem', whiteSpace: 'nowrap' }}>
                👤 Usuarios
              </button>
            </>
          )}
        </nav>
      </header>

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 1rem' }}>
        
        {/* DASHBOARD */}
        {activeTab === 'dashboard' && canAccess('dashboard', 'ver') && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ backgroundColor: '#1a1a1a', padding: '1.75rem', borderRadius: '4px', border: '1px solid #2a2a2a', borderLeft: '4px solid #C4A747' }}>
                <p style={{ fontSize: '0.85rem', color: '#a0a0a0', margin: 0, textTransform: 'uppercase' }}>Total Gastos</p>
                <p style={{ fontSize: '2rem', fontWeight: '700', color: '#C4A747', margin: '0.5rem 0 0 0' }}>${(transactions.reduce((sum, t) => sum + t.valor, 0) / 1000000).toFixed(1)}M</p>
              </div>
              <div style={{ backgroundColor: '#1a1a1a', padding: '1.75rem', borderRadius: '4px', border: '1px solid #2a2a2a', borderLeft: '4px solid #C4A747' }}>
                <p style={{ fontSize: '0.85rem', color: '#a0a0a0', margin: 0, textTransform: 'uppercase' }}>Registros</p>
                <p style={{ fontSize: '2rem', fontWeight: '700', color: '#C4A747', margin: '0.5rem 0 0 0' }}>{transactions.length}</p>
              </div>
              <div style={{ backgroundColor: '#1a1a1a', padding: '1.75rem', borderRadius: '4px', border: '1px solid #2a2a2a', borderLeft: '4px solid #C4A747' }}>
                <p style={{ fontSize: '0.85rem', color: '#a0a0a0', margin: 0, textTransform: 'uppercase' }}>Solicitudes Pendientes</p>
                <p style={{ fontSize: '2rem', fontWeight: '700', color: '#C4A747', margin: '0.5rem 0 0 0' }}>{solicitudes.filter(s => s.estado === 'PENDIENTE').length}</p>
              </div>
              <div style={{ backgroundColor: '#1a1a1a', padding: '1.75rem', borderRadius: '4px', border: '1px solid #2a2a2a', borderLeft: '4px solid #C4A747' }}>
                <p style={{ fontSize: '0.85rem', color: '#a0a0a0', margin: 0, textTransform: 'uppercase' }}>Usuarios Activos</p>
                <p style={{ fontSize: '2rem', fontWeight: '700', color: '#C4A747', margin: '0.5rem 0 0 0' }}>{users.filter(u => u.activo).length}</p>
              </div>
            </div>
            
            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', textAlign: 'center' }}>
              <h2 style={{ color: '#C4A747', margin: '0 0 1rem 0' }}>✅ Sistema Operativo</h2>
              <p style={{ color: '#a0a0a0', margin: 0 }}>Bienvenido {user.nombre} • {getUserRole()?.nombre}</p>
            </div>
          </div>
        )}

        {/* GESTIÓN DE ROLES */}
        {activeTab === 'roles' && canAccess('roles', 'crear') && (
          <div>
            <button onClick={() => { setShowRoleForm(!showRoleForm); setEditingRole(null); }} style={{ backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', padding: '0.75rem 1.5rem', fontWeight: 'bold', cursor: 'pointer', marginBottom: '2rem', fontFamily: 'inherit' }}>
              ➕ Crear Rol
            </button>

            {showRoleForm && <RoleForm onSubmit={handleCreateRole} onCancel={() => setShowRoleForm(false)} editingRole={editingRole} />}

            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: '0 0 1.75rem 0', color: '#C4A747' }}>⚙️ Roles ({roles.length})</h2>
              
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#0f0f0f', borderBottom: '2px solid #C4A747' }}>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '600', color: '#C4A747', fontSize: '0.85rem', textTransform: 'uppercase' }}>Nombre</th>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '600', color: '#C4A747', fontSize: '0.85rem', textTransform: 'uppercase' }}>Descripción</th>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'center', fontWeight: '600', color: '#C4A747', fontSize: '0.85rem', textTransform: 'uppercase' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles.map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                        <td style={{ padding: '1rem 0.75rem', color: '#d0d0d0' }}><strong>{r.nombre}</strong></td>
                        <td style={{ padding: '1rem 0.75rem', color: '#d0d0d0' }}>{r.descripcion}</td>
                        <td style={{ padding: '1rem 0.75rem', textAlign: 'center', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button onClick={() => { setEditingRole(r); setShowRoleForm(true); }} style={{ background: 'rgba(196, 167, 71, 0.15)', border: '1px solid #C4A747', borderRadius: '4px', padding: '0.5rem 0.75rem', cursor: 'pointer', color: '#C4A747', fontFamily: 'inherit' }}>✏️</button>
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

        {/* GESTIÓN DE USUARIOS */}
        {activeTab === 'usuarios' && canAccess('roles', 'asignar') && (
          <div>
            <button onClick={() => { setShowUserForm(!showUserForm); setEditingUser(null); }} style={{ backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', padding: '0.75rem 1.5rem', fontWeight: 'bold', cursor: 'pointer', marginBottom: '2rem', fontFamily: 'inherit' }}>
              ➕ Crear Usuario
            </button>

            {showUserForm && <UserForm onSubmit={handleCreateUser} onCancel={() => setShowUserForm(false)} editingUser={editingUser} roles={roles} />}

            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: '0 0 1.75rem 0', color: '#C4A747' }}>👤 Usuarios ({users.length})</h2>
              
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#0f0f0f', borderBottom: '2px solid #C4A747' }}>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '600', color: '#C4A747', fontSize: '0.85rem', textTransform: 'uppercase' }}>Nombre</th>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '600', color: '#C4A747', fontSize: '0.85rem', textTransform: 'uppercase' }}>Email</th>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '600', color: '#C4A747', fontSize: '0.85rem', textTransform: 'uppercase' }}>Rol</th>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '600', color: '#C4A747', fontSize: '0.85rem', textTransform: 'uppercase' }}>Empresa</th>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'center', fontWeight: '600', color: '#C4A747', fontSize: '0.85rem', textTransform: 'uppercase' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={{ borderBottom: '1px solid #2a2a2a', opacity: u.activo ? 1 : 0.5 }}>
                        <td style={{ padding: '1rem 0.75rem', color: '#d0d0d0' }}><strong>{u.nombre}</strong></td>
                        <td style={{ padding: '1rem 0.75rem', color: '#d0d0d0' }}>{u.email}</td>
                        <td style={{ padding: '1rem 0.75rem', color: '#d0d0d0' }}>{roles.find(r => r.id === u.rol_id)?.nombre}</td>
                        <td style={{ padding: '1rem 0.75rem', color: '#d0d0d0' }}>{u.empresa}</td>
                        <td style={{ padding: '1rem 0.75rem', textAlign: 'center', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button onClick={() => { setEditingUser(u); setShowUserForm(true); }} style={{ background: 'rgba(196, 167, 71, 0.15)', border: '1px solid #C4A747', borderRadius: '4px', padding: '0.5rem 0.75rem', cursor: 'pointer', color: '#C4A747', fontFamily: 'inherit' }}>✏️</button>
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

        {/* OTROS TABS - Placeholder */}
        {activeTab === 'registro' && canAccess('gastos', 'crear') && (
          <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
            <h2 style={{ color: '#C4A747' }}>➕ Nuevo Gasto</h2>
            <p style={{ color: '#a0a0a0' }}>Funcionalidad de registro de gastos (próxima fase)</p>
          </div>
        )}

        {activeTab === 'movimientos' && canAccess('gastos', 'ver') && (
          <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
            <h2 style={{ color: '#C4A747' }}>📋 Movimientos</h2>
            <p style={{ color: '#a0a0a0' }}>Total registros: {transactions.length}</p>
          </div>
        )}

        {activeTab === 'responsables' && canAccess('responsables', 'crear') && (
          <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
            <h2 style={{ color: '#C4A747' }}>👥 Responsables</h2>
            <p style={{ color: '#a0a0a0' }}>Total: {responsables.length}</p>
          </div>
        )}

        {activeTab === 'cuentas' && canAccess('cuentas_cobro', 'ver') && (
          <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
            <h2 style={{ color: '#C4A747' }}>💰 Cuentas de Cobro</h2>
            <p style={{ color: '#a0a0a0' }}>Total: {cuentasCobro.length}</p>
          </div>
        )}
      </main>
    </div>
  );
}

// Componente: Formulario de Rol
function RoleForm({ onSubmit, onCancel, editingRole }) {
  const [formData, setFormData] = useState(editingRole || {
    nombre: '',
    descripcion: '',
    permisos: {
      gastos: { ver: false, crear: false, editar: false, eliminar: false, exportar: false },
      responsables: { ver: false, crear: false, editar: false, eliminar: false, asignar_roles: false },
      solicitudes: { ver: false, crear: false, aprobar: false, rechazar: false },
      cuentas_cobro: { ver: false, crear: false, aprobar: false, marcar_pagada: false },
      dashboard: { ver: false, ver_analytics: false },
      roles: { crear: false, editar: false, eliminar: false, asignar: false }
    }
  });

  const togglePermiso = (modulo, permiso) => {
    setFormData({
      ...formData,
      permisos: {
        ...formData.permisos,
        [modulo]: {
          ...formData.permisos[modulo],
          [permiso]: !formData.permisos[modulo][permiso]
        }
      }
    });
  };

  return (
    <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: '0 0 1.75rem 0', color: '#C4A747' }}>{editingRole ? '✏️ Editar Rol' : '➕ Crear Rol'}</h2>
      
      <div style={{ marginBottom: '2rem' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', display: 'block', marginBottom: '0.5rem' }}>NOMBRE</label>
        <input type="text" value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '1rem' }} placeholder="Ej: Revisor Especializado" />
        
        <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', display: 'block', marginBottom: '0.5rem' }}>DESCRIPCIÓN</label>
        <input type="text" value={formData.descripcion} onChange={(e) => setFormData({...formData, descripcion: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '2rem' }} placeholder="Descripción del rol" />
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ color: '#C4A747', marginBottom: '1rem' }}>PERMISOS</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', backgroundColor: '#0f0f0f', padding: '1rem', borderRadius: '4px' }}>
          <div>
            <h4 style={{ color: '#a0a0a0', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Gastos</h4>
            {['ver', 'crear', 'editar', 'eliminar', 'exportar'].map(p => (
              <label key={p} style={{ display: 'block', color: '#d0d0d0', marginBottom: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={formData.permisos.gastos[p]} onChange={() => togglePermiso('gastos', p)} style={{ marginRight: '0.5rem' }} />
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </label>
            ))}
          </div>

          <div>
            <h4 style={{ color: '#a0a0a0', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Responsables</h4>
            {['ver', 'crear', 'editar', 'eliminar', 'asignar_roles'].map(p => (
              <label key={p} style={{ display: 'block', color: '#d0d0d0', marginBottom: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={formData.permisos.responsables[p]} onChange={() => togglePermiso('responsables', p)} style={{ marginRight: '0.5rem' }} />
                {p.replace('_', ' ').charAt(0).toUpperCase() + p.slice(1).replace('_', ' ')}
              </label>
            ))}
          </div>

          <div>
            <h4 style={{ color: '#a0a0a0', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Solicitudes</h4>
            {['ver', 'crear', 'aprobar', 'rechazar'].map(p => (
              <label key={p} style={{ display: 'block', color: '#d0d0d0', marginBottom: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={formData.permisos.solicitudes[p]} onChange={() => togglePermiso('solicitudes', p)} style={{ marginRight: '0.5rem' }} />
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </label>
            ))}
          </div>

          <div>
            <h4 style={{ color: '#a0a0a0', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Cuentas de Cobro</h4>
            {['ver', 'crear', 'aprobar', 'marcar_pagada'].map(p => (
              <label key={p} style={{ display: 'block', color: '#d0d0d0', marginBottom: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={formData.permisos.cuentas_cobro[p]} onChange={() => togglePermiso('cuentas_cobro', p)} style={{ marginRight: '0.5rem' }} />
                {p.replace('_', ' ').charAt(0).toUpperCase() + p.slice(1).replace('_', ' ')}
              </label>
            ))}
          </div>

          <div>
            <h4 style={{ color: '#a0a0a0', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Dashboard</h4>
            {['ver', 'ver_analytics'].map(p => (
              <label key={p} style={{ display: 'block', color: '#d0d0d0', marginBottom: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={formData.permisos.dashboard[p]} onChange={() => togglePermiso('dashboard', p)} style={{ marginRight: '0.5rem' }} />
                {p === 'ver_analytics' ? 'Ver Analytics' : 'Ver'}
              </label>
            ))}
          </div>

          <div>
            <h4 style={{ color: '#a0a0a0', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Roles</h4>
            {['crear', 'editar', 'eliminar', 'asignar'].map(p => (
              <label key={p} style={{ display: 'block', color: '#d0d0d0', marginBottom: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={formData.permisos.roles[p]} onChange={() => togglePermiso('roles', p)} style={{ marginRight: '0.5rem' }} />
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <button onClick={() => onSubmit(formData)} style={{ flex: 1, padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>
          💾 {editingRole ? 'Actualizar' : 'Crear'}
        </button>
        <button onClick={onCancel} style={{ flex: 1, padding: '0.75rem', backgroundColor: '#2a2a2a', color: '#a0a0a0', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>
          ❌ Cancelar
        </button>
      </div>
    </div>
  );
}

// Componente: Formulario de Usuario
function UserForm({ onSubmit, onCancel, editingUser, roles }) {
  const [formData, setFormData] = useState(editingUser || {
    nombre: '',
    email: '',
    password: Math.random().toString(36).slice(-8),
    rol_id: '',
    empresa: '',
    activo: true
  });

  return (
    <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: '0 0 1.75rem 0', color: '#C4A747' }}>{editingUser ? '✏️ Editar Usuario' : '👤 Crear Usuario'}</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', display: 'block', marginBottom: '0.5rem' }}>NOMBRE</label>
          <input type="text" value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }} placeholder="Nombre completo" />
        </div>

        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', display: 'block', marginBottom: '0.5rem' }}>EMAIL</label>
          <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }} placeholder="email@company.com" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', display: 'block', marginBottom: '0.5rem' }}>ROL</label>
          <select value={formData.rol_id} onChange={(e) => setFormData({...formData, rol_id: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }}>
            <option value="">Seleccionar</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', display: 'block', marginBottom: '0.5rem' }}>EMPRESA</label>
          <input type="text" value={formData.empresa} onChange={(e) => setFormData({...formData, empresa: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }} placeholder="Empresa" />
        </div>
      </div>

      {!editingUser && (
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', display: 'block', marginBottom: '0.5rem' }}>CONTRASEÑA (auto-generada)</label>
          <input type="text" value={formData.password} disabled style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#7a7a7a', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem' }}>
        <button onClick={() => onSubmit(formData)} style={{ flex: 1, padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>
          💾 {editingUser ? 'Actualizar' : 'Crear'}
        </button>
        <button onClick={onCancel} style={{ flex: 1, padding: '0.75rem', backgroundColor: '#2a2a2a', color: '#a0a0a0', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>
          ❌ Cancelar
        </button>
      </div>
    </div>
  );
}

export default App;
