const Document = require('../models/Document');
const Folder = require('../models/Folder');
const User = require('../models/User');
const Project = require('../models/Project');
const Notification = require('../models/Notification');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');

// Create a new folder
exports.createFolder = async (req, res) => {
  try {
    const { name, description, parentFolder, isPublic, tags, color, icon } = req.body;
    
    // Check if folder with same name exists in same parent
    const existingFolder = await Folder.findOne({
      name,
      parentFolder: parentFolder || '/'
    });
    
    if (existingFolder) {
      return res.status(400).json({
        success: false,
        message: 'A folder with this name already exists in this location'
      });
    }
    
    // Validate parent folder exists if provided
    if (parentFolder && parentFolder !== '/') {
      const parent = await Folder.findOne({ path: parentFolder });
      
      if (!parent) {
        return res.status(404).json({
          success: false,
          message: 'Parent folder not found'
        });
      }
    }
    
    // Calculate folder path
    const folderPath = parentFolder === '/' ? `/${name}` : `${parentFolder}/${name}`;
    
    // Create new folder
    const folder = new Folder({
      name,
      description,
      path: folderPath,
      parentFolder: parentFolder || '/',
      isPublic: isPublic || false,
      tags: tags || [],
      color: color || '#f5f5f5',
      icon: icon || 'folder',
      createdBy: req.user.id
    });
    
    await folder.save();
    
    // Notify admin users
    if (!isPublic) {
      const adminUsers = await User.find({ 
        role: 'admin',
        _id: { $ne: req.user.id } 
      }).select('_id');
      
      const notificationPromises = adminUsers.map(admin => {
        return new Notification({
          recipient: admin._id,
          sender: req.user.id,
          type: 'folder_created',
          content: `${req.user.firstName} ${req.user.lastName} created a new folder: ${name}`,
          actionLink: `/admin/documents${folder.path}`
        }).save();
      });
      
      await Promise.all(notificationPromises);
    }
    
    res.status(201).json({
      success: true,
      message: 'Folder created successfully',
      folder
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error creating folder',
      error: error.message
    });
  }
};

// Get folders
exports.getFolders = async (req, res) => {
  try {
    // Build query
    const query = {};
    
    // Filter by parent folder
    if (req.query.parentFolder) {
      query.parentFolder = req.query.parentFolder;
    }
    
    // Filter by visibility
    if (req.user.role !== 'admin') {
      query.$or = [
        { isPublic: true },
        { createdBy: req.user.id },
        { accessibleTo: req.user.id }
      ];
    }
    
    const folders = await Folder.find(query)
      .populate('createdBy', 'firstName lastName')
      .sort({ name: 1 });
    
    res.status(200).json({
      success: true,
      count: folders.length,
      folders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving folders',
      error: error.message
    });
  }
};

// Get folder by ID or path
exports.getFolder = async (req, res) => {
  try {
    let folder;
    
    if (req.params.folderId) {
      folder = await Folder.findById(req.params.folderId)
        .populate('createdBy', 'firstName lastName');
    } else if (req.query.path) {
      folder = await Folder.findOne({ path: req.query.path })
        .populate('createdBy', 'firstName lastName');
    } else {
      return res.status(400).json({
        success: false,
        message: 'Folder ID or path is required'
      });
    }
    
    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }
    
    // Check access permissions
    if (!folder.isPublic && 
        folder.createdBy._id.toString() !== req.user.id && 
        !folder.accessibleTo.includes(req.user.id) && 
        req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this folder'
      });
    }
    
    res.status(200).json({
      success: true,
      folder
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving folder',
      error: error.message
    });
  }
};

// Update folder
exports.updateFolder = async (req, res) => {
  try {
    const { name, description, isPublic, accessibleTo, tags, color, icon } = req.body;
    
    const folder = await Folder.findById(req.params.folderId);
    
    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }
    
    // Check permissions
    if (folder.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only the creator or admin can update this folder'
      });
    }
    
    // If name is changing, check for duplicates
    if (name && name !== folder.name) {
      const existingFolder = await Folder.findOne({
        name,
        parentFolder: folder.parentFolder,
        _id: { $ne: folder._id }
      });
      
      if (existingFolder) {
        return res.status(400).json({
          success: false,
          message: 'A folder with this name already exists in this location'
        });
      }
      
      // Update path for this folder and all child folders
      const oldPath = folder.path;
      const newPath = folder.parentFolder === '/' 
        ? `/${name}` 
        : `${folder.parentFolder}/${name}`;
      
      // Update this folder's path
      folder.path = newPath;
      
      // Find all child folders to update their paths
      const childFolders = await Folder.find({
        path: { $regex: `^${oldPath}/` }
      });
      
      // Update child folders' paths
      const updatePromises = childFolders.map(childFolder => {
        const newChildPath = childFolder.path.replace(oldPath, newPath);
        return Folder.updateOne(
          { _id: childFolder._id },
          { path: newChildPath }
        );
      });
      
      await Promise.all(updatePromises);
    }
    
    // Update other fields
    if (name) folder.name = name;
    if (description !== undefined) folder.description = description;
    if (isPublic !== undefined) folder.isPublic = isPublic;
    if (accessibleTo) folder.accessibleTo = accessibleTo;
    if (tags) folder.tags = tags;
    if (color) folder.color = color;
    if (icon) folder.icon = icon;
    
    await folder.save();
    
    res.status(200).json({
      success: true,
      message: 'Folder updated successfully',
      folder
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error updating folder',
      error: error.message
    });
  }
};

