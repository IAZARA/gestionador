const { globalSearch, specificSearch } = require('../utils/searchService');

// Realizar búsqueda global en todo el sistema
exports.searchGlobal = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un término de búsqueda'
      });
    }
    
    // Opciones de búsqueda basadas en el usuario actual
    const searchOptions = {
      userId: req.user.id,
      role: req.user.role,
      expertiseArea: req.user.expertiseArea,
      limit: parseInt(req.query.limit) || 10,
      page: parseInt(req.query.page) || 1
    };
    
    const results = await globalSearch(query, searchOptions);
    
    res.status(200).json({
      success: true,
      ...results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al realizar la búsqueda global',
      error: error.message
    });
  }
};

// Realizar búsqueda específica en una entidad
exports.searchEntity = async (req, res) => {
  try {
    const { entity } = req.params;
    const { query } = req.query;
    
    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un término de búsqueda'
      });
    }
    
    // Opciones de búsqueda basadas en el usuario actual y parámetros
    const searchOptions = {
      userId: req.user.id,
      role: req.user.role,
      expertiseArea: req.user.expertiseArea,
      limit: parseInt(req.query.limit) || 10,
      page: parseInt(req.query.page) || 1,
      sort: req.query.sort || '-createdAt'
    };
    
    // Procesamiento de filtros
    if (Object.keys(req.query).some(key => key.startsWith('filter.'))) {
      searchOptions.filters = {};
      
      Object.keys(req.query).forEach(key => {
        if (key.startsWith('filter.')) {
          const filterKey = key.replace('filter.', '');
          searchOptions.filters[filterKey] = req.query[key];
        }
      });
    }
    
    const results = await specificSearch(entity, query, searchOptions);
    
    res.status(200).json({
      success: true,
      entity,
      query,
      ...results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Error al buscar en ${req.params.entity}`,
      error: error.message
    });
  }
};

// Sugerencias de búsqueda (autocompletado)
exports.getSearchSuggestions = async (req, res) => {
  try {
    const { query, type } = req.query;
    
    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un término de búsqueda'
      });
    }
    
    // Limitar a 5 sugerencias por tipo
    const limit = 5;
    const searchRegex = new RegExp(query.trim(), 'i');
    let suggestions = [];
    
    // Determinar en qué entidades buscar basado en el tipo solicitado
    if (!type || type === 'all' || type === 'project') {
      const projects = await Project.find({
        name: searchRegex,
        // Limitar a proyectos accesibles para el usuario
        $or: [
          { isPublic: true },
          { owner: req.user.id },
          { 'members.user': req.user.id }
        ]
      })
      .limit(limit)
      .select('name _id');
      
      suggestions = [
        ...suggestions,
        ...projects.map(p => ({
          id: p._id,
          text: p.name,
          type: 'project',
          url: `/projects/${p._id}`
        }))
      ];
    }
    
    if (!type || type === 'all' || type === 'task') {
      const tasks = await Task.find({
        title: searchRegex,
        // Solo tareas asignadas al usuario o de sus proyectos
        $or: [
          { assignedTo: req.user.id },
          { createdBy: req.user.id }
        ]
      })
      .limit(limit)
      .select('title _id project');
      
      suggestions = [
        ...suggestions,
        ...tasks.map(t => ({
          id: t._id,
          text: t.title,
          type: 'task',
          url: `/projects/${t.project}/tasks/${t._id}`
        }))
      ];
    }
    
    if (!type || type === 'all' || type === 'user') {
      // Solo administradores pueden buscar usuarios
      if (req.user.role === 'admin') {
        const users = await User.find({
          $or: [
            { firstName: searchRegex },
            { lastName: searchRegex },
            { email: searchRegex }
          ]
        })
        .limit(limit)
        .select('firstName lastName _id');
        
        suggestions = [
          ...suggestions,
          ...users.map(u => ({
            id: u._id,
            text: `${u.firstName} ${u.lastName}`,
            type: 'user',
            url: `/admin/users/${u._id}`
          }))
        ];
      }
    }
    
    if (!type || type === 'all' || type === 'document') {
      const documents = await Document.find({
        name: searchRegex,
        // Solo documentos a los que tiene acceso
        $or: [
          { isPublic: true },
          { uploadedBy: req.user.id },
          { accessibleTo: req.user.id }
        ]
      })
      .limit(limit)
      .select('name _id');
      
      suggestions = [
        ...suggestions,
        ...documents.map(d => ({
          id: d._id,
          text: d.name,
          type: 'document',
          url: `/documents/view/${d._id}`
        }))
      ];
    }
    
    res.status(200).json({
      success: true,
      suggestions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener sugerencias de búsqueda',
      error: error.message
    });
  }
};

// Búsqueda avanzada con múltiples criterios
exports.advancedSearch = async (req, res) => {
  try {
    const { 
      keywords, 
      entityTypes, 
      dateFrom, 
      dateTo, 
      creator,
      assignee,
      status,
      priority
    } = req.body;
    
    // Validar que hay al menos un término de búsqueda
    if ((!keywords || keywords.trim() === '') && !entityTypes) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere al menos un criterio de búsqueda'
      });
    }
    
    // Preparar filtros de búsqueda
    const searchOptions = {
      userId: req.user.id,
      role: req.user.role,
      expertiseArea: req.user.expertiseArea,
      limit: parseInt(req.query.limit) || 20,
      page: parseInt(req.query.page) || 1,
      sort: req.query.sort || '-createdAt',
      filters: {}
    };
    
    // Agregar filtros si existen
    if (dateFrom) searchOptions.filters.startDate = dateFrom;
    if (dateTo) searchOptions.filters.endDate = dateTo;
    if (creator) searchOptions.filters.creator = creator;
    if (assignee) searchOptions.filters.assignee = assignee;
    if (status) searchOptions.filters.status = status;
    if (priority) searchOptions.filters.priority = priority;
    
    // Dividir los tipos de entidad para buscar en cada uno
    const types = entityTypes ? 
      (Array.isArray(entityTypes) ? entityTypes : [entityTypes]) : 
      ['projects', 'tasks', 'documents', 'users'];
    
    const query = keywords || '';
    const results = {};
    
    // Buscar en cada tipo de entidad solicitado
    await Promise.all(types.map(async (type) => {
      try {
        const entityResults = await specificSearch(type, query, searchOptions);
        results[type] = entityResults;
      } catch (error) {
        // Ignorar errores de tipos no soportados o permisos insuficientes
        console.warn(`Error buscando en ${type}:`, error.message);
      }
    }));
    
    res.status(200).json({
      success: true,
      keywords: query,
      entityTypes: types,
      filters: searchOptions.filters,
      results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al realizar la búsqueda avanzada',
      error: error.message
    });
  }
};