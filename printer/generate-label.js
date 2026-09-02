'use strict'
const net = require('net');


// Printer Network Settings
// const PRINTER_IP = process.env.PRINTER_IP;
// const PRINTER_PORT = process.env.PRINTER_PORT;
const PRINTER_IP = '10.199.120.78';
const PRINTER_PORT = 9100;

// SBPL Control Characters
const ESC = '\x1B'
const ENQ = '\x05'; // ASCII ENQ (Status Request)

// CONSTANT
// const DPI = 305;
const maxV = 600;
const maxH = 1020;
const TOP_MARGIN = 20;
const margin = 20;
const GAP = 40;
const font = ESC + 'XS';
const fontScale = 4;
const fontSize = 17 * fontScale;
const barcodeH = 270 // Height = 180 dots
const barcodeW = 3 // dots
const barcodeF = ESC + `BG${barcodeW.toString().padStart(2,'0')}${barcodeH}`;

/**
 * Calc the barcode width in dots
 * 
 * @param {string} text - barcode data
 * @param {number} narroWidth - width of narrow bar (dots)
 * @param {'128' | '39'} type - the type of barcode used
 * @returns {number} - the barcode width (dots)
*/
const calcBarcLength = (text, narroWidth, type = '128') => {
    const charCount = text.length;
    if(type == '128') return (11 * charCount + 35) * narroWidth;
    else if(type == '39') return (charCount + 2) * 16 * narroWidth - narroWidth;
    
}

/**
 * Build SBPL position command given H and V values
 * @param {number} H - horizontal value (centered) 
 * @param {number} V - vertical value (20 - 600)
*/
function posCmd(H,V){
    if(H < 0 || V < 0) {
        throw new Error("H or V has negative value");
    }
    return ESC + `H${H.toString().padStart(4,'0')}` + ESC + `V${V.toString().padStart(4,'0')}`;
}

/**
 * Horizontal start pos (dots) to center an element of elWidth on the label
 * @param {number} elWidth - the width of the element (dots)
 * @returns {number} 
*/
function centerH(elWidth){
    if(elWidth > maxH) {
        console.error(`Element width (${elWidth})`);
    }
    return Math.round((maxH - elWidth)/2) + margin;
}

// find the vertical center
function centerV(elHeight){
    return Math.round((maxV - elHeight)/2)
}

/**
 * Draw the arrow (stem + head), stacked from startV downward.
 * 'up'   -> arrowhead first, stem below it (point faces up)
 * 'down' -> stem first, arrowhead below it (point faces down)
 * 
 * @param {'up' | 'down'} direction - the direction of arrow
 * @param {number} startV
 * @returns {[string, number]}
*/
function drawArrow(direction, startV){
    const stemHeight = 140;
    const stemW = 10;
    let v = startV;
    let sbpl = '';
    if (direction === 'down') {
        // Down Arrow: Stem first (top), then arrowhead 'v' at the bottom
        sbpl += posCmd(centerH(stemW),v) + ESC + 
        `FW${stemW.toString().padStart(2,'0')}V${stemHeight.toString().padStart(5,'0')}`;
        v += stemHeight - fontSize;
            sbpl += posCmd(centerH(fontSize), v) + ESC + `L${fontScale.toString().padStart(2,'0').repeat(2)}` +
            font + 'V';
            // v += fontSize;
        } else if(direction === 'up') {
            // Up Arrow: Arrowhead '^' first (top), then stem below it
            sbpl += posCmd(centerH(fontSize), v) + ESC + `L${fontScale.toString().padStart(2,'0')}07` +
            font + '^';
            // v += fontSize;
            sbpl += posCmd(centerH(stemW),v) + ESC + 
            `FW${stemW.toString().padStart(2,'0')}V${stemHeight.toString().padStart(5,'0')}`;
            v += stemHeight;
        }
        return [sbpl,v];
}

