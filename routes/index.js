var express = require('express');
var router = express.Router();

// routes/index.js
const sampleLabels = [
  { code: 'A1_WH_C01-A', meta: 'Zone A1 • Shelf C01 • P-A', arrow: 'up' },
  { code: 'A1_WH_C01-B', meta: 'Zone A1 • Shelf C01 • P-B', arrow: 'up', active: true },
  { code: 'A1_WH_C01-C', meta: 'Zone A1 • Shelf C01 • P-C', arrow: 'up' },
  { code: 'A1_WH_C01-D', meta: 'Zone A1 • Shelf C01 • P-D', arrow: 'up' },
];

router.get('/', (req, res) => {
  res.render('index', { title: 'Generate Shelf Label', labels: sampleLabels, totalCount: sampleLabels.length });
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
