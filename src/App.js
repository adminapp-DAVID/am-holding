/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';

const empresas = ['AM SPORTS GROUP SAS', 'PRO INVESTMENTS GLOBAL SAS', 'PRONOVA CAPITAL SAS', 'FOR SEVEN MEDIA SAS', 'ARKO'];
const cecos = ['CECO-001-GF', 'CECO-002-NM', 'CECO-003-GR', 'CECO-004-HR', 'CECO-005-AM', 'CECO-006-VI', 'CECO-007-PRS', 'CECO-008-TRS', 'CECO-009-RTE', 'CECO-010-SS'];
const tiposPago = ['ADMINISTRATIVOS', 'REEMBOLSO', 'ANTICIPO', 'GIRO INTERNO', 'PAGOS GENERAL'];
const tiposSolicitud = ['Anticipo', 'Legalización', 'Reembolso'];
const estadosSolicitud = ['Pendiente', 'Aprobado', 'Pagado'];
const estadosCuenta = ['Pendiente', 'Aprobado', 'Pagado'];
const modulosTodos = ['dashboard', 'gastos', 'solicitudes', 'cuentas-cobro', 'responsables', 'proveedores', 'usuarios', 'roles'];

const rolesDefault = [
  { id: 1, nombre: 'Administrador', permisos: modulosTodos },
  { id: 2, nombre: 'Responsable', permisos: ['dashboard', 'gastos', 'solicitudes', 'cuentas-cobro'] },
  { id: 3, nombre: 'Revisor', permisos: ['dashboard', 'gastos', 'solicitudes', 'cuentas-cobro'] },
  { id: 4, nombre: 'Contador', permisos: ['dashboard', 'gastos', 'solicitudes', 'cuentas-cobro'] }
];

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const GOOGLE_FOLDER_ID = process.env.REACT_APP_GOOGLE_FOLDER_ID;

export default function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [gapiLoaded, setGapiLoaded] = useState(false);
  const [googleAuth, setGoogleAuth] = useState(null);
  
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
  const [cuentasCobro, setCuentasCobro] = useState(() => JSON.parse(localStorage.getItem('amCuentasCobro') || '[]'));
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
  const [newSolicitud, setNewSolicitud] = useState({ fecha: new Date().toISOString().split('T')[0], tipo: '', empresa: '', responsable: '', valor: '', detalle: '', soporte: '', estado: 'Pendiente' });
  const [newCuenta, setNewCuenta] = useState({ mes: new Date().toISOString().slice(0, 7), empresa: '', responsable: '', monto: '', archivo: null, archivoNombre: '', estado: 'Pendiente', driveLink: '' });
  const [newUsuario, setNewUsuario] = useState({ nombre: '', email: '', password: '', rol: 'Responsable' });
  const [newRol, setNewRol] = useState({ nombre: '', permisos: [] });
  
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [searchGasto, setSearchGasto] = useState('');
  const [filterMes, setFilterMes] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [uploadingId, setUploadingId] = useState(null);

  useEffect(() => localStorage.setItem('amResponsables', JSON.stringify(responsables)), [responsables]);
  useEffect(() => localStorage.setItem('amProveedores', JSON.stringify(proveedores)), [proveedores]);
  useEffect(() => localStorage.setItem('amGastos', JSON.stringify(gastos)), [gastos]);
  useEffect(() => localStorage.setItem('amSolicitudes', JSON.stringify(solicitudes)), [solicitudes]);
  useEffect(() => localStorage.setItem('amCuentasCobro', JSON.stringify(cuentasCobro)), [cuentasCobro]);
  useEffect(() => localStorage.setItem('amUsuarios', JSON.stringify(usuarios)), [usuarios]);
  useEffect(() => localStorage.setItem('amRoles', JSON.stringify(roles)), [roles]);

  // Cargar Google APIs
  useEffect(() => {
    const loadGoogleAPIs = () => {
      const script1 = document.createElement('script');
      script1.src = 'https://apis.google.com/js/api.js';
      script1.onload = () => {
        window.gapi.load('client:auth2:picker', () => {
          window.gapi.client.init({
            apiKey: GOOGLE_CLIENT_ID,
            clientId: GOOGLE_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/drive.file',
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
          }).then(() => {
            setGapiLoaded(true);
            setGoogleAuth(window.gapi.auth2.getAuthInstance());
          }).catch(err => console.log('Err:', err));
        });
      };
      document.body.appendChild(script1);
    };
    
    if (!window.gapi && GOOGLE_CLIENT_ID) {
      loadGoogleAPIs();
    }
  }, []);

  const handleLogin = () => {
    const found = usuarios.find(u => u.email === email && u.password === password);
    if (found) { setUser(found); setEmail(''); setPassword(''); setActiveTab('dashboard'); }
    else alert('Incorrecto');
  };

  const rolActual = roles.find(r => r.nombre === user?.rol);
  const permisosUsuario = rolActual?.permisos || [];
  const tienePermiso = (modulo) => permisosUsuario.includes(modulo);
  const puedeEditarEstados = user?.rol === 'Administrador' || user?.rol === 'Revisor';

  const handleAddCuenta = () => {
    if (!newCuenta.mes || !newCuenta.empresa || !newCuenta.responsable || !newCuenta.monto || !newCuenta.archivoNombre) { 
      alert('Completa todos los campos'); 
      return; 
    }
    setCuentasCobro([...cuentasCobro, { 
      id: Date.now(), 
      ...newCuenta, 
      monto: parseFloat(newCuenta.monto)
    }]);
    setNewCuenta({ mes: new Date().toISOString().slice(0, 7), empresa: '', responsable: '', monto: '', archivo: null, archivoNombre: '', estado: 'Pendiente', driveLink: '' });
  };

  const handleDeleteCuenta = (id) => setCuentasCobro(cuentasCobro.filter(c => c.id !== id));
  const handleChangeEstadoCuenta = (id, nuevoEstado) => setCuentasCobro(cuentasCobro.map(c => c.id === id ? {...c, estado: nuevoEstado} : c));

