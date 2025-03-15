const Notification = require('../models/Notification');

// Get all notifications for the current user
exports.getUserNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user.id })
      .populate('sender', 'firstName lastName profilePicture')
      .populate('project', 'name')
      .populate('task', 'title')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: notifications.length,
      notifications
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving notifications',
      error: error.message
    });
  }
};

// Get unread notifications count
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ 
      recipient: req.user.id,
      isRead: false
    });
    
    res.status(200).json({
      success: true,
      count
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error counting unread notifications',
      error: error.message
    });
  }
};

// Get notification count
exports.getNotificationCount = async (req, res) => {
  try {
    const totalCount = await Notification.countDocuments({ 
      recipient: req.user.id
    });
    
    const unreadCount = await Notification.countDocuments({ 
      recipient: req.user.id,
      isRead: false
    });
    
    res.status(200).json({
      success: true,
      totalCount,
      unreadCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error counting notifications',
      error: error.message
    });
  }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.notificationId);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    // Ensure the notification belongs to the user
    if (notification.recipient.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This notification does not belong to you.'
      });
    }
    
    notification.isRead = true;
    await notification.save();
    
    res.status(200).json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error marking notification as read',
      error: error.message
    });
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, isRead: false },
      { isRead: true }
    );
    
    res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error marking all notifications as read',
      error: error.message
    });
  }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.notificationId);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    // Ensure the notification belongs to the user
    if (notification.recipient.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This notification does not belong to you.'
      });
    }
    
    await Notification.findByIdAndDelete(req.params.notificationId);
    
    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error deleting notification',
      error: error.message
    });
  }
};

// Delete all notifications
exports.deleteAllNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ recipient: req.user.id });
    
    res.status(200).json({
      success: true,
      message: 'All notifications deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error deleting all notifications',
      error: error.message
    });
  }
};

// Get notifications for a specific project
exports.getProjectNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ 
      recipient: req.user.id,
      project: req.params.projectId
    })
    .populate('sender', 'firstName lastName profilePicture')
    .populate('task', 'title')
    .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: notifications.length,
      notifications
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving project notifications',
      error: error.message
    });
  }
};

// Create admin announcement notification for all users
exports.createAnnouncement = async (req, res) => {
  try {
    const { content, actionLink } = req.body;
    
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can create announcements'
      });
    }
    
    // Get all active users
    const User = require('../models/User');
    const users = await User.find({ isActive: true }).select('_id');
    
    // Create notifications
    const notificationPromises = users.map(user => {
      return new Notification({
        recipient: user._id,
        sender: req.user.id,
        type: 'admin_announcement',
        content,
        actionLink
      }).save();
    });
    
    await Promise.all(notificationPromises);
    
    res.status(201).json({
      success: true,
      message: `Announcement sent to ${users.length} users`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error creating announcement',
      error: error.message
    });
  }
};