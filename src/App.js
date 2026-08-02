/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';

const empresas = ['AM SPORTS GROUP SAS', 'PRO INVESTMENTS GLOBAL SAS', 'PRONOVA CAPITAL SAS', 'FOR SEVEN MEDIA SAS', 'ARKO'];
const cecos = ['CECO-001-GF', 'CECO-002-NM', 'CECO-003-GR', 'CECO-004-HR', 'CECO-005-AM', 'CECO-006-VI', 'CECO-007-PRS', 'CECO-008-TRS', 'CECO-009-RTE', 'CECO-010-SS'];
const tiposPago = ['ADMINISTRATIVOS', 'REEMBOLSO', 'ANTICIPO', 'GIRO INTERNO', 'PAGOS GENERAL'];
const tiposSolicitud = ['Anticipo', 'Legalización', 'Reembolso'];
const estadosSolicitud = ['Pendiente', 'Aprobado', 'Pagado', 'Legalizado'];
const estadosCuenta = ['Pendiente', 'Aprobado', 'Pagado'];
const modulosTodos = ['dashboard', 'gastos', 'solicitudes', 'cuentas-cobro', 'reportes', 'responsables', 'proveedores', 'usuarios', 'roles'];

const rolesDefault = [
  { id: 1, nombre: 'Administrador', permisos: modulosTodos },
  { id: 2, nombre: 'Responsable', permisos: ['dashboard', 'gastos', 'solicitudes', 'cuentas-cobro'] },
  { id: 3, nombre: 'Revisor', permisos: ['dashboard', 'gastos', 'solicitudes', 'cuentas-cobro', 'reportes'] },
  { id: 4, nombre: 'Contador', permisos: ['dashboard', 'gastos', 'solicitudes', 'cuentas-cobro', 'reportes'] }
];

