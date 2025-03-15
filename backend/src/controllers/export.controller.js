const { 
  exportProjects, 
  exportTasks, 
  exportUsers, 
  exportLeaves 
} = require('../utils/exportService');
const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const Leave = require('../models/Leave');
const { logAuditEvent } = require('../utils/auditService');

// Exportar proyectos
exports.exportProjects = async (req, res) => {
  try {
    const { format } = req.query;
    const userId = req.user.id;
    const role = req.user.role;
    
    // Consulta base
    let query = {};
    
    // Si no es admin, limitar a proyectos visibles para el usuario
    if (role !== 'admin') {
      query = {
        $or: [
          { owner: userId },
          { 'members.user': userId }
        ]
      };
    }
    
    // Aplicar filtros adicionales si existen
    if (req.query.status) query.status = req.query.status;
    if (req.query.priority) query.priority = req.query.priority;
    if (req.query.startDateFrom) {
      query.startDate = { $gte: new Date(req.query.startDateFrom) };
    }
    if (req.query.endDateTo) {
      query.endDate = { $lte: new Date(req.query.endDateTo) };
    }
    
    // Obtener proyectos
    const projects = await Project.find(query)
      .populate('owner', 'firstName lastName')
      .populate('members.user', 'firstName lastName');
      
    // Exportar proyectos al formato solicitado
    const result = await exportProjects(projects, format || 'excel');
    
    // Registrar evento de auditoría
    await logAuditEvent({
      action: 'export_data',
      entityType: 'project',
      userId: req.user.id,
      details: {
        format,
        count: projects.length,
        filters: req.query
      }
    });
    
    res.status(200).json({
      success: true,
      message: `${projects.length} proyectos exportados correctamente`,
      file: {
        fileName: result.fileName,
        url: result.filePath
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al exportar proyectos',
      error: error.message
    });
  }
};

// Exportar tareas
exports.exportTasks = async (req, res) => {
  try {
    const { format, projectId } = req.query;
    const userId = req.user.id;
    const role = req.user.role;
    
    // Consulta base
    let query = {};
    
    // Si se especificó un proyecto, limitar a ese proyecto
    if (projectId) {
      query.project = projectId;
      
      // Verificar si el usuario tiene acceso al proyecto
      if (role !== 'admin') {
        const project = await Project.findById(projectId);
        if (!project.isOwner(userId) && !project.isMember(userId)) {
          return res.status(403).json({
            success: false,
            message: 'No tienes acceso a este proyecto'
          });
        }
      }
    } else if (role !== 'admin') {
      // Si no es admin, limitar a tareas de proyectos accesibles
      const accessibleProjects = await Project.find({
        $or: [
          { owner: userId },
          { 'members.user': userId }
        ]
      }).select('_id');
      
      const projectIds = accessibleProjects.map(p => p._id);
      query.project = { $in: projectIds };
    }
    
    // Aplicar filtros adicionales si existen
    if (req.query.status) query.status = req.query.status;
    if (req.query.priority) query.priority = req.query.priority;
    if (req.query.assignedTo) query.assignedTo = req.query.assignedTo;
    if (req.query.dueDateFrom) {
      query.dueDate = { $gte: new Date(req.query.dueDateFrom) };
    }
    if (req.query.dueDateTo) {
      if (query.dueDate) {
        query.dueDate.$lte = new Date(req.query.dueDateTo);
      } else {
        query.dueDate = { $lte: new Date(req.query.dueDateTo) };
      }
    }
    
    // Obtener tareas
    const tasks = await Task.find(query)
      .populate('project', 'name')
      .populate('assignedTo', 'firstName lastName')
      .populate('createdBy', 'firstName lastName');
      
    // Exportar tareas al formato solicitado
    const result = await exportTasks(tasks, format || 'excel');
    
    // Registrar evento de auditoría
    await logAuditEvent({
      action: 'export_data',
      entityType: 'task',
      userId: req.user.id,
      details: {
        format,
        count: tasks.length,
        projectId,
        filters: req.query
      }
    });
    
    res.status(200).json({
      success: true,
      message: `${tasks.length} tareas exportadas correctamente`,
      file: {
        fileName: result.fileName,
        url: result.filePath
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al exportar tareas',
      error: error.message
    });
  }
};

// Exportar usuarios (solo para administradores)
exports.exportUsers = async (req, res) => {
  try {
    // Verificar que el usuario sea administrador
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para exportar usuarios'
      });
    }
    
    const { format } = req.query;
    
    // Consulta base
    let query = {};
    
    // Aplicar filtros adicionales si existen
    if (req.query.role) query.role = req.query.role;
    if (req.query.expertiseArea) query.expertiseArea = req.query.expertiseArea;
    if (req.query.department) query.department = req.query.department;
    if (req.query.isActive === 'true') query.isActive = true;
    if (req.query.isActive === 'false') query.isActive = false;
    
    // Obtener usuarios
    const users = await User.find(query).select('-password -passwordResetToken -passwordResetExpires');
      
    // Exportar usuarios al formato solicitado
    const result = await exportUsers(users, format || 'excel');
    
    // Registrar evento de auditoría
    await logAuditEvent({
      action: 'export_data',
      entityType: 'user',
      userId: req.user.id,
      details: {
        format,
        count: users.length,
        filters: req.query
      }
    });
    
    res.status(200).json({
      success: true,
      message: `${users.length} usuarios exportados correctamente`,
      file: {
        fileName: result.fileName,
        url: result.filePath
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al exportar usuarios',
      error: error.message
    });
  }
};

// Exportar licencias
exports.exportLeaves = async (req, res) => {
  try {
    const { format } = req.query;
    const userId = req.user.id;
    const role = req.user.role;
    const expertiseArea = req.user.expertiseArea;
    
    // Verificar permisos: solo admin o usuarios con experiencia administrativa
    if (role !== 'admin' && expertiseArea !== 'administrative') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para exportar licencias'
      });
    }
    
    // Consulta base
    let query = {};
    
    // Si no es admin, limitar más los datos
    if (role !== 'admin') {
      query = {
        $or: [
          { user: userId },
          { createdBy: userId }
        ]
      };
    }
    
    // Aplicar filtros adicionales si existen
    if (req.query.status) query.status = req.query.status;
    if (req.query.leaveType) query.leaveType = req.query.leaveType;
    if (req.query.user) query.user = req.query.user;
    if (req.query.startDateFrom) {
      query.startDate = { $gte: new Date(req.query.startDateFrom) };
    }
    if (req.query.endDateTo) {
      if (query.endDate) {
        query.endDate.$lte = new Date(req.query.endDateTo);
      } else {
        query.endDate = { $lte: new Date(req.query.endDateTo) };
      }
    }
    
    // Obtener licencias
    const leaves = await Leave.find(query)
      .populate('user', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName')
      .populate('createdBy', 'firstName lastName');
      
    // Exportar licencias al formato solicitado
    const result = await exportLeaves(leaves, format || 'excel');
    
    // Registrar evento de auditoría
    await logAuditEvent({
      action: 'export_data',
      entityType: 'leave',
      userId: req.user.id,
      details: {
        format,
        count: leaves.length,
        filters: req.query
      }
    });
    
    res.status(200).json({
      success: true,
      message: `${leaves.length} licencias exportadas correctamente`,
      file: {
        fileName: result.fileName,
        url: result.filePath
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al exportar licencias',
      error: error.message
    });
  }
};