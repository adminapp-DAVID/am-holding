import React, { useState, useEffect } from 'react';

function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [responsables, setResponsables] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showResponsableForm, setShowResponsableForm] = useState(false);
  const [editingResponsable, setEditingResponsable] = useState(null);
  const [filterCECO, setFilterCECO] = useState('all');
  const [filterEmpresa, setFilterEmpresa] = useState('all');

  const [formData, setFormData] = useState({
    empresa: '',
    ceco: '',
    tipoPago: '',
    detalle: '',
    valor: '',
    fecha: new Date().toISOString().split('T')[0],
    responsable: ''
  });

  const [responsableData, setResponsableData] = useState({
    nombre: '',
    empresa: '',
    tipo: 'PROVEEDOR DE SERVICIOS PROFESIONALES'
  });

  const usuarios = [
    { email: 'admin@amholding.com', password: 'admin123', role: 'Administradores' },
    { email: 'gerente@amholding.com', password: 'gerente123', role: 'Gerentes' },
    { email: 'contador@amholding.com', password: 'contador123', role: 'Contadores' }
  ];

  const CECOS = [
    { id: 'CECO-001-GF', nombre: 'Gastos fijos' },
    { id: 'CECO-002-NM', nombre: 'Nómina' },
    { id: 'CECO-003-GR', nombre: 'Gastos de representación' },
    { id: 'CECO-004-HR', nombre: 'Honorarios' },
    { id: 'CECO-005-AM', nombre: 'Gastos personales Andrei Martinez' },
    { id: 'CECO-006-VI', nombre: 'Viajes (Caelum)' },
    { id: 'CECO-007-PRS', nombre: 'Préstamos interbancarios' },
    { id: 'CECO-008-TRS', nombre: 'Traslado de fondos' },
    { id: 'CECO-009-RTE', nombre: 'Retenciones' },
    { id: 'CECO-010-SS', nombre: 'Seguridad social' }
  ];

  const EMPRESAS = ['AM SPORTS', 'PRO GLOBAL', 'PRONOVA', 'FORSEVEN', 'ARKO', 'CUBO'];
  const TIPOS_PAGO = ['ADMINISTRATIVOS', 'REEMBOLSO', 'ANTICIPO', 'GIRO INTERNO', 'PAGOS GENERAL'];

  useEffect(() => {
    const savedTransactions = localStorage.getItem('amTransactions');
    const savedResponsables = localStorage.getItem('amResponsables');
    if (savedTransactions) setTransactions(JSON.parse(savedTransactions));
    if (savedResponsables) setResponsables(JSON.parse(savedResponsables));
  }, []);

  useEffect(() => {
    localStorage.setItem('amTransactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('amResponsables', JSON.stringify(responsables));
  }, [responsables]);

  const handleLogin = () => {
    const usuarioEncontrado = usuarios.find(u => u.email === email && u.password === password);
    if (usuarioEncontrado) {
      setUser({ email, role: usuarioEncontrado.role });
      setError('');
    } else {
      setError('Email o contraseña incorrectos');
    }
  };

  const handleAddResponsable = () => {
    if (!responsableData.nombre || !responsableData.empresa) {
      alert('Completa nombre y empresa');
      return;
    }
    if (editingResponsable) {
      setResponsables(responsables.map(r => r.id === editingResponsable.id ? { ...responsableData, id: editingResponsable.id } : r));
      setEditingResponsable(null);
    } else {
      setResponsables([...responsables, { id: Date.now(), ...responsableData }]);
    }
    setResponsableData({ nombre: '', empresa: '', tipo: 'PROVEEDOR DE SERVICIOS PROFESIONALES' });
    setShowResponsableForm(false);
  };

  const handleDeleteResponsable = (id) => {
    setResponsables(responsables.filter(r => r.id !== id));
  };

  const handleAddTransaction = () => {
    if (!formData.empresa || !formData.ceco || !formData.valor || !formData.detalle) {
      alert('Completa todos los campos');
      return;
    }
    const newTransaction = {
      id: Date.now(),
      ...formData,
      valor: parseFloat(formData.valor),
      createdBy: user.email
    };
    setTransactions([newTransaction, ...transactions]);
    setFormData({ empresa: '', ceco: '', tipoPago: '', detalle: '', valor: '', fecha: new Date().toISOString().split('T')[0], responsable: '' });
    setShowForm(false);
  };

  const handleDeleteTransaction = (id) => {
    setTransactions(transactions.filter(t => t.id !== id));
  };

  const responsablesDelEmpresa = formData.empresa ? responsables.filter(r => r.empresa === formData.empresa) : responsables;

  const filteredTransactions = transactions.filter(t => {
    const cecoMatch = filterCECO === 'all' || t.ceco === filterCECO;
    const empresaMatch = filterEmpresa === 'all' || t.empresa === filterEmpresa;
    return cecoMatch && empresaMatch;
  });

  const totalGastos = filteredTransactions.reduce((sum, t) => sum + t.valor, 0);

  const gastosPorCECO = CECOS.filter(c => filteredTransactions.some(t => t.ceco === c.id))
    .map(c => ({
      ...c,
      total: filteredTransactions.filter(t => t.ceco === c.id).reduce((sum, t) => sum + t.valor, 0)
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const gastosPorEmpresa = EMPRESAS.filter(e => filteredTransactions.some(t => t.empresa === e))
    .map(e => ({
      empresa: e,
      total: filteredTransactions.filter(t => t.empresa === e).reduce((sum, t) => sum + t.valor, 0)
    }))
    .sort((a, b) => b.total - a.total);

  const exportarCSV = () => {
    const headers = ['Fecha', 'Empresa', 'CECO', 'Tipo Pago', 'Responsable', 'Detalle', 'Valor'];
    let csv = headers.join(',') + '\n';
    filteredTransactions.forEach(t => {
      csv += [t.fecha, t.empresa, t.ceco, t.tipoPago, t.responsable || '', `"${t.detalle}"`, t.valor].join(',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reportes_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
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

        <div style={{ maxWidth: '1400px', margin: '1rem auto 0', display: 'flex', gap: '2rem', borderTop: '1px solid rgba(196, 167, 71, 0.2)', paddingTop: '1rem', overflowX: 'auto' }}>
          {user.role === 'Administradores' && (
            <>
              <button onClick={() => setActiveTab('registro')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'registro' ? '3px solid #C4A747' : 'none', color: activeTab === 'registro' ? '#C4A747' : '#a0a0a0', cursor: 'pointer', fontWeight: '500', paddingBottom: '0.5rem', whiteSpace: 'nowrap' }}>➕ Nuevo Gasto</button>
              <button onClick={() => setActiveTab('responsables')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'responsables' ? '3px solid #C4A747' : 'none', color: activeTab === 'responsables' ? '#C4A747' : '#a0a0a0', cursor: 'pointer', fontWeight: '500', paddingBottom: '0.5rem', whiteSpace: 'nowrap' }}>👥 Responsables</button>
            </>
          )}
          <button onClick={() => setActiveTab('dashboard')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'dashboard' ? '3px solid #C4A747' : 'none', color: activeTab === 'dashboard' ? '#C4A747' : '#a0a0a0', cursor: 'pointer', fontWeight: '500', paddingBottom: '0.5rem', whiteSpace: 'nowrap' }}>📊 Dashboard</button>
          <button onClick={() => setActiveTab('movimientos')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'movimientos' ? '3px solid #C4A747' : 'none', color: activeTab === 'movimientos' ? '#C4A747' : '#a0a0a0', cursor: 'pointer', fontWeight: '500', paddingBottom: '0.5rem', whiteSpace: 'nowrap' }}>📋 Movimientos</button>
          {user.role === 'Contadores' && (
            <button onClick={() => setActiveTab('reportes')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'reportes' ? '3px solid #C4A747' : 'none', color: activeTab === 'reportes' ? '#C4A747' : '#a0a0a0', cursor: 'pointer', fontWeight: '500', paddingBottom: '0.5rem', whiteSpace: 'nowrap' }}>📥 Reportes</button>
          )}
        </div>
      </header>

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 1rem' }}>
        {activeTab === 'dashboard' && (
          <>
            <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', backgroundColor: '#1a1a1a', padding: '1.5rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', display: 'block', marginBottom: '0.5rem' }}>CECO</label>
                <select value={filterCECO} onChange={(e) => setFilterCECO(e.target.value)} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', fontFamily: 'inherit' }}>
                  <option value="all">Todos</option>
                  {CECOS.map(c => <option key={c.id} value={c.id}>{c.id}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', display: 'block', marginBottom: '0.5rem' }}>EMPRESA</label>
                <select value={filterEmpresa} onChange={(e) => setFilterEmpresa(e.target.value)} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', fontFamily: 'inherit' }}>
                  <option value="all">Todas</option>
                  {EMPRESAS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ backgroundColor: '#1a1a1a', padding: '1.75rem', borderRadius: '4px', border: '1px solid #2a2a2a', borderLeft: '4px solid #C4A747' }}>
                <p style={{ fontSize: '0.85rem', color: '#a0a0a0', margin: 0, textTransform: 'uppercase' }}>Total Gastos</p>
                <p style={{ fontSize: '2rem', fontWeight: '700', color: '#C4A747', margin: '0.5rem 0 0 0' }}>${(totalGastos / 1000000).toFixed(1)}M</p>
              </div>
              <div style={{ backgroundColor: '#1a1a1a', padding: '1.75rem', borderRadius: '4px', border: '1px solid #2a2a2a', borderLeft: '4px solid #C4A747' }}>
                <p style={{ fontSize: '0.85rem', color: '#a0a0a0', margin: 0, textTransform: 'uppercase' }}>Registros</p>
                <p style={{ fontSize: '2rem', fontWeight: '700', color: '#C4A747', margin: '0.5rem 0 0 0' }}>{filteredTransactions.length}</p>
              </div>
              <div style={{ backgroundColor: '#1a1a1a', padding: '1.75rem', borderRadius: '4px', border: '1px solid #2a2a2a', borderLeft: '4px solid #C4A747' }}>
                <p style={{ fontSize: '0.85rem', color: '#a0a0a0', margin: 0, textTransform: 'uppercase' }}>Promedio</p>
                <p style={{ fontSize: '2rem', fontWeight: '700', color: '#C4A747', margin: '0.5rem 0 0 0' }}>${filteredTransactions.length > 0 ? (totalGastos / filteredTransactions.length / 1000000).toFixed(2) : '0'}M</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
              <div style={{ backgroundColor: '#1a1a1a', padding: '1.75rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#fff', margin: '0 0 1.5rem 0' }}>💰 Top CECOs</h3>
                {gastosPorCECO.map((c, idx) => (
                  <div key={c.id} style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div>
                        <strong style={{ fontSize: '0.95rem' }}>{c.id}</strong>
                        <p style={{ fontSize: '0.75rem', color: '#7a7a7a', margin: '0.25rem 0 0 0' }}>{c.nombre}</p>
                      </div>
                      <span style={{ fontSize: '0.95rem', fontWeight: '600', color: '#C4A747' }}>${(c.total / 1000000).toFixed(1)}M</span>
                    </div>
                    <div style={{ height: '6px', backgroundColor: 'rgba(196, 167, 71, 0.3)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', backgroundColor: '#C4A747', width: `${(c.total / Math.max(...gastosPorCECO.map(x => x.total))) * 100}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ backgroundColor: '#1a1a1a', padding: '1.75rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#fff', margin: '0 0 1.5rem 0' }}>🏢 Por Empresa</h3>
                {gastosPorEmpresa.map((e, idx) => (
                  <div key={e.empresa} style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <strong style={{ fontSize: '0.95rem' }}>{e.empresa}</strong>
                      <span style={{ fontSize: '0.95rem', fontWeight: '600', color: '#C4A747' }}>${(e.total / 1000000).toFixed(1)}M</span>
                    </div>
                    <div style={{ height: '6px', backgroundColor: 'rgba(196, 167, 71, 0.3)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', backgroundColor: '#C4A747', width: `${(e.total / Math.max(...gastosPorEmpresa.map(x => x.total), 1)) * 100}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'registro' && user.role === 'Administradores' && (
          <>
            <button onClick={() => setShowForm(!showForm)} style={{ backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', padding: '0.75rem 1.5rem', fontWeight: 'bold', cursor: 'pointer', marginBottom: '2rem', fontFamily: 'inherit' }}>
              {showForm ? 'Cancelar' : 'Nuevo Gasto'}
            </button>

            {showForm && (
              <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: '0 0 1.75rem 0', color: '#C4A747' }}>📝 Registrar Gasto</h2>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', display: 'block', marginBottom: '0.5rem' }}>EMPRESA</label>
                    <select value={formData.empresa} onChange={(e) => setFormData({...formData, empresa: e.target.value, responsable: ''})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }}>
                      <option value="">Seleccionar</option>
                      {EMPRESAS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', display: 'block', marginBottom: '0.5rem' }}>CECO</label>
                    <select value={formData.ceco} onChange={(e) => setFormData({...formData, ceco: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }}>
                      <option value="">Seleccionar</option>
                      {CECOS.map(c => <option key={c.id} value={c.id}>{c.id}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', display: 'block', marginBottom: '0.5rem' }}>TIPO DE PAGO</label>
                    <select value={formData.tipoPago} onChange={(e) => setFormData({...formData, tipoPago: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }}>
                      <option value="">Seleccionar</option>
                      {TIPOS_PAGO.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', display: 'block', marginBottom: '0.5rem' }}>VALOR</label>
                    <input type="number" value={formData.valor} onChange={(e) => setFormData({...formData, valor: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }} placeholder="0.00" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', display: 'block', marginBottom: '0.5rem' }}>RESPONSABLE / PROVEEDOR</label>
                    <select value={formData.responsable} onChange={(e) => setFormData({...formData, responsable: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }}>
                      <option value="">Seleccionar</option>
                      {responsablesDelEmpresa.map(r => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', display: 'block', marginBottom: '0.5rem' }}>FECHA</label>
                    <input type="date" value={formData.fecha} onChange={(e) => setFormData({...formData, fecha: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', display: 'block', marginBottom: '0.5rem' }}>DETALLE</label>
                  <textarea value={formData.detalle} onChange={(e) => setFormData({...formData, detalle: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', fontFamily: 'inherit', boxSizing: 'border-box', minHeight: '100px' }} placeholder="Descripción del gasto" />
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button onClick={handleAddTransaction} style={{ flex: 1, padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>💾 Guardar</button>
                  <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: '0.75rem', backgroundColor: '#2a2a2a', color: '#a0a0a0', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>❌ Cancelar</button>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'responsables' && user.role === 'Administradores' && (
          <>
            <button onClick={() => { setShowResponsableForm(!showResponsableForm); setEditingResponsable(null); setResponsableData({ nombre: '', empresa: '', tipo: 'PROVEEDOR DE SERVICIOS PROFESIONALES' }); }} style={{ backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', padding: '0.75rem 1.5rem', fontWeight: 'bold', cursor: 'pointer', marginBottom: '2rem', fontFamily: 'inherit' }}>
              {showResponsableForm ? 'Cancelar' : '➕ Nuevo Responsable'}
            </button>

            {showResponsableForm && (
              <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: '0 0 1.75rem 0', color: '#C4A747' }}>{editingResponsable ? '✏️ Editar Responsable' : '👥 Agregar Responsable'}</h2>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', display: 'block', marginBottom: '0.5rem' }}>NOMBRE</label>
                    <input type="text" value={responsableData.nombre} onChange={(e) => setResponsableData({...responsableData, nombre: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }} placeholder="Nombre completo" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', display: 'block', marginBottom: '0.5rem' }}>EMPRESA</label>
                    <select value={responsableData.empresa} onChange={(e) => setResponsableData({...responsableData, empresa: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }}>
                      <option value="">Seleccionar</option>
                      {EMPRESAS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', display: 'block', marginBottom: '0.5rem' }}>TIPO</label>
                  <select value={responsableData.tipo} onChange={(e) => setResponsableData({...responsableData, tipo: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }}>
                    <option value="PROVEEDOR DE SERVICIOS PROFESIONALES">PROVEEDOR DE SERVICIOS PROFESIONALES</option>
                    <option value="PROVEEDOR SERVICIO EMPRESARIAL">PROVEEDOR SERVICIO EMPRESARIAL</option>
                    <option value="PROVEEDOR SERVICIOS FINANCIEROS">PROVEEDOR SERVICIOS FINANCIEROS</option>
                    <option value="EMPLEADO">EMPLEADO</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button onClick={handleAddResponsable} style={{ flex: 1, padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>💾 {editingResponsable ? 'Actualizar' : 'Guardar'}</button>
                  <button onClick={() => { setShowResponsableForm(false); setEditingResponsable(null); }} style={{ flex: 1, padding: '0.75rem', backgroundColor: '#2a2a2a', color: '#a0a0a0', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>❌ Cancelar</button>
                </div>
              </div>
            )}

            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: '0 0 1.75rem 0', color: '#C4A747' }}>👥 Responsables ({responsables.length})</h2>
              
              {responsables.length === 0 ? (
                <p style={{ color: '#7a7a7a', textAlign: 'center', padding: '2rem' }}>Sin responsables registrados</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#0f0f0f', borderBottom: '2px solid #C4A747' }}>
                        <th style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '600', color: '#C4A747', fontSize: '0.85rem', textTransform: 'uppercase' }}>Nombre</th>
                        <th style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '600', color: '#C4A747', fontSize: '0.85rem', textTransform: 'uppercase' }}>Empresa</th>
                        <th style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '600', color: '#C4A747', fontSize: '0.85rem', textTransform: 'uppercase' }}>Tipo</th>
                        <th style={{ padding: '1rem 0.75rem', textAlign: 'center', fontWeight: '600', color: '#C4A747', fontSize: '0.85rem', textTransform: 'uppercase' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {responsables.map(r => (
                        <tr key={r.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                          <td style={{ padding: '1rem 0.75rem', color: '#d0d0d0' }}><strong>{r.nombre}</strong></td>
                          <td style={{ padding: '1rem 0.75rem', color: '#d0d0d0' }}>{r.empresa}</td>
                          <td style={{ padding: '1rem 0.75rem', color: '#d0d0d0' }}><small>{r.tipo}</small></td>
                          <td style={{ padding: '1rem 0.75rem', textAlign: 'center', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            <button onClick={() => { setEditingResponsable(r); setResponsableData(r); setShowResponsableForm(true); }} style={{ background: 'rgba(196, 167, 71, 0.15)', border: '1px solid #C4A747', borderRadius: '4px', padding: '0.5rem 0.75rem', cursor: 'pointer', color: '#C4A747', fontFamily: 'inherit' }}>✏️</button>
                            <button onClick={() => handleDeleteResponsable(r.id)} style={{ background: 'rgba(220, 53, 69, 0.15)', border: '1px solid #dc3545', borderRadius: '4px', padding: '0.5rem 0.75rem', cursor: 'pointer', color: '#ff6b6b', fontFamily: 'inherit' }}>🗑️</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'movimientos' && (
          <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: '0 0 1.75rem 0', color: '#C4A747' }}>📋 Movimientos ({filteredTransactions.length})</h2>
            
            {filteredTransactions.length === 0 ? (
              <p style={{ color: '#7a7a7a', textAlign: 'center', padding: '2rem' }}>Sin registros</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#0f0f0f', borderBottom: '2px solid #C4A747' }}>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '600', color: '#C4A747', fontSize: '0.85rem', textTransform: 'uppercase' }}>Fecha</th>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '600', color: '#C4A747', fontSize: '0.85rem', textTransform: 'uppercase' }}>Empresa</th>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '600', color: '#C4A747', fontSize: '0.85rem', textTransform: 'uppercase' }}>CECO</th>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '600', color: '#C4A747', fontSize: '0.85rem', textTransform: 'uppercase' }}>Responsable</th>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '600', color: '#C4A747', fontSize: '0.85rem', textTransform: 'uppercase' }}>Detalle</th>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: '600', color: '#C4A747', fontSize: '0.85rem', textTransform: 'uppercase' }}>Valor</th>
                      {user.role === 'Administradores' && <th style={{ padding: '1rem 0.75rem', textAlign: 'center', fontWeight: '600', color: '#C4A747', fontSize: '0.85rem', textTransform: 'uppercase' }}>Acción</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map(t => (
                      <tr key={t.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                        <td style={{ padding: '1rem 0.75rem', color: '#d0d0d0' }}>{t.fecha}</td>
                        <td style={{ padding: '1rem 0.75rem', color: '#d0d0d0' }}><strong>{t.empresa}</strong></td>
                        <td style={{ padding: '1rem 0.75rem', color: '#d0d0d0' }}><small>{t.ceco}</small></td>
                        <td style={{ padding: '1rem 0.75rem', color: '#d0d0d0' }}>{t.responsable || '-'}</td>
                        <td style={{ padding: '1rem 0.75rem', color: '#d0d0d0', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.detalle}</td>
                        <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: 'bold', color: '#C4A747' }}>${t.valor.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</td>
                        {user.role === 'Administradores' && (
                          <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                            <button onClick={() => handleDeleteTransaction(t.id)} style={{ background: 'rgba(220, 53, 69, 0.15)', border: '1px solid #dc3545', borderRadius: '4px', padding: '0.5rem 0.75rem', cursor: 'pointer', color: '#ff6b6b', fontFamily: 'inherit' }}>🗑️</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'reportes' && user.role === 'Contadores' && (
          <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: '0 0 1rem 0', color: '#C4A747' }}>📥 Exportar Reportes</h2>
            <p style={{ color: '#a0a0a0', margin: '0 0 2rem 0' }}>Total de registros: {filteredTransactions.length} | Total gastos: ${(totalGastos / 1000000).toFixed(2)}M</p>
            
            <button onClick={exportarCSV} style={{ backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', padding: '0.75rem 1.5rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>
              📥 Descargar CSV
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
