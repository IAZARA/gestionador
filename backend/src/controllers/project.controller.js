const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Document = require('../models/Document');
const Comment = require('../models/Comment');
const File = require('../models/File');
const CalendarEvent = require('../models/CalendarEvent');
const WikiPage = require('../models/WikiPage');
const AuditLog = require('../models/AuditLog');

// Create a new project
exports.createProject = async (req, res) => {
  try {
    const { name, description, startDate, endDate, priority, tags } = req.body;
    
    // Create new project
    const project = new Project({
      name,
      description,
      startDate,
      endDate,
      priority,
      tags,
      owner: req.user.id,
      members: [{ user: req.user.id, role: 'manager' }] // Add owner as a manager member
    });
    
    await project.save();
    
    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      project
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error creating project',
      error: error.message
    });
  }
};

// Get all projects based on user role
exports.getAllProjects = async (req, res) => {
  try {
    let projects;
    
    // If admin, get all projects
    if (req.user.role === 'admin') {
      projects = await Project.find()
        .populate('owner', 'firstName lastName email')
        .sort({ updatedAt: -1 });
    } else {
      // Get projects owned by user or where user is a member
      const ownedProjects = await Project.find({ owner: req.user.id })
        .populate('owner', 'firstName lastName email')
        .sort({ updatedAt: -1 });
        
      const memberProjects = await Project.find({ 
        'members.user': req.user.id 
      })
      .populate('owner', 'firstName lastName email')
      .sort({ updatedAt: -1 });
      
      // Combine projects and remove duplicates
      const projectMap = new Map();
      [...ownedProjects, ...memberProjects].forEach(project => {
        projectMap.set(project._id.toString(), project);
      });
      
      projects = Array.from(projectMap.values());
    }
    
    res.status(200).json({
      success: true,
      count: projects.length,
      projects
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving projects',
      error: error.message
    });
  }
};

// Get project by ID
exports.getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId)
      .populate('owner', 'firstName lastName email profilePicture')
      .populate('members.user', 'firstName lastName email profilePicture role expertiseArea');
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    res.status(200).json({
      success: true,
      project
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving project',
      error: error.message
    });
  }
};

// Update project
exports.updateProject = async (req, res) => {
  try {
    const { name, description, startDate, endDate, status, priority, tags } = req.body;
    
    // Build update object
    const updateFields = {};
    if (name) updateFields.name = name;
    if (description) updateFields.description = description;
    if (startDate) updateFields.startDate = startDate;
    if (endDate) updateFields.endDate = endDate;
    if (status) updateFields.status = status;
    if (priority) updateFields.priority = priority;
    if (tags) updateFields.tags = tags;
    
    // Update the updatedAt field
    updateFields.updatedAt = Date.now();
    
    // Find and update project
    const project = await Project.findByIdAndUpdate(
      req.params.projectId,
      { $set: updateFields },
      { new: true, runValidators: true }
    );
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      project
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error updating project',
      error: error.message
    });
  }
};

// Delete project
exports.deleteProject = async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const project = await Project.findById(projectId);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Eliminar todas las referencias al proyecto en otros modelos
    const deleteOperations = [
      // Eliminar tareas asociadas al proyecto
      Task.deleteMany({ project: projectId }),
      
      // Eliminar documentos asociados al proyecto
      Document.deleteMany({ project: projectId }),
      
      // Eliminar notificaciones asociadas al proyecto
      Notification.deleteMany({ project: projectId }),
      
      // Eliminar comentarios asociados al proyecto
      Comment.deleteMany({ project: projectId }),
      
      // Eliminar eventos de calendario asociados al proyecto
      CalendarEvent.deleteMany({ project: projectId }),
      
      // Eliminar archivos asociados al proyecto
      File.deleteMany({ project: projectId }),
      
      // Eliminar páginas wiki asociadas al proyecto
      WikiPage.deleteMany({ project: projectId })
    ];
    
    // Ejecutar todas las operaciones de eliminación en paralelo
    await Promise.all(deleteOperations);
    
    // Finalmente, eliminar el proyecto
    await Project.findByIdAndDelete(projectId);
    
    res.status(200).json({
      success: true,
      message: 'Proyecto y todos sus datos asociados eliminados correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar proyecto:', error);
    res.status(500).json({
      success: false,
      message: 'Error del servidor al eliminar el proyecto',
      error: error.message
    });
  }
};

