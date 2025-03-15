const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const Document = require('../models/Document');
const WikiPage = require('../models/WikiPage');
const Comment = require('../models/Comment');
const Leave = require('../models/Leave');
const CalendarEvent = require('../models/CalendarEvent');
const config = require('../config/config');

/**
 * Realizar búsqueda global en todo el sistema
 */
const globalSearch = async (query, options = {}) => {
  if (!query || query.trim() === '') {
    throw new Error('Se requiere un término de búsqueda');
  }
  
  // Configuración de búsqueda global
  const searchTerm = query.trim();
  const userId = options.userId;
  const limit = options.limit || config.search.maxResults;
  const page = options.page || 1;
  const skip = (page - 1) * limit;
  
  // Preparar la expresión regular para búsqueda insensible a mayúsculas/minúsculas
  const searchRegex = new RegExp(searchTerm, 'i');
  
  // Realizar búsquedas en paralelo
  const [
    projects,
    tasks,
    users,
    documents,
    wikiPages,
    comments,
    leaves,
    events
  ] = await Promise.all([
    // Búsqueda en proyectos
    Project.find({
      $or: [
        { name: searchRegex },
        { description: searchRegex },
        { tags: searchRegex }
      ],
      // Para usuarios no admin, limitar a proyectos donde es miembro
      ...(options.role !== 'admin' ? {
        $or: [
          { owner: userId },
          { 'members.user': userId }
        ]
      } : {})
    })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select('name description status priority startDate endDate progress'),
    
    // Búsqueda en tareas
    Task.find({
      $or: [
        { title: searchRegex },
        { description: searchRegex },
        { tags: searchRegex }
      ],
      // Para usuarios no admin, limitar a tareas de sus proyectos
      ...(options.role !== 'admin' ? {
        $or: [
          { createdBy: userId },
          { assignedTo: userId }
        ]
      } : {})
    })
    .populate('project', 'name')
    .sort({ dueDate: 1 })
    .limit(limit)
    .select('title description status priority dueDate project'),
    
    // Búsqueda en usuarios (solo para administradores)
    options.role === 'admin' ? 
      User.find({
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { department: searchRegex },
          { position: searchRegex }
        ]
      })
      .limit(limit)
      .select('firstName lastName email role expertiseArea profilePicture') : [],
    
    // Búsqueda en documentos
    Document.find({
      $or: [
        { name: searchRegex },
        { description: searchRegex },
        { tags: searchRegex },
        { originalName: searchRegex }
      ],
      // Limitar documentos accesibles
      $or: [
        { isPublic: true },
        { uploadedBy: userId },
        { accessibleTo: userId }
      ]
    })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select('name description fileType fileSize filePath project'),
    
    // Búsqueda en páginas wiki
    WikiPage.find({
      $or: [
        { title: searchRegex },
        { content: searchRegex }
      ],
      isPublished: true,
      // Limitar páginas accesibles (basado en proyecto)
      ...(options.role !== 'admin' ? {
        project: { $in: await getAccessibleProjectIds(userId) }
      } : {})
    })
    .populate('project', 'name')
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select('title path project updatedAt'),
    
    // Búsqueda en comentarios
    Comment.find({
      content: searchRegex,
      // Limitar a comentarios accesibles
      ...(options.role !== 'admin' ? {
        $or: [
          { author: userId },
          { 
            $or: [
              { entityType: 'task', entity: { $in: await getAccessibleTaskIds(userId) } },
              { entityType: 'project', entity: { $in: await getAccessibleProjectIds(userId) } }
            ]
          }
        ]
      } : {})
    })
    .populate('author', 'firstName lastName profilePicture')
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('content entityType entity createdAt'),
    
    // Búsqueda en licencias (limitado por rol)
    options.role === 'admin' || options.expertiseArea === 'administrative' ?
      Leave.find({
        $or: [
          { comments: searchRegex },
          { leaveType: searchRegex }
        ]
      })
      .populate('user', 'firstName lastName')
      .sort({ startDate: -1 })
      .limit(limit)
      .select('user leaveType startDate endDate status') : [],
    
    // Búsqueda en eventos de calendario
    CalendarEvent.find({
      $or: [
        { title: searchRegex },
        { description: searchRegex },
        { location: searchRegex }
      ],
      // Limitar a eventos accesibles
      $or: [
        { creator: userId },
        { 'attendees.user': userId },
        { project: { $in: await getAccessibleProjectIds(userId) } }
      ]
    })
    .sort({ startDate: 1 })
    .limit(limit)
    .select('title startDate endDate location project')
  ]);
  
  // Combinar resultados
  const results = {
    projects: projects.map(p => ({
      ...p.toObject(),
      type: 'project',
      title: p.name,
      url: `/projects/${p._id}`
    })),
    tasks: tasks.map(t => ({
      ...t.toObject(),
      type: 'task',
      url: `/projects/${t.project?._id}/tasks/${t._id}`
    })),
    users: users.map(u => ({
      ...u.toObject(),
      type: 'user',
      title: `${u.firstName} ${u.lastName}`,
      url: options.role === 'admin' ? `/admin/users/${u._id}` : null
    })),
    documents: documents.map(d => ({
      ...d.toObject(),
      type: 'document',
      url: `/documents/view/${d._id}`
    })),
    wikiPages: wikiPages.map(w => ({
      ...w.toObject(),
      type: 'wiki',
      url: `/projects/${w.project?._id}/wiki/${w.path}`
    })),
    comments: comments.map(c => {
      let url = '';
      if (c.entityType === 'task') {
        url = `/tasks/${c.entity}`;
      } else if (c.entityType === 'project') {
        url = `/projects/${c.entity}`;
      }
      return {
        ...c.toObject(),
        type: 'comment',
        title: `Comentario en ${c.entityType === 'task' ? 'tarea' : 'proyecto'}`,
        url
      };
    }),
    leaves: leaves.map(l => ({
      ...l.toObject(),
      type: 'leave',
      title: `Licencia: ${l.leaveType}`,
      url: options.role === 'admin' ? `/admin/leaves/${l._id}` : `/dashboard/leaves`
    })),
    events: events.map(e => ({
      ...e.toObject(),
      type: 'event',
      url: `/calendar?date=${new Date(e.startDate).toISOString().split('T')[0]}`
    }))
  };
  
  // Calcular conteos
  const counts = {
    projects: results.projects.length,
    tasks: results.tasks.length,
    users: results.users.length,
    documents: results.documents.length,
    wikiPages: results.wikiPages.length,
    comments: results.comments.length,
    leaves: results.leaves.length,
    events: results.events.length,
    total: results.projects.length + results.tasks.length + results.users.length + 
           results.documents.length + results.wikiPages.length + results.comments.length +
           results.leaves.length + results.events.length
  };
  
  return { results, counts };
};

