import React, { useState, useEffect } from 'react';

const empresas = ['AM SPORTS GROUP SAS', 'PRO INVESTMENTS GLOBAL SAS', 'PRONOVA CAPITAL SAS', 'FOR SEVEN MEDIA SAS', 'ARKO'];
const cecos = ['CECO-001-GF', 'CECO-002-NM', 'CECO-003-GR', 'CECO-004-HR', 'CECO-005-AM', 'CECO-006-VI', 'CECO-007-PRS', 'CECO-008-TRS', 'CECO-009-RTE', 'CECO-010-SS'];
const tiposPago = ['ADMINISTRATIVOS', 'REEMBOLSO', 'ANTICIPO', 'GIRO INTERNO', 'PAGOS GENERAL'];
const tiposSolicitud = ['Anticipo', 'Legalización', 'Reembolso'];
const estadosSolicitud = ['Pendiente', 'Aprobado', 'Pagado'];
const modulosTodos = ['dashboard', 'gastos', 'responsables', 'proveedores', 'solicitudes', 'usuarios', 'roles'];

const rolesDefault = [
  { id: 1, nombre: 'Administrador', permisos: modulosTodos },
  { id: 2, nombre: 'Responsable', permisos: ['dashboard', 'gastos', 'solicitudes'] },
  { id: 3, nombre: 'Revisor', permisos: ['dashboard', 'gastos', 'solicitudes'] },
  { id: 4, nombre: 'Contador', permisos: ['dashboard', 'gastos', 'solicitudes'] }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [responsables, setResponsables] = useState(() => {
    const saved = localStorage.getItem('amResponsables');
    if (saved) return JSON.parse(saved);
    return [
      { id: 1, nombre: 'Cristian Alejandro Giraldo Carvajal', empresa: 'AM SPORTS GROUP SAS' },
      { id: 2, nombre: 'David Dario Andrade Hernández', empresa: 'AM SPORTS GROUP SAS' },
      { id: 3, nombre: 'José David Martínez', empresa: 'AM SPORTS GROUP SAS' },
      { id: 4, nombre: 'Luis Rodrigo Rivas Arboleda', empresa: 'AM SPORTS GROUP SAS' },
      { id: 5, nombre: 'Cristian Camilo Tabares Arango', empresa: 'AM SPORTS GROUP SAS' },
      { id: 6, nombre: 'Arnulfo Beitar Cordoba', empresa: 'AM SPORTS GROUP SAS' },
      { id: 7, nombre: 'Yeison Alejandro Mejía Flórez', empresa: 'AM SPORTS GROUP SAS' },
      { id: 8, nombre: 'Daniel Dario Ríos', empresa: 'AM SPORTS GROUP SAS' },
      { id: 9, nombre: 'Wilfer Andrés Zapata Quiroz', empresa: 'AM SPORTS GROUP SAS' },
      { id: 10, nombre: 'Jamell Orlando Ramos', empresa: 'AM SPORTS GROUP SAS' },
      { id: 11, nombre: 'Sara Cobaleda Vasquez', empresa: 'AM SPORTS GROUP SAS' },
      { id: 12, nombre: 'Julián Suárez Quevedo', empresa: 'AM SPORTS GROUP SAS' },
      { id: 13, nombre: 'Sergio Alejandro Mejía Valencia', empresa: 'PRO INVESTMENTS GLOBAL SAS' },
      { id: 14, nombre: 'Caren Paola Garzón Márquez', empresa: 'PRO INVESTMENTS GLOBAL SAS' },
      { id: 15, nombre: 'Santiago Espinosa', empresa: 'PRO INVESTMENTS GLOBAL SAS' },
      { id: 16, nombre: 'Daniela Salazar', empresa: 'PRO INVESTMENTS GLOBAL SAS' },
      { id: 17, nombre: 'Andrei Martinez Orjuela', empresa: 'PRONOVA CAPITAL SAS' },
      { id: 18, nombre: 'Daniel Santiago Tarquino', empresa: 'FOR SEVEN MEDIA SAS' },
      { id: 19, nombre: 'Juan Camilo Duarte', empresa: 'FOR SEVEN MEDIA SAS' },
      { id: 20, nombre: 'Fabio Andres Galeano', empresa: 'FOR SEVEN MEDIA SAS' },
      { id: 21, nombre: 'Jerónimo Giraldo', empresa: 'FOR SEVEN MEDIA SAS' },
      { id: 22, nombre: 'Nestor Ovidio', empresa: 'ARKO' },
      { id: 23, nombre: 'Jose Pagan', empresa: 'ARKO' },
      { id: 24, nombre: 'Esteban Espindola', empresa: 'ARKO' }
    ];
  });
  
  const [proveedores, setProveedores] = useState(() => JSON.parse(localStorage.getItem('amProveedores') || '[]'));
  const [gastos, setGastos] = useState(() => JSON.parse(localStorage.getItem('amGastos') || '[]'));
  const [solicitudes, setSolicitudes] = useState(() => JSON.parse(localStorage.getItem('amSolicitudes') || '[]'));
  const [usuarios, setUsuarios] = useState(() => {
    const saved = localStorage.getItem('amUsuarios');
    if (saved) return JSON.parse(saved);
    return [{ id: 1, nombre: 'Admin', email: 'admin@amholding.com', password: 'admin123', rol: 'Administrador' }];
  });
  const [roles, setRoles] = useState(() => {
    const saved = localStorage.getItem('amRoles');
    return saved ? JSON.parse(saved) : rolesDefault;
  });
  
  const [newResp, setNewResp] = useState({ nombre: '', empresa: '' });
  const [newProv, setNewProv] = useState({ nombre: '', tipo: '', empresa: '' });
  const [newGasto, setNewGasto] = useState({ fecha: new Date().toISOString().split('T')[0], empresa: '', responsable: '', detalle: '', valor: '', ceco: '', tipoPago: '' });
  const [newSolicitud, setNewSolicitud] = useState({ fecha: new Date().toISOString().split('T')[0], tipo: '', empresa: '', responsable: '', valor: '', detalle: '', estado: 'Pendiente' });
  const [newUsuario, setNewUsuario] = useState({ nombre: '', email: '', password: '', rol: 'Responsable' });
  const [newRol, setNewRol] = useState({ nombre: '', permisos: [] });
  
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [searchGasto, setSearchGasto] = useState('');
  const [filterMes, setFilterMes] = useState('');
  const [filterEstado, setFilterEstado] = useState('');

  useEffect(() => localStorage.setItem('amResponsables', JSON.stringify(responsables)), [responsables]);
  useEffect(() => localStorage.setItem('amProveedores', JSON.stringify(proveedores)), [proveedores]);
  useEffect(() => localStorage.setItem('amGastos', JSON.stringify(gastos)), [gastos]);
  useEffect(() => localStorage.setItem('amSolicitudes', JSON.stringify(solicitudes)), [solicitudes]);
  useEffect(() => localStorage.setItem('amUsuarios', JSON.stringify(usuarios)), [usuarios]);
  useEffect(() => localStorage.setItem('amRoles', JSON.stringify(roles)), [roles]);

  const handleLogin = () => {
    const found = usuarios.find(u => u.email === email && u.password === password);
    if (found) { 
      setUser(found); 
      setEmail(''); 
      setPassword(''); 
      setActiveTab('dashboard');
    }
    else alert('Incorrecto');
  };

  const rolActual = roles.find(r => r.nombre === user?.rol);
  const permisosUsuario = rolActual?.permisos || [];
  const tienePermiso = (modulo) => permisosUsuario.includes(modulo);
  const puedeEditarEstados = user?.rol === 'Administrador' || user?.rol === 'Revisor';

  const handleAddSolicitud = () => {
    if (!newSolicitud.tipo || !newSolicitud.empresa || !newSolicitud.responsable || !newSolicitud.valor) {
      alert('Completa todos los campos');
      return;
    }
    setSolicitudes([...solicitudes, { id: Date.now(), ...newSolicitud, valor: parseFloat(newSolicitud.valor) }]);
    setNewSolicitud({ fecha: new Date().toISOString().split('T')[0], tipo: '', empresa: '', responsable: '', valor: '', detalle: '', estado: 'Pendiente' });
  };

  const handleDeleteSolicitud = (id) => setSolicitudes(solicitudes.filter(s => s.id !== id));

  const handleChangeEstado = (id, nuevoEstado) => {
    setSolicitudes(solicitudes.map(s => s.id === id ? {...s, estado: nuevoEstado} : s));
  };

  const handleAddUsuario = () => {
    if (!newUsuario.nombre || !newUsuario.email || !newUsuario.password || !newUsuario.rol) {
      alert('Completa todos los campos');
      return;
    }
    if (usuarios.some(u => u.email === newUsuario.email)) {
      alert('Email ya existe');
      return;
    }
    setUsuarios([...usuarios, { id: Date.now(), ...newUsuario }]);
    setNewUsuario({ nombre: '', email: '', password: '', rol: 'Responsable' });
  };

  const handleDeleteUsuario = (id) => {
    if (id === user.id) { alert('No puedes eliminar tu propia cuenta'); return; }
    setUsuarios(usuarios.filter(u => u.id !== id));
  };

  const handleAddRol = () => {
    if (!newRol.nombre || newRol.permisos.length === 0) {
      alert('Completa nombre y selecciona al menos un permiso');
      return;
    }
    if (roles.some(r => r.nombre === newRol.nombre)) {
      alert('El rol ya existe');
      return;
    }
    setRoles([...roles, { id: Date.now(), ...newRol }]);
    setNewRol({ nombre: '', permisos: [] });
  };

  const handleTogglePermiso = (modulo) => {
    if (newRol.permisos.includes(modulo)) {
      setNewRol({ ...newRol, permisos: newRol.permisos.filter(p => p !== modulo) });
    } else {
      setNewRol({ ...newRol, permisos: [...newRol.permisos, modulo] });
    }
  };

  const handleAddResponsable = () => {
    if (!newResp.nombre || !newResp.empresa) { alert('Completa campos'); return; }
    setResponsables([...responsables, { id: Date.now(), ...newResp }]);
    setNewResp({ nombre: '', empresa: '' });
  };

  const handleDeleteResponsable = (id) => setResponsables(responsables.filter(r => r.id !== id));

  const handleAddProveedor = () => {
    if (!newProv.nombre || !newProv.empresa) { alert('Completa campos'); return; }
    setProveedores([...proveedores, { id: Date.now(), ...newProv }]);
    setNewProv({ nombre: '', tipo: '', empresa: '' });
  };

  const handleDeleteProveedor = (id) => setProveedores(proveedores.filter(p => p.id !== id));

  const handleAddGasto = () => {
    if (!newGasto.empresa || !newGasto.responsable || !newGasto.detalle || !newGasto.valor || !newGasto.ceco || !newGasto.tipoPago) {
      alert('Completa todos los campos');
      return;
    }
    setGastos([...gastos, { id: Date.now(), ...newGasto, valor: parseFloat(newGasto.valor) }]);
    setNewGasto({ fecha: new Date().toISOString().split('T')[0], empresa: '', responsable: '', detalle: '', valor: '', ceco: '', tipoPago: '' });
  };

  const handleDeleteGasto = (id) => setGastos(gastos.filter(g => g.id !== id));

  const responsablesFiltered = filterEmpresa ? responsables.filter(r => r.empresa === filterEmpresa) : responsables;
  const gastosFiltered = gastos.filter(g => {
    const matchEmpresa = !filterEmpresa || g.empresa === filterEmpresa;
    const matchMes = !filterMes || g.fecha?.startsWith(filterMes);
    const matchSearch = !searchGasto || g.detalle?.toLowerCase().includes(searchGasto.toLowerCase()) || g.responsable?.toLowerCase().includes(searchGasto.toLowerCase());
    return matchEmpresa && matchMes && matchSearch;
  });

  const solicitudesFiltered = solicitudes.filter(s => {
    const matchEmpresa = !filterEmpresa || s.empresa === filterEmpresa;
    const matchEstado = !filterEstado || s.estado === filterEstado;
    return matchEmpresa && matchEstado;
  });

  const getColorEstado = (estado) => {
    if (estado === 'Pendiente') return '#ff6b6b';
    if (estado === 'Aprobado') return '#ffd43b';
    if (estado === 'Pagado') return '#51cf66';
    return '#a0a0a0';
  };

  if (!user) return (
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

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', color: '#fff' }}>
      <header style={{ backgroundColor: '#1a1a1a', borderBottom: '2px solid #C4A747', padding: '1.5rem' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between' }}>
          <div><h1 style={{ color: '#C4A747', margin: 0 }}>AM HOLDING</h1><p style={{ fontSize: '0.85rem', color: '#a0a0a0', margin: '0.5rem 0 0 0' }}>{user.nombre} ({user.rol})</p></div>
          <button onClick={() => setUser(null)} style={{ backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Salir</button>
        </div>
      </header>

      <nav style={{ backgroundColor: '#1a1a1a', borderBottom: '1px solid #2a2a2a', padding: '1rem', overflowX: 'auto' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', gap: '1rem', minWidth: 'fit-content' }}>
          {['dashboard', 'gastos', 'solicitudes', 'responsables', 'proveedores', 'usuarios', 'roles'].map(tab => tienePermiso(tab) && (
            <button key={tab} onClick={() => { setActiveTab(tab); setFilterEmpresa(''); setFilterEstado(''); }} style={{ background: 'none', border: 'none', color: activeTab === tab ? '#C4A747' : '#a0a0a0', cursor: 'pointer', fontWeight: '500', borderBottom: activeTab === tab ? '2px solid #C4A747' : 'none', paddingBottom: '0.5rem', whiteSpace: 'nowrap' }}>
              {tab === 'dashboard' && '📊 Dashboard'}
              {tab === 'gastos' && '💰 Gastos'}
              {tab === 'solicitudes' && '📋 Solicitudes'}
              {tab === 'responsables' && '👥 Responsables'}
              {tab === 'proveedores' && '🏢 Proveedores'}
              {tab === 'usuarios' && '🔑 Usuarios'}
              {tab === 'roles' && '⚙️ Roles'}
            </button>
          ))}
        </div>
      </nav>

      <main style={{ maxWidth: '1400px', margin: '2rem auto', padding: '0 1rem' }}>
        
        {activeTab === 'dashboard' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div style={{ backgroundColor: '#1a1a1a', padding: '1.5rem', borderRadius: '4px', border: '1px solid #2a2a2a', borderLeft: '4px solid #C4A747' }}><p style={{ color: '#a0a0a0', fontSize: '0.85rem', margin: 0 }}>GASTOS</p><p style={{ color: '#C4A747', fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0 0 0' }}>{gastos.length}</p></div>
            <div style={{ backgroundColor: '#1a1a1a', padding: '1.5rem', borderRadius: '4px', border: '1px solid #2a2a2a', borderLeft: '4px solid #C4A747' }}><p style={{ color: '#a0a0a0', fontSize: '0.85rem', margin: 0 }}>SOLICITUDES</p><p style={{ color: '#C4A747', fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0 0 0' }}>{solicitudes.length}</p></div>
            <div style={{ backgroundColor: '#1a1a1a', padding: '1.5rem', borderRadius: '4px', border: '1px solid #2a2a2a', borderLeft: '4px solid #C4A747' }}><p style={{ color: '#a0a0a0', fontSize: '0.85rem', margin: 0 }}>USUARIOS</p><p style={{ color: '#C4A747', fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0 0 0' }}>{usuarios.length}</p></div>
          </div>
        )}

        {activeTab === 'solicitudes' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
              <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
                <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0', fontSize: '1.1rem' }}>➕ Nueva Solicitud</h2>
                <input type="date" value={newSolicitud.fecha} onChange={(e) => setNewSolicitud({...newSolicitud, fecha: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }} />
                <select value={newSolicitud.tipo} onChange={(e) => setNewSolicitud({...newSolicitud, tipo: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }}>
                  <option value="">Tipo</option>
                  {tiposSolicitud.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={newSolicitud.empresa} onChange={(e) => setNewSolicitud({...newSolicitud, empresa: e.target.value, responsable: ''})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }}>
                  <option value="">Empresa</option>
                  {empresas.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                <select value={newSolicitud.responsable} onChange={(e) => setNewSolicitud({...newSolicitud, responsable: e.target.value})} disabled={!newSolicitud.empresa} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box', opacity: newSolicitud.empresa ? 1 : 0.5 }}>
                  <option value="">Responsable</option>
                  {responsablesFiltered.map(r => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
                </select>
                <input type="number" placeholder="Valor" value={newSolicitud.valor} onChange={(e) => setNewSolicitud({...newSolicitud, valor: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }} />
                <input type="text" placeholder="Detalle (opcional)" value={newSolicitud.detalle} onChange={(e) => setNewSolicitud({...newSolicitud, detalle: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }} />
                <button onClick={handleAddSolicitud} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Guardar</button>
              </div>

              <div>
                <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', marginBottom: '1rem' }}>
                  <h2 style={{ color: '#C4A747', margin: '0 0 1rem 0', fontSize: '1.1rem' }}>🔍 Filtros</h2>
                  <select value={filterEmpresa} onChange={(e) => setFilterEmpresa(e.target.value)} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }}>
                    <option value="">Todas las empresas</option>
                    {empresas.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                  <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }}>
                    <option value="">Todos los estados</option>
                    {estadosSolicitud.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div style={{ backgroundColor: '#1a1a1a', padding: '1.5rem', borderRadius: '4px', border: '1px solid #2a2a2a', borderLeft: '4px solid #C4A747' }}>
                  <p style={{ color: '#a0a0a0', fontSize: '0.85rem', margin: 0 }}>SOLICITUDES FILTRADAS</p>
                  <p style={{ color: '#C4A747', fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0 0 0' }}>{solicitudesFiltered.length}</p>
                </div>
              </div>
            </div>

            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', overflowX: 'auto' }}>
              <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0', fontSize: '1.1rem' }}>Solicitudes Pendientes</h2>
              <div style={{ minWidth: '100%', maxHeight: '600px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: '#0f0f0f' }}>
                    <tr style={{ borderBottom: '2px solid #C4A747' }}>
                      <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Fecha</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Tipo</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Responsable</th>
                      <th style={{ textAlign: 'right', padding: '0.75rem', color: '#C4A747' }}>Valor</th>
                      <th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>Estado</th>
                      <th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {solicitudesFiltered.map(s => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                        <td style={{ padding: '0.75rem', color: '#a0a0a0' }}>{s.fecha}</td>
                        <td style={{ padding: '0.75rem', color: '#a0a0a0' }}>{s.tipo}</td>
                        <td style={{ padding: '0.75rem', color: '#a0a0a0' }}>{s.responsable?.split(' ')[0]}</td>
                        <td style={{ padding: '0.75rem', color: '#C4A747', textAlign: 'right', fontWeight: 'bold' }}>$ {(s.valor || 0).toLocaleString()}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          {puedeEditarEstados ? (
                            <select value={s.estado} onChange={(e) => handleChangeEstado(s.id, e.target.value)} style={{ backgroundColor: getColorEstado(s.estado), color: '#0f0f0f', border: 'none', padding: '0.4rem 0.6rem', borderRadius: '3px', fontWeight: 'bold', cursor: 'pointer' }}>
                              {estadosSolicitud.map(e => <option key={e} value={e}>{e}</option>)}
                            </select>
                          ) : (
                            <span style={{ backgroundColor: getColorEstado(s.estado), color: '#0f0f0f', padding: '0.4rem 0.8rem', borderRadius: '3px', fontWeight: 'bold', fontSize: '0.8rem' }}>{s.estado}</span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}><button onClick={() => handleDeleteSolicitud(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff6b6b' }}>🗑️</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'gastos' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
              <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
                <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0', fontSize: '1.1rem' }}>➕ Nuevo Gasto</h2>
                <input type="date" value={newGasto.fecha} onChange={(e) => setNewGasto({...newGasto, fecha: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }} />
                <select value={newGasto.empresa} onChange={(e) => setNewGasto({...newGasto, empresa: e.target.value, responsable: ''})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }}>
                  <option value="">Empresa</option>
                  {empresas.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                <select value={newGasto.responsable} onChange={(e) => setNewGasto({...newGasto, responsable: e.target.value})} disabled={!newGasto.empresa} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box', opacity: newGasto.empresa ? 1 : 0.5 }}>
                  <option value="">Responsable</option>
                  {responsablesFiltered.map(r => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
                </select>
                <input type="text" placeholder="Detalle del gasto" value={newGasto.detalle} onChange={(e) => setNewGasto({...newGasto, detalle: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }} />
                <input type="number" placeholder="Valor" value={newGasto.valor} onChange={(e) => setNewGasto({...newGasto, valor: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }} />
                <select value={newGasto.ceco} onChange={(e) => setNewGasto({...newGasto, ceco: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }}>
                  <option value="">CECO</option>
                  {cecos.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={newGasto.tipoPago} onChange={(e) => setNewGasto({...newGasto, tipoPago: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }}>
                  <option value="">Tipo de Pago</option>
                  {tiposPago.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button onClick={handleAddGasto} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Guardar</button>
              </div>

              <div>
                <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', marginBottom: '1rem' }}>
                  <h2 style={{ color: '#C4A747', margin: '0 0 1rem 0', fontSize: '1.1rem' }}>🔍 Filtros</h2>
                  <select value={filterEmpresa} onChange={(e) => setFilterEmpresa(e.target.value)} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }}>
                    <option value="">Todas las empresas</option>
                    {empresas.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                  <input type="month" value={filterMes} onChange={(e) => setFilterMes(e.target.value)} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }} />
                  <input type="text" placeholder="Buscar por detalle o responsable" value={searchGasto} onChange={(e) => setSearchGasto(e.target.value)} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }} />
                </div>
              </div>
            </div>

            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', overflowX: 'auto' }}>
              <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0', fontSize: '1.1rem' }}>Registro de Gastos</h2>
              <div style={{ minWidth: '100%', maxHeight: '600px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: '#0f0f0f' }}>
                    <tr style={{ borderBottom: '2px solid #C4A747' }}>
                      <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Fecha</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Empresa</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Responsable</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Detalle</th>
                      <th style={{ textAlign: 'right', padding: '0.75rem', color: '#C4A747' }}>Valor</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>CECO</th>
                      <th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gastosFiltered.map(g => (
                      <tr key={g.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                        <td style={{ padding: '0.75rem', color: '#a0a0a0' }}>{g.fecha}</td>
                        <td style={{ padding: '0.75rem', color: '#a0a0a0' }}>{g.empresa?.split(' ')[0]}</td>
                        <td style={{ padding: '0.75rem', color: '#a0a0a0' }}>{g.responsable?.split(' ')[0]}</td>
                        <td style={{ padding: '0.75rem', color: '#a0a0a0', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.detalle}</td>
                        <td style={{ padding: '0.75rem', color: '#C4A747', textAlign: 'right', fontWeight: 'bold' }}>$ {(g.valor || 0).toLocaleString()}</td>
                        <td style={{ padding: '0.75rem', color: '#a0a0a0', fontSize: '0.75rem' }}>{g.ceco}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}><button onClick={() => handleDeleteGasto(g.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff6b6b' }}>🗑️</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'responsables' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
              <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0', fontSize: '1.1rem' }}>➕ Agregar</h2>
              <input type="text" placeholder="Nombre" value={newResp.nombre} onChange={(e) => setNewResp({...newResp, nombre: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }} />
              <select value={newResp.empresa} onChange={(e) => setNewResp({...newResp, empresa: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }}>
                <option value="">Empresa</option>
                {empresas.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <button onClick={handleAddResponsable} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Guardar</button>
            </div>
            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
              <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0', fontSize: '1.1rem' }}>Lista ({responsables.length})</h2>
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {responsables.map(r => (
                  <div key={r.id} style={{ backgroundColor: '#0f0f0f', padding: '0.75rem', borderRadius: '4px', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div><p style={{ color: '#C4A747', margin: 0, fontSize: '0.9rem', fontWeight: 'bold' }}>{r.nombre.split(' ')[0]}</p><p style={{ color: '#7a7a7a', fontSize: '0.75rem', margin: '0.25rem 0 0 0' }}>{r.empresa.split(' ')[0]}</p></div>
                    <button onClick={() => handleDeleteResponsable(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff6b6b', fontSize: '1rem' }}>🗑️</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'proveedores' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
              <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0', fontSize: '1.1rem' }}>➕ Agregar</h2>
              <input type="text" placeholder="Nombre" value={newProv.nombre} onChange={(e) => setNewProv({...newProv, nombre: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }} />
              <input type="text" placeholder="Tipo" value={newProv.tipo} onChange={(e) => setNewProv({...newProv, tipo: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }} />
              <select value={newProv.empresa} onChange={(e) => setNewProv({...newProv, empresa: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }}>
                <option value="">Empresa</option>
                {empresas.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <button onClick={handleAddProveedor} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Guardar</button>
            </div>
            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
              <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0', fontSize: '1.1rem' }}>Lista ({proveedores.length})</h2>
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {proveedores.map(p => (
                  <div key={p.id} style={{ backgroundColor: '#0f0f0f', padding: '0.75rem', borderRadius: '4px', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div><p style={{ color: '#C4A747', margin: 0, fontSize: '0.9rem', fontWeight: 'bold' }}>{p.nombre}</p><p style={{ color: '#7a7a7a', fontSize: '0.75rem', margin: '0.25rem 0 0 0' }}>{p.tipo}</p></div>
                    <button onClick={() => handleDeleteProveedor(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff6b6b', fontSize: '1rem' }}>🗑️</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'usuarios' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
              <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0', fontSize: '1.1rem' }}>➕ Nuevo Usuario</h2>
              <input type="text" placeholder="Nombre" value={newUsuario.nombre} onChange={(e) => setNewUsuario({...newUsuario, nombre: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }} />
              <input type="email" placeholder="Email" value={newUsuario.email} onChange={(e) => setNewUsuario({...newUsuario, email: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }} />
              <input type="password" placeholder="Contraseña" value={newUsuario.password} onChange={(e) => setNewUsuario({...newUsuario, password: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }} />
              <select value={newUsuario.rol} onChange={(e) => setNewUsuario({...newUsuario, rol: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }}>
                {roles.map(r => <option key={r.nombre} value={r.nombre}>{r.nombre}</option>)}
              </select>
              <button onClick={handleAddUsuario} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Guardar</button>
            </div>
            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
              <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0', fontSize: '1.1rem' }}>Lista ({usuarios.length})</h2>
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {usuarios.map(u => (
                  <div key={u.id} style={{ backgroundColor: '#0f0f0f', padding: '1rem', borderRadius: '4px', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <p style={{ color: '#C4A747', margin: 0, fontWeight: 'bold' }}>{u.nombre}</p>
                        <p style={{ color: '#7a7a7a', fontSize: '0.8rem', margin: '0.25rem 0 0 0' }}>{u.email}</p>
                        <p style={{ color: '#C4A747', fontSize: '0.75rem', margin: '0.5rem 0 0 0', backgroundColor: '#1a1a1a', padding: '0.25rem 0.5rem', borderRadius: '2px', display: 'inline-block' }}>{u.rol}</p>
                      </div>
                      {u.id !== user.id && <button onClick={() => handleDeleteUsuario(u.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff6b6b' }}>🗑️</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'roles' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
              <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0', fontSize: '1.1rem' }}>➕ Nuevo Rol</h2>
              <input type="text" placeholder="Nombre del rol" value={newRol.nombre} onChange={(e) => setNewRol({...newRol, nombre: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }} />
              <p style={{ color: '#a0a0a0', fontSize: '0.9rem', margin: '0 0 1rem 0' }}>Permisos:</p>
              {modulosTodos.map(mod => (
                <label key={mod} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={newRol.permisos.includes(mod)} onChange={() => handleTogglePermiso(mod)} style={{ marginRight: '0.75rem', cursor: 'pointer', width: '16px', height: '16px' }} />
                  <span style={{ color: '#a0a0a0', textTransform: 'capitalize' }}>{mod}</span>
                </label>
              ))}
              <button onClick={handleAddRol} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginTop: '1rem' }}>Guardar</button>
            </div>
            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
              <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0', fontSize: '1.1rem' }}>Roles ({roles.length})</h2>
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {roles.map(r => (
                  <div key={r.nombre} style={{ backgroundColor: '#0f0f0f', padding: '1rem', borderRadius: '4px', marginBottom: '0.75rem' }}>
                    <p style={{ color: '#C4A747', margin: 0, fontWeight: 'bold' }}>{r.nombre}</p>
                    <p style={{ color: '#7a7a7a', fontSize: '0.8rem', margin: '0.5rem 0 0 0' }}>Permisos: {r.permisos.join(', ')}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
