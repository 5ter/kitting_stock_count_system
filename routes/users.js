var express = require('express');
const validateLabelForm = require('../middleware/validateLabelForm');
var router = express.Router();

/* GET users listing. */
router.get('/', validateLabelForm, function(req, res, next) {
  res.send('respond with a resource');
});

module.exports = router;
