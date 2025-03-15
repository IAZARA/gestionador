const CalendarEvent = require('../models/CalendarEvent');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Notification = require('../models/Notification');

// Create a new calendar event
exports.createEvent = async (req, res) => {
  try {
    const { 
      title, 
      description, 
      startDate, 
      endDate, 
      allDay,
      location,
      color,
      project,
      task,
      attendees,
      isRecurring,
      recurringPattern,
      reminders
    } = req.body;
    
    // Create new event
    const event = new CalendarEvent({
      title,
      description,
      startDate,
      endDate,
      allDay: allDay || false,
      location,
      color,
      project,
      task,
      creator: req.user.id,
      attendees: attendees ? attendees.map(userId => ({ user: userId })) : [],
      isRecurring: isRecurring || false,
      recurringPattern,
      reminders: reminders || []
    });
    
    await event.save();
    
    // Send notifications to attendees
    if (attendees && attendees.length > 0) {
      const notificationPromises = attendees.map(userId => {
        return new Notification({
          recipient: userId,
          sender: req.user.id,
          project: project,
          task: task,
          type: 'calendar_event',
          content: `You have been invited to a new event: ${title}`,
          actionLink: `/calendar/events/${event._id}`
        }).save();
      });
      
      await Promise.all(notificationPromises);
    }
    
    res.status(201).json({
      success: true,
      message: 'Calendar event created successfully',
      event
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error creating calendar event',
      error: error.message
    });
  }
};

// Get calendar events in a date range
exports.getEvents = async (req, res) => {
  try {
    const { start, end, projectId } = req.query;
    
    // Build query
    const query = {};
    
    // Date range filter
    if (start && end) {
      query.$or = [
        // Events that start within the range
        { startDate: { $gte: new Date(start), $lte: new Date(end) } },
        // Events that end within the range
        { endDate: { $gte: new Date(start), $lte: new Date(end) } },
        // Events that span the entire range
        { 
          startDate: { $lte: new Date(start) },
          endDate: { $gte: new Date(end) }
        }
      ];
    }
    
    // Project filter
    if (projectId) {
      query.project = projectId;
    }
    
    // Get events
    let events = await CalendarEvent.find(query)
      .populate('creator', 'firstName lastName profilePicture')
      .populate('attendees.user', 'firstName lastName profilePicture')
      .populate('project', 'name')
      .populate('task', 'title')
      .sort({ startDate: 1 });
    
    // Handle recurring events
    const recurringEvents = [];
    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      
      for (const event of events) {
        if (event.isRecurring && event.recurringPattern) {
          const additionalOccurrences = generateRecurringEvents(
            event, 
            startDate, 
            endDate
          );
          
          recurringEvents.push(...additionalOccurrences);
        }
      }
    }
    
    // Combine regular and recurring events
    events = [...events, ...recurringEvents];
    
    res.status(200).json({
      success: true,
      count: events.length,
      events
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving calendar events',
      error: error.message
    });
  }
};

// Get event by ID
exports.getEventById = async (req, res) => {
  try {
    const event = await CalendarEvent.findById(req.params.eventId)
      .populate('creator', 'firstName lastName email profilePicture')
      .populate('attendees.user', 'firstName lastName email profilePicture')
      .populate('project', 'name')
      .populate('task', 'title');
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Calendar event not found'
      });
    }
    
    res.status(200).json({
      success: true,
      event
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving calendar event',
      error: error.message
    });
  }
};

