/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';

const empresas = ['AM SPORTS GROUP SAS', 'PRO INVESTMENTS GLOBAL SAS', 'PRONOVA CAPITAL SAS', 'FOR SEVEN MEDIA SAS', 'ARKO'];
const tiposSolicitud = ['Anticipo', 'Legalización', 'Reembolso'];
const estadosSolicitud = ['Pendiente', 'Aprobado', 'Pagado', 'Legalizado'];

const responsablesData = [
  { id: 1, nombre: 'Cristian Alejandro Giraldo Carvajal', empresa: 'AM SPORTS GROUP SAS', email: 'cristian@amholding.com', password: 'pass123' },
  { id: 2, nombre: 'David Dario Andrade Hernández', empresa: 'AM SPORTS GROUP SAS', email: 'david@amholding.com', password: 'pass123' },
  { id: 3, nombre: 'José David Martínez', empresa: 'AM SPORTS GROUP SAS', email: 'jose@amholding.com', password: 'pass123' },
  { id: 4, nombre: 'Luis Rodrigo Rivas Arboleda', empresa: 'AM SPORTS GROUP SAS', email: 'luis@amholding.com', password: 'pass123' },
  { id: 5, nombre: 'Cristian Camilo Tabares Arango', empresa: 'AM SPORTS GROUP SAS', email: 'tabares@amholding.com', password: 'pass123' },
  { id: 13, nombre: 'Sergio Alejandro Mejía Valencia', empresa: 'PRO INVESTMENTS GLOBAL SAS', email: 'sergio@amholding.com', password: 'pass123' },
  { id: 14, nombre: 'Caren Paola Garzón Márquez', empresa: 'PRO INVESTMENTS GLOBAL SAS', email: 'caren@amholding.com', password: 'pass123' },
  { id: 17, nombre: 'Andrei Martinez Orjuela', empresa: 'PRONOVA CAPITAL SAS', email: 'andrei@amholding.com', password: 'pass123' },
  { id: 18, nombre: 'Daniel Santiago Tarquino', empresa: 'FOR SEVEN MEDIA SAS', email: 'daniel@amholding.com', password: 'pass123' },
  { id: 22, nombre: 'Nestor Ovidio', empresa: 'ARKO', email: 'nestor@amholding.com', password: 'pass123' },
];

const usuariosAdmin = [
  { id: 999, nombre: 'Admin', email: 'admin@amholding.com', password: 'admin123', rol: 'Administrador' }
];

const GOOGLE_FOLDER_ID = process.env.REACT_APP_GOOGLE_FOLDER_ID;

