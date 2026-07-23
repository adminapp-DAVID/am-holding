import React, { useState, useEffect } from 'react';

export default function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [users, setUsers] = useState([]);
  const [responsables, setResponsables] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showResponsableForm, setShowResponsableForm] = useState(false);
  const [showProveedorForm, setShowProveedorForm] = useState(false);
  const [showGastoForm, setShowGastoForm] = useState(false);
  const [formResponsable, setFormResponsable] = useState({ nombre: '', empresa: '' });
  const [formProveedor, setFormProveedor] = useState({ nombre: '', tipo: '', empresa: '' });
  const [formGasto, setFormGasto] = useState({ empresa: '', tipo: 'RESPONSABLE', responsable: '', proveedor: '', detalle: '', valor: '' });

  const RESPONSABLES_DEFAULT = [
    { id: 1, nombre: 'Cristian Alejandro Giraldo Carvajal', empresa: 'AM SPORTS GROUP SAS', tipo: 'EMPLEADO' },
    { id: 2, nombre: 'David Dario Andrade Hernández', empresa: 'AM SPORTS GROUP SAS', tipo: 'EMPLEADO' },
    { id: 3, nombre: 'José David Martínez', empresa: 'AM SPORTS GROUP SAS', tipo: 'EMPLEADO' },
    { id: 4, nombre: 'Luis Rodrigo Rivas Arboleda', empresa: 'AM SPORTS GROUP SAS', tipo: 'EMPLEADO' },
    { id: 5, nombre: 'Cristian Camilo Tabares Arango', empresa: 'AM SPORTS GROUP SAS', tipo: 'EMPLEADO' },
    { id: 6, nombre: 'Arnulfo Beitar Cordoba', empresa: 'AM SPORTS GROUP SAS', tipo: 'EMPLEADO' },
    { id: 7, nombre: 'Yeison Alejandro Mejía Flórez', empresa: 'AM SPORTS GROUP SAS', tipo: 'EMPLEADO' },
    { id: 8, nombre: 'Daniel Dario Ríos', empresa: 'AM SPORTS GROUP SAS', tipo: 'EMPLEADO' },
    { id: 9, nombre: 'Wilfer Andrés Zapata Quiroz', empresa: 'AM SPORTS GROUP SAS', tipo: 'EMPLEADO' },
    { id: 10, nombre: 'Jamell Orlando Ramos', empresa: 'AM SPORTS GROUP SAS', tipo: 'EMPLEADO' },
    { id: 11, nombre: 'Sara Cobaleda Vasquez', empresa: 'AM SPORTS GROUP SAS', tipo: 'EMPLEADO' },
    { id: 12, nombre: 'Julián Suárez Quevedo', empresa: 'AM SPORTS GROUP SAS', tipo: 'EMPLEADO' },
    { id: 13, nombre: 'Sergio Alejandro Mejía Valencia', empresa: 'PRO INVESTMENTS GLOBAL SAS', tipo: 'EMPLEADO' },
    { id: 14, nombre: 'Caren Paola Garzón Márquez', empresa: 'PRO INVESTMENTS GLOBAL SAS', tipo: 'EMPLEADO' },
    { id: 15, nombre: 'Santiago Espinosa', empresa: 'PRO INVESTMENTS GLOBAL SAS', tipo: 'EMPLEADO' },
    { id: 16, nombre: 'Daniela Salazar', empresa: 'PRO INVESTMENTS GLOBAL SAS', tipo: 'EMPLEADO' },
    { id: 17, nombre: 'Andrei Martinez Orjuela', empresa: 'PRONOVA CAPITAL SAS', tipo: 'EMPLEADO' },
    { id: 18, nombre: 'Daniel Santiago Tarquino', empresa: 'FOR SEVEN MEDIA SAS', tipo: 'EMPLEADO' },
    { id: 19, nombre: 'Juan Camilo Duarte', empresa: 'FOR SEVEN MEDIA SAS', tipo: 'EMPLEADO' },
    { id: 20, nombre: 'Fabio Andres Galeano', empresa: 'FOR SEVEN MEDIA SAS', tipo: 'EMPLEADO' },
    { id: 21, nombre: 'Jerónimo Giraldo', empresa: 'FOR SEVEN MEDIA SAS', tipo: 'EMPLEADO' },
    { id: 22, nombre: 'Nestor Ovidio', empresa: 'ARKO', tipo: 'EMPLEADO' },
    { id: 23, nombre: 'Jose Pagan', empresa: 'ARKO', tipo: 'EMPLEADO' },
    { id: 24, nombre: 'Esteban Espindola', empresa: 'ARKO', tipo: 'EMPLEADO' }
  ];

  const EMPRESAS = ['AM SPORTS GROUP SAS', 'PRO INVESTMENTS GLOBAL SAS', 'PRONOVA CAPITAL SAS', 'FOR SEVEN MEDIA SAS', 'ARKO'];

  useEffect(() => {
    const savedUsers = localStorage.getItem('amUsers');
    const savedResponsables = localStorage.getItem('amResponsables');
    const savedProveedores = localStorage.getItem('amProveedores');
    const savedGastos = localStorage.getItem('amGastos');

    if (!savedUsers) {
      const defaultUsers = [{ id: 1, nombre: 'Admin', email: 'admin@amholding.com', password: 'admin123', rol: 'admin' }];
      setUsers(defaultUsers);
      localStorage.setItem('amUsers', JSON.stringify(defaultUsers));
    } else {
      setUsers(JSON.parse(savedUsers));
    }

    if (!savedResponsables) {
      setResponsables(RESPONSABLES_DEFAULT);
      localStorage.setItem('amResponsables', JSON.stringify(RESPONSABLES_DEFAULT));
    } else {
      setResponsables(JSON.parse(savedResponsables));
    }

    if (savedProveedores) setProveedores(JSON.parse(savedProveedores));
    if (savedGastos) setGastos(JSON.parse(savedGastos));
  }, []);

  useEffect(() => {
    localStorage.setItem('amResponsables', JSON.stringify(responsables));
  }, [responsables]);

  useEffect(() => {
    localStorage.setItem('amProveedores', JSON.stringify(proveedores));
  }, [proveedores]);

  useEffect(() => {
    localStorage.setItem('amGastos', JSON.stringify(gastos));
  }, [gastos]);

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

  const handleAddResponsable = () => {
    if (!formResponsable.nombre || !formResponsable.empresa) {
      alert('Completa todos los campos');
      return;
    }
    setResponsables([...responsables, { id: Date.now(), ...formResponsable, tipo: 'EMPLEADO' }]);
    setFormResponsable({ nombre: '', empresa: '' });
    setShowResponsableForm(false);
  };

  const handleDeleteResponsable = (id) => {
    setResponsables(responsables.filter(r => r.id !== id));
  };

  const handleAddProveedor = () => {
    if (!formProveedor.nombre || !formProveedor.empresa) {
      alert('Completa todos los campos');
      return;
    }
    setProveedores([...proveedores, { id: Date.now(), ...formProveedor }]);
    setFormProveedor({ nombre: '', tipo: '', empresa: '' });
    setShowProveedorForm(false);
  };

  const handleDeleteProveedor = (id) => {
    setProveedores(proveedores.filter(p => p.id !== id));
  };

  const handleAddGasto = () => {
    if (!formGasto.empresa || !formGasto.detalle || !formGasto.valor) {
      alert('Completa empresa, detalle y valor');
      return;
    }
    if (formGasto.tipo === 'RESPONSABLE' && !formGasto.responsable) {
      alert('Selecciona un responsable');
      return;
    }
    if (formGasto.tipo === 'PROVEEDOR' && !formGasto.proveedor) {
      alert('Selecciona un proveedor');
      return;
    }
    setGastos([...gastos, { id: Date.now(), ...formGasto, valor: parseFloat(formGasto.valor), fecha: new Date().toISOString().split('T')[0] }]);
    setFormGasto({ empresa: '', tipo: 'RESPONSABLE', responsable: '', proveedor: '', detalle: '', valor: '' });
    setShowGastoForm(false);
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

  const responsablesDelEmpresa = formGasto.empresa ? responsables.filter(r => r.empresa === formGasto.empresa) : [];
  const proveedoresDelEmpresa = formGasto.empresa ? proveedores.filter(p => p.empresa === formGasto.empresa) : [];
  const totalGastos = gastos.reduce((sum, g) => sum + (g.valor || 0), 0);

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

        <nav style={{ maxWidth: '1400px', margin: '1rem auto 0', display: 'flex', gap: '2rem', borderTop: '1px solid rgba(196, 167, 71, 0.2)', paddingTop: '1rem', flexWrap: 'wrap' }}>
          <button onClick={() => setActiveTab('dashboard')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'dashboard' ? '3px solid #C4A747' : 'none', color: activeTab === 'dashboard' ? '#C4A747' : '#a0a0a0', cursor: 'pointer', fontWeight: '500', paddingBottom: '0.5rem' }}>
            📊 Dashboard
          </button>
          <button onClick={() => setActiveTab('gestion')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'gestion' ? '3px solid #C4A747' : 'none', color: activeTab === 'gestion' ? '#C4A747' : '#a0a0a0', cursor: 'pointer', fontWeight: '500', paddingBottom: '0.5rem' }}>
            👥 Gestión
          </button>
          <button onClick={() => setActiveTab('gastos')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'gastos' ? '3px solid #C4A747' : 'none', color: activeTab === 'gastos' ? '#C4A747' : '#a0a0a0', cursor: 'pointer', fontWeight: '500', paddingBottom: '0.5rem' }}>
            ➕ Gasto
          </button>
          <button onClick={() => setActiveTab('movimientos')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'movimientos' ? '3px solid #C4A747' : 'none', color: activeTab === 'movimientos' ? '#C4A747' : '#a0a0a0', cursor: 'pointer', fontWeight: '500', paddingBottom: '0.5rem' }}>
            📋 Movimientos
          </button>
        </nav>
      </header>

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 1rem' }}>
        
        {activeTab === 'dashboard' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
            <div style={{ backgroundColor: '#1a1a1a', padding: '1.75rem', borderRadius: '4px', border: '1px solid #2a2a2a', borderLeft: '4px solid #C4A747' }}>
              <p style={{ fontSize: '0.85rem', color: '#a0a0a0', margin: 0 }}>RESPONSABLES</p>
              <p style={{ fontSize: '2rem', fontWeight: '700', color: '#C4A747', margin: '0.5rem 0 0 0' }}>{responsables.length}</p>
            </div>
            <div style={{ backgroundColor: '#1a1a1a', padding: '1.75rem', borderRadius: '4px', border: '1px solid #2a2a2a', borderLeft: '4px solid #C4A747' }}>
              <p style={{ fontSize: '0.85rem', color: '#a0a0a0', margin: 0 }}>PROVEEDORES</p>
              <p style={{ fontSize: '2rem', fontWeight: '700', color: '#C4A747', margin: '0.5rem 0 0 0' }}>{proveedores.length}</p>
            </div>
            <div style={{ backgroundColor: '#1a1a1a', padding: '1.75rem', borderRadius: '4px', border: '1px solid #2a2a2a', borderLeft: '4px solid #C4A747' }}>
              <p style={{ fontSize: '0.85rem', color: '#a0a0a0', margin: 0 }}>GASTOS</p>
              <p style={{ fontSize: '2rem', fontWeight: '700', color: '#C4A747', margin: '0.5rem 0 0 0' }}>{gastos.length}</p>
            </div>
            <div style={{ backgroundColor: '#1a1a1a', padding: '1.75rem', borderRadius: '4px', border: '1px solid #2a2a2a', borderLeft: '4px solid #C4A747' }}>
              <p style={{ fontSize: '0.85rem', color: '#a0a0a0', margin: 0 }}>TOTAL</p>
              <p style={{ fontSize: '2rem', fontWeight: '700', color: '#C4A747', margin: '0.5rem 0 0 0' }}>${(totalGastos / 1000000).toFixed(1)}M</p>
            </div>
          </div>
        )}

        {activeTab === 'gestion' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            
            {/* RESPONSABLES */}
            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ color: '#C4A747', margin: 0 }}>👥 Responsables</h2>
                <button onClick={() => setShowResponsableForm(!showResponsableForm)} style={{ backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', padding: '0.5rem 1rem', fontWeight: 'bold', cursor: 'pointer' }}>
                  ➕
                </button>
              </div>

              {showResponsableForm && (
                <div style={{ backgroundColor: '#0f0f0f', padding: '1rem', borderRadius: '4px', marginBottom: '1rem' }}>
                  <input type="text" placeholder="Nombre" value={formResponsable.nombre} onChange={(e) => setFormResponsable({...formResponsable, nombre: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '0.75rem', boxSizing: 'border-box' }} />
                  <select value={formResponsable.empresa} onChange={(e) => setFormResponsable({...formResponsable, empresa: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '0.75rem', boxSizing: 'border-box' }}>
                    <option value="">Empresa</option>
                    {EMPRESAS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={handleAddResponsable} style={{ flex: 1, padding: '0.5rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>Guardar</button>
                    <button onClick={() => setShowResponsableForm(false)} style={{ flex: 1, padding: '0.5rem', backgroundColor: '#2a2a2a', color: '#a0a0a0', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>Cancelar</button>
                  </div>
                </div>
              )}

              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {responsables.slice(0, 20).map(r => (
                  <div key={r.id} style={{ backgroundColor: '#0f0f0f', padding: '0.75rem', borderRadius: '4px', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ color: '#C4A747', margin: 0, fontSize: '0.9rem', fontWeight: 'bold' }}>{r.nombre.split(' ')[0]}</p>
                      <p style={{ fontSize: '0.75rem', color: '#7a7a7a', margin: '0.25rem 0 0 0' }}>{r.empresa.split(' ')[0]}</p>
                    </div>
                    <button onClick={() => handleDeleteResponsable(r.id)} style={{ background: 'rgba(220, 53, 69, 0.2)', border: 'none', borderRadius: '3px', padding: '0.4rem 0.6rem', cursor: 'pointer', color: '#ff6b6b', fontSize: '0.85rem' }}>🗑️</button>
                  </div>
                ))}
              </div>
            </div>

            {/* PROVEEDORES */}
            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ color: '#C4A747', margin: 0 }}>🏢 Proveedores</h2>
                <button onClick={() => setShowProveedorForm(!showProveedorForm)} style={{ backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', padding: '0.5rem 1rem', fontWeight: 'bold', cursor: 'pointer' }}>
                  ➕
                </button>
              </div>

              {showProveedorForm && (
                <div style={{ backgroundColor: '#0f0f0f', padding: '1rem', borderRadius: '4px', marginBottom: '1rem' }}>
                  <input type="text" placeholder="Nombre" value={formProveedor.nombre} onChange={(e) => setFormProveedor({...formProveedor, nombre: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '0.75rem', boxSizing: 'border-box' }} />
                  <input type="text" placeholder="Tipo de servicio" value={formProveedor.tipo} onChange={(e) => setFormProveedor({...formProveedor, tipo: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '0.75rem', boxSizing: 'border-box' }} />
                  <select value={formProveedor.empresa} onChange={(e) => setFormProveedor({...formProveedor, empresa: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '0.75rem', boxSizing: 'border-box' }}>
                    <option value="">Empresa</option>
                    {EMPRESAS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={handleAddProveedor} style={{ flex: 1, padding: '0.5rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>Guardar</button>
                    <button onClick={() => setShowProveedorForm(false)} style={{ flex: 1, padding: '0.5rem', backgroundColor: '#2a2a2a', color: '#a0a0a0', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>Cancelar</button>
                  </div>
                </div>
              )}

              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {proveedores.map(p => (
                  <div key={p.id} style={{ backgroundColor: '#0f0f0f', padding: '0.75rem', borderRadius: '4px', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ color: '#C4A747', margin: 0, fontSize: '0.9rem', fontWeight: 'bold' }}>{p.nombre}</p>
                      <p style={{ fontSize: '0.75rem', color: '#7a7a7a', margin: '0.25rem 0 0 0' }}>{p.tipo}</p>
                    </div>
                    <button onClick={() => handleDeleteProveedor(p.id)} style={{ background: 'rgba(220, 53, 69, 0.2)', border: 'none', borderRadius: '3px', padding: '0.4rem 0.6rem', cursor: 'pointer', color: '#ff6b6b', fontSize: '0.85rem' }}>🗑️</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'gastos' && (
          <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
            <h2 style={{ color: '#C4A747', marginBottom: '1.5rem' }}>➕ Registrar Gasto</h2>
            
            <div style={{ backgroundColor: '#0f0f0f', padding: '1.5rem', borderRadius: '4px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', display: 'block', marginBottom: '0.5rem' }}>EMPRESA</label>
                  <select value={formGasto.empresa} onChange={(e) => setFormGasto({...formGasto, empresa: e.target.value, responsable: '', proveedor: ''})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }}>
                    <option value="">Seleccionar</option>
                    {EMPRESAS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', display: 'block', marginBottom: '0.5rem' }}>TIPO</label>
                  <select value={formGasto.tipo} onChange={(e) => setFormGasto({...formGasto, tipo: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }}>
                    <option value="RESPONSABLE">Responsable</option>
                    <option value="PROVEEDOR">Proveedor</option>
                  </select>
                </div>
              </div>

              {formGasto.tipo === 'RESPONSABLE' ? (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', display: 'block', marginBottom: '0.5rem' }}>RESPONSABLE</label>
                  <select value={formGasto.responsable} onChange={(e) => setFormGasto({...formGasto, responsable: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }}>
                    <option value="">Seleccionar</option>
                    {responsablesDelEmpresa.map(r => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
                  </select>
                </div>
              ) : (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', display: 'block', marginBottom: '0.5rem' }}>PROVEEDOR</label>
                  <select value={formGasto.proveedor} onChange={(e) => setFormGasto({...formGasto, proveedor: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }}>
                    <option value="">Seleccionar</option>
                    {proveedoresDelEmpresa.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', display: 'block', marginBottom: '0.5rem' }}>DETALLE</label>
                  <input type="text" placeholder="Descripción" value={formGasto.detalle} onChange={(e) => setFormGasto({...formGasto, detalle: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }} />
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', display: 'block', marginBottom: '0.5rem' }}>VALOR</label>
                  <input type="number" placeholder="0.00" value={formGasto.valor} onChange={(e) => setFormGasto({...formGasto, valor: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }} />
                </div>
              </div>

              <button onClick={handleAddGasto} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                💾 Guardar Gasto
              </button>
            </div>
          </div>
        )}

        {activeTab === 'movimientos' && (
          <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
            <h2 style={{ color: '#C4A747', marginBottom: '1.5rem' }}>📋 Movimientos ({gastos.length})</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0f0f0f', borderBottom: '2px solid #C4A747' }}>
                    <th style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '600', color: '#C4A747' }}>Fecha</th>
                    <th style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '600', color: '#C4A747' }}>De</th>
                    <th style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '600', color: '#C4A747' }}>Empresa</th>
                    <th style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '600', color: '#C4A747' }}>Detalle</th>
                    <th style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: '600', color: '#C4A747' }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {gastos.map(g => (
                    <tr key={g.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                      <td style={{ padding: '1rem 0.75rem', color: '#d0d0d0' }}>{g.fecha}</td>
                      <td style={{ padding: '1rem 0.75rem', color: '#d0d0d0' }}>{g.tipo === 'RESPONSABLE' ? g.responsable : g.proveedor}</td>
                      <td style={{ padding: '1rem 0.75rem', color: '#d0d0d0' }}>{g.empresa.split(' ')[0]}</td>
                      <td style={{ padding: '1rem 0.75rem', color: '#d0d0d0' }}>{g.detalle}</td>
                      <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: 'bold', color: '#C4A747' }}>${g.valor.toLocaleString('es-CO')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
