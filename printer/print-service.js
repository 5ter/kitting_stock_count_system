import net from 'net';

const ENQ = '\x05';

/**
 * Parses SATO Status response into a structured object
 * 
 * @param {string} statusStr 
 * @returns {object}
 */
function parseSatoStatus(statusStr) {
    return {
        isReady: statusStr.includes('A'),
        isOffline: statusStr.includes('B'),
        paperOrRibbonError: statusStr.includes('G'),
        headOpen: statusStr.includes('H'),
        isPrinting: statusStr.includes('b'),
        raw: statusStr
    };
}

/**
 * Transmits SBPL data to printer, queries status via ENQ, and returns the result.
 * 
 * @param {string} sbplData - Raw SBPL command string
 * @param {string} ip - Printer IP address
 * @param {number} [port=9100] - Printer TCP port
 * @param {number} [timeoutMs=3000] - Socket connection timeout in milliseconds
 * @returns {Promise<{ status: object, rawResponse: string }>}
 */
export function sendAndCheckStatus(sbplData, ip, port = 9100, timeoutMs = 3000) {
    return new Promise((resolve, reject) => {
        if (!ip) {
            return reject(new Error('Printer IP address is required.'));
        }

        const client = new net.Socket();
        let responseData = Buffer.alloc(0);
        let hasSettled = false;

        // Prevent process hanging on unreachable IP
        client.setTimeout(timeoutMs);

        client.connect(port, ip, () => {
            client.write(sbplData, 'utf8', (err) => {
                if (err && !hasSettled) {
                    hasSettled = true;
                    client.destroy();
                    return reject(err);
                }
                client.write(ENQ);
            });
        });

        client.on('data', (chunk) => {
            responseData = Buffer.concat([responseData, chunk]);
            client.end(); // Gracefully close connection after data arrives
        });

        client.on('timeout', () => {
            if (!hasSettled) {
                hasSettled = true;
                client.destroy();
                reject(new Error(`Printer connection timed out after ${timeoutMs}ms (${ip}:${port})`));
            }
        });

        client.on('error', (err) => {
            if (!hasSettled) {
                hasSettled = true;
                client.destroy();
                reject(err);
            }
        });

        client.on('close', () => {
            if (hasSettled) return;
            hasSettled = true;

            if (responseData.length === 0) {
                return reject(new Error('Printer closed connection without returning status response.'));
            }

            const rawResponse = responseData.toString('ascii');
            const parsedStatus = parseSatoStatus(rawResponse);

            resolve({
                status: parsedStatus,
                rawResponse
            });
        });
    });
}