const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Create a new task
exports.createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      projectId,
      status,
      priority,
      startDate,
      dueDate,
      assignedTo,
      tags
    } = req.body;
    
    // Create task
    const task = new Task({
      title,
      description,
      project: projectId,
      status: status || 'To_Do',
      priority: priority || 'Medium',
      startDate,
      dueDate,
      assignedTo: assignedTo || [],
      tags: tags || [],
      createdBy: req.user.id
    });
    
    await task.save();
    
    // Populate task with user information
    await task.populate('assignedTo', 'firstName lastName email profilePicture');
    await task.populate('createdBy', 'firstName lastName');
    
    // Create notification for assigned users
    if (assignedTo && assignedTo.length > 0) {
      const notificationPromises = assignedTo.map(userId => {
        return new Notification({
          recipient: userId,
          sender: req.user.id,
          task: task._id,
          project: projectId,
          type: 'task_assigned',
          content: `You have been assigned to task "${title}"`,
          actionLink: `/projects/${projectId}/tasks/${task._id}`
        }).save();
      });
      
      await Promise.all(notificationPromises);
    }
    
    // Actualizar el progreso del proyecto
    await updateProjectProgress(projectId);
    
    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      task
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error creating task',
      error: error.message
    });
  }
};

// Get all tasks
exports.getAllTasks = async (req, res) => {
  try {
    // Get query parameters for filtering
    const { 
      project, 
      status, 
      priority, 
      assignedTo, 
      dueDate, 
      search
    } = req.query;
    
    // Build query object
    const query = {};
    
    if (project) query.project = project;
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignedTo) query.assignedTo = assignedTo;
    
    // Due date filter (before a specific date)
    if (dueDate) {
      query.dueDate = { $lte: new Date(dueDate) };
    }
    
    // Search in title or description
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Find tasks based on query
    const tasks = await Task.find(query)
      .populate('project', 'name')
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
      message: 'Server error retrieving tasks',
      error: error.message
    });
  }
};

// Get task by ID
exports.getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId)
      .populate('project', 'name owner members')
      .populate('assignedTo', 'firstName lastName email profilePicture')
      .populate('createdBy', 'firstName lastName email profilePicture')
      .populate('attachments.uploadedBy', 'firstName lastName');
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    res.status(200).json({
      success: true,
      task
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving task',
      error: error.message
    });
  }
};

// Update task
exports.updateTask = async (req, res) => {
  try {
    const { 
      title, 
      description, 
      assignedTo, 
      status, 
      priority, 
      startDate, 
      dueDate, 
      tags 
    } = req.body;
    
    // Get current task to check for status change
    const currentTask = await Task.findById(req.params.taskId);
    
    if (!currentTask) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Build update object
    const updateFields = {};
    if (title) updateFields.title = title;
    if (description) updateFields.description = description;
    if (assignedTo) updateFields.assignedTo = assignedTo;
    if (status) updateFields.status = status;
    if (priority) updateFields.priority = priority;
    if (startDate) updateFields.startDate = startDate;
    if (dueDate) updateFields.dueDate = dueDate;
    if (tags) updateFields.tags = tags;
    
    // If status is changed to Completed, set completedAt
    if (status === 'Completed' && currentTask.status !== 'Completed') {
      updateFields.completedAt = Date.now();
    } else if (status && status !== 'Completed') {
      // If changing from Completed to another status, clear completedAt
      updateFields.completedAt = null;
    }
    
    // Update the updatedAt field
    updateFields.updatedAt = Date.now();
    
    // Find and update task
    const task = await Task.findByIdAndUpdate(
      req.params.taskId,
      { $set: updateFields },
      { new: true, runValidators: true }
    )
    .populate('project', 'name')
    .populate('assignedTo', 'firstName lastName email profilePicture')
    .populate('createdBy', 'firstName lastName');
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Actualizar el progreso del proyecto si ha cambiado el estado
    if (status && status !== currentTask.status) {
      await updateProjectProgress(task.project);
    }
    
    // Create notifications for status change
    if (status && status !== currentTask.status) {
      // Notify task creator if not the one updating
      if (currentTask.createdBy.toString() !== req.user.id) {
        await new Notification({
          recipient: currentTask.createdBy,
          sender: req.user.id,
          task: task._id,
          project: task.project,
          type: 'task_status_changed',
          content: `Task "${task.title}" status changed to ${status}`,
          actionLink: `/projects/${task.project}/tasks/${task._id}`
        }).save();
      }
      
      // Notify assigned users if not the one updating
      if (currentTask.assignedTo && currentTask.assignedTo.length > 0) {
        const notificationPromises = currentTask.assignedTo
          .filter(userId => userId.toString() !== req.user.id)
          .map(userId => {
            return new Notification({
              recipient: userId,
              sender: req.user.id,
              task: task._id,
              project: task.project,
              type: 'task_status_changed',
              content: `Task "${task.title}" status changed to ${status}`,
              actionLink: `/projects/${task.project}/tasks/${task._id}`
            }).save();
          });
        
        await Promise.all(notificationPromises);
      }
    }
    
    // Notify new assigned users
    if (assignedTo) {
      const currentAssigned = currentTask.assignedTo.map(id => id.toString());
      const newAssigned = assignedTo.filter(id => !currentAssigned.includes(id));
      
      if (newAssigned.length > 0) {
        const notificationPromises = newAssigned.map(userId => {
          return new Notification({
            recipient: userId,
            sender: req.user.id,
            task: task._id,
            project: task.project,
            type: 'task_assigned',
            content: `You have been assigned to the task: ${task.title}`,
            actionLink: `/projects/${task.project}/tasks/${task._id}`
          }).save();
        });
        
        await Promise.all(notificationPromises);
      }
    }
    
    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      task
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error updating task',
      error: error.message
    });
  }
};

