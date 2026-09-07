const { Socket } = require('node:net');

const STATUS4_CODES = {
    '0': { mode: 'offline', ribbonNearEnd: false, bufferNearFull: false, printHalted: false },
    '1': { mode: 'offline', ribbonNearEnd: true,  bufferNearFull: false, printHalted: false },
    '2': { mode: 'offline', ribbonNearEnd: false, bufferNearFull: true,  printHalted: false },
    '3': { mode: 'offline', ribbonNearEnd: true,  bufferNearFull: true,  printHalted: false },
    '4': { mode: 'offline', ribbonNearEnd: false, bufferNearFull: false, printHalted: true },
    'A': { mode: 'waiting', ribbonNearEnd: false, bufferNearFull: false, printHalted: false },
    'B': { mode: 'waiting', ribbonNearEnd: true,  bufferNearFull: false, printHalted: false },
    'C': { mode: 'waiting', ribbonNearEnd: false, bufferNearFull: true,  printHalted: false },
    'D': { mode: 'waiting', ribbonNearEnd: true,  bufferNearFull: true,  printHalted: false },
    'E': { mode: 'waiting', ribbonNearEnd: false, bufferNearFull: false, printHalted: true },
    'G': { mode: 'printing', ribbonNearEnd: false, bufferNearFull: false, printHalted: false },
    'H': { mode: 'printing', ribbonNearEnd: true,  bufferNearFull: false, printHalted: false },
    'I': { mode: 'printing', ribbonNearEnd: false, bufferNearFull: true,  printHalted: false },
    'J': { mode: 'printing', ribbonNearEnd: true,  bufferNearFull: true,  printHalted: false },
    'K': { mode: 'printing', ribbonNearEnd: false, bufferNearFull: false, printHalted: true },
    'M': { mode: 'standby', ribbonNearEnd: false, bufferNearFull: false, printHalted: false },
    'N': { mode: 'standby', ribbonNearEnd: true,  bufferNearFull: false, printHalted: false },
    'O': { mode: 'standby', ribbonNearEnd: false, bufferNearFull: true,  printHalted: false },
    'P': { mode: 'standby', ribbonNearEnd: true,  bufferNearFull: true,  printHalted: false },
    'Q': { mode: 'standby', ribbonNearEnd: false, bufferNearFull: false, printHalted: true },
    'S': { mode: 'analyzing', ribbonNearEnd: false, bufferNearFull: false, printHalted: false },
    'T': { mode: 'analyzing', ribbonNearEnd: true,  bufferNearFull: false, printHalted: false },
    'U': { mode: 'analyzing', ribbonNearEnd: false, bufferNearFull: true,  printHalted: false },
    'V': { mode: 'analyzing', ribbonNearEnd: true,  bufferNearFull: true,  printHalted: false },
    'W': { mode: 'analyzing', ribbonNearEnd: false, bufferNearFull: false, printHalted: true },
    'a': { mode: 'error', errorCode: 'BUFFER_OVER' },
    'b': { mode: 'error', errorCode: 'HEAD_OPEN' },
    'c': { mode: 'error', errorCode: 'PAPER_END' },
    'd': { mode: 'error', errorCode: 'RIBBON_END' },
    'e': { mode: 'error', errorCode: 'MEDIA_ERROR' },
    'f': { mode: 'error', errorCode: 'SENSOR_OR_PAPER_JAM' },
    'g': { mode: 'error', errorCode: 'HEAD_ERROR' },
    'i': { mode: 'error', errorCode: 'CARD_ERROR' },
    'j': { mode: 'error', errorCode: 'CUTTER_ERROR' },
    'k': { mode: 'error', errorCode: 'OTHER_ERROR' },
    'o': { mode: 'error', errorCode: 'RFID_TAG_ERROR' },
    'p': { mode: 'error', errorCode: 'RFID_PROTECT_ERROR' },
};

