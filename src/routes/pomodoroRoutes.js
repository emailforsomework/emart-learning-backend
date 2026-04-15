'use strict';

const router       = require('express').Router();
const ctrl         = require('../controllers/pomodoroController');
const authenticate = require('../middleware/authenticate');

router.use(authenticate);

router.post('/start',          ctrl.startSession);
router.get('/active',          ctrl.getActiveSession);
router.patch('/:id/complete',  ctrl.completeSession);

module.exports = router;
