const mongoose = require('mongoose');

const FolderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  path: {
    type: String,
    required: true,
    default: '/'
  },
  parentFolder: {
    type: String,
    default: '/'
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  accessibleTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  tags: [{
    type: String,
    trim: true
  }],
  color: {
    type: String,
    default: '#f5f5f5'
  },
  icon: {
    type: String,
    default: 'folder'
  },
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

// Enforce unique folder names within the same parent folder
FolderSchema.index({ name: 1, parentFolder: 1 }, { unique: true });

// Index for faster retrieval of folder hierarchies
FolderSchema.index({ path: 1 });

// Method to get full path including the folder name
FolderSchema.virtual('fullPath').get(function() {
  return this.path === '/' ? `/${this.name}` : `${this.path}/${this.name}`;
});

module.exports = mongoose.model('Folder', FolderSchema);