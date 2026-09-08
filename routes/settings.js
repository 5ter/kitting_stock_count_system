'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
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

router.get('/', (req, res) => {
  res.render('settings', {
    title: 'Settings',
    printerIp: process.env.PRINTER_IP || '',
    printerPort: process.env.PRINTER_PORT || '9100',
    timeZone: 'Asia/Kuala_Lumpur',
    saved: req.query.saved === '1',
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
      error: 'Enter a printer IP address and a port from 1 to 65535.'
    });
  }

  saveEnvValues(printerIp, printerPort);
  res.redirect('/settings?saved=1');
});

module.exports = router;