// Update event
exports.updateEvent = async (req, res) => {
  try {
    const { 
      title, 
      description, 
      startDate, 
      endDate, 
      allDay,
      location,
      color,
      project,
      task,
      attendees,
      isRecurring,
      recurringPattern,
      reminders
    } = req.body;
    
    // Find event
    const event = await CalendarEvent.findById(req.params.eventId);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Calendar event not found'
      });
    }
    
    // Check if user is the creator
    if (event.creator.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not the creator of this event.'
      });
    }
    
    // Build update object
    const updateFields = {};
    if (title) updateFields.title = title;
    if (description !== undefined) updateFields.description = description;
    if (startDate) updateFields.startDate = startDate;
    if (endDate) updateFields.endDate = endDate;
    if (allDay !== undefined) updateFields.allDay = allDay;
    if (location !== undefined) updateFields.location = location;
    if (color) updateFields.color = color;
    if (project) updateFields.project = project;
    if (task) updateFields.task = task;
    if (isRecurring !== undefined) updateFields.isRecurring = isRecurring;
    if (recurringPattern) updateFields.recurringPattern = recurringPattern;
    if (reminders) updateFields.reminders = reminders;
    
    // Handle attendees separately to track new additions
    let newAttendees = [];
    if (attendees) {
      // Convert current attendees to user ID strings
      const currentAttendees = event.attendees.map(a => a.user.toString());
      
      // Find new attendees
      newAttendees = attendees.filter(userId => !currentAttendees.includes(userId));
      
      // Update attendees list
      updateFields.attendees = attendees.map(userId => {
        const existing = event.attendees.find(a => a.user.toString() === userId);
        return {
          user: userId,
          status: existing ? existing.status : 'pending'
        };
      });
    }
    
    // Update event
    const updatedEvent = await CalendarEvent.findByIdAndUpdate(
      req.params.eventId,
      { $set: updateFields },
      { new: true, runValidators: true }
    )
    .populate('creator', 'firstName lastName email profilePicture')
    .populate('attendees.user', 'firstName lastName email profilePicture')
    .populate('project', 'name')
    .populate('task', 'title');
    
    // Send notifications to new attendees
    if (newAttendees.length > 0) {
      const notificationPromises = newAttendees.map(userId => {
        return new Notification({
          recipient: userId,
          sender: req.user.id,
          project: updatedEvent.project,
          task: updatedEvent.task,
          type: 'calendar_event',
          content: `You have been invited to an event: ${updatedEvent.title}`,
          actionLink: `/calendar/events/${updatedEvent._id}`
        }).save();
      });
      
      await Promise.all(notificationPromises);
    }
    
    res.status(200).json({
      success: true,
      message: 'Calendar event updated successfully',
      event: updatedEvent
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error updating calendar event',
      error: error.message
    });
  }
};

// Delete event
exports.deleteEvent = async (req, res) => {
  try {
    const event = await CalendarEvent.findById(req.params.eventId);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Calendar event not found'
      });
    }
    
    // Check if user is the creator
    if (event.creator.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not the creator of this event.'
      });
    }
    
    await CalendarEvent.findByIdAndDelete(req.params.eventId);
    
    // Notify attendees of cancellation
    if (event.attendees && event.attendees.length > 0) {
      const notificationPromises = event.attendees.map(attendee => {
        return new Notification({
          recipient: attendee.user,
          sender: req.user.id,
          project: event.project,
          task: event.task,
          type: 'calendar_event',
          content: `Event "${event.title}" has been cancelled`,
          actionLink: event.project 
            ? `/projects/${event.project}` 
            : '/calendar'
        }).save();
      });
      
      await Promise.all(notificationPromises);
    }
    
    res.status(200).json({
      success: true,
      message: 'Calendar event deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error deleting calendar event',
      error: error.message
    });
  }
};

// Update attendance status
exports.updateAttendanceStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    // Validate status
    if (!['pending', 'accepted', 'declined'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: pending, accepted, declined'
      });
    }
    
    const event = await CalendarEvent.findById(req.params.eventId);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Calendar event not found'
      });
    }
    
    // Find the attendee
    const attendeeIndex = event.attendees.findIndex(
      attendee => attendee.user.toString() === req.user.id
    );
    
    if (attendeeIndex === -1) {
      return res.status(400).json({
        success: false,
        message: 'You are not an attendee of this event'
      });
    }
    
    // Update status
    event.attendees[attendeeIndex].status = status;
    await event.save();
    
    // Notify event creator
    await new Notification({
      recipient: event.creator,
      sender: req.user.id,
      project: event.project,
      task: event.task,
      type: 'calendar_event',
      content: `${req.user.firstName} ${req.user.lastName} ${status} your event: ${event.title}`,
      actionLink: `/calendar/events/${event._id}`
    }).save();
    
    res.status(200).json({
      success: true,
      message: 'Attendance status updated successfully',
      status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error updating attendance status',
      error: error.message
    });
  }
};

