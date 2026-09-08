'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { testConnection } = require('../printer/print-service');
const db = require('../db');
require('dotenv').config();

const router = express.Router();

const ENV_PATH = path.join(__dirname, '..', '.env');

function saveEnvValues(printerIp, printerPort) {
  let content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  const values = { PRINTER_IP: printerIp, PRINTER_PORT: String(printerPort) };

  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    content = pattern.test(content) ? content.replace(pattern, line) : `${content.trimEnd()}\n${line}\n`;
    process.env[key] = value;
  }

  fs.writeFileSync(ENV_PATH, content);
}

function saveApplicationValue(key, value) {
  let content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  content = pattern.test(content) ? content.replace(pattern, line) : `${content.trimEnd()}\n${line}\n`;
  fs.writeFileSync(ENV_PATH, content);
  process.env[key] = String(value);
}

router.get('/', (req, res) => {
  res.render('settings', {
    title: 'Settings',
    printerIp: process.env.PRINTER_IP || '',
    printerPort: process.env.PRINTER_PORT || '9100',
    maxLabelsPerBatch: process.env.MAX_LABELS_PER_BATCH || '0',
    timeZone: 'Asia/Kuala_Lumpur',
    saved: req.query.saved === '1',
    historyCleared: req.query.historyCleared === '1',
    error: null
  });
});

router.post('/', (req, res) => {
  const printerIp = String(req.body.printerIp || '').trim();
  const printerPort = Number(req.body.printerPort);

  if (!/^[a-zA-Z0-9.-]+$/.test(printerIp) || !Number.isInteger(printerPort) || printerPort < 1 || printerPort > 65535) {
    return res.status(400).render('settings', {
      title: 'Settings',
      printerIp,
      printerPort: req.body.printerPort || process.env.PRINTER_PORT || '9100',
      timeZone: 'Asia/Kuala_Lumpur',
      saved: false,
      error: 'Enter a printer IP address and a port from 1 to 65535.',
      historyCleared: false
    });
  }

  saveEnvValues(printerIp, printerPort);
  res.redirect('/settings?saved=1');
});

router.post('/test-connection', async (req, res) => {
  try {
    const printerIp = String(req.body.printerIp || process.env.PRINTER_IP || '').trim();
    const printerPort = Number(req.body.printerPort || process.env.PRINTER_PORT || 9100);
    const result = await testConnection(printerIp, printerPort);
    res.json({ ok: true, status: result.status.mode });
  } catch (error) {
    res.status(502).json({ ok: false, error: error.message });
  }
});

router.post('/application', (req, res) => {
  const maxLabels = Number(req.body.maxLabelsPerBatch);
  if (!Number.isInteger(maxLabels) || maxLabels < 0) {
    return res.status(400).redirect('/settings?error=max');
  }
  saveApplicationValue('MAX_LABELS_PER_BATCH', maxLabels);
  res.redirect('/settings?saved=1');
});

router.get('/history/export', (req, res) => {
  res.type('application/json').attachment('label-history.json').send(JSON.stringify(db.getHistory(), null, 2));
});

router.post('/history/clear', (req, res) => {
  db.clearHistory();
  res.redirect('/settings?historyCleared=1');
});

module.exports = router;