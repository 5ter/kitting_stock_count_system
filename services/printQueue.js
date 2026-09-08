'use strict';
const db = require('../db');
const { sendAndCheckStatus } = require('../printer/print-service');

const PRINTER_IP = process.env.PRINTER_IP;
const PRINTER_PORT = Number(process.env.PRINTER_PORT) || 9100;

// Prevents the same batch being processed twice in parallel (e.g. a
// double-click on "Resume" while the previous run is still mid-print).
const activeBatches = new Set();
const cancellationRequests = new Set();

function describeError(status) {
  switch (status.errorCode) {
    case 'HEAD_OPEN':            return 'Print head is open.';
    case 'PAPER_END':            return 'Out of labels.';
    case 'RIBBON_END':           return 'Out of ribbon.';
    case 'MEDIA_ERROR':          return 'Media error -- check label alignment.';
    case 'SENSOR_OR_PAPER_JAM':  return 'Sensor error or paper jam.';
    case 'HEAD_ERROR':           return 'Print head error.';
    case 'CARD_ERROR':           return 'Memory card error.';
    case 'CUTTER_ERROR':         return 'Cutter error.';
    case 'BUFFER_OVER':          return 'Printer buffer overflow.';
    case 'OTHER_ERROR':          return 'Printer reported a command/format error.';
    case 'RFID_TAG_ERROR':       return 'RFID tag read/write error.';
    case 'RFID_PROTECT_ERROR':   return 'RFID tag is write-protected.';
    default:                     return `Unknown printer error (${status.errorCode || status.statusChar || 'no code'}).`;
  }
}

/**
 * Walks pending (and any previously-failed) labels for a batch in
 * sequence order, printing one at a time. Stops the whole batch the
 * moment the printer reports a problem, leaving that label as 'failed'
 * and the batch as 'paused' so processBatch() can simply be called again
 * later to pick up exactly where it left off.
 *
 * Fire-and-forget by design: callers don't await this from an HTTP
 * handler, they just kick it off and let the client poll for progress.
 */
async function processBatch(batchId) {
  if (activeBatches.has(batchId)) return db.getBatch(batchId);
  activeBatches.add(batchId);
  cancellationRequests.delete(batchId);
  db.updateBatchStatus(batchId, 'processing');
  try {
    let label = db.getNextLabelToPrint(batchId);
    while (label) {
      if (cancellationRequests.has(batchId)) {
        db.updateBatchStatus(batchId, 'cancelled');
        return db.getBatch(batchId);
      }

      db.markLabelStatus(label.id, 'printing');
      try {
        const { success, status } = await sendAndCheckStatus(label.sbpl, PRINTER_IP, PRINTER_PORT, { batchId });
        if (!success) {
          db.markLabelStatus(label.id, 'failed', describeError(status));
          db.updateBatchStatus(batchId, 'paused');
          return db.getBatch(batchId);
        }
        db.markLabelStatus(label.id, 'completed');
      } catch (err) {
        // Couldn't even reach the printer, or it never confirmed completion
        // (network failure, connection timeout, offline for too long, etc.)
        // -- treat the same way as a reported printer error.
        db.markLabelStatus(label.id, 'failed', err.message);
        db.updateBatchStatus(batchId, 'paused');
        return db.getBatch(batchId);
      }
      if (cancellationRequests.has(batchId)) {
        db.updateBatchStatus(batchId, 'cancelled');
        return db.getBatch(batchId);
      }
      label = db.getNextLabelToPrint(batchId);
    }
    db.updateBatchStatus(batchId, 'completed');
    return db.getBatch(batchId);
  } finally {
    activeBatches.delete(batchId);
    cancellationRequests.delete(batchId);
  }
}

function requestCancel(batchId) {
  const batch = db.getBatch(batchId);
  if (!activeBatches.has(batchId) || !batch || batch.status !== 'processing') return false;
  cancellationRequests.add(batchId);
  return true;
}

module.exports = { processBatch, requestCancel };