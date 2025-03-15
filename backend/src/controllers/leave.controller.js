const Leave = require('../models/Leave');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Create a new leave request
exports.createLeave = async (req, res) => {
  try {
    const { 
      user: userId, 
      leaveType, 
      startDate, 
      endDate, 
      comments 
    } = req.body;
    
    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be before end date'
      });
    }
    
    // Check for overlapping leaves
    const overlappingLeaves = await Leave.find({
      user: userId,
      $or: [
        // Case 1: startDate falls between existing leave period
        { startDate: { $lte: start }, endDate: { $gte: start } },
        // Case 2: endDate falls between existing leave period
        { startDate: { $lte: end }, endDate: { $gte: end } },
        // Case 3: leave period contains existing period
        { startDate: { $gte: start }, endDate: { $lte: end } }
      ],
      status: { $in: ['pending', 'approved'] }
    });
    
    if (overlappingLeaves.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'There is already a leave request for this period',
        overlappingLeaves
      });
    }
    
    // Create new leave request
    const leave = new Leave({
      user: userId,
      leaveType,
      startDate,
      endDate,
      comments,
      createdBy: req.user.id
    });
    
    await leave.save();
    
    // If the user is creating leave for someone else and is an admin/manager,
    // automatically approve the leave
    if (req.user.id !== userId && 
        (req.user.role === 'admin' || req.user.role === 'manager')) {
      leave.status = 'approved';
      leave.approvedBy = req.user.id;
      leave.approvedDate = Date.now();
      await leave.save();
    }
    
    // Create notification for the user if created by someone else
    if (req.user.id !== userId) {
      await new Notification({
        recipient: userId,
        sender: req.user.id,
        type: 'leave_request',
        content: `A ${leaveType} leave has been ${leave.status} for you from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`,
        actionLink: '/admin/leaves'
      }).save();
    }
    
    // Create notification for admins and managers if self-requested
    if (req.user.id === userId) {
      const adminsAndManagers = await User.find({
        role: { $in: ['admin', 'manager'] },
        _id: { $ne: req.user.id }
      }).select('_id');
      
      const notificationPromises = adminsAndManagers.map(admin => {
        return new Notification({
          recipient: admin._id,
          sender: req.user.id,
          type: 'leave_request',
          content: `${req.user.firstName} ${req.user.lastName} has requested a ${leaveType} leave from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`,
          actionLink: '/admin/leaves'
        }).save();
      });
      
      await Promise.all(notificationPromises);
    }
    
    res.status(201).json({
      success: true,
      message: 'Leave request created successfully',
      leave
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error creating leave request',
      error: error.message
    });
  }
};

// Get all leaves
exports.getAllLeaves = async (req, res) => {
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
    
    // Filter by user (admin and managers can see all, users can only see their own)
    if (req.user.role === 'admin' || req.user.role === 'manager') {
      if (req.query.userId) {
        query.user = req.query.userId;
      }
    } else {
      query.user = req.user.id;
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

// Get leave by ID
exports.getLeaveById = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.leaveId)
      .populate('user', 'firstName lastName email department position')
      .populate('approvedBy', 'firstName lastName')
      .populate('createdBy', 'firstName lastName');
    
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }
    
    // Check if user is authorized to view this leave
    if (req.user.role !== 'admin' && 
        req.user.role !== 'manager' && 
        leave.user._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this leave request'
      });
    }
    
    res.status(200).json({
      success: true,
      leave
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving leave request',
      error: error.message
    });
  }
};