// Delete folder
exports.deleteFolder = async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.folderId);
    
    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }
    
    // Check permissions
    if (folder.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only the creator or admin can delete this folder'
      });
    }
    
    // Check if folder has child folders
    const childFolders = await Folder.find({
      parentFolder: folder.path
    });
    
    if (childFolders.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete folder with subfolders. Delete subfolders first'
      });
    }
    
    // Check if folder has documents
    const documents = await Document.find({
      folder: folder.path
    });
    
    if (documents.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete folder with documents. Delete documents first'
      });
    }
    
    await Folder.findByIdAndDelete(req.params.folderId);
    
    res.status(200).json({
      success: true,
      message: 'Folder deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error deleting folder',
      error: error.message
    });
  }
};

// Upload document
exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    const { name, description, folder, isPublic, accessibleTo, tags, project } = req.body;
    
    // Validate folder exists if provided
    if (folder && folder !== '/') {
      const folderExists = await Folder.findOne({ path: folder });
      
      if (!folderExists) {
        return res.status(404).json({
          success: false,
          message: 'Folder not found'
        });
      }
      
      // Check folder access permissions if not admin
      if (req.user.role !== 'admin' && 
          !folderExists.isPublic && 
          folderExists.createdBy.toString() !== req.user.id && 
          !folderExists.accessibleTo.includes(req.user.id)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this folder'
        });
      }
    }
    
    // Validate project exists if provided
    if (project) {
      const projectExists = await Project.findById(project);
      
      if (!projectExists) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
    }
    
    // Create new document
    const document = new Document({
      name: name || req.file.originalname,
      description,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      folder: folder || '/',
      isPublic: isPublic === 'true',
      accessibleTo: accessibleTo ? JSON.parse(accessibleTo) : [],
      tags: tags ? JSON.parse(tags) : [],
      project: project || null,
      uploadedBy: req.user.id
    });
    
    await document.save();
    
    // Create notifications
    await createDocumentNotifications(document, req.user.id);
    
    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      document
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error uploading document',
      error: error.message
    });
  }
};

// Get documents in folder
exports.getDocuments = async (req, res) => {
  try {
    // Build query
    const query = {};
    
    // Filter by folder
    if (req.query.folder) {
      query.folder = req.query.folder;
    }
    
    // Filter by project
    if (req.query.project) {
      query.project = req.query.project;
    }
    
    // Text search
    if (req.query.search) {
      query.$text = { $search: req.query.search };
    }
    
    // Filter by type
    if (req.query.type) {
      query.fileType = { $regex: req.query.type, $options: 'i' };
    }
    
    // Filter by tags
    if (req.query.tags) {
      const tags = req.query.tags.split(',');
      query.tags = { $in: tags };
    }
    
    // Filter by visibility
    if (req.user.role !== 'admin') {
      query.$or = [
        { isPublic: true },
        { uploadedBy: req.user.id },
        { accessibleTo: req.user.id }
      ];
    }
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get total count for pagination
    const total = await Document.countDocuments(query);
    
    // Get documents with pagination
    const documents = await Document.find(query)
      .populate('uploadedBy', 'firstName lastName')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);
    
    res.status(200).json({
      success: true,
      count: documents.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      documents
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving documents',
      error: error.message
    });
  }
};

// Get document by ID
exports.getDocumentById = async (req, res) => {
  try {
    const document = await Document.findById(req.params.documentId)
      .populate('uploadedBy', 'firstName lastName email profilePicture')
      .populate('project', 'name');
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    
    // Check access permissions
    if (!document.isPublic && 
        document.uploadedBy._id.toString() !== req.user.id && 
        !document.accessibleTo.includes(req.user.id) && 
        req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this document'
      });
    }
    
    res.status(200).json({
      success: true,
      document
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving document',
      error: error.message
    });
  }
};

