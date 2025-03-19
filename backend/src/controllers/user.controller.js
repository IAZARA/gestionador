const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');

// Get all users (admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    
    res.status(200).json({
      success: true,
      users,
      count: users.length,
      total: users.length,
      pages: 1,
      currentPage: 1
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
    const { 
      firstName, 
      lastName, 
      email, 
      password,
      role, 
      expertiseArea, 
      idNumber, 
      birthDate, 
      address, 
      phone, 
      alternativePhone, 
      dependencyName, 
      dependencyPhone, 
      dependencyAddress, 
      bloodType, 
      drivingLicense 
    } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'El email ya está registrado'
      });
    }
    
    // Create new user
    const user = new User({
      firstName, 
      lastName, 
      email, 
      password: password || Math.random().toString(36).slice(-8), // Generar contraseña aleatoria si no se proporciona
      role: role || 'user', 
      expertiseArea: expertiseArea || 'administrative', 
      idNumber, 
      dateOfBirth: birthDate, 
      address: {
        street: address
      }, 
      primaryPhone: phone, 
      alternatePhone: alternativePhone, 
      department: dependencyName, 
      workPhone: dependencyPhone, 
      workAddress: {
        street: dependencyAddress
      }, 
      bloodType, 
      drivingLicense: {
        number: drivingLicense
      }
    });
    
    await user.save();
    
    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;
    
    res.status(201).json({
      success: true,
      message: 'Usuario creado correctamente',
      user: userResponse
    });
  } catch (error) {
    console.error('Error creating user:', error);
    
    // Manejar errores de validación de MongoDB
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: Object.keys(error.errors).reduce((acc, key) => {
          acc[key] = error.errors[key].message;
          return acc;
        }, {})
      });
    }
    
    // Manejar errores de duplicación (email único)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'El email o DNI ya está en uso',
        field: Object.keys(error.keyPattern)[0]
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error del servidor al crear el usuario',
      error: error.message
    });
  }
};

// Update user (admin only)
exports.updateUser = async (req, res) => {
  try {
    const { 
      firstName, 
      lastName, 
      email, 
      role, 
      expertiseArea, 
      idNumber,
      taxId,
      dateOfBirth,
      address,
      primaryPhone,
      alternatePhone,
      department,
      position,
      workAddress,
      workPhone,
      drivingLicense,
      bloodType
    } = req.body;
    
    // Build update object
    const updateFields = {};
    if (firstName) updateFields.firstName = firstName;
    if (lastName) updateFields.lastName = lastName;
    if (email) updateFields.email = email;
    if (role) updateFields.role = role;
    if (expertiseArea) updateFields.expertiseArea = expertiseArea;
    if (idNumber) updateFields.idNumber = idNumber;
    if (taxId) updateFields.taxId = taxId;
    if (dateOfBirth) updateFields.dateOfBirth = dateOfBirth;
    
    // Manejar objetos anidados
    if (address) updateFields.address = address;
    if (primaryPhone) updateFields.primaryPhone = primaryPhone;
    if (alternatePhone) updateFields.alternatePhone = alternatePhone;
    if (department) updateFields.department = department;
    if (position) updateFields.position = position;
    if (workAddress) updateFields.workAddress = workAddress;
    if (workPhone) updateFields.workPhone = workPhone;
    if (drivingLicense) updateFields.drivingLicense = drivingLicense;
    if (bloodType) updateFields.bloodType = bloodType;
    
    console.log('Actualizando usuario con campos:', updateFields);
    
    // Find and update user
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Usuario actualizado correctamente',
      user
    });
  } catch (error) {
    console.error('Error updating user:', error);
    
    // Manejar errores de validación de MongoDB
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: Object.keys(error.errors).reduce((acc, key) => {
          acc[key] = error.errors[key].message;
          return acc;
        }, {})
      });
    }
    
    // Manejar errores de duplicación (email único)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'El email o DNI ya está en uso',
        field: Object.keys(error.keyPattern)[0]
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error del servidor al actualizar el usuario',
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

// Get user statistics
exports.getUserStats = async (req, res) => {
  try {
    // Count users by role
    const usersByRole = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);
    
    // Count users by expertise
    const usersByExpertise = await User.aggregate([
      { $group: { _id: '$expertiseArea', count: { $sum: 1 } } }
    ]);
    
    // Get active vs inactive users
    const activeUsers = await User.countDocuments({ isActive: true });
    const inactiveUsers = await User.countDocuments({ isActive: false });
    
    res.status(200).json({
      success: true,
      stats: {
        total: await User.countDocuments(),
        active: activeUsers,
        inactive: inactiveUsers,
        byRole: usersByRole,
        byExpertise: usersByExpertise
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving user statistics',
      error: error.message
    });
  }
};

// Export users
exports.exportUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select('-password -passwordResetToken -passwordResetExpires')
      .sort({ lastName: 1, firstName: 1 });
    
    res.status(200).json({
      success: true,
      users: users.map(user => ({
        id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role,
        expertiseArea: user.expertiseArea,
        isActive: user.isActive
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error exporting users',
      error: error.message
    });
  }
};