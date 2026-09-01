var express = require('express');
var router = express.Router();

// add the plant option
const plants = ['A1','A2','A3','A4','A5','A6','A7'];
// add the departments for each plant
const departments = {
  'A1': ['prod-stamp-L1','warehouse','assembly'],
  'A2': ['production','warehouse','ass-L3'],
  'A3': ['production','warehouse','assembly'],
  'A4': ['production','warehouse','assembly']
};

// departments route
router.get('/departments',(req,res)=>{
  const plant = req.query.plant;
  const departmentList = departments[plant] ?? [];
  res.render('partials/department',{departments: departmentList});
})  

// routes/index.js
const sampleLabels = [
  { code: 'A1_WH_C01-A', meta: 'Zone A1 • Shelf C01 • P-A', arrow: 'down' },
  { code: 'A1_WH_C01-B', meta: 'Zone A1 • Shelf C01 • P-B', arrow: 'up', active: true },
  { code: 'A1_WH_C01-C', meta: 'Zone A1 • Shelf C01 • P-C', arrow: 'up' },
  { code: 'A1_WH_C01-D', meta: 'Zone A1 • Shelf C01 • P-D', arrow: 'up' },
];

router.get('/', (req, res) => {
  res.render('index', { 
    title: 'Generate Shelf Label', 
    labels: sampleLabels, 
    totalCount: sampleLabels.length,
    plants: plants,
    departments: [],
   });
});

router.post('/labels/preview', (req, res) => {
  const labels = buildLabelsFromForm(req.body); // your real logic goes here
  res.render('partials/preview-grid', { labels });
});

router.post('/labels/generate', (req, res) => {
  const labels = buildLabelsFromForm(req.body);
  // ...actually send to the SATO printer here...
  res.send(`<p>Batch of ${labels.length} labels sent to printer.</p>`);
});

module.exports = router;