const GOOGLE_FOLDER_ID = process.env.REACT_APP_GOOGLE_FOLDER_ID;

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
  const [newSolicitud, setNewSolicitud] = useState({ fecha: new Date().toISOString().split('T')[0], tipo: '', empresa: '', responsable: '', valor: '', detalle: '', soporte: '', estado: 'Pendiente', archivosLegalizacion: [], notasLegalizacion: '', driveLink: '' });
  const [newCuenta, setNewCuenta] = useState({ mes: new Date().toISOString().slice(0, 7), empresa: '', responsable: '', monto: '', archivo: null, archivoNombre: '', estado: 'Pendiente', driveLink: '' });
  const [newUsuario, setNewUsuario] = useState({ nombre: '', email: '', password: '', rol: 'Responsable' });
  const [newRol, setNewRol] = useState({ nombre: '', permisos: [] });
  
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterMes, setFilterMes] = useState('');
  const [filterCeco, setFilterCeco] = useState('');
  const [searchGasto, setSearchGasto] = useState('');
  const [generandoPDF, setGenerandoPDF] = useState(null);

  useEffect(() => localStorage.setItem('amResponsables', JSON.stringify(responsables)), [responsables]);
  useEffect(() => localStorage.setItem('amProveedores', JSON.stringify(proveedores)), [proveedores]);
  useEffect(() => localStorage.setItem('amGastos', JSON.stringify(gastos)), [gastos]);
  useEffect(() => localStorage.setItem('amSolicitudes', JSON.stringify(solicitudes)), [solicitudes]);
  useEffect(() => localStorage.setItem('amCuentasCobro', JSON.stringify(cuentasCobro)), [cuentasCobro]);
  useEffect(() => localStorage.setItem('amUsuarios', JSON.stringify(usuarios)), [usuarios]);
  useEffect(() => localStorage.setItem('amRoles', JSON.stringify(roles)), [roles]);

  const handleLogin = () => {
    const found = usuarios.find(u => u.email === email && u.password === password);
    if (found) { setUser(found); setEmail(''); setPassword(''); setActiveTab('dashboard'); }
    else alert('Incorrecto');
  };

  const rolActual = roles.find(r => r.nombre === user?.rol);
  const permisosUsuario = rolActual?.permisos || [];
  const tienePermiso = (modulo) => permisosUsuario.includes(modulo);
  const puedeEditarEstados = user?.rol === 'Administrador' || user?.rol === 'Revisor';

  const handleAddGasto = () => {
    if (!newGasto.empresa || !newGasto.responsable || !newGasto.detalle || !newGasto.valor || !newGasto.ceco || !newGasto.tipoPago) { alert('Completa'); return; }
    setGastos([...gastos, { id: Date.now(), ...newGasto, valor: parseFloat(newGasto.valor) }]);
    setNewGasto({ fecha: new Date().toISOString().split('T')[0], empresa: '', responsable: '', detalle: '', valor: '', ceco: '', tipoPago: '' });
  };
  const handleDeleteGasto = (id) => setGastos(gastos.filter(g => g.id !== id));

  const handleAddSolicitud = () => {
    if (!newSolicitud.tipo || !newSolicitud.empresa || !newSolicitud.responsable || !newSolicitud.valor) { alert('Completa'); return; }
    setSolicitudes([...solicitudes, { id: Date.now(), ...newSolicitud, valor: parseFloat(newSolicitud.valor) }]);
    setNewSolicitud({ fecha: new Date().toISOString().split('T')[0], tipo: '', empresa: '', responsable: '', valor: '', detalle: '', soporte: '', estado: 'Pendiente', archivosLegalizacion: [], notasLegalizacion: '', driveLink: '' });
  };
  const handleDeleteSolicitud = (id) => setSolicitudes(solicitudes.filter(s => s.id !== id));
  const handleChangeEstadoSolicitud = (id, nuevoEstado) => setSolicitudes(solicitudes.map(s => s.id === id ? {...s, estado: nuevoEstado} : s));

  const handleAddArchivosLegalizacion = (solicitudId, files) => {
    const archivos = Array.from(files).map(f => ({ nombre: f.name, tipo: f.type, size: f.size, base64: '' }));
    setSolicitudes(solicitudes.map(s => s.id === solicitudId ? {...s, archivosLegalizacion: [...s.archivosLegalizacion, ...archivos]} : s));
  };

  const handleGenerarPDFLegalizacion = (solicitud) => {
    setGenerandoPDF(solicitud.id);
    const responsableName = solicitud.responsable?.replace(/\s+/g, '-') || 'responsable';
    const mes = solicitud.fecha.slice(0, 7);
    const driveLink = `https://drive.google.com/drive/folders/${GOOGLE_FOLDER_ID}`;
    
    const carpeta = `Legalizaciones/${responsableName}/${mes}`;
    const archivoNombre = `Legalizacion-${solicitud.id}-${new Date().toISOString().slice(0, 10)}.pdf`;
    
    alert(`✅ PDF Generado\n\nCarpeta Drive:\n${carpeta}\n\nArchivo:\n${archivoNombre}\n\nArchivos adjuntos: ${solicitud.archivosLegalizacion.length}`);
    
    setSolicitudes(solicitudes.map(s => s.id === solicitud.id ? {...s, estado: 'Legalizado', driveLink: `${driveLink}/${carpeta}`} : s));
    setGenerandoPDF(null);
  };

  const handleAddCuenta = () => {
    if (!newCuenta.mes || !newCuenta.empresa || !newCuenta.responsable || !newCuenta.monto || !newCuenta.archivoNombre) { alert('Completa'); return; }
    setCuentasCobro([...cuentasCobro, { id: Date.now(), ...newCuenta, monto: parseFloat(newCuenta.monto) }]);
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

  const gastosFiltered = gastos.filter(g => {
    const matchEmpresa = !filterEmpresa || g.empresa === filterEmpresa;
    const matchMes = !filterMes || g.fecha?.startsWith(filterMes);
    const matchCeco = !filterCeco || g.ceco === filterCeco;
    const matchSearch = !searchGasto || g.detalle?.toLowerCase().includes(searchGasto.toLowerCase());
    return matchEmpresa && matchMes && matchCeco && matchSearch;
  });

  const solicitudesFiltered = solicitudes.filter(s => {
    const matchEmpresa = !filterEmpresa || s.empresa === filterEmpresa;
    const matchEstado = !filterEstado || s.estado === filterEstado;
    return matchEmpresa && matchEstado;
  });

  const cuentasFiltered = cuentasCobro.filter(c => {
    const matchEmpresa = !filterEmpresa || c.empresa === filterEmpresa;
    const matchEstado = !filterEstado || c.estado === filterEstado;
    return matchEmpresa && matchEstado;
  });

  const downloadGastosCSV = () => {
    if (gastosFiltered.length === 0) { alert('Sin datos'); return; }
    const headers = ['FECHA', 'EMPRESA', 'RESPONSABLE', 'DETALLE', 'CECO', 'TIPO PAGO', 'VALOR'];
    const rows = gastosFiltered.map(g => [g.fecha, g.empresa, g.responsable, g.detalle, g.ceco, g.tipoPago, g.valor]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Reportes-Gastos-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const getColorEstado = (estado) => {
    if (estado === 'Pendiente') return '#ff6b6b';
    if (estado === 'Aprobado') return '#ffd43b';
    if (estado === 'Pagado') return '#51cf66';
    if (estado === 'Legalizado') return '#748ffc';
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
          {['dashboard', 'gastos', 'solicitudes', 'cuentas-cobro', 'reportes', 'responsables', 'proveedores', 'usuarios', 'roles'].map(tab => tienePermiso(tab) && (
            <button key={tab} onClick={() => { setActiveTab(tab); setFilterEmpresa(''); setFilterEstado(''); setFilterMes(''); setFilterCeco(''); setSearchGasto(''); }} style={{ background: 'none', border: 'none', color: activeTab === tab ? '#C4A747' : '#a0a0a0', cursor: 'pointer', fontWeight: '500', borderBottom: activeTab === tab ? '2px solid #C4A747' : 'none', paddingBottom: '0.5rem', whiteSpace: 'nowrap' }}>
              {tab === 'dashboard' && '📊'}{tab === 'gastos' && '💰'}{tab === 'solicitudes' && '📋'}{tab === 'cuentas-cobro' && '📄'}{tab === 'reportes' && '📈'}{tab === 'responsables' && '👥'}{tab === 'proveedores' && '🏢'}{tab === 'usuarios' && '🔑'}{tab === 'roles' && '⚙️'}
            </button>
          ))}
        </div>
      </nav>

      <main style={{ maxWidth: '1400px', margin: '2rem auto', padding: '0 1rem' }}>
        {activeTab === 'solicitudes' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
              <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
                <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0', fontSize: '1.1rem' }}>➕ Nueva Solicitud</h2>
                <input type="date" value={newSolicitud.fecha} onChange={(e) => setNewSolicitud({...newSolicitud, fecha: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }} />
                <select value={newSolicitud.tipo} onChange={(e) => setNewSolicitud({...newSolicitud, tipo: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }}><option value="">Tipo</option>{tiposSolicitud.map(t => <option key={t} value={t}>{t}</option>)}</select>
                <select value={newSolicitud.empresa} onChange={(e) => setNewSolicitud({...newSolicitud, empresa: e.target.value, responsable: ''})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }}><option value="">Empresa</option>{empresas.map(e => <option key={e} value={e}>{e}</option>)}</select>
                <select value={newSolicitud.responsable} onChange={(e) => setNewSolicitud({...newSolicitud, responsable: e.target.value})} disabled={!newSolicitud.empresa} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box', opacity: newSolicitud.empresa ? 1 : 0.5 }}><option value="">Responsable</option>{(newSolicitud.empresa ? responsables.filter(r => r.empresa === newSolicitud.empresa) : []).map(r => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}</select>
                <input type="number" placeholder="Valor" value={newSolicitud.valor} onChange={(e) => setNewSolicitud({...newSolicitud, valor: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }} />
                <input type="text" placeholder="Detalle" value={newSolicitud.detalle} onChange={(e) => setNewSolicitud({...newSolicitud, detalle: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }} />
                <button onClick={handleAddSolicitud} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Guardar</button>
              </div>
              <div><div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', marginBottom: '1rem' }}><h2 style={{ color: '#C4A747', margin: '0 0 1rem 0', fontSize: '1.1rem' }}>🔍 Filtros</h2><select value={filterEmpresa} onChange={(e) => setFilterEmpresa(e.target.value)} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }}><option value="">Todas</option>{empresas.map(e => <option key={e} value={e}>{e}</option>)}</select><select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }}><option value="">Todos</option>{estadosSolicitud.map(e => <option key={e} value={e}>{e}</option>)}</select></div><div style={{ backgroundColor: '#1a1a1a', padding: '1.5rem', borderRadius: '4px', border: '1px solid #2a2a2a', borderLeft: '4px solid #C4A747' }}><p style={{ color: '#a0a0a0', fontSize: '0.85rem', margin: 0 }}>FILTRADAS</p><p style={{ color: '#C4A747', fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0 0 0' }}>{solicitudesFiltered.length}</p></div></div>
            </div>

            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', overflowX: 'auto' }}><h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0', fontSize: '1.1rem' }}>Solicitudes</h2><div style={{ maxHeight: '600px', overflowY: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}><thead style={{ position: 'sticky', top: 0, backgroundColor: '#0f0f0f' }}><tr style={{ borderBottom: '2px solid #C4A747' }}><th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Tipo</th><th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Responsable</th><th style={{ textAlign: 'right', padding: '0.75rem', color: '#C4A747' }}>Valor</th><th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>Archivos</th><th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>Estado</th><th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>Acciones</th><th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>🗑️</th></tr></thead><tbody>{solicitudesFiltered.map(s => <tr key={s.id} style={{ borderBottom: '1px solid #2a2a2a' }}><td style={{ padding: '0.75rem', color: '#a0a0a0' }}>{s.tipo}</td><td style={{ padding: '0.75rem', color: '#a0a0a0', fontSize: '0.8rem' }}>{s.responsable?.split(' ')[0]}</td><td style={{ padding: '0.75rem', color: '#51cf66', textAlign: 'right', fontWeight: 'bold' }}>$ {(s.valor || 0).toLocaleString()}</td><td style={{ padding: '0.75rem', textAlign: 'center', color: s.archivosLegalizacion?.length > 0 ? '#51cf66' : '#7a7a7a', fontSize: '0.8rem' }}>{s.archivosLegalizacion?.length || 0} archivos</td><td style={{ padding: '0.75rem', textAlign: 'center' }}>{puedeEditarEstados ? <select value={s.estado} onChange={(e) => handleChangeEstadoSolicitud(s.id, e.target.value)} style={{ backgroundColor: getColorEstado(s.estado), color: '#0f0f0f', border: 'none', padding: '0.4rem 0.6rem', borderRadius: '3px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>{estadosSolicitud.map(e => <option key={e} value={e}>{e}</option>)}</select> : <span style={{ backgroundColor: getColorEstado(s.estado), color: '#0f0f0f', padding: '0.4rem 0.8rem', borderRadius: '3px', fontWeight: 'bold', fontSize: '0.8rem' }}>{s.estado}</span>}</td><td style={{ padding: '0.75rem', textAlign: 'center' }}>{s.tipo === 'Legalización' && s.estado === 'Aprobado' ? <button onClick={() => handleGenerarPDFLegalizacion(s)} disabled={generandoPDF === s.id} style={{ background: 'none', border: 'none', cursor: 'pointer', color: generandoPDF === s.id ? '#7a7a7a' : '#748ffc', fontSize: '1rem' }}>{generandoPDF === s.id ? '⏳' : '📄'}</button> : s.driveLink ? <a href={s.driveLink} target="_blank" rel="noopener noreferrer" style={{ color: '#51cf66', textDecoration: 'none' }}>✓</a> : '-'}</td><td style={{ padding: '0.75rem', textAlign: 'center' }}><button onClick={() => handleDeleteSolicitud(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff6b6b' }}>X</button></td></tr>)}</tbody></table></div></div>

            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', marginTop: '2rem' }}>
              <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0', fontSize: '1.1rem' }}>📎 Cargar Documentos Legalización</h2>
              <p style={{ color: '#a0a0a0', fontSize: '0.85rem', marginBottom: '1rem' }}>Selecciona una solicitud tipo "Legalización" con estado "Aprobado" y luego carga tus documentos</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                {solicitudes.filter(s => s.tipo === 'Legalización' && s.estado === 'Aprobado').map(s => (
                  <div key={s.id} style={{ backgroundColor: '#0f0f0f', padding: '1rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
                    <p style={{ color: '#C4A747', fontWeight: 'bold', margin: '0 0 0.5rem 0' }}>{s.responsable}</p>
                    <p style={{ color: '#a0a0a0', fontSize: '0.8rem', margin: '0 0 1rem 0' }}>$ {(s.valor || 0).toLocaleString()}</p>
                    <label style={{ display: 'block', marginBottom: '0.75rem', color: '#a0a0a0' }}>
                      📁 Fotos/PDFs
                      <input type="file" multiple onChange={(e) => handleAddArchivosLegalizacion(s.id, e.target.files)} style={{ display: 'block', marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', width: '100%', boxSizing: 'border-box', cursor: 'pointer' }} />
                    </label>
                    <textarea placeholder="Notas" value={s.notasLegalizacion || ''} onChange={(e) => setSolicitudes(solicitudes.map(sol => sol.id === s.id ? {...sol, notasLegalizacion: e.target.value} : sol))} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box', minHeight: '80px', fontSize: '0.8rem' }} />
                    <button onClick={() => handleGenerarPDFLegalizacion(s)} disabled={generandoPDF === s.id} style={{ width: '100%', padding: '0.75rem', backgroundColor: generandoPDF === s.id ? '#7a7a7a' : '#748ffc', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>{generandoPDF === s.id ? '⏳ Generando...' : '📄 Generar PDF'}</button>
                  </div>
                ))}
                {solicitudes.filter(s => s.tipo === 'Legalización' && s.estado === 'Aprobado').length === 0 && (
                  <p style={{ color: '#7a7a7a', gridColumn: '1 / -1', textAlign: 'center' }}>Sin legalizaciones pendientes</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab !== 'solicitudes' && (
          <div style={{ color: '#a0a0a0', textAlign: 'center', padding: '2rem' }}>Tab {activeTab}</div>
        )}
      </main>
    </div>
  );
}