// Add member to project
exports.addProjectMember = async (req, res) => {
  try {
    const { userId, role } = req.body;
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get project
    const project = await Project.findById(req.params.projectId);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Check if user is already a member
    if (project.members.some(member => member.user.toString() === userId)) {
      return res.status(400).json({
        success: false,
        message: 'User is already a member of this project'
      });
    }
    
    // Add member to project
    project.members.push({
      user: userId,
      role: role || 'user'
    });
    
    await project.save();
    
    // Create notification for the new member
    const notification = new Notification({
      recipient: userId,
      sender: req.user.id,
      project: project._id,
      type: 'project_assignment',
      content: `You have been added to the project: ${project.name}`,
      actionLink: `/projects/${project._id}`
    });
    
    await notification.save();
    
    res.status(200).json({
      success: true,
      message: 'Member added to project successfully',
      project
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error adding member to project',
      error: error.message
    });
  }
};

// Remove member from project
exports.removeProjectMember = async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Get project
    const project = await Project.findById(req.params.projectId);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Check if user is a member
    const memberIndex = project.members.findIndex(
      member => member.user.toString() === userId
    );
    
    if (memberIndex === -1) {
      return res.status(400).json({
        success: false,
        message: 'User is not a member of this project'
      });
    }
    
    // Cannot remove the owner from members
    if (project.owner.toString() === userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove the project owner from members'
      });
    }
    
    // Remove member
    project.members.splice(memberIndex, 1);
    
    await project.save();
    
    res.status(200).json({
      success: true,
      message: 'Member removed from project successfully',
      project
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error removing member from project',
      error: error.message
    });
  }
};

// Update member role in project
exports.updateMemberRole = async (req, res) => {
  try {
    const { role } = req.body;
    const userId = req.params.userId;
    
    // Validate role
    if (!['manager', 'user'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be either "manager" or "user"'
      });
    }
    
    // Get project
    const project = await Project.findById(req.params.projectId);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Find member
    const member = project.members.find(
      member => member.user.toString() === userId
    );
    
    if (!member) {
      return res.status(400).json({
        success: false,
        message: 'User is not a member of this project'
      });
    }
    
    // Update role
    member.role = role;
    
    await project.save();
    
    res.status(200).json({
      success: true,
      message: 'Member role updated successfully',
      project
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error updating member role',
      error: error.message
    });
  }
};

// Get project members
exports.getProjectMembers = async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId)
      .populate('members.user', 'firstName lastName email profilePicture role expertiseArea');
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    res.status(200).json({
      success: true,
      members: project.members,
      owner: project.owner
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving project members',
      error: error.message
    });
  }
};

// Get project tasks
exports.getProjectTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ project: req.params.projectId })
      .populate('assignedTo', 'firstName lastName email profilePicture')
      .populate('createdBy', 'firstName lastName')
      .sort({ updatedAt: -1 });
    
    res.status(200).json({
      success: true,
      count: tasks.length,
      tasks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving project tasks',
      error: error.message
    });
  }
};

