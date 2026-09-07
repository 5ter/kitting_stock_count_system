'use strict';

/**
 * Expands a single value or a start/end range into an array of string values.
 *
 * @param {'range'|'single'} mode - Selection mode ('range' expands values; 'single' returns start value only).
 * @param {string|number} [start] - Starting boundary value (e.g., "01" or "A").
 * @param {string|number} [end] - Ending boundary value (e.g., "10" or "Z").
 * @returns {(string|null)[]} Array of expanded strings, or `[null]` if `start` is empty.
 *
 * @expectedInputs
 * - Numeric ranges: Zero-padded numeric strings (e.g., start="01", end="05").
 * - Single-character ranges: Standard single ASCII letters (e.g., start="A", end="D").
 * - Single mode or missing end: Returns `[start]` directly without expansion.
 *
 * @behavior
 * - Preserves zero-padding width based on `start` string length for numeric ranges.
 * - Handles ascending (1 -> 5) and descending (5 -> 1) ranges safely.
 * - Converts alphabetic bounds to uppercase character sequences.
 * - Returns `[null]` when `start` is omitted, enabling downstream optional range handling.
 */
function expandRange(mode, start, end) {
  // If start is omitted, return [null] to signify an optional/empty dimension
  if (start === undefined || start === null || start === '') return [null];

  const startStr = String(start).trim();

  // Non-range mode or missing end boundary returns the start value directly
  if (mode !== 'range' || !end) return [startStr];

  const endStr = String(end).trim();

  // --- Case 1: Numeric Range Expansion (e.g., "01" to "10" or "10" to "01") ---
  if (/^\d+$/.test(startStr) && /^\d+$/.test(endStr)) {
    const padLength = startStr.length;
    const from = parseInt(startStr, 10);
    const to = parseInt(endStr, 10);
    const step = from <= to ? 1 : -1;
    const values = [];

    if (step === 1) {
      for (let i = from; i <= to; i++) {
        values.push(String(i).padStart(padLength, '0'));
      }
    } else {
      for (let i = from; i >= to; i--) {
        values.push(String(i).padStart(padLength, '0'));
      }
    }
    return values;
  }

  // --- Case 2: Single-Character Alphabetical Expansion (e.g., "A" to "E") ---
  if (/^[a-zA-Z]$/.test(startStr) && /^[a-zA-Z]$/.test(endStr)) {
    const from = startStr.toUpperCase().charCodeAt(0);
    const to = endStr.toUpperCase().charCodeAt(0);
    const step = from <= to ? 1 : -1;
    const values = [];

    if (step === 1) {
      for (let code = from; code <= to; code++) {
        values.push(String.fromCharCode(code));
      }
    } else {
      for (let code = from; code >= to; code--) {
        values.push(String.fromCharCode(code));
      }
    }
    return values;
  }

  // Fallback: If bounds fail format validation, return start string as-is
  return [startStr];
}

/**
 * Expands label generator form parameters into individual location item descriptors.
 *
 * @param {Object} form - Form payload from the label generation request.
 * @param {string} form.plant - Plant or facility code (e.g., "PLANT1").
 * @param {string} form.locationType - Full location type name (e.g., "WAREHOUSE", "STAGING", "DOCK").
 * @param {'range'|'single'} [form.shelfMode='range'] - Shelf expansion mode.
 * @param {string} [form.shelfPrefix=''] - Optional prefix prepended to shelf numbers (e.g., "S").
 * @param {string} [form.shelfStart] - Starting shelf identifier.
 * @param {string} [form.shelfEnd] - Ending shelf identifier.
 * @param {'range'|'single'} [form.partitionMode='range'] - Partition expansion mode.
 * @param {string} [form.partitionStart] - Starting partition identifier.
 * @param {string} [form.partitionEnd] - Ending partition identifier.
 * @param {string} [form.arrowMode='up'] - Label arrow orientation indicator ('up' | 'down').
 *
 * @returns {Array<{sequence: number, code: string, arrow: string}>} Array of expanded label items.
 *
 * @expectedInputs
 * - `locationType` expects the full string name (e.g., 'WAREHOUSE'). It will be trimmed and uppercased.
 * - Missing partition parameters generate shelf-level codes without partition suffixes.
 *
 * @behavior
 * - Generates a Cartesian product across all shelf and partition combinations (Shelves × Partitions).
 * - Standardizes formatting to: `{PLANT}_{LOCATION_TYPE}_{SHELF_PREFIX}{SHELF}-{PARTITION}`.
 * - Formats to `{PLANT}_{LOCATION_TYPE}_{SHELF_PREFIX}{SHELF}` if no partition is present.
 * - Returns sequence indices starting at 0.
 */
function expandLocations(form) {
  const {
    plant = '',
    locationType = '',
    shelfMode = 'range',
    shelfPrefix = '',
    shelfStart,
    shelfEnd,
    partitionMode = 'range',
    partitionStart,
    partitionEnd,
    arrowMode = 'up'
  } = form;

  // Clean inputs: Trim whitespace and normalize to uppercase
  const cleanPlant = String(plant).trim().toUpperCase();
  const cleanType = String(locationType).trim().toUpperCase();

  // Expand dimensions into discrete arrays
  const shelves = expandRange(shelfMode, shelfStart, shelfEnd);
  const partitions = expandRange(partitionMode, partitionStart, partitionEnd);

  const locations = [];
  let sequence = 0;

  // Generate Cartesian product (Shelves x Partitions)
  for (const shelf of shelves) {
    if (!shelf) continue; // Skip if shelf range produced no valid starting point

    for (const partition of partitions) {
      const shelfCode = `${shelfPrefix}${shelf}`;
      
      // Construct full location code using full location type name
      const code = partition
        ? `${cleanPlant}_${cleanType}_${shelfCode}-${partition}`
        : `${cleanPlant}_${cleanType}_${shelfCode}`;

      locations.push({
        sequence: sequence++,
        code,
        arrow: arrowMode
      });
    }
  }

  return locations;
}

module.exports = { expandLocations, expandRange };