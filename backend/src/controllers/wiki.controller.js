const WikiPage = require('../models/WikiPage');
const Project = require('../models/Project');
const Notification = require('../models/Notification');

// Create a new wiki page
exports.createWikiPage = async (req, res) => {
  try {
    const { title, content, project, parent, path } = req.body;
    
    // Check if project exists
    const projectExists = await Project.findById(project);
    if (!projectExists) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Check if path already exists in this project
    const pathExists = await WikiPage.findOne({ project, path });
    if (pathExists) {
      return res.status(400).json({
        success: false,
        message: 'A wiki page with this path already exists in the project'
      });
    }
    
    // Create new wiki page
    const wikiPage = new WikiPage({
      title,
      content,
      project,
      author: req.user.id,
      lastEditedBy: req.user.id,
      parent,
      path: path || `/${title.toLowerCase().replace(/\s+/g, '-')}`
    });
    
    await wikiPage.save();
    
    // Create notification for project members
    const membersToNotify = projectExists.members
      .map(member => member.user.toString())
      .filter(userId => userId !== req.user.id);
    
    if (membersToNotify.length > 0) {
      const notificationPromises = membersToNotify.map(userId => {
        return new Notification({
          recipient: userId,
          sender: req.user.id,
          project,
          type: 'wiki_updated',
          content: `New wiki page created: ${title}`,
          actionLink: `/projects/${project}/wiki${wikiPage.path}`
        }).save();
      });
      
      await Promise.all(notificationPromises);
    }
    
    res.status(201).json({
      success: true,
      message: 'Wiki page created successfully',
      wikiPage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error creating wiki page',
      error: error.message
    });
  }
};

// Get all wiki pages for a project
exports.getProjectWikiPages = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const wikiPages = await WikiPage.find({ project: projectId })
      .populate('author', 'firstName lastName')
      .populate('lastEditedBy', 'firstName lastName')
      .sort({ path: 1 });
    
    // Organize pages into hierarchical structure
    const pageMap = {};
    const rootPages = [];
    
    // First pass: map all pages by path
    wikiPages.forEach(page => {
      pageMap[page.path] = {
        ...page.toObject(),
        children: []
      };
    });
    
    // Second pass: build the tree
    Object.values(pageMap).forEach(page => {
      if (page.parent) {
        const parentPath = pageMap[page.parent.path];
        if (parentPath) {
          parentPath.children.push(page);
        } else {
          rootPages.push(page);
        }
      } else {
        rootPages.push(page);
      }
    });
    
    res.status(200).json({
      success: true,
      count: wikiPages.length,
      wikiPages: rootPages
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving wiki pages',
      error: error.message
    });
  }
};

// Get wiki page by ID
exports.getWikiPageById = async (req, res) => {
  try {
    const wikiPage = await WikiPage.findById(req.params.wikiId)
      .populate('author', 'firstName lastName email profilePicture')
      .populate('lastEditedBy', 'firstName lastName email profilePicture')
      .populate('parent', 'title path');
    
    if (!wikiPage) {
      return res.status(404).json({
        success: false,
        message: 'Wiki page not found'
      });
    }
    
    res.status(200).json({
      success: true,
      wikiPage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving wiki page',
      error: error.message
    });
  }
};

// Get wiki page by path
exports.getWikiPageByPath = async (req, res) => {
  try {
    const { projectId, path } = req.params;
    
    const wikiPage = await WikiPage.findOne({ 
      project: projectId, 
      path 
    })
    .populate('author', 'firstName lastName email profilePicture')
    .populate('lastEditedBy', 'firstName lastName email profilePicture')
    .populate('parent', 'title path');
    
    if (!wikiPage) {
      return res.status(404).json({
        success: false,
        message: 'Wiki page not found'
      });
    }
    
    // Get child pages
    const childPages = await WikiPage.find({
      project: projectId,
      parent: wikiPage._id
    })
    .select('title path')
    .sort({ title: 1 });
    
    res.status(200).json({
      success: true,
      wikiPage,
      childPages
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving wiki page',
      error: error.message
    });
  }
};

// Update wiki page
exports.updateWikiPage = async (req, res) => {
  try {
    const { title, content, isPublished, parent, versionComment } = req.body;
    
    // Find wiki page
    const wikiPage = await WikiPage.findById(req.params.wikiId);
    
    if (!wikiPage) {
      return res.status(404).json({
        success: false,
        message: 'Wiki page not found'
      });
    }
    
    // Add current version to history
    wikiPage.addVersion(content, req.user.id, versionComment || 'Updated content');
    
    // Update fields
    if (title) wikiPage.title = title;
    if (isPublished !== undefined) wikiPage.isPublished = isPublished;
    if (parent) wikiPage.parent = parent;
    
    await wikiPage.save();
    
    // Create notification for project members
    const project = await Project.findById(wikiPage.project);
    
    if (project) {
      const membersToNotify = project.members
        .map(member => member.user.toString())
        .filter(userId => userId !== req.user.id);
      
      if (membersToNotify.length > 0) {
        const notificationPromises = membersToNotify.map(userId => {
          return new Notification({
            recipient: userId,
            sender: req.user.id,
            project: wikiPage.project,
            type: 'wiki_updated',
            content: `Wiki page updated: ${wikiPage.title}`,
            actionLink: `/projects/${wikiPage.project}/wiki${wikiPage.path}`
          }).save();
        });
        
        await Promise.all(notificationPromises);
      }
    }
    
    res.status(200).json({
      success: true,
      message: 'Wiki page updated successfully',
      wikiPage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error updating wiki page',
      error: error.message
    });
  }
};

