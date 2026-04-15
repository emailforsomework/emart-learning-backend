'use strict';

const router     = require('express').Router();
const ctrl       = require('../controllers/authController');
const validate   = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');

router.post('/register', validate.register, validate.run, ctrl.register);
router.post('/login',    validate.login,    validate.run, ctrl.login);
router.post('/refresh',  ctrl.refresh);
router.post('/logout',   ctrl.logout);
router.get('/me',        authenticate,      ctrl.getMe);

module.exports = router;
