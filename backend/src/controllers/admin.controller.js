const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Leave = require('../models/Leave');
const Document = require('../models/Document');
const Folder = require('../models/Folder');
const fs = require('fs');
const path = require('path');

// Get admin dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    // Get counts
    const userCount = await User.countDocuments();
    const activeUserCount = await User.countDocuments({ isActive: true });
    const projectCount = await Project.countDocuments();
    const taskCount = await Task.countDocuments();
    const pendingLeaveCount = await Leave.countDocuments({ status: 'pending' });
    const documentsCount = await Document.countDocuments();
    
    // Get recent activities
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('firstName lastName email role expertiseArea createdAt');
      
    const recentProjects = await Project.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name status progress owner')
      .populate('owner', 'firstName lastName');
    
    const recentLeaves = await Leave.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('user', 'firstName lastName')
      .select('user leaveType startDate endDate status');
    
    // Get active projects by status
    const projectsByStatus = await Project.aggregate([
      { $group: {
        _id: '$status',
        count: { $sum: 1 }
      }},
      { $sort: { count: -1 } }
    ]);
    
    // Get active tasks by status
    const tasksByStatus = await Task.aggregate([
      { $group: {
        _id: '$status',
        count: { $sum: 1 }
      }},
      { $sort: { count: -1 } }
    ]);
    
    // Get users by expertise
    const usersByExpertise = await User.aggregate([
      { $group: {
        _id: '$expertiseArea',
        count: { $sum: 1 }
      }},
      { $sort: { count: -1 } }
    ]);
    
    // Get disk usage for documents
    const diskUsage = await Document.aggregate([
      { $group: {
        _id: null,
        totalSize: { $sum: '$fileSize' },
        count: { $sum: 1 }
      }}
    ]);
    
    // Format disk usage in MB
    const totalDiskUsage = diskUsage.length > 0 
      ? Math.round(diskUsage[0].totalSize / (1024 * 1024) * 100) / 100
      : 0;
    
    res.status(200).json({
      success: true,
      stats: {
        counts: {
          users: userCount,
          activeUsers: activeUserCount,
          projects: projectCount,
          tasks: taskCount,
          pendingLeaves: pendingLeaveCount,
          documents: documentsCount
        },
        distribution: {
          projectsByStatus,
          tasksByStatus,
          usersByExpertise
        },
        diskUsage: {
          totalMB: totalDiskUsage,
          documentsCount: diskUsage.length > 0 ? diskUsage[0].count : 0
        },
        recent: {
          users: recentUsers,
          projects: recentProjects,
          leaves: recentLeaves
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving dashboard statistics',
      error: error.message
    });
  }
};

