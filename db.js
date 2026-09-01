'use strict';

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'labels.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plant TEXT NOT NULL,
    location_type TEXT NOT NULL,
    shelf_prefix TEXT,
    shelf_start TEXT,
    shelf_end TEXT,
    partition_start TEXT,
    partition_end TEXT,
    arrow TEXT NOT NULL DEFAULT 'up',
    status TEXT NOT NULL DEFAULT 'pending', -- pending | processing | paused | completed
    total_count INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL REFERENCES batches(id),
    sequence_no INTEGER NOT NULL,
    location_code TEXT NOT NULL,
    sbpl TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending | printing | completed | failed
    error_message TEXT,
    printed_at TEXT,
    UNIQUE(batch_id, sequence_no)
  );

  -- Index to keep getNextLabelToPrint instantaneous
  CREATE INDEX IF NOT EXISTS idx_labels_queue 
  ON labels(batch_id, status, sequence_no);

`);

function createBatch(form, totalCount) {
  const stmt = db.prepare(`
    INSERT INTO batches
      (plant, location_type, shelf_prefix, shelf_start, shelf_end, partition_start, partition_end, arrow, status, total_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `);
  const result = stmt.run(
    form.plant,
    form.locationType,
    form.shelfPrefix || null,
    form.shelfStart || null,
    form.shelfEnd || null,
    form.partitionStart || null,
    form.partitionEnd || null,
    form.arrowMode || 'up',
    totalCount,
    new Date().toISOString()
  );
  return Number(result.lastInsertRowid);
}

function addLabel(batchId, sequenceNo, code, sbpl) {
  db.prepare(`
    INSERT INTO labels (batch_id, sequence_no, location_code, sbpl, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).run(batchId, sequenceNo, code, sbpl);
}

// Picks up 'pending' labels in order, but also re-selects a 'failed' one
// first if present -- this is what makes "resume" retry the label that
// stopped the batch, instead of skipping past it.
function getNextLabelToPrint(batchId) {
  return db.prepare(`
    SELECT * FROM labels
    WHERE batch_id = ? AND status IN ('failed', 'pending')
    ORDER BY (status = 'failed') DESC, sequence_no ASC
    LIMIT 1
  `).get(batchId);
}

function markLabelStatus(labelId, status, errorMessage = null) {
  db.prepare(`
    UPDATE labels
    SET status = ?, error_message = ?, printed_at = ?
    WHERE id = ?
  `).run(status, errorMessage, status === 'completed' ? new Date().toISOString() : null, labelId);
}

function updateBatchStatus(batchId, status) {
  db.prepare(`UPDATE batches SET status = ? WHERE id = ?`).run(status, batchId);
}

function getBatch(batchId) {
  const batch = db.prepare(`SELECT * FROM batches WHERE id = ?`).get(batchId);
  if (!batch) return null;

  const { completedCount } = db.prepare(`
    SELECT COUNT(*) AS completedCount FROM labels WHERE batch_id = ? AND status = 'completed'
  `).get(batchId);

  const lastFailed = db.prepare(`
    SELECT error_message FROM labels WHERE batch_id = ? AND status = 'failed'
    ORDER BY sequence_no DESC LIMIT 1
  `).get(batchId);

  return {
    ...batch,
    completedCount,
    lastError: lastFailed ? lastFailed.error_message : null
  };
}

module.exports = {
  createBatch,
  addLabel,
  getNextLabelToPrint,
  markLabelStatus,
  updateBatchStatus,
  getBatch
};