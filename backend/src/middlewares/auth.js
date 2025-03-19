const jwt = require('jsonwebtoken');
const config = require('../config/config');
const User = require('../models/User');

// Middleware to authenticate users using JWT
exports.authenticate = async (req, res, next) => {
  try {
    // Get token from header (check both x-auth-token and Authorization header)
    let token = req.header('x-auth-token');
    
    // If token not found in x-auth-token, check Authorization header
    if (!token) {
      const authHeader = req.header('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7); // Remove 'Bearer ' prefix
      }
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'No authentication token, access denied' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwtSecret);
    
    // Find user by id
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token, user not found' 
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User account is inactive, access denied'
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      message: 'Token is not valid' 
    });
  }
};

// Middleware to check if user is admin
exports.isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied. Admin role required.'
    });
  }
};

// Middleware to check if user is admin or manager
exports.isAdminOrManager = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'manager')) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied. Admin or Manager role required.'
    });
  }
};

// Middleware to check if user is admin or has administrative expertise
exports.hasAdministrativeAccess = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.expertiseArea === 'administrative')) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied. Administrative access required.'
    });
  }
};

// Middleware to limit request rate (prevent brute force)
exports.rateLimiter = (requestLimit, timeWindowMinutes) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const windowStart = now - (timeWindowMinutes * 60 * 1000);
    
    // Clear old requests outside time window
    if (requests.has(ip)) {
      const userRequests = requests.get(ip).filter(time => time > windowStart);
      requests.set(ip, userRequests);
      
      if (userRequests.length >= requestLimit) {
        return res.status(429).json({
          success: false,
          message: 'Too many requests, please try again later.'
        });
      }
      
      requests.get(ip).push(now);
    } else {
      requests.set(ip, [now]);
    }
    
    next();
  };
};