// Get project tasks grouped by status (for Kanban)
exports.getProjectKanban = async (req, res) => {
  try {
    const tasks = await Task.find({ project: req.params.projectId })
      .populate('assignedTo', 'firstName lastName email profilePicture')
      .populate('createdBy', 'firstName lastName')
      .sort({ updatedAt: -1 });
    
    // Define mapping for status normalization
    const statusNormalizer = {
      // Estados en inglés
      'Completed': 'Completed',
      'In_Review': 'In_Review',
      'In_Progress': 'In_Progress',
      'To_Do': 'To_Do',
      // Estados en español
      'Completado': 'Completed',
      'En_Revision': 'In_Review',
      'En_Revisión': 'In_Review',
      'En_Progreso': 'In_Progress',
      'Por_Hacer': 'To_Do'
    };
    
    // Group tasks by normalized status
    const groupedTasks = {
      'To_Do': tasks.filter(task => statusNormalizer[task.status] === 'To_Do' || task.status === 'To_Do'),
      'In_Progress': tasks.filter(task => statusNormalizer[task.status] === 'In_Progress' || task.status === 'In_Progress'),
      'In_Review': tasks.filter(task => statusNormalizer[task.status] === 'In_Review' || task.status === 'In_Review'),
      'Completed': tasks.filter(task => statusNormalizer[task.status] === 'Completed' || task.status === 'Completed')
    };
    
    // Recalcular el progreso
    let calculatedCompletedTasks = 0;
    
    tasks.forEach(task => {
      // Mapeo de estados en español a valores de progreso
      const statusMap = {
        // Estados en inglés
        'Completed': 1.0,
        'In_Review': 0.75,
        'In_Progress': 0.5,
        'To_Do': 0,
        // Estados en español
        'Completado': 1.0,
        'En_Revision': 0.75,
        'En_Revisión': 0.75,
        'En_Progreso': 0.5,
        'Por_Hacer': 0
      };
      
      // Obtener valor de progreso según el estado
      const progressValue = statusMap[task.status] || 0;
      calculatedCompletedTasks += progressValue;
    });
    
    const calculatedProgress = tasks.length > 0 
      ? Math.round((calculatedCompletedTasks / tasks.length) * 100) 
      : 0;
    
    console.log(`Progreso calculado para proyecto ${req.params.projectId}: ${calculatedProgress}%`);
    
    // Update project progress
    await Project.findByIdAndUpdate(
      req.params.projectId,
      { progress: calculatedProgress },
      { new: true }
    );
    
    res.status(200).json({
      success: true,
      kanban: groupedTasks,
      progress: calculatedProgress
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving project kanban',
      error: error.message
    });
  }
};

// Get project statistics
exports.getProjectStats = async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Get tasks
    const tasks = await Task.find({ project: req.params.projectId });
    
    // Definir mapeo de estados para reconocer tanto inglés como español
    const statusMappings = {
      // Estados en inglés
      'Completed': 'Completed',
      'In_Review': 'In_Review',
      'In_Progress': 'In_Progress',
      'To_Do': 'To_Do',
      // Estados en español
      'Completado': 'Completed',
      'En_Revision': 'In_Review',
      'En_Revisión': 'In_Review',
      'En_Progreso': 'In_Progress',
      'Por_Hacer': 'To_Do'
    };
    
    // Función para normalizar estado
    const getNormalizedStatus = (status) => statusMappings[status] || status;
    
    // Calculate statistics with normalized states
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => getNormalizedStatus(task.status) === 'Completed').length;
    const inProgressTasks = tasks.filter(task => getNormalizedStatus(task.status) === 'In_Progress').length;
    const inReviewTasks = tasks.filter(task => getNormalizedStatus(task.status) === 'In_Review').length;
    const pendingTasks = tasks.filter(task => getNormalizedStatus(task.status) === 'To_Do').length;
    
    // Recalcular el progreso
    let calculatedCompletedTasks = 0;
    
    tasks.forEach(task => {
      // Mapeo de estados en español a valores de progreso
      const statusMap = {
        // Estados en inglés
        'Completed': 1.0,
        'In_Review': 0.75,
        'In_Progress': 0.5,
        'To_Do': 0,
        // Estados en español
        'Completado': 1.0,
        'En_Revision': 0.75,
        'En_Revisión': 0.75,
        'En_Progreso': 0.5,
        'Por_Hacer': 0
      };
      
      // Obtener valor de progreso según el estado
      const progressValue = statusMap[task.status] || 0;
      calculatedCompletedTasks += progressValue;
    });
    
    const calculatedProgress = totalTasks > 0 
      ? Math.round((calculatedCompletedTasks / totalTasks) * 100) 
      : 0;
    
    // Actualizar el progreso del proyecto si es diferente
    if (calculatedProgress !== project.progress) {
      console.log(`Actualizando progreso de proyecto ${project._id}: ${project.progress}% -> ${calculatedProgress}%`);
      await Project.findByIdAndUpdate(
        req.params.projectId,
        { progress: calculatedProgress },
        { new: true }
      );
    }
    
    // Calculate tasks by priority
    const tasksByPriority = {
      Low: tasks.filter(task => task.priority === 'Low').length,
      Medium: tasks.filter(task => task.priority === 'Medium').length,
      High: tasks.filter(task => task.priority === 'High').length,
      Urgent: tasks.filter(task => task.priority === 'Urgent').length
    };
    
    // Calculate overdue tasks
    const overdueTasks = tasks.filter(task => {
      return getNormalizedStatus(task.status) !== 'Completed' && new Date(task.dueDate) < new Date();
    }).length;
    
    // Calculate days left in project
    const today = new Date();
    const endDate = new Date(project.endDate);
    const daysLeft = Math.max(0, Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)));
    
    // Calculate if project is on track
    const actualProgress = calculatedProgress;
    
    const expectedProgress = project.startDate && project.endDate 
      ? calculateExpectedProgress(project.startDate, project.endDate) 
      : 0;
    
    const onTrack = actualProgress >= expectedProgress;
    
    res.status(200).json({
      success: true,
      stats: {
        totalTasks,
        completedTasks,
        inProgressTasks,
        inReviewTasks,
        pendingTasks,
        tasksByPriority,
        overdueTasks,
        daysLeft,
        progreso: calculatedProgress,
        actualProgress,
        expectedProgress,
        onTrack
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving project statistics',
      error: error.message
    });
  }
};

