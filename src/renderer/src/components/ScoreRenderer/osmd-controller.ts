import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';

export class OSMDController {
  private osmd: OpenSheetMusicDisplay;
  private loaded = false;

  constructor(container: HTMLDivElement) {
    this.osmd = new OpenSheetMusicDisplay(container, {
      autoResize: true,
      backend: 'svg',
      drawTitle: true,
    });
  }

  async load(xmlContent: string): Promise<void> {
    this.loaded = false;
    await this.osmd.load(xmlContent);
    this.osmd.render();
    this.loaded = true;
  }

  private noteIdToCursorState = new Map<string, { iteratorIndex: number }>();

  moveCursor(noteId: string): void {
    if (!this.osmd.cursor || !this.loaded) return;

    if (this.osmd.cursor.Hidden) {
      this.osmd.cursor.show();
    }

    const state = this.noteIdToCursorState.get(noteId);

    if (state) {
      // We can reset and step forward iteratorIndex times
      this.osmd.cursor.reset();
      for (let i = 0; i < state.iteratorIndex; i++) {
        if (this.osmd.cursor.iterator.EndReached) break;
        this.osmd.cursor.next();
      }
    } else {
      // Fallback: Just try to jump to measure using parsing
      const match = noteId.match(/-M(\d+)-/);
      if (match) {
        const targetMeasureNumber = parseInt(match[1], 10);
        const targetMeasureIndex = targetMeasureNumber - 1; // OSMD is 0-indexed

        if (this.osmd.cursor.iterator.CurrentMeasureIndex > targetMeasureIndex) {
          this.osmd.cursor.reset();
        }

        while (
          !this.osmd.cursor.iterator.EndReached &&
          this.osmd.cursor.iterator.CurrentMeasureIndex < targetMeasureIndex
        ) {
          this.osmd.cursor.next();
        }
      }
    }

    // To scroll the cursor into view
    try {
      // Use bracket notation without ts-expect-error if it's considered valid by TypeScript
      // or explicitly typed as any by user configuration,
      // but to satisfy "strict: true" and "any 禁止", we will treat this.osmd.cursor as unknown first.
      const cursorObj = this.osmd.cursor as unknown as {
        cursorElement?: { scrollIntoView: (options: object) => void };
      };
      const cursorElement = cursorObj.cursorElement;
      if (cursorElement && typeof cursorElement.scrollIntoView === 'function') {
        cursorElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    } catch (e) {
      console.warn('Could not scroll to cursor element', e);
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
    if (this.loaded) {
      this.osmd.render();
    }
  }

  highlightNote(noteId: string, color: 'correct' | 'incorrect' | 'expected'): void {
    // Dummy implementation
  }

  buildNoteIdMap(): Map<string, { iteratorIndex: number }> {
    this.noteIdToCursorState.clear();
    if (!this.osmd.cursor || !this.loaded) return this.noteIdToCursorState;

    this.osmd.cursor.reset();
    let iteratorIndex = 0;

    // We assume parts are P1, P2, etc. Since we just need to map MusicXML note IDs
    // to cursor iteration indexes, we can track the measure number and note indices.
    // OSMD's cursor traverses timestamps (VoiceEntries). A timestamp might have multiple notes (e.g. chords).
    // We will map based on measure number and VoiceEntry order.
    let currentMeasure = -1;
    let noteIndexInMeasure = 0;

    while (!this.osmd.cursor.iterator.EndReached) {
      const measureIndex = this.osmd.cursor.iterator.CurrentMeasureIndex;
      if (measureIndex !== currentMeasure) {
        currentMeasure = measureIndex;
        noteIndexInMeasure = 0;
      }

      const voiceEntries = this.osmd.cursor.iterator.CurrentVoiceEntries;
      if (voiceEntries) {
        // Find how many notes are at this cursor state to increment noteIndexInMeasure correctly
        // But for mapping, we can simply say that any note in this measure corresponding
        // to this VoiceEntry gets this iteratorIndex.
        // For simplicity, we just map P1-M{measure}-N{noteIndexInMeasure}... up to the count.
        let notesCountAtTimestamp = 0;
        voiceEntries.forEach((ve) => {
          if (ve && ve.Notes) {
            notesCountAtTimestamp += ve.Notes.length;
          }
        });

        const measureNumber = measureIndex + 1;
        // In a realistic app, we'd inspect the actual Pitch or Staff to match `partId`.
        // Here we map sequentially to P1 for UI purposes, as the engine provides noteId.
        // A single timestamp can have multiple notes.
        for (let i = 0; i < notesCountAtTimestamp; i++) {
          const noteId = `P1-M${measureNumber}-N${noteIndexInMeasure + i}`;
          this.noteIdToCursorState.set(noteId, { iteratorIndex });
        }
        noteIndexInMeasure += notesCountAtTimestamp;
      }

      this.osmd.cursor.next();
      iteratorIndex++;
    }

    this.osmd.cursor.reset();
    return this.noteIdToCursorState;
  }
}
