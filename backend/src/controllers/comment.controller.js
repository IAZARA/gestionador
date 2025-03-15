const Comment = require('../models/Comment');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Notification = require('../models/Notification');

// Create a new comment
exports.createComment = async (req, res) => {
  try {
    const { content, project, task, parentComment } = req.body;
    
    // Check that either project or task is provided
    if (!project && !task) {
      return res.status(400).json({
        success: false,
        message: 'Either project or task must be provided'
      });
    }
    
    // Create new comment
    const comment = new Comment({
      content,
      author: req.user.id,
      project,
      task,
      parentComment
    });
    
    // Extract @mentions from content
    const mentions = extractMentions(content);
    if (mentions.length > 0) {
      // Validate mentions against project members
      const projectId = project || (task ? await getProjectIdFromTask(task) : null);
      
      if (projectId) {
        const validMentions = await validateMentions(mentions, projectId);
        comment.mentions = validMentions;
      }
    }
    
    await comment.save();
    
    // Send notifications for mentions
    if (comment.mentions && comment.mentions.length > 0) {
      await sendMentionNotifications(
        comment.mentions, 
        req.user.id, 
        project, 
        task, 
        comment._id
      );
    }
    
    // Send notification to relevant users
    await sendCommentNotifications(comment, req.user.id);
    
    const populatedComment = await Comment.findById(comment._id)
      .populate('author', 'firstName lastName email profilePicture')
      .populate('mentions', 'firstName lastName email');
    
    res.status(201).json({
      success: true,
      message: 'Comment created successfully',
      comment: populatedComment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error creating comment',
      error: error.message
    });
  }
};

// Get comments for a project or task
exports.getComments = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;
    
    if (!projectId && !taskId) {
      return res.status(400).json({
        success: false,
        message: 'Either projectId or taskId must be provided'
      });
    }
    
    const query = {};
    if (projectId) query.project = projectId;
    if (taskId) query.task = taskId;
    
    const comments = await Comment.find(query)
      .populate('author', 'firstName lastName email profilePicture')
      .populate('mentions', 'firstName lastName email')
      .sort({ createdAt: 1 });
    
    // Organize comments into threads
    const rootComments = comments.filter(comment => !comment.parentComment);
    const commentMap = {};
    
    comments.forEach(comment => {
      comment = comment.toObject();
      comment.replies = [];
      commentMap[comment._id] = comment;
    });
    
    comments.forEach(comment => {
      if (comment.parentComment) {
        const parentId = comment.parentComment.toString();
        if (commentMap[parentId]) {
          commentMap[parentId].replies.push(commentMap[comment._id]);
        }
      }
    });
    
    res.status(200).json({
      success: true,
      count: rootComments.length,
      comments: rootComments.map(comment => commentMap[comment._id])
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving comments',
      error: error.message
    });
  }
};

// Get comment by ID
exports.getCommentById = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId)
      .populate('author', 'firstName lastName email profilePicture')
      .populate('mentions', 'firstName lastName email')
      .populate('parentComment');
    
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }
    
    res.status(200).json({
      success: true,
      comment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving comment',
      error: error.message
    });
  }
};

// Get all comments for a specific entity
exports.getEntityComments = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    
    if (!entityType || !entityId) {
      return res.status(400).json({
        success: false,
        message: 'Entity type and ID are required'
      });
    }
    
    // Validate entity type
    if (!['project', 'task'].includes(entityType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid entity type. Must be "project" or "task"'
      });
    }
    
    // Build query based on entity type
    const query = {};
    query[entityType] = entityId;
    
    const comments = await Comment.find(query)
      .populate('author', 'firstName lastName email profilePicture')
      .populate('mentions', 'firstName lastName email')
      .sort({ createdAt: 1 });
    
    // Organize comments into threads
    const rootComments = comments.filter(comment => !comment.parentComment);
    const commentMap = {};
    
    comments.forEach(comment => {
      comment = comment.toObject();
      comment.replies = [];
      commentMap[comment._id] = comment;
    });
    
    comments.forEach(comment => {
      if (comment.parentComment) {
        const parentId = comment.parentComment.toString();
        if (commentMap[parentId]) {
          commentMap[parentId].replies.push(commentMap[comment._id]);
        }
      }
    });
    
    res.status(200).json({
      success: true,
      count: rootComments.length,
      comments: rootComments.map(comment => commentMap[comment._id])
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving comments',
      error: error.message
    });
  }
};

// Update comment
exports.updateComment = async (req, res) => {
  try {
    const { content } = req.body;
    
    const comment = await Comment.findById(req.params.commentId);
    
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }
    
    // Check if user is the author
    if (comment.author.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not the author of this comment.'
      });
    }
    
    // Update content
    comment.content = content;
    comment.isEdited = true;
    
    // Extract new mentions
    const newMentions = extractMentions(content);
    if (newMentions.length > 0) {
      // Validate mentions against project members
      const projectId = comment.project || (comment.task ? await getProjectIdFromTask(comment.task) : null);
      
      if (projectId) {
        const validMentions = await validateMentions(newMentions, projectId);
        
        // Find new mentions that weren't in the original comment
        const oldMentions = comment.mentions.map(id => id.toString());
        const brandNewMentions = validMentions.filter(id => !oldMentions.includes(id.toString()));
        
        // Update mentions
        comment.mentions = validMentions;
        
        // Send notifications for new mentions
        if (brandNewMentions.length > 0) {
          await sendMentionNotifications(
            brandNewMentions, 
            req.user.id, 
            comment.project, 
            comment.task, 
            comment._id
          );
        }
      }
    } else {
      comment.mentions = [];
    }
    
    await comment.save();
    
    const updatedComment = await Comment.findById(comment._id)
      .populate('author', 'firstName lastName email profilePicture')
      .populate('mentions', 'firstName lastName email');
    
    res.status(200).json({
      success: true,
      message: 'Comment updated successfully',
      comment: updatedComment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error updating comment',
      error: error.message
    });
  }
};