// Get user statistics for admin
exports.getUserStats = async (req, res) => {
  try {
    // Count users by role
    const usersByRole = await User.aggregate([
      { $group: {
        _id: '$role',
        count: { $sum: 1 }
      }}
    ]);
    
    // Count users by expertise
    const usersByExpertise = await User.aggregate([
      { $group: {
        _id: '$expertiseArea',
        count: { $sum: 1 }
      }}
    ]);
    
    // Get active vs inactive users
    const activeUsers = await User.countDocuments({ isActive: true });
    const inactiveUsers = await User.countDocuments({ isActive: false });
    
    // Get users with recent activity (login in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentlyActiveUsers = await User.countDocuments({
      lastLogin: { $gte: thirtyDaysAgo }
    });
    
    // Get user growth over time (by month for the last year)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    const userGrowth = await User.aggregate([
      { $match: { createdAt: { $gte: twelveMonthsAgo } } },
      { $group: {
        _id: { 
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        count: { $sum: 1 }
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
    
    // Format user growth data
    const formattedUserGrowth = userGrowth.map(item => ({
      date: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
      count: item.count
    }));
    
    res.status(200).json({
      success: true,
      stats: {
        total: await User.countDocuments(),
        active: activeUsers,
        inactive: inactiveUsers,
        recentlyActive: recentlyActiveUsers,
        byRole: usersByRole,
        byExpertise: usersByExpertise,
        growth: formattedUserGrowth
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

// Get detailed user information for personnel management
exports.getAllUserDetails = async (req, res) => {
  try {
    // Build query based on filters
    const query = {};
    
    // Filter by active status
    if (req.query.status === 'active') {
      query.isActive = true;
    } else if (req.query.status === 'inactive') {
      query.isActive = false;
    }
    
    // Filter by role
    if (req.query.role && ['admin', 'manager', 'user'].includes(req.query.role)) {
      query.role = req.query.role;
    }
    
    // Filter by expertise
    if (req.query.expertise && ['administrative', 'technical', 'legal'].includes(req.query.expertise)) {
      query.expertiseArea = req.query.expertise;
    }
    
    // Filter by search term
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      query.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { department: searchRegex },
        { position: searchRegex },
        { idNumber: searchRegex }
      ];
    }
    
    // Set the fields to return
    const fields = 'firstName lastName email role expertiseArea profilePicture isActive lastLogin department position dateOfBirth idNumber taxId primaryPhone alternatePhone workPhone bloodType createdAt';
    
    // Get total count for pagination
    const total = await User.countDocuments(query);
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get users with pagination
    const users = await User.find(query)
      .select(fields)
      .sort(req.query.sort || 'lastName')
      .skip(skip)
      .limit(limit);
    
    // Get additional data for each user
    const usersWithData = await Promise.all(users.map(async user => {
      // Get project count
      const projectCount = await Project.countDocuments({ 
        $or: [
          { owner: user._id },
          { 'members.user': user._id }
        ]
      });
      
      // Get task count
      const taskCount = await Task.countDocuments({
        assignedTo: user._id
      });
      
      // Get leave data
      const leaveData = await Leave.aggregate([
        { $match: { user: user._id, status: 'approved' } },
        { $group: {
          _id: '$leaveType',
          count: { $sum: 1 },
          days: { $sum: '$dayCount' }
        }}
      ]);
      
      // Format leave data
      const leaves = {};
      leaveData.forEach(item => {
        leaves[item._id] = { count: item.count, days: item.days };
      });
      
      // Return enriched user data
      return {
        ...user.toObject(),
        stats: {
          projectCount,
          taskCount,
          leaves
        }
      };
    }));
    
    res.status(200).json({
      success: true,
      count: users.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      users: usersWithData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving user details',
      error: error.message
    });
  }
};

// Get user audit history
exports.getUserAuditHistory = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('firstName lastName email changeHistory')
      .populate('changeHistory.changedBy', 'firstName lastName email');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Sort history by most recent first
    const sortedHistory = user.changeHistory.sort((a, b) => 
      new Date(b.changedAt) - new Date(a.changedAt)
    );
    
    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      },
      history: sortedHistory
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving user audit history',
      error: error.message
    });
  }
};

// Update user and track changes for audit
exports.updateUserWithAudit = async (req, res) => {
  try {
    const userId = req.params.userId;
    const updates = req.body;
    
    // Get user before update
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Track changes for audit
    const changes = [];
    
    // Compare each field and record changes
    Object.entries(updates).forEach(([field, newValue]) => {
      // Skip certain fields
      if (['password', 'passwordResetToken', 'passwordResetExpires', 
           'changeHistory', 'lastUpdatedBy'].includes(field)) {
        return;
      }
      
      // Handle nested objects
      if (typeof newValue === 'object' && newValue !== null && !Array.isArray(newValue)) {
        Object.entries(newValue).forEach(([subField, subValue]) => {
          const fullField = `${field}.${subField}`;
          const oldValue = user[field] ? user[field][subField] : undefined;
          
          if (JSON.stringify(oldValue) !== JSON.stringify(subValue)) {
            changes.push({
              field: fullField,
              oldValue: JSON.stringify(oldValue),
              newValue: JSON.stringify(subValue),
              changedBy: req.user.id,
              changedAt: new Date()
            });
          }
        });
      } else {
        // Handle regular fields
        const oldValue = user[field];
        
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          changes.push({
            field,
            oldValue: JSON.stringify(oldValue),
            newValue: JSON.stringify(newValue),
            changedBy: req.user.id,
            changedAt: new Date()
          });
        }
      }
    });
    
    // Add changes to history
    if (changes.length > 0) {
      user.changeHistory.push(...changes);
      user.lastUpdatedBy = req.user.id;
    }
    
    // Update user fields
    Object.entries(updates).forEach(([field, value]) => {
      if (field !== 'changeHistory' && field !== 'lastUpdatedBy') {
        user[field] = value;
      }
    });
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        expertiseArea: user.expertiseArea,
        isActive: user.isActive
      },
      changes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error updating user',
      error: error.message
    });
  }
};