// Delete task
exports.deleteTask = async (req, res) => {
  try {
    console.log('Solicitud de eliminación de tarea recibida:', {
      taskId: req.params.taskId,
      projectId: req.params.projectId || 'No proporcionado',
      ruta: req.originalUrl
    });
    
    const task = await Task.findById(req.params.taskId);
    
    if (!task) {
      console.log(`Tarea con ID ${req.params.taskId} no encontrada`);
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Si se proporciona un projectId en la ruta, verificar que la tarea pertenezca al proyecto
    if (req.params.projectId) {
      console.log(`Verificando si la tarea ${req.params.taskId} pertenece al proyecto ${req.params.projectId}`);
      
      // Si la tarea no pertenece al proyecto especificado
      if (task.project && task.project.toString() !== req.params.projectId) {
        console.log(`La tarea pertenece al proyecto ${task.project}, no al proyecto ${req.params.projectId}`);
        return res.status(400).json({
          success: false,
          message: 'Task does not belong to the specified project'
        });
      }
    }
    
    console.log(`Eliminando tarea con ID ${req.params.taskId}`);
    await Task.findByIdAndDelete(req.params.taskId);
    
    console.log('Tarea eliminada exitosamente');
    res.status(200).json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    console.error('Error al eliminar tarea:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting task',
      error: error.message
    });
  }
};

// Add attachment to task
exports.addAttachment = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    const task = await Task.findById(req.params.taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Create new attachment
    const attachment = {
      fileName: req.file.filename,
      filePath: req.file.path,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedBy: req.user.id,
      uploadedAt: Date.now()
    };
    
    // Add attachment to task
    task.attachments.push(attachment);
    
    // Update the updatedAt field
    task.updatedAt = Date.now();
    
    await task.save();
    
    // Create notifications for task creator and assigned users
    const notifyUsers = [...task.assignedTo];
    
    // Add creator to notification list if not the uploader
    if (task.createdBy.toString() !== req.user.id && 
        !notifyUsers.includes(task.createdBy)) {
      notifyUsers.push(task.createdBy);
    }
    
    // Send notifications
    if (notifyUsers.length > 0) {
      const notificationPromises = notifyUsers
        .filter(userId => userId.toString() !== req.user.id)
        .map(userId => {
          return new Notification({
            recipient: userId,
            sender: req.user.id,
            task: task._id,
            project: task.project,
            type: 'file_uploaded',
            content: `A new file has been uploaded to task: ${task.title}`,
            actionLink: `/projects/${task.project}/tasks/${task._id}`
          }).save();
        });
      
      await Promise.all(notificationPromises);
    }
    
    res.status(200).json({
      success: true,
      message: 'Attachment added to task successfully',
      attachment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error adding attachment',
      error: error.message
    });
  }
};

