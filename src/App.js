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
    { id: 998, nombre: 'Contadora', email: 'contadora@amholding.com', password: 'pass123', rol: 'Contadora' },
    { id: 997, nombre: 'Gerente - Operaciones', email: 'gerente.ops@amholding.com', password: 'pass123', rol: 'Gerente' },
    { id: 996, nombre: 'Gerente - Finanzas', email: 'gerente.fin@amholding.com', password: 'pass123', rol: 'Gerente' },
    { id: 995, nombre: 'Caren Paola Garzón Márquez', email: 'caren@amholding.com', password: 'pass123', rol: 'Coordinadora Administrativa' }
  ];

  const empresas = ['AM SPORTS GROUP SAS', 'PRO INVESTMENTS GLOBAL SAS', 'PRONOVA CAPITAL SAS', 'FOR SEVEN MEDIA SAS', 'ARKO'];
  const estadosSolicitud = ['Pendiente', 'Aprobado', 'Pagado', 'Legalizado'];
  const tiposSolicitud = ['Anticipo', 'Legalización', 'Reembolso'];
  const cecos = [
    { codigo: 'CECO-001-GF', nombre: 'Gastos Fijos', tipo: 'ADMINISTRATIVOS' },
    { codigo: 'CECO-002-NM', nombre: 'Nómina', tipo: 'NOMINA' },
    { codigo: 'CECO-003-GR', nombre: 'Gastos de Representación', tipo: 'REEMBOLSOS' },
    { codigo: 'CECO-004-HR', nombre: 'Honorarios', tipo: 'ANTICIPOS' },
    { codigo: 'CECO-005-OT', nombre: 'Otros', tipo: 'VARIOS' },
    { codigo: 'CECO-006-VI', nombre: 'Viajes', tipo: 'REEMBOLSOS' }
  ];
  const categorias = ['Transporte', 'Hospedaje', 'Alimentación', 'Servicios', 'Equipos', 'Comunicación', 'Otros'];
  const cuentasPorEmpresa = {
    'AM SPORTS GROUP SAS': ['CUENTA BANCOLOMBIA', 'CUENTA BBVA'],
    'PRO INVESTMENTS GLOBAL SAS': ['CUENTA BANCOLOMBIA'],
    'PRONOVA CAPITAL SAS': ['CUENTA BANCOLOMBIA'],
    'FOR SEVEN MEDIA SAS': ['CUENTA BANCOLOMBIA'],
    'ARKO': ['JPMORGAN'],
    'CUBO': ['BANCOLOMBIA', 'ITAU', 'BTG', 'BBVA']
  };
  const tiposTransaccion = ['Gasto', 'Ingreso', 'Traslado'];

  // Estados
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginMode, setLoginMode] = useState('responsable');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [solicitudes, setSolicitudes] = useState(() => JSON.parse(localStorage.getItem('amSolicitudes') || '[]'));
  const [responsables, setResponsables] = useState(() => JSON.parse(localStorage.getItem('amResponsables') || JSON.stringify(responsablesData)));
  const [newSolicitud, setNewSolicitud] = useState({ fecha: new Date().toISOString().split('T')[0], tipo: '', valor: '', detalle: '', empresa: 'AM SPORTS GROUP SAS', consignado: { nit: '', nombre: '', cedula: '' }, documentos: [] });
  const [generandoPDF, setGenerandoPDF] = useState(null);
  const [editingResponsable, setEditingResponsable] = useState(null);
  const [newResponsable, setNewResponsable] = useState({ nombre: '', email: '', password: 'pass123', empresa: 'AM SPORTS GROUP SAS' });
  const [newUserType, setNewUserType] = useState('Colaborador');
  const [cuentasDeCobro, setCuentasDeCobro] = useState(() => JSON.parse(localStorage.getItem('amCuentasDeCobro') || '[]'));
  const [newCuentaCobro, setNewCuentaCobro] = useState({ fecha: new Date().toISOString().split('T')[0], numero: '', responsable: '', empresa: '', monto: '', concepto: '', driveLink: '', estado: 'Pendiente' });
  const [gastos, setGastos] = useState(() => JSON.parse(localStorage.getItem('amGastos') || '[]'));
  const [ingresos, setIngresos] = useState(() => JSON.parse(localStorage.getItem('amIngresos') || '[]'));
  const [newGasto, setNewGasto] = useState({ fecha: new Date().toISOString().split('T')[0], tipo: 'Gasto', empresa: 'AM SPORTS GROUP SAS', responsable: '', ceco: 'CECO-001-GF', cuenta: '', detalle: '', valor: '', categoria: '', estado: 'Pendiente', observaciones: '', linkSoporte: '', cuentaSalida: '', cuentaDestino: '', soportes: [] });
  const [newIngreso, setNewIngreso] = useState({ fecha: new Date().toISOString().split('T')[0], tipo: 'Ingreso', empresa: 'AM SPORTS GROUP SAS', responsable: '', detalle: '', valor: '', categoria: '', estado: 'Pagado', observaciones: '', linkSoporte: '', cuenta: '', soportes: [] });
  const [filtroFinanzas, setFiltroFinanzas] = useState({ mes: new Date().getMonth() + 1, empresa: 'Todos', tipo: 'Todos' });
  const [soportesTemp, setSoportesTemp] = useState([]);
  const [verSoportes, setVerSoportes] = useState(null);
  const [mostrarImportar, setMostrarImportar] = useState(false);
  const [archivoImportacion, setArchivoImportacion] = useState(null);
  const [filtroFechaInicio, setFiltroFechaInicio] = useState('2026-01-01');
  const [filtroFechaFin, setFiltroFechaFin] = useState(new Date().toISOString().split('T')[0]);

  // URLs
  const DRIVE_UPLOAD_URL = 'https://script.google.com/macros/s/AKfycby-voRnepppydRFrkEc4CO4dCV7Ymhac-bU63FPZrtVui71vxc2j0dC3TQphu8XhmEW5Q/exec';

  // Funciones Login
  const handleLogin = () => {
    // Buscar en responsables (colaboradores)
    const foundResponsable = responsables.find(u => u.email === email && u.password === password);
    if (foundResponsable) {
      setUser({ ...foundResponsable, rol: 'Responsable' });
      setEmail('');
      setPassword('');
      return;
    }
    
    // Buscar en usuariosAdmin (admin, contadora, coordinadora, gerentes)
    const found = usuariosAdmin.find(u => u.email === email && u.password === password);
    if (found) {
      setUser(found);
      setEmail('');
      setPassword('');
      return;
    }
    
    alert('Email o contraseña incorrecto');
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
      doc.text(`Colaborador: ${s.responsableNombre}`, pageWidth / 2, yPos);
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
    doc.text(`Colaborador: ${s.responsableNombre}`, pageWidth / 2, yPos);
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
    
    const existe = responsables.some(r => r.email === newResponsable.email) || 
                   usuariosAdmin.some(u => u.email === newResponsable.email);
    if (existe) {
      alert('Email ya existe');
      return;
    }

    if (newUserType === 'Colaborador') {
      // Agregar como colaborador
      const responsableNuevo = {
        id: Math.max(...responsables.map(r => r.id || 0), 0) + 1,
        ...newResponsable
      };
      setResponsables([...responsables, responsableNuevo]);
      localStorage.setItem('amResponsables', JSON.stringify([...responsables, responsableNuevo]));
      alert('✅ Colaborador agregado');
    } else if (newUserType === 'Gerente') {
      // Agregar como gerente
      const gerenteNuevo = {
        id: Math.max(...usuariosAdmin.map(u => u.id || 0), 0) + 1,
        nombre: newResponsable.nombre,
        email: newResponsable.email,
        password: newResponsable.password,
        rol: 'Gerente'
      };
      // Aquí no guardamos en localStorage porque usuariosAdmin es estático, pero en una versión real se guardaría
      alert('⚠️ Gerente agregado (requiere reiniciar la app). En producción se guardaría en base de datos.');
    }
    
    setNewResponsable({ nombre: '', email: '', password: 'pass123', empresa: 'AM SPORTS GROUP SAS' });
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

  // CUENTAS DE COBRO CRUD
  const handleAddCuentaCobro = () => {
    if (!newCuentaCobro.numero || !newCuentaCobro.responsable || !newCuentaCobro.monto) {
      alert('Número, responsable y monto son obligatorios');
      return;
    }

    const nuevaCuenta = {
      id: Date.now(),
      ...newCuentaCobro,
      responsableNombre: responsables.find(r => r.nombre === newCuentaCobro.responsable)?.nombre || newCuentaCobro.responsable
    };

    setCuentasDeCobro([...cuentasDeCobro, nuevaCuenta]);
    localStorage.setItem('amCuentasDeCobro', JSON.stringify([...cuentasDeCobro, nuevaCuenta]));
    
    setNewCuentaCobro({ 
      fecha: new Date().toISOString().split('T')[0], 
      numero: '', 
      responsable: '', 
      empresa: '', 
      monto: '', 
      concepto: '', 
      driveLink: '', 
      estado: 'Pendiente' 
    });
    alert('✅ Cuenta de cobro agregada');
  };

  const handleUpdateCuentaCobro = (id, campo, valor) => {
    const updated = cuentasDeCobro.map(c => c.id === id ? {...c, [campo]: valor} : c);
    setCuentasDeCobro(updated);
    localStorage.setItem('amCuentasDeCobro', JSON.stringify(updated));
  };

  const handleDeleteCuentaCobro = (id) => {
    if (window.confirm('¿Eliminar cuenta de cobro?')) {
      const updated = cuentasDeCobro.filter(c => c.id !== id);
      setCuentasDeCobro(updated);
      localStorage.setItem('amCuentasDeCobro', JSON.stringify(updated));
    }
  };

  const cuentasCobroUsuario = user?.rol === 'Responsable' 
    ? cuentasDeCobro.filter(c => c.responsableNombre === user.nombre)
    : cuentasDeCobro;

  // GASTOS E INGRESOS CRUD
  const handleAddGasto = () => {
    if (!newGasto.detalle || !newGasto.valor) {
      alert('Detalle y valor son obligatorios');
      return;
    }

    if (newGasto.tipo === 'Traslado') {
      if (!newGasto.cuentaSalida || !newGasto.cuentaDestino) {
        alert('Cuenta salida y cuenta destino son obligatorios para traslados');
        return;
      }
    } else if (!newGasto.cuenta) {
      alert('Cuenta es obligatoria');
      return;
    }

    const nuevoGasto = {
      id: Date.now(),
      ...newGasto,
      soportes: soportesTemp,
      responsableNombre: responsables.find(r => r.nombre === newGasto.responsable)?.nombre || newGasto.responsable
    };

    setGastos([...gastos, nuevoGasto]);
    localStorage.setItem('amGastos', JSON.stringify([...gastos, nuevoGasto]));
    
    setNewGasto({ 
      fecha: new Date().toISOString().split('T')[0], 
      tipo: 'Gasto',
      empresa: 'AM SPORTS GROUP SAS',
      responsable: '',
      ceco: 'CECO-001-GF',
      cuenta: '',
      detalle: '',
      valor: '',
      categoria: '',
      estado: 'Pendiente',
      observaciones: '',
      linkSoporte: '',
      cuentaSalida: '',
      cuentaDestino: '',
      soportes: []
    });
    setSoportesTemp([]);
    alert('✅ Transacción agregada con soportes');
  };

  const handleAddIngreso = () => {
    if (!newIngreso.detalle || !newIngreso.valor) {
      alert('Detalle y valor son obligatorios');
      return;
    }

    if (!newIngreso.cuenta) {
      alert('Cuenta es obligatoria');
      return;
    }

    const nuevoIngreso = {
      id: Date.now(),
      ...newIngreso,
      soportes: soportesTemp,
      responsableNombre: responsables.find(r => r.nombre === newIngreso.responsable)?.nombre || newIngreso.responsable
    };

    setIngresos([...ingresos, nuevoIngreso]);
    localStorage.setItem('amIngresos', JSON.stringify([...ingresos, nuevoIngreso]));
    
    setNewIngreso({ 
      fecha: new Date().toISOString().split('T')[0], 
      tipo: 'Ingreso',
      empresa: 'AM SPORTS GROUP SAS',
      responsable: '',
      detalle: '',
      valor: '',
      categoria: '',
      estado: 'Pagado',
      observaciones: '',
      linkSoporte: '',
      cuenta: '',
      soportes: []
    });
    setSoportesTemp([]);
    alert('✅ Ingreso agregado con soportes');
  };

  const handleUpdateGasto = (id, campo, valor) => {
    const updated = gastos.map(g => g.id === id ? {...g, [campo]: valor} : g);
    setGastos(updated);
    localStorage.setItem('amGastos', JSON.stringify(updated));
  };

  const handleDeleteGasto = (id) => {
    if (window.confirm('¿Eliminar gasto?')) {
      const updated = gastos.filter(g => g.id !== id);
      setGastos(updated);
      localStorage.setItem('amGastos', JSON.stringify(updated));
    }
  };

  const handleDeleteIngreso = (id) => {
    if (window.confirm('¿Eliminar ingreso?')) {
      const updated = ingresos.filter(i => i.id !== id);
      setIngresos(updated);
      localStorage.setItem('amIngresos', JSON.stringify(updated));
    }
  };

  // MANEJO DE SOPORTES (ARCHIVOS)
  const handleAddSoporte = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const nuevoSoporte = {
          id: Date.now() + Math.random(),
          nombre: file.name,
          tipo: file.type,
          tamaño: file.size,
          data: event.target.result
        };
        setSoportesTemp([...soportesTemp, nuevoSoporte]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleRemoveSoporte = (id) => {
    setSoportesTemp(soportesTemp.filter(s => s.id !== id));
  };

  const handleDownloadSoporte = (soporte) => {
    const link = document.createElement('a');
    link.href = soporte.data;
    link.download = soporte.nombre;
    link.click();
  };

  // IMPORTAR GASTOS DESDE JSON
  const handleImportarGastos = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const gastosAImportar = JSON.parse(event.target.result);
        
        if (!Array.isArray(gastosAImportar)) {
          alert('❌ El archivo no contiene un array válido');
          return;
        }

        // Agregar todos los gastos
        const gastosActuales = JSON.parse(localStorage.getItem('amGastos') || '[]');
        const gastosNuevos = [...gastosActuales, ...gastosAImportar];
        
        localStorage.setItem('amGastos', JSON.stringify(gastosNuevos));
        setGastos(gastosNuevos);
        
        setMostrarImportar(false);
        setArchivoImportacion(null);
        alert(`✅ Se importaron ${gastosAImportar.length} registros exitosamente!`);
      } catch (error) {
        alert('❌ Error al procesar el archivo: ' + error.message);
      }
    };
    reader.readAsText(file);
  };

  const handleViewSoportes = (soportes) => {
    setVerSoportes(soportes);
  };

  // Filtrar gastos e ingresos
  const gastosUsuario = user?.rol === 'Responsable' 
    ? gastos.filter(g => g.responsableNombre === user.nombre)
    : gastos;

  const ingresosUsuario = user?.rol === 'Responsable' 
    ? ingresos.filter(i => i.responsableNombre === user.nombre)
    : ingresos;

  // Dashboard financiero
  const totalGastos = (user?.rol === 'Responsable' ? gastosUsuario : gastos)
    .reduce((sum, g) => sum + (parseFloat(g.valor) || 0), 0);

  const totalIngresos = (user?.rol === 'Responsable' ? ingresosUsuario : ingresos)
    .reduce((sum, i) => sum + (parseFloat(i.valor) || 0), 0);

  const balance = totalIngresos - totalGastos;

  const gastosPorCECO = cecos.map(ceco => ({
    ceco: ceco.nombre,
    valor: (user?.rol === 'Responsable' ? gastosUsuario : gastos)
      .filter(g => g.ceco === ceco.codigo)
      .reduce((sum, g) => sum + (parseFloat(g.valor) || 0), 0)
  })).filter(g => g.valor > 0);

  const gastosPorEmpresa = empresas.map(emp => ({
    empresa: emp,
    valor: (user?.rol === 'Responsable' ? gastosUsuario : gastos)
      .filter(g => g.empresa === emp)
      .reduce((sum, g) => sum + (parseFloat(g.valor) || 0), 0)
  })).filter(g => g.valor > 0);

  // FUNCIONES PARA DASHBOARD AVANZADO
  const gastosFiltradomat = (user?.rol === 'Responsable' ? gastosUsuario : gastos).filter(g => 
    g.fecha >= filtroFechaInicio && g.fecha <= filtroFechaFin
  );
  
  const ingresosFiltradomat = (user?.rol === 'Responsable' ? ingresosUsuario : ingresos).filter(i => 
    i.fecha >= filtroFechaInicio && i.fecha <= filtroFechaFin
  );

  // Datos por mes
  const datosPorMes = (() => {
    const meses = {};
    gastosFiltradomat.forEach(g => {
      const mes = g.fecha.substring(0, 7);
      if (!meses[mes]) meses[mes] = { mes, gastos: 0, ingresos: 0 };
      meses[mes].gastos += parseFloat(g.valor) || 0;
    });
    ingresosFiltradomat.forEach(i => {
      const mes = i.fecha.substring(0, 7);
      if (!meses[mes]) meses[mes] = { mes, gastos: 0, ingresos: 0 };
      meses[mes].ingresos += parseFloat(i.valor) || 0;
    });
    return Object.values(meses).sort((a, b) => a.mes.localeCompare(b.mes));
  })();

  // Top CECOs
  const topCecos = cecos.map(ceco => ({
    name: ceco.nombre,
    value: gastosFiltradomat
      .filter(g => g.ceco === ceco.codigo)
      .reduce((sum, g) => sum + (parseFloat(g.valor) || 0), 0)
  }))
  .filter(c => c.value > 0)
  .sort((a, b) => b.value - a.value)
  .slice(0, 5);

  // Top Empresas
  const topEmpresas = empresas.map(emp => ({
    name: emp.split(' ')[0],
    value: gastosFiltradomat
      .filter(g => g.empresa === emp)
      .reduce((sum, g) => sum + (parseFloat(g.valor) || 0), 0)
  }))
  .filter(e => e.value > 0)
  .sort((a, b) => b.value - a.value)
  .slice(0, 5);

  // PERMISOS POR ROL
  const canEdit = user?.rol && ['Administrador', 'Coordinadora Administrativa', 'Responsable'].includes(user.rol);
  const canApprove = user?.rol && ['Administrador', 'Coordinadora Administrativa'].includes(user.rol);
  const isReadOnly = user?.rol === 'Contadora';
  
  // Color estado
  const getColorEstado = (estado) => {
    const colores = { 'Pendiente': '#ff6b6b', 'Aprobado': '#ffd43b', 'Pagado': '#51cf66', 'Legalizado': '#748ffc' };
    return colores[estado] || '#a0a0a0';
  };

  // DESCARGAS Y REPORTES
  const downloadReporteFinanzas = () => {
    const headers = ['Fecha', 'Tipo', 'Empresa', 'CECO', 'Detalle', 'Valor', 'Estado', 'Responsable'];
    const datos = [...gastos, ...ingresos].map(item => [
      item.fecha,
      item.tipo,
      item.empresa,
      item.ceco || '-',
      item.detalle,
      item.valor,
      item.estado,
      item.responsable
    ]).sort((a, b) => new Date(b[0]) - new Date(a[0]));

    let csv = headers.join(',') + '\n';
    datos.forEach(row => {
      csv += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `Reporte_Finanzas_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  const downloadReporteSolicitudes = () => {
    const headers = ['Fecha', 'Tipo', 'Empresa', 'Concepto', 'Valor', 'Estado', 'Responsable'];
    const datos = solicitudes.map(s => [
      s.fecha,
      s.tipo,
      s.empresa,
      s.detalle,
      s.valor || s.totalCalculado || '-',
      s.estado,
      s.responsableNombre || '-'
    ]).sort((a, b) => new Date(b[0]) - new Date(a[0]));

    let csv = headers.join(',') + '\n';
    datos.forEach(row => {
      csv += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `Reporte_Solicitudes_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  const downloadSoportesZIP = async () => {
    const zip = new JSZip();
    let count = 0;

    solicitudes.forEach((sol, idx) => {
      if (sol.documentos && sol.documentos.length > 0) {
        sol.documentos.forEach((doc, docIdx) => {
          if (doc.archivo) {
            const nombre = doc.archivoNombre || `documento_${idx}_${docIdx}`;
            const data = doc.archivo.split(',')[1];
            zip.file(`${sol.fecha}_${sol.tipo}_${nombre}`, data, { base64: true });
            count++;
          }
        });
      }
    });

    if (count === 0) {
      alert('No hay documentos para descargar');
      return;
    }

    zip.generateAsync({ type: 'blob' }).then(blob => {
      const link = document.createElement('a');
      link.setAttribute('href', URL.createObjectURL(blob));
      link.setAttribute('download', `Soportes_${new Date().toISOString().split('T')[0]}.zip`);
      link.click();
    });
  };

  // LOGIN
  if (!user) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div style={{ backgroundColor: '#1a1a1a', border: '2px solid #C4A747', borderRadius: '8px', padding: '3rem 2rem', textAlign: 'center', maxWidth: '500px', width: '100%' }}>
          <h1 style={{ color: '#C4A747', fontSize: '2.5rem', margin: 0 }}>AM HOLDING</h1>
          <p style={{ color: '#a0a0a0', margin: '1rem 0 2rem 0' }}>Gestión Financiera/Contable</p>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', color: '#a0a0a0', fontSize: '0.9rem', marginBottom: '0.75rem', fontWeight: 'bold' }}>Seleccionar Perfil</label>
            <select 
              value={selectedProfile || ''} 
              onChange={(e) => {
                const profile = e.target.value;
                setSelectedProfile(profile);
                if (profile) {
                  const allUsers = [...responsablesData, ...usuariosAdmin];
                  const user = allUsers.find(u => u.email === profile);
                  if (user) setEmail(user.email);
                }
              }}
              style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #C4A747', color: '#C4A747', marginBottom: '1rem', boxSizing: 'border-box', borderRadius: '4px', cursor: 'pointer' }}
            >
              <option value="">-- Elige un perfil --</option>
              
              <optgroup label="👥 COLABORADORES">
                {responsablesData.map(r => (
                  <option key={r.id} value={r.email}>{r.nombre}</option>
                ))}
              </optgroup>
              
              <optgroup label="📊 OPERATIVO">
                {usuariosAdmin.filter(u => ['Coordinadora Administrativa', 'Contadora', 'Administrador'].includes(u.rol)).map(u => (
                  <option key={u.id} value={u.email}>{u.nombre} ({u.rol})</option>
                ))}
              </optgroup>
              
              <optgroup label="📈 GERENTES">
                {usuariosAdmin.filter(u => u.rol === 'Gerente').map(u => (
                  <option key={u.id} value={u.email}>{u.nombre}</option>
                ))}
              </optgroup>
            </select>
            <p style={{ color: '#7a7a7a', fontSize: '0.8rem', margin: 0 }}>Selecciona tu usuario para auto-llenar el email</p>
          </div>

          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #C4A747', color: '#C4A747', marginBottom: '1rem', boxSizing: 'border-box', borderRadius: '4px' }} />
          <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleLogin()} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #C4A747', color: '#C4A747', marginBottom: '2rem', boxSizing: 'border-box', borderRadius: '4px' }} />
          <button onClick={handleLogin} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '2rem' }}>Entrar</button>

          <p style={{ color: '#7a7a7a', fontSize: '0.8rem', margin: '1rem 0 0.5rem 0' }}>COLABORADOR:</p>
          <p style={{ color: '#a0a0a0', fontSize: '0.75rem', margin: '0 0 1rem 0' }}>cristian@amholding.com / pass123</p>
          <p style={{ color: '#7a7a7a', fontSize: '0.8rem', margin: '0.5rem 0 0 0' }}>COORDINADORA ADMINISTRATIVA:</p>
          <p style={{ color: '#a0a0a0', fontSize: '0.75rem', margin: '0 0 0.5rem 0' }}>caren@amholding.com / pass123</p>
          <p style={{ color: '#7a7a7a', fontSize: '0.8rem', margin: '0.5rem 0 0 0' }}>CONTADORA:</p>
          <p style={{ color: '#a0a0a0', fontSize: '0.75rem', margin: '0 0 0.5rem 0' }}>contadora@amholding.com / pass123</p>
          <p style={{ color: '#7a7a7a', fontSize: '0.8rem', margin: '0.5rem 0 0 0' }}>ADMIN:</p>
          <p style={{ color: '#a0a0a0', fontSize: '0.75rem', margin: '0 0 0.5rem 0' }}>admin@amholding.com / admin123</p>
          <p style={{ color: '#7a7a7a', fontSize: '0.8rem', margin: '0.5rem 0 0 0' }}>GERENTE:</p>
          <p style={{ color: '#a0a0a0', fontSize: '0.75rem', margin: 0 }}>gerente.ops@amholding.com / pass123</p>
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
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button onClick={() => setCurrentView('dashboard')} style={{ padding: '0.75rem 1.5rem', backgroundColor: currentView === 'dashboard' ? '#C4A747' : '#2a2a2a', color: currentView === 'dashboard' ? '#0f0f0f' : '#a0a0a0', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>📊 Dashboard</button>
          
          {user.rol !== 'Gerente' && (
            <>
              <button onClick={() => setCurrentView('solicitudes')} style={{ padding: '0.75rem 1.5rem', backgroundColor: currentView === 'solicitudes' ? '#C4A747' : '#2a2a2a', color: currentView === 'solicitudes' ? '#0f0f0f' : '#a0a0a0', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>📋 Solicitudes</button>
              <button onClick={() => setCurrentView('finanzas')} style={{ padding: '0.75rem 1.5rem', backgroundColor: currentView === 'finanzas' ? '#C4A747' : '#2a2a2a', color: currentView === 'finanzas' ? '#0f0f0f' : '#a0a0a0', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>💰 Finanzas</button>
              <button onClick={() => setCurrentView('cuentasCobro')} style={{ padding: '0.75rem 1.5rem', backgroundColor: currentView === 'cuentasCobro' ? '#C4A747' : '#2a2a2a', color: currentView === 'cuentasCobro' ? '#0f0f0f' : '#a0a0a0', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>💳 Cuentas de Cobro</button>
            </>
          )}
          
          {(user.rol === 'Administrador') && (
            <button onClick={() => setCurrentView('responsables')} style={{ padding: '0.75rem 1.5rem', backgroundColor: currentView === 'responsables' ? '#C4A747' : '#2a2a2a', color: currentView === 'responsables' ? '#0f0f0f' : '#a0a0a0', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>👥 Colaboradores</button>
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
                <h3 style={{ color: '#C4A747', margin: '0 0 1rem 0' }}>👥 Top Colaboradores</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #C4A747' }}>
                      <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Colaborador</th>
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
                      {(user.rol === 'Administrador' || user.rol === 'Contadora') && <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Colaborador</th>}
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

              {/* REPORTES Y DESCARGAS */}
              {(isReadOnly || user?.rol === 'Administrador' || user?.rol === 'Coordinadora Administrativa') && (
                <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', marginTop: '2rem' }}>
                  <h3 style={{ color: '#C4A747', margin: '0 0 1.5rem 0' }}>📥 Reportes y Descargas</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                    <button onClick={downloadReporteFinanzas} style={{ padding: '1rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#C4A747', fontWeight: 'bold', cursor: 'pointer', textAlign: 'left' }}>
                      📊 Descargar Reporte Finanzas (CSV)
                      <p style={{ fontSize: '0.8rem', color: '#a0a0a0', margin: '0.5rem 0 0 0' }}>Gastos e Ingresos por período</p>
                    </button>
                    <button onClick={downloadReporteSolicitudes} style={{ padding: '1rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#C4A747', fontWeight: 'bold', cursor: 'pointer', textAlign: 'left' }}>
                      📋 Descargar Reporte Solicitudes (CSV)
                      <p style={{ fontSize: '0.8rem', color: '#a0a0a0', margin: '0.5rem 0 0 0' }}>Todas las solicitudes y estados</p>
                    </button>
                    <button onClick={downloadSoportesZIP} style={{ padding: '1rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#C4A747', fontWeight: 'bold', cursor: 'pointer', textAlign: 'left' }}>
                      📦 Descargar Soportes (ZIP)
                      <p style={{ fontSize: '0.8rem', color: '#a0a0a0', margin: '0.5rem 0 0 0' }}>Todos los documentos adjuntos</p>
                    </button>
                  </div>
                </div>
              )}
            )}

        {currentView === 'solicitudes' && (
          <div>
            {user.rol === 'Gerente' || user.rol === 'Contadora' ? (
              <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', textAlign: 'center' }}>
                <p style={{ color: '#ff6b6b', fontSize: '1.1rem', fontWeight: 'bold' }}>🔒 Acceso Restringido</p>
                <p style={{ color: '#a0a0a0' }}>{user.rol === 'Gerente' ? 'Los Gerentes solo pueden ver el Dashboard.' : 'Los Contadores solo tienen acceso de lectura.'}</p>
                <button onClick={() => setCurrentView('dashboard')} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginTop: '1rem' }}>Ir al Dashboard</button>
              </div>
            ) : (
              <div>
              <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', marginBottom: '2rem' }}>
                <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0' }}>➕ Nueva Solicitud</h2>
                
                {isReadOnly && (
                  <div style={{ backgroundColor: '#ffebee', border: '1px solid #ff6b6b', borderRadius: '4px', padding: '1rem', marginBottom: '1rem', color: '#c41c3b' }}>
                    <p style={{ margin: 0, fontWeight: 'bold' }}>🔒 Modo Solo Lectura</p>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>Los Contadores no pueden crear ni editar solicitudes. Solo pueden ver y descargar.</p>
                  </div>
                )}
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem', opacity: isReadOnly ? 0.5 : 1, pointerEvents: isReadOnly ? 'none' : 'auto' }}>
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

                <button onClick={handleAddSolicitud} disabled={isReadOnly} style={{ width: '100%', padding: '0.75rem', backgroundColor: isReadOnly ? '#666' : '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: isReadOnly ? 'not-allowed' : 'pointer', opacity: isReadOnly ? 0.5 : 1 }}>Guardar Solicitud</button>
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
                      {(user.rol === 'Administrador' || user.rol === 'Contadora') && <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Colaborador</th>}
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
              <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0' }}>➕ Crear Nuevo Usuario</h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#C4A747', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>Tipo de Usuario</label>
                  <select value={newUserType} onChange={(e) => setNewUserType(e.target.value)} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }}>
                    <option value="Colaborador">👥 Colaborador</option>
                    <option value="Gerente">📈 Gerente</option>
                  </select>
                </div>
                
                <input type="text" placeholder="Nombre Completo" value={newResponsable.nombre} onChange={(e) => setNewResponsable({...newResponsable, nombre: e.target.value})} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }} />
                <input type="email" placeholder="Email" value={newResponsable.email} onChange={(e) => setNewResponsable({...newResponsable, email: e.target.value})} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }} />
                <input type="password" placeholder="Contraseña" value={newResponsable.password} onChange={(e) => setNewResponsable({...newResponsable, password: e.target.value})} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }} />
                
                {newUserType === 'Colaborador' && (
                  <select value={newResponsable.empresa} onChange={(e) => setNewResponsable({...newResponsable, empresa: e.target.value})} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }}>
                    {empresas.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                  </select>
                )}
              </div>

              <button onClick={handleAddResponsable} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Crear {newUserType}</button>
            </div>

            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
              <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0' }}>👥 Colaboradores ({responsables.length})</h2>
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
                      const solicitudesColaborador = solicitudes.filter(s => s.responsableId === r.id).length;
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
                          <td style={{ padding: '0.75rem', textAlign: 'center', color: '#51cf66', fontWeight: 'bold' }}>{solicitudesColaborador}</td>
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
            )}
          </div>
        )}

        {currentView === 'finanzas' && (
          <div>
            {/* BOTÓN IMPORTAR (SOLO ADMIN) */}
            {user?.rol === 'Administrador' && (
              <div style={{ backgroundColor: '#1a1a1a', padding: '1rem', borderRadius: '4px', border: '1px solid #2a2a2a', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <button onClick={() => setMostrarImportar(true)} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#4285F4', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem' }}>
                  📥 Importar Histórico
                </button>
                <p style={{ color: '#a0a0a0', margin: 0, fontSize: '0.85rem' }}>Gastos en localStorage: {gastos.length}</p>
              </div>
            )}

            {/* DASHBOARD FINANCIERO AVANZADO */}
            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', marginBottom: '2rem' }}>
              <h2 style={{ color: '#C4A747', marginBottom: '1.5rem' }}>📈 Dashboard Financiero Avanzado</h2>
              
              {/* FILTRO DE FECHAS */}
              <div style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ display: 'block', color: '#a0a0a0', fontSize: '0.8rem', marginBottom: '0.5rem' }}>Desde</label>
                  <input type="date" value={filtroFechaInicio} onChange={(e) => setFiltroFechaInicio(e.target.value)} style={{ padding: '0.75rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#a0a0a0', cursor: 'pointer' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#a0a0a0', fontSize: '0.8rem', marginBottom: '0.5rem' }}>Hasta</label>
                  <input type="date" value={filtroFechaFin} onChange={(e) => setFiltroFechaFin(e.target.value)} style={{ padding: '0.75rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#a0a0a0', cursor: 'pointer' }} />
                </div>
                <button onClick={() => { setFiltroFechaInicio('2026-01-01'); setFiltroFechaFin(new Date().toISOString().split('T')[0]); }} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#2a2a2a', color: '#a0a0a0', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                  🔄 Reiniciar
                </button>
              </div>

              {/* CARDS RESUMEN */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '1.5rem' }}>
                  <p style={{ color: '#a0a0a0', margin: '0 0 0.5rem 0', fontSize: '0.85rem' }}>💰 Ingresos</p>
                  <h3 style={{ color: '#51cf66', margin: 0, fontSize: '2rem' }}>$ {ingresosFiltradomat.reduce((sum, i) => sum + (parseFloat(i.valor) || 0), 0).toLocaleString()}</h3>
                </div>
                <div style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '1.5rem' }}>
                  <p style={{ color: '#a0a0a0', margin: '0 0 0.5rem 0', fontSize: '0.85rem' }}>💸 Gastos</p>
                  <h3 style={{ color: '#ff6b6b', margin: 0, fontSize: '2rem' }}>$ {gastosFiltradomat.reduce((sum, g) => sum + (parseFloat(g.valor) || 0), 0).toLocaleString()}</h3>
                </div>
                <div style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '1.5rem' }}>
                  <p style={{ color: '#a0a0a0', margin: '0 0 0.5rem 0', fontSize: '0.85rem' }}>📊 Balance</p>
                  <h3 style={{ color: (ingresosFiltradomat.reduce((sum, i) => sum + (parseFloat(i.valor) || 0), 0) - gastosFiltradomat.reduce((sum, g) => sum + (parseFloat(g.valor) || 0), 0)) >= 0 ? '#51cf66' : '#ff6b6b', margin: 0, fontSize: '2rem' }}>$ {(ingresosFiltradomat.reduce((sum, i) => sum + (parseFloat(i.valor) || 0), 0) - gastosFiltradomat.reduce((sum, g) => sum + (parseFloat(g.valor) || 0), 0)).toLocaleString()}</h3>
                </div>
              </div>

              {/* GRÁFICO GASTOS VS INGRESOS POR MES */}
              {datosPorMes.length > 0 && (
                <div style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '1.5rem', marginBottom: '2rem' }}>
                  <h3 style={{ color: '#C4A747', margin: '0 0 1.5rem 0' }}>Gastos vs Ingresos por Mes</h3>
                  <svg width="100%" height="300" viewBox="0 0 800 300" style={{ backgroundColor: 'transparent' }}>
                    {/* Grid */}
                    {[0, 1, 2, 3, 4].map(i => (
                      <line key={`grid-${i}`} x1="60" y1={50 + i * 50} x2="750" y2={50 + i * 50} stroke="#2a2a2a" strokeWidth="1" strokeDasharray="5,5" />
                    ))}
                    
                    {/* Barras */}
                    {datosPorMes.map((mes, idx) => {
                      const maxVal = Math.max(...datosPorMes.map(m => Math.max(m.gastos, m.ingresos))) || 1;
                      const x = 60 + (idx * 700 / datosPorMes.length);
                      const barWidth = 700 / datosPorMes.length / 2.5;
                      const gastosHeight = (mes.gastos / maxVal) * 200;
                      const ingresosHeight = (mes.ingresos / maxVal) * 200;
                      
                      return (
                        <g key={`mes-${idx}`}>
                          {/* Gasto */}
                          <rect x={x} y={250 - gastosHeight} width={barWidth} height={gastosHeight} fill="#ff6b6b" opacity="0.8" />
                          {/* Ingreso */}
                          <rect x={x + barWidth + 5} y={250 - ingresosHeight} width={barWidth} height={ingresosHeight} fill="#51cf66" opacity="0.8" />
                          {/* Label */}
                          <text x={x + barWidth} y="280" textAnchor="middle" fill="#a0a0a0" fontSize="12">{mes.mes.split('-')[1]}</text>
                        </g>
                      );
                    })}
                    
                    {/* Ejes */}
                    <line x1="60" y1="50" x2="60" y2="250" stroke="#2a2a2a" strokeWidth="2" />
                    <line x1="60" y1="250" x2="750" y2="250" stroke="#2a2a2a" strokeWidth="2" />
                  </svg>
                  <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', marginTop: '1rem', fontSize: '0.85rem' }}>
                    <div><span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#ff6b6b', marginRight: '0.5rem' }}></span><span style={{ color: '#a0a0a0' }}>Gastos</span></div>
                    <div><span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#51cf66', marginRight: '0.5rem' }}></span><span style={{ color: '#a0a0a0' }}>Ingresos</span></div>
                  </div>
                </div>
              )}

              {/* GRÁFICOS TOP CECOs Y TOP EMPRESAS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                {topCecos.length > 0 && (
                  <div style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '1.5rem' }}>
                    <h3 style={{ color: '#C4A747', margin: '0 0 1.5rem 0' }}>🏆 Top 5 CECOs</h3>
                    <svg width="100%" height="250" viewBox="0 0 200 200" style={{ backgroundColor: 'transparent' }}>
                      {(() => {
                        const total = topCecos.reduce((sum, c) => sum + c.value, 0);
                        let angle = -90;
                        const cx = 100, cy = 100, r = 70;
                        const COLORS = ['#C4A747', '#ff6b6b', '#51cf66', '#4285F4', '#ffd43b'];
                        
                        return topCecos.map((ceco, idx) => {
                          const sliceAngle = (ceco.value / total) * 360;
                          const startAngle = angle * Math.PI / 180;
                          const endAngle = (angle + sliceAngle) * Math.PI / 180;
                          
                          const x1 = cx + r * Math.cos(startAngle);
                          const y1 = cy + r * Math.sin(startAngle);
                          const x2 = cx + r * Math.cos(endAngle);
                          const y2 = cy + r * Math.sin(endAngle);
                          
                          const largeArc = sliceAngle > 180 ? 1 : 0;
                          const pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                          
                          angle += sliceAngle;
                          
                          return <path key={`slice-${idx}`} d={pathData} fill={COLORS[idx % COLORS.length]} opacity="0.8" />;
                        });
                      })()}
                    </svg>
                    <div style={{ marginTop: '1rem', fontSize: '0.8rem' }}>
                      {topCecos.map((ceco, idx) => (
                        <div key={idx} style={{ color: '#a0a0a0', marginBottom: '0.5rem' }}>
                          <span style={{ display: 'inline-block', width: '10px', height: '10px', backgroundColor: ['#C4A747', '#ff6b6b', '#51cf66', '#4285F4', '#ffd43b'][idx % 5], marginRight: '0.5rem' }}></span>
                          {ceco.name}: ${(ceco.value / 1000000).toFixed(1)}M
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {topEmpresas.length > 0 && (
                  <div style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '1.5rem' }}>
                    <h3 style={{ color: '#C4A747', margin: '0 0 1.5rem 0' }}>🏢 Top 5 Empresas</h3>
                    <svg width="100%" height="250" viewBox="0 0 200 200" style={{ backgroundColor: 'transparent' }}>
                      {(() => {
                        const total = topEmpresas.reduce((sum, e) => sum + e.value, 0);
                        let angle = -90;
                        const cx = 100, cy = 100, r = 70;
                        const COLORS = ['#C4A747', '#ff6b6b', '#51cf66', '#4285F4', '#ffd43b'];
                        
                        return topEmpresas.map((empresa, idx) => {
                          const sliceAngle = (empresa.value / total) * 360;
                          const startAngle = angle * Math.PI / 180;
                          const endAngle = (angle + sliceAngle) * Math.PI / 180;
                          
                          const x1 = cx + r * Math.cos(startAngle);
                          const y1 = cy + r * Math.sin(startAngle);
                          const x2 = cx + r * Math.cos(endAngle);
                          const y2 = cy + r * Math.sin(endAngle);
                          
                          const largeArc = sliceAngle > 180 ? 1 : 0;
                          const pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                          
                          angle += sliceAngle;
                          
                          return <path key={`slice-${idx}`} d={pathData} fill={COLORS[idx % COLORS.length]} opacity="0.8" />;
                        });
                      })()}
                    </svg>
                    <div style={{ marginTop: '1rem', fontSize: '0.8rem' }}>
                      {topEmpresas.map((empresa, idx) => (
                        <div key={idx} style={{ color: '#a0a0a0', marginBottom: '0.5rem' }}>
                          <span style={{ display: 'inline-block', width: '10px', height: '10px', backgroundColor: ['#C4A747', '#ff6b6b', '#51cf66', '#4285F4', '#ffd43b'][idx % 5], marginRight: '0.5rem' }}></span>
                          {empresa.name}: ${(empresa.value / 1000000).toFixed(1)}M
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* NUEVA TRANSACCIÓN */}
            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', marginBottom: '2rem' }}>
              <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0' }}>➕ Nuevo Gasto/Ingreso</h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ color: '#C4A747', fontWeight: 'bold', fontSize: '0.85rem' }}>Tipo</label>
                  <select value={newGasto.tipo} onChange={(e) => {setNewGasto({...newGasto, tipo: e.target.value}); setNewIngreso({...newIngreso, tipo: e.target.value});}} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box', marginTop: '0.5rem' }}>
                    <option value="Gasto">💸 Gasto</option>
                    <option value="Ingreso">💰 Ingreso</option>
                    <option value="Traslado">🔄 Traslado</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: '#C4A747', fontWeight: 'bold', fontSize: '0.85rem' }}>Fecha</label>
                  <input type="date" value={newGasto.fecha} onChange={(e) => {setNewGasto({...newGasto, fecha: e.target.value}); setNewIngreso({...newIngreso, fecha: e.target.value});}} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box', marginTop: '0.5rem' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ color: '#C4A747', fontWeight: 'bold', fontSize: '0.85rem' }}>Empresa</label>
                  <select value={newGasto.empresa} onChange={(e) => {setNewGasto({...newGasto, empresa: e.target.value, cuenta: ''}); setNewIngreso({...newIngreso, empresa: e.target.value});}} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box', marginTop: '0.5rem' }}>
                    {empresas.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                  </select>
                </div>
                
                {newGasto.tipo === 'Traslado' ? (
                  <>
                    <div>
                      <label style={{ color: '#C4A747', fontWeight: 'bold', fontSize: '0.85rem' }}>Cuenta Salida</label>
                      <select value={newGasto.cuentaSalida} onChange={(e) => setNewGasto({...newGasto, cuentaSalida: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box', marginTop: '0.5rem' }}>
                        <option value="">Seleccionar</option>
                        {(cuentasPorEmpresa[newGasto.empresa] || []).map(cuenta => <option key={cuenta} value={cuenta}>{cuenta}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ color: '#C4A747', fontWeight: 'bold', fontSize: '0.85rem' }}>Cuenta Destino</label>
                      <select value={newGasto.cuentaDestino} onChange={(e) => setNewGasto({...newGasto, cuentaDestino: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box', marginTop: '0.5rem' }}>
                        <option value="">Seleccionar</option>
                        {empresas.map(emp => (
                          <optgroup key={emp} label={emp}>
                            {(cuentasPorEmpresa[emp] || []).map(cuenta => <option key={`${emp}-${cuenta}`} value={`${emp}: ${cuenta}`}>{cuenta}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label style={{ color: '#C4A747', fontWeight: 'bold', fontSize: '0.85rem' }}>Cuenta</label>
                      <select value={newGasto.cuenta} onChange={(e) => setNewGasto({...newGasto, cuenta: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box', marginTop: '0.5rem' }}>
                        <option value="">Seleccionar</option>
                        {(cuentasPorEmpresa[newGasto.empresa] || []).map(cuenta => <option key={cuenta} value={cuenta}>{cuenta}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ color: '#C4A747', fontWeight: 'bold', fontSize: '0.85rem' }}>Colaborador</label>
                      <select value={newGasto.responsable} onChange={(e) => {setNewGasto({...newGasto, responsable: e.target.value}); setNewIngreso({...newIngreso, responsable: e.target.value});}} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box', marginTop: '0.5rem' }}>
                        <option value="">Seleccionar</option>
                        {responsables.map(r => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
                      </select>
                    </div>
                  </>
                )}
                
                {newGasto.tipo === 'Gasto' && (
                  <div>
                    <label style={{ color: '#C4A747', fontWeight: 'bold', fontSize: '0.85rem' }}>Centro de Costo</label>
                    <select value={newGasto.ceco} onChange={(e) => setNewGasto({...newGasto, ceco: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box', marginTop: '0.5rem' }}>
                      {cecos.map(c => <option key={c.codigo} value={c.codigo}>{c.nombre}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <input type="text" placeholder="Detalle/Descripción" value={newGasto.detalle} onChange={(e) => {setNewGasto({...newGasto, detalle: e.target.value}); setNewIngreso({...newIngreso, detalle: e.target.value});}} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <input type="number" placeholder="Valor" value={newGasto.valor} onChange={(e) => {setNewGasto({...newGasto, valor: e.target.value}); setNewIngreso({...newIngreso, valor: e.target.value});}} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }} />
                <select value={newGasto.categoria} onChange={(e) => {setNewGasto({...newGasto, categoria: e.target.value}); setNewIngreso({...newIngreso, categoria: e.target.value});}} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }}>
                  <option value="">Categoría</option>
                  {categorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              <input type="text" placeholder="Observaciones" value={newGasto.observaciones} onChange={(e) => {setNewGasto({...newGasto, observaciones: e.target.value}); setNewIngreso({...newIngreso, observaciones: e.target.value});}} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }} />

              {/* CARGA DE SOPORTES */}
              <div style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '1rem', marginBottom: '1rem' }}>
                <label style={{ color: '#C4A747', fontWeight: 'bold', fontSize: '0.85rem' }}>📎 Soportes (Archivos)</label>
                <input type="file" multiple onChange={handleAddSoporte} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#a0a0a0', marginTop: '0.5rem', marginBottom: '1rem', boxSizing: 'border-box', cursor: 'pointer' }} />
                
                {soportesTemp.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <p style={{ color: '#a0a0a0', margin: '0 0 0.5rem 0', fontSize: '0.8rem' }}>Archivos cargados: {soportesTemp.length}</p>
                    {soportesTemp.map(soporte => (
                      <div key={soporte.id} style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '0.75rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ color: '#C4A747', margin: '0 0 0.25rem 0', fontSize: '0.8rem', fontWeight: 'bold' }}>{soporte.nombre}</p>
                          <p style={{ color: '#a0a0a0', margin: 0, fontSize: '0.75rem' }}>{(soporte.tamaño / 1024).toFixed(2)} KB</p>
                        </div>
                        <button onClick={() => handleRemoveSoporte(soporte.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff6b6b', fontSize: '1rem', padding: '0.5rem' }}>🗑️</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={newGasto.tipo === 'Gasto' ? handleAddGasto : (newGasto.tipo === 'Traslado' ? handleAddGasto : handleAddIngreso)} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                Registrar {newGasto.tipo === 'Traslado' ? 'Traslado' : (newGasto.tipo === 'Ingreso' ? 'Ingreso' : 'Gasto')}
              </button>
            </div>

            {/* TABLA GASTOS */}
            {newGasto.tipo === 'Gasto' && (
              <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', marginBottom: '2rem' }}>
                <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0' }}>💸 Gastos Registrados ({gastosUsuario.filter(g => g.tipo === 'Gasto').length})</h2>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead style={{ backgroundColor: '#0f0f0f' }}>
                      <tr style={{ borderBottom: '2px solid #C4A747' }}>
                        <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Fecha</th>
                        {user.rol === 'Administrador' && <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Colaborador</th>}
                        <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Empresa</th>
                        <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>CECO</th>
                        <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Cuenta</th>
                        <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Detalle</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', color: '#C4A747' }}>Valor</th>
                        <th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>Soportes</th>
                        <th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>Estado</th>
                        {user.rol === 'Administrador' && <th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>Acción</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {gastosUsuario.filter(g => g.tipo === 'Gasto').map(g => (
                        <tr key={g.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                          <td style={{ padding: '0.75rem', color: '#a0a0a0', fontSize: '0.8rem' }}>{g.fecha}</td>
                          {user.rol === 'Administrador' && <td style={{ padding: '0.75rem', color: '#a0a0a0', fontSize: '0.8rem' }}>{g.responsableNombre}</td>}
                          <td style={{ padding: '0.75rem', color: '#a0a0a0', fontSize: '0.8rem' }}>{g.empresa}</td>
                          <td style={{ padding: '0.75rem', color: '#C4A747', fontWeight: 'bold', fontSize: '0.8rem' }}>{g.ceco}</td>
                          <td style={{ padding: '0.75rem', color: '#a0a0a0', fontSize: '0.8rem' }}>{g.cuenta}</td>
                          <td style={{ padding: '0.75rem', color: '#a0a0a0' }}>{g.detalle}</td>
                          <td style={{ padding: '0.75rem', color: '#ff6b6b', textAlign: 'right', fontWeight: 'bold' }}>$ {parseFloat(g.valor).toLocaleString()}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            {g.soportes && g.soportes.length > 0 ? (
                              <button onClick={() => handleViewSoportes(g.soportes)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#51cf66', fontSize: '1rem' }}>📎 {g.soportes.length}</button>
                            ) : (
                              <span style={{ color: '#a0a0a0', fontSize: '0.8rem' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            {user.rol === 'Administrador' ? (
                              <select value={g.estado} onChange={(e) => handleUpdateGasto(g.id, 'estado', e.target.value)} style={{ backgroundColor: getColorEstado(g.estado), color: '#0f0f0f', border: 'none', padding: '0.4rem 0.6rem', borderRadius: '3px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>
                                {estadosSolicitud.map(e => <option key={e} value={e}>{e}</option>)}
                              </select>
                            ) : (
                              <span style={{ backgroundColor: getColorEstado(g.estado), color: '#0f0f0f', padding: '0.4rem 0.8rem', borderRadius: '3px', fontWeight: 'bold', fontSize: '0.8rem' }}>{g.estado}</span>
                            )}
                          </td>
                          {user.rol === 'Administrador' && (
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                              <button onClick={() => handleDeleteGasto(g.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff6b6b', fontSize: '1rem' }}>🗑️</button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TABLA TRASLADOS */}
            {newGasto.tipo === 'Traslado' && (
              <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', marginBottom: '2rem' }}>
                <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0' }}>🔄 Traslados Registrados ({gastosUsuario.filter(g => g.tipo === 'Traslado').length})</h2>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead style={{ backgroundColor: '#0f0f0f' }}>
                      <tr style={{ borderBottom: '2px solid #C4A747' }}>
                        <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Fecha</th>
                        {user.rol === 'Administrador' && <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Colaborador</th>}
                        <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Cuenta Salida</th>
                        <th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>→</th>
                        <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Cuenta Destino</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', color: '#C4A747' }}>Valor</th>
                        <th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>Soportes</th>
                        <th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>Estado</th>
                        {user.rol === 'Administrador' && <th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>Acción</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {gastosUsuario.filter(g => g.tipo === 'Traslado').map(g => (
                        <tr key={g.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                          <td style={{ padding: '0.75rem', color: '#a0a0a0', fontSize: '0.8rem' }}>{g.fecha}</td>
                          {user.rol === 'Administrador' && <td style={{ padding: '0.75rem', color: '#a0a0a0', fontSize: '0.8rem' }}>{g.responsableNombre}</td>}
                          <td style={{ padding: '0.75rem', color: '#51cf66', fontWeight: 'bold', fontSize: '0.8rem' }}>{g.cuentaSalida}</td>
                          <td style={{ padding: '0.75rem', color: '#C4A747', textAlign: 'center', fontWeight: 'bold' }}>→</td>
                          <td style={{ padding: '0.75rem', color: '#ff6b6b', fontWeight: 'bold', fontSize: '0.8rem' }}>{g.cuentaDestino}</td>
                          <td style={{ padding: '0.75rem', color: '#C4A747', textAlign: 'right', fontWeight: 'bold' }}>$ {parseFloat(g.valor).toLocaleString()}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            {g.soportes && g.soportes.length > 0 ? (
                              <button onClick={() => handleViewSoportes(g.soportes)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#51cf66', fontSize: '1rem' }}>📎 {g.soportes.length}</button>
                            ) : (
                              <span style={{ color: '#a0a0a0', fontSize: '0.8rem' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            {user.rol === 'Administrador' ? (
                              <select value={g.estado} onChange={(e) => handleUpdateGasto(g.id, 'estado', e.target.value)} style={{ backgroundColor: getColorEstado(g.estado), color: '#0f0f0f', border: 'none', padding: '0.4rem 0.6rem', borderRadius: '3px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>
                                {estadosSolicitud.map(e => <option key={e} value={e}>{e}</option>)}
                              </select>
                            ) : (
                              <span style={{ backgroundColor: getColorEstado(g.estado), color: '#0f0f0f', padding: '0.4rem 0.8rem', borderRadius: '3px', fontWeight: 'bold', fontSize: '0.8rem' }}>{g.estado}</span>
                            )}
                          </td>
                          {user.rol === 'Administrador' && (
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                              <button onClick={() => handleDeleteGasto(g.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff6b6b', fontSize: '1rem' }}>🗑️</button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TABLA INGRESOS */}
            {newGasto.tipo === 'Ingreso' && (
              <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
                <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0' }}>💰 Ingresos Registrados ({ingresosUsuario.length})</h2>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead style={{ backgroundColor: '#0f0f0f' }}>
                      <tr style={{ borderBottom: '2px solid #C4A747' }}>
                        <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Fecha</th>
                        {user.rol === 'Administrador' && <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Colaborador</th>}
                        <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Empresa</th>
                        <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Cuenta</th>
                        <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Detalle</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', color: '#C4A747' }}>Valor</th>
                        <th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>Soportes</th>
                        <th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>Estado</th>
                        {user.rol === 'Administrador' && <th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>Acción</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {ingresosUsuario.map(i => (
                        <tr key={i.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                          <td style={{ padding: '0.75rem', color: '#a0a0a0', fontSize: '0.8rem' }}>{i.fecha}</td>
                          {user.rol === 'Administrador' && <td style={{ padding: '0.75rem', color: '#a0a0a0', fontSize: '0.8rem' }}>{i.responsableNombre}</td>}
                          <td style={{ padding: '0.75rem', color: '#a0a0a0', fontSize: '0.8rem' }}>{i.empresa}</td>
                          <td style={{ padding: '0.75rem', color: '#a0a0a0', fontSize: '0.8rem' }}>{i.cuenta}</td>
                          <td style={{ padding: '0.75rem', color: '#a0a0a0' }}>{i.detalle}</td>
                          <td style={{ padding: '0.75rem', color: '#51cf66', textAlign: 'right', fontWeight: 'bold' }}>$ {parseFloat(i.valor).toLocaleString()}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            {i.soportes && i.soportes.length > 0 ? (
                              <button onClick={() => handleViewSoportes(i.soportes)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#51cf66', fontSize: '1rem' }}>📎 {i.soportes.length}</button>
                            ) : (
                              <span style={{ color: '#a0a0a0', fontSize: '0.8rem' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <span style={{ backgroundColor: getColorEstado(i.estado), color: '#0f0f0f', padding: '0.4rem 0.8rem', borderRadius: '3px', fontWeight: 'bold', fontSize: '0.8rem' }}>{i.estado}</span>
                          </td>
                          {user.rol === 'Administrador' && (
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                              <button onClick={() => handleDeleteIngreso(i.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff6b6b', fontSize: '1rem' }}>🗑️</button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {currentView === 'cuentasCobro' && user.rol !== 'Gerente' && user.rol !== 'Contadora' && (
          <div>
            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', marginBottom: '2rem' }}>
              <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0' }}>➕ Nueva Cuenta de Cobro</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <input type="date" value={newCuentaCobro.fecha} onChange={(e) => setNewCuentaCobro({...newCuentaCobro, fecha: e.target.value})} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }} />
                <input type="text" placeholder="Número de Cuenta" value={newCuentaCobro.numero} onChange={(e) => setNewCuentaCobro({...newCuentaCobro, numero: e.target.value})} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }} />
                <select value={newCuentaCobro.responsable} onChange={(e) => setNewCuentaCobro({...newCuentaCobro, responsable: e.target.value})} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }}>
                  <option value="">Colaborador</option>
                  {responsables.map(r => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
                </select>
                <select value={newCuentaCobro.empresa} onChange={(e) => setNewCuentaCobro({...newCuentaCobro, empresa: e.target.value})} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }}>
                  <option value="">Empresa</option>
                  {empresas.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <input type="number" placeholder="Monto" value={newCuentaCobro.monto} onChange={(e) => setNewCuentaCobro({...newCuentaCobro, monto: e.target.value})} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }} />
                <input type="text" placeholder="Concepto" value={newCuentaCobro.concepto} onChange={(e) => setNewCuentaCobro({...newCuentaCobro, concepto: e.target.value})} style={{ padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }} />
              </div>
              <input type="url" placeholder="Link Carpeta Drive (Ej: https://drive.google.com/...)" value={newCuentaCobro.driveLink} onChange={(e) => setNewCuentaCobro({...newCuentaCobro, driveLink: e.target.value})} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }} />
              <button onClick={handleAddCuentaCobro} disabled={isReadOnly} style={{ width: '100%', padding: '0.75rem', backgroundColor: isReadOnly ? '#666' : '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: isReadOnly ? 'not-allowed' : 'pointer', opacity: isReadOnly ? 0.5 : 1 }}>Crear Cuenta de Cobro</button>
            </div>

            <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
              <h2 style={{ color: '#C4A747', margin: '0 0 1.5rem 0' }}>💳 Cuentas de Cobro ({cuentasCobroUsuario.length})</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead style={{ backgroundColor: '#0f0f0f' }}>
                    <tr style={{ borderBottom: '2px solid #C4A747' }}>
                      <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Fecha</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Número</th>
                      {user.rol === 'Administrador' && <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Colaborador</th>}
                      <th style={{ textAlign: 'left', padding: '0.75rem', color: '#C4A747' }}>Empresa</th>
                      <th style={{ textAlign: 'right', padding: '0.75rem', color: '#C4A747' }}>Monto</th>
                      <th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>Estado</th>
                      <th style={{ textAlign: 'center', padding: '0.75rem', color: '#C4A747' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuentasCobroUsuario.map(c => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                        <td style={{ padding: '0.75rem', color: '#a0a0a0', fontSize: '0.8rem' }}>{c.fecha}</td>
                        <td style={{ padding: '0.75rem', color: '#C4A747', fontWeight: 'bold' }}>{c.numero}</td>
                        {user.rol === 'Administrador' && <td style={{ padding: '0.75rem', color: '#a0a0a0', fontSize: '0.8rem' }}>{c.responsableNombre}</td>}
                        <td style={{ padding: '0.75rem', color: '#a0a0a0', fontSize: '0.8rem' }}>{c.empresa}</td>
                        <td style={{ padding: '0.75rem', color: '#51cf66', textAlign: 'right', fontWeight: 'bold' }}>$ {parseFloat(c.monto).toLocaleString()}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          {user.rol === 'Administrador' ? (
                            <select value={c.estado} onChange={(e) => handleUpdateCuentaCobro(c.id, 'estado', e.target.value)} disabled={isReadOnly || user.rol !== 'Administrador'} style={{ backgroundColor: getColorEstado(c.estado), color: '#0f0f0f', border: 'none', padding: '0.4rem 0.6rem', borderRadius: '3px', fontWeight: 'bold', cursor: isReadOnly || user.rol !== 'Administrador' ? 'not-allowed' : 'pointer', fontSize: '0.8rem', opacity: isReadOnly || user.rol !== 'Administrador' ? 0.6 : 1 }}>
                              {estadosSolicitud.map(e => <option key={e} value={e}>{e}</option>)}
                            </select>
                          ) : (
                            <span style={{ backgroundColor: getColorEstado(c.estado), color: '#0f0f0f', padding: '0.4rem 0.8rem', borderRadius: '3px', fontWeight: 'bold', fontSize: '0.8rem' }}>{c.estado}</span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          {c.driveLink && (
                            <a href={c.driveLink} target="_blank" rel="noopener noreferrer" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#748ffc', fontSize: '1rem', marginRight: '0.5rem', textDecoration: 'none' }} title="Abrir Drive">
                              ☁️
                            </a>
                          )}
                          {user.rol === 'Administrador' && (
                            <button onClick={() => handleDeleteCuentaCobro(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff6b6b', fontSize: '1rem' }} title="Eliminar">
                              🗑️
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {cuentasCobroUsuario.length === 0 && (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#a0a0a0' }}>
                    Sin cuentas de cobro registradas
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {currentView === 'cuentasCobro' && (user.rol === 'Gerente' || user.rol === 'Contadora') && (
          <div style={{ backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '4px', border: '1px solid #2a2a2a', textAlign: 'center' }}>
            <p style={{ color: '#ff6b6b', fontSize: '1.1rem', fontWeight: 'bold' }}>🔒 Acceso Restringido</p>
            <p style={{ color: '#a0a0a0' }}>{user.rol === 'Gerente' ? 'Los Gerentes solo pueden ver el Dashboard.' : 'Los Contadores solo tienen acceso de lectura.'}</p>
            <button onClick={() => setCurrentView('dashboard')} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginTop: '1rem' }}>Ir al Dashboard</button>
          </div>
        )}

        {/* MODAL IMPORTAR HISTÓRICO */}
        {mostrarImportar && (
          <div style={{ position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: '9999' }}>
            <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '2rem', maxWidth: '500px', width: '90%' }}>
              <h2 style={{ color: '#C4A747', marginBottom: '1.5rem' }}>📥 Importar Histórico de Gastos</h2>
              
              <div style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <p style={{ color: '#a0a0a0', margin: '0 0 1rem 0', fontSize: '0.9rem' }}>
                  ⚠️ Esto agregará todos los registros del archivo JSON al histórico.
                </p>
                <p style={{ color: '#a0a0a0', margin: '0 0 1rem 0', fontSize: '0.9rem' }}>
                  Registros actuales: <strong style={{ color: '#C4A747' }}>{gastos.length}</strong>
                </p>
                
                <label style={{ display: 'block', marginBottom: '1rem' }}>
                  <input 
                    type="file" 
                    accept=".json"
                    onChange={handleImportarGastos}
                    style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#a0a0a0', cursor: 'pointer' }}
                  />
                </label>
                
                <p style={{ color: '#a0a0a0', margin: 0, fontSize: '0.8rem' }}>
                  📄 Carga el archivo <code style={{ color: '#C4A747' }}>gastos_importar.json</code> generado desde DBAMHolding
                </p>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={() => setMostrarImportar(false)} style={{ flex: 1, padding: '0.75rem', backgroundColor: '#2a2a2a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL VER SOPORTES */}
        {verSoportes && (
          <div style={{ position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: '9999' }}>
            <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '2rem', maxWidth: '500px', width: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
              <h2 style={{ color: '#C4A747', marginBottom: '1.5rem' }}>📎 Soportes</h2>
              
              {verSoportes.length === 0 ? (
                <p style={{ color: '#a0a0a0', textAlign: 'center' }}>No hay soportes adjuntos</p>
              ) : (
                verSoportes.map((soporte, idx) => (
                  <div key={idx} style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '1rem', marginBottom: '1rem' }}>
                    <p style={{ color: '#C4A747', fontWeight: 'bold', margin: '0 0 0.5rem 0' }}>📄 {soporte.nombre}</p>
                    <p style={{ color: '#a0a0a0', fontSize: '0.8rem', margin: '0 0 1rem 0' }}>{(soporte.tamaño / 1024).toFixed(2)} KB</p>
                    <button onClick={() => handleDownloadSoporte(soporte)} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#C4A747', color: '#0f0f0f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
                      ⬇️ Descargar
                    </button>
                  </div>
                ))
              )}
              
              <button onClick={() => setVerSoportes(null)} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#2a2a2a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginTop: '1rem' }}>
                Cerrar
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