// Update document
exports.updateDocument = async (req, res) => {
  try {
    const { name, description, folder, isPublic, accessibleTo, tags, project } = req.body;
    
    const document = await Document.findById(req.params.documentId);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    
    // Check permissions
    if (document.uploadedBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only the uploader or admin can update this document'
      });
    }
    
    // Validate folder exists if provided
    if (folder && folder !== '/' && folder !== document.folder) {
      const folderExists = await Folder.findOne({ path: folder });
      
      if (!folderExists) {
        return res.status(404).json({
          success: false,
          message: 'Folder not found'
        });
      }
      
      // Check folder access permissions if not admin
      if (req.user.role !== 'admin' && 
          !folderExists.isPublic && 
          folderExists.createdBy.toString() !== req.user.id && 
          !folderExists.accessibleTo.includes(req.user.id)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to destination folder'
        });
      }
    }
    
    // Validate project exists if provided
    if (project && project !== document.project) {
      const projectExists = await Project.findById(project);
      
      if (!projectExists) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
    }
    
    // Update document fields
    if (name) document.name = name;
    if (description !== undefined) document.description = description;
    if (folder) document.folder = folder;
    if (isPublic !== undefined) document.isPublic = isPublic === 'true';
    if (accessibleTo) document.accessibleTo = JSON.parse(accessibleTo);
    if (tags) document.tags = JSON.parse(tags);
    if (project) document.project = project;
    
    await document.save();
    
    res.status(200).json({
      success: true,
      message: 'Document updated successfully',
      document
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error updating document',
      error: error.message
    });
  }
};

// Upload new version of document
exports.uploadNewVersion = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    const document = await Document.findById(req.params.documentId);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    
    // Check permissions
    if (document.uploadedBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only the uploader or admin can update this document'
      });
    }
    
    // Add current version to previous versions
    document.previousVersions.push({
      filePath: document.filePath,
      originalName: document.originalName,
      fileSize: document.fileSize,
      version: document.version,
      uploadedBy: document.uploadedBy,
      uploadedAt: document.updatedAt
    });
    
    // Update with new version
    document.fileName = req.file.filename;
    document.originalName = req.file.originalname;
    document.filePath = req.file.path;
    document.fileType = req.file.mimetype;
    document.fileSize = req.file.size;
    document.version += 1;
    document.uploadedBy = req.user.id;
    document.updatedAt = Date.now();
    
    await document.save();
    
    // Create notifications for new version
    await createDocumentVersionNotifications(document, req.user.id);
    
    res.status(200).json({
      success: true,
      message: 'Document version updated successfully',
      document
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error uploading new version',
      error: error.message
    });
  }
};

// Download document
exports.downloadDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.documentId);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    
    // Check access permissions
    if (!document.isPublic && 
        document.uploadedBy.toString() !== req.user.id && 
        !document.accessibleTo.includes(req.user.id) && 
        req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this document'
      });
    }
    
    // Check if file exists
    const filePath = document.filePath;
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }
    
    // Set headers
    res.setHeader('Content-Type', document.fileType);
    res.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"`);
    
    // Stream file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error downloading document',
      error: error.message
    });
  }
};

// Download specific document version
exports.downloadDocumentVersion = async (req, res) => {
  try {
    const { documentId, version } = req.params;
    
    const document = await Document.findById(documentId);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    
    // Check access permissions
    if (!document.isPublic && 
        document.uploadedBy.toString() !== req.user.id && 
        !document.accessibleTo.includes(req.user.id) && 
        req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this document'
      });
    }
    
    let filePath, originalName, fileType;
    
    // Check if requesting current version
    if (parseInt(version) === document.version) {
      filePath = document.filePath;
      originalName = document.originalName;
      fileType = document.fileType;
    } else {
      // Find version in previous versions
      const versionData = document.previousVersions.find(v => v.version === parseInt(version));
      
      if (!versionData) {
        return res.status(404).json({
          success: false,
          message: 'Document version not found'
        });
      }
      
      filePath = versionData.filePath;
      originalName = versionData.originalName || document.originalName;
      fileType = document.fileType; // Assume file type doesn't change between versions
    }
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }
    
    // Set headers
    res.setHeader('Content-Type', fileType);
    res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
    
    // Stream file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error downloading document version',
      error: error.message
    });
  }
};

