const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendar.controller');
const { authenticate } = require('../middlewares/auth');

// Get all events for a specific month
router.get('/month/:year/:month', authenticate, calendarController.getEventsByMonth);

// Get all events for a specific week
router.get('/week/:year/:week', authenticate, calendarController.getEventsByWeek);

// Get all events for a specific day
router.get('/day/:year/:month/:day', authenticate, calendarController.getEventsByDay);

// Get all project events
router.get('/project/:projectId', authenticate, calendarController.getProjectEvents);

// Get all user events
router.get('/user/:userId', authenticate, calendarController.getUserEvents);

// Get my events
router.get('/my-events', authenticate, calendarController.getMyEvents);

// Create an event
router.post('/', authenticate, calendarController.createEvent);

// Get an event by ID
router.get('/:eventId', authenticate, calendarController.getEventById);

// Update an event
router.put('/:eventId', authenticate, calendarController.updateEvent);

// Delete an event
router.delete('/:eventId', authenticate, calendarController.deleteEvent);

module.exports = router;