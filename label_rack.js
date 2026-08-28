
import net from 'net';


// Printer Network Settings
const PRINTER_IP = '10.36.61.78';
const PRINTER_PORT = 9100;

// SBPL Control Characters
const ESC = '\x1B'

// CONSTANT
const DPI = 305;
const maxH = 1020;
const maxV = 600;
const TOP_MARGIN = 20;
const GAP = 40;
const font = ESC + 'XM';
const fontScale = 2
const fontSize = 24 * fontScale;
const barcodeH = 270 // Height = 180 dots
const barcodeW = 5 // dots
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
    return ESC + `H${H.toString().padStart(4,'0')}` + ESC + `V${V.toString().padStart(4,'0')}`;
}

/**
 * Horizontal start pos (dots) to center an element of elWidth on the label
 * @param {number} elWidth - the width of the element (dots)
 * @returns {number} 
 */
function centerH(elWidth){
    return Math.round((maxH - elWidth)/2);
}

/**
 * Draw the arrow (stem + head), stacked from startV downward.
 * 'up'   -> arrowhead first, stem below it (point faces up)
 * 'down' -> stem first, arrowhead below it (point faces down)
 * 
 * @param {'up' | 'down'} direction - the direction of arrow
 * @param {number} startV
 * @returns {[string | number]}
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
        } else {
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

    const barcodeWidth = calcBarcLength(text, barcodeW, '128');
    const barcode = posCmd(centerH(barcodeWidth), v) + barcodeF + text;
    v += barcodeH;

    v += 10; // gap

    const textW = fontSize * text.length;
    const readableText = posCmd(centerH(textW), v) + ESC + `L${fontScale.toString().padStart(2,'0').repeat(2)}` + ESC + 'P00' + font + text;
    v += fontSize + 10;
    return [barcode, readableText, v];
}

/**
 * Generates complete SBPL command payload for printing
 * 'up'   -> arrow on top, barcode + text below it
 * 'down' -> barcode + text on top, arrow below it
 * 
 * @param {string} location - Location identifier / barcode value
 * @param {'up' | 'down'} arrow - Arrow direction
 * @returns {string} Complete SBPL job payload
 */
function generateLabel(location, arrow = 'up') {
    let v = TOP_MARGIN;
    let arrowStr, barcodeStr, readableTextStr, orderedElements;

    if(arrow === 'down'){
        [barcodeStr,readableTextStr, v] = createBarcodeText(location, v);
        v += GAP;
        [arrowStr,v] = drawArrow(arrow, v);
    } else {
        [arrowStr, v] = drawArrow('up', v);
        v += GAP;
        [barcodeStr, readableTextStr, v] = createBarcodeText(location, v)
    }
    
    orderedElements = [barcodeStr, readableTextStr, arrowStr];

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
            client.end();
        });
    });

    client.on('error', (err) => {
        console.error('Socket Connection Error:', err.message);
    });

    client.on('close', () => {
        console.log('Connection closed.');
    });
}

// Example Usage:
const labelData = generateLabel('LOC-A-1029', 'up');
const labelData2 = generateLabel('LOC-A-1029', 'down');
console.log(labelData.replace(/\x1B/g, '<ESC>'));
sendToPrinter(labelData + labelData2);
