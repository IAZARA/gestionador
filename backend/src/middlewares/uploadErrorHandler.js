const multer = require('multer');

// Middleware for handling file upload errors
const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum file size is 10MB.'
      });
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false, 
        message: 'Too many files. Maximum is 5 files per upload.'
      });
    } else {
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`
      });
    }
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  next();
};

module.exports = handleUploadErrors;
