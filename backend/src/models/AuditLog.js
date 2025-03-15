const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  // Información básica del evento
  action: {
    type: String,
    required: true,
    enum: [
      'create', 
      'update', 
      'delete', 
      'read',
      'login', 
      'logout', 
      'password_reset',
      'permission_change',
      'status_change',
      'export_data',
      'import_data',
      'batch_operation'
    ]
  },
  
  // Detalles del recurso afectado
  entityType: {
    type: String,
    required: true,
    enum: [
      'user',
      'project',
      'task',
      'document',
      'comment',
      'wiki_page',
      'file',
      'folder',
      'leave',
      'notification',
      'calendar_event',
      'system'
    ]
  },
  
  // ID del recurso afectado (si aplica)
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'entityType'
  },
  
  // Usuario que realizó la acción
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Detalles adicionales en formato JSON
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Para cambios, registrar valores anteriores y nuevos
  changes: [{
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed
  }],
  
  // Información de la solicitud
  ipAddress: {
    type: String
  },
  
  userAgent: {
    type: String
  },
  
  // Fecha y hora de la acción
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Índices para búsquedas más rápidas
AuditLogSchema.index({ entityType: 1, entityId: 1 });
AuditLogSchema.index({ userId: 1 });
AuditLogSchema.index({ action: 1 });
AuditLogSchema.index({ createdAt: 1 });

// Método estático para registrar un evento de auditoría
AuditLogSchema.statics.logEvent = async function(data) {
  try {
    return await this.create(data);
  } catch (error) {
    console.error('Error al registrar evento de auditoría:', error);
    // No fallar la operación principal si el registro de auditoría falla
    return null;
  }
};

module.exports = mongoose.model('AuditLog', AuditLogSchema);