// Delete wiki page
exports.deleteWikiPage = async (req, res) => {
  try {
    const wikiPage = await WikiPage.findById(req.params.wikiId);
    
    if (!wikiPage) {
      return res.status(404).json({
        success: false,
        message: 'Wiki page not found'
      });
    }
    
    // Check if page has children
    const hasChildren = await WikiPage.findOne({ 
      parent: wikiPage._id 
    });
    
    if (hasChildren) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a page with child pages. Delete child pages first or move them.'
      });
    }
    
    // Delete the wiki page
    await WikiPage.findByIdAndDelete(req.params.wikiId);
    
    res.status(200).json({
      success: true,
      message: 'Wiki page deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error deleting wiki page',
      error: error.message
    });
  }
};

// Get wiki page history
exports.getWikiPageHistory = async (req, res) => {
  try {
    const wikiPage = await WikiPage.findById(req.params.wikiId)
      .populate('history.editedBy', 'firstName lastName email profilePicture');
    
    if (!wikiPage) {
      return res.status(404).json({
        success: false,
        message: 'Wiki page not found'
      });
    }
    
    res.status(200).json({
      success: true,
      history: wikiPage.history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving wiki page history',
      error: error.message
    });
  }
};

// Get specific version of wiki page
exports.getWikiPageVersion = async (req, res) => {
  try {
    const { versionId } = req.params;
    
    const wikiPage = await WikiPage.findById(req.params.wikiId)
      .populate('history.editedBy', 'firstName lastName email profilePicture');
    
    if (!wikiPage) {
      return res.status(404).json({
        success: false,
        message: 'Wiki page not found'
      });
    }
    
    // Find specific version
    const version = wikiPage.history.find(
      v => v._id.toString() === versionId
    );
    
    if (!version) {
      return res.status(404).json({
        success: false,
        message: 'Version not found'
      });
    }
    
    res.status(200).json({
      success: true,
      version
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving wiki page version',
      error: error.message
    });
  }
};

// Restore wiki page to a previous version
exports.restoreWikiPageVersion = async (req, res) => {
  try {
    const { versionId } = req.params;
    
    const wikiPage = await WikiPage.findById(req.params.wikiId);
    
    if (!wikiPage) {
      return res.status(404).json({
        success: false,
        message: 'Wiki page not found'
      });
    }
    
    // Find specific version
    const versionIndex = wikiPage.history.findIndex(
      v => v._id.toString() === versionId
    );
    
    if (versionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Version not found'
      });
    }
    
    // Get version content
    const version = wikiPage.history[versionIndex];
    
    // Add current version to history
    wikiPage.addVersion(
      version.content, 
      req.user.id, 
      `Restored to version from ${new Date(version.editedAt).toLocaleString()}`
    );
    
    await wikiPage.save();
    
    res.status(200).json({
      success: true,
      message: 'Wiki page restored to previous version',
      wikiPage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error restoring wiki page version',
      error: error.message
    });
  }
};

// Revert to previous version
exports.revertToVersion = async (req, res) => {
  try {
    const { wikiPageId, versionId } = req.params;
    
    const wikiPage = await WikiPage.findById(wikiPageId);
    
    if (!wikiPage) {
      return res.status(404).json({
        success: false,
        message: 'Wiki page not found'
      });
    }
    
    // Find specific version
    const versionIndex = wikiPage.history.findIndex(
      v => v._id.toString() === versionId
    );
    
    if (versionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Version not found'
      });
    }
    
    // Get version content
    const version = wikiPage.history[versionIndex];
    
    // Update current content with version content
    wikiPage.content = version.content;
    wikiPage.lastEditedBy = req.user.id;
    wikiPage.lastEditedAt = Date.now();
    
    // Add entry to history
    wikiPage.history.push({
      content: version.content,
      editedBy: req.user.id,
      editedAt: Date.now(),
      comment: `Reverted to version from ${new Date(version.editedAt).toLocaleString()}`
    });
    
    await wikiPage.save();
    
    res.status(200).json({
      success: true,
      message: 'Wiki page reverted to previous version',
      wikiPage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error reverting wiki page',
      error: error.message
    });
  }
};