// Get projects for current user
exports.getUserProjects = async (req, res) => {
  try {
    // Get projects where user is owner or member
    const projects = await Project.find({
      $or: [
        { owner: req.user.id },
        { 'members.user': req.user.id }
      ]
    })
    .populate('owner', 'firstName lastName email')
    .sort({ updatedAt: -1 });
    
    res.status(200).json({
      success: true,
      count: projects.length,
      projects
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving user projects',
      error: error.message
    });
  }
};

// Generate project report
exports.generateProjectReport = async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId)
      .populate('owner', 'firstName lastName email')
      .populate('members.user', 'firstName lastName email');
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Get tasks
    const tasks = await Task.find({ project: req.params.projectId })
      .populate('assignedTo', 'firstName lastName email');
    
    // Generate report data
    const reportData = {
      project: {
        name: project.name,
        description: project.description,
        startDate: project.startDate,
        endDate: project.endDate,
        status: project.status,
        priority: project.priority,
        progress: project.progress,
        owner: `${project.owner.firstName} ${project.owner.lastName}`,
        members: project.members.map(member => ({
          name: `${member.user.firstName} ${member.user.lastName}`,
          email: member.user.email,
          role: member.role
        }))
      },
      tasks: tasks.map(task => ({
        name: task.name,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        assignedTo: task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : 'Unassigned'
      })),
      statistics: {
        totalTasks: tasks.length,
        completedTasks: tasks.filter(task => task.status === 'Completed').length,
        inProgressTasks: tasks.filter(task => task.status === 'In_Progress').length,
        pendingTasks: tasks.filter(task => task.status === 'To_Do').length,
        overdueTasks: tasks.filter(task => {
          return task.status !== 'Completed' && new Date(task.dueDate) < new Date();
        }).length
      }
    };
    
    res.status(200).json({
      success: true,
      report: reportData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error generating project report',
      error: error.message
    });
  }
};

// Get project activity
exports.getProjectActivity = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { limit = 20, page = 1 } = req.query;
    
    // Buscar actividades relacionadas con el proyecto y sus entidades relacionadas (tareas, documentos, etc.)
    const activities = await AuditLog.find({
      $or: [
        // Actividades directamente relacionadas con el proyecto
        { entityType: 'project', entityId: projectId },
        
        // Actividades de tareas del proyecto
        { 
          entityType: 'task',
          'details.projectId': projectId
        },
        
        // Actividades de documentos del proyecto
        { 
          entityType: 'document',
          'details.projectId': projectId
        },
        
        // Actividades de páginas wiki del proyecto
        { 
          entityType: 'wiki_page',
          'details.projectId': projectId
        },
        
        // Actividades de comentarios en el proyecto
        { 
          entityType: 'comment',
          'details.projectId': projectId
        }
      ]
    })
    .populate('userId', 'firstName lastName email profilePicture')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));
    
    // Formatear los resultados para el frontend
    const formattedActivities = activities.map(activity => ({
      id: activity._id,
      tipo: activity.action,
      descripcion: formatActivityDescription(activity),
      usuario: {
        id: activity.userId._id,
        nombre: `${activity.userId.firstName} ${activity.userId.lastName}`,
        email: activity.userId.email,
        avatar: activity.userId.profilePicture
      },
      fecha: activity.createdAt,
      detalles: activity.details,
      entidad: {
        tipo: activity.entityType,
        id: activity.entityId
      }
    }));
    
    res.status(200).json({
      success: true,
      activities: formattedActivities,
      page: parseInt(page),
      limit: parseInt(limit),
      total: await AuditLog.countDocuments({
        $or: [
          { entityType: 'project', entityId: projectId },
          { entityType: 'task', 'details.projectId': projectId },
          { entityType: 'document', 'details.projectId': projectId },
          { entityType: 'wiki_page', 'details.projectId': projectId },
          { entityType: 'comment', 'details.projectId': projectId }
        ]
      })
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener actividad del proyecto',
      error: error.message
    });
  }
};

