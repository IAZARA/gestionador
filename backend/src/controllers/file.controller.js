const File = require('../models/File');
const Project = require('../models/Project');
const Task = require('../models/Task');
const WikiPage = require('../models/WikiPage');
const Notification = require('../models/Notification');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');

// Upload a file
exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    const { project, task, wikiPage, comment, isPublic } = req.body;
    
    // Validate that at least one parent resource is provided
    if (!project && !task && !wikiPage && !comment) {
      return res.status(400).json({
        success: false,
        message: 'File must be associated with either a project, task, wiki page, or comment'
      });
    }
    
    // Create new file record
    const file = new File({
      fileName: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      project,
      task,
      wikiPage,
      comment,
      uploadedBy: req.user.id,
      isPublic: isPublic === 'true'
    });
    
    await file.save();
    
    // Create notifications
    await createFileUploadNotifications(file, req.user.id);
    
    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      file
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error uploading file',
      error: error.message
    });
  }
};

// Download a file
exports.downloadFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.fileId);
    
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    // Check if user has access to this file
    const hasAccess = await userHasAccessToFile(file, req.user);
    
    if (!hasAccess && !file.isPublic) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to access this file.'
      });
    }
    
    // Check if the file exists
    if (!fs.existsSync(file.filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on the server'
      });
    }
    
    // Set the appropriate content type
    res.setHeader('Content-Type', file.fileType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(file.filePath);
    fileStream.pipe(res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error downloading file',
      error: error.message
    });
  }
};

// Get file details
exports.getFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.fileId)
      .populate('uploadedBy', 'firstName lastName email profilePicture')
      .populate('project', 'name')
      .populate('task', 'title')
      .populate('wikiPage', 'title');
    
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    // Check if user has access to this file
    const hasAccess = await userHasAccessToFile(file, req.user);
    
    if (!hasAccess && !file.isPublic) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to access this file.'
      });
    }
    
    res.status(200).json({
      success: true,
      file
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving file',
      error: error.message
    });
  }
};

// Get file by ID
exports.getFileById = async (req, res) => {
  try {
    const file = await File.findById(req.params.fileId)
      .populate('uploadedBy', 'firstName lastName email profilePicture')
      .populate('project', 'name')
      .populate('task', 'title')
      .populate('wikiPage', 'title');
    
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    // Check if user has access to this file
    const hasAccess = await userHasAccessToFile(file, req.user);
    
    if (!hasAccess && !file.isPublic) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to access this file.'
      });
    }
    
    res.status(200).json({
      success: true,
      file
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving file',
      error: error.message
    });
  }
};

// Update file details
exports.updateFile = async (req, res) => {
  try {
    const { isPublic } = req.body;
    
    const file = await File.findById(req.params.fileId);
    
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    // Check if user is the uploader
    if (file.uploadedBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not the uploader of this file.'
      });
    }
    
    // Update fields
    if (isPublic !== undefined) {
      file.isPublic = isPublic === 'true';
    }
    
    await file.save();
    
    res.status(200).json({
      success: true,
      message: 'File updated successfully',
      file
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error updating file',
      error: error.message
    });
  }
};

// Upload a new version of a file
exports.uploadNewVersion = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    const file = await File.findById(req.params.fileId);
    
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    // Check if user is the uploader
    if (file.uploadedBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not the uploader of this file.'
      });
    }
    
    // Save the current version to history
    file.previousVersions.push({
      filePath: file.filePath,
      version: file.version,
      uploadedBy: file.uploadedBy,
      uploadedAt: file.createdAt
    });
    
    // Update with the new version
    file.fileName = req.file.filename;
    file.originalName = req.file.originalname;
    file.filePath = req.file.path;
    file.fileType = req.file.mimetype;
    file.fileSize = req.file.size;
    file.version += 1;
    file.uploadedBy = req.user.id;
    file.updatedAt = Date.now();
    
    await file.save();
    
    // Create notifications
    await createFileVersionNotifications(file, req.user.id);
    
    res.status(200).json({
      success: true,
      message: 'File version updated successfully',
      file
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error uploading new version',
      error: error.message
    });
  }
};

