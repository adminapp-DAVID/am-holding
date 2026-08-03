/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import JSZip from 'jszip';

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
  { id: 999, nombre: 'Admin', email: 'admin@amholding.com', password: 'admin123', rol: 'Administrador' },
  { id: 998, nombre: 'Contadora', email: 'contadora@amholding.com', password: 'pass123', rol: 'Contadora' }
];

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzC5cb8iM93MDOr6fHtgENp0aFoZFi5wY10kh0TVA5noOSEU07kNXLsbSgxa71iTkbK/exec';

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
    consignado: { nit: '', nombre: '', cedula: '' },
    documentos: []
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
    if (!newSolicitud.tipo) { 
      alert('Selecciona un tipo'); 
      return; 
    }

    if (newSolicitud.tipo === 'Anticipo' && !newSolicitud.valor) {
      alert('Ingresa valor solicitado');
      return;
    }
    
    if ((newSolicitud.tipo === 'Legalización' || newSolicitud.tipo === 'Reembolso') && newSolicitud.documentos.length === 0) {
      alert('Agrega al menos un documento');
      return;
    }

    if ((newSolicitud.tipo === 'Legalización' || newSolicitud.tipo === 'Reembolso') && !newSolicitud.consignado?.nombre) {
      alert('Ingresa nombre del consignatario');
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
      consignado: newSolicitud.tipo === 'Anticipo' ? {} : newSolicitud.consignado,
      documentos: newSolicitud.documentos,
      totalCalculado: newSolicitud.documentos.reduce((sum, doc) => sum + (parseFloat(doc.valor) || 0), 0),
      driveLink: ''
    };

    setSolicitudes([...solicitudes, nuevaSolicitud]);
    setNewSolicitud({
      fecha: new Date().toISOString().split('T')[0],
      tipo: '',
      valor: '',
      detalle: '',
      consignado: { nit: '', nombre: '', cedula: '' },
      documentos: []
    });
    alert('✅ Solicitud creada');
  };

  const handleAddDocumento = () => {
    setNewSolicitud({
      ...newSolicitud,
      documentos: [...newSolicitud.documentos, {
        id: Date.now(),
        fecha: '',
        proveedor: '',
        nit: '',
        descripcion: '',
        valor: '',
        archivo: null,
        archivoNombre: ''
      }]
    });
  };

  const handleUpdateDocumento = (docId, campo, valor) => {
    setNewSolicitud({
      ...newSolicitud,
      documentos: newSolicitud.documentos.map(doc => 
        doc.id === docId ? {...doc, [campo]: valor} : doc
      )
    });
  };

  const handleAddArchivoDocumento = (docId, file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setNewSolicitud({
        ...newSolicitud,
        documentos: newSolicitud.documentos.map(doc => 
          doc.id === docId ? {...doc, archivo: e.target.result, archivoNombre: file.name} : doc
        )
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteDocumento = (docId) => {
    setNewSolicitud({
      ...newSolicitud,
      documentos: newSolicitud.documentos.filter(doc => doc.id !== docId)
    });
  };

  const handleDescargarZIP = async (solicitud) => {
    try {
      const zip = new JSZip();
      
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

      const detalles = [
        ['Fecha:', solicitud.fecha],
        ['Responsable:', solicitud.responsableNombre],
        ['Empresa:', solicitud.empresa],
        ['Concepto:', solicitud.detalle || 'N/A']
      ];

      if (solicitud.tipo !== 'Anticipo') {
        detalles.push(
          ['Nombre Consignatario:', solicitud.consignado?.nombre || 'N/A'],
          ['NIT Consignatario:', solicitud.consignado?.nit || 'N/A'],
          ['Cédula Consignatario:', solicitud.consignado?.cedula || 'N/A']
        );
      }

      detalles.forEach(([label, valor]) => {
        pdf.setFont(undefined, 'bold');
        pdf.setFontSize(9);
        pdf.text(label, 15, yPosition);
        pdf.setFont(undefined, 'normal');
        pdf.text(String(valor), 50, yPosition);
        yPosition += 6;
      });

      if (solicitud.documentos && solicitud.documentos.length > 0) {
        pdf.setLineWidth(0.5);
        pdf.line(15, yPosition, pageWidth - 15, yPosition);
        yPosition += 8;

        pdf.setFont(undefined, 'bold');
        pdf.setFontSize(10);
        pdf.text('DOCUMENTOS', 15, yPosition);
        yPosition += 8;

        const colAncho = (pageWidth - 30) / 4;
        pdf.setFontSize(8);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(255, 255, 255);
        pdf.setFillColor(70, 70, 70);

        pdf.rect(15, yPosition - 4, colAncho, 5, 'F');
        pdf.text('Proveedor', 17, yPosition);
        pdf.rect(15 + colAncho, yPosition - 4, colAncho, 5, 'F');
        pdf.text('NIT', 17 + colAncho, yPosition);
        pdf.rect(15 + (colAncho * 2), yPosition - 4, colAncho, 5, 'F');
        pdf.text('Descripción', 17 + (colAncho * 2), yPosition);
        pdf.rect(15 + (colAncho * 3), yPosition - 4, colAncho, 5, 'F');
        pdf.text('Valor', 17 + (colAncho * 3), yPosition);

        yPosition += 6;
        pdf.setTextColor(60, 60, 60);
        pdf.setFont(undefined, 'normal');

        let totalValor = 0;
        solicitud.documentos.forEach(doc => {
          const valor = parseFloat(doc.valor) || 0;
          totalValor += valor;

          pdf.text(doc.proveedor?.slice(0, 15) || '-', 17, yPosition);
          pdf.text(doc.nit?.slice(0, 10) || '-', 17 + colAncho, yPosition);
          pdf.text(doc.descripcion?.slice(0, 15) || '-', 17 + (colAncho * 2), yPosition);
          pdf.text(`$ ${valor.toLocaleString()}`, 17 + (colAncho * 3), yPosition);
          yPosition += 5;
        });

        yPosition += 1;
        pdf.setLineWidth(0.5);
        pdf.line(15, yPosition, pageWidth - 15, yPosition);
        yPosition += 4;

        pdf.setFont(undefined, 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(81, 207, 102);
        pdf.text('TOTAL', 15 + (colAncho * 2), yPosition);
        pdf.text(`$ ${totalValor.toLocaleString()}`, 17 + (colAncho * 3), yPosition);
        
        yPosition += 12;

        const archivosConSoporte = solicitud.documentos.filter(doc => doc.archivoNombre);
        if (archivosConSoporte.length > 0) {
          pdf.setLineWidth(0.5);
          pdf.line(15, yPosition, pageWidth - 15, yPosition);
          yPosition += 8;

          pdf.setFont(undefined, 'bold');
          pdf.setFontSize(10);
          pdf.setTextColor(60, 60, 60);
          pdf.text('ARCHIVOS ADJUNTOS', 15, yPosition);
          yPosition += 8;

          pdf.setFontSize(8);
          pdf.setFont(undefined, 'normal');
          pdf.setTextColor(100, 100, 100);

          archivosConSoporte.forEach((doc, idx) => {
            pdf.text(`${idx + 1}. ${doc.proveedor} - ${doc.archivoNombre}`, 20, yPosition);
            yPosition += 5;
          });
        }
      } else {
        yPosition += 10;
        pdf.setFontSize(9);
        pdf.setTextColor(60, 60, 60);
        pdf.text(`TOTAL SOLICITADO: $ ${(solicitud.valor || 0).toLocaleString()}`, 15, yPosition);
      }

      const pdfContent = pdf.output('arraybuffer');
      const nombrePDF = `${solicitud.tipo}-${solicitud.id}.pdf`;
      zip.file(nombrePDF, pdfContent);

      const archivosConSoporte = solicitud.documentos.filter(doc => doc.archivo && doc.archivoNombre);
      for (let archivo of archivosConSoporte) {
        const base64Data = archivo.archivo.split(',')[1];
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        zip.file(archivo.archivoNombre, bytes);
      }

      const zipContent = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipContent);
      link.download = `${solicitud.tipo}-${solicitud.id}-${new Date().toISOString().slice(0, 10)}.zip`;
      link.click();

      alert(`✅ ZIP descargado: ${archivosConSoporte.length} archivo(s) + PDF`);
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const handleDescargarArchivos = (solicitud) => {
    const archivos = solicitud.documentos.filter(doc => doc.archivo);
    if (archivos.length === 0) {
      alert('Sin archivos');
      return;
    }
    archivos.forEach(doc => {
      const link = document.createElement('a');
      link.href = doc.archivo;
      link.download = doc.archivoNombre;
      link.click();
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

      const detalles = [
        ['Fecha:', solicitud.fecha],
        ['Responsable:', solicitud.responsableNombre],
        ['Empresa:', solicitud.empresa],
        ['Concepto:', solicitud.detalle || 'N/A']
      ];

      if (solicitud.tipo !== 'Anticipo') {
        detalles.push(
          ['Nombre Consignatario:', solicitud.consignado?.nombre || 'N/A'],
          ['NIT Consignatario:', solicitud.consignado?.nit || 'N/A'],
          ['Cédula Consignatario:', solicitud.consignado?.cedula || 'N/A']
        );
      }

      detalles.forEach(([label, valor]) => {
        pdf.setFont(undefined, 'bold');
        pdf.setFontSize(9);
        pdf.text(label, 15, yPosition);
        pdf.setFont(undefined, 'normal');
        pdf.text(String(valor), 50, yPosition);
        yPosition += 6;
      });

      if (solicitud.documentos && solicitud.documentos.length > 0) {
        pdf.setLineWidth(0.5);
        pdf.line(15, yPosition, pageWidth - 15, yPosition);
        yPosition += 8;

        pdf.setFont(undefined, 'bold');
        pdf.setFontSize(10);
        pdf.text('DOCUMENTOS', 15, yPosition);
        yPosition += 8;

        const colAncho = (pageWidth - 30) / 4;
        pdf.setFontSize(8);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(255, 255, 255);
        pdf.setFillColor(70, 70, 70);

        pdf.rect(15, yPosition - 4, colAncho, 5, 'F');
        pdf.text('Proveedor', 17, yPosition);
        pdf.rect(15 + colAncho, yPosition - 4, colAncho, 5, 'F');
        pdf.text('NIT', 17 + colAncho, yPosition);
        pdf.rect(15 + (colAncho * 2), yPosition - 4, colAncho, 5, 'F');
        pdf.text('Descripción', 17 + (colAncho * 2), yPosition);
        pdf.rect(15 + (colAncho * 3), yPosition - 4, colAncho, 5, 'F');
        pdf.text('Valor', 17 + (colAncho * 3), yPosition);

        yPosition += 6;
        pdf.setTextColor(60, 60, 60);
        pdf.setFont(undefined, 'normal');

        let totalValor = 0;
        solicitud.documentos.forEach(doc => {
          const valor = parseFloat(doc.valor) || 0;
          totalValor += valor;

          pdf.text(doc.proveedor?.slice(0, 15) || '-', 17, yPosition);
          pdf.text(doc.nit?.slice(0, 10) || '-', 17 + colAncho, yPosition);
          pdf.text(doc.descripcion?.slice(0, 15) || '-', 17 + (colAncho * 2), yPosition);
          pdf.text(`$ ${valor.toLocaleString()}`, 17 + (colAncho * 3), yPosition);
          yPosition += 5;
        });

        yPosition += 1;
        pdf.setLineWidth(0.5);
        pdf.line(15, yPosition, pageWidth - 15, yPosition);
        yPosition += 4;

        pdf.setFont(undefined, 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(81, 207, 102);
        pdf.text('TOTAL', 15 + (colAncho * 2), yPosition);
        pdf.text(`$ ${totalValor.toLocaleString()}`, 17 + (colAncho * 3), yPosition);
      } else {
        yPosition += 10;
        pdf.setFontSize(9);
        pdf.setTextColor(60, 60, 60);
        pdf.text(`TOTAL SOLICITADO: $ ${(solicitud.valor || 0).toLocaleString()}`, 15, yPosition);
      }

      const nombrePDF = `${solicitud.tipo}-${solicitud.id}-${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(nombrePDF);
      setSolicitudes(solicitudes.map(s => s.id === solicitud.id ? {...s, estado: 'Legalizado'} : s));
    } catch (error) {
      alert('Error: ' + error.message);
    }
    setGenerandoPDF(null);
  };

  const handleDeleteSolicitud = (id) => {
    setSolicitudes(solicitudes.filter(s => s.id !== id));
  };

  const handleChangeEstado = (id, nuevoEstado) => {
    setSolicitudes(solicitudes.map(s => s.id === id ? {...s, estado: nuevoEstado} : s));
  };

  const handleExportarSheets = async () => {
    try {
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(solicitudes)
      });
      const result = await response.json();
      if (result.success) {
        alert(`✅ ${result.rows} solicitudes exportadas a Google Sheets`);
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      alert('Error al exportar: ' + error.message);
    }
  };

  const solicitudesUsuario = user?.rol === 'Responsable' 
    ? solicitudes.filter(s => s.responsableId === user.id)
    : user?.rol === 'Contadora'
    ? solicitudes.filter(s => ['Aprobado', 'Pagado', 'Legalizado'].includes(s.estado))
    : solicitudes;

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
          <button onClick={() => setLoginMode('admin')} style={{ flex: 1, padding: '0.75rem', backgroundColor: loginMode === 'admin' ? '#C4A747' : '#2a2a2a', color: loginMode === 'admin' ? '#0f0f0f' : '#a0a0a0', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Admin/Contadora</button>
        </div>

        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #C4A747', color: '#C4A747', marginBottom: '1rem', boxSizing: 'border-box', borderRadius: '4px' }} />
        <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleLogin()} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #C4A747', color: '#C4A747', marginBottom: '2rem', boxSizing: 'border-box', borderRadius: '4px' }} />
        <button onClick={handleLogin} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '2rem' }}>Entrar</button>

        <p style={{ color: '#7a7a7a', fontSize: '0.8rem', margin: '1rem 0 0.5rem 0' }}>RESPONSABLE:</p>
        <p style={{ color: '#a0a0a0', fontSize: '0.75rem', margin: '0 0 1rem 0' }}>cristian@amholding.com / pass123</p>
        <p style={{ color: '#7a7a7a', fontSize: '0.8rem', margin: '0.5rem 0 0 0' }}>ADMIN:</p>
        <p style={{ color: '#a0a0a0', fontSize: '0.75rem', margin: '0 0 0.5rem 0' }}>admin@amholding.com / admin123</p>
        <p style={{ color: '#7a7a7a', fontSize: '0.8rem', margin: '0.5rem 0 0 0' }}>CONTADORA:</p>
        <p style={{ color: '#a0a0a0', fontSize: '0.75rem', margin: 0 }}>contadora@amholding.com / pass123</p>
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
          <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', marginBottom: '2rem' }}>
            <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0' }}>➕ Nueva Solicitud</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <input type="date" value={newSolicitud.fecha} onChange={(e) => setNewSolicitud({...newSolicitud, fecha: e.target.value})} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }} />
              <select value={newSolicitud.tipo} onChange={(e) => setNewSolicitud({...newSolicitud, tipo: e.target.value, documentos: []})} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }}>
                <option value="">Tipo</option>
                <option value="Anticipo">Anticipo</option>
                <option value="Legalización">Legalización</option>
                <option value="Reembolso">Reembolso</option>
              </select>
              {newSolicitud.tipo === 'Anticipo' && (
                <input type="number" placeholder="Valor Solicitado" value={newSolicitud.valor} onChange={(e) => setNewSolicitud({...newSolicitud, valor: e.target.value})} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }} />
              )}
            </div>

            <input type="text" placeholder="Concepto" value={newSolicitud.detalle} onChange={(e) => setNewSolicitud({...newSolicitud, detalle: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }} />

            {(newSolicitud.tipo === 'Legalización' || newSolicitud.tipo === 'Reembolso') && (
              <>
                <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#0f0f0f', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
                  <p style={{ color: '#C4A747', fontWeight: 'bold', margin: '0 0 1rem 0' }}>Datos del Consignatario</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <input type="text" placeholder="NIT" value={newSolicitud.consignado?.nit || ''} onChange={(e) => setNewSolicitud({...newSolicitud, consignado: {...newSolicitud.consignado, nit: e.target.value}})} style={{ padding: '0.75rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }} />
                    <input type="text" placeholder="Cédula" value={newSolicitud.consignado?.cedula || ''} onChange={(e) => setNewSolicitud({...newSolicitud, consignado: {...newSolicitud.consignado, cedula: e.target.value}})} style={{ padding: '0.75rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }} />
                  </div>
                  <input type="text" placeholder="Nombre Completo" value={newSolicitud.consignado?.nombre || ''} onChange={(e) => setNewSolicitud({...newSolicitud, consignado: {...newSolicitud.consignado, nombre: e.target.value}})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }} />
                </div>

                <div style={{ marginBottom: '1rem', backgroundColor: '#0f0f0f', padding: '1rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ color: '#C4A747', margin: 0, fontSize: '1rem' }}>Documentos con Soportes</h3>
                    <button onClick={handleAddDocumento} style={{ padding: '0.5rem 1rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '3px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>+ Agregar</button>
                  </div>

                  <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: '#1a1a1a' }}>
                        <tr style={{ backgroundColor: '#1a1a1a', borderBottom: '2px solid #C4A747' }}>
                          <th style={{ padding: '0.5rem', textAlign: 'left', color: '#C4A747' }}>Fecha</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left', color: '#C4A747' }}>Proveedor</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left', color: '#C4A747' }}>NIT</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left', color: '#C4A747' }}>Descripción</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right', color: '#C4A747' }}>Valor</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center', color: '#C4A747' }}>Archivo</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center', color: '#C4A747' }}>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {newSolicitud.documentos.length === 0 ? (
                          <tr>
                            <td colSpan="7" style={{ padding: '1rem', textAlign: 'center', color: '#7a7a7a' }}>Sin documentos</td>
                          </tr>
                        ) : (
                          newSolicitud.documentos.map(doc => (
                            <tr key={doc.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                              <td style={{ padding: '0.4rem' }}><input type="date" value={doc.fecha} onChange={(e) => handleUpdateDocumento(doc.id, 'fecha', e.target.value)} style={{ width: '100%', padding: '0.3rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '2px', color: '#fff', boxSizing: 'border-box', fontSize: '0.7rem' }} /></td>
                              <td style={{ padding: '0.4rem' }}><input type="text" value={doc.proveedor} onChange={(e) => handleUpdateDocumento(doc.id, 'proveedor', e.target.value)} placeholder="Proveedor" style={{ width: '100%', padding: '0.3rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '2px', color: '#fff', boxSizing: 'border-box', fontSize: '0.7rem' }} /></td>
                              <td style={{ padding: '0.4rem' }}><input type="text" value={doc.nit} onChange={(e) => handleUpdateDocumento(doc.id, 'nit', e.target.value)} placeholder="NIT" style={{ width: '100%', padding: '0.3rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '2px', color: '#fff', boxSizing: 'border-box', fontSize: '0.7rem' }} /></td>
                              <td style={{ padding: '0.4rem' }}><input type="text" value={doc.descripcion} onChange={(e) => handleUpdateDocumento(doc.id, 'descripcion', e.target.value)} placeholder="Descripción" style={{ width: '100%', padding: '0.3rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '2px', color: '#fff', boxSizing: 'border-box', fontSize: '0.7rem' }} /></td>
                              <td style={{ padding: '0.4rem' }}><input type="number" value={doc.valor} onChange={(e) => handleUpdateDocumento(doc.id, 'valor', e.target.value)} placeholder="Valor" style={{ width: '100%', padding: '0.3rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '2px', color: '#fff', boxSizing: 'border-box', fontSize: '0.7rem' }} /></td>
                              <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                                <label style={{ cursor: 'pointer', color: doc.archivoNombre ? '#51cf66' : '#a0a0a0', fontSize: '0.8rem' }}>
                                  📎
                                  <input type="file" accept="image/*,.pdf" onChange={(e) => handleAddArchivoDocumento(doc.id, e.target.files[0])} style={{ display: 'none' }} />
                                </label>
                                {doc.archivoNombre && <p style={{ margin: '0', fontSize: '0.65rem', color: '#51cf66' }}>{doc.archivoNombre.slice(0, 10)}</p>}
                              </td>
                              <td style={{ padding: '0.4rem', textAlign: 'center' }}><button onClick={() => handleDeleteDocumento(doc.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff6b6b' }}>✕</button></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {newSolicitud.documentos.length > 0 && (
                    <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#0a4a0a', borderRadius: '3px', textAlign: 'right' }}>
                      <p style={{ color: '#51cf66', fontWeight: 'bold', margin: 0 }}>
                        TOTAL: $ {newSolicitud.documentos.reduce((sum, doc) => sum + (parseFloat(doc.valor) || 0), 0).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            <button onClick={handleAddSolicitud} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Guardar Solicitud</button>
          </div>
        )}

        <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ color: '#C4A747', margin: 0 }}>
              📋 {user.rol === 'Responsable' ? 'Mis Solicitudes' : user.rol === 'Contadora' ? 'Solicitudes Auditadas' : 'Todas las Solicitudes'}
            </h2>
            {user.rol === 'Administrador' && (
              <button onClick={handleExportarSheets} style={{ backgroundColor: '#51cf66', color: '#0f0f0f', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem' }}>
                📊 Exportar a Sheets
              </button>
            )}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead style={{ backgroundColor: '#0f0f0f' }}>
                <tr style={{ borderBottom: '2px solid #C4A747' }}>
                  <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Fecha</th>
                  {(user.rol === 'Administrador' || user.rol === 'Contadora') && <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Responsable</th>}
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
                    {(user.rol === 'Administrador' || user.rol === 'Contadora') && <td style={{ padding: '0.75rem', color: '#a0a0a0', fontSize: '0.8rem' }}>{s.responsableNombre}</td>}
                    <td style={{ padding: '0.75rem', color: '#C4A747', fontWeight: 'bold' }}>{s.tipo}</td>
                    <td style={{ padding: '0.75rem', color: '#51cf66', textAlign: 'right', fontWeight: 'bold' }}>$ {(s.tipo === 'Anticipo' ? s.valor : s.totalCalculado || 0).toLocaleString()}</td>
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
                      {(s.tipo === 'Legalización' || s.tipo === 'Reembolso') && s.documentos?.length > 0 && (
                        <>
                          {user.rol === 'Administrador' && (
                            <button onClick={() => handleGenerarPDF(s)} disabled={generandoPDF === s.id} style={{ background: 'none', border: 'none', cursor: 'pointer', color: generandoPDF === s.id ? '#7a7a7a' : '#748ffc', fontSize: '1rem', marginRight: '0.5rem' }} title="PDF">
                              {generandoPDF === s.id ? '⏳' : '📄'}
                            </button>
                          )}
                          {(user.rol === 'Administrador' || user.rol === 'Contadora') && (
                            <>
                              <button onClick={() => handleDescargarZIP(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#51cf66', fontSize: '1rem', marginRight: '0.5rem' }} title="ZIP">
                                📦
                              </button>
                              <button onClick={() => handleDescargarArchivos(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#51cf66', fontSize: '1rem' }} title="Archivos">
                                ⬇️
                              </button>
                            </>
                          )}
                        </>
                      )}
                      {user.rol === 'Responsable' && (
                        <button onClick={() => handleDeleteSolicitud(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff6b6b', fontSize: '1rem' }}>✕</button>
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