// Función para generar descripciones legibles de las actividades
const formatActivityDescription = (activity) => {
  const actionMap = {
    'create': 'creó',
    'update': 'actualizó',
    'delete': 'eliminó',
    'read': 'visualizó',
    'status_change': 'cambió el estado de',
    'login': 'inició sesión',
    'logout': 'cerró sesión',
    'password_reset': 'restableció su contraseña',
    'permission_change': 'cambió permisos de',
    'export_data': 'exportó datos de',
    'import_data': 'importó datos a',
    'batch_operation': 'realizó una operación masiva en'
  };
  
  const entityMap = {
    'project': 'el proyecto',
    'task': 'una tarea',
    'document': 'un documento',
    'comment': 'un comentario',
    'wiki_page': 'una página wiki',
    'user': 'un usuario',
    'file': 'un archivo',
    'folder': 'una carpeta',
    'leave': 'una solicitud de ausencia',
    'notification': 'una notificación',
    'calendar_event': 'un evento de calendario',
    'system': 'el sistema'
  };
  
  const action = actionMap[activity.action] || activity.action;
  const entity = entityMap[activity.entityType] || activity.entityType;
  
  // Si hay nombre de la entidad, incluirlo
  const entityName = activity.details && activity.details.name ? ` "${activity.details.name}"` : '';
  
  // Si hay detalles específicos, incluirlos en la descripción
  if (activity.action === 'status_change' && activity.details && activity.details.newStatus) {
    return `${action} ${entity}${entityName} a "${activity.details.newStatus}"`;
  }
  
  if (activity.action === 'update' && activity.changes && activity.changes.length > 0) {
    const fields = activity.changes.map(change => change.field).join(', ');
    return `${action} ${fields} en ${entity}${entityName}`;
  }
  
  return `${action} ${entity}${entityName}`;
};

// Helper function to calculate expected progress
const calculateExpectedProgress = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();
  
  // If project hasn't started yet
  if (today < start) return 0;
  
  // If project has ended
  if (today > end) return 100;
  
  // Calculate percentage of time elapsed
  const totalDuration = end - start;
  const elapsed = today - start;
  
  return Math.round((elapsed / totalDuration) * 100);
};

// Get project documents
exports.getProjectDocuments = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Get documents for this project
    const documents = await Document.find({ project: projectId })
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: documents.length,
      documents
    });
  } catch (error) {
    console.error('Error getting project documents:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving project documents',
      error: error.message
    });
  }
};

// Upload document to project
exports.uploadDocument = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, description, fileUrl, fileType, fileSize } = req.body;
    
    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Create new document
    const document = new Document({
      name,
      description,
      fileUrl,
      fileType,
      fileSize,
      project: projectId,
      uploadedBy: req.user.id
    });
    
    await document.save();
    
    // Add activity to project
    project.activity.push({
      action: 'document_uploaded',
      user: req.user.id,
      timestamp: Date.now(),
      details: { documentId: document._id, documentName: name }
    });
    
    await project.save();
    
    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      document
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({
      success: false,
      message: 'Server error uploading document',
      error: error.message
    });
  }
};

// Get document by ID
exports.getDocumentById = async (req, res) => {
  try {
    const { projectId, documentId } = req.params;
    
    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Get document
    const document = await Document.findOne({ _id: documentId, project: projectId });
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    
    res.status(200).json({
      success: true,
      document
    });
  } catch (error) {
    console.error('Error getting document:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving document',
      error: error.message
    });
  }
};

// Delete document
exports.deleteDocument = async (req, res) => {
  try {
    const { projectId, documentId } = req.params;
    
    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Find and delete document
    const document = await Document.findOneAndDelete({ _id: documentId, project: projectId });
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    
    // Add activity to project
    project.activity.push({
      action: 'document_deleted',
      user: req.user.id,
      timestamp: Date.now(),
      details: { documentName: document.name }
    });
    
    await project.save();
    
    res.status(200).json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting document',
      error: error.message
    });
  }
};