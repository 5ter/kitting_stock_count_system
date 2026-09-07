const express = require('express');
var router = express.Router();

// add the departments for each plant
const departments = {
  'A1': ['prod-stamp-L1','warehouse','assembly'],
  'A2': ['production','warehouse','ass-L3'],
  'A3': ['production','warehouse','assembly'],
  'A4': ['production','warehouse','assembly']
};

// departments route
router.get('/',(req,res)=>{
  const plant = req.query.plant;
  const departmentList = departments[plant] ?? [];
  res.render('partials/department',{departments: departmentList});
})  

module.exports = router;
