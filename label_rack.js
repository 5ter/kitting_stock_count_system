import net from 'net';

// Printer Network Settings
const PRINTER_IP = '';
const PRINTER_PORT = 9100;

// SBPL Control Characters
const ESC = '\x1B'

// CONSTANT
const DPI = 305;
const maxH = 1020;
const maxV = 600;
const font = ESC + 'XM';
const fontW = 24;
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
 * @returns {[string,number]} - SBPL string and the final vertical value
 */
function center(elWidth, elHeight, arrow = null, prevV = null){
    const centerH = maxH/2;
    const calcH = Math.round((centerH - elWidth)/2);
    let startV = prevV && !arrow ? prevV : 0;

    if(arrow == 'up') startV = 15;
    else if(arrow == 'down') startV = 420;

    const endV = startV + elHeight;

    const sbplStr = ESC + `H${calcH.toString().padStart(4,'0')}` + ESC + `V${startV.toString().padStart(4,'0')}`;
    // const endStr = ESC + `H${calcH.toString().padStart(4,'0')}` + ESC + `V${endP.toString().padStart(4,'0')}`;
    return [sbplStr,endV];
}
/**
 * Draw arrow based on the user input (up/down) in the center 
 * Total Dimension: arrowhead + stem = ~180 dots
 * 
 * @param {'up' | 'down'} [arrow='up'] - the direction of arrow
 * @returns {[string | number]}
 */
function drawArrow(arrow = 'up'){
        const arrowhead = center(72,144,arrow)[0] + ESC + 'L0303' + ESC + font + '^';
        const stem = center(60,180,arrow);
        const stemStr = center(60,180,arrow)[0] + ESC + 'FW10V00180';
        const stemEnd = stem[1];

    return [arrowhead + stemStr, stemEnd];
}

/**
 * Create a set of barcode and readable text underneath based on the vertical value
 * which determine the block position where v is determine by the arrow direction
 * @param {string} text - readable text
 * @param {number} V - the vertical starting position   
 * @returns {[string,string]}
 */
function createBarcodeText(text, V = null){
    // add the centered barcode
    const barcode = center(calcBarcLength(text,barcodeW, '128'),barcodeH,null,V)[0] +
            barcodeF + text;
    const textw = fontW * text.length;
    const readableText = center(textw, fontW + 10, null, barcode[1]);
    
    return [
        barcode,
        readableText
    ]
}


function generateLabel
(
    location,
    arrow
){
    const sbplString = [
        ESC + 'A',
        

    ]
}




