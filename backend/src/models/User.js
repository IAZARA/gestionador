const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  // Basic Information
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  profilePicture: {
    type: String,
    default: '/assets/avatar.png'
  },
  
  // System Access Information
  role: {
    type: String,
    enum: ['admin', 'manager', 'user'],
    default: 'user'
  },
  expertiseArea: {
    type: String,
    enum: ['administrative', 'technical', 'legal'],
    default: 'technical'
  },
  
  // Personal Information
  dateOfBirth: {
    type: Date
  },
  idNumber: {
    type: String,
    trim: true
  },
  taxId: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: String
  },
  
  // Contact Information
  primaryPhone: {
    type: String,
    trim: true
  },
  alternatePhone: {
    type: String,
    trim: true
  },
  
  // Work Information
  department: {
    type: String,
    trim: true
  },
  position: {
    type: String,
    trim: true
  },
  workAddress: {
    street: String,
    city: String,
    state: String,
    postalCode: String
  },
  workPhone: {
    type: String,
    trim: true
  },
  
  // Additional Information
  drivingLicense: {
    number: String,
    expiryDate: Date,
    class: String
  },
  bloodType: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', '']
  },
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String
  },
  
  // Notification Preferences
  notificationPreferences: {
    emailNotifications: {
      type: Boolean,
      default: true
    },
    projectAssignment: {
      type: Boolean,
      default: true
    },
    taskUpdates: {
      type: Boolean,
      default: true
    },
    comments: {
      type: Boolean,
      default: true
    },
    deadlineReminders: {
      type: Boolean,
      default: true
    },
    documentUploads: {
      type: Boolean,
      default: true
    },
    leaveRequests: {
      type: Boolean,
      default: true
    }
  },
  
  // System Fields
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  passwordResetToken: String,
  passwordResetExpires: Date,
  
  // Audit Fields
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  changeHistory: [{
    field: String,
    oldValue: String,
    newValue: String,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Pre-save middleware to hash password
UserSchema.pre('save', async function(next) {
  const user = this;
  
  if (!user.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Virtual for full name
UserSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

module.exports = mongoose.model('User', UserSchema);