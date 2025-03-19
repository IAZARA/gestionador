const mongoose = require('mongoose');

const WikiPageSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: false
  },
  isGlobal: {
    type: Boolean,
    default: false
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastEditedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WikiPage'
  },
  path: {
    type: String,
    required: true
  },
  attachments: [{
    fileName: String,
    filePath: String,
    fileType: String,
    fileSize: Number,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isPublished: {
    type: Boolean,
    default: true
  },
  history: [{
    content: String,
    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    editedAt: {
      type: Date,
      default: Date.now
    },
    versionComment: String
  }],
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

// Index for faster searches by project and path
WikiPageSchema.index({ project: 1, path: 1 }, { unique: true, sparse: true });
WikiPageSchema.index({ isGlobal: 1, path: 1 }, { unique: true, sparse: true });

// Method to add new version to history
WikiPageSchema.methods.addVersion = function(content, userId, comment = '') {
  this.history.push({
    content: this.content, // Save current content
    editedBy: this.lastEditedBy || this.author,
    editedAt: new Date(),
    versionComment: comment
  });
  
  this.content = content;
  this.lastEditedBy = userId;
  this.updatedAt = new Date();
};

module.exports = mongoose.model('WikiPage', WikiPageSchema);