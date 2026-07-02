import { OpenSheetMusicDisplay, Cursor } from 'opensheetmusicdisplay';

import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="osmd-container"></div></body></html>');
(global as any).window = dom.window;
(global as any).document = dom.window.document;
(global as any).HTMLElement = dom.window.HTMLElement;
(global as any).DOMParser = dom.window.DOMParser;
(global as any).XMLSerializer = dom.window.XMLSerializer;
(global as any).Node = dom.window.Node;

const container = document.getElementById('osmd-container') as HTMLDivElement;

const osmd = new OpenSheetMusicDisplay(container, { backend: 'svg', autoResize: false });
const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note><note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note></measure></part></score-partwise>`;

async function run() {
    try {
        await osmd.load(xmlContent);
        console.log(Object.keys(osmd));
        console.log("cursor?", !!osmd.cursor);
    } catch (e) {
        console.error(e);
    }
}
run();