/**
 * Realizar búsqueda específica para una entidad
 */
const specificSearch = async (entityType, query, options = {}) => {
  if (!query || query.trim() === '') {
    throw new Error('Se requiere un término de búsqueda');
  }
  
  const searchTerm = query.trim();
  const userId = options.userId;
  const limit = options.limit || config.search.maxResults;
  const page = options.page || 1;
  const skip = (page - 1) * limit;
  const sort = options.sort || config.search.defaultSort;
  
  const searchRegex = new RegExp(searchTerm, 'i');
  let results, total;
  
  switch (entityType) {
    case 'projects':
      const projectQuery = {
        $or: [
          { name: searchRegex },
          { description: searchRegex },
          { tags: searchRegex }
        ]
      };
      
      // Restricciones de acceso
      if (options.role !== 'admin') {
        projectQuery.$or.push({ owner: userId }, { 'members.user': userId });
      }
      
      // Filtros adicionales
      if (options.filters) {
        if (options.filters.status) projectQuery.status = options.filters.status;
        if (options.filters.priority) projectQuery.priority = options.filters.priority;
        if (options.filters.startDate) {
          projectQuery.startDate = { $gte: new Date(options.filters.startDate) };
        }
        if (options.filters.endDate) {
          projectQuery.endDate = { $lte: new Date(options.filters.endDate) };
        }
      }
      
      results = await Project.find(projectQuery)
                          .sort(sort)
                          .skip(skip)
                          .limit(limit)
                          .populate('owner', 'firstName lastName profilePicture')
                          .populate('members.user', 'firstName lastName profilePicture');
      
      total = await Project.countDocuments(projectQuery);
      break;
      
    case 'tasks':
      const taskQuery = {
        $or: [
          { title: searchRegex },
          { description: searchRegex },
          { tags: searchRegex }
        ]
      };
      
      // Restricciones de acceso
      if (options.role !== 'admin') {
        const accessibleProjects = await getAccessibleProjectIds(userId);
        taskQuery.$or.push(
          { createdBy: userId },
          { assignedTo: userId },
          { project: { $in: accessibleProjects } }
        );
      }
      
      // Filtros adicionales
      if (options.filters) {
        if (options.filters.status) taskQuery.status = options.filters.status;
        if (options.filters.priority) taskQuery.priority = options.filters.priority;
        if (options.filters.project) taskQuery.project = options.filters.project;
        if (options.filters.assignedTo) taskQuery.assignedTo = options.filters.assignedTo;
        if (options.filters.dueDate) {
          taskQuery.dueDate = { $lte: new Date(options.filters.dueDate) };
        }
      }
      
      results = await Task.find(taskQuery)
                       .sort(sort)
                       .skip(skip)
                       .limit(limit)
                       .populate('project', 'name')
                       .populate('assignedTo', 'firstName lastName profilePicture')
                       .populate('createdBy', 'firstName lastName');
      
      total = await Task.countDocuments(taskQuery);
      break;
      
    case 'documents':
      const docQuery = {
        $or: [
          { name: searchRegex },
          { description: searchRegex },
          { tags: searchRegex },
          { originalName: searchRegex }
        ],
        $or: [
          { isPublic: true },
          { uploadedBy: userId },
          { accessibleTo: userId }
        ]
      };
      
      // Filtros adicionales
      if (options.filters) {
        if (options.filters.fileType) {
          docQuery.fileType = { $regex: options.filters.fileType, $options: 'i' };
        }
        if (options.filters.folder) docQuery.folder = options.filters.folder;
        if (options.filters.project) docQuery.project = options.filters.project;
      }
      
      results = await Document.find(docQuery)
                           .sort(sort)
                           .skip(skip)
                           .limit(limit)
                           .populate('uploadedBy', 'firstName lastName')
                           .populate('project', 'name');
      
      total = await Document.countDocuments(docQuery);
      break;
      
    case 'users':
      // Solo administradores pueden buscar usuarios
      if (options.role !== 'admin') {
        throw new Error('No autorizado para buscar usuarios');
      }
      
      const userQuery = {
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { department: searchRegex },
          { position: searchRegex }
        ]
      };
      
      // Filtros adicionales
      if (options.filters) {
        if (options.filters.role) userQuery.role = options.filters.role;
        if (options.filters.expertiseArea) userQuery.expertiseArea = options.filters.expertiseArea;
        if (options.filters.isActive !== undefined) userQuery.isActive = options.filters.isActive;
      }
      
      results = await User.find(userQuery)
                       .sort(sort)
                       .skip(skip)
                       .limit(limit)
                       .select('-password -passwordResetToken -passwordResetExpires');
      
      total = await User.countDocuments(userQuery);
      break;
      
    default:
      throw new Error(`Tipo de entidad no soportada: ${entityType}`);
  }
  
  return { 
    results, 
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Obtener IDs de proyectos accesibles para un usuario
 */
const getAccessibleProjectIds = async (userId) => {
  const projects = await Project.find({
    $or: [
      { owner: userId },
      { 'members.user': userId }
    ]
  }).select('_id');
  
  return projects.map(p => p._id);
};

/**
 * Obtener IDs de tareas accesibles para un usuario
 */
const getAccessibleTaskIds = async (userId) => {
  const accessibleProjects = await getAccessibleProjectIds(userId);
  
  const tasks = await Task.find({
    $or: [
      { createdBy: userId },
      { assignedTo: userId },
      { project: { $in: accessibleProjects } }
    ]
  }).select('_id');
  
  return tasks.map(t => t._id);
};

module.exports = {
  globalSearch,
  specificSearch
};