// Delete comment
exports.deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }
    
    // Check if user is the author or an admin
    if (comment.author.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not authorized to delete this comment.'
      });
    }
    
    // Check if comment has replies
    const hasReplies = await Comment.findOne({ parentComment: comment._id });
    
    if (hasReplies) {
      // If comment has replies, just mark it as deleted
      comment.content = '[Comment deleted]';
      comment.isEdited = true;
      await comment.save();
    } else {
      // If no replies, delete the comment
      await Comment.findByIdAndDelete(req.params.commentId);
    }
    
    res.status(200).json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error deleting comment',
      error: error.message
    });
  }
};

// Add attachment to comment
exports.addAttachment = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    const comment = await Comment.findById(req.params.commentId);
    
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }
    
    // Check if user is the author
    if (comment.author.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not the author of this comment.'
      });
    }
    
    // Create new attachment
    const attachment = {
      fileName: req.file.filename,
      filePath: req.file.path,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedAt: Date.now()
    };
    
    // Add attachment to comment
    comment.attachments.push(attachment);
    await comment.save();
    
    res.status(200).json({
      success: true,
      message: 'Attachment added to comment successfully',
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

// Helper function to extract mentions from content
const extractMentions = (content) => {
  const mentionRegex = /@(\w+)/g;
  const matches = content.match(mentionRegex) || [];
  return matches.map(match => match.substring(1)); // Remove @ symbol
};

// Helper function to validate mentions against project members
const validateMentions = async (mentionUsernames, projectId) => {
  const User = require('../models/User');
  const Project = require('../models/Project');
  
  try {
    // Get project with members
    const project = await Project.findById(projectId).populate('members.user');
    
    if (!project) return [];
    
    // Get all member IDs including owner
    const memberIds = project.members.map(member => member.user._id.toString());
    memberIds.push(project.owner.toString());
    
    // Find users that match mentions and are project members
    const mentionedUsers = await User.find({
      $or: [
        { firstName: { $in: mentionUsernames } },
        { lastName: { $in: mentionUsernames } },
        { email: { $in: mentionUsernames.map(u => `${u}@example.com`) } }
      ]
    }).select('_id');
    
    // Filter to only include project members
    return mentionedUsers
      .filter(user => memberIds.includes(user._id.toString()))
      .map(user => user._id);
  } catch (error) {
    console.error('Error validating mentions:', error);
    return [];
  }
};

// Helper function to get project ID from task
const getProjectIdFromTask = async (taskId) => {
  try {
    const task = await Task.findById(taskId).select('project');
    return task ? task.project : null;
  } catch (error) {
    console.error('Error getting project ID from task:', error);
    return null;
  }
};

// Helper function to send mention notifications
const sendMentionNotifications = async (userIds, senderId, projectId, taskId, commentId) => {
  try {
    const notificationPromises = userIds.map(userId => {
      // Don't notify the sender if they mention themselves
      if (userId.toString() === senderId.toString()) return null;
      
      return new Notification({
        recipient: userId,
        sender: senderId,
        project: projectId,
        task: taskId,
        type: 'comment_mention',
        content: 'You were mentioned in a comment',
        actionLink: taskId 
          ? `/projects/${projectId}/tasks/${taskId}` 
          : `/projects/${projectId}`
      }).save();
    });
    
    await Promise.all(notificationPromises.filter(p => p !== null));
  } catch (error) {
    console.error('Error sending mention notifications:', error);
  }
};

// Helper function to send comment notifications
const sendCommentNotifications = async (comment, senderId) => {
  try {
    let recipientIds = [];
    let actionLink = '';
    let content = '';
    
    if (comment.task) {
      // Get task to find assigned users and creator
      const task = await Task.findById(comment.task);
      
      if (task) {
        recipientIds = [...task.assignedTo, task.createdBy];
        actionLink = `/projects/${task.project}/tasks/${task._id}`;
        content = `New comment on task: ${task.title}`;
      }
    } else if (comment.project) {
      // Get project to find members
      const project = await Project.findById(comment.project);
      
      if (project) {
        recipientIds = project.members.map(member => member.user);
        recipientIds.push(project.owner);
        actionLink = `/projects/${project._id}`;
        content = `New comment on project: ${project.name}`;
      }
    }
    
    // If this is a reply, notify the parent comment author
    if (comment.parentComment) {
      const parentComment = await Comment.findById(comment.parentComment);
      if (parentComment) {
        recipientIds.push(parentComment.author);
        content = 'New reply to your comment';
      }
    }
    
    // Remove duplicates and sender
    recipientIds = [...new Set(recipientIds.map(id => id.toString()))]
      .filter(id => id !== senderId.toString());
    
    // Create notifications
    const notificationPromises = recipientIds.map(userId => {
      return new Notification({
        recipient: userId,
        sender: senderId,
        project: comment.project,
        task: comment.task,
        type: 'comment_added',
        content,
        actionLink
      }).save();
    });
    
    await Promise.all(notificationPromises);
  } catch (error) {
    console.error('Error sending comment notifications:', error);
  }
};