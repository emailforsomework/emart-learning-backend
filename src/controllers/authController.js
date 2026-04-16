'use strict';

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');

const userRepository = require('../repositories/userRepository');
const {
  JWT_ACCESS_SECRET, JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY,
  NODE_ENV,
} = require('../config/env');

// ─── Token factories ──────────────────────────────────────────────────────────

const signAccess = (user) =>
  jwt.sign({ sub: user._id, email: user.email }, JWT_ACCESS_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRY,
  });

const signRefresh = (user) =>
  jwt.sign({ sub: user._id }, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRY,
  });

const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,         // not readable via JS — eliminates XSS risk
    secure: true,           // Always secure for SameSite: None compatibility
    sameSite: 'None',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

// ─── Controllers ──────────────────────────────────────────────────────────────

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existing = await userRepository.findByEmail(email);
    if (existing) {
      const err = new Error('An account with this email already exists.');
      err.statusCode = 409; err.code = 'EMAIL_TAKEN';
      return next(err);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await userRepository.create({ name, email, passwordHash });

    const accessToken  = signAccess(user);
    const refreshToken = signRefresh(user);
    await userRepository.setRefreshToken(user._id, refreshToken);

    setRefreshCookie(res, refreshToken);

    res.status(201).json({
      success: true,
      accessToken,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await userRepository.findByEmail(email);
    if (!user) {
      const err = new Error('Invalid email or password.');
      err.statusCode = 401; err.code = 'INVALID_CREDENTIALS';
      return next(err);
    }

    // Fetch with passwordHash (lean() strips it by default — fetch raw)
    const fullUser = await userRepository.findByIdWithToken(user._id);
    const valid = await bcrypt.compare(password, fullUser.passwordHash);
    if (!valid) {
      const err = new Error('Invalid email or password.');
      err.statusCode = 401; err.code = 'INVALID_CREDENTIALS';
      return next(err);
    }

    const accessToken  = signAccess(user);
    const refreshToken = signRefresh(user);
    await userRepository.setRefreshToken(user._id, refreshToken);

    setRefreshCookie(res, refreshToken);

    res.json({
      success: true,
      accessToken,
      user: {
        id: user._id, name: user.name, email: user.email,
        timezone: user.timezone, currentStreak: user.currentStreak,
        stats: user.stats,
      },
    });
  } catch (err) {
    next(err);
  }
};

const refresh = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) {
      const err = new Error('Refresh token missing.');
      err.statusCode = 401; err.code = 'NO_REFRESH_TOKEN';
      return next(err);
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_REFRESH_SECRET);
    } catch {
      const err = new Error('Refresh token invalid or expired. Please log in again.');
      err.statusCode = 401; err.code = 'INVALID_REFRESH_TOKEN';
      return next(err);
    }

    const user = await userRepository.findByIdWithToken(payload.sub);
    if (!user || user.refreshToken !== token) {
      // Token rotation: if stored token doesn't match, possible token reuse attack
      const err = new Error('Refresh token reuse detected. Please log in again.');
      err.statusCode = 401; err.code = 'TOKEN_REUSE';
      return next(err);
    }

    // Rotate — issue new tokens
    const newAccess  = signAccess(user);
    const newRefresh = signRefresh(user);
    await userRepository.setRefreshToken(user._id, newRefresh);

    setRefreshCookie(res, newRefresh);

    res.json({ success: true, accessToken: newAccess });
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    if (token) {
      try {
        const payload = jwt.verify(token, JWT_REFRESH_SECRET);
        await userRepository.clearRefreshToken(payload.sub);
      } catch {
        // Token already invalid — proceed with clearing cookie
      }
    }

    res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'None', secure: true });
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await userRepository.findById(req.user.id);
    if (!user) {
      const err = new Error('User not found.'); err.statusCode = 404; err.code = 'NOT_FOUND';
      return next(err);
    }
    res.json({
      success: true,
      user: {
        id: user._id, name: user.name, email: user.email,
        timezone: user.timezone, currentStreak: user.currentStreak,
        stats: user.stats, preferences: user.preferences,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, refresh, logout, getMe };
