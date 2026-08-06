/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import JSZip from 'jszip';

const App = () => {
  // Data - DEBE ir primero
  const responsablesData = [
    { id: 1, nombre: 'Cristian Alejandro Giraldo Carvajal', email: 'cristian@amholding.com', password: 'pass123', empresa: 'AM SPORTS GROUP SAS' },
    { id: 2, nombre: 'David Dario Andrade Hernández', email: 'david@amholding.com', password: 'pass123', empresa: 'AM SPORTS GROUP SAS' },
    { id: 3, nombre: 'José David Martínez', email: 'jose@amholding.com', password: 'pass123', empresa: 'AM SPORTS GROUP SAS' },
    { id: 4, nombre: 'Luis Rodrigo Rivas Arboleda', email: 'luis@amholding.com', password: 'pass123', empresa: 'AM SPORTS GROUP SAS' },
    { id: 5, nombre: 'Cristian Camilo Tabares Arango', email: 'tabares@amholding.com', password: 'pass123', empresa: 'AM SPORTS GROUP SAS' },
    { id: 6, nombre: 'Sergio Alejandro Mejía Valencia', email: 'sergio@amholding.com', password: 'pass123', empresa: 'PRO INVESTMENTS GLOBAL SAS' },
    { id: 7, nombre: 'Caren Paola Garzón Márquez', email: 'caren@amholding.com', password: 'pass123', empresa: 'PRO INVESTMENTS GLOBAL SAS' },
    { id: 8, nombre: 'Andrei Martinez Orjuela', email: 'andrei@amholding.com', password: 'pass123', empresa: 'PRONOVA CAPITAL SAS' },
    { id: 9, nombre: 'Daniel Santiago Tarquino', email: 'daniel@amholding.com', password: 'pass123', empresa: 'FOR SEVEN MEDIA SAS' },
    { id: 10, nombre: 'Nestor Ovidio', email: 'nestor@amholding.com', password: 'pass123', empresa: 'ARKO' }
  ];

  const usuariosAdmin = [
    { id: 999, nombre: 'Admin', email: 'admin@amholding.com', password: 'admin123', rol: 'Administrador' },
    { id: 998, nombre: 'Contadora', email: 'contadora@amholding.com', password: 'pass123', rol: 'Contadora' }
  ];

  const empresas = ['AM SPORTS GROUP SAS', 'PRO INVESTMENTS GLOBAL SAS', 'PRONOVA CAPITAL SAS', 'FOR SEVEN MEDIA SAS', 'ARKO'];
  const estadosSolicitud = ['Pendiente', 'Aprobado', 'Pagado', 'Legalizado'];
  const tiposSolicitud = ['Anticipo', 'Legalización', 'Reembolso'];

  // Estados
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginMode, setLoginMode] = useState('responsable');
  const [currentView, setCurrentView] = useState('dashboard');
  const [solicitudes, setSolicitudes] = useState(() => JSON.parse(localStorage.getItem('amSolicitudes') || '[]'));
  const [responsables, setResponsables] = useState(() => JSON.parse(localStorage.getItem('amResponsables') || JSON.stringify(responsablesData)));
  const [newSolicitud, setNewSolicitud] = useState({ fecha: new Date().toISOString().split('T')[0], tipo: '', valor: '', detalle: '', empresa: 'AM SPORTS GROUP SAS', consignado: { nit: '', nombre: '', cedula: '' }, documentos: [] });
  const [generandoPDF, setGenerandoPDF] = useState(null);
  const [editingResponsable, setEditingResponsable] = useState(null);
  const [newResponsable, setNewResponsable] = useState({ nombre: '', email: '', password: 'pass123', empresa: 'AM SPORTS GROUP SAS' });

  // URLs
  const DRIVE_UPLOAD_URL = 'https://script.google.com/macros/s/AKfycbxxz_jICfJ7LvXNNG4PHLtugVtYhYzRdIYpthlYI5WTIno7ZjIKJZHCdbPC9jUN3BUpRg/exec';

  // Funciones Login
  const handleLogin = () => {
    if (loginMode === 'responsable') {
      const found = responsables.find(u => u.email === email && u.password === password);
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

  // Upload a Drive
  const handleUploadArchivesToDrive = async (solicitud) => {
    try {
      const archivos = solicitud.documentos
        .filter(doc => doc.archivo && doc.archivoNombre)
        .map(doc => ({
          nombre: doc.archivoNombre,
          data: doc.archivo.split(',')[1],
          mimeType: doc.archivo.split(';')[0].split(':')[1] || 'application/octet-stream'
        }));

      if (archivos.length === 0) return;

      const payLoad = {
        empresa: solicitud.empresa,
        tipo: solicitud.tipo,
        responsableNombre: solicitud.responsableNombre,
        fecha: solicitud.fecha,
        archivos: archivos
      };

      const response = await fetch(DRIVE_UPLOAD_URL, {
        method: 'POST',
        body: JSON.stringify(payLoad)
      });

      const result = await response.json();
      if (result.success) {
        alert(`✅ ${result.filesCount} archivo(s) guardado(s) en Drive`);
      }
    } catch (error) {
      console.warn('Error upload Drive:', error);
    }
  };

  // Agregar documento
  const handleAddDocumento = () => {
    setNewSolicitud({
      ...newSolicitud,
      documentos: [...newSolicitud.documentos, { proveedor: '', nit: '', descripcion: '', valor: '', archivoNombre: '', archivo: null }]
    });
  };

  // Agregar archivo a documento
  const handleAddArchivo = (idx, file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const newDocs = [...newSolicitud.documentos];
      newDocs[idx].archivo = e.target.result;
      newDocs[idx].archivoNombre = file.name;
      setNewSolicitud({ ...newSolicitud, documentos: newDocs });
    };
    reader.readAsDataURL(file);
  };

  // Eliminar documento
  const handleDeleteDocumento = (idx) => {
    setNewSolicitud({
      ...newSolicitud,
      documentos: newSolicitud.documentos.filter((_, i) => i !== idx)
    });
  };

  // Guardar solicitud
  const handleAddSolicitud = async () => {
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

    const totalCalculado = newSolicitud.documentos.reduce((sum, doc) => sum + (parseFloat(doc.valor) || 0), 0);

    const nuevaSolicitud = {
      id: Date.now(),
      fecha: newSolicitud.fecha,
      tipo: newSolicitud.tipo,
      valor: newSolicitud.tipo === 'Anticipo' ? newSolicitud.valor : 0,
      totalCalculado: totalCalculado,
      detalle: newSolicitud.detalle,
      empresa: newSolicitud.empresa,
      responsableId: user.id,
      responsableNombre: user.nombre,
      consignado: newSolicitud.consignado,
      documentos: newSolicitud.documentos,
      estado: 'Pendiente'
    };

    setSolicitudes([...solicitudes, nuevaSolicitud]);

    if ((newSolicitud.tipo === 'Legalización' || newSolicitud.tipo === 'Reembolso') && newSolicitud.documentos.length > 0) {
      await handleUploadArchivesToDrive(nuevaSolicitud);
    }

    localStorage.setItem('amSolicitudes', JSON.stringify([...solicitudes, nuevaSolicitud]));

    setNewSolicitud({
      fecha: new Date().toISOString().split('T')[0],
      tipo: '',
      valor: '',
      detalle: '',
      empresa: 'AM SPORTS GROUP SAS',
      consignado: { nit: '', nombre: '', cedula: '' },
      documentos: []
    });
    alert('✅ Solicitud creada');
  };

  // Cambiar estado
  const handleChangeEstado = (id, nuevoEstado) => {
    const updated = solicitudes.map(s => s.id === id ? {...s, estado: nuevoEstado} : s);
    setSolicitudes(updated);
    localStorage.setItem('amSolicitudes', JSON.stringify(updated));
  };

  // Filtrar solicitudes por rol
  const solicitudesUsuario = user?.rol === 'Responsable'
    ? solicitudes.filter(s => s.responsableId === user.id)
    : user?.rol === 'Contadora'
    ? solicitudes.filter(s => ['Aprobado', 'Pagado', 'Legalizado'].includes(s.estado))
    : solicitudes;

  // Estadísticas Dashboard
  const statsEstado = {
    Pendiente: solicitudesUsuario.filter(s => s.estado === 'Pendiente').length,
    Aprobado: solicitudesUsuario.filter(s => s.estado === 'Aprobado').length,
    Pagado: solicitudesUsuario.filter(s => s.estado === 'Pagado').length,
    Legalizado: solicitudesUsuario.filter(s => s.estado === 'Legalizado').length
  };

  const totalSolicitudes = solicitudesUsuario.length;
  const totalMonto = solicitudesUsuario.reduce((sum, s) => sum + (s.tipo === 'Anticipo' ? parseFloat(s.valor) || 0 : s.totalCalculado || 0), 0);

  const statsPorEmpresa = empresas.map(emp => ({
    empresa: emp,
    cantidad: solicitudesUsuario.filter(s => s.empresa === emp).length,
    monto: solicitudesUsuario.filter(s => s.empresa === emp).reduce((sum, s) => sum + (s.tipo === 'Anticipo' ? parseFloat(s.valor) || 0 : s.totalCalculado || 0), 0)
  })).filter(s => s.cantidad > 0);

  const topResponsables = responsables
    .map(resp => ({
      nombre: resp.nombre,
      cantidad: solicitudesUsuario.filter(s => s.responsableId === resp.id).length,
      monto: solicitudesUsuario.filter(s => s.responsableId === resp.id).reduce((sum, s) => sum + (s.tipo === 'Anticipo' ? parseFloat(s.valor) || 0 : s.totalCalculado || 0), 0)
    }))
    .filter(s => s.cantidad > 0)
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 5);

  const ultimasSolicitudes = solicitudesUsuario.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 5);

  // Generar PDF
  const handleGenerarPDF = async (s) => {
    setGenerandoPDF(s.id);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPos = 20;

      doc.setFontSize(16);
      doc.text(s.tipo === 'Anticipo' ? 'SOLICITUD DE ANTICIPO' : s.tipo === 'Legalización' ? 'LEGALIZACIÓN DE ANTICIPO' : 'REPORTE DE REEMBOLSO', pageWidth / 2, yPos, { align: 'center' });
      yPos += 15;

      doc.setFontSize(10);
      doc.text(`Fecha: ${s.fecha}`, 20, yPos);
      doc.text(`Responsable: ${s.responsableNombre}`, pageWidth / 2, yPos);
      yPos += 8;
      doc.text(`Empresa: ${s.empresa}`, 20, yPos);
      doc.text(`Concepto: ${s.detalle}`, pageWidth / 2, yPos);
      yPos += 12;

      if (s.tipo !== 'Anticipo') {
        doc.text(`Consignatario: ${s.consignado?.nombre}`, 20, yPos);
        yPos += 6;
        doc.text(`NIT: ${s.consignado?.nit}`, 20, yPos);
        doc.text(`Cédula: ${s.consignado?.cedula}`, pageWidth / 2, yPos);
        yPos += 12;

        if (s.documentos && s.documentos.length > 0) {
          doc.setFontSize(11);
          doc.text('DOCUMENTOS', 20, yPos);
          yPos += 8;
          doc.setFontSize(9);
          
          const tableData = s.documentos.map(d => [d.proveedor, d.nit, d.descripcion, `$${parseFloat(d.valor).toLocaleString()}`]);
          doc.autoTable({
            startY: yPos,
            head: [['Proveedor', 'NIT', 'Descripción', 'Valor']],
            body: tableData,
            margin: 20,
            theme: 'grid'
          });
          yPos = doc.lastAutoTable.finalY + 10;
        }
      }

      yPos += 5;
      doc.setFontSize(11);
      const totalLabel = s.tipo === 'Anticipo' ? 'TOTAL SOLICITADO' : 'TOTAL';
      const totalValue = s.tipo === 'Anticipo' ? `$${parseFloat(s.valor).toLocaleString()}` : `$${s.totalCalculado.toLocaleString()}`;
      doc.text(`${totalLabel}: ${totalValue}`, 20, yPos);

      doc.save(`${s.tipo}-${s.id}.pdf`);
    } catch (error) {
      console.error('Error PDF:', error);
    }
    setGenerandoPDF(null);
  };

  // Descargar archivos
  const handleDescargarArchivos = (s) => {
    s.documentos.forEach(doc => {
      if (doc.archivo) {
        const link = document.createElement('a');
        link.href = doc.archivo;
        link.download = doc.archivoNombre;
        link.click();
      }
    });
  };

  // Descargar ZIP
  const handleDescargarZIP = async (s) => {
    const zip = new JSZip();
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    doc.setFontSize(16);
    doc.text(s.tipo === 'Anticipo' ? 'SOLICITUD DE ANTICIPO' : s.tipo === 'Legalización' ? 'LEGALIZACIÓN DE ANTICIPO' : 'REPORTE DE REEMBOLSO', pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    doc.setFontSize(10);
    doc.text(`Fecha: ${s.fecha}`, 20, yPos);
    doc.text(`Responsable: ${s.responsableNombre}`, pageWidth / 2, yPos);
    yPos += 8;
    doc.text(`Empresa: ${s.empresa}`, 20, yPos);
    doc.text(`Concepto: ${s.detalle}`, pageWidth / 2, yPos);
    yPos += 12;

    if (s.tipo !== 'Anticipo') {
      doc.text(`Consignatario: ${s.consignado?.nombre}`, 20, yPos);
      yPos += 6;
      doc.text(`NIT: ${s.consignado?.nit}`, 20, yPos);
      doc.text(`Cédula: ${s.consignado?.cedula}`, pageWidth / 2, yPos);
      yPos += 12;

      if (s.documentos && s.documentos.length > 0) {
        doc.setFontSize(11);
        doc.text('DOCUMENTOS', 20, yPos);
        yPos += 8;
        doc.setFontSize(9);
        
        const tableData = s.documentos.map(d => [d.proveedor, d.nit, d.descripcion, `$${parseFloat(d.valor).toLocaleString()}`]);
        doc.autoTable({
          startY: yPos,
          head: [['Proveedor', 'NIT', 'Descripción', 'Valor']],
          body: tableData,
          margin: 20,
          theme: 'grid'
        });
        yPos = doc.lastAutoTable.finalY + 10;
      }
    }

    yPos += 5;
    doc.setFontSize(11);
    const totalLabel = s.tipo === 'Anticipo' ? 'TOTAL SOLICITADO' : 'TOTAL';
    const totalValue = s.tipo === 'Anticipo' ? `$${parseFloat(s.valor).toLocaleString()}` : `$${s.totalCalculado.toLocaleString()}`;
    doc.text(`${totalLabel}: ${totalValue}`, 20, yPos);

    zip.file(`${s.tipo}-${s.id}.pdf`, doc.output('blob'));

    s.documentos.forEach((doc, idx) => {
      if (doc.archivo) {
        const base64 = doc.archivo.split(',')[1];
        zip.file(doc.archivoNombre, base64, { base64: true });
      }
    });

    zip.generateAsync({ type: 'blob' }).then(blob => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${s.tipo}-${s.id}.zip`;
      link.click();
    });
  };

  // Eliminar solicitud
  const handleDeleteSolicitud = (id) => {
    if (window.confirm('¿Eliminar solicitud?')) {
      const updated = solicitudes.filter(s => s.id !== id);
      setSolicitudes(updated);
      localStorage.setItem('amSolicitudes', JSON.stringify(updated));
    }
  };

  // RESPONSABLES CRUD
  const handleAddResponsable = () => {
    if (!newResponsable.nombre || !newResponsable.email) {
      alert('Nombre y email son obligatorios');
      return;
    }
    
    const existe = responsables.some(r => r.email === newResponsable.email);
    if (existe) {
      alert('Email ya existe');
      return;
    }

    const responsableNuevo = {
      id: Math.max(...responsables.map(r => r.id || 0), 0) + 1,
      ...newResponsable
    };

    setResponsables([...responsables, responsableNuevo]);
    localStorage.setItem('amResponsables', JSON.stringify([...responsables, responsableNuevo]));
    setNewResponsable({ nombre: '', email: '', password: 'pass123', empresa: 'AM SPORTS GROUP SAS' });
    alert('✅ Responsable agregado');
  };

  const handleUpdateResponsable = (id, datos) => {
    setResponsables(responsables.map(r => r.id === id ? {...r, ...datos} : r));
    localStorage.setItem('amResponsables', JSON.stringify(responsables.map(r => r.id === id ? {...r, ...datos} : r)));
    setEditingResponsable(null);
  };

  const handleDeleteResponsable = (id) => {
    if (window.confirm('¿Eliminar responsable? (Las solicitudes se mantendrán)')) {
      setResponsables(responsables.filter(r => r.id !== id));
      localStorage.setItem('amResponsables', JSON.stringify(responsables.filter(r => r.id !== id)));
    }
  };

  // Color estado
  const getColorEstado = (estado) => {
    const colors = { Pendiente: '#ff6b6b', Aprobado: '#ffd43b', Pagado: '#51cf66', Legalizado: '#748ffc' };
    return colors[estado] || '#7a7a7a';
  };

  // LOGIN
  if (!user) {
    return (
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
  }

  // APP MAIN
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', color: '#fff' }}>
      <header style={{ backgroundColor: '#1a1a1a', borderBottom: '2px solid #C4A747', padding: '1.5rem' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><h1 style={{ color: '#C4A747', margin: 0 }}>AM HOLDING</h1><p style={{ fontSize: '0.85rem', color: '#a0a0a0', margin: '0.5rem 0 0 0' }}>{user.nombre} ({user.rol})</p></div>
          <button onClick={() => setUser(null)} style={{ backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Salir</button>
        </div>
      </header>

      <nav style={{ backgroundColor: '#0f0f0f', borderBottom: '1px solid #2a2a2a', padding: '1rem 0' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 1rem', display: 'flex', gap: '1rem' }}>
          <button onClick={() => setCurrentView('dashboard')} style={{ padding: '0.75rem 1.5rem', backgroundColor: currentView === 'dashboard' ? '#C4A747' : '#2a2a2a', color: currentView === 'dashboard' ? '#0f0f0f' : '#a0a0a0', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>📊 Dashboard</button>
          <button onClick={() => setCurrentView('solicitudes')} style={{ padding: '0.75rem 1.5rem', backgroundColor: currentView === 'solicitudes' ? '#C4A747' : '#2a2a2a', color: currentView === 'solicitudes' ? '#0f0f0f' : '#a0a0a0', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>📋 Solicitudes</button>
          {(user.rol === 'Administrador') && (
            <button onClick={() => setCurrentView('responsables')} style={{ padding: '0.75rem 1.5rem', backgroundColor: currentView === 'responsables' ? '#C4A747' : '#2a2a2a', color: currentView === 'responsables' ? '#0f0f0f' : '#a0a0a0', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>👥 Responsables</button>
          )}
        </div>
      </nav>

      <main style={{ maxWidth: '1400px', margin: '2rem auto', padding: '0 1rem' }}>
        {currentView === 'dashboard' && (
          <div>
            <h2 style={{ color: '#C4A747', marginBottom: '1.5rem' }}>📊 Dashboard</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '1.5rem' }}>
                <p style={{ color: '#a0a0a0', margin: '0 0 0.5rem 0', fontSize: '0.85rem' }}>Total Solicitudes</p>
                <h3 style={{ color: '#C4A747', margin: 0, fontSize: '2.5rem' }}>{totalSolicitudes}</h3>
              </div>
              <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '1.5rem' }}>
                <p style={{ color: '#a0a0a0', margin: '0 0 0.5rem 0', fontSize: '0.85rem' }}>Monto Total</p>
                <h3 style={{ color: '#51cf66', margin: 0, fontSize: '2.5rem' }}>$ {totalMonto.toLocaleString()}</h3>
              </div>
              <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '1.5rem' }}>
                <p style={{ color: '#a0a0a0', margin: '0 0 0.5rem 0', fontSize: '0.85rem' }}>Pendiente</p>
                <h3 style={{ color: '#ff6b6b', margin: 0, fontSize: '2.5rem' }}>{statsEstado.Pendiente}</h3>
              </div>
              <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '1.5rem' }}>
                <p style={{ color: '#a0a0a0', margin: '0 0 0.5rem 0', fontSize: '0.85rem' }}>Aprobado</p>
                <h3 style={{ color: '#ffd43b', margin: 0, fontSize: '2.5rem' }}>{statsEstado.Aprobado}</h3>
              </div>
              <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '1.5rem' }}>
                <p style={{ color: '#a0a0a0', margin: '0 0 0.5rem 0', fontSize: '0.85rem' }}>Pagado</p>
                <h3 style={{ color: '#51cf66', margin: 0, fontSize: '2.5rem' }}>{statsEstado.Pagado}</h3>
              </div>
              <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '1.5rem' }}>
                <p style={{ color: '#a0a0a0', margin: '0 0 0.5rem 0', fontSize: '0.85rem' }}>Legalizado</p>
                <h3 style={{ color: '#748ffc', margin: 0, fontSize: '2.5rem' }}>{statsEstado.Legalizado}</h3>
              </div>
            </div>

            {statsPorEmpresa.length > 0 && (
              <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '1.5rem', marginBottom: '2rem' }}>
                <h3 style={{ color: '#C4A747', margin: '0 0 1rem 0' }}>Por Empresa</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #C4A747' }}>
                      <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Empresa</th>
                      <th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>Solicitudes</th>
                      <th style={{ textAlign: 'right', padding: '0.75rem', color: '#C4A747' }}>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statsPorEmpresa.map((emp, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #2a2a2a' }}>
                        <td style={{ padding: '0.75rem', color: '#a0a0a0' }}>{emp.empresa}</td>
                        <td style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>{emp.cantidad}</td>
                        <td style={{ textAlign: 'right', padding: '0.75rem', color: '#51cf66', fontWeight: 'bold' }}>$ {emp.monto.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {topResponsables.length > 0 && (
              <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '1.5rem', marginBottom: '2rem' }}>
                <h3 style={{ color: '#C4A747', margin: '0 0 1rem 0' }}>👥 Top Responsables</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #C4A747' }}>
                      <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Responsable</th>
                      <th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>Solicitudes</th>
                      <th style={{ textAlign: 'right', padding: '0.75rem', color: '#C4A747' }}>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topResponsables.map((resp, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #2a2a2a' }}>
                        <td style={{ padding: '0.75rem', color: '#a0a0a0' }}>{resp.nombre}</td>
                        <td style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>{resp.cantidad}</td>
                        <td style={{ textAlign: 'right', padding: '0.75rem', color: '#51cf66', fontWeight: 'bold' }}>$ {resp.monto.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {ultimasSolicitudes.length > 0 && (
              <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '1.5rem' }}>
                <h3 style={{ color: '#C4A747', margin: '0 0 1rem 0' }}>📋 Últimas Solicitudes</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #C4A747' }}>
                      <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Fecha</th>
                      {(user.rol === 'Administrador' || user.rol === 'Contadora') && <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Responsable</th>}
                      <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Tipo</th>
                      <th style={{ textAlign: 'right', padding: '0.75rem', color: '#C4A747' }}>Monto</th>
                      <th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ultimasSolicitudes.map(s => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                        <td style={{ padding: '0.75rem', color: '#a0a0a0', fontSize: '0.8rem' }}>{s.fecha}</td>
                        {(user.rol === 'Administrador' || user.rol === 'Contadora') && <td style={{ padding: '0.75rem', color: '#a0a0a0', fontSize: '0.8rem' }}>{s.responsableNombre}</td>}
                        <td style={{ padding: '0.75rem', color: '#C4A747', fontWeight: 'bold' }}>{s.tipo}</td>
                        <td style={{ padding: '0.75rem', color: '#51cf66', textAlign: 'right', fontWeight: 'bold' }}>$ {(s.tipo === 'Anticipo' ? parseFloat(s.valor) : s.totalCalculado || 0).toLocaleString()}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <span style={{ backgroundColor: getColorEstado(s.estado), color: '#0f0f0f', padding: '0.4rem 0.8rem', borderRadius: '3px', fontWeight: 'bold', fontSize: '0.8rem' }}>{s.estado}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {currentView === 'solicitudes' && (
          <div>
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

                      {newSolicitud.documentos.map((doc, idx) => (
                        <div key={idx} style={{ backgroundColor: '#1a1a1a', padding: '1rem', marginBottom: '1rem', borderRadius: '3px', border: '1px solid #2a2a2a' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <input type="text" placeholder="Proveedor" value={doc.proveedor} onChange={(e) => { const newDocs = [...newSolicitud.documentos]; newDocs[idx].proveedor = e.target.value; setNewSolicitud({...newSolicitud, documentos: newDocs}); }} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '3px', color: '#fff', boxSizing: 'border-box', fontSize: '0.8rem' }} />
                            <input type="text" placeholder="NIT" value={doc.nit} onChange={(e) => { const newDocs = [...newSolicitud.documentos]; newDocs[idx].nit = e.target.value; setNewSolicitud({...newSolicitud, documentos: newDocs}); }} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '3px', color: '#fff', boxSizing: 'border-box', fontSize: '0.8rem' }} />
                            <input type="text" placeholder="Descripción" value={doc.descripcion} onChange={(e) => { const newDocs = [...newSolicitud.documentos]; newDocs[idx].descripcion = e.target.value; setNewSolicitud({...newSolicitud, documentos: newDocs}); }} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '3px', color: '#fff', boxSizing: 'border-box', fontSize: '0.8rem' }} />
                            <input type="number" placeholder="Valor" value={doc.valor} onChange={(e) => { const newDocs = [...newSolicitud.documentos]; newDocs[idx].valor = e.target.value; setNewSolicitud({...newSolicitud, documentos: newDocs}); }} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '3px', color: '#fff', boxSizing: 'border-box', fontSize: '0.8rem' }} />
                          </div>
                          <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <label style={{ flex: 1, padding: '0.75rem', backgroundColor: '#748ffc', color: '#0f0f0f', border: 'none', borderRadius: '3px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center', fontSize: '0.8rem' }}>
                              📎 {doc.archivoNombre ? '✓' : 'Archivo'}
                              <input type="file" onChange={(e) => handleAddArchivo(idx, e.target.files[0])} style={{ display: 'none' }} />
                            </label>
                            <button onClick={() => handleDeleteDocumento(idx)} style={{ padding: '0.75rem 1rem', backgroundColor: '#ff6b6b', color: '#0f0f0f', border: 'none', borderRadius: '3px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <button onClick={handleAddSolicitud} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Guardar Solicitud</button>
              </div>
            )}

            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
              <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0' }}>
                📋 {user.rol === 'Responsable' ? 'Mis Solicitudes' : user.rol === 'Contadora' ? 'Solicitudes Auditadas' : 'Todas las Solicitudes'}
              </h2>
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
                        <td style={{ padding: '0.75rem', color: '#51cf66', textAlign: 'right', fontWeight: 'bold' }}>$ {(s.tipo === 'Anticipo' ? parseFloat(s.valor) : s.totalCalculado || 0).toLocaleString()}</td>
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
          </div>
        )}

        {currentView === 'responsables' && (
          <div>
            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', marginBottom: '2rem' }}>
              <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0' }}>➕ Nuevo Responsable</h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <input type="text" placeholder="Nombre Completo" value={newResponsable.nombre} onChange={(e) => setNewResponsable({...newResponsable, nombre: e.target.value})} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }} />
                <input type="email" placeholder="Email" value={newResponsable.email} onChange={(e) => setNewResponsable({...newResponsable, email: e.target.value})} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }} />
                <input type="password" placeholder="Contraseña" value={newResponsable.password} onChange={(e) => setNewResponsable({...newResponsable, password: e.target.value})} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }} />
                <select value={newResponsable.empresa} onChange={(e) => setNewResponsable({...newResponsable, empresa: e.target.value})} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }}>
                  {empresas.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                </select>
              </div>

              <button onClick={handleAddResponsable} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Agregar Responsable</button>
            </div>

            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
              <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0' }}>👥 Responsables ({responsables.length})</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead style={{ backgroundColor: '#0f0f0f' }}>
                    <tr style={{ borderBottom: '2px solid #C4A747' }}>
                      <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Nombre</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Email</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Empresa</th>
                      <th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>Solicitudes</th>
                      <th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {responsables.map(r => {
                      const solicitudesResponsable = solicitudes.filter(s => s.responsableId === r.id).length;
                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                          <td style={{ padding: '0.75rem', color: '#a0a0a0' }}>
                            {editingResponsable === r.id ? (
                              <input type="text" value={r.nombre} onChange={(e) => handleUpdateResponsable(r.id, {nombre: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#0f0f0f', border: '1px solid #C4A747', color: '#fff', borderRadius: '3px', boxSizing: 'border-box' }} />
                            ) : (
                              r.nombre
                            )}
                          </td>
                          <td style={{ padding: '0.75rem', color: '#a0a0a0' }}>
                            {editingResponsable === r.id ? (
                              <input type="email" value={r.email} onChange={(e) => handleUpdateResponsable(r.id, {email: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#0f0f0f', border: '1px solid #C4A747', color: '#fff', borderRadius: '3px', boxSizing: 'border-box' }} />
                            ) : (
                              r.email
                            )}
                          </td>
                          <td style={{ padding: '0.75rem', color: '#C4A747' }}>
                            {editingResponsable === r.id ? (
                              <select value={r.empresa} onChange={(e) => handleUpdateResponsable(r.id, {empresa: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#0f0f0f', border: '1px solid #C4A747', color: '#fff', borderRadius: '3px' }}>
                                {empresas.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                              </select>
                            ) : (
                              r.empresa
                            )}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center', color: '#51cf66', fontWeight: 'bold' }}>{solicitudesResponsable}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            {editingResponsable === r.id ? (
                              <>
                                <button onClick={() => setEditingResponsable(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#51cf66', fontSize: '1rem', marginRight: '0.5rem' }}>✓</button>
                                <button onClick={() => { setEditingResponsable(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff6b6b', fontSize: '1rem' }}>✕</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => setEditingResponsable(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#748ffc', fontSize: '1rem', marginRight: '0.5rem' }}>✏️</button>
                                <button onClick={() => handleDeleteResponsable(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff6b6b', fontSize: '1rem' }}>🗑️</button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