function parseSatoStatus(buffer) {
    const STX = 0x02, ETX = 0x03;
    const stxIndex = buffer.indexOf(STX);
    const etxIndex = buffer.indexOf(ETX);
    if (stxIndex === -1 || etxIndex === -1 || etxIndex <= stxIndex) {
        return { mode: 'unknown', errorCode: 'MALFORMED_RESPONSE', raw: buffer.toString('hex') };
    }
    const payload = buffer.slice(stxIndex + 1, etxIndex);
    const idNumber = payload.slice(0, 2).toString('ascii').trim() || null;
    const statusChar = payload.slice(2, 3).toString('ascii');
    const remainingRaw = payload.slice(3, 9).toString('ascii');
    const remainingLabels = /^\d+$/.test(remainingRaw) ? parseInt(remainingRaw, 10) : null;
    const jobName = payload.length >= 25
        ? payload.slice(9, 25).toString('ascii').trim() || null
        : undefined;
    const codeInfo = STATUS4_CODES[statusChar] || { mode: 'unknown', errorCode: `UNRECOGNIZED_CODE_${statusChar}` };
    return {
        idNumber, remainingLabels,
        ...(jobName !== undefined ? { jobName } : {}),
        statusChar,
        mode: codeInfo.mode,
        isError: codeInfo.mode === 'error',
        errorCode: codeInfo.errorCode ?? null,
        ribbonNearEnd: codeInfo.ribbonNearEnd ?? false,
        bufferNearFull: codeInfo.bufferNearFull ?? false,
        printHalted: codeInfo.printHalted ?? false,
        raw: buffer.toString('hex')
    };
}

/**
 * Sends SBPL data, then polls status via repeated ENQ until the job
 * finishes (idle + remainingLabels === 0), errors out, or times out.
 *
 * @param {string} sbplData
 * @param {string} ip
 * @param {number} [port=9100]
 * @param {object} [opts]
 * @param {number} [opts.connectTimeoutMs=3000]
 * @param {number} [opts.pollIntervalMs=200]  - gap between ENQ polls
 * @param {number} [opts.overallTimeoutMs=8000] - give up after this long
 */
function sendAndCheckStatus(sbplData, ip, port = 9100, opts = {}) {
    const {
        connectTimeoutMs = 3000,
        pollIntervalMs = 200,
        overallTimeoutMs = 8000
    } = opts;

    return new Promise((resolve, reject) => {
        if (!ip) return reject(new Error('Printer IP address is required.'));

        const client = new Socket();
        let hasSettled = false;
        let pollTimer = null;
        let overallTimer = null;

        const settle = (fn, arg) => {
            if (hasSettled) return;
            hasSettled = true;
            clearTimeout(pollTimer);
            clearTimeout(overallTimer);
            client.destroy();
            fn(arg);
        };

        client.setTimeout(connectTimeoutMs);

        client.connect(port, ip, () => {
            client.write(sbplData, 'utf8', (err) => {
                if (err) return settle(reject, err);
                // First poll after a short beat to let the printer start parsing
                pollTimer = setTimeout(() => client.write(ENQ), pollIntervalMs);
            });
        });

        overallTimer = setTimeout(() => {
            settle(reject, new Error(`Print job did not confirm completion within ${overallTimeoutMs}ms`));
        }, overallTimeoutMs);

        client.on('data', (chunk) => {
            const status = parseSatoStatus(chunk);

            if (status.isError) {
                return settle(resolve, { success: false, status });
            }

            const finished = status.mode === 'waiting' && status.remainingLabels === 0;
            if (finished) {
                return settle(resolve, { success: true, status });
            }

            // Still analyzing/printing/standby — poll again
            pollTimer = setTimeout(() => client.write(ENQ), pollIntervalMs);
        });

        client.on('timeout', () => {
            settle(reject, new Error(`Printer connection timed out (${ip}:${port})`));
        });

        client.on('error', (err) => settle(reject, err));
    });
}

module.exports = {
    sendAndCheckStatus,
};