// Get disk usage statistics
exports.getDiskUsageStats = async (req, res) => {
  try {
    // Get total disk usage by document types
    const usageByType = await Document.aggregate([
      { $group: {
        _id: { $regexFind: { input: '$fileType', regex: /^[^\/]+/ } },
        size: { $sum: '$fileSize' },
        count: { $sum: 1 }
      }},
      { $sort: { size: -1 } }
    ]);
    
    // Format type data
    const formattedUsageByType = usageByType.map(item => ({
      type: item._id ? item._id.match[0] : 'unknown',
      sizeMB: Math.round(item.size / (1024 * 1024) * 100) / 100,
      count: item.count
    }));
    
    // Get usage by folder
    const usageByFolder = await Document.aggregate([
      { $group: {
        _id: '$folder',
        size: { $sum: '$fileSize' },
        count: { $sum: 1 }
      }},
      { $sort: { size: -1 } }
    ]);
    
    // Get usage by user
    const usageByUser = await Document.aggregate([
      { $group: {
        _id: '$uploadedBy',
        size: { $sum: '$fileSize' },
        count: { $sum: 1 }
      }},
      { $sort: { size: -1 } },
      { $limit: 10 }
    ]);
    
    // Get user details for usageByUser
    const userIds = usageByUser.map(item => item._id);
    const users = await User.find({ _id: { $in: userIds } })
      .select('firstName lastName email');
    
    // Map user details to usage
    const formattedUsageByUser = usageByUser.map(item => {
      const user = users.find(u => u._id.toString() === item._id.toString());
      return {
        userId: item._id,
        user: user ? `${user.firstName} ${user.lastName}` : 'Unknown User',
        email: user ? user.email : 'unknown',
        sizeMB: Math.round(item.size / (1024 * 1024) * 100) / 100,
        count: item.count
      };
    });
    
    // Get total disk usage
    const totalUsage = await Document.aggregate([
      { $group: {
        _id: null,
        size: { $sum: '$fileSize' },
        count: { $sum: 1 }
      }}
    ]);
    
    res.status(200).json({
      success: true,
      stats: {
        total: {
          sizeMB: totalUsage.length > 0 
            ? Math.round(totalUsage[0].size / (1024 * 1024) * 100) / 100
            : 0,
          count: totalUsage.length > 0 ? totalUsage[0].count : 0
        },
        byType: formattedUsageByType,
        byFolder: usageByFolder,
        byUser: formattedUsageByUser
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving disk usage statistics',
      error: error.message
    });
  }
};

// Export user data to CSV
exports.exportUsersToCsv = async (req, res) => {
  try {
    // Build query based on filters
    const query = {};
    
    // Filter by active status
    if (req.query.status === 'active') {
      query.isActive = true;
    } else if (req.query.status === 'inactive') {
      query.isActive = false;
    }
    
    // Filter by role
    if (req.query.role && ['admin', 'manager', 'user'].includes(req.query.role)) {
      query.role = req.query.role;
    }
    
    // Filter by expertise
    if (req.query.expertise && ['administrative', 'technical', 'legal'].includes(req.query.expertise)) {
      query.expertiseArea = req.query.expertise;
    }
    
    // Get users
    const users = await User.find(query)
      .select('-password -passwordResetToken -passwordResetExpires -failedLoginAttempts -notificationPreferences -changeHistory');
    
    // Convert to CSV
    const csvRows = [];
    
    // Add header row
    const headers = [
      'ID', 'First Name', 'Last Name', 'Email', 'Role', 'Expertise Area',
      'Department', 'Position', 'Date of Birth', 'ID Number', 'Tax ID',
      'Primary Phone', 'Alt Phone', 'Work Phone', 'Blood Type',
      'Address', 'Work Address', 'Emergency Contact', 'Active', 'Created At'
    ];
    csvRows.push(headers.join(','));
    
    // Add data rows
    users.forEach(user => {
      const row = [
        user._id,
        user.firstName,
        user.lastName,
        user.email,
        user.role,
        user.expertiseArea,
        user.department || '',
        user.position || '',
        user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '',
        user.idNumber || '',
        user.taxId || '',
        user.primaryPhone || '',
        user.alternatePhone || '',
        user.workPhone || '',
        user.bloodType || '',
        user.address ? `${user.address.street} ${user.address.city} ${user.address.state} ${user.address.postalCode} ${user.address.country}`.trim() : '',
        user.workAddress ? `${user.workAddress.street} ${user.workAddress.city} ${user.workAddress.state} ${user.workAddress.postalCode}`.trim() : '',
        user.emergencyContact ? `${user.emergencyContact.name} (${user.emergencyContact.relationship}) ${user.emergencyContact.phone}`.trim() : '',
        user.isActive ? 'Yes' : 'No',
        new Date(user.createdAt).toISOString()
      ].map(field => {
        // Escape quotes and wrap in quotes
        if (field === null || field === undefined) return '""';
        return `"${String(field).replace(/"/g, '""')}"`;
      });
      
      csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    
    // Set response headers
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
    
    // Send CSV content
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error exporting users',
      error: error.message
    });
  }
};

// Export leave data to CSV
exports.exportLeavesToCsv = async (req, res) => {
  try {
    // Build query based on filters
    const query = {};
    
    // Filter by status
    if (req.query.status && ['pending', 'approved', 'rejected', 'cancelled'].includes(req.query.status)) {
      query.status = req.query.status;
    }
    
    // Filter by leave type
    if (req.query.leaveType && ['vacation', 'sick', 'study', 'personal', 'maternity', 'paternity', 'others'].includes(req.query.leaveType)) {
      query.leaveType = req.query.leaveType;
    }
    
    // Filter by date range
    if (req.query.from && req.query.to) {
      query.$or = [
        { startDate: { $gte: new Date(req.query.from), $lte: new Date(req.query.to) } },
        { endDate: { $gte: new Date(req.query.from), $lte: new Date(req.query.to) } },
        { startDate: { $lte: new Date(req.query.from) }, endDate: { $gte: new Date(req.query.to) } }
      ];
    }
    
    // Get leaves with user and approver info
    const leaves = await Leave.find(query)
      .populate('user', 'firstName lastName email department position')
      .populate('approvedBy', 'firstName lastName')
      .populate('createdBy', 'firstName lastName')
      .sort({ startDate: -1 });
    
    // Convert to CSV
    const csvRows = [];
    
    // Add header row
    const headers = [
      'ID', 'User', 'Email', 'Department', 'Position', 'Leave Type',
      'Start Date', 'End Date', 'Days', 'Status', 'Approved By',
      'Approved Date', 'Created By', 'Created At', 'Comments'
    ];
    csvRows.push(headers.join(','));
    
    // Add data rows
    leaves.forEach(leave => {
      const row = [
        leave._id,
        leave.user ? `${leave.user.firstName} ${leave.user.lastName}` : 'Unknown User',
        leave.user ? leave.user.email : '',
        leave.user ? leave.user.department || '' : '',
        leave.user ? leave.user.position || '' : '',
        leave.leaveType,
        new Date(leave.startDate).toISOString().split('T')[0],
        new Date(leave.endDate).toISOString().split('T')[0],
        leave.dayCount,
        leave.status,
        leave.approvedBy ? `${leave.approvedBy.firstName} ${leave.approvedBy.lastName}` : '',
        leave.approvedDate ? new Date(leave.approvedDate).toISOString() : '',
        leave.createdBy ? `${leave.createdBy.firstName} ${leave.createdBy.lastName}` : '',
        new Date(leave.createdAt).toISOString(),
        leave.comments || ''
      ].map(field => {
        // Escape quotes and wrap in quotes
        if (field === null || field === undefined) return '""';
        return `"${String(field).replace(/"/g, '""')}"`;
      });
      
      csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    
    // Set response headers
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=leaves.csv');
    
    // Send CSV content
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error exporting leaves',
      error: error.message
    });
  }
};

// Get all users details
exports.getAllUsersDetails = async (req, res) => {
  try {
    // Build query based on filters
    const query = {};
    
    // Filter by active status
    if (req.query.status === 'active') {
      query.isActive = true;
    } else if (req.query.status === 'inactive') {
      query.isActive = false;
    }
    
    // Filter by role
    if (req.query.role) {
      query.role = req.query.role;
    }
    
    // Filter by expertise area
    if (req.query.expertiseArea) {
      query.expertiseArea = req.query.expertiseArea;
    }
    
    // Search by name or email
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      query.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex }
      ];
    }
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get total count for pagination
    const total = await User.countDocuments(query);
    
    // Get users with pagination
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    res.status(200).json({
      success: true,
      count: users.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
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

// Toggle user active status
exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Toggle status
    user.isActive = !user.isActive;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isActive: user.isActive
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error toggling user status',
      error: error.message
    });
  }
};