// Get events for a project
exports.getProjectEvents = async (req, res) => {
  try {
    const { start, end } = req.query;
    const { projectId } = req.params;
    
    // Build query
    const query = { project: projectId };
    
    // Date range filter
    if (start && end) {
      query.$or = [
        // Events that start within the range
        { startDate: { $gte: new Date(start), $lte: new Date(end) } },
        // Events that end within the range
        { endDate: { $gte: new Date(start), $lte: new Date(end) } },
        // Events that span the entire range
        { 
          startDate: { $lte: new Date(start) },
          endDate: { $gte: new Date(end) }
        }
      ];
    }
    
    // Get events
    const events = await CalendarEvent.find(query)
      .populate('creator', 'firstName lastName')
      .populate('attendees.user', 'firstName lastName')
      .sort({ startDate: 1 });
    
    // Get task due dates for the project
    const tasks = await Task.find({
      project: projectId,
      dueDate: { $gte: new Date(start), $lte: new Date(end) }
    }).select('title dueDate priority status');
    
    // Convert tasks to calendar-like events
    const taskEvents = tasks.map(task => ({
      _id: task._id,
      title: task.title,
      startDate: task.dueDate,
      endDate: task.dueDate,
      allDay: true,
      isTask: true,
      status: task.status,
      priority: task.priority,
      color: getTaskColor(task.priority, task.status)
    }));
    
    res.status(200).json({
      success: true,
      events: [...events, ...taskEvents]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving project events',
      error: error.message
    });
  }
};

// Get events by month
exports.getEventsByMonth = async (req, res) => {
  try {
    const { year, month } = req.params;
    
    // Create date range for the month
    const startDate = new Date(year, month - 1, 1); // Month is 0-indexed in JS Date
    const endDate = new Date(year, month, 0); // Last day of the month
    endDate.setHours(23, 59, 59, 999);
    
    // Build query
    const query = {
      $or: [
        // Events that start within the month
        { startDate: { $gte: startDate, $lte: endDate } },
        // Events that end within the month
        { endDate: { $gte: startDate, $lte: endDate } },
        // Events that span the entire month
        { 
          startDate: { $lte: startDate },
          endDate: { $gte: endDate }
        }
      ]
    };
    
    // Get events
    let events = await CalendarEvent.find(query)
      .populate('creator', 'firstName lastName profilePicture')
      .populate('attendees.user', 'firstName lastName profilePicture')
      .populate('project', 'name')
      .populate('task', 'title')
      .sort({ startDate: 1 });
    
    // Handle recurring events
    const recurringEvents = [];
    for (const event of events) {
      if (event.isRecurring && event.recurringPattern) {
        const additionalOccurrences = generateRecurringEvents(
          event, 
          startDate, 
          endDate
        );
        
        recurringEvents.push(...additionalOccurrences);
      }
    }
    
    // Combine regular and recurring events
    events = [...events, ...recurringEvents];
    
    res.status(200).json({
      success: true,
      count: events.length,
      events
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving calendar events by month',
      error: error.message
    });
  }
};

// Get events by week
exports.getEventsByWeek = async (req, res) => {
  try {
    const { year, week } = req.params;
    
    // Calculate the first day of the week (assuming week 1 is the first week with a Thursday)
    const firstDayOfYear = new Date(year, 0, 1);
    const dayOffset = firstDayOfYear.getDay() || 7; // getDay() returns 0 for Sunday, we want Monday as 1
    const firstMondayOfYear = new Date(year, 0, 1 + (dayOffset > 1 ? 9 - dayOffset : 1));
    
    // Calculate start and end dates for the requested week
    const startDate = new Date(firstMondayOfYear);
    startDate.setDate(startDate.getDate() + (parseInt(week) - 1) * 7);
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
    
    // Build query
    const query = {
      $or: [
        // Events that start within the week
        { startDate: { $gte: startDate, $lte: endDate } },
        // Events that end within the week
        { endDate: { $gte: startDate, $lte: endDate } },
        // Events that span the entire week
        { 
          startDate: { $lte: startDate },
          endDate: { $gte: endDate }
        }
      ]
    };
    
    // Get events
    let events = await CalendarEvent.find(query)
      .populate('creator', 'firstName lastName profilePicture')
      .populate('attendees.user', 'firstName lastName profilePicture')
      .populate('project', 'name')
      .populate('task', 'title')
      .sort({ startDate: 1 });
    
    // Handle recurring events
    const recurringEvents = [];
    for (const event of events) {
      if (event.isRecurring && event.recurringPattern) {
        const additionalOccurrences = generateRecurringEvents(
          event, 
          startDate, 
          endDate
        );
        
        recurringEvents.push(...additionalOccurrences);
      }
    }
    
    // Combine regular and recurring events
    events = [...events, ...recurringEvents];
    
    res.status(200).json({
      success: true,
      count: events.length,
      events
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving calendar events by week',
      error: error.message
    });
  }
};

