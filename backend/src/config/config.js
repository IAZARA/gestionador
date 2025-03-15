require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5001,
  mongoURI: process.env.MONGO_URI || 'mongodb://localhost:27017/gestionador',
  jwtSecret: process.env.JWT_SECRET || 'secret_key_change_in_production',
  jwtExpiration: process.env.JWT_EXPIRATION || '1d',
  env: process.env.NODE_ENV || 'development',
  fileStorage: process.env.FILE_STORAGE_PATH || 'uploads/',
  // Configuración de email
  email: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true' || false,
    auth: {
      user: process.env.EMAIL_USER || '',
      pass: process.env.EMAIL_PASS || ''
    },
    from: process.env.EMAIL_FROM || 'Gestionador <noreply@gestionador.com>'
  },
  // URL base para enlaces en emails
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  // Configuración para búsquedas avanzadas
  search: {
    maxResults: process.env.SEARCH_MAX_RESULTS || 50,
    defaultSort: process.env.SEARCH_DEFAULT_SORT || '-createdAt'
  },
  // Configuración para exportaciones
  export: {
    maxRecords: process.env.EXPORT_MAX_RECORDS || 1000
  }
};