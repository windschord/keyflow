import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';

export class OSMDController {
  private osmd: OpenSheetMusicDisplay;

  constructor(container: HTMLDivElement) {
    this.osmd = new OpenSheetMusicDisplay(container, {
      autoResize: true,
      backend: 'svg',
      drawTitle: true,
    });
  }

  async load(xmlContent: string): Promise<void> {
    await this.osmd.load(xmlContent);
    this.osmd.render();
  }

  moveCursor(noteId: string): void {
    // Basic implementation for cursor
    // The cursor needs to be enabled to be moved
    if (this.osmd.cursor) {
        if (this.osmd.cursor.Hidden) {
            this.osmd.cursor.show();
        }
        // Actually mapping noteId to OSMD Note requires osmd internal mapping.
        // For UI mock purposes, we will just move to next for now if not hidden.
        // This will be expanded later.
    }
  }

  setPartOpacity(partId: string, opacity: number): void {
    // Dummy implementation for practice mode hand separation
  }

  drawLoopBracket(startMeasure: number, endMeasure: number): void {
    // Dummy implementation
  }

  setZoom(factor: number): void {
    this.osmd.zoom = factor;
    this.osmd.render();
  }

  highlightNote(noteId: string, color: 'correct' | 'incorrect' | 'expected'): void {
    // Dummy implementation
  }

  buildNoteIdMap(): Map<string, object> {
    return new Map();
  }
}