// Change user role
exports.changeUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    
    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'Role is required'
      });
    }
    
    // Validate role
    const validRoles = ['user', 'manager', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }
    
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Update role
    user.role = role;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: `User role changed to ${role} successfully`,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error changing user role',
      error: error.message
    });
  }
};

// Get all projects details
exports.getAllProjectsDetails = async (req, res) => {
  try {
    // Build query based on filters
    const query = {};
    
    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }
    
    // Search by name
    if (req.query.search) {
      query.name = new RegExp(req.query.search, 'i');
    }
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get total count for pagination
    const total = await Project.countDocuments(query);
    
    // Get projects with pagination
    const projects = await Project.find(query)
      .populate('owner', 'firstName lastName email')
      .populate('members.user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    res.status(200).json({
      success: true,
      count: projects.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      projects
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving projects',
      error: error.message
    });
  }
};

// Update project status
exports.updateProjectStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }
    
    // Validate status
    const validStatuses = ['planning', 'in-progress', 'on-hold', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }
    
    const project = await Project.findById(req.params.projectId);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Update status
    project.status = status;
    
    // If project is completed, set completion date
    if (status === 'completed' && !project.completedAt) {
      project.completedAt = Date.now();
    } else if (status !== 'completed') {
      project.completedAt = null;
    }
    
    await project.save();
    
    res.status(200).json({
      success: true,
      message: `Project status updated to ${status} successfully`,
      project: {
        _id: project._id,
        name: project.name,
        status: project.status,
        completedAt: project.completedAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error updating project status',
      error: error.message
    });
  }
};