// Delete a file
exports.deleteFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.fileId);
    
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    // Check if user is the uploader
    if (file.uploadedBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not the uploader of this file.'
      });
    }
    
    // Delete the file from the filesystem
    try {
      if (fs.existsSync(file.filePath)) {
        fs.unlinkSync(file.filePath);
      }
      
      // Delete previous versions as well
      file.previousVersions.forEach(version => {
        if (fs.existsSync(version.filePath)) {
          fs.unlinkSync(version.filePath);
        }
      });
    } catch (fileError) {
      console.error('Error deleting file from filesystem:', fileError);
    }
    
    // Delete the file record from the database
    await File.findByIdAndDelete(req.params.fileId);
    
    res.status(200).json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error deleting file',
      error: error.message
    });
  }
};

// Get files for a project
exports.getProjectFiles = async (req, res) => {
  try {
    const files = await File.find({ project: req.params.projectId })
      .populate('uploadedBy', 'firstName lastName')
      .sort({ updatedAt: -1 });
    
    res.status(200).json({
      success: true,
      count: files.length,
      files
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving project files',
      error: error.message
    });
  }
};

// Get files for a task
exports.getTaskFiles = async (req, res) => {
  try {
    const files = await File.find({ task: req.params.taskId })
      .populate('uploadedBy', 'firstName lastName')
      .sort({ updatedAt: -1 });
    
    res.status(200).json({
      success: true,
      count: files.length,
      files
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving task files',
      error: error.message
    });
  }
};

// Get files for a wiki page
exports.getWikiPageFiles = async (req, res) => {
  try {
    const files = await File.find({ wikiPage: req.params.wikiId })
      .populate('uploadedBy', 'firstName lastName')
      .sort({ updatedAt: -1 });
    
    res.status(200).json({
      success: true,
      count: files.length,
      files
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving wiki page files',
      error: error.message
    });
  }
};

// Get file versions
exports.getFileVersions = async (req, res) => {
  try {
    const file = await File.findById(req.params.fileId)
      .populate('previousVersions.uploadedBy', 'firstName lastName email profilePicture');
    
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    // Check if user has access to this file
    const hasAccess = await userHasAccessToFile(file, req.user);
    
    if (!hasAccess && !file.isPublic) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to access this file.'
      });
    }
    
    // Get versions including the current one
    const versions = [
      ...file.previousVersions,
      {
        version: file.version,
        uploadedBy: file.uploadedBy,
        uploadedAt: file.updatedAt,
        isCurrent: true
      }
    ].sort((a, b) => b.version - a.version);
    
    res.status(200).json({
      success: true,
      count: versions.length,
      versions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving file versions',
      error: error.message
    });
  }
};

// Download a specific version of a file
exports.downloadFileVersion = async (req, res) => {
  try {
    const { fileId, version } = req.params;
    const file = await File.findById(fileId);
    
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    // Check if user has access to this file
    const hasAccess = await userHasAccessToFile(file, req.user);
    
    if (!hasAccess && !file.isPublic) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to access this file.'
      });
    }
    
    let filePath, originalName, fileType;
    
    // Check if it's the current version
    if (file.version.toString() === version) {
      filePath = file.filePath;
      originalName = file.originalName;
      fileType = file.fileType;
    } else {
      // Find in previous versions
      const versionInfo = file.previousVersions.find(v => v.version.toString() === version);
      
      if (!versionInfo) {
        return res.status(404).json({
          success: false,
          message: 'File version not found'
        });
      }
      
      filePath = versionInfo.filePath;
      originalName = file.originalName;
      fileType = file.fileType;
    }
    
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on the server'
      });
    }
    
    // Set the appropriate content type
    res.setHeader('Content-Type', fileType);
    res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error downloading file version',
      error: error.message
    });
  }
};

