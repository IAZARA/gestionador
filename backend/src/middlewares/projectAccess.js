const Project = require('../models/Project');

// Middleware to check if user has access to a project
exports.canAccessProject = async (req, res, next) => {
  try {
    const projectId = req.params.projectId || req.body.projectId;
    
    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required'
      });
    }
    
    const project = await Project.findById(projectId);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Admin has access to all projects
    if (req.user.role === 'admin') {
      req.project = project;
      return next();
    }
    
    // Check if user is the owner or a member of the project
    const isOwner = project.isOwner(req.user._id);
    const isMember = project.isMember(req.user._id);
    
    if (!isOwner && !isMember) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not a member of this project.'
      });
    }
    
    // Add project to the request object for use in following middlewares or route handlers
    req.project = project;
    req.isProjectOwner = isOwner;
    req.isProjectManager = project.isManager(req.user._id);
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Middleware to check if user is project owner or admin
exports.isProjectOwnerOrAdmin = async (req, res, next) => {
  try {
    // If the user is an admin, allow access
    if (req.user.role === 'admin') {
      return next();
    }
    
    // If project is already retrieved (by canAccessProject middleware)
    if (req.project) {
      if (req.isProjectOwner) {
        return next();
      }
    } else {
      const projectId = req.params.projectId || req.body.projectId;
      
      if (!projectId) {
        return res.status(400).json({
          success: false,
          message: 'Project ID is required'
        });
      }
      
      const project = await Project.findById(projectId);
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      if (project.isOwner(req.user._id)) {
        req.project = project;
        return next();
      }
    }
    
    res.status(403).json({
      success: false,
      message: 'Access denied. Only project owner or admin can perform this action.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Middleware to check if user is project manager, owner or admin
exports.isProjectManagerOrOwner = async (req, res, next) => {
  try {
    // If the user is an admin, allow access
    if (req.user.role === 'admin') {
      return next();
    }
    
    // If project is already retrieved (by canAccessProject middleware)
    if (req.project) {
      if (req.isProjectOwner || req.isProjectManager) {
        return next();
      }
    } else {
      const projectId = req.params.projectId || req.body.projectId;
      
      if (!projectId) {
        return res.status(400).json({
          success: false,
          message: 'Project ID is required'
        });
      }
      
      const project = await Project.findById(projectId);
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      if (project.isOwner(req.user._id) || project.isManager(req.user._id)) {
        req.project = project;
        return next();
      }
    }
    
    res.status(403).json({
      success: false,
      message: 'Access denied. Only project manager, owner or admin can perform this action.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Middleware to check if user is a project member
exports.isProjectMember = async (req, res, next) => {
  try {
    const projectId = req.params.projectId || req.body.projectId;
    
    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required'
      });
    }
    
    const project = await Project.findById(projectId);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Admin has access to all projects
    if (req.user.role === 'admin') {
      req.project = project;
      return next();
    }
    
    // Check if user is the owner or a member of the project
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some(member => member.user.toString() === req.user._id.toString());
    
    if (!isOwner && !isMember) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not a member of this project.'
      });
    }
    
    // Add project to the request object for use in following middlewares or route handlers
    req.project = project;
    req.isProjectOwner = isOwner;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Middleware to check if user is a project manager
exports.isProjectManager = async (req, res, next) => {
  try {
    const projectId = req.params.projectId || req.body.projectId;
    
    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required'
      });
    }
    
    const project = await Project.findById(projectId);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Admin has access to all projects
    if (req.user.role === 'admin') {
      req.project = project;
      return next();
    }
    
    // Check if user is the owner
    const isOwner = project.owner.toString() === req.user._id.toString();
    
    if (isOwner) {
      req.project = project;
      req.isProjectOwner = true;
      return next();
    }
    
    // Check if user is a manager in the project
    const isManager = project.members.some(member => 
      member.user.toString() === req.user._id.toString() && member.role === 'manager'
    );
    
    if (!isManager) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only project managers can perform this action.'
      });
    }
    
    // Add project to the request object
    req.project = project;
    req.isProjectManager = true;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};