// Remove attachment from task
exports.removeAttachment = async (req, res) => {
  try {
    const { attachmentId } = req.params;
    
    const task = await Task.findById(req.params.taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Find attachment index
    const attachmentIndex = task.attachments.findIndex(
      attachment => attachment._id.toString() === attachmentId
    );
    
    if (attachmentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Attachment not found'
      });
    }
    
    // Remove attachment
    task.attachments.splice(attachmentIndex, 1);
    
    // Update the updatedAt field
    task.updatedAt = Date.now();
    
    await task.save();
    
    res.status(200).json({
      success: true,
      message: 'Attachment removed from task successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error removing attachment',
      error: error.message
    });
  }
};

// Get overdue tasks
exports.getOverdueTasks = async (req, res) => {
  try {
    const overdueTasks = await Task.find({
      status: { $ne: 'Completed' },
      dueDate: { $lt: new Date() }
    })
    .populate('project', 'name')
    .populate('assignedTo', 'firstName lastName email')
    .sort({ dueDate: 1 });
    
    res.status(200).json({
      success: true,
      count: overdueTasks.length,
      tasks: overdueTasks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving overdue tasks',
      error: error.message
    });
  }
};

// Get upcoming tasks (due within the next 7 days)
exports.getUpcomingTasks = async (req, res) => {
  try {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    const upcomingTasks = await Task.find({
      status: { $ne: 'Completed' },
      dueDate: { $gte: today, $lte: nextWeek }
    })
    .populate('project', 'name')
    .populate('assignedTo', 'firstName lastName email')
    .sort({ dueDate: 1 });
    
    res.status(200).json({
      success: true,
      count: upcomingTasks.length,
      tasks: upcomingTasks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving upcoming tasks',
      error: error.message
    });
  }
};

// Get tasks by project
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

// Get tasks by status in project
exports.getTasksByStatus = async (req, res) => {
  try {
    const tasks = await Task.find({ 
      project: req.params.projectId,
      status: req.params.status
    })
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
      message: 'Server error retrieving tasks by status',
      error: error.message
    });
  }
};

// Get tasks by user in project
exports.getTasksByUser = async (req, res) => {
  try {
    const tasks = await Task.find({ 
      project: req.params.projectId,
      assignedTo: req.params.userId
    })
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
      message: 'Server error retrieving tasks by user',
      error: error.message
    });
  }
};

// Get user's tasks
exports.getMyTasks = async (req, res) => {
  try {
    console.log('Usuario autenticado:', req.user);
    console.log('ID del usuario (_id):', req.user._id);
    console.log('ID del usuario (id):', req.user.id);
    
    // Usar el ID del usuario en ambos formatos para cubrir todas las posibilidades
    const tasks = await Task.find({
      $or: [
        { assignedTo: req.user._id },
        { assignedTo: req.user.id },
        { createdBy: req.user._id },
        { createdBy: req.user.id }
      ]
    })
    .populate('project', 'name')
    .populate('assignedTo', 'firstName lastName email profilePicture')
    .populate('createdBy', 'firstName lastName email')
    .sort({ createdAt: -1 });

    console.log(`Se encontraron ${tasks.length} tareas para el usuario`);
    
    res.status(200).json({
      success: true,
      tasks
    });
  } catch (error) {
    console.error('Error en getMyTasks:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las tareas del usuario',
      error: error.message
    });
  }
};

