// middleware/validateLabelForm.js
function validateLabelForm(req, res, next) {
  const {
    plant = '',
    locationType = '',
    shelfPrefix = '',
    shelfEnd,
    shelfStart,
    partitionEnd,
    partitionStart
  } = req.body;

  // Find longest possible shelf and partition strings
  const maxShelf = String(shelfEnd || shelfStart || '').trim();
  const maxPartition = String(partitionEnd || partitionStart || '').trim();

  // Calculate worst-case length: PLANT_TYPE_PREFIXSHELF-PARTITION
  let sampleCode = `${plant.trim()}_${locationType.trim()}_${shelfPrefix.trim()}${maxShelf}`;
  if (maxPartition) {
    sampleCode += `-${maxPartition}`;
  }

  if (sampleCode.length > 26) {
    return res.status(400).json({
      error: `Generated barcode code is too long (${sampleCode.length} chars). Maximum limit is 19 characters including underscores.`,
      sample: sampleCode
    });
  }

  next();
}

module.exports = validateLabelForm;