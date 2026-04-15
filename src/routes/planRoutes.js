'use strict';

const router       = require('express').Router();
const ctrl         = require('../controllers/planController');
const authenticate = require('../middleware/authenticate');
const validate     = require('../middleware/validate');

router.use(authenticate); // all plan routes require auth

router.get('/active',                   ctrl.getActivePlan);
router.get('/readiness',                ctrl.getReadiness);
router.post('/',    validate.createPlan, validate.run, ctrl.createPlan);
router.get('/:id',                      ctrl.getPlanById);
router.patch('/:id',                    ctrl.updatePlanSettings);
router.patch('/:planId/topics/:topicId', validate.updateTopic, validate.run, ctrl.updateTopic);
router.post('/:planId/reschedule',      ctrl.reschedulePlan);
router.post('/:planId/archive',         ctrl.archivePlan);

module.exports = router;
