'use strict';

const jwt = require('jsonwebtoken');
const { JWT_ACCESS_SECRET } = require('../config/env');

/**
 * authenticate.js — Access token verification middleware.
 *
 * Token is read from Authorization: Bearer header (held in memory by React,
 * NOT localStorage — eliminates XSS risk).
 *
 * On 401: client should call POST /api/auth/refresh using its httpOnly
 * cookie refresh token, then retry the original request.
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      code: 'NO_TOKEN',
      message: 'Authentication required. Please log in.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_ACCESS_SECRET);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Access token expired. Refresh using /api/auth/refresh.',
      });
    }
    return res.status(401).json({
      success: false,
      code: 'INVALID_TOKEN',
      message: 'Invalid access token.',
    });
  }
};

module.exports = authenticate;