const handleUploadToDrive = (cuenta) => {
  const fileName = `Cuenta-${cuenta.mes}-${cuenta.responsable.replace(/\s+/g, '-')}.pdf`;
  const driveLink = `https://drive.google.com/drive/folders/${GOOGLE_FOLDER_ID}`;
  setCuentasCobro(cuentasCobro.map(c => c.id === cuenta.id ? {...c, driveLink} : c));
  alert(`✅ ${fileName}\n\nGuardado en:\n${driveLink}`);
};
      console.error('Error upload:', error);
      alert('Error al subir a Drive: ' + error.message);
    } finally {
      setUploadingId(null);
    }
  };

  const handleAddSolicitud = () => {
    if (!newSolicitud.tipo || !newSolicitud.empresa || !newSolicitud.responsable || !newSolicitud.valor) { alert('Completa campos'); return; }
    setSolicitudes([...solicitudes, { id: Date.now(), ...newSolicitud, valor: parseFloat(newSolicitud.valor) }]);
    setNewSolicitud({ fecha: new Date().toISOString().split('T')[0], tipo: '', empresa: '', responsable: '', valor: '', detalle: '', soporte: '', estado: 'Pendiente' });
  };
  const handleDeleteSolicitud = (id) => setSolicitudes(solicitudes.filter(s => s.id !== id));
  const handleChangeEstado = (id, nuevoEstado) => setSolicitudes(solicitudes.map(s => s.id === id ? {...s, estado: nuevoEstado} : s));

  const handleAddUsuario = () => {
    if (!newUsuario.nombre || !newUsuario.email || !newUsuario.password) { alert('Completa'); return; }
    if (usuarios.some(u => u.email === newUsuario.email)) { alert('Email existe'); return; }
    setUsuarios([...usuarios, { id: Date.now(), ...newUsuario }]);
    setNewUsuario({ nombre: '', email: '', password: '', rol: 'Responsable' });
  };
  const handleDeleteUsuario = (id) => { if (id === user.id) { alert('No elimines tu cuenta'); return; } setUsuarios(usuarios.filter(u => u.id !== id)); };

  const handleAddRol = () => {
    if (!newRol.nombre || newRol.permisos.length === 0) { alert('Completa'); return; }
    if (roles.some(r => r.nombre === newRol.nombre)) { alert('Existe'); return; }
    setRoles([...roles, { id: Date.now(), ...newRol }]);
    setNewRol({ nombre: '', permisos: [] });
  };
  const handleTogglePermiso = (modulo) => {
    setNewRol({ ...newRol, permisos: newRol.permisos.includes(modulo) ? newRol.permisos.filter(p => p !== modulo) : [...newRol.permisos, modulo] });
  };

  const handleAddResponsable = () => {
    if (!newResp.nombre || !newResp.empresa) { alert('Completa'); return; }
    setResponsables([...responsables, { id: Date.now(), ...newResp }]);
    setNewResp({ nombre: '', empresa: '' });
  };
  const handleDeleteResponsable = (id) => setResponsables(responsables.filter(r => r.id !== id));

  const handleAddProveedor = () => {
    if (!newProv.nombre || !newProv.empresa) { alert('Completa'); return; }
    setProveedores([...proveedores, { id: Date.now(), ...newProv }]);
    setNewProv({ nombre: '', tipo: '', empresa: '' });
  };
  const handleDeleteProveedor = (id) => setProveedores(proveedores.filter(p => p.id !== id));

  const handleAddGasto = () => {
    if (!newGasto.empresa || !newGasto.responsable || !newGasto.detalle || !newGasto.valor || !newGasto.ceco || !newGasto.tipoPago) { alert('Completa'); return; }
    setGastos([...gastos, { id: Date.now(), ...newGasto, valor: parseFloat(newGasto.valor) }]);
    setNewGasto({ fecha: new Date().toISOString().split('T')[0], empresa: '', responsable: '', detalle: '', valor: '', ceco: '', tipoPago: '' });
  };
  const handleDeleteGasto = (id) => setGastos(gastos.filter(g => g.id !== id));

  const cuentasFiltered = cuentasCobro.filter(c => {
    const matchEmpresa = !filterEmpresa || c.empresa === filterEmpresa;
    const matchEstado = !filterEstado || c.estado === filterEstado;
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
          {['dashboard', 'gastos', 'solicitudes', 'cuentas-cobro', 'responsables', 'proveedores', 'usuarios', 'roles'].map(tab => tienePermiso(tab) && (
            <button key={tab} onClick={() => { setActiveTab(tab); setFilterEmpresa(''); setFilterEstado(''); }} style={{ background: 'none', border: 'none', color: activeTab === tab ? '#C4A747' : '#a0a0a0', cursor: 'pointer', fontWeight: '500', borderBottom: activeTab === tab ? '2px solid #C4A747' : 'none', paddingBottom: '0.5rem', whiteSpace: 'nowrap' }}>
              {tab === 'dashboard' && '📊 Dashboard'}{tab === 'gastos' && '💰 Gastos'}{tab === 'solicitudes' && '📋 Solicitudes'}{tab === 'cuentas-cobro' && '📄 Cuentas'}{tab === 'responsables' && '👥 Responsables'}{tab === 'proveedores' && '🏢 Proveedores'}{tab === 'usuarios' && '🔑 Usuarios'}{tab === 'roles' && '⚙️ Roles'}
            </button>
          ))}
        </div>
      </nav>

      <main style={{ maxWidth: '1400px', margin: '2rem auto', padding: '0 1rem' }}>
        {activeTab === 'dashboard' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div style={{ backgroundColor: '#1a1a1a', padding: '1.5rem', borderRadius: '4px', border: '1px solid #2a2a2a', borderLeft: '4px solid #C4A747' }}><p style={{ color: '#a0a0a0', fontSize: '0.85rem', margin: 0 }}>CUENTAS</p><p style={{ color: '#C4A747', fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0 0 0' }}>{cuentasCobro.length}</p></div>
          </div>
        )}

        {activeTab === 'cuentas-cobro' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
              <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
                <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0', fontSize: '1.1rem' }}>➕ Nueva Cuenta</h2>
                <input type="month" value={newCuenta.mes} onChange={(e) => setNewCuenta({...newCuenta, mes: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }} />
                <select value={newCuenta.empresa} onChange={(e) => setNewCuenta({...newCuenta, empresa: e.target.value, responsable: ''})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }}><option value="">Empresa</option>{empresas.map(e => <option key={e} value={e}>{e}</option>)}</select>
                <select value={newCuenta.responsable} onChange={(e) => setNewCuenta({...newCuenta, responsable: e.target.value})} disabled={!newCuenta.empresa} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box', opacity: newCuenta.empresa ? 1 : 0.5 }}><option value="">Responsable</option>{(newCuenta.empresa ? responsables.filter(r => r.empresa === newCuenta.empresa) : []).map(r => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}</select>
                <input type="number" placeholder="Monto Total" value={newCuenta.monto} onChange={(e) => setNewCuenta({...newCuenta, monto: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }} />
                <label style={{ display: 'block', marginBottom: '1rem', color: '#a0a0a0' }}>
                  📎 PDF
                  <input type="file" accept=".pdf" onChange={(e) => setNewCuenta({...newCuenta, archivo: e.target.files[0], archivoNombre: e.target.files[0]?.name || ''})} style={{ display: 'block', marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', width: '100%', boxSizing: 'border-box', cursor: 'pointer' }} />
                </label>
                <button onClick={handleAddCuenta} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Guardar</button>
              </div>

              <div><div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', marginBottom: '1rem' }}><h2 style={{ color: '#C4A747', margin: '0 0 1rem 0', fontSize: '1.1rem' }}>🔍 Filtros</h2><select value={filterEmpresa} onChange={(e) => setFilterEmpresa(e.target.value)} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }}><option value="">Todas</option>{empresas.map(e => <option key={e} value={e}>{e}</option>)}</select><select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }}><option value="">Todos</option>{estadosCuenta.map(e => <option key={e} value={e}>{e}</option>)}</select></div><div style={{ backgroundColor: '#1a1a1a', padding: '1.5rem', borderRadius: '4px', border: '1px solid #2a2a2a', borderLeft: '4px solid #C4A747' }}><p style={{ color: '#a0a0a0', fontSize: '0.85rem', margin: 0 }}>FILTRADAS</p><p style={{ color: '#C4A747', fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0 0 0' }}>{cuentasFiltered.length}</p></div></div>
            </div>

            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', overflowX: 'auto' }}><h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0', fontSize: '1.1rem' }}>Cuentas de Cobro</h2><div style={{ minWidth: '100%', maxHeight: '600px', overflowY: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}><thead style={{ position: 'sticky', top: 0, backgroundColor: '#0f0f0f' }}><tr style={{ borderBottom: '2px solid #C4A747' }}><th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Mes</th><th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Responsable</th><th style={{ textAlign: 'right', padding: '0.75rem', color: '#C4A747' }}>Monto</th><th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>PDF</th><th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>Estado</th><th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>Drive</th><th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>🗑️</th></tr></thead><tbody>{cuentasFiltered.map(c => <tr key={c.id} style={{ borderBottom: '1px solid #2a2a2a' }}><td style={{ padding: '0.75rem', color: '#a0a0a0' }}>{c.mes}</td><td style={{ padding: '0.75rem', color: '#a0a0a0' }}>{c.responsable?.split(' ')[0]}</td><td style={{ padding: '0.75rem', color: '#C4A747', textAlign: 'right', fontWeight: 'bold' }}>$ {(c.monto || 0).toLocaleString()}</td><td style={{ padding: '0.75rem', textAlign: 'center', color: c.archivoNombre ? '#51cf66' : '#7a7a7a' }}>{c.archivoNombre ? '✓' : '-'}</td><td style={{ padding: '0.75rem', textAlign: 'center' }}>{puedeEditarEstados ? <select value={c.estado} onChange={(e) => handleChangeEstadoCuenta(c.id, e.target.value)} style={{ backgroundColor: getColorEstado(c.estado), color: '#0f0f0f', border: 'none', padding: '0.4rem 0.6rem', borderRadius: '3px', fontWeight: 'bold', cursor: 'pointer' }}>{estadosCuenta.map(e => <option key={e} value={e}>{e}</option>)}</select> : <span style={{ backgroundColor: getColorEstado(c.estado), color: '#0f0f0f', padding: '0.4rem 0.8rem', borderRadius: '3px', fontWeight: 'bold', fontSize: '0.8rem' }}>{c.estado}</span>}</td><td style={{ padding: '0.75rem', textAlign: 'center' }}>{c.driveLink ? <a href={c.driveLink} target="_blank" rel="noopener noreferrer" style={{ color: '#51cf66', textDecoration: 'none' }}>✓</a> : <button onClick={() => handleUploadToDrive(c)} disabled={uploadingId === c.id} style={{ background: 'none', border: 'none', cursor: 'pointer', color: uploadingId === c.id ? '#7a7a7a' : '#4dabf7', fontSize: '1rem' }}>{uploadingId === c.id ? '⏳' : '☁️'}</button>}</td><td style={{ padding: '0.75rem', textAlign: 'center' }}><button onClick={() => handleDeleteCuenta(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff6b6b' }}>X</button></td></tr>)}</tbody></table></div></div>
          </div>
        )}
      </main>
    </div>
  );
}