// Delete document
exports.deleteDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.documentId);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    
    // Check permissions
    if (document.uploadedBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only the uploader or admin can delete this document'
      });
    }
    
    // Delete the file and all previous versions
    try {
      // Delete current version
      if (fs.existsSync(document.filePath)) {
        fs.unlinkSync(document.filePath);
      }
      
      // Delete previous versions
      document.previousVersions.forEach(version => {
        if (fs.existsSync(version.filePath)) {
          fs.unlinkSync(version.filePath);
        }
      });
    } catch (fileError) {
      console.error('Error deleting document files:', fileError);
    }
    
    // Delete the document
    await Document.findByIdAndDelete(req.params.documentId);
    
    res.status(200).json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error deleting document',
      error: error.message
    });
  }
};

// Get document versions
exports.getDocumentVersions = async (req, res) => {
  try {
    const document = await Document.findById(req.params.documentId)
      .populate('previousVersions.uploadedBy', 'firstName lastName');
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    
    // Check access permissions
    if (!document.isPublic && 
        document.uploadedBy.toString() !== req.user.id && 
        !document.accessibleTo.includes(req.user.id) && 
        req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this document'
      });
    }
    
    // Combine current version with previous versions
    const versions = [
      ...document.previousVersions.map(v => ({
        ...v.toObject(),
        isCurrent: false
      })),
      {
        version: document.version,
        uploadedBy: document.uploadedBy,
        uploadedAt: document.updatedAt,
        isCurrent: true,
        fileSize: document.fileSize
      }
    ].sort((a, b) => b.version - a.version);
    
    res.status(200).json({
      success: true,
      versions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving document versions',
      error: error.message
    });
  }
};

// Search documents
exports.searchDocuments = async (req, res) => {
  try {
    const { query, type, folder } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }
    
    // Build search query
    const searchQuery = {
      $text: { $search: query }
    };
    
    // Filter by type
    if (type) {
      searchQuery.fileType = { $regex: type, $options: 'i' };
    }
    
    // Filter by folder
    if (folder) {
      searchQuery.folder = folder;
    }
    
    // Filter by visibility
    if (req.user.role !== 'admin') {
      searchQuery.$or = [
        { isPublic: true },
        { uploadedBy: req.user.id },
        { accessibleTo: req.user.id }
      ];
    }
    
    // Perform search
    const documents = await Document.find(searchQuery)
      .populate('uploadedBy', 'firstName lastName')
      .sort({ score: { $meta: 'textScore' } })
      .limit(20);
    
    res.status(200).json({
      success: true,
      count: documents.length,
      documents
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error searching documents',
      error: error.message
    });
  }
};

// Get all documents (admin only)
exports.getAllDocuments = async (req, res) => {
  try {
    const documents = await Document.find()
      .populate('project', 'name')
      .populate('folder', 'name path')
      .populate('uploadedBy', 'firstName lastName email')
      .sort({ updatedAt: -1 });
    
    res.status(200).json({
      success: true,
      count: documents.length,
      documents
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving documents',
      error: error.message
    });
  }
};

// Get project documents
exports.getProjectDocuments = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    const documents = await Document.find({ project: projectId })
      .populate('folder', 'name path')
      .populate('uploadedBy', 'firstName lastName email')
      .sort({ updatedAt: -1 });
    
    res.status(200).json({
      success: true,
      count: documents.length,
      documents
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving project documents',
      error: error.message
    });
  }
};

// Get documents in folder
exports.getDocumentsInFolder = async (req, res) => {
  try {
    const { folderId } = req.params;
    
    // Check if folder exists
    const folder = await Folder.findById(folderId);
    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }
    
    // Check access permissions
    if (!folder.isPublic && 
        folder.createdBy.toString() !== req.user.id && 
        !folder.accessibleTo.includes(req.user.id) && 
        req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this folder'
      });
    }
    
    const documents = await Document.find({ folder: folderId })
      .populate('project', 'name')
      .populate('uploadedBy', 'firstName lastName email')
      .sort({ updatedAt: -1 });
    
    res.status(200).json({
      success: true,
      count: documents.length,
      documents
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving folder documents',
      error: error.message
    });
  }
};

// Get folder by ID
exports.getFolderById = async (req, res) => {
  try {
    const { folderId } = req.params;
    
    const folder = await Folder.findById(folderId)
      .populate('createdBy', 'firstName lastName email');
    
    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }
    
    // Check access permissions
    if (!folder.isPublic && 
        folder.createdBy._id.toString() !== req.user.id && 
        !folder.accessibleTo.includes(req.user.id) && 
        req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this folder'
      });
    }
    
    res.status(200).json({
      success: true,
      folder
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving folder',
      error: error.message
    });
  }
};