// Update task status
exports.updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }
    
    // Lista de estados válidos incluyendo "Deleted"
    const validStatuses = ['To_Do', 'In_Progress', 'In_Review', 'Completed', 'Deleted'];
    
    // Verificar que el estado es válido
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Estado no válido. Estados permitidos: ${validStatuses.join(', ')}`
      });
    }
    
    // Get current task to check for status change
    const currentTask = await Task.findById(req.params.taskId);
    
    if (!currentTask) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Build update object
    const updateFields = { status };
    
    // Si status es "Deleted", no actualizar completedAt
    if (status === 'Deleted') {
      // No hacer nada especial, solo actualizar el status
    }
    // Si status es Completed y no estaba completado antes
    else if (status === 'Completed' && currentTask.status !== 'Completed') {
      updateFields.completedAt = Date.now();
    } else if (status !== 'Completed') {
      // Si cambió de Completed a otro estado, limpiar completedAt
      updateFields.completedAt = null;
    }
    
    // Update task
    const task = await Task.findByIdAndUpdate(
      req.params.taskId,
      { $set: updateFields },
      { new: true, runValidators: true }
    )
      .populate('project', 'name')
      .populate('assignedTo', 'firstName lastName email profilePicture');
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Actualizar el progreso del proyecto - solo considerar tareas no eliminadas
    await updateProjectProgress(task.project);
    
    res.status(200).json({
      success: true,
      message: 'Task status updated successfully',
      task
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error updating task status',
      error: error.message
    });
  }
};

// Función auxiliar para actualizar el progreso del proyecto basado en sus tareas
const updateProjectProgress = async (projectId) => {
  try {
    // Obtener todas las tareas del proyecto
    const allTasks = await Task.find({ project: projectId });
    
    // Filtrar las tareas eliminadas (considerando todas las variantes posibles del estado)
    const tasks = allTasks.filter(task => {
      const status = task.status?.toLowerCase();
      return status !== 'deleted' && 
             status !== 'eliminado' && 
             status !== 'deleted';
    });
    
    // Calcular el progreso en base a las tareas
    const totalTasks = tasks.length;
    let completedTasks = 0;
    
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
      completedTasks += progressValue;
      
      console.log(`Tarea: ${task.title}, Estado: ${task.status}, Valor: ${progressValue}`);
    });
    
    const progress = totalTasks > 0 
      ? Math.round((completedTasks / totalTasks) * 100) 
      : 0;
    
    console.log(`Proyecto ${projectId}: Total tareas=${totalTasks}, Completadas=${completedTasks}, Progreso=${progress}%`);
    
    // Actualizar el progreso del proyecto
    const updatedProject = await Project.findByIdAndUpdate(
      projectId,
      { progress },
      { new: true }
    );
    
    console.log(`Progreso actualizado del proyecto: ${updatedProject.progress}%`);
    
    return progress;
  } catch (error) {
    console.error('Error al actualizar el progreso del proyecto:', error);
    throw error;
  }
};

// Assign task to user
exports.assignTask = async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get current task
    const task = await Task.findById(req.params.taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Check if user is already assigned
    if (task.assignedTo.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: 'User is already assigned to this task'
      });
    }
    
    // Add user to assignedTo array
    task.assignedTo.push(userId);
    await task.save();
    
    // Create notification for assigned user
    await new Notification({
      recipient: userId,
      sender: req.user.id,
      task: task._id,
      project: task.project,
      type: 'task_assigned',
      content: `You have been assigned to the task: ${task.title}`,
      actionLink: `/projects/${task.project}/tasks/${task._id}`
    }).save();
    
    // Populate and return updated task
    const updatedTask = await Task.findById(req.params.taskId)
      .populate('project', 'name')
      .populate('assignedTo', 'firstName lastName email profilePicture');
    
    res.status(200).json({
      success: true,
      message: 'User assigned to task successfully',
      task: updatedTask
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error assigning user to task',
      error: error.message
    });
  }
};

// Add task comment
exports.addTaskComment = async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Comment content is required'
      });
    }
    
    // Get task
    const task = await Task.findById(req.params.taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Add comment to task
    task.comments.push({
      content,
      author: req.user.id,
      createdAt: Date.now()
    });
    
    await task.save();
    
    // Populate and return updated task
    const updatedTask = await Task.findById(req.params.taskId)
      .populate('comments.author', 'firstName lastName email profilePicture');
    
    res.status(200).json({
      success: true,
      message: 'Comment added successfully',
      comments: updatedTask.comments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error adding comment',
      error: error.message
    });
  }
};

// Get task comments
exports.getTaskComments = async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId)
      .populate('comments.author', 'firstName lastName email profilePicture');
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    res.status(200).json({
      success: true,
      comments: task.comments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving comments',
      error: error.message
    });
  }
};

// Add task file
exports.addTaskFile = async (req, res) => {
  try {
    // This would typically handle file uploads
    // For now, we'll return a placeholder response
    res.status(200).json({
      success: true,
      message: 'File upload feature is under development',
      files: []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error uploading file',
      error: error.message
    });
  }
};

// Get task files
exports.getTaskFiles = async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    res.status(200).json({
      success: true,
      files: task.attachments || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving files',
      error: error.message
    });
  }
};

// Delete task file
exports.deleteTaskFile = async (req, res) => {
  try {
    // This would typically handle file deletion
    // For now, we'll return a placeholder response
    res.status(200).json({
      success: true,
      message: 'File deletion feature is under development'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error deleting file',
      error: error.message
    });
  }
};