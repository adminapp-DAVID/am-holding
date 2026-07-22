import React, { useState, useEffect } from 'react';
import { LogOut, Plus, Trash2 } from 'lucide-react';

const AMHoldingApp = () => {
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [filterCECO, setFilterCECO] = useState('all');
  const [filterEmpresa, setFilterEmpresa] = useState('all');

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

  const [formData, setFormData] = useState({
    codigoRef: '',
    fechaSolicitud: new Date().toISOString().split('T')[0],
    fechaPago: new Date().toISOString().split('T')[0],
    empresa: '',
    responsable: '',
    ceco: '',
    tipoPago: '',
    detalle: '',
    valor: '',
  });

  useEffect(() => {
    const savedData = localStorage.getItem('amTransactions');
    if (savedData) setTransactions(JSON.parse(savedData));
  }, []);

  useEffect(() => {
    localStorage.setItem('amTransactions', JSON.stringify(transactions));
  }, [transactions]);

  const handleLogin = (role) => {
    setUser({ name: role === 'admin' ? 'Administrador' : role === 'gerente' ? 'Gerente' : 'Contadora', role });
  };

  const handleLogout = () => {
    setUser(null);
    setShowForm(false);
  };

  const handleAddTransaction = () => {
    if (!formData.empresa || !formData.valor || !formData.detalle) {
      alert('Completa Empresa, Valor y Detalle');
      return;
    }

    const newTransaction = {
      id: Date.now(),
      ...formData,
      valor: parseFloat(formData.valor),
      createdBy: user.name,
    };

    setTransactions([newTransaction, ...transactions]);
    setFormData({
      codigoRef: '',
      fechaSolicitud: new Date().toISOString().split('T')[0],
      fechaPago: new Date().toISOString().split('T')[0],
      empresa: '',
      responsable: '',
      ceco: '',
      tipoPago: '',
      detalle: '',
      valor: '',
    });
    setShowForm(false);
  };

  const handleDeleteTransaction = (id) => {
    if (user.role !== 'admin') return;
    setTransactions(transactions.filter(t => t.id !== id));
  };

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
    .sort((a, b) => b.total - a.total);

  const gastosPorEmpresa = EMPRESAS.filter(e => filteredTransactions.some(t => t.empresa === e))
    .map(e => ({
      empresa: e,
      total: filteredTransactions.filter(t => t.empresa === e).reduce((sum, t) => sum + t.valor, 0)
    }))
    .sort((a, b) => b.total - a.total);

  if (!user) {
    return (
      <div style={styles.loginContainer}>
        <div style={styles.loginCard}>
          <h1 style={styles.loginTitle}>🏆 AM HOLDING</h1>
          <p style={styles.loginSubtitle}>Control de Gastos Corporativos</p>
          
          <div style={styles.loginButtons}>
            <button style={styles.adminButton} onClick={() => handleLogin('admin')}>
              👨‍💼 Admin
            </button>
            <button style={styles.gerenteButton} onClick={() => handleLogin('gerente')}>
              📊 Gerente
            </button>
            <button style={styles.contadoraButton} onClick={() => handleLogin('contadora')}>
              📋 Contadora
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div>
            <h1 style={styles.appTitle}>AM HOLDING</h1>
            <p style={styles.userBadge}>{user.name}</p>
          </div>
          <button style={styles.logoutButton} onClick={handleLogout}>
            Salir
          </button>
        </div>

        <nav style={styles.nav}>
          {user.role === 'admin' && (
            <button style={{...styles.navButton, ...(activeTab === 'registro' ? styles.navButtonActive : {})}} onClick={() => setActiveTab('registro')}>
              ➕ Nuevo
            </button>
          )}
          <button style={{...styles.navButton, ...(activeTab === 'dashboard' ? styles.navButtonActive : {})}} onClick={() => setActiveTab('dashboard')}>
            📊 Dashboard
          </button>
          <button style={{...styles.navButton, ...(activeTab === 'movimientos' ? styles.navButtonActive : {})}} onClick={() => setActiveTab('movimientos')}>
            📋 Movimientos
          </button>
          {user.role === 'contadora' && (
            <button style={{...styles.navButton, ...(activeTab === 'reportes' ? styles.navButtonActive : {})}} onClick={() => setActiveTab('reportes')}>
              📥 Reportes
            </button>
          )}
        </nav>
      </header>

      <main style={styles.main}>
        {activeTab === 'dashboard' && (
          <>
            <div style={styles.filtersSection}>
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>CECO</label>
                <select style={styles.filterSelect} value={filterCECO} onChange={(e) => setFilterCECO(e.target.value)}>
                  <option value="all">Todos</option>
                  {CECOS.map(c => <option key={c.id} value={c.id}>{c.id}</option>)}
                </select>
              </div>
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>Empresa</label>
                <select style={styles.filterSelect} value={filterEmpresa} onChange={(e) => setFilterEmpresa(e.target.value)}>
                  <option value="all">Todas</option>
                  {EMPRESAS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>

            <div style={styles.kpiGrid}>
              <div style={styles.kpiCard}>
                <p style={styles.kpiLabel}>Total Gastos</p>
                <p style={styles.kpiValue}>${(totalGastos / 1000000).toFixed(1)}M</p>
              </div>
              <div style={styles.kpiCard}>
                <p style={styles.kpiLabel}>Registros</p>
                <p style={styles.kpiValue}>{filteredTransactions.length}</p>
              </div>
              <div style={styles.kpiCard}>
                <p style={styles.kpiLabel}>Promedio</p>
                <p style={styles.kpiValue}>${filteredTransactions.length > 0 ? (totalGastos / filteredTransactions.length / 1000000).toFixed(2) : '0'}M</p>
              </div>
              <div style={styles.kpiCard}>
                <p style={styles.kpiLabel}>CECOs</p>
                <p style={styles.kpiValue}>{gastosPorCECO.length}</p>
              </div>
            </div>

            <div style={styles.chartsGrid}>
              <div style={styles.chartCard}>
                <h3 style={styles.chartTitle}>💰 Top 5 CECOs</h3>
                {gastosPorCECO.slice(0, 5).map((c, idx) => (
                  <div key={c.id} style={styles.chartItem}>
                    <div style={styles.chartItemHeader}>
                      <span style={styles.chartRank}>{idx + 1}</span>
                      <div>
                        <strong>{c.id}</strong>
                        <p style={{fontSize: '0.75rem', color: '#7a7a7a', margin: '0.1rem 0 0 0'}}>{c.nombre}</p>
                      </div>
                    </div>
                    <div style={{fontSize: '0.9rem', fontWeight: '600', color: '#C4A747'}}>
                      ${(c.total / 1000000).toFixed(1)}M
                    </div>
                    <div style={{...styles.chartBar, width: `${(c.total / Math.max(...gastosPorCECO.map(x => x.total))) * 100}%`}}></div>
                  </div>
                ))}
              </div>

              <div style={styles.chartCard}>
                <h3 style={styles.chartTitle}>🏢 Gastos por Empresa</h3>
                {gastosPorEmpresa.map((e, idx) => (
                  <div key={e.empresa} style={styles.chartItem}>
                    <div style={styles.chartItemHeader}>
                      <span style={styles.chartRank}>{idx + 1}</span>
                      <strong>{e.empresa}</strong>
                    </div>
                    <div style={{fontSize: '0.9rem', fontWeight: '600', color: '#C4A747'}}>
                      ${(e.total / 1000000).toFixed(1)}M
                    </div>
                    <div style={{...styles.chartBar, width: `${(e.total / Math.max(...gastosPorEmpresa.map(x => x.total), 1)) * 100}%`}}></div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'registro' && user.role === 'admin' && (
          <>
            <button style={styles.addButton} onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Cancelar' : 'Nuevo Gasto'}
            </button>

            {showForm && (
              <div style={styles.formContainer}>
                <h2 style={styles.formTitle}>📝 Registrar Nuevo Gasto</h2>
                
                <div style={styles.formGrid2}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Empresa *</label>
                    <select style={styles.input} value={formData.empresa} onChange={(e) => setFormData({...formData, empresa: e.target.value})}>
                      <option value="">Seleccionar</option>
                      {EMPRESAS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>CECO *</label>
                    <select style={styles.input} value={formData.ceco} onChange={(e) => setFormData({...formData, ceco: e.target.value})}>
                      <option value="">Seleccionar</option>
                      {CECOS.map(c => <option key={c.id} value={c.id}>{c.id}</option>)}
                    </select>
                  </div>
                </div>

                <div style={styles.formGrid2}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Tipo de Pago *</label>
                    <select style={styles.input} value={formData.tipoPago} onChange={(e) => setFormData({...formData, tipoPago: e.target.value})}>
                      <option value="">Seleccionar</option>
                      {TIPOS_PAGO.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Valor *</label>
                    <input type="number" style={styles.input} placeholder="0.00" value={formData.valor} onChange={(e) => setFormData({...formData, valor: e.target.value})} />
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Detalle *</label>
                  <textarea style={styles.textarea} placeholder="Descripción" value={formData.detalle} onChange={(e) => setFormData({...formData, detalle: e.target.value})} />
                </div>

                <div style={styles.formActions}>
                  <button style={styles.submitButton} onClick={handleAddTransaction}>💾 Guardar</button>
                  <button style={styles.cancelButton} onClick={() => setShowForm(false)}>❌ Cancelar</button>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'movimientos' && (
          <div style={styles.listContainer}>
            <h2 style={styles.listTitle}>📋 Movimientos ({filteredTransactions.length})</h2>
            
            {filteredTransactions.length === 0 ? (
              <div style={styles.emptyState}>Sin registros</div>
            ) : (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeader}>
                      <th style={styles.th}>Fecha</th>
                      <th style={styles.th}>Empresa</th>
                      <th style={styles.th}>CECO</th>
                      <th style={styles.th}>Detalle</th>
                      <th style={{...styles.th, textAlign: 'right'}}>Valor</th>
                      {user.role === 'admin' && <th style={styles.th}>Acción</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.slice(0, 50).map(t => (
                      <tr key={t.id} style={styles.tableRow}>
                        <td style={styles.td}>{t.fechaPago}</td>
                        <td style={styles.td}><strong>{t.empresa}</strong></td>
                        <td style={styles.td}><small>{t.ceco}</small></td>
                        <td style={{...styles.td, maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis'}}>{t.detalle}</td>
                        <td style={{...styles.td, textAlign: 'right', fontWeight: 'bold', color: '#C4A747'}}>
                          ${t.valor.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                        </td>
                        {user.role === 'admin' && (
                          <td style={styles.td}>
                            <button style={styles.deleteButton} onClick={() => handleDeleteTransaction(t.id)}>🗑️</button>
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

        {activeTab === 'reportes' && user.role === 'contadora' && (
          <div style={styles.reportContainer}>
            <h2 style={styles.reportTitle}>📥 Exportar Reportes</h2>
            
            <button style={styles.exportButton} onClick={() => {
              const headers = ['Fecha', 'Empresa', 'CECO', 'Detalle', 'Tipo Pago', 'Valor', 'Responsable'];
              let csv = headers.join(',') + '\n';
              filteredTransactions.forEach(t => {
                csv += [t.fechaPago, t.empresa, t.ceco, `"${t.detalle}"`, t.tipoPago, t.valor, t.responsable].join(',') + '\n';
              });
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `reportes_${new Date().toISOString().split('T')[0]}.csv`;
              a.click();
            }}>
              📥 Descargar CSV
            </button>

            <div style={styles.reportCard}>
              <h3>📊 Resumen</h3>
              <p>Total gastos: <strong style={{color: '#C4A747'}}>${(totalGastos / 1000000).toFixed(2)}M</strong></p>
              <p>Registros: <strong>{filteredTransactions.length}</strong></p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#0f0f0f', fontFamily: 'system-ui', color: '#fff' },
  header: { backgroundColor: '#1a1a1a', borderBottom: '2px solid #C4A747', position: 'sticky', top: 0, zIndex: 100 },
  headerContent: { maxWidth: '1400px', margin: '0 auto', padding: '1.5rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  appTitle: { fontSize: '1.5rem', fontWeight: '700', margin: 0, color: '#C4A747' },
  userBadge: { fontSize: '0.85rem', color: '#a0a0a0', margin: '0.25rem 0 0 0' },
  logoutButton: { background: 'rgba(196, 167, 71, 0.1)', border: '1px solid #C4A747', borderRadius: '0.5rem', padding: '0.75rem 1.25rem', cursor: 'pointer', color: '#C4A747', fontWeight: '600' },
  nav: { maxWidth: '1400px', margin: '0 auto', padding: '0 1rem', display: 'flex', gap: '2rem', borderTop: '1px solid rgba(196, 167, 71, 0.2)' },
  navButton: { background: 'none', border: 'none', padding: '1rem 0', cursor: 'pointer', borderBottom: '3px solid transparent', color: '#a0a0a0', fontWeight: '500' },
  navButtonActive: { borderBottomColor: '#C4A747', color: '#C4A747' },
  main: { maxWidth: '1400px', margin: '0 auto', padding: '2rem 1rem' },
  filtersSection: { display: 'flex', gap: '2rem', marginBottom: '2rem', backgroundColor: '#1a1a1a', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #2a2a2a' },
  filterGroup: { display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 },
  filterLabel: { fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', textTransform: 'uppercase' },
  filterSelect: { padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '0.375rem', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' },
  kpiCard: { backgroundColor: '#1a1a1a', padding: '1.75rem', borderRadius: '0.5rem', border: '1px solid #2a2a2a', borderLeft: '4px solid #C4A747' },
  kpiLabel: { fontSize: '0.85rem', color: '#a0a0a0', margin: 0, marginBottom: '0.75rem', textTransform: 'uppercase' },
  kpiValue: { fontSize: '2rem', fontWeight: '700', color: '#C4A747', margin: 0 },
  chartsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' },
  chartCard: { backgroundColor: '#1a1a1a', padding: '1.75rem', borderRadius: '0.5rem', border: '1px solid #2a2a2a' },
  chartTitle: { fontSize: '1.1rem', fontWeight: '600', color: '#fff', margin: '0 0 1.5rem 0' },
  chartItem: { display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' },
  chartItemHeader: { display: 'flex', alignItems: 'flex-start', gap: '0.75rem' },
  chartRank: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', backgroundColor: '#C4A747', color: '#0f0f0f', borderRadius: '50%', fontWeight: 'bold', fontSize: '0.85rem', flexShrink: 0 },
  chartBar: { height: '6px', backgroundColor: 'rgba(196, 167, 71, 0.3)', borderRadius: '3px', marginLeft: '2.5rem' },
  addButton: { display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '0.5rem', padding: '0.9rem 1.75rem', fontWeight: '600', cursor: 'pointer', marginBottom: '2rem', fontFamily: 'inherit' },
  formContainer: { backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '0.5rem', border: '1px solid #2a2a2a', marginBottom: '2rem' },
  formTitle: { fontSize: '1.25rem', fontWeight: '600', margin: '0 0 1.75rem 0', color: '#C4A747' },
  formGrid2: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  label: { fontSize: '0.85rem', fontWeight: '600', color: '#C4A747', textTransform: 'uppercase' },
  input: { padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '0.375rem', color: '#fff', fontSize: '0.9rem', fontFamily: 'inherit' },
  textarea: { padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '0.375rem', color: '#fff', fontSize: '0.9rem', minHeight: '100px', fontFamily: 'inherit' },
  formActions: { display: 'flex', gap: '1rem', marginTop: '2rem' },
  submitButton: { flex: 1, padding: '0.9rem 1.5rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '0.375rem', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },
  cancelButton: { flex: 1, padding: '0.9rem 1.5rem', backgroundColor: '#2a2a2a', color: '#a0a0a0', border: '1px solid #3a3a3a', borderRadius: '0.375rem', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },
  listContainer: { backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '0.5rem', border: '1px solid #2a2a2a' },
  listTitle: { fontSize: '1.25rem', fontWeight: '600', margin: '0 0 1.75rem 0', color: '#C4A747' },
  emptyState: { textAlign: 'center', padding: '3rem 1rem', color: '#7a7a7a' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
  tableHeader: { backgroundColor: '#0f0f0f', borderBottom: '2px solid #C4A747' },
  th: { padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '600', color: '#C4A747', fontSize: '0.85rem', textTransform: 'uppercase' },
  tableRow: { borderBottom: '1px solid #2a2a2a' },
  td: { padding: '1rem 0.75rem', color: '#d0d0d0' },
  deleteButton: { background: 'rgba(220, 53, 69, 0.15)', border: '1px solid #dc3545', borderRadius: '0.375rem', padding: '0.5rem 0.75rem', cursor: 'pointer', color: '#ff6b6b', fontFamily: 'inherit' },
  reportContainer: { backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '0.5rem', border: '1px solid #2a2a2a' },
  reportTitle: { fontSize: '1.5rem', fontWeight: '700', margin: '0 0 0.5rem 0', color: '#C4A747' },
  exportButton: { display: 'inline-flex', alignItems: 'center', gap: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '0.5rem', padding: '0.9rem 1.75rem', fontWeight: '600', cursor: 'pointer', marginBottom: '2rem', fontFamily: 'inherit' },
  reportCard: { backgroundColor: '#0f0f0f', padding: '1.75rem', borderRadius: '0.5rem', border: '1px solid #2a2a2a', borderLeft: '4px solid #C4A747' },
  loginContainer: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f0f0f' },
  loginCard: { backgroundColor: '#1a1a1a', padding: '3rem 2rem', borderRadius: '0.5rem', border: '2px solid #C4A747', textAlign: 'center', maxWidth: '500px' },
  loginTitle: { fontSize: '2.25rem', fontWeight: '700', margin: '0 0 0.5rem 0', color: '#C4A747' },
  loginSubtitle: { color: '#a0a0a0', margin: '0 0 2.5rem 0', fontSize: '0.95rem' },
  loginButtons: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  adminButton: { padding: '1.1rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '0.5rem', fontWeight: '600', cursor: 'pointer', fontSize: '1rem', fontFamily: 'inherit' },
  gerenteButton: { padding: '1.1rem', backgroundColor: '#2a2a2a', color: '#C4A747', border: '2px solid #C4A747', borderRadius: '0.5rem', fontWeight: '600', cursor: 'pointer', fontSize: '1rem', fontFamily: 'inherit' },
  contadoraButton: { padding: '1.1rem', backgroundColor: '#2a2a2a', color: '#C4A747', border: '2px solid #C4A747', borderRadius: '0.5rem', fontWeight: '600', cursor: 'pointer', fontSize: '1rem', fontFamily: 'inherit' },
};

export default AMHoldingApp;
