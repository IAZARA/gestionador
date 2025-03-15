const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('./config/config');
const User = require('./models/User');

// Configuración del servidor de Socket.IO
const setupSocketServer = (server) => {
  const io = new Server(server, {
    cors: {
      origin: '*', // Permitir conexiones desde cualquier origen (en producción, limitar a tu dominio)
      methods: ['GET', 'POST']
    }
  });

  // Middleware para autenticación mediante token JWT
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Autenticación requerida'));
    }
    
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user || !user.isActive) {
        return next(new Error('Usuario no autorizado'));
      }
      
      // Adjuntar usuario al socket para uso posterior
      socket.user = user;
      next();
    } catch (error) {
      return next(new Error('Token inválido'));
    }
  });

  // Manejar conexiones de clientes
  io.on('connection', (socket) => {
    console.log(`Usuario conectado: ${socket.user.firstName} ${socket.user.lastName} (${socket.id})`);
    
    // Unir al usuario a su sala personal (para notificaciones directas)
    socket.join(`user:${socket.user._id}`);
    
    // Enviar eventos del sistema
    socket.emit('welcome', {
      message: `Bienvenido, ${socket.user.firstName}`,
      userId: socket.user._id
    });
    
    // Unirse a salas de proyectos
    socket.on('join-project', (projectId) => {
      socket.join(`project:${projectId}`);
      console.log(`${socket.user.firstName} se unió al proyecto: ${projectId}`);
    });
    
    // Abandonar salas de proyectos
    socket.on('leave-project', (projectId) => {
      socket.leave(`project:${projectId}`);
      console.log(`${socket.user.firstName} abandonó el proyecto: ${projectId}`);
    });
    
    // Manejar eventos de chat en proyectos
    socket.on('project-message', (data) => {
      if (!data.projectId || !data.message) return;
      
      const messageData = {
        message: data.message,
        sender: {
          _id: socket.user._id,
          name: `${socket.user.firstName} ${socket.user.lastName}`,
          profilePicture: socket.user.profilePicture
        },
        projectId: data.projectId,
        timestamp: new Date()
      };
      
      // Emitir mensaje a todos los miembros del proyecto
      io.to(`project:${data.projectId}`).emit('project-message', messageData);
    });
    
    // Manejar eventos de notificaciones
    socket.on('notification-read', (notificationId) => {
      // Emitir evento a todos los dispositivos del usuario
      io.to(`user:${socket.user._id}`).emit('notification-read', notificationId);
    });
    
    // Manejar eventos de actualización de tareas en Kanban
    socket.on('task-status-update', (data) => {
      if (!data.taskId || !data.projectId || !data.status) return;
      
      const updateData = {
        taskId: data.taskId,
        projectId: data.projectId,
        previousStatus: data.previousStatus,
        newStatus: data.status,
        updatedBy: {
          _id: socket.user._id,
          name: `${socket.user.firstName} ${socket.user.lastName}`
        },
        timestamp: new Date()
      };
      
      // Emitir actualización a todos los miembros del proyecto
      io.to(`project:${data.projectId}`).emit('task-status-update', updateData);
    });
    
    // Manejar eventos de escritura colaborativa en wiki
    socket.on('wiki-editing', (data) => {
      if (!data.pageId || !data.projectId) return;
      
      const editorData = {
        pageId: data.pageId,
        editor: {
          _id: socket.user._id,
          name: `${socket.user.firstName} ${socket.user.lastName}`
        },
        timestamp: new Date()
      };
      
      // Notificar a otros miembros del proyecto que alguien está editando
      socket.to(`project:${data.projectId}`).emit('wiki-editing', editorData);
    });
    
    // Manejar eventos de comentarios
    socket.on('new-comment', (data) => {
      if (!data.entityId || !data.entityType || !data.content) return;
      
      const commentData = {
        entityId: data.entityId,
        entityType: data.entityType,
        content: data.content,
        author: {
          _id: socket.user._id,
          name: `${socket.user.firstName} ${socket.user.lastName}`,
          profilePicture: socket.user.profilePicture
        },
        timestamp: new Date()
      };
      
      // Si el comentario es en un proyecto
      if (data.entityType === 'project') {
        io.to(`project:${data.entityId}`).emit('new-comment', commentData);
      } 
      // Si el comentario es en una tarea, también notificar a los miembros del proyecto
      else if (data.entityType === 'task' && data.projectId) {
        io.to(`project:${data.projectId}`).emit('new-comment', commentData);
      }
    });
    
    // Manejar desconexión del cliente
    socket.on('disconnect', () => {
      console.log(`Usuario desconectado: ${socket.user.firstName} ${socket.user.lastName} (${socket.id})`);
    });
  });

  return io;
};

// Función para enviar notificaciones a través de Socket.IO
const sendNotification = (io, userId, notification) => {
  io.to(`user:${userId}`).emit('notification', notification);
};

// Función para enviar actualizaciones de proyecto
const sendProjectUpdate = (io, projectId, update) => {
  io.to(`project:${projectId}`).emit('project-update', update);
};

// Función para enviar actualizaciones de tareas
const sendTaskUpdate = (io, projectId, taskUpdate) => {
  io.to(`project:${projectId}`).emit('task-update', taskUpdate);
};

// Función para enviar notificación de nueva actividad en calendario
const sendCalendarUpdate = (io, userId, calendarUpdate) => {
  io.to(`user:${userId}`).emit('calendar-update', calendarUpdate);
};

module.exports = {
  setupSocketServer,
  sendNotification,
  sendProjectUpdate,
  sendTaskUpdate,
  sendCalendarUpdate
};