// Get files by entity (project, task, etc.)
exports.getEntityFiles = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    
    if (!entityType || !entityId) {
      return res.status(400).json({
        success: false,
        message: 'Entity type and ID are required'
      });
    }
    
    // Validate entity type
    if (!['project', 'task', 'wikiPage', 'comment'].includes(entityType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid entity type. Must be "project", "task", "wikiPage", or "comment"'
      });
    }
    
    // Build query based on entity type
    const query = {};
    query[entityType] = entityId;
    
    // Check if user has access to the entity
    let hasAccess = false;
    
    if (entityType === 'project') {
      const project = await Project.findById(entityId);
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      hasAccess = project.owner.toString() === req.user.id || 
                 project.members.some(member => member.user.toString() === req.user.id) ||
                 req.user.role === 'admin';
    } else if (entityType === 'task') {
      const task = await Task.findById(entityId).populate('project');
      
      if (!task) {
        return res.status(404).json({
          success: false,
          message: 'Task not found'
        });
      }
      
      if (task.project) {
        const project = await Project.findById(task.project);
        hasAccess = project.owner.toString() === req.user.id || 
                   project.members.some(member => member.user.toString() === req.user.id) ||
                   req.user.role === 'admin';
      } else {
        // If task is not associated with a project, only assignees and admins can access
        hasAccess = task.assignees.includes(req.user.id) || 
                   task.createdBy.toString() === req.user.id ||
                   req.user.role === 'admin';
      }
    } else if (entityType === 'wikiPage') {
      const wikiPage = await WikiPage.findById(entityId).populate('project');
      
      if (!wikiPage) {
        return res.status(404).json({
          success: false,
          message: 'Wiki page not found'
        });
      }
      
      if (wikiPage.project) {
        const project = await Project.findById(wikiPage.project);
        hasAccess = project.owner.toString() === req.user.id || 
                   project.members.some(member => member.user.toString() === req.user.id) ||
                   req.user.role === 'admin';
      } else {
        // If wiki page is not associated with a project, check if it's public
        hasAccess = wikiPage.isPublic || 
                   wikiPage.createdBy.toString() === req.user.id ||
                   req.user.role === 'admin';
      }
    } else if (entityType === 'comment') {
      // For comments, we'll allow access if the user has access to the parent entity
      // This is a simplified approach - in a real app, you might want to check the parent entity
      hasAccess = true;
    }
    
    if (!hasAccess && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to access files for this entity.'
      });
    }
    
    // Get files
    const files = await File.find(query)
      .populate('uploadedBy', 'firstName lastName email profilePicture')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: files.length,
      files
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving files',
      error: error.message
    });
  }
};

