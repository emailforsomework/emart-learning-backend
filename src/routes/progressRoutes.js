'use strict';

const router       = require('express').Router();
const ctrl         = require('../controllers/progressController');
const authenticate = require('../middleware/authenticate');
const validate     = require('../middleware/validate');

router.use(authenticate);

router.post('/',                  ctrl.logSession);
router.get('/',  validate.paginationQuery, validate.run, ctrl.getProgress);
router.get('/readiness-history',  ctrl.getReadinessHistory);

module.exports = router;
