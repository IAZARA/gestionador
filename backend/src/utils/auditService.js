const AuditLog = require('../models/AuditLog');

/**
 * Middleware para registrar acciones de auditoría
 * @param {Object} options - Opciones de configuración del middleware
 * @param {String} options.action - La acción que se está realizando (create, update, delete, etc.)
 * @param {String} options.entityType - El tipo de entidad sobre la que se realiza la acción
 */
const auditMiddleware = (options) => {
  return async (req, res, next) => {
    // Almacenar la respuesta original para capturar después de que se complete
    const originalSend = res.send;
    
    res.send = function(body) {
      const responseBody = body instanceof Buffer ? JSON.parse(body.toString()) : 
                          typeof body === 'string' ? JSON.parse(body) : body;
      
      // Solo registrar si la respuesta fue exitosa (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        let entityId;
        
        // Intentar determinar el ID de la entidad
        if (req.params.id) {
          entityId = req.params.id;
        } else if (responseBody?.data?._id) {
          entityId = responseBody.data._id;
        } else if (responseBody?._id) {
          entityId = responseBody._id;
        }
        
        // Crear registro de auditoría
        try {
          const auditData = {
            action: options.action,
            entityType: options.entityType,
            userId: req.user._id,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            details: {
              method: req.method,
              url: req.originalUrl,
              query: req.query,
              statusCode: res.statusCode
            }
          };
          
          // Agregar entityId si está disponible
          if (entityId) {
            auditData.entityId = entityId;
          }
          
          // Para acciones de actualización, capturar los cambios si están disponibles
          if (options.action === 'update' && req.body) {
            const changes = Object.keys(req.body).map(field => ({
              field,
              newValue: req.body[field]
            }));
            
            if (changes.length > 0) {
              auditData.changes = changes;
            }
          }
          
          // Usar el método estático para no bloquear la respuesta
          AuditLog.logEvent(auditData);
        } catch (error) {
          console.error('Error al crear registro de auditoría:', error);
          // No bloquear la respuesta si hay error en la auditoría
        }
      }
      
      // Continuar con la respuesta original
      originalSend.call(this, body);
      return this;
    };
    
    next();
  };
};

/**
 * Registra un evento de auditoría manualmente
 */
const logAuditEvent = async (data) => {
  try {
    return await AuditLog.logEvent(data);
  } catch (error) {
    console.error('Error al registrar evento de auditoría manual:', error);
    return null;
  }
};

/**
 * Obtener registros de auditoría filtrados
 */
const getAuditLogs = async (filters = {}, options = {}) => {
  try {
    const query = {};
    
    // Agregar filtros si existen
    if (filters.userId) query.userId = filters.userId;
    if (filters.entityType) query.entityType = filters.entityType;
    if (filters.entityId) query.entityId = filters.entityId;
    if (filters.action) query.action = filters.action;
    
    // Filtro por rango de fechas
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }
    
    // Opciones de paginación y ordenación
    const limit = options.limit || 20;
    const page = options.page || 1;
    const skip = (page - 1) * limit;
    const sort = options.sort || { createdAt: -1 };
    
    // Ejecutar la consulta
    const logs = await AuditLog.find(query)
                               .populate('userId', 'firstName lastName email')
                               .sort(sort)
                               .skip(skip)
                               .limit(limit);
    
    const total = await AuditLog.countDocuments(query);
    
    return {
      logs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error al obtener registros de auditoría:', error);
    throw error;
  }
};

module.exports = {
  auditMiddleware,
  logAuditEvent,
  getAuditLogs
};