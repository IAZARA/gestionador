const AuditLog = require('../models/AuditLog');

/**
 * Middleware para registrar actividades automáticamente
 * @param {Object} options Opciones de configuración
 * @returns {Function} Middleware para Express
 */
const auditLogger = (options = {}) => {
  return async (req, res, next) => {
    // Guardar la respuesta original para poder acceder a ella después
    const originalSend = res.send;
    
    // Determinar la acción basada en el método HTTP
    const actionMap = {
      'GET': 'read',
      'POST': 'create',
      'PUT': 'update',
      'PATCH': 'update',
      'DELETE': 'delete'
    };
    
    // Obtener la acción o usar la predeterminada del método HTTP
    const action = options.action || actionMap[req.method] || req.method.toLowerCase();
    
    // Extrar ID de entidad de los parámetros o de la URL
    let entityId;
    if (options.entityIdParam) {
      entityId = req.params[options.entityIdParam];
    } else if (req.params.id) {
      entityId = req.params.id;
    } else {
      // Extraer el último segmento de la URL si es numérico/ObjectId
      const urlParts = req.path.split('/');
      const lastSegment = urlParts[urlParts.length - 1];
      
      // Si parece un ObjectId válido (24 caracteres hexadecimales)
      if (/^[0-9a-fA-F]{24}$/.test(lastSegment)) {
        entityId = lastSegment;
      }
    }
    
    // Solo registrar si tenemos usuario autenticado
    if (!req.user || !req.user._id) {
      return next();
    }
    
    try {
      // Sobrescribir el método send para interceptar la respuesta
      res.send = function(data) {
        // Restaurar el método send original
        res.send = originalSend;
        
        // Procesar solo si la respuesta fue exitosa (2xx)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          let parsedData;
          try {
            // Intentar parsear los datos de respuesta si es JSON
            parsedData = typeof data === 'string' ? JSON.parse(data) : data;
          } catch (e) {
            parsedData = { raw: String(data).substring(0, 100) };
          }
          
          // Obtener el ID de la entidad creada en caso de POST
          if (req.method === 'POST' && parsedData && (parsedData._id || parsedData.id)) {
            entityId = parsedData._id || parsedData.id;
          }
          
          // Preparar los detalles para el registro de auditoría
          const details = {
            url: req.originalUrl,
            method: req.method,
            ...options.additionalDetails,
          };
          
          // Añadir información específica del cuerpo de la petición si está disponible
          if (req.body && typeof req.body === 'object') {
            // Filtrar información sensible
            const { password, token, ...safeBody } = req.body;
            
            // Añadir campos clave como nombre si están disponibles
            if (safeBody.name) details.name = safeBody.name;
            if (safeBody.title) details.title = safeBody.title;
            if (safeBody.description) details.description = safeBody.description?.substring(0, 100);
            if (safeBody.projectId) details.projectId = safeBody.projectId;
            if (safeBody.project) details.projectId = safeBody.project;
          }
          
          // Crear el registro de auditoría
          AuditLog.logEvent({
            action,
            entityType: options.entityType || 'system',
            entityId: entityId,
            userId: req.user._id,
            details,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          }).catch(err => {
            console.error('Error al registrar evento de auditoría:', err);
          });
        }
        
        // Continuar con la respuesta original
        return originalSend.call(this, data);
      };
    } catch (error) {
      console.error('Error en middleware de auditoría:', error);
    }
    
    next();
  };
};

module.exports = auditLogger; 