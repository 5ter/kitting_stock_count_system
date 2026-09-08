'use strict';

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { nowMalaysia } = require('./services/time');

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
    arrow TEXT NOT NULL DEFAULT 'none',
    status TEXT NOT NULL DEFAULT 'pending', -- pending | processing | paused | cancelled | completed
    total_count INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL REFERENCES batches(id),
    sequence_no INTEGER NOT NULL,
    location_code TEXT NOT NULL,
    sbpl TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending | printing | completed | failed | cancelled
    error_message TEXT,
    printed_at TEXT,
    UNIQUE(batch_id, sequence_no)
  );

  -- Index to keep getNextLabelToPrint instantaneous
  CREATE INDEX IF NOT EXISTS idx_labels_queue 
  ON labels(batch_id, status, sequence_no);

`);

function normalizeText(value) {
  return value == null ? null : String(value).trim().toUpperCase();
}

function createBatch(form, totalCount) {
  const stmt = db.prepare(`
    INSERT INTO batches
      (plant, location_type, shelf_prefix, shelf_start, shelf_end, partition_start, partition_end, arrow, status, total_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `);
  const result = stmt.run(
    normalizeText(form.plant),
    normalizeText(form.locationType || form.department),
    normalizeText(form.shelfPrefix),
    normalizeText(form.shelfStart),
    normalizeText(form.shelfEnd),
    normalizeText(form.partitionStart),
    normalizeText(form.partitionEnd),
    form.arrowMode || 'none',
    totalCount,
    nowMalaysia()
  );
  return Number(result.lastInsertRowid);
}

function addLabel(batchId, sequenceNo, code, sbpl) {
  db.prepare(`
    INSERT INTO labels (batch_id, sequence_no, location_code, sbpl, status)
    VALUES (?, ?, ?, ?, 'pending')
  `).run(batchId, sequenceNo, normalizeText(code), normalizeText(sbpl));
}

// Picks up 'pending' labels in order, but also re-selects a 'failed' one
// first so resume retries the label that encountered the printer error.
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
  `).run(status, errorMessage, status === 'completed' ? nowMalaysia() : null, labelId);
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

function getHistory() {
  const rows = db.prepare(`
    SELECT
      b.id AS batch_id,
      b.plant,
      b.location_type,
      b.status AS batch_status,
      b.total_count,
      b.created_at,
      l.id AS label_id,
      l.sequence_no,
      l.location_code,
      l.status AS label_status,
      l.error_message,
      l.printed_at
    FROM batches b
    LEFT JOIN labels l ON l.batch_id = b.id
    ORDER BY b.created_at DESC, b.id DESC, l.sequence_no ASC
  `).all();

  const batches = new Map();
  for (const row of rows) {
    if (!batches.has(row.batch_id)) {
      batches.set(row.batch_id, {
        id: row.batch_id,
        plant: row.plant,
        locationType: row.location_type,
        status: row.batch_status,
        totalCount: row.total_count,
        createdAt: row.created_at,
        labels: []
      });
    }
    if (row.label_id !== null) {
      batches.get(row.batch_id).labels.push({
        id: row.label_id,
        sequenceNo: row.sequence_no,
        locationCode: row.location_code,
        status: row.label_status,
        errorMessage: row.error_message,
        printedAt: row.printed_at
      });
    }
  }

  const grouped = new Map();
  for (const batch of batches.values()) {
    const date = batch.createdAt.slice(0, 10);
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date).push(batch);
  }
  return [...grouped.entries()].map(([date, batchesForDate]) => ({
    date,
    batches: batchesForDate
  }));
}

function clearHistory() {
  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM labels; DELETE FROM batches;');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

module.exports = {
  createBatch,
  addLabel,
  getNextLabelToPrint,
  markLabelStatus,
  updateBatchStatus,
  getBatch,
  getHistory,
  clearHistory
};