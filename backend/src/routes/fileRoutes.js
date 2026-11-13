const router = require('express').Router();
const controller = require('../controllers/fileController');
const { authenticate } = require('../middleware/auth');
router.use(authenticate);
router.get('/customer-document/:id', controller.customerDocument);
router.get('/field-document/:id', controller.fieldDocument);
router.get('/payment-slip/:id', controller.paymentSlip);
module.exports = router;