export default function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginMode, setLoginMode] = useState('responsable');
  
  const [solicitudes, setSolicitudes] = useState(() => JSON.parse(localStorage.getItem('amSolicitudes') || '[]'));
  const [generandoPDF, setGenerandoPDF] = useState(null);
  
  const [newSolicitud, setNewSolicitud] = useState({
    fecha: new Date().toISOString().split('T')[0],
    tipo: '',
    valor: '',
    detalle: '',
    archivos: [],
    consignado: { nit: '', nombre: '', cedula: '' },
    documentos: [] // Tabla de documentos
  });

  useEffect(() => localStorage.setItem('amSolicitudes', JSON.stringify(solicitudes)), [solicitudes]);

  const handleLogin = () => {
    if (loginMode === 'responsable') {
      const found = responsablesData.find(u => u.email === email && u.password === password);
      if (found) {
        setUser({ ...found, rol: 'Responsable' });
        setEmail('');
        setPassword('');
      } else {
        alert('Email o contraseña incorrecto');
      }
    } else {
      const found = usuariosAdmin.find(u => u.email === email && u.password === password);
      if (found) {
        setUser(found);
        setEmail('');
        setPassword('');
      } else {
        alert('Email o contraseña incorrecto');
      }
    }
  };

  const handleAddSolicitud = () => {
    if (!newSolicitud.tipo || !newSolicitud.valor) { 
      alert('Completa tipo y valor total'); 
      return; 
    }
    
    if ((newSolicitud.tipo === 'Legalización' || newSolicitud.tipo === 'Reembolso') && newSolicitud.documentos.length === 0) {
      alert('Agrega al menos un documento en la tabla');
      return;
    }

    if ((newSolicitud.tipo === 'Legalización' || newSolicitud.tipo === 'Reembolso') && !newSolicitud.consignado?.nombre) {
      alert('Ingresa datos del consignatario');
      return;
    }

    const nuevaSolicitud = {
      id: Date.now(),
      fecha: newSolicitud.fecha,
      tipo: newSolicitud.tipo,
      responsableId: user.id,
      responsableNombre: user.nombre,
      empresa: user.empresa,
      valor: parseFloat(newSolicitud.valor),
      detalle: newSolicitud.detalle,
      estado: 'Pendiente',
      archivos: newSolicitud.archivos,
      consignado: newSolicitud.consignado,
      documentos: newSolicitud.documentos,
      driveLink: ''
    };

    setSolicitudes([...solicitudes, nuevaSolicitud]);
    setNewSolicitud({
      fecha: new Date().toISOString().split('T')[0],
      tipo: '',
      valor: '',
      detalle: '',
      archivos: [],
      consignado: { nit: '', nombre: '', cedula: '' },
      documentos: []
    });
    alert('✅ Solicitud creada');
  };

  const handleAddArchivos = (files) => {
    const nuevosArchivos = Array.from(files).map(f => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            nombre: f.name,
            tipo: f.type,
            size: f.size
          });
        };
        reader.readAsDataURL(f);
      });
    });

    Promise.all(nuevosArchivos).then(archivos => {
      setNewSolicitud({...newSolicitud, archivos: [...newSolicitud.archivos, ...archivos]});
    });
  };

  const handleAddDocumento = () => {
    const nuevoDocumento = {
      id: Date.now(),
      fecha: '',
      proveedor: '',
      nit: '',
      descripcion: '',
      valor: ''
    };
    setNewSolicitud({...newSolicitud, documentos: [...newSolicitud.documentos, nuevoDocumento]});
  };

  const handleUpdateDocumento = (docId, campo, valor) => {
    setNewSolicitud({
      ...newSolicitud,
      documentos: newSolicitud.documentos.map(doc => 
        doc.id === docId ? {...doc, [campo]: valor} : doc
      )
    });
  };

  const handleDeleteDocumento = (docId) => {
    setNewSolicitud({
      ...newSolicitud,
      documentos: newSolicitud.documentos.filter(doc => doc.id !== docId)
    });
  };

  const handleGenerarPDF = async (solicitud) => {
    setGenerandoPDF(solicitud.id);

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      let yPosition = 15;

      pdf.setFontSize(18);
      pdf.setTextColor(50, 50, 50);
      const titulo = solicitud.tipo === 'Legalización' ? 'LEGALIZACIÓN DE ANTICIPO' : 'REPORTE DE REEMBOLSO';
      pdf.text(titulo, pageWidth / 2, yPosition, { align: 'center' });

      yPosition += 12;
      pdf.setLineWidth(0.5);
      pdf.line(15, yPosition, pageWidth - 15, yPosition);
      yPosition += 10;

      pdf.setFontSize(10);
      pdf.setTextColor(60, 60, 60);

      // Datos principales
      const detalles = [
        ['Fecha:', solicitud.fecha],
        ['Responsable:', solicitud.responsableNombre],
        ['Empresa:', solicitud.empresa],
        ['Concepto:', solicitud.detalle || 'N/A'],
        ['', '']
      ];

      detalles.forEach(([label, valor]) => {
        if (label === '') {
          yPosition += 2;
        } else {
          pdf.setFont(undefined, 'bold');
          pdf.setFontSize(9);
          pdf.text(label, 15, yPosition);
          pdf.setFont(undefined, 'normal');
          pdf.text(String(valor), 50, yPosition);
          yPosition += 6;
        }
      });

      // Sección Consignatario
      yPosition += 3;
      pdf.setFont(undefined, 'bold');
      pdf.setFontSize(10);
      pdf.text('CONSIGNATARIO', 15, yPosition);
      yPosition += 1;
      pdf.line(15, yPosition, pageWidth - 15, yPosition);
      yPosition += 6;

      pdf.setFontSize(9);
      pdf.setFont(undefined, 'bold');
      pdf.text('Nombre:', 15, yPosition);
      pdf.setFont(undefined, 'normal');
      pdf.text(solicitud.consignado?.nombre || 'N/A', 50, yPosition);
      yPosition += 6;

      pdf.setFont(undefined, 'bold');
      pdf.text('NIT:', 15, yPosition);
      pdf.setFont(undefined, 'normal');
      pdf.text(solicitud.consignado?.nit || 'N/A', 50, yPosition);
      yPosition += 6;

      pdf.setFont(undefined, 'bold');
      pdf.text('Cédula:', 15, yPosition);
      pdf.setFont(undefined, 'normal');
      pdf.text(solicitud.consignado?.cedula || 'N/A', 50, yPosition);
      yPosition += 6;

      pdf.setFont(undefined, 'bold');
      pdf.text('Valor Total:', 15, yPosition);
      pdf.setFont(undefined, 'normal');
      pdf.text(`$ ${(solicitud.valor || 0).toLocaleString()}`, 50, yPosition);
      yPosition += 8;

      // Tabla de documentos y consignatario
      pdf.setFont(undefined, 'bold');
      pdf.setFontSize(10);
      pdf.text('DOCUMENTOS Y CONSIGNATARIO', 15, yPosition);
      yPosition += 8;

      // Headers tabla
      const colAncho = (pageWidth - 30) / 5;
      pdf.setFontSize(7);
      pdf.setFont(undefined, 'bold');
      pdf.setTextColor(255, 255, 255);
      pdf.setFillColor(70, 70, 70);

      const headers = ['Tipo', 'Nombre/Proveedor', 'NIT', 'Descripción', 'Valor'];
      headers.forEach((header, i) => {
        pdf.rect(15 + (i * colAncho), yPosition - 4, colAncho, 5, 'F');
        pdf.text(header, 17 + (i * colAncho), yPosition);
      });

      yPosition += 6;
      pdf.setTextColor(60, 60, 60);
      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(7);

      // Fila Consignatario
      pdf.setFillColor(10, 74, 10);
      pdf.rect(15, yPosition - 4, colAncho, 5, 'F');
      pdf.setTextColor(81, 207, 102);
      pdf.setFont(undefined, 'bold');
      pdf.text('CONSIG.', 17, yPosition);
      pdf.setTextColor(60, 60, 60);
      pdf.setFont(undefined, 'normal');
      pdf.text(solicitud.consignado?.nombre?.slice(0, 12) || 'N/A', 17 + colAncho, yPosition);
      pdf.text(solicitud.consignado?.nit || '-', 17 + (colAncho * 2), yPosition);
      pdf.text(solicitud.detalle?.slice(0, 15) || 'N/A', 17 + (colAncho * 3), yPosition);
      pdf.text(`$ ${(solicitud.valor || 0).toLocaleString()}`, 17 + (colAncho * 4), yPosition);
      yPosition += 5;

      // Filas Documentos
      solicitud.documentos.forEach(doc => {
        pdf.setFillColor(26, 26, 26);
        pdf.rect(15, yPosition - 4, colAncho, 5, 'F');
        pdf.setTextColor(196, 167, 71);
        pdf.setFont(undefined, 'bold');
        pdf.text('DOC', 17, yPosition);
        pdf.setTextColor(60, 60, 60);
        pdf.setFont(undefined, 'normal');
        pdf.text(doc.proveedor?.slice(0, 12) || '-', 17 + colAncho, yPosition);
        pdf.text(doc.nit?.slice(0, 10) || '-', 17 + (colAncho * 2), yPosition);
        pdf.text(doc.descripcion?.slice(0, 15) || '-', 17 + (colAncho * 3), yPosition);
        pdf.text(`$ ${(parseFloat(doc.valor) || 0).toLocaleString()}`, 17 + (colAncho * 4), yPosition);
        yPosition += 5;
      });

      // Total
      yPosition += 1;
      pdf.setLineWidth(0.5);
      pdf.line(15, yPosition, pageWidth - 15, yPosition);
      yPosition += 4;

      let totalDocumentos = solicitud.documentos.reduce((sum, doc) => sum + (parseFloat(doc.valor) || 0), 0);
      
      pdf.setFont(undefined, 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(81, 207, 102);
      pdf.text('TOTAL SOLICITUD', 15 + (colAncho * 3), yPosition);
      pdf.text(`$ ${(solicitud.valor || 0).toLocaleString()}`, 17 + (colAncho * 4), yPosition);

      const nombrePDF = `${solicitud.tipo}-${solicitud.id}-${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(nombrePDF);

      const carpetaTipo = solicitud.tipo === 'Legalización' ? 'Legalizaciones' : 'Reembolsos';
      const responsableName = solicitud.responsableNombre?.replace(/\s+/g, '-') || 'responsable';
      const mes = solicitud.fecha.slice(0, 7);
      const driveLink = `https://drive.google.com/drive/folders/${GOOGLE_FOLDER_ID}`;
      const carpeta = `Finanzas Operativas AM Holding/${solicitud.empresa}/${carpetaTipo}/${responsableName}/${mes}`;

      alert(`✅ PDF Generado: ${nombrePDF}\n\nCarpeta Drive recomendada:\n${carpeta}\n\nDocumentos: ${solicitud.documentos.length}\nTotal: $ ${totalValor.toLocaleString()}`);

      setSolicitudes(solicitudes.map(s => s.id === solicitud.id ? {...s, estado: 'Legalizado', driveLink: `${driveLink}/${carpeta}`} : s));
    } catch (error) {
      alert('Error: ' + error.message);
    }

    setGenerandoPDF(null);
  };

  const handleDeleteArchivo = (index) => {
    setNewSolicitud({...newSolicitud, archivos: newSolicitud.archivos.filter((_, i) => i !== index)});
  };

  const handleDeleteSolicitud = (id) => {
    setSolicitudes(solicitudes.filter(s => s.id !== id));
  };

  const handleChangeEstado = (id, nuevoEstado) => {
    setSolicitudes(solicitudes.map(s => s.id === id ? {...s, estado: nuevoEstado} : s));
  };

  const solicitudesUsuario = user?.rol === 'Responsable' ? solicitudes.filter(s => s.responsableId === user.id) : solicitudes;

  const getColorEstado = (estado) => {
    if (estado === 'Pendiente') return '#ff6b6b';
    if (estado === 'Aprobado') return '#ffd43b';
    if (estado === 'Pagado') return '#51cf66';
    if (estado === 'Legalizado') return '#748ffc';
    return '#a0a0a0';
  };

  if (!user) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ backgroundColor: '#1a1a1a', border: '2px solid #C4A747', borderRadius: '8px', padding: '3rem 2rem', textAlign: 'center', maxWidth: '500px', width: '100%' }}>
        <h1 style={{ color: '#C4A747', fontSize: '2.5rem', margin: 0 }}>AM HOLDING</h1>
        <p style={{ color: '#a0a0a0', margin: '1rem 0 2rem 0' }}>Gestión de Solicitudes</p>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <button onClick={() => setLoginMode('responsable')} style={{ flex: 1, padding: '0.75rem', backgroundColor: loginMode === 'responsable' ? '#C4A747' : '#2a2a2a', color: loginMode === 'responsable' ? '#0f0f0f' : '#a0a0a0', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Responsable</button>
          <button onClick={() => setLoginMode('admin')} style={{ flex: 1, padding: '0.75rem', backgroundColor: loginMode === 'admin' ? '#C4A747' : '#2a2a2a', color: loginMode === 'admin' ? '#0f0f0f' : '#a0a0a0', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Administrador</button>
        </div>

        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #C4A747', color: '#C4A747', marginBottom: '1rem', boxSizing: 'border-box', borderRadius: '4px' }} />
        <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleLogin()} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #C4A747', color: '#C4A747', marginBottom: '2rem', boxSizing: 'border-box', borderRadius: '4px' }} />
        <button onClick={handleLogin} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '2rem' }}>Entrar</button>

        <p style={{ color: '#7a7a7a', fontSize: '0.8rem', margin: '1rem 0 0.5rem 0' }}>DEMO RESPONSABLE:</p>
        <p style={{ color: '#a0a0a0', fontSize: '0.75rem', margin: '0 0 1rem 0' }}>cristian@amholding.com / pass123</p>
        <p style={{ color: '#7a7a7a', fontSize: '0.8rem', margin: '0.5rem 0 0 0' }}>ADMIN:</p>
        <p style={{ color: '#a0a0a0', fontSize: '0.75rem', margin: 0 }}>admin@amholding.com / admin123</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', color: '#fff' }}>
      <header style={{ backgroundColor: '#1a1a1a', borderBottom: '2px solid #C4A747', padding: '1.5rem' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><h1 style={{ color: '#C4A747', margin: 0 }}>AM HOLDING</h1><p style={{ fontSize: '0.85rem', color: '#a0a0a0', margin: '0.5rem 0 0 0' }}>{user.nombre} ({user.rol})</p></div>
          <button onClick={() => setUser(null)} style={{ backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Salir</button>
        </div>
      </header>

      <main style={{ maxWidth: '1400px', margin: '2rem auto', padding: '0 1rem' }}>
        {user.rol === 'Responsable' && (
          <div>
            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', marginBottom: '2rem' }}>
              <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0' }}>➕ Nueva Solicitud</h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <input type="date" value={newSolicitud.fecha} onChange={(e) => setNewSolicitud({...newSolicitud, fecha: e.target.value})} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }} />
                <select value={newSolicitud.tipo} onChange={(e) => setNewSolicitud({...newSolicitud, tipo: e.target.value})} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }}>
                  <option value="">Tipo de Solicitud</option>
                  <option value="Anticipo">Anticipo</option>
                  <option value="Legalización">Legalización de Anticipo</option>
                  <option value="Reembolso">Reembolso</option>
                </select>
                <input type="number" placeholder="Valor Total" value={newSolicitud.valor} onChange={(e) => setNewSolicitud({...newSolicitud, valor: e.target.value})} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }} />
              </div>

              <input type="text" placeholder="Concepto" value={newSolicitud.detalle} onChange={(e) => setNewSolicitud({...newSolicitud, detalle: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }} />

                  <label style={{ display: 'block', marginBottom: '1rem', color: '#a0a0a0' }}>
                    📁 Fotos/PDFs (Referencia)
                    <input type="file" multiple accept="image/*,.pdf" onChange={(e) => handleAddArchivos(e.target.files)} style={{ display: 'block', marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px dashed #2a2a2a', borderRadius: '4px', color: '#fff', width: '100%', boxSizing: 'border-box', cursor: 'pointer' }} />
                  </label>

                  {newSolicitud.archivos.length > 0 && (
                    <div style={{ marginBottom: '1rem', maxHeight: '120px', overflowY: 'auto', backgroundColor: '#0f0f0f', padding: '0.75rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
                      <p style={{ color: '#a0a0a0', fontSize: '0.8rem', margin: '0 0 0.5rem 0' }}>✅ {newSolicitud.archivos.length} archivos</p>
                      {newSolicitud.archivos.map((arch, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem', backgroundColor: '#1a1a1a', borderRadius: '3px', marginBottom: '0.3rem', fontSize: '0.75rem', color: '#a0a0a0' }}>
                          <span>{arch.nombre}</span>
                          <button onClick={() => handleDeleteArchivo(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff6b6b' }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ marginBottom: '1rem', backgroundColor: '#0f0f0f', padding: '1rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ color: '#C4A747', margin: 0, fontSize: '1rem' }}>Documentos y Consignatario</h3>
                      <button onClick={handleAddDocumento} style={{ padding: '0.5rem 1rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '3px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>+ Agregar Doc</button>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#1a1a1a', borderBottom: '2px solid #C4A747' }}>
                            <th style={{ padding: '0.5rem', textAlign: 'left', color: '#C4A747' }}>Tipo</th>
                            <th style={{ padding: '0.5rem', textAlign: 'left', color: '#C4A747' }}>Nombre/Proveedor</th>
                            <th style={{ padding: '0.5rem', textAlign: 'left', color: '#C4A747' }}>NIT</th>
                            <th style={{ padding: '0.5rem', textAlign: 'left', color: '#C4A747' }}>Cédula</th>
                            <th style={{ padding: '0.5rem', textAlign: 'left', color: '#C4A747' }}>Descripción</th>
                            <th style={{ padding: '0.5rem', textAlign: 'right', color: '#C4A747' }}>Valor</th>
                            <th style={{ padding: '0.5rem', textAlign: 'center', color: '#C4A747' }}>Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Fila Consignatario */}
                          <tr style={{ backgroundColor: '#0a4a0a', borderBottom: '1px solid #2a2a2a' }}>
                            <td style={{ padding: '0.4rem', color: '#51cf66', fontWeight: 'bold' }}>CONSIGNATARIO</td>
                            <td style={{ padding: '0.4rem' }}><input type="text" value={newSolicitud.consignado?.nombre || ''} onChange={(e) => setNewSolicitud({...newSolicitud, consignado: {...newSolicitud.consignado, nombre: e.target.value}})} placeholder="Nombre" style={{ width: '100%', padding: '0.3rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '2px', color: '#fff', boxSizing: 'border-box', fontSize: '0.7rem' }} /></td>
                            <td style={{ padding: '0.4rem' }}><input type="text" value={newSolicitud.consignado?.nit || ''} onChange={(e) => setNewSolicitud({...newSolicitud, consignado: {...newSolicitud.consignado, nit: e.target.value}})} placeholder="NIT" style={{ width: '100%', padding: '0.3rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '2px', color: '#fff', boxSizing: 'border-box', fontSize: '0.7rem' }} /></td>
                            <td style={{ padding: '0.4rem' }}><input type="text" value={newSolicitud.consignado?.cedula || ''} onChange={(e) => setNewSolicitud({...newSolicitud, consignado: {...newSolicitud.consignado, cedula: e.target.value}})} placeholder="Cédula" style={{ width: '100%', padding: '0.3rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '2px', color: '#fff', boxSizing: 'border-box', fontSize: '0.7rem' }} /></td>
                            <td style={{ padding: '0.4rem' }}><input type="text" placeholder="Concepto" value={newSolicitud.detalle} onChange={(e) => setNewSolicitud({...newSolicitud, detalle: e.target.value})} style={{ width: '100%', padding: '0.3rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '2px', color: '#fff', boxSizing: 'border-box', fontSize: '0.7rem' }} /></td>
                            <td style={{ padding: '0.4rem', textAlign: 'right' }}><input type="number" placeholder="Total" value={newSolicitud.valor} onChange={(e) => setNewSolicitud({...newSolicitud, valor: e.target.value})} style={{ width: '100%', padding: '0.3rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '2px', color: '#fff', boxSizing: 'border-box', fontSize: '0.7rem' }} /></td>
                            <td style={{ padding: '0.4rem', textAlign: 'center' }}>-</td>
                          </tr>

                          {/* Filas Documentos */}
                          {newSolicitud.documentos.length === 0 ? (
                            <tr>
                              <td colSpan="7" style={{ padding: '1rem', textAlign: 'center', color: '#7a7a7a', fontSize: '0.85rem' }}>Sin documentos. Haz click en "+ Agregar Doc"</td>
                            </tr>
                          ) : (
                            newSolicitud.documentos.map(doc => (
                              <tr key={doc.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                                <td style={{ padding: '0.4rem', color: '#C4A747', fontWeight: 'bold' }}>DOCUMENTO</td>
                                <td style={{ padding: '0.4rem' }}><input type="text" value={doc.proveedor} onChange={(e) => handleUpdateDocumento(doc.id, 'proveedor', e.target.value)} placeholder="Proveedor" style={{ width: '100%', padding: '0.3rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '2px', color: '#fff', boxSizing: 'border-box', fontSize: '0.7rem' }} /></td>
                                <td style={{ padding: '0.4rem' }}><input type="text" value={doc.nit} onChange={(e) => handleUpdateDocumento(doc.id, 'nit', e.target.value)} placeholder="NIT" style={{ width: '100%', padding: '0.3rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '2px', color: '#fff', boxSizing: 'border-box', fontSize: '0.7rem' }} /></td>
                                <td style={{ padding: '0.4rem' }}>-</td>
                                <td style={{ padding: '0.4rem' }}><input type="text" value={doc.descripcion} onChange={(e) => handleUpdateDocumento(doc.id, 'descripcion', e.target.value)} placeholder="Descripción" style={{ width: '100%', padding: '0.3rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '2px', color: '#fff', boxSizing: 'border-box', fontSize: '0.7rem' }} /></td>
                                <td style={{ padding: '0.4rem' }}><input type="number" value={doc.valor} onChange={(e) => handleUpdateDocumento(doc.id, 'valor', e.target.value)} placeholder="Valor" style={{ width: '100%', padding: '0.3rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '2px', color: '#fff', boxSizing: 'border-box', fontSize: '0.7rem' }} /></td>
                                <td style={{ padding: '0.4rem', textAlign: 'center' }}><button onClick={() => handleDeleteDocumento(doc.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff6b6b' }}>✕</button></td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              <button onClick={handleAddSolicitud} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Guardar Solicitud</button>
            </div>
          </div>
        )}

        <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
          <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0' }}>📋 {user.rol === 'Responsable' ? 'Mis Solicitudes' : 'Todas las Solicitudes'}</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead style={{ backgroundColor: '#0f0f0f' }}>
                <tr style={{ borderBottom: '2px solid #C4A747' }}>
                  <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Fecha</th>
                  {user.rol === 'Administrador' && <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Responsable</th>}
                  <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Tipo</th>
                  <th style={{ textAlign: 'right', padding: '0.75rem', color: '#C4A747' }}>Valor</th>
                  <th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>Docs</th>
                  <th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>Estado</th>
                  <th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {solicitudesUsuario.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                    <td style={{ padding: '0.75rem', color: '#a0a0a0', fontSize: '0.8rem' }}>{s.fecha}</td>
                    {user.rol === 'Administrador' && <td style={{ padding: '0.75rem', color: '#a0a0a0', fontSize: '0.8rem' }}>{s.responsableNombre}</td>}
                    <td style={{ padding: '0.75rem', color: '#C4A747', fontWeight: 'bold' }}>{s.tipo}</td>
                    <td style={{ padding: '0.75rem', color: '#51cf66', textAlign: 'right', fontWeight: 'bold' }}>$ {(s.valor || 0).toLocaleString()}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center', color: s.documentos?.length > 0 ? '#51cf66' : '#7a7a7a' }}>{s.documentos?.length || 0}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      {user.rol === 'Administrador' ? (
                        <select value={s.estado} onChange={(e) => handleChangeEstado(s.id, e.target.value)} style={{ backgroundColor: getColorEstado(s.estado), color: '#0f0f0f', border: 'none', padding: '0.4rem 0.6rem', borderRadius: '3px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>
                          {estadosSolicitud.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                      ) : (
                        <span style={{ backgroundColor: getColorEstado(s.estado), color: '#0f0f0f', padding: '0.4rem 0.8rem', borderRadius: '3px', fontWeight: 'bold', fontSize: '0.8rem' }}>{s.estado}</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      {(s.tipo === 'Legalización' || s.tipo === 'Reembolso') && s.documentos?.length > 0 ? (
                        <button onClick={() => handleGenerarPDF(s)} disabled={generandoPDF === s.id} style={{ background: 'none', border: 'none', cursor: 'pointer', color: generandoPDF === s.id ? '#7a7a7a' : '#748ffc', fontSize: '1.2rem' }}>
                          {generandoPDF === s.id ? '⏳' : '📄'}
                        </button>
                      ) : null}
                      {user.rol === 'Responsable' && (
                        <button onClick={() => handleDeleteSolicitud(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff6b6b', fontSize: '1rem', marginLeft: '0.5rem' }}>✕</button>
                      )}
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
