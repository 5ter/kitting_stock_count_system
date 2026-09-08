var express = require('express');
var router = express.Router();
const { buildLabel } = require('../services/buildLabel');
const validateLabelForm = require('../middleware/validateLabelForm');
const db = require('../db'); // Import the database connection
const { generateLabel } = require('../printer/generate-label');
const { processBatch, requestCancel } = require('../services/printQueue');
// add the plant option
const plants = ['A1','A2','A3','A4','A5','A6','A7'];

function createAndStartBatch(form) {
  const labels = buildLabel(form);
  if (labels.length === 0) {
    const error = new Error('No labels were generated.');
    error.status = 400;
    throw error;
  }

  const batchId = db.createBatch(form, labels.length);
  labels.forEach((label, index) => {
    const arrow = label.arrow === 'none' ? '' : label.arrow;
    const sbpl = generateLabel(label.labelString, arrow);
    db.addLabel(batchId, index + 1, label.labelString, sbpl);
  });

  processBatch(batchId).catch(error => {
    console.error(`Batch ${batchId} failed unexpectedly:`, error);
  });
  return { batchId, totalCount: labels.length };
}

router.get('/', (req, res) => {
  res.render('index', { 
    title: 'Generate Shelf Label', 
    // labels: sampleLabels, 
    totalCount: 0,
    plants: plants,
    departments: [],
   });
});

router.post('/labels/preview', (req, res) => {
  const labels = buildLabel(req.body);
  res.render('partials/preview-grid', {
    labels,
    totalCount: labels.length,
    includeCountUpdates: true
  });
});

router.post('/labels/generate', validateLabelForm, async (req, res) => {
  try {
    res.json(createAndStartBatch(req.body));
  } catch (error) {
    console.error('Label generation failed:', error);
    res.status(500).json({ error: `Unable to print labels: ${error.message}` });
  }
});

router.get('/labels/batches/:batchId', (req, res) => {
  const batch = db.getBatch(Number(req.params.batchId));
  if (!batch) return res.status(404).json({ error: 'Batch not found.' });
  res.json(batch);
});

router.post('/labels/batches/:batchId/cancel', (req, res) => {
  const batchId = Number(req.params.batchId);
  if (!requestCancel(batchId)) {
    return res.status(409).json({ error: 'Batch is not currently printing.' });
  }
  res.json({ batchId, status: 'cancelling' });
});

router.post('/labels/batches/:batchId/resume', (req, res) => {
  const batchId = Number(req.params.batchId);
  const batch = db.getBatch(batchId);
  if (!batch) return res.status(404).json({ error: 'Batch not found.' });
  if (!['paused', 'cancelled'].includes(batch.status)) {
    return res.status(409).json({ error: 'Only paused or cancelled batches can be resumed.' });
  }

  processBatch(batchId).catch(error => {
    console.error(`Batch ${batchId} resume failed unexpectedly:`, error);
  });
  res.json({ batchId, status: 'processing' });
});

module.exports = router;