// Get events by day
exports.getEventsByDay = async (req, res) => {
  try {
    const { year, month, day } = req.params;
    
    // Create date range for the day
    const startDate = new Date(year, month - 1, day); // Month is 0-indexed in JS Date
    const endDate = new Date(year, month - 1, day);
    endDate.setHours(23, 59, 59, 999);
    
    // Build query
    const query = {
      $or: [
        // Events that start within the day
        { startDate: { $gte: startDate, $lte: endDate } },
        // Events that end within the day
        { endDate: { $gte: startDate, $lte: endDate } },
        // Events that span the entire day
        { 
          startDate: { $lte: startDate },
          endDate: { $gte: endDate }
        }
      ]
    };
    
    // Get events
    let events = await CalendarEvent.find(query)
      .populate('creator', 'firstName lastName profilePicture')
      .populate('attendees.user', 'firstName lastName profilePicture')
      .populate('project', 'name')
      .populate('task', 'title')
      .sort({ startDate: 1 });
    
    // Handle recurring events
    const recurringEvents = [];
    for (const event of events) {
      if (event.isRecurring && event.recurringPattern) {
        const additionalOccurrences = generateRecurringEvents(
          event, 
          startDate, 
          endDate
        );
        
        recurringEvents.push(...additionalOccurrences);
      }
    }
    
    // Combine regular and recurring events
    events = [...events, ...recurringEvents];
    
    res.status(200).json({
      success: true,
      count: events.length,
      events
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving calendar events by day',
      error: error.message
    });
  }
};

// Get user events
exports.getUserEvents = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Build query to find events where the user is creator or attendee
    const query = {
      $or: [
        { creator: userId },
        { 'attendees.user': userId }
      ]
    };
    
    // Get events
    const events = await CalendarEvent.find(query)
      .populate('creator', 'firstName lastName profilePicture')
      .populate('attendees.user', 'firstName lastName profilePicture')
      .populate('project', 'name')
      .populate('task', 'title')
      .sort({ startDate: 1 });
    
    res.status(200).json({
      success: true,
      count: events.length,
      events
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving user events',
      error: error.message
    });
  }
};

// Get my events
exports.getMyEvents = async (req, res) => {
  try {
    // Build query to find events where the current user is creator or attendee
    const query = {
      $or: [
        { creator: req.user.id },
        { 'attendees.user': req.user.id }
      ]
    };
    
    // Get events
    const events = await CalendarEvent.find(query)
      .populate('creator', 'firstName lastName profilePicture')
      .populate('attendees.user', 'firstName lastName profilePicture')
      .populate('project', 'name')
      .populate('task', 'title')
      .sort({ startDate: 1 });
    
    res.status(200).json({
      success: true,
      count: events.length,
      events
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving your events',
      error: error.message
    });
  }
};

// Helper function to generate recurring event instances
const generateRecurringEvents = (baseEvent, startRange, endRange) => {
  const events = [];
  
  if (!baseEvent.isRecurring || !baseEvent.recurringPattern) {
    return events;
  }
  
  const { frequency, interval, endDate } = baseEvent.recurringPattern;
  const patternEndDate = endDate ? new Date(endDate) : null;
  
  // Don't generate events past the pattern end date
  const effectiveEndRange = patternEndDate && patternEndDate < endRange 
    ? patternEndDate 
    : endRange;
  
  let currentDate = new Date(baseEvent.startDate);
  const duration = baseEvent.endDate - baseEvent.startDate;
  
  // Generate recurring instances
  while (currentDate <= effectiveEndRange) {
    // Skip the original event
    if (currentDate.getTime() !== baseEvent.startDate.getTime() && 
        currentDate >= startRange) {
      
      const eventCopy = {
        ...baseEvent.toObject(),
        startDate: new Date(currentDate),
        endDate: new Date(currentDate.getTime() + duration),
        isRecurringInstance: true,
        originalEventId: baseEvent._id
      };
      
      // Remove MongoDB specific fields
      delete eventCopy._id;
      
      events.push(eventCopy);
    }
    
    // Move to the next occurrence based on frequency
    switch (frequency) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + interval);
        break;
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + (7 * interval));
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + interval);
        break;
      case 'yearly':
        currentDate.setFullYear(currentDate.getFullYear() + interval);
        break;
      default:
        // Invalid frequency, stop generating
        return events;
    }
  }
  
  return events;
};

// Helper function to get task color based on priority and status
const getTaskColor = (priority, status) => {
  if (status === 'Completed') {
    return '#4CAF50'; // Green
  }
  
  switch (priority) {
    case 'Low':
      return '#2196F3'; // Blue
    case 'Medium':
      return '#FF9800'; // Orange
    case 'High':
      return '#F44336'; // Red
    case 'Urgent':
      return '#9C27B0'; // Purple
    default:
      return '#757575'; // Grey
  }
};