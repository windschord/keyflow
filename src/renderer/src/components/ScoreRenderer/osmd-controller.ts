import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';

export class OSMDController {
  private osmd: OpenSheetMusicDisplay;
  private container: HTMLDivElement;
  private loaded = false;
  private currentIteratorIndex = 0;
  private noteIdToSvgCoord = new Map<string, { x: number; y: number }>();
  private lastFingeringAssignments: Array<{ noteId: string; finger: number; isApproved: boolean }> =
    [];

  constructor(container: HTMLDivElement) {
    this.container = container;
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
      // Move incrementally from current position to target to avoid O(n²)
      const targetIndex = state.iteratorIndex;

      if (targetIndex < this.currentIteratorIndex) {
        // Target is before current position, reset to start
        this.osmd.cursor.reset();
        this.currentIteratorIndex = 0;
      }

      // Move forward incrementally from currentIteratorIndex to targetIndex
      while (this.currentIteratorIndex < targetIndex) {
        if (this.osmd.cursor.Iterator.EndReached) break;
        this.osmd.cursor.next();
        this.currentIteratorIndex++;
      }
    } else {
      // Fallback: Just try to jump to measure using parsing
      const match = noteId.match(/-M(\d+)-/);
      if (match) {
        const targetMeasureNumber = parseInt(match[1], 10);
        const targetMeasureIndex = targetMeasureNumber - 1; // OSMD is 0-indexed

        if (this.osmd.cursor.Iterator.CurrentMeasureIndex > targetMeasureIndex) {
          this.osmd.cursor.reset();
          this.currentIteratorIndex = 0;
        }

        while (
          !this.osmd.cursor.Iterator.EndReached &&
          this.osmd.cursor.Iterator.CurrentMeasureIndex < targetMeasureIndex
        ) {
          this.osmd.cursor.next();
          this.currentIteratorIndex++;
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
      // Re-render fingering layer after OSMD redraws (render() removes the SVG child nodes)
      this.renderFingeringLayer();
    }
  }

  highlightNote(noteId: string, color: 'correct' | 'incorrect' | 'expected'): void {
    // Dummy implementation
  }

  private getCursorSvgCoord(): { x: number; y: number } | null {
    const svg = this.container.querySelector('svg') as SVGSVGElement | null;
    // cursorElement is an internal OSMD property not exposed in the public type definitions
    const cursorEl = (this.osmd.cursor as unknown as { cursorElement?: HTMLElement })
      ?.cursorElement;
    if (!svg || !cursorEl) return null;
    try {
      const svgRect = svg.getBoundingClientRect();
      const cursorRect = cursorEl.getBoundingClientRect();
      if (svgRect.width === 0) return null;

      // Convert screen coords to SVG internal coords via viewBox ratio
      const vb = svg.viewBox.baseVal;
      if (vb && vb.width > 0) {
        const scaleX = vb.width / svgRect.width;
        const scaleY = vb.height / svgRect.height;
        return {
          x: (cursorRect.left - svgRect.left + cursorRect.width / 2) * scaleX + vb.x,
          y: (cursorRect.top - svgRect.top) * scaleY + vb.y,
        };
      }
      // Fallback when no viewBox
      return {
        x: cursorRect.left - svgRect.left + cursorRect.width / 2,
        y: cursorRect.top - svgRect.top,
      };
    } catch {
      return null;
    }
  }

  showFingerings(
    assignments: Array<{ noteId: string; finger: number; isApproved: boolean }>
  ): void {
    this.lastFingeringAssignments = assignments;
    this.renderFingeringLayer();
  }

  private renderFingeringLayer(): void {
    this.container.querySelector('#fingering-layer')?.remove();
    const svg = this.container.querySelector('svg');
    if (!svg || this.lastFingeringAssignments.length === 0) return;

    const layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    layer.setAttribute('id', 'fingering-layer');

    for (const { noteId, finger, isApproved } of this.lastFingeringAssignments) {
      const coord = this.noteIdToSvgCoord.get(noteId);
      if (!coord) continue;
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(coord.x));
      text.setAttribute('y', String(coord.y - 4));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '8');
      // Approved: solid blue; suggested: light blue
      text.setAttribute('fill', isApproved ? '#2563eb' : '#93c5fd');
      text.setAttribute('pointer-events', 'none');
      text.textContent = String(finger);
      layer.appendChild(text);
    }

    svg.appendChild(layer);
  }

  clearFingerings(): void {
    this.lastFingeringAssignments = [];
    this.container.querySelector('#fingering-layer')?.remove();
  }

  buildNoteIdMap(): Map<string, { iteratorIndex: number }> {
    this.noteIdToCursorState.clear();
    this.noteIdToSvgCoord.clear();
    if (!this.osmd.cursor || !this.loaded) return this.noteIdToCursorState;

    // Show cursor temporarily so CursorElement is in the DOM for coordinate sampling
    const wasHidden = this.osmd.cursor.Hidden;
    if (wasHidden) this.osmd.cursor.show();

    this.osmd.cursor.reset();
    this.currentIteratorIndex = 0;
    let iteratorIndex = 0;

    // OSMD's cursor traverses timestamps (VoiceEntries). A timestamp might have multiple notes (e.g. chords).
    // We will map based on measure number, part ID from VoiceEntry.ParentVoice.Parent.IdString, and VoiceEntry order.
    let currentMeasure = -1;
    // Track note index per part (not globally) to match musicxml-parser behavior
    const noteIndexInMeasurePerPart = new Map<string, number>();

    while (!this.osmd.cursor.Iterator.EndReached) {
      const coord = this.getCursorSvgCoord();
      const measureIndex = this.osmd.cursor.Iterator.CurrentMeasureIndex;
      if (measureIndex !== currentMeasure) {
        currentMeasure = measureIndex;
        noteIndexInMeasurePerPart.clear();
      }

      const voiceEntries = this.osmd.cursor.Iterator.CurrentVoiceEntries;
      if (voiceEntries) {
        const measureNumber = measureIndex + 1;

        voiceEntries.forEach((ve) => {
          if (ve && ve.Notes) {
            // Derive partId from VoiceEntry.ParentVoice.Parent.IdString
            // Use type-safe access with fallback to 'P1'
            let partId = 'P1'; // default fallback
            try {
              const parentVoice = ve.ParentVoice;
              if (parentVoice) {
                const parent = parentVoice.Parent;
                if (parent && parent.IdString) {
                  partId = parent.IdString;
                }
              }
            } catch (e) {
              // Fallback to 'P1' if chain is unavailable
            }

            // Get or initialize note index for this part
            const currentNoteIndex = noteIndexInMeasurePerPart.get(partId) ?? 0;

            // Map each note in this VoiceEntry
            for (let i = 0; i < ve.Notes.length; i++) {
              const noteId = `${partId}-M${measureNumber}-N${currentNoteIndex + i}`;
              this.noteIdToCursorState.set(noteId, { iteratorIndex });
              if (coord) this.noteIdToSvgCoord.set(noteId, coord);
            }

            // Update note index for this part
            noteIndexInMeasurePerPart.set(partId, currentNoteIndex + ve.Notes.length);
          }
        });
      }

      this.osmd.cursor.next();
      iteratorIndex++;
    }

    this.osmd.cursor.reset();
    this.currentIteratorIndex = 0;

    // Restore cursor visibility
    if (wasHidden) this.osmd.cursor.hide();

    return this.noteIdToCursorState;
  }
}
