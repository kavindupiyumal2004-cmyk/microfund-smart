const router = require('express').Router();
const controller = require('../controllers/publicController');
router.get('/areas', controller.areas);
router.get('/loan-types', controller.loanTypes);
router.get('/company', controller.company);
module.exports = router;
