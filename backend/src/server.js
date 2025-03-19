const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./utils/errorHandler');
const { logger, requestLogger } = require('./utils/logger');
const config = require('./config/config');
const { setupSocketServer } = require('./socketServer');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const projectRoutes = require('./routes/project.routes');
const taskRoutes = require('./routes/task.routes');
const wikiRoutes = require('./routes/wiki.routes');
const documentRoutes = require('./routes/document.routes');
const calendarRoutes = require('./routes/calendar.routes');
const leaveRoutes = require('./routes/leave.routes');
const notificationRoutes = require('./routes/notification.routes');
const adminRoutes = require('./routes/admin.routes');
const commentRoutes = require('./routes/comment.routes');
const fileRoutes = require('./routes/file.routes');
const licenseRoutes = require('./routes/license.routes');

// Initialize express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Setup Socket.IO
const io = setupSocketServer(server);

// Connect to database
connectDB();

// Middleware
app.use(cors());
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
})); // Security headers
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(morgan('dev')); // HTTP request logger
app.use(requestLogger); // Custom request logger

// Middleware para pasar instancia de Socket.IO a las rutas
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Servir archivos estáticos antes de cualquier otro middleware
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', config.fileStorage)));

// Rate limiting - Configuración general para rutas API
const defaultLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // 100 solicitudes por minuto
  message: 'Demasiadas solicitudes. Por favor, espere un momento.'
});

// Rate limiting específico para rutas que requieren más solicitudes
const highTrafficLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 300, // 300 solicitudes por minuto
  message: 'Demasiadas solicitudes. Por favor, espere un momento.'
});

// Aplicar rate limiting específico para rutas de alta frecuencia
app.use('/api/projects/:projectId/stats', highTrafficLimiter);
app.use('/api/projects/:projectId/activity', highTrafficLimiter);
app.use('/api/projects/:projectId/tasks', highTrafficLimiter);
app.use('/api/notifications', highTrafficLimiter);

// Aplicar rate limiting general para el resto de rutas API
app.use('/api', defaultLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/wiki', wikiRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/search', require('./routes/search.routes'));
app.use('/api/export', require('./routes/export.routes'));
app.use('/api/licenses', licenseRoutes);

// Catch 404 and forward to error handler
app.use(notFound);

// Error Handler
app.use(errorHandler);

// Start server
const PORT = 5001; // Forzar puerto 5001 para evitar conflictos
server.listen(PORT, () => {
  logger.info(`Server running in ${config.env} mode on port ${PORT}`);
  logger.info('Socket.IO server initialized');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
});

module.exports = { app, server, io };