// Get system logs
exports.getSystemLogs = async (req, res) => {
  try {
    // This is a placeholder for actual system log retrieval
    // In a real implementation, you would retrieve logs from a database or log files
    
    // Simulate log data for demonstration
    const logs = [
      { timestamp: new Date(), level: 'info', message: 'System started', source: 'server' },
      { timestamp: new Date(Date.now() - 1000 * 60), level: 'warning', message: 'High memory usage detected', source: 'monitor' },
      { timestamp: new Date(Date.now() - 1000 * 60 * 5), level: 'error', message: 'Database connection error', source: 'database' },
      { timestamp: new Date(Date.now() - 1000 * 60 * 10), level: 'info', message: 'User login', source: 'auth', user: 'admin@example.com' },
      { timestamp: new Date(Date.now() - 1000 * 60 * 15), level: 'info', message: 'Backup completed', source: 'backup' }
    ];
    
    res.status(200).json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving system logs',
      error: error.message
    });
  }
};

// Get activity logs
exports.getActivityLogs = async (req, res) => {
  try {
    // This is a placeholder for actual activity log retrieval
    // In a real implementation, you would retrieve activity logs from a database
    
    // Simulate activity data for demonstration
    const activities = [
      { timestamp: new Date(), type: 'login', user: 'admin@example.com', details: 'Admin logged in' },
      { timestamp: new Date(Date.now() - 1000 * 60 * 30), type: 'project_create', user: 'manager@example.com', details: 'Created new project "Website Redesign"' },
      { timestamp: new Date(Date.now() - 1000 * 60 * 60), type: 'task_update', user: 'user@example.com', details: 'Updated task "Design Homepage" status to "completed"' },
      { timestamp: new Date(Date.now() - 1000 * 60 * 90), type: 'document_upload', user: 'user2@example.com', details: 'Uploaded document "Project Requirements.pdf"' },
      { timestamp: new Date(Date.now() - 1000 * 60 * 120), type: 'user_create', user: 'admin@example.com', details: 'Created new user account for "john.doe@example.com"' }
    ];
    
    res.status(200).json({
      success: true,
      count: activities.length,
      activities
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving activity logs',
      error: error.message
    });
  }
};

