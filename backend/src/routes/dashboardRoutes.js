const router = require('express').Router();
const controller = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');
router.get('/summary', authenticate, controller.summary);
module.exports = router;
