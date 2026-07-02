import { OpenSheetMusicDisplay, Cursor } from 'opensheetmusicdisplay';
console.log("Since cursor isn't created on load, it's created on render (or manual instanciation). OSMD Controller does `this.osmd.render()` in `load`, so cursor will be available in the real browser DOM. Let's design the logic in `buildNoteIdMap` without executing OSMD in node environment.");
