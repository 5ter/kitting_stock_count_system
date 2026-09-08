'use strict';

const express = require('express');
const { Temporal } = require('@js-temporal/polyfill');
const db = require('../db');

const router = express.Router();

function formatDate(value) {
  return Temporal.PlainDate.from(value).toLocaleString('en-MY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function formatDateTime(value) {
  if (!value) return '-';
  const zoned = value.includes('[')
    ? Temporal.ZonedDateTime.from(value)
    : Temporal.Instant.from(value).toZonedDateTimeISO('Asia/Kuala_Lumpur');
  return zoned.toLocaleString('en-MY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

router.get('/', (req, res) => {
  const history = db.getHistory().map(day => ({
    ...day,
    dateLabel: formatDate(day.date),
    batches: day.batches.map(batch => ({
      ...batch,
      createdAtLabel: formatDateTime(batch.createdAt),
      labels: batch.labels.map(label => ({
        ...label,
        printedAtLabel: formatDateTime(label.printedAt)
      }))
    }))
  }));

  res.render('history', { title: 'Print History', history });
});

module.exports = router;