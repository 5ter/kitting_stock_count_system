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
const font = 'XM';
const fontW = 24;
const barcodeF = ESC + 'BG05180';


// determine the center point of the label
function center(elW, elH, arrow = null, prevV = null){
    const centerH = maxH/2;
    const calcH = Math.round((centerH - elW)/2);
    let startV = prevV ? prevV : 0;

    if(arrow == 'up') startV = 15;
    else if(arrow == 'down') startV = 420;

    const endV = startV + elH;

    const startStr = ESC + `H${calcH.toString().padStart(4,'0')}` + ESC + `V${startV.toString().padStart(4,'0')}`;
    // const endStr = ESC + `H${calcH.toString().padStart(4,'0')}` + ESC + `V${endP.toString().padStart(4,'0')}`;
    return [startStr,endV];
}
/**
 * Draw arrow based on the user input (up/down) in the center 
 * Total Dimension: arrowhead + stem = ~180 dots
 * Arrowhead: 1:3 ratio (the height of the arrowhead is 3X its width)
 * if the width is 255
 * Stem: 
 */
function drawArrow(arrow = 'up'){
        const arrowhead = center(72,144,arrow)[0] + ESC + 'L0303' + ESC + font + '^';
        const stem = center(60,180,arrow);
        const stemStr = center(60,180,arrow)[0] + ESC + 'FW10V00180';
        const stemEnd = stem[1];

    return [arrowhead + stemStr, stemEnd];
}

function createBarcodeText(){
    
}


function generateLabel
(
    location,
    arrow
){
    const sbplString = [
        ESC + 'A',
        drawArrow(arrow)[0],
        

    ]
}




