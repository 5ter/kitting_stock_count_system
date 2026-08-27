
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
const font = ESC + 'XM';
const fontW = 24 * 3;
const barcodeH = 180 // Height = 180 dots
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
 * Calculate the element position so that it centered in the label
 * 
 * @param {number} elWidth - element width (dots)
 * @param {number} elHeight - element height (dots)
 * @param {null | 'up' | 'down'} [arrow=null] arrow - up or down arrow
 * @param {null | number} [prevV=null] prevV - the previous element Vertical value
 * @param {null | number} [prevH=null] prevH - the previous element horizontal value
 * @returns {[string, number, number]} - SBPL string, final vertical value and final hz value
 */
function center(elWidth, elHeight, arrow = null, prevV = null, prevH = null){
    // const centerH = maxH/2;
    const calcH = Math.round((maxH - elWidth)/2);
    let startV = prevV && !arrow ? prevV : 0;
    const startH = prevH ? prevH + 15: calcH;

    if(arrow == 'up') startV = 20;
    else if(arrow == 'down') startV = 420;
    
    const endV = startV + elHeight;
    const sbplStr = ESC + `H${startH.toString().padStart(4,'0')}` + ESC + `V${startV.toString().padStart(4,'0')}`;
    // const endStr = ESC + `H${calcH.toString().padStart(4,'0')}` + ESC + `V${endP.toString().padStart(4,'0')}`;
    return [sbplStr, endV, startH];
}
/**
 * Draw arrow based on the user input (up/down) in the center 
 * Total Dimension: arrowhead + stem = ~180 dots
 * 
 * @param {'up' | 'down'} [arrow='up'] - the direction of arrow
 * @returns {[string | number]}
 */
function drawArrow(arrow = 'up'){
    const stemHeight = 140;
    if (arrow === 'down') {
            // Down Arrow: Stem first (top), then arrowhead 'v' at the bottom
            const [stemPos, stemEndV, stemEndH] = center(10, stemHeight, arrow);
            const stemStr = stemPos + ESC + `FW10V${stemHeight.toString().padStart(5, '0')}`;
            
            // Arrowhead placed immediately below the stem
            const [headPos] = center(fontW, fontW, null, stemEndV, stemEndH);
            const arrowhead = headPos + ESC + 'L0303' + font + 'v';
            
            return [stemStr + arrowhead, stemEndV + fontW];
        } else {
            // Up Arrow: Arrowhead '^' first (top), then stem below it
            const [headPos, headEndV, headEndH] = center(fontW, fontW, arrow);
            const arrowhead = headPos + ESC + 'L0303' + font + '^';
            
            const [stemPos, stemEndV] = center(10, stemHeight, arrow, headEndV, headEndH);
            const stemStr = stemPos + ESC + `FW10V${stemHeight.toString().padStart(5, '0')}`;
           
            return [arrowhead + stemStr, stemEndV];
        }
}

/**
 * Create a set of barcode and readable text underneath based on the vertical value
 * which determine the block position where v is determine by the arrow direction
 * @param {string} text - readable text
 * @param {number} V - the vertical starting position   
 * @returns {[string,string]}
 */
function createBarcodeText(text, V = null){
    const [bcPos, bcEndV] = center(calcBarcLength(text, barcodeW, '128'), barcodeH, null, V);
    const barcode = bcPos + barcodeF + text;

    const textw = fontW * text.length;
    const readableText = center(textw, fontW + 10, null, bcEndV + 10);
    const readableTextStr = readableText[0] + ESC + 'L0303' + ESC + 'P00' + font + text;
    
    return [barcode, readableTextStr];
}


/**
 * Generates complete SBPL command payload for printing
 * 
 * @param {string} location - Location identifier / barcode value
 * @param {'up' | 'down'} arrow - Arrow direction
 * @returns {string} Complete SBPL job payload
 */
function generateLabel(location, arrow = 'up') {
    const [arrowStr, arrowEndV] = drawArrow(arrow);
    const [barcodeStr, readableTextStr] = createBarcodeText(location, arrowEndV + 20);

    const sbplString = [
        ESC + 'A',            // Start SBPL Job Sequence
        arrowStr,             // Render Arrow Graphic
        barcodeStr,           // Render Code128 Barcode
        readableTextStr,  // Render Human-Readable Text below Barcode
        ESC + 'Q1',           // Set Print Quantity to 1
        ESC + 'Z'             // End SBPL Job Sequence
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
const labelData = generateLabel('LOC-A-1029', 'down');
console.log(labelData.replace(/\x1B/g, '<ESC>'));

sendToPrinter(labelData);


7