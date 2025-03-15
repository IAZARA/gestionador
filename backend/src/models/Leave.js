const mongoose = require('mongoose');

const LeaveSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  leaveType: {
    type: String,
    enum: ['vacation', 'sick', 'study', 'personal', 'maternity', 'paternity', 'others'],
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  dayCount: {
    type: Number,
    min: 0.5,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedDate: {
    type: Date
  },
  comments: {
    type: String
  },
  attachments: [{
    fileName: String,
    filePath: String,
    fileType: String,
    fileSize: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Virtual for calculating day count
LeaveSchema.pre('validate', function(next) {
  if (this.startDate && this.endDate) {
    // Calculate working days between start and end date (excluding weekends)
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    let days = 0;
    let current = new Date(start);
    
    while (current <= end) {
      // Skip weekends (0 = Sunday, 6 = Saturday)
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        days++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    this.dayCount = days;
  }
  next();
});

// Index for faster searches by user and date range
LeaveSchema.index({ user: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('Leave', LeaveSchema);