/**
 * Create a set of barcode and readable text underneath based on the vertical value
 * which determine the block position where v is determine by the arrow direction
 * @param {string} text - readable text
 * @param {number} V - the vertical starting position   
 * @returns {[string,string]}
*/
function createBarcodeText(text, startV){
    let v = startV;
    const textW = 34 * text.length; // only 2x horizontal scale
    const barcodeWidth = calcBarcLength(text, barcodeW, '128');
    
    if(barcodeWidth > maxH) {
        console.error(`Barcode width (${barcodeWidth}),
             Total text width (${textW}), text length (${text.length})`);
        throw new Error("Barcode width is larger than maxH");
    }
    const barcode = posCmd(centerH(barcodeWidth), v) + barcodeF + text;
    v += barcodeH;
    
    v += 10; // gap
    
    if(textW > maxH) {
        console.error(`Readable text width (${textW}), text length (${text.length})`);
        throw new Error("Readable text width is larger than maxH");
    }
    const readableText = posCmd(centerH(textW), v) + ESC + `L02${fontScale.toString().padStart(2,'0')}` + ESC + 'P00' + font + text;
    // const readableText = ESC + `PZ${100},${200},1,1` + ESC + 'H0100' + ESC + `V${100}` + ESC + `L02${fontScale.toString().padStart(2,'0')}` + ESC + 'P00' + font + text;
    v += fontSize + 10;

    return [barcode, readableText, v];
}

/**
 * Generates complete SBPL command payload for printing
 * 19 characters max
 * 'up'   -> arrow on top, barcode + text below it
 * 'down' -> barcode + text on top, arrow below it
 * 
 * @param {string} location - Location identifier / barcode value
 * @param {'up' | 'down' | ''} arrow - Arrow direction
 * @returns {string} Complete SBPL job payload
*/
function generateLabel(location, arrow = '') {
    let v = arrow ? TOP_MARGIN : centerV(barcodeH);
    let arrowStr, barcodeStr, readableTextStr, orderedElements;

    if(arrow === 'down'){
        [barcodeStr,readableTextStr, v] = createBarcodeText(location, v);
        v += GAP;
        [arrowStr,v] = drawArrow(arrow, v);
    } else if(arrow === 'up') {
        [arrowStr, v] = drawArrow('up', v);
        v += GAP;
        [barcodeStr, readableTextStr, v] = createBarcodeText(location, v)
    } else {
        [barcodeStr,readableTextStr, v] = createBarcodeText(location, v);
    }
    
    orderedElements = arrowStr ? [barcodeStr, readableTextStr, arrowStr] : [barcodeStr, readableTextStr];

    const sbplString = [
        ESC + 'A',
        ESC + 'PR',
        ...orderedElements,
        ESC + 'Q1',
        ESC + 'Z'
    ].join('');

    return sbplString;
}

/**
 * Sends SBPL payload directly to network printer over TCP port 9100
 * 
 * @param {string} sbplData 
 * @param {string} ip 
 * @param {number} port 
 */
function sendToPrinter(sbplData, ip = PRINTER_IP, port = PRINTER_PORT) {
    if (!ip) {
        console.error('Error: PRINTER_IP target is missing.');
        return;
    }

    const client = new net.Socket();

    client.connect(port, ip, () => {
        console.log(`Connected to printer at ${ip}:${port}`);
        client.write(sbplData, 'utf8', () => {
            console.log('Label payload transmitted successfully.');
        });
        client.write(ENQ);
    });

    // 3. Listen for printer response
    client.on('data', (data) => {
        const responseHex = data.toString('hex');
        const responseAscii = data.toString('ascii');
        
        console.log('Printer Response (ASCII):', responseAscii);
        console.log('Printer Response (HEX):', responseHex);
        parseSatoStatus(responseAscii);
        
        client.end(); // Close connection after receiving status
    });
    
    client.on('error', (err) => {
        console.error('Socket Connection Error:', err.message);
    });
    
    // client.on('close', () => {
    //     console.log('Connection closed.');
    // });
    // client.end();
}

/**
 * Parses SATO Status 4 Packet
 */
function parseSatoStatus(statusStr) {
    // Typical Status 4 Response format: <STX>[Status1][Status2][RemainingLabels]<ETX>
    // Common Status 1 characters:
    if (statusStr.includes('A')) console.log('Status: Online / Ready');
    else if (statusStr.includes('B')) console.log('Status: Offline / Paused');
    else if (statusStr.includes('G')) console.log('Error: Paper / Ribbon End');
    else if (statusStr.includes('H')) console.log('Error: Print Head Open');
    else if (statusStr.includes('b')) console.log('Status: Printing in progress...');
}


// Example Usage:
// const labelData = generateLabel('A1_WAREHOUSE_C99-A1', 'down');
const labelData = generateLabel('A1FWAREHOUSEDC99GA3TQWETYY', '');
console.log(labelData.replace(/\x1B/g, '<ESC>'));
sendToPrinter(labelData);
// sendToPrinter(labelData2);

module.exports = {
    generateLabel,
    sendToPrinter
}