// Update leave request
exports.updateLeave = async (req, res) => {
  try {
    const { leaveType, startDate, endDate, comments } = req.body;
    
    const leave = await Leave.findById(req.params.leaveId)
      .populate('user', 'firstName lastName');
    
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }
    
    // Check if user is authorized to update this leave
    if (req.user.role !== 'admin' && 
        leave.user._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this leave request'
      });
    }
    
    // Check if leave is already approved or rejected
    if (leave.status !== 'pending' && req.user.role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: `Leave request cannot be updated as it is already ${leave.status}`
      });
    }
    
    // Validate dates
    const start = new Date(startDate || leave.startDate);
    const end = new Date(endDate || leave.endDate);
    
    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be before end date'
      });
    }
    
    // Check for overlapping leaves
    if (startDate || endDate) {
      const overlappingLeaves = await Leave.find({
        user: leave.user._id,
        _id: { $ne: leave._id },
        $or: [
          { startDate: { $lte: start }, endDate: { $gte: start } },
          { startDate: { $lte: end }, endDate: { $gte: end } },
          { startDate: { $gte: start }, endDate: { $lte: end } }
        ],
        status: { $in: ['pending', 'approved'] }
      });
      
      if (overlappingLeaves.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'There is already a leave request for this period',
          overlappingLeaves
        });
      }
    }
    
    // Update leave
    if (leaveType) leave.leaveType = leaveType;
    if (startDate) leave.startDate = startDate;
    if (endDate) leave.endDate = endDate;
    if (comments) leave.comments = comments;
    
    await leave.save();
    
    // Create notification for admins and managers if user updates own leave
    if (leave.user._id.toString() === req.user.id) {
      const adminsAndManagers = await User.find({
        role: { $in: ['admin', 'manager'] },
        _id: { $ne: req.user.id }
      }).select('_id');
      
      const notificationPromises = adminsAndManagers.map(admin => {
        return new Notification({
          recipient: admin._id,
          sender: req.user.id,
          type: 'leave_update',
          content: `${req.user.firstName} ${req.user.lastName} has updated their ${leave.leaveType} leave request`,
          actionLink: `/admin/leaves/${leave._id}`
        }).save();
      });
      
      await Promise.all(notificationPromises);
    } else {
      // Notify user if their leave was updated by admin/manager
      await new Notification({
        recipient: leave.user._id,
        sender: req.user.id,
        type: 'leave_update',
        content: `Your ${leave.leaveType} leave request has been updated`,
        actionLink: `/admin/leaves/${leave._id}`
      }).save();
    }
    
    res.status(200).json({
      success: true,
      message: 'Leave request updated successfully',
      leave
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error updating leave request',
      error: error.message
    });
  }
};

// Update leave status (approve/reject)
exports.updateLeaveStatus = async (req, res) => {
  try {
    const { status, comments } = req.body;
    
    // Validate status
    if (!['approved', 'rejected', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be approved, rejected, or cancelled.'
      });
    }
    
    const leave = await Leave.findById(req.params.leaveId)
      .populate('user', 'firstName lastName email');
    
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }
    
    // Check authorization
    if (status === 'cancelled') {
      // Only the user who created the leave or admin can cancel
      if (leave.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to cancel this leave request'
        });
      }
    } else {
      // Only admin or manager can approve/reject
      if (req.user.role !== 'admin' && req.user.role !== 'manager') {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to approve/reject leave requests'
        });
      }
    }
    
    // Update leave status
    leave.status = status;
    
    if (status === 'approved' || status === 'rejected') {
      leave.approvedBy = req.user.id;
      leave.approvedDate = Date.now();
    }
    
    if (comments) {
      leave.comments = (leave.comments ? leave.comments + '\n\n' : '') + 
                        `${status.toUpperCase()} COMMENT (${new Date().toLocaleDateString()}): ${comments}`;
    }
    
    await leave.save();
    
    // Create notification for the user
    if (leave.user._id.toString() !== req.user.id) {
      await new Notification({
        recipient: leave.user._id,
        sender: req.user.id,
        type: 'leave_status',
        content: `Your ${leave.leaveType} leave request has been ${status}`,
        actionLink: `/admin/leaves/${leave._id}`
      }).save();
    }
    
    res.status(200).json({
      success: true,
      message: `Leave request ${status} successfully`,
      leave
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error updating leave status',
      error: error.message
    });
  }
};

