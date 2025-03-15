const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');

// Función para generar un nombre de archivo único
const generateFileName = (prefix, extension) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}-${timestamp}.${extension}`;
};

// Exportar datos a Excel
const exportToExcel = async (data, columns, sheetName = 'Datos', fileName = null) => {
  try {
    // Crear un nuevo libro de Excel
    const workbook = new ExcelJS.Workbook();
    
    // Agregar una hoja
    const worksheet = workbook.addWorksheet(sheetName);
    
    // Establecer encabezados
    worksheet.columns = columns.map(col => ({
      header: col.header,
      key: col.key,
      width: col.width || 20
    }));
    
    // Estilo para encabezados
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'DDEBF7' }
    };
    
    // Agregar datos
    if (Array.isArray(data)) {
      worksheet.addRows(data);
    }
    
    // Generar nombre de archivo si no se proporcionó
    const outputFileName = fileName || generateFileName('export', 'xlsx');
    const filePath = path.join(__dirname, '..', '..', 'uploads', outputFileName);
    
    // Guardar el archivo
    await workbook.xlsx.writeFile(filePath);
    
    return {
      fileName: outputFileName,
      filePath: `/uploads/${outputFileName}`,
      fullPath: filePath
    };
  } catch (error) {
    console.error('Error al exportar a Excel:', error);
    throw error;
  }
};

// Exportar datos a PDF
const exportToPDF = async (data, columns, title = 'Reporte', fileName = null) => {
  try {
    // Generar nombre de archivo si no se proporcionó
    const outputFileName = fileName || generateFileName('report', 'pdf');
    const filePath = path.join(__dirname, '..', '..', 'uploads', outputFileName);
    
    // Crear un nuevo documento PDF
    const doc = new PDFDocument({ margin: 50 });
    
    // Crear un stream para escribir el archivo
    const writeStream = fs.createWriteStream(filePath);
    
    // Pipe el PDF al stream
    doc.pipe(writeStream);
    
    // Agregar título
    doc.fontSize(16).text(title, { align: 'center' });
    doc.moveDown();
    
    // Configuración de la tabla
    const tableTop = 150;
    const tableLeft = 50;
    let rowTop = tableTop;
    
    // Calcular ancho de columna basado en el ancho de página
    const pageWidth = doc.page.width - 100;
    const colWidths = columns.map(col => col.width || (pageWidth / columns.length));
    
    // Dibujar encabezados
    doc.fontSize(10).font('Helvetica-Bold');
    columns.forEach((col, i) => {
      let offset = 0;
      for (let j = 0; j < i; j++) {
        offset += colWidths[j];
      }
      
      doc.text(col.header, tableLeft + offset, rowTop, {
        width: colWidths[i],
        align: 'left'
      });
    });
    
    // Línea después de encabezados
    rowTop += 20;
    doc.moveTo(tableLeft, rowTop).lineTo(tableLeft + pageWidth, rowTop).stroke();
    rowTop += 10;
    
    // Dibujar filas de datos
    doc.font('Helvetica');
    if (Array.isArray(data)) {
      data.forEach(item => {
        // Comprobar si necesitamos una nueva página
        if (rowTop > doc.page.height - 100) {
          doc.addPage();
          rowTop = 100;
        }
        
        columns.forEach((col, i) => {
          let offset = 0;
          for (let j = 0; j < i; j++) {
            offset += colWidths[j];
          }
          
          const value = item[col.key] ? item[col.key].toString() : '';
          
          doc.text(value, tableLeft + offset, rowTop, {
            width: colWidths[i],
            align: 'left'
          });
        });
        
        rowTop += 20;
      });
    }
    
    // Finalizar el documento
    doc.end();
    
    // Devolver una promesa que se resuelve cuando el archivo se ha escrito
    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => {
        resolve({
          fileName: outputFileName,
          filePath: `/uploads/${outputFileName}`,
          fullPath: filePath
        });
      });
      
      writeStream.on('error', reject);
    });
  } catch (error) {
    console.error('Error al exportar a PDF:', error);
    throw error;
  }
};

// Exportar proyectos
const exportProjects = async (projects, format = 'excel') => {
  try {
    const columns = [
      { header: 'Nombre', key: 'name', width: 30 },
      { header: 'Descripción', key: 'description', width: 40 },
      { header: 'Fecha de inicio', key: 'startDate', width: 15 },
      { header: 'Fecha de fin', key: 'endDate', width: 15 },
      { header: 'Estado', key: 'status', width: 15 },
      { header: 'Prioridad', key: 'priority', width: 15 },
      { header: 'Progreso', key: 'progress', width: 15 }
    ];
    
    // Formatear datos de proyectos
    const formattedData = projects.map(project => ({
      name: project.name,
      description: project.description,
      startDate: new Date(project.startDate).toLocaleDateString('es-ES'),
      endDate: new Date(project.endDate).toLocaleDateString('es-ES'),
      status: project.status,
      priority: project.priority,
      progress: `${project.progress}%`
    }));
    
    if (format === 'excel') {
      return await exportToExcel(formattedData, columns, 'Proyectos', 'proyectos.xlsx');
    } else if (format === 'pdf') {
      return await exportToPDF(formattedData, columns, 'Reporte de Proyectos', 'proyectos.pdf');
    } else {
      throw new Error('Formato de exportación no soportado');
    }
  } catch (error) {
    console.error('Error al exportar proyectos:', error);
    throw error;
  }
};

// Exportar tareas
const exportTasks = async (tasks, format = 'excel') => {
  try {
    const columns = [
      { header: 'Título', key: 'title', width: 30 },
      { header: 'Descripción', key: 'description', width: 40 },
      { header: 'Proyecto', key: 'project', width: 25 },
      { header: 'Asignado a', key: 'assignedTo', width: 25 },
      { header: 'Estado', key: 'status', width: 15 },
      { header: 'Prioridad', key: 'priority', width: 15 },
      { header: 'Fecha límite', key: 'dueDate', width: 15 },
      { header: 'Creado por', key: 'createdBy', width: 25 }
    ];
    
    // Formatear datos de tareas
    const formattedData = tasks.map(task => ({
      title: task.title,
      description: task.description,
      project: task.project?.name || 'N/A',
      assignedTo: task.assignedTo?.map(user => `${user.firstName} ${user.lastName}`).join(', ') || 'Sin asignar',
      status: task.status,
      priority: task.priority,
      dueDate: new Date(task.dueDate).toLocaleDateString('es-ES'),
      createdBy: task.createdBy ? `${task.createdBy.firstName} ${task.createdBy.lastName}` : 'N/A'
    }));
    
    if (format === 'excel') {
      return await exportToExcel(formattedData, columns, 'Tareas', 'tareas.xlsx');
    } else if (format === 'pdf') {
      return await exportToPDF(formattedData, columns, 'Reporte de Tareas', 'tareas.pdf');
    } else {
      throw new Error('Formato de exportación no soportado');
    }
  } catch (error) {
    console.error('Error al exportar tareas:', error);
    throw error;
  }
};

// Exportar usuarios
const exportUsers = async (users, format = 'excel') => {
  try {
    const columns = [
      { header: 'Nombre', key: 'firstName', width: 20 },
      { header: 'Apellido', key: 'lastName', width: 20 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Rol', key: 'role', width: 15 },
      { header: 'Área de Expertise', key: 'expertiseArea', width: 20 },
      { header: 'Departamento', key: 'department', width: 20 },
      { header: 'Posición', key: 'position', width: 20 },
      { header: 'Teléfono', key: 'phone', width: 20 },
      { header: 'Fecha de registro', key: 'createdAt', width: 20 }
    ];
    
    // Formatear datos de usuarios
    const formattedData = users.map(user => ({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      expertiseArea: user.expertiseArea,
      department: user.department || 'N/A',
      position: user.position || 'N/A',
      phone: user.primaryPhone || 'N/A',
      createdAt: new Date(user.createdAt).toLocaleDateString('es-ES')
    }));
    
    if (format === 'excel') {
      return await exportToExcel(formattedData, columns, 'Usuarios', 'usuarios.xlsx');
    } else if (format === 'pdf') {
      return await exportToPDF(formattedData, columns, 'Reporte de Usuarios', 'usuarios.pdf');
    } else {
      throw new Error('Formato de exportación no soportado');
    }
  } catch (error) {
    console.error('Error al exportar usuarios:', error);
    throw error;
  }
};

// Exportar licencias
const exportLeaves = async (leaves, format = 'excel') => {
  try {
    const columns = [
      { header: 'Usuario', key: 'user', width: 30 },
      { header: 'Tipo de licencia', key: 'leaveType', width: 20 },
      { header: 'Fecha de inicio', key: 'startDate', width: 15 },
      { header: 'Fecha de fin', key: 'endDate', width: 15 },
      { header: 'Días', key: 'dayCount', width: 10 },
      { header: 'Estado', key: 'status', width: 15 },
      { header: 'Aprobado por', key: 'approvedBy', width: 30 },
      { header: 'Comentarios', key: 'comments', width: 40 }
    ];
    
    // Formatear datos de licencias
    const formattedData = leaves.map(leave => ({
      user: leave.user ? `${leave.user.firstName} ${leave.user.lastName}` : 'N/A',
      leaveType: leave.leaveType,
      startDate: new Date(leave.startDate).toLocaleDateString('es-ES'),
      endDate: new Date(leave.endDate).toLocaleDateString('es-ES'),
      dayCount: leave.dayCount,
      status: leave.status,
      approvedBy: leave.approvedBy ? `${leave.approvedBy.firstName} ${leave.approvedBy.lastName}` : 'N/A',
      comments: leave.comments || 'N/A'
    }));
    
    if (format === 'excel') {
      return await exportToExcel(formattedData, columns, 'Licencias', 'licencias.xlsx');
    } else if (format === 'pdf') {
      return await exportToPDF(formattedData, columns, 'Reporte de Licencias', 'licencias.pdf');
    } else {
      throw new Error('Formato de exportación no soportado');
    }
  } catch (error) {
    console.error('Error al exportar licencias:', error);
    throw error;
  }
};

module.exports = {
  exportToExcel,
  exportToPDF,
  exportProjects,
  exportTasks,
  exportUsers,
  exportLeaves
};