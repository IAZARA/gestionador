const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');

// Get all users (admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    
    res.status(200).json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving users',
      error: error.message
    });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving user',
      error: error.message
    });
  }
};

// Create new user (admin only)
exports.createUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, expertiseArea } = req.body;
    
    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }
    
    // Create new user
    user = new User({
      firstName,
      lastName,
      email,
      password,
      role,
      expertiseArea
    });
    
    await user.save();
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        expertiseArea: user.expertiseArea
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error creating user',
      error: error.message
    });
  }
};

// Update user (admin only)
exports.updateUser = async (req, res) => {
  try {
    const { firstName, lastName, email, role, expertiseArea, isActive } = req.body;
    
    // Build update object
    const updateFields = {};
    if (firstName) updateFields.firstName = firstName;
    if (lastName) updateFields.lastName = lastName;
    if (email) updateFields.email = email;
    if (role) updateFields.role = role;
    if (expertiseArea) updateFields.expertiseArea = expertiseArea;
    if (isActive !== undefined) updateFields.isActive = isActive;
    
    // Find and update user
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error updating user',
      error: error.message
    });
  }
};

// Delete user (admin only)
exports.deleteUser = async (req, res) => {
  try {
    // Check if user exists
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Delete user
    await User.findByIdAndDelete(req.params.userId);
    
    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error deleting user',
      error: error.message
    });
  }
};

// Reset user password (admin only)
exports.resetUserPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    
    // Find user
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Set new password and reset any locked status
    user.password = newPassword;
    user.failedLoginAttempts = 0;
    user.isActive = true;
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'User password reset successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error resetting user password',
      error: error.message
    });
  }
};

// Get user projects
exports.getUserProjects = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;
    
    // Find projects where user is owner or member
    const ownedProjects = await Project.find({ owner: userId })
      .sort({ updatedAt: -1 });
      
    const memberProjects = await Project.find({ 
      'members.user': userId 
    }).sort({ updatedAt: -1 });
    
    res.status(200).json({
      success: true,
      ownedProjects,
      memberProjects
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving user projects',
      error: error.message
    });
  }
};

// Get user tasks
exports.getUserTasks = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;
    
    // Find tasks assigned to user
    const assignedTasks = await Task.find({ 
      assignedTo: userId 
    })
    .populate('project', 'name')
    .sort({ dueDate: 1 });
    
    // Find tasks created by user
    const createdTasks = await Task.find({ 
      createdBy: userId 
    })
    .populate('project', 'name')
    .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      assignedTasks,
      createdTasks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving user tasks',
      error: error.message
    });
  }
};

// Get users by expertise
exports.getUsersByExpertise = async (req, res) => {
  try {
    const { expertiseArea } = req.params;
    
    // Validate expertise area
    if (!['administrative', 'technical', 'legal'].includes(expertiseArea)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid expertise area'
      });
    }
    
    const users = await User.find({ 
      expertiseArea,
      isActive: true
    }).select('-password');
    
    res.status(200).json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving users by expertise',
      error: error.message
    });
  }
};

// Get user workload (tasks assigned, grouped by status)
exports.getUserWorkload = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;
    
    // Aggregate tasks by status
    const workload = await Task.aggregate([
      { $match: { assignedTo: userId } },
      { $group: {
        _id: '$status',
        count: { $sum: 1 },
        tasks: { $push: { id: '$_id', title: '$title', dueDate: '$dueDate', priority: '$priority' } }
      }},
      { $sort: { count: -1 } }
    ]);
    
    // Calculate upcoming deadlines
    const upcomingDeadlines = await Task.find({
      assignedTo: userId,
      status: { $ne: 'Completed' },
      dueDate: { $gte: new Date(), $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } // Next 7 days
    })
    .sort({ dueDate: 1 })
    .limit(5);
    
    res.status(200).json({
      success: true,
      workload,
      upcomingDeadlines
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving user workload',
      error: error.message
    });
  }
};