// Delete leave request
exports.deleteLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.leaveId);
    
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }
    
    // Only admin can delete
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete leave requests'
      });
    }
    
    await Leave.findByIdAndDelete(req.params.leaveId);
    
    res.status(200).json({
      success: true,
      message: 'Leave request deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error deleting leave request',
      error: error.message
    });
  }
};

// Get leaves for calendar view
exports.getLeavesForCalendar = async (req, res) => {
  try {
    const { start, end } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({
        success: false,
        message: 'Start and end dates are required'
      });
    }
    
    // Build query
    const query = {
      status: 'approved',
      $or: [
        // Leave starts within range
        { startDate: { $gte: new Date(start), $lte: new Date(end) } },
        // Leave ends within range
        { endDate: { $gte: new Date(start), $lte: new Date(end) } },
        // Leave spans the entire range
        { startDate: { $lte: new Date(start) }, endDate: { $gte: new Date(end) } }
      ]
    };
    
    // Admin and managers can see all approved leaves
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      query.user = req.user.id;
    }
    
    const leaves = await Leave.find(query)
      .populate('user', 'firstName lastName');
    
    // Format leaves for calendar display
    const calendarEvents = leaves.map(leave => ({
      id: leave._id,
      title: `${leave.user.firstName} ${leave.user.lastName} - ${leave.leaveType}`,
      start: leave.startDate,
      end: leave.endDate,
      allDay: true,
      color: getLeaveTypeColor(leave.leaveType),
      extendedProps: {
        leaveType: leave.leaveType,
        userId: leave.user._id,
        userName: `${leave.user.firstName} ${leave.user.lastName}`,
        dayCount: leave.dayCount
      }
    }));
    
    res.status(200).json({
      success: true,
      calendarEvents
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving leaves for calendar',
      error: error.message
    });
  }
};

// Get leave statistics
exports.getLeaveStatistics = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    
    // For admin/manager, can specify userId, otherwise use current user
    let userId = req.user.role === 'admin' || req.user.role === 'manager' 
      ? req.query.userId || null 
      : req.user.id;
    
    // Build query
    const query = {
      status: 'approved',
      startDate: { $gte: new Date(`${year}-01-01`) },
      endDate: { $lte: new Date(`${year}-12-31`) }
    };
    
    if (userId) {
      query.user = userId;
    }
    
    // Get all approved leaves for the year
    const leaves = await Leave.find(query);
    
    // Group by leave type
    const leavesByType = leaves.reduce((acc, leave) => {
      const type = leave.leaveType;
      if (!acc[type]) acc[type] = { count: 0, days: 0 };
      acc[type].count++;
      acc[type].days += leave.dayCount;
      return acc;
    }, {});
    
    // Group by month
    const leavesByMonth = Array(12).fill(0).map((_, i) => ({
      month: i + 1,
      days: 0,
      count: 0
    }));
    
    leaves.forEach(leave => {
      const startMonth = new Date(leave.startDate).getMonth();
      const endMonth = new Date(leave.endDate).getMonth();
      
      if (startMonth === endMonth) {
        leavesByMonth[startMonth].days += leave.dayCount;
        leavesByMonth[startMonth].count++;
      } else {
        // Split across months (simplified - not exact, but good enough for stats)
        const daysPerMonth = leave.dayCount / (endMonth - startMonth + 1);
        for (let m = startMonth; m <= endMonth; m++) {
          leavesByMonth[m].days += daysPerMonth;
          leavesByMonth[m].count++;
        }
      }
    });
    
    res.status(200).json({
      success: true,
      year,
      total: {
        count: leaves.length,
        days: leaves.reduce((sum, leave) => sum + leave.dayCount, 0)
      },
      byType: leavesByType,
      byMonth: leavesByMonth
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving leave statistics',
      error: error.message
    });
  }
};

