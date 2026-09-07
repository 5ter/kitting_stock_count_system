var express = require('express');
var router = express.Router();
const { buildLabel } = require('../services/buildLabel');
const validateLabelForm = require('../middleware/validateLabelForm');
const db = require('../db'); // Import the database connection
const { generateLabel } = require('../printer/generate-label');
const { processBatch } = require('../services/printQueue');
// add the plant option
const plants = ['A1','A2','A3','A4','A5','A6','A7'];

// routes/index.js
let labelLength = 0;

router.get('/', (req, res) => {
  res.render('index', { 
    title: 'Generate Shelf Label', 
    // labels: sampleLabels, 
    totalCount: labelLength,
    plants: plants,
    departments: [],
   });
});

router.post('/labels/preview', (req, res) => {
   console.log('BODY:', req.body); // ← temporary
  const labels = buildLabel(req.body); 
  labelLength = labels.length; // Update the label length based on the generated labels
  console.log('Preview labels:', labels); // Log the generated labels for debugging
  res.render('partials/preview-grid', { labels });
});

router.post('/labels/generate', validateLabelForm, async (req, res) => {
  try {
    const labels = buildLabel(req.body);
    if (labels.length === 0) {
      return res.status(400).send('<p>No labels were generated.</p>');
    }

    const batchId = db.createBatch(req.body, labels.length);
    labels.forEach((label, index) => {
      const arrow = label.arrow === 'none' ? '' : label.arrow;
      const sbpl = generateLabel(label.labelString, arrow);
      db.addLabel(batchId, index + 1, label.labelString, sbpl);
    });

    const batch = await processBatch(batchId);
    if (batch.status !== 'completed') {
      return res.status(502).send(
        `<p>Printing paused after ${batch.completedCount} of ${batch.total_count} labels: ${batch.lastError || 'Printer error.'}</p>`
      );
    }

    res.send(`<p>Batch of ${batch.total_count} labels printed successfully.</p>`);
  } catch (error) {
    console.error('Label generation failed:', error);
    res.status(500).send(`<p>Unable to print labels: ${error.message}</p>`);
  }
});

module.exports = router;