// Helper function to check if a user has access to a file
const userHasAccessToFile = async (file, user) => {
  // Admin has access to all files
  if (user.role === 'admin') {
    return true;
  }
  
  // The uploader has access to their own files
  if (file.uploadedBy.toString() === user.id) {
    return true;
  }
  
  try {
    // Check access based on project
    if (file.project) {
      const project = await Project.findById(file.project);
      if (project) {
        if (project.isOwner(user._id) || project.isMember(user._id)) {
          return true;
        }
      }
    }
    
    // Check access based on task
    if (file.task) {
      const task = await Task.findById(file.task).populate('project');
      if (task && task.project) {
        if (task.project.isOwner(user._id) || task.project.isMember(user._id)) {
          return true;
        }
      }
    }
    
    // Check access based on wiki page
    if (file.wikiPage) {
      const wikiPage = await WikiPage.findById(file.wikiPage);
      if (wikiPage && wikiPage.project) {
        const project = await Project.findById(wikiPage.project);
        if (project) {
          if (project.isOwner(user._id) || project.isMember(user._id)) {
            return true;
          }
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking file access:', error);
    return false;
  }
};

// Helper function to create notifications for file uploads
const createFileUploadNotifications = async (file, uploaderId) => {
  try {
    let notificationTargets = [];
    let projectId = null;
    let actionLink = '';
    let content = '';
    
    // Get targets based on file association
    if (file.project) {
      projectId = file.project;
      const project = await Project.findById(file.project);
      
      if (project) {
        // Notify project members
        notificationTargets = project.members.map(member => member.user.toString());
        notificationTargets.push(project.owner.toString());
        actionLink = `/projects/${project._id}/files`;
        content = `New file uploaded to project: ${project.name}`;
      }
    } else if (file.task) {
      const task = await Task.findById(file.task).populate('project');
      
      if (task) {
        // Notify task assignees and creator
        notificationTargets = task.assignedTo.map(user => user.toString());
        notificationTargets.push(task.createdBy.toString());
        projectId = task.project._id;
        actionLink = `/projects/${task.project._id}/tasks/${task._id}`;
        content = `New file uploaded to task: ${task.title}`;
      }
    } else if (file.wikiPage) {
      const wikiPage = await WikiPage.findById(file.wikiPage).populate('project');
      
      if (wikiPage) {
        const project = await Project.findById(wikiPage.project);
        
        if (project) {
          // Notify project members
          notificationTargets = project.members.map(member => member.user.toString());
          notificationTargets.push(project.owner.toString());
          projectId = project._id;
          actionLink = `/projects/${project._id}/wiki/${wikiPage._id}`;
          content = `New file uploaded to wiki page: ${wikiPage.title}`;
        }
      }
    }
    
    // Remove duplicates and uploader
    notificationTargets = [...new Set(notificationTargets)]
      .filter(userId => userId !== uploaderId);
    
    // Create notifications
    const notificationPromises = notificationTargets.map(userId => {
      return new Notification({
        recipient: userId,
        sender: uploaderId,
        project: projectId,
        task: file.task,
        type: 'file_uploaded',
        content,
        actionLink
      }).save();
    });
    
    await Promise.all(notificationPromises);
  } catch (error) {
    console.error('Error creating file upload notifications:', error);
  }
};

// Helper function to create notifications for file version updates
const createFileVersionNotifications = async (file, uploaderId) => {
  try {
    let notificationTargets = [];
    let projectId = null;
    let actionLink = '';
    let content = '';
    
    // Get targets based on file association
    if (file.project) {
      projectId = file.project;
      const project = await Project.findById(file.project);
      
      if (project) {
        // Notify project members
        notificationTargets = project.members.map(member => member.user.toString());
        notificationTargets.push(project.owner.toString());
        actionLink = `/projects/${project._id}/files/${file._id}`;
        content = `File updated with new version: ${file.originalName}`;
      }
    } else if (file.task) {
      const task = await Task.findById(file.task).populate('project');
      
      if (task) {
        // Notify task assignees and creator
        notificationTargets = task.assignedTo.map(user => user.toString());
        notificationTargets.push(task.createdBy.toString());
        projectId = task.project._id;
        actionLink = `/projects/${task.project._id}/tasks/${task._id}`;
        content = `File updated with new version: ${file.originalName}`;
      }
    } else if (file.wikiPage) {
      const wikiPage = await WikiPage.findById(file.wikiPage).populate('project');
      
      if (wikiPage) {
        const project = await Project.findById(wikiPage.project);
        
        if (project) {
          // Notify project members
          notificationTargets = project.members.map(member => member.user.toString());
          notificationTargets.push(project.owner.toString());
          projectId = project._id;
          actionLink = `/projects/${project._id}/wiki/${wikiPage._id}`;
          content = `File updated with new version: ${file.originalName}`;
        }
      }
    }
    
    // Remove duplicates and uploader
    notificationTargets = [...new Set(notificationTargets)]
      .filter(userId => userId !== uploaderId);
    
    // Create notifications
    const notificationPromises = notificationTargets.map(userId => {
      return new Notification({
        recipient: userId,
        sender: uploaderId,
        project: projectId,
        task: file.task,
        type: 'file_uploaded',
        content,
        actionLink
      }).save();
    });
    
    await Promise.all(notificationPromises);
  } catch (error) {
    console.error('Error creating file version notifications:', error);
  }
};