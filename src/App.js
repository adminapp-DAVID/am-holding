/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';

const empresas = ['AM SPORTS GROUP SAS', 'PRO INVESTMENTS GLOBAL SAS', 'PRONOVA CAPITAL SAS', 'FOR SEVEN MEDIA SAS', 'ARKO'];
const tiposSolicitud = ['Anticipo', 'Legalización', 'Reembolso'];
const estadosSolicitud = ['Pendiente', 'Aprobado', 'Pagado', 'Legalizado'];
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
  
  const [responsables] = useState([
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
  ]);
  
  const [solicitudes, setSolicitudes] = useState(() => JSON.parse(localStorage.getItem('amSolicitudes') || '[]'));
  const [usuarios] = useState([{ id: 1, nombre: 'Admin', email: 'admin@amholding.com', password: 'admin123', rol: 'Administrador' }]);
  const [roles] = useState(rolesDefault);
  
  const [newSolicitud, setNewSolicitud] = useState({ 
    fecha: new Date().toISOString().split('T')[0], 
    tipo: '', empresa: '', responsable: '', valor: '', detalle: '', estado: 'Pendiente', 
    archivosLegalizacion: [], notasLegalizacion: '', 
    consignado: { nit: '', nombre: '', cedula: '' }, 
    driveLink: '' 
  });
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [generandoPDF, setGenerandoPDF] = useState(null);

  useEffect(() => localStorage.setItem('amSolicitudes', JSON.stringify(solicitudes)), [solicitudes]);

  const handleLogin = () => {
    const found = usuarios.find(u => u.email === email && u.password === password);
    if (found) { setUser(found); setEmail(''); setPassword(''); setActiveTab('dashboard'); }
    else alert('Incorrecto');
  };

  const puedeEditarEstados = user?.rol === 'Administrador' || user?.rol === 'Revisor';

  const handleAddSolicitud = () => {
    if (!newSolicitud.tipo || !newSolicitud.empresa || !newSolicitud.responsable || !newSolicitud.valor) { alert('Completa'); return; }
    setSolicitudes([...solicitudes, { id: Date.now(), ...newSolicitud, valor: parseFloat(newSolicitud.valor) }]);
    setNewSolicitud({ 
      fecha: new Date().toISOString().split('T')[0], 
      tipo: '', empresa: '', responsable: '', valor: '', detalle: '', estado: 'Pendiente', 
      archivosLegalizacion: [], notasLegalizacion: '', 
      consignado: { nit: '', nombre: '', cedula: '' }, 
      driveLink: '' 
    });
  };

  const handleDeleteSolicitud = (id) => setSolicitudes(solicitudes.filter(s => s.id !== id));
  const handleChangeEstadoSolicitud = (id, nuevoEstado) => setSolicitudes(solicitudes.map(s => s.id === id ? {...s, estado: nuevoEstado} : s));

  const handleAddArchivosLegalizacion = (solicitudId, files) => {
    const nuevosArchivos = Array.from(files).map(f => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            nombre: f.name,
            tipo: f.type,
            size: f.size,
            base64: e.target.result
          });
        };
        reader.readAsDataURL(f);
      });
    });

    Promise.all(nuevosArchivos).then(archivos => {
      setSolicitudes(solicitudes.map(s => s.id === solicitudId ? {...s, archivosLegalizacion: [...(s.archivosLegalizacion || []), ...archivos]} : s));
    });
  };

  const handleGenerarPDFLegalizacion = async (solicitud) => {
    setGenerandoPDF(solicitud.id);
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let yPosition = 15;

      pdf.setFontSize(18);
      pdf.setTextColor(50, 50, 50);
      pdf.text('REPORTE DE LEGALIZACIÓN', pageWidth / 2, yPosition, { align: 'center' });

      yPosition += 12;
      pdf.setLineWidth(0.5);
      pdf.line(15, yPosition, pageWidth - 15, yPosition);
      yPosition += 10;

      pdf.setFontSize(10);
      pdf.setTextColor(60, 60, 60);

      const detalles = [
        ['SOLICITUD', ''],
        ['Fecha:', solicitud.fecha],
        ['Tipo:', solicitud.tipo],
        ['Responsable:', solicitud.responsable],
        ['Empresa:', solicitud.empresa],
        ['Monto:', `$ ${(solicitud.valor || 0).toLocaleString()}`],
        ['Detalle:', solicitud.detalle],
        ['', ''],
        ['CONSIGNATARIO', ''],
        ['Nombre:', solicitud.consignado?.nombre || 'N/A'],
        ['NIT:', solicitud.consignado?.nit || 'N/A'],
        ['Cédula:', solicitud.consignado?.cedula || 'N/A'],
        ['', ''],
        ['NOTAS', ''],
        ['Observaciones:', solicitud.notasLegalizacion || 'Sin notas']
      ];

      detalles.forEach(([label, valor]) => {
        if (label === '' || label === 'SOLICITUD' || label === 'CONSIGNATARIO' || label === 'NOTAS') {
          if (label !== '') {
            pdf.setFont(undefined, 'bold');
            pdf.setFontSize(10);
            pdf.setTextColor(40, 40, 40);
            pdf.text(label, 15, yPosition);
            yPosition += 1;
            pdf.line(15, yPosition, pageWidth - 15, yPosition);
            yPosition += 3;
          } else {
            yPosition += 2;
          }
          pdf.setFontSize(10);
        } else {
          pdf.setFont(undefined, 'bold');
          pdf.setFontSize(9);
          pdf.setTextColor(60, 60, 60);
          pdf.text(label, 15, yPosition);
          pdf.setFont(undefined, 'normal');
          pdf.text(String(valor), 50, yPosition);
          yPosition += 6;
        }
      });

      yPosition += 5;
      pdf.setLineWidth(0.5);
      pdf.line(15, yPosition, pageWidth - 15, yPosition);
      yPosition += 8;

      pdf.setFontSize(11);
      pdf.setFont(undefined, 'bold');
      pdf.setTextColor(40, 40, 40);
      pdf.text('DOCUMENTOS ADJUNTOS:', 15, yPosition);
      yPosition += 8;

      if (solicitud.archivosLegalizacion && solicitud.archivosLegalizacion.length > 0) {
        for (let i = 0; i < solicitud.archivosLegalizacion.length; i++) {
          const archivo = solicitud.archivosLegalizacion[i];
          
          if (archivo.tipo.startsWith('image/')) {
            if (yPosition > pageHeight - 70) {
              pdf.addPage();
              yPosition = 15;
            }

            pdf.setFont(undefined, 'bold');
            pdf.setFontSize(9);
            pdf.setTextColor(60, 60, 60);
            pdf.text(`Imagen ${i + 1}: ${archivo.nombre}`, 15, yPosition);
            yPosition += 3;

            try {
              const imgWidth = pageWidth - 30;
              const imgHeight = 50;
              pdf.addImage(archivo.base64, archivo.tipo.split('/')[1].toUpperCase(), 15, yPosition, imgWidth, imgHeight);
              yPosition += imgHeight + 5;
            } catch (error) {
              pdf.setTextColor(200, 0, 0);
              pdf.text('Error al cargar imagen', 15, yPosition);
              yPosition += 5;
            }
          } else {
            pdf.setFont(undefined, 'normal');
            pdf.setFontSize(8);
            pdf.setTextColor(80, 80, 80);
            pdf.text(`Documento ${i + 1}: ${archivo.nombre} (${(archivo.size / 1024).toFixed(2)} KB)`, 15, yPosition);
            yPosition += 4;
          }
        }
      } else {
        pdf.setFont(undefined, 'italic');
        pdf.setTextColor(150, 150, 150);
        pdf.text('Sin documentos adjuntos', 15, yPosition);
      }

      const nombrePDF = `Legalizacion-${solicitud.id}-${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(nombrePDF);

      const responsableName = solicitud.responsable?.replace(/\s+/g, '-') || 'responsable';
      const mes = solicitud.fecha.slice(0, 7);
      const driveLink = `https://drive.google.com/drive/folders/${GOOGLE_FOLDER_ID}`;
      const carpeta = `Legalizaciones/${responsableName}/${mes}`;

      alert(`✅ PDF Generado: ${nombrePDF}\n\nConsignatario:\n${solicitud.consignado?.nombre}\nNIT: ${solicitud.consignado?.nit}\nCédula: ${solicitud.consignado?.cedula}\n\nCarpeta Drive:\n${carpeta}\n\nArchivos: ${solicitud.archivosLegalizacion?.length || 0}`);

      setSolicitudes(solicitudes.map(s => s.id === solicitud.id ? {...s, estado: 'Legalizado', driveLink: `${driveLink}/${carpeta}`} : s));
    } catch (error) {
      alert('Error al generar PDF: ' + error.message);
    }

    setGenerandoPDF(null);
  };

  const handleDeleteArchivo = (solicitudId, archivoIndex) => {
    setSolicitudes(solicitudes.map(s => s.id === solicitudId ? {...s, archivosLegalizacion: s.archivosLegalizacion.filter((_, i) => i !== archivoIndex)} : s));
  };

  const solicitudesFiltered = solicitudes.filter(s => {
    const matchEmpresa = !filterEmpresa || s.empresa === filterEmpresa;
    return matchEmpresa;
  });

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

      <main style={{ maxWidth: '1400px', margin: '2rem auto', padding: '0 1rem' }}>
        <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', marginBottom: '2rem' }}>
          <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0', fontSize: '1.1rem' }}>➕ Nueva Solicitud</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <input type="date" value={newSolicitud.fecha} onChange={(e) => setNewSolicitud({...newSolicitud, fecha: e.target.value})} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }} />
            <select value={newSolicitud.tipo} onChange={(e) => setNewSolicitud({...newSolicitud, tipo: e.target.value})} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }}><option value="">Tipo</option>{tiposSolicitud.map(t => <option key={t} value={t}>{t}</option>)}</select>
            <select value={newSolicitud.empresa} onChange={(e) => setNewSolicitud({...newSolicitud, empresa: e.target.value, responsable: ''})} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }}><option value="">Empresa</option>{empresas.map(e => <option key={e} value={e}>{e}</option>)}</select>
            <select value={newSolicitud.responsable} onChange={(e) => setNewSolicitud({...newSolicitud, responsable: e.target.value})} disabled={!newSolicitud.empresa} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box', opacity: newSolicitud.empresa ? 1 : 0.5 }}><option value="">Responsable</option>{(newSolicitud.empresa ? responsables.filter(r => r.empresa === newSolicitud.empresa) : []).map(r => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}</select>
            <input type="number" placeholder="Valor" value={newSolicitud.valor} onChange={(e) => setNewSolicitud({...newSolicitud, valor: e.target.value})} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }} />
            <input type="text" placeholder="Detalle" value={newSolicitud.detalle} onChange={(e) => setNewSolicitud({...newSolicitud, detalle: e.target.value})} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }} />
          </div>
          <button onClick={handleAddSolicitud} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Guardar Solicitud</button>
        </div>

        <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', marginBottom: '2rem' }}>
          <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0', fontSize: '1.1rem' }}>📎 Legalizar Documentos</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
            {solicitudes.filter(s => s.tipo === 'Legalización' && s.estado === 'Aprobado').map(s => (
              <div key={s.id} style={{ backgroundColor: '#0f0f0f', padding: '1.5rem', borderRadius: '4px', border: '2px solid #2a2a2a' }}>
                <p style={{ color: '#C4A747', fontWeight: 'bold', margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>{s.responsable}</p>
                <p style={{ color: '#a0a0a0', fontSize: '0.85rem', margin: '0 0 1rem 0' }}>$ {(s.valor || 0).toLocaleString()}</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <input type="text" placeholder="NIT" value={s.consignado?.nit || ''} onChange={(e) => setSolicitudes(solicitudes.map(sol => sol.id === s.id ? {...sol, consignado: {...sol.consignado, nit: e.target.value}} : sol))} style={{ padding: '0.75rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box', fontSize: '0.85rem' }} />
                  <input type="text" placeholder="Cédula" value={s.consignado?.cedula || ''} onChange={(e) => setSolicitudes(solicitudes.map(sol => sol.id === s.id ? {...sol, consignado: {...sol.consignado, cedula: e.target.value}} : sol))} style={{ padding: '0.75rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box', fontSize: '0.85rem' }} />
                </div>

                <input type="text" placeholder="Nombre Consignatario" value={s.consignado?.nombre || ''} onChange={(e) => setSolicitudes(solicitudes.map(sol => sol.id === s.id ? {...sol, consignado: {...sol.consignado, nombre: e.target.value}} : sol))} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }} />

                <label style={{ display: 'block', marginBottom: '1rem', color: '#a0a0a0', fontSize: '0.85rem' }}>
                  📁 Fotos/PDFs
                  <input type="file" multiple accept="image/*,.pdf" onChange={(e) => handleAddArchivosLegalizacion(s.id, e.target.files)} style={{ display: 'block', marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#1a1a1a', border: '1px dashed #2a2a2a', borderRadius: '4px', color: '#fff', width: '100%', boxSizing: 'border-box', cursor: 'pointer' }} />
                </label>

                {s.archivosLegalizacion && s.archivosLegalizacion.length > 0 && (
                  <div style={{ marginBottom: '1rem', maxHeight: '150px', overflowY: 'auto', backgroundColor: '#1a1a1a', padding: '0.75rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
                    <p style={{ color: '#a0a0a0', fontSize: '0.8rem', margin: '0 0 0.5rem 0' }}>✅ {s.archivosLegalizacion.length} archivos</p>
                    {s.archivosLegalizacion.map((arch, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', backgroundColor: '#0f0f0f', borderRadius: '3px', marginBottom: '0.3rem', fontSize: '0.75rem', color: '#a0a0a0' }}>
                        <span>{arch.nombre}</span>
                        <button onClick={() => handleDeleteArchivo(s.id, idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff6b6b', padding: '0' }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                <textarea placeholder="Notas..." value={s.notasLegalizacion || ''} onChange={(e) => setSolicitudes(solicitudes.map(sol => sol.id === s.id ? {...sol, notasLegalizacion: e.target.value} : sol))} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box', minHeight: '70px', fontSize: '0.8rem' }} />

                <button onClick={() => handleGenerarPDFLegalizacion(s)} disabled={generandoPDF === s.id || !s.archivosLegalizacion?.length || !s.consignado?.nombre} style={{ width: '100%', padding: '0.75rem', backgroundColor: generandoPDF === s.id ? '#7a7a7a' : s.archivosLegalizacion?.length && s.consignado?.nombre ? '#748ffc' : '#4a4a4a', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem' }}>
                  {generandoPDF === s.id ? '⏳ Generando...' : s.archivosLegalizacion?.length && s.consignado?.nombre ? '📄 Generar PDF' : '❌ Faltan datos'}
                </button>
              </div>
            ))}
          </div>
          {solicitudes.filter(s => s.tipo === 'Legalización' && s.estado === 'Aprobado').length === 0 && (
            <p style={{ color: '#7a7a7a', textAlign: 'center', padding: '2rem' }}>Sin solicitudes de legalización pendientes</p>
          )}
        </div>

        <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
          <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0', fontSize: '1.1rem' }}>📋 Todas las Solicitudes</h2>
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: '#0f0f0f' }}>
                <tr style={{ borderBottom: '2px solid #C4A747' }}>
                  <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Responsable</th>
                  <th style={{ textAlign: 'right', padding: '0.75rem', color: '#C4A747' }}>Valor</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Consignado a</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>NIT / Cédula</th>
                  <th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>Docs</th>
                  <th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {solicitudesFiltered.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                    <td style={{ padding: '0.75rem', color: '#a0a0a0' }}>{s.responsable?.split(' ')[0]}</td>
                    <td style={{ padding: '0.75rem', color: '#51cf66', textAlign: 'right', fontWeight: 'bold' }}>$ {(s.valor || 0).toLocaleString()}</td>
                    <td style={{ padding: '0.75rem', color: '#a0a0a0', fontSize: '0.8rem' }}>{s.consignado?.nombre || '-'}</td>
                    <td style={{ padding: '0.75rem', color: '#a0a0a0', fontSize: '0.8rem' }}>{s.consignado?.nit ? `${s.consignado.nit} / ${s.consignado.cedula}` : '-'}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center', color: s.archivosLegalizacion?.length > 0 ? '#51cf66' : '#7a7a7a', fontSize: '0.8rem' }}>{s.archivosLegalizacion?.length || 0}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <span style={{ backgroundColor: getColorEstado(s.estado), color: '#0f0f0f', padding: '0.4rem 0.8rem', borderRadius: '3px', fontWeight: 'bold', fontSize: '0.8rem' }}>{s.estado}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