// Add document tag
exports.addDocumentTag = async (req, res) => {
  try {
    const { tag } = req.body;
    
    if (!tag) {
      return res.status(400).json({
        success: false,
        message: 'Tag is required'
      });
    }
    
    const document = await Document.findById(req.params.documentId);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    
    // Check if user has permission to modify document
    if (document.uploadedBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only the uploader or admin can modify this document'
      });
    }
    
    // Check if tag already exists
    if (document.tags.includes(tag)) {
      return res.status(400).json({
        success: false,
        message: 'Tag already exists for this document'
      });
    }
    
    // Add tag
    document.tags.push(tag);
    await document.save();
    
    res.status(200).json({
      success: true,
      message: 'Tag added successfully',
      tags: document.tags
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error adding tag',
      error: error.message
    });
  }
};

// Remove document tag
exports.removeDocumentTag = async (req, res) => {
  try {
    const { tagId } = req.params;
    
    const document = await Document.findById(req.params.documentId);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    
    // Check if user has permission to modify document
    if (document.uploadedBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only the uploader or admin can modify this document'
      });
    }
    
    // Check if tag exists
    if (!document.tags.includes(tagId)) {
      return res.status(404).json({
        success: false,
        message: 'Tag not found'
      });
    }
    
    // Remove tag
    document.tags = document.tags.filter(tag => tag !== tagId);
    await document.save();
    
    res.status(200).json({
      success: true,
      message: 'Tag removed successfully',
      tags: document.tags
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error removing tag',
      error: error.message
    });
  }
};

// Helper function to create notifications when document is uploaded
const createDocumentNotifications = async (document, uploaderId) => {
  try {
    // Determine who to notify
    let notifyUserIds = [];
    
    if (document.project) {
      // Notify project members
      const project = await Project.findById(document.project);
      if (project) {
        // Get all member IDs
        notifyUserIds = project.members.map(member => member.user.toString());
        // Add project owner
        notifyUserIds.push(project.owner.toString());
      }
    } else if (!document.isPublic) {
      // For non-public documents without a project, notify admins
      const admins = await User.find({ role: 'admin' }).select('_id');
      notifyUserIds = admins.map(admin => admin._id.toString());
    }
    
    // Add users with explicit access
    document.accessibleTo.forEach(userId => {
      if (!notifyUserIds.includes(userId.toString())) {
        notifyUserIds.push(userId.toString());
      }
    });
    
    // Remove duplicates and the uploader
    notifyUserIds = [...new Set(notifyUserIds)]
      .filter(userId => userId !== uploaderId);
    
    // Create notifications
    const notificationPromises = notifyUserIds.map(userId => {
      return new Notification({
        recipient: userId,
        sender: uploaderId,
        project: document.project,
        type: 'document_uploaded',
        content: `New document uploaded: ${document.name}`,
        actionLink: `/admin/documents/view/${document._id}`
      }).save();
    });
    
    await Promise.all(notificationPromises);
  } catch (error) {
    console.error('Error creating document notifications:', error);
  }
};

// Helper function to create notifications when document version is updated
const createDocumentVersionNotifications = async (document, uploaderId) => {
  try {
    // Determine who to notify
    let notifyUserIds = [];
    
    if (document.project) {
      // Notify project members
      const project = await Project.findById(document.project);
      if (project) {
        // Get all member IDs
        notifyUserIds = project.members.map(member => member.user.toString());
        // Add project owner
        notifyUserIds.push(project.owner.toString());
      }
    } else if (!document.isPublic) {
      // For non-public documents without a project, notify admins
      const admins = await User.find({ role: 'admin' }).select('_id');
      notifyUserIds = admins.map(admin => admin._id.toString());
    }
    
    // Add users with explicit access
    document.accessibleTo.forEach(userId => {
      if (!notifyUserIds.includes(userId.toString())) {
        notifyUserIds.push(userId.toString());
      }
    });
    
    // Remove duplicates and the uploader
    notifyUserIds = [...new Set(notifyUserIds)]
      .filter(userId => userId !== uploaderId);
    
    // Create notifications
    const notificationPromises = notifyUserIds.map(userId => {
      return new Notification({
        recipient: userId,
        sender: uploaderId,
        project: document.project,
        type: 'document_updated',
        content: `Document updated with new version: ${document.name}`,
        actionLink: `/admin/documents/view/${document._id}`
      }).save();
    });
    
    await Promise.all(notificationPromises);
  } catch (error) {
    console.error('Error creating document version notifications:', error);
  }
};