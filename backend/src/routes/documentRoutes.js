const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('../controllers/documentController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { customerDocuments, fieldDocuments } = require('../middleware/upload');

router.use(authenticate);
router.get('/customer/mine', authorize('CUSTOMER'), controller.myCustomerDocuments);
router.get('/customer/readiness', authorize('CUSTOMER'), controller.customerReadiness);
router.post('/customer/:type/reupload', authorize('CUSTOMER'), customerDocuments.single('document'), controller.reuploadCustomerDocument);
router.get('/application/:applicationId', authorize('OWNER', 'MANAGER', 'AGENT', 'CUSTOMER'), controller.applicationDocuments);
router.patch('/customer/:id/review', authorize('MANAGER'), [
  body('decision').isIn(['ACCEPTED', 'REJECTED', 'REUPLOAD_REQUIRED']),
  body('note').optional({ nullable: true }).isLength({ max: 1500 }),
], validate, controller.reviewCustomerDocument);
router.patch('/field/:id/review', authorize('MANAGER'), [
  body('decision').isIn(['ACCEPTED', 'REJECTED', 'REUPLOAD_REQUIRED']),
  body('note').optional({ nullable: true }).isLength({ max: 1500 }),
], validate, controller.reviewFieldDocument);
router.post('/field/visit/:visitId', authorize('AGENT'), fieldDocuments.single('document'), [
  body('document_type').isIn(['RESIDENCE_PHOTO', 'BUSINESS_PHOTO', 'INCOME_EVIDENCE', 'SIGNED_FORM', 'VISIT_REPORT', 'OTHER']),
  body('title').optional({ checkFalsy: true }).isLength({ max: 160 }),
], validate, controller.uploadFieldDocument);
router.get('/field/visit/:visitId', authorize('OWNER', 'MANAGER', 'AGENT', 'CUSTOMER'), controller.visitFieldDocuments);
module.exports = router;
