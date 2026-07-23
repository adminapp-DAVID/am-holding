import React, { useState, useEffect } from 'react';

export default function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [responsables, setResponsables] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [newResp, setNewResp] = useState({ nombre: '', empresa: '' });
  const [newProv, setNewProv] = useState({ nombre: '', tipo: '', empresa: '' });
  const [filterEmpresa, setFilterEmpresa] = useState('');

  const users = [{ id: 1, nombre: 'Admin', email: 'admin@amholding.com', password: 'admin123', rol: 'admin' }];

  const responsablesDefault = [
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

  const empresas = ['AM SPORTS GROUP SAS', 'PRO INVESTMENTS GLOBAL SAS', 'PRONOVA CAPITAL SAS', 'FOR SEVEN MEDIA SAS', 'ARKO'];

  useEffect(() => {
    const saved = localStorage.getItem('amResponsables');
    const savedProv = localStorage.getItem('amProveedores');
    setResponsables(saved ? JSON.parse(saved) : responsablesDefault);
    setProveedores(savedProv ? JSON.parse(savedProv) : []);
  }, [responsablesDefault]);

  useEffect(() => {
    localStorage.setItem('amResponsables', JSON.stringify(responsables));
  }, [responsables]);

  useEffect(() => {
    localStorage.setItem('amProveedores', JSON.stringify(proveedores));
  }, [proveedores]);

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

  const handleAddResponsable = () => {
    if (!newResp.nombre || !newResp.empresa) {
      alert('Completa nombre y empresa');
      return;
    }
    setResponsables([...responsables, { id: Date.now(), ...newResp }]);
    setNewResp({ nombre: '', empresa: '' });
  };

  const handleDeleteResponsable = (id) => {
    setResponsables(responsables.filter(r => r.id !== id));
  };

  const handleAddProveedor = () => {
    if (!newProv.nombre || !newProv.empresa) {
      alert('Completa nombre y empresa');
      return;
    }
    setProveedores([...proveedores, { id: Date.now(), ...newProv }]);
    setNewProv({ nombre: '', tipo: '', empresa: '' });
  };

  const handleDeleteProveedor = (id) => {
    setProveedores(proveedores.filter(p => p.id !== id));
  };

  const filteredResponsables = filterEmpresa ? responsables.filter(r => r.empresa === filterEmpresa) : responsables;
  const filteredProveedores = filterEmpresa ? proveedores.filter(p => p.empresa === filterEmpresa) : proveedores;

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
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ color: '#C4A747', margin: 0 }}>AM HOLDING</h1>
            <p style={{ fontSize: '0.85rem', color: '#a0a0a0', margin: '0.5rem 0 0 0' }}>{user.nombre}</p>
          </div>
          <button onClick={() => setUser(null)} style={{ backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Salir</button>
        </div>
      </header>

      <nav style={{ backgroundColor: '#1a1a1a', borderBottom: '1px solid #2a2a2a', padding: '1rem' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', gap: '2rem' }}>
          <button onClick={() => { setActiveTab('dashboard'); setFilterEmpresa(''); }} style={{ background: 'none', border: 'none', color: activeTab === 'dashboard' ? '#C4A747' : '#a0a0a0', cursor: 'pointer', fontWeight: '500', borderBottom: activeTab === 'dashboard' ? '2px solid #C4A747' : 'none', paddingBottom: '0.5rem' }}>📊 Dashboard</button>
          <button onClick={() => setActiveTab('responsables')} style={{ background: 'none', border: 'none', color: activeTab === 'responsables' ? '#C4A747' : '#a0a0a0', cursor: 'pointer', fontWeight: '500', borderBottom: activeTab === 'responsables' ? '2px solid #C4A747' : 'none', paddingBottom: '0.5rem' }}>👥 Responsables</button>
          <button onClick={() => setActiveTab('proveedores')} style={{ background: 'none', border: 'none', color: activeTab === 'proveedores' ? '#C4A747' : '#a0a0a0', cursor: 'pointer', fontWeight: '500', borderBottom: activeTab === 'proveedores' ? '2px solid #C4A747' : 'none', paddingBottom: '0.5rem' }}>🏢 Proveedores</button>
        </div>
      </nav>

      <main style={{ maxWidth: '1400px', margin: '2rem auto', padding: '0 1rem' }}>
        
        {activeTab === 'dashboard' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div style={{ backgroundColor: '#1a1a1a', padding: '1.5rem', borderRadius: '4px', border: '1px solid #2a2a2a', borderLeft: '4px solid #C4A747' }}>
              <p style={{ color: '#a0a0a0', fontSize: '0.85rem', margin: 0 }}>RESPONSABLES</p>
              <p style={{ color: '#C4A747', fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0 0 0' }}>{responsables.length}</p>
            </div>
            <div style={{ backgroundColor: '#1a1a1a', padding: '1.5rem', borderRadius: '4px', border: '1px solid #2a2a2a', borderLeft: '4px solid #C4A747' }}>
              <p style={{ color: '#a0a0a0', fontSize: '0.85rem', margin: 0 }}>PROVEEDORES</p>
              <p style={{ color: '#C4A747', fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0 0 0' }}>{proveedores.length}</p>
            </div>
            <div style={{ backgroundColor: '#1a1a1a', padding: '1.5rem', borderRadius: '4px', border: '1px solid #2a2a2a', borderLeft: '4px solid #C4A747' }}>
              <p style={{ color: '#a0a0a0', fontSize: '0.85rem', margin: 0 }}>EMPRESAS</p>
              <p style={{ color: '#C4A747', fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0 0 0' }}>{empresas.length}</p>
            </div>
          </div>
        )}

        {activeTab === 'responsables' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            
            {/* NUEVA RESPONSABLE */}
            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
              <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0', fontSize: '1.1rem' }}>➕ Agregar Responsable</h2>
              <input type="text" placeholder="Nombre completo" value={newResp.nombre} onChange={(e) => setNewResp({...newResp, nombre: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }} />
              <select value={newResp.empresa} onChange={(e) => setNewResp({...newResp, empresa: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }}>
                <option value="">Seleccionar empresa</option>
                {empresas.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <button onClick={handleAddResponsable} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Guardar</button>
            </div>

            {/* LISTA RESPONSABLES */}
            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ color: '#C4A747', margin: '0 0 1rem 0', fontSize: '1.1rem' }}>Responsables ({filteredResponsables.length})</h2>
                <select value={filterEmpresa} onChange={(e) => setFilterEmpresa(e.target.value)} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }}>
                  <option value="">Todas las empresas</option>
                  {empresas.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {filteredResponsables.map(r => (
                  <div key={r.id} style={{ backgroundColor: '#0f0f0f', padding: '1rem', borderRadius: '4px', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ color: '#C4A747', margin: 0, fontWeight: 'bold', fontSize: '0.9rem' }}>{r.nombre}</p>
                      <p style={{ color: '#7a7a7a', fontSize: '0.8rem', margin: '0.25rem 0 0 0' }}>{r.empresa.split(' ')[0]}</p>
                    </div>
                    <button onClick={() => handleDeleteResponsable(r.id)} style={{ background: 'rgba(220, 53, 69, 0.2)', border: 'none', borderRadius: '3px', padding: '0.4rem 0.6rem', cursor: 'pointer', color: '#ff6b6b' }}>🗑️</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'proveedores' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            
            {/* NUEVO PROVEEDOR */}
            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
              <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0', fontSize: '1.1rem' }}>➕ Agregar Proveedor</h2>
              <input type="text" placeholder="Nombre/Razón Social" value={newProv.nombre} onChange={(e) => setNewProv({...newProv, nombre: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }} />
              <input type="text" placeholder="Tipo de servicio" value={newProv.tipo} onChange={(e) => setNewProv({...newProv, tipo: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }} />
              <select value={newProv.empresa} onChange={(e) => setNewProv({...newProv, empresa: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }}>
                <option value="">Seleccionar empresa</option>
                {empresas.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <button onClick={handleAddProveedor} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Guardar</button>
            </div>

            {/* LISTA PROVEEDORES */}
            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ color: '#C4A747', margin: '0 0 1rem 0', fontSize: '1.1rem' }}>Proveedores ({filteredProveedores.length})</h2>
                <select value={filterEmpresa} onChange={(e) => setFilterEmpresa(e.target.value)} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }}>
                  <option value="">Todas las empresas</option>
                  {empresas.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {filteredProveedores.map(p => (
                  <div key={p.id} style={{ backgroundColor: '#0f0f0f', padding: '1rem', borderRadius: '4px', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ color: '#C4A747', margin: 0, fontWeight: 'bold', fontSize: '0.9rem' }}>{p.nombre}</p>
                      <p style={{ color: '#7a7a7a', fontSize: '0.8rem', margin: '0.25rem 0 0 0' }}>{p.tipo}</p>
                    </div>
                    <button onClick={() => handleDeleteProveedor(p.id)} style={{ background: 'rgba(220, 53, 69, 0.2)', border: 'none', borderRadius: '3px', padding: '0.4rem 0.6rem', cursor: 'pointer', color: '#ff6b6b' }}>🗑️</button>
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
