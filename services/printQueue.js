'use strict';

const db = require('../db');
const { sendAndCheckStatus } = require('../print-service');

const PRINTER_IP = process.env.PRINTER_IP;
const PRINTER_PORT = Number(process.env.PRINTER_PORT) || 9100;

// Prevents the same batch being processed twice in parallel (e.g. a
// double-click on "Resume" while the previous run is still mid-print).
const activeBatches = new Set();

function describeError(status) {
  if (status.headOpen) return 'Print head is open.';
  if (status.paperOrRibbonError) return 'Paper or ribbon error.';
  if (status.isOffline) return 'Printer is offline.';
  return 'Unknown printer error.';
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
  if (activeBatches.has(batchId)) return;
  activeBatches.add(batchId);
  db.updateBatchStatus(batchId, 'processing');

  try {
    let label = db.getNextLabelToPrint(batchId);

    while (label) {
      db.markLabelStatus(label.id, 'printing');

      try {
        const { status } = await sendAndCheckStatus(label.sbpl, PRINTER_IP, PRINTER_PORT);
        const hasError = status.isOffline || status.paperOrRibbonError || status.headOpen;

        if (hasError) {
          db.markLabelStatus(label.id, 'failed', describeError(status));
          db.updateBatchStatus(batchId, 'paused');
          return;
        }   

        db.markLabelStatus(label.id, 'completed');
      } catch (err) {
        // Couldn't even reach the printer (network/timeout) -- treat the
        // same way as a reported printer error.
        db.markLabelStatus(label.id, 'failed', err.message);
        db.updateBatchStatus(batchId, 'paused');
        return;
      }

      label = db.getNextLabelToPrint(batchId);
    }

    db.updateBatchStatus(batchId, 'completed');
  } finally {
    activeBatches.delete(batchId);
  }
}

module.exports = { processBatch };