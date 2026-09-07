/**
 * Generates serial labels based on input parameters.
 * 
 * @param {Object} form - An object containing form data used to generate labels
 *   The required properties are:
 *     - plant: Name of the plant or department
 *     - department: Department name
 * Additional properties relate to labeling options including:
 *     - shelfMode: Determines if shelf numbers are single or range
 *     - shelfPrefix: Prefix added to shelf numbers
 *     - shelfStart: Starting number for shelves
 *     - shelfEnd: Ending number for shelves
 *     - partitionMode: Determines if partition letters are none or range
 *     - partitionStart: Starting character for partitions
 *     - partitionEnd: Ending character for partitions
 *     - arrowMode: Direction(s) for arrows in labels
 *   The function parameter determines if labels have arrows and in which directions
 * 
 * @returns {Array} Array of objects where each each contains:
 *   - arrow: Arrow direction(up |down) or 'none'
 *   - labelString: Underscore-separated values combining all parts except separator
 */
function buildLabel(form) {
  const {
    plant,
    department,
    shelfMode,
    shelfPrefix,
    shelfStart,
    shelfEnd,
    partitionMode,
    partitionStart,
    partitionEnd,
    arrowMode
  } = form;

  const normalizedPlant = String(plant).toUpperCase();
  const normalizedDepartment = String(department).toUpperCase();
  const normalizedShelfPrefix = String(shelfPrefix).toUpperCase();
  const normalizedPartitionStart = String(partitionStart).toUpperCase();
  const normalizedPartitionEnd = String(partitionEnd).toUpperCase();

  // Validate required fields and pass the error message to the front-end if any of the required fields are missing
  if (!plant || !department) {
    throw new Error('Plant and Department are required');
  }

  let shelfNumbers = [];
  if (shelfMode === 'single') {
    shelfNumbers = [`${normalizedShelfPrefix}${shelfStart}`];
  } else if (shelfMode === 'range') {
    const startNumber = Number(shelfStart);
    const endNumber = Number(shelfEnd);
    shelfNumbers = Array.from({ length: endNumber - startNumber + 1 }, (_, i) => `${normalizedShelfPrefix}${i + startNumber}`);
  }

  let partitionLetters = [];
  if (partitionMode === 'none') {
    // Keep one iteration so each shelf still produces a label.
    partitionLetters = [''];
  } else if (partitionMode === 'range') {
    partitionLetters = Array.from({ length: normalizedPartitionEnd.charCodeAt(0) - normalizedPartitionStart.charCodeAt(0) + 1 }, (_, i) => String.fromCharCode(normalizedPartitionStart.charCodeAt(0) + i));
  }

  const labels = [];

  if (arrowMode === 'both') {
    shelfNumbers.forEach(shelfNumber => {
      partitionLetters.forEach(partitionLetter => {
        const labelString = `${normalizedPlant}_${normalizedDepartment}_${shelfNumber}${partitionLetter ? `-${partitionLetter}` : ''}`;
        labels.push({
          arrow: 'up',
          labelString
        });
        labels.push({
          arrow: 'down',
          labelString
        });
      });
    });
  } else {
    shelfNumbers.forEach(shelfNumber => {
      partitionLetters.forEach(partitionLetter => {
        labels.push({
          arrow: arrowMode,
          labelString: `${normalizedPlant}_${normalizedDepartment}_${shelfNumber}${partitionLetter ? `-${partitionLetter}` : ''}`
        });
      });
    });
  }

  return labels;
}

module.exports = { buildLabel };