// Request a new leave
exports.requestLeave = async (req, res) => {
  try {
    const { 
      leaveType, 
      startDate, 
      endDate, 
      comments 
    } = req.body;
    
    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be before end date'
      });
    }
    
    // Check for overlapping leaves
    const overlappingLeaves = await Leave.find({
      user: req.user.id,
      $or: [
        // Case 1: startDate falls between existing leave period
        { startDate: { $lte: start }, endDate: { $gte: start } },
        // Case 2: endDate falls between existing leave period
        { startDate: { $lte: end }, endDate: { $gte: end } },
        // Case 3: leave period contains existing period
        { startDate: { $gte: start }, endDate: { $lte: end } }
      ],
      status: { $in: ['pending', 'approved'] }
    });
    
    if (overlappingLeaves.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'There is already a leave request for this period',
        overlappingLeaves
      });
    }
    
    // Create new leave request
    const leave = new Leave({
      user: req.user.id,
      leaveType,
      startDate,
      endDate,
      comments,
      createdBy: req.user.id
    });
    
    await leave.save();
    
    // Create notification for admins and managers
    const adminsAndManagers = await User.find({
      role: { $in: ['admin', 'manager'] },
      _id: { $ne: req.user.id }
    }).select('_id');
    
    const notificationPromises = adminsAndManagers.map(admin => {
      return new Notification({
        recipient: admin._id,
        sender: req.user.id,
        type: 'leave_request',
        content: `${req.user.firstName} ${req.user.lastName} has requested a ${leaveType} leave from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`,
        actionLink: '/admin/leaves'
      }).save();
    });
    
    await Promise.all(notificationPromises);
    
    res.status(201).json({
      success: true,
      message: 'Leave request created successfully',
      leave
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error creating leave request',
      error: error.message
    });
  }
};

// Get my leaves
exports.getMyLeaves = async (req, res) => {
  try {
    // Build query based on filters
    const query = { user: req.user.id };
    
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
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get total count for pagination
    const total = await Leave.countDocuments(query);
    
    // Get leaves with pagination
    const leaves = await Leave.find(query)
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
      message: 'Server error retrieving your leave requests',
      error: error.message
    });
  }
};

// Get user leaves (for admin or manager)
exports.getUserLeaves = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Build query based on filters
    const query = { user: userId };
    
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
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get total count for pagination
    const total = await Leave.countDocuments(query);
    
    // Get leaves with pagination
    const leaves = await Leave.find(query)
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
      message: 'Server error retrieving user leave requests',
      error: error.message
    });
  }
};

// Get leave calendar (all approved leaves)
exports.getLeaveCalendar = async (req, res) => {
  try {
    // Build query for approved leaves
    const query = { status: 'approved' };
    
    // Filter by date range if provided
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
    
    // Get leaves
    const leaves = await Leave.find(query)
      .populate('user', 'firstName lastName email department position profilePicture')
      .sort({ startDate: 1 });
    
    // Format leaves for calendar view
    const calendarEvents = leaves.map(leave => {
      return {
        id: leave._id,
        title: `${leave.user.firstName} ${leave.user.lastName} - ${leave.leaveType}`,
        start: leave.startDate,
        end: leave.endDate,
        allDay: true,
        color: getLeaveTypeColor(leave.leaveType),
        extendedProps: {
          user: {
            id: leave.user._id,
            name: `${leave.user.firstName} ${leave.user.lastName}`,
            email: leave.user.email,
            department: leave.user.department,
            position: leave.user.position,
            profilePicture: leave.user.profilePicture
          },
          leaveType: leave.leaveType,
          comments: leave.comments,
          status: leave.status
        }
      };
    });
    
    res.status(200).json({
      success: true,
      count: calendarEvents.length,
      events: calendarEvents
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving leave calendar',
      error: error.message
    });
  }
};

// Helper function to get color for leave type
const getLeaveTypeColor = (leaveType) => {
  const colors = {
    vacation: '#4CAF50', // Green
    sick: '#F44336',     // Red
    study: '#2196F3',    // Blue
    personal: '#FF9800', // Orange
    maternity: '#9C27B0', // Purple
    paternity: '#673AB7', // Deep Purple
    others: '#607D8B'    // Blue Gray
  };
  
  return colors[leaveType] || '#607D8B';
};