// Generate user report
exports.generateUserReport = async (req, res) => {
  try {
    // Get all users
    const users = await User.find()
      .select('-password')
      .sort({ lastName: 1, firstName: 1 });
    
    // Get counts by role
    const roleStats = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);
    
    // Get counts by active status
    const activeCount = await User.countDocuments({ isActive: true });
    const inactiveCount = await User.countDocuments({ isActive: false });
    
    // Get counts by expertise area
    const expertiseStats = await User.aggregate([
      { $group: { _id: '$expertiseArea', count: { $sum: 1 } } }
    ]);
    
    // Get counts by department
    const departmentStats = await User.aggregate([
      { $group: { _id: '$department', count: { $sum: 1 } } }
    ]);
    
    res.status(200).json({
      success: true,
      report: {
        generatedAt: new Date(),
        totalUsers: users.length,
        activeUsers: activeCount,
        inactiveUsers: inactiveCount,
        byRole: roleStats,
        byExpertise: expertiseStats,
        byDepartment: departmentStats,
        users: users.map(user => ({
          id: user._id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          role: user.role,
          department: user.department,
          position: user.position,
          expertiseArea: user.expertiseArea,
          isActive: user.isActive,
          createdAt: user.createdAt
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error generating user report',
      error: error.message
    });
  }
};

// Generate project report
exports.generateProjectReport = async (req, res) => {
  try {
    // Get all projects
    const projects = await Project.find()
      .populate('owner', 'firstName lastName email')
      .populate('members.user', 'firstName lastName email')
      .sort({ createdAt: -1 });
    
    // Get counts by status
    const statusStats = await Project.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    // Get counts by priority
    const priorityStats = await Project.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);
    
    // Get average project duration (in days)
    const completedProjects = projects.filter(p => p.status === 'completed' && p.completedAt);
    let avgDuration = 0;
    
    if (completedProjects.length > 0) {
      const totalDuration = completedProjects.reduce((sum, project) => {
        const duration = (new Date(project.completedAt) - new Date(project.createdAt)) / (1000 * 60 * 60 * 24); // in days
        return sum + duration;
      }, 0);
      
      avgDuration = totalDuration / completedProjects.length;
    }
    
    res.status(200).json({
      success: true,
      report: {
        generatedAt: new Date(),
        totalProjects: projects.length,
        completedProjects: completedProjects.length,
        avgDurationDays: Math.round(avgDuration * 10) / 10,
        byStatus: statusStats,
        byPriority: priorityStats,
        projects: projects.map(project => ({
          id: project._id,
          name: project.name,
          description: project.description,
          status: project.status,
          priority: project.priority,
          progress: project.progress,
          owner: `${project.owner.firstName} ${project.owner.lastName}`,
          memberCount: project.members.length,
          createdAt: project.createdAt,
          completedAt: project.completedAt
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error generating project report',
      error: error.message
    });
  }
};

// Get all leaves for admin
exports.getAllLeavesAdmin = async (req, res) => {
  try {
    // Build query based on filters
    const query = {};
    
    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }
    
    // Filter by leave type
    if (req.query.leaveType) {
      query.leaveType = req.query.leaveType;
    }
    
    // Filter by date range
    if (req.query.from && req.query.to) {
      query.$or = [
        // Leave starts within range
        { startDate: { $gte: new Date(req.query.from), $lte: new Date(req.query.to) } },
        // Leave ends within range
        { endDate: { $gte: new Date(req.query.from), $lte: new Date(req.query.to) } },
        // Leave spans the entire range
        { startDate: { $lte: new Date(req.query.from) }, endDate: { $gte: new Date(req.query.to) } }
      ];
    }
    
    // Filter by user
    if (req.query.userId) {
      query.user = req.query.userId;
    }
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get total count for pagination
    const total = await Leave.countDocuments(query);
    
    // Get leaves with pagination
    const leaves = await Leave.find(query)
      .populate('user', 'firstName lastName email department position')
      .populate('approvedBy', 'firstName lastName')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    res.status(200).json({
      success: true,
      count: leaves.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      leaves
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving leave requests',
      error: error.message
    });
  }
};