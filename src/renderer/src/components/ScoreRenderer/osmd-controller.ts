import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class OSMDController {
  private osmd: OpenSheetMusicDisplay;
  private container: HTMLDivElement;
  private loaded = false;
  private currentIteratorIndex = 0;
  private noteIdToSvgCoord = new Map<string, { x: number; y: number }>();
  private lastFingeringAssignments: Array<{ noteId: string; finger: number; isApproved: boolean }> =
    [];
  /** ループ範囲の最後に指定された値。setZoom等の再描画後にオーバーレイを再適用するために保持する。 */
  private lastLoopRange: { start: number; end: number } | null = null;
  /**
   * グレーアウト対象のnoteId集合（REQ-002-007: 非練習側のnote単位グレーアウト、TASK-048）。
   * 従来はパート単位（partId→Y座標クラスタ矩形）で管理していたが、1パート2段譜では
   * 手（段）とパートが一致しないため、note単位で管理する。
   */
  private grayedOutNoteIds = new Set<string>();
  /** setGrayedOutNotesで最後に指定された不透明度（0〜1、既定0.5）。 */
  private grayoutOpacity = 0.5;
  /** noteIdごとの正誤ハイライト状態（'expected'は「ハイライトなし」を意味するため保持しない）。 */
  private noteHighlights = new Map<string, 'correct' | 'incorrect'>();
  /** 小節クリック時に呼び出されるコールバック（App.tsx側でpracticeEngine.resetToMeasureに結線する）。 */
  private onMeasureClickCallback: ((measureNumber: number) => void) | null = null;
  /**
   * 音符の右クリック（contextmenu）時に呼び出されるコールバック（REQ-008-001/003/006、
   * REQ-009-005）。App.tsx側で運指メモのコンテキストメニュー表示に結線する。
   */
  private onNoteContextMenuCallback:
    | ((noteId: string, screenX: number, screenY: number) => void)
    | null = null;

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.osmd = new OpenSheetMusicDisplay(container, {
      autoResize: true,
      backend: 'svg',
      drawTitle: true,
    });
    this.container.addEventListener('click', this.handleContainerClick);
    this.container.addEventListener('contextmenu', this.handleContainerContextMenu);
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

  /**
   * グレーアウト対象のnoteId集合を設定する（REQ-002-007: 非練習側のグレーアウト表示）。
   *
   * TASK-048: 従来はパート単位（partId→Y座標クラスタ矩形）でグレーアウトしていたが、
   * 1パート2段譜ではパートと手（段）が一致しないため、noteId集合を直接受け取り、
   * `noteIdToSvgCoord` の該当座標にのみ小さな半透明ベールを掛けるnote単位の実装に変更した。
   * 呼び出しごとに状態を完全に置き換える（差分適用ではない）。空集合を渡すと
   * グレーアウトを全解除する。
   */
  setGrayedOutNotes(noteIds: ReadonlySet<string> | readonly string[], opacity = 0.5): void {
    this.grayedOutNoteIds = new Set(noteIds);
    this.grayoutOpacity = opacity;
    this.renderGrayoutLayer();
  }

  private renderGrayoutLayer(): void {
    const layerId = 'note-grayout-layer';
    this.container.querySelector(`#${layerId}`)?.remove();

    const svg = this.container.querySelector('svg');
    if (!svg || this.grayedOutNoteIds.size === 0) return;

    const layer = document.createElementNS(SVG_NS, 'g');
    layer.setAttribute('id', layerId);

    // 音符1つ分を覆う程度の小さな矩形（段全体ではなく該当ノートのみを覆う）。
    const margin = { x: 8, yTop: 20, yBottom: 20 };
    let hasRect = false;
    for (const noteId of this.grayedOutNoteIds) {
      const coord = this.noteIdToSvgCoord.get(noteId);
      if (!coord) continue; // 座標未確定（buildNoteIdMap未完了等）のノートは無視する

      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', String(coord.x - margin.x));
      rect.setAttribute('y', String(coord.y - margin.yTop));
      rect.setAttribute('width', String(margin.x * 2));
      rect.setAttribute('height', String(margin.yTop + margin.yBottom));
      // 不透明度が低いほど白いベールを濃くし、下の音符をグレーアウトして見せる。
      rect.setAttribute('fill', `rgba(255, 255, 255, ${(1 - this.grayoutOpacity).toFixed(2)})`);
      rect.setAttribute('data-note-id', noteId);
      rect.setAttribute('pointer-events', 'none');
      layer.appendChild(rect);
      hasRect = true;
    }

    if (!hasRect) return;

    // グレーアウトは音符の描画より手前（上）に重ねることで視覚的な減光を表現する。
    svg.appendChild(layer);
  }

  /**
   * ループ範囲（開始小節〜終了小節）を楽譜上に矩形（ブラケット）で可視化する最小実装。
   *
   * noteIdToSvgCoord に蓄積された音符座標のうち、指定範囲内の小節に属するものの
   * バウンディングボックスを求め、破線の矩形として描画する。詳細なビジュアル
   * デザイン（小節線に沿った正確な範囲表示等）は本実装のスコープ外とする。
   */
  drawLoopBracket(startMeasure: number, endMeasure: number): void {
    this.lastLoopRange = { start: startMeasure, end: endMeasure };
    this.renderLoopBracketLayer();
  }

  clearLoopBracket(): void {
    this.lastLoopRange = null;
    this.container.querySelector('#loop-bracket-layer')?.remove();
  }

  private renderLoopBracketLayer(): void {
    this.container.querySelector('#loop-bracket-layer')?.remove();
    if (!this.lastLoopRange) return;

    const { start: startMeasure, end: endMeasure } = this.lastLoopRange;
    const svg = this.container.querySelector('svg');
    if (!svg) return;
    if (!Number.isFinite(startMeasure) || !Number.isFinite(endMeasure)) return;
    if (startMeasure > endMeasure) return;

    const coords: Array<{ x: number; y: number }> = [];
    for (const [noteId, coord] of this.noteIdToSvgCoord.entries()) {
      const match = noteId.match(/-M(\d+)-/);
      if (!match) continue;
      const measureNumber = parseInt(match[1], 10);
      if (measureNumber >= startMeasure && measureNumber <= endMeasure) {
        coords.push(coord);
      }
    }

    if (coords.length === 0) return;

    const margin = { x: 12, yTop: 24, yBottom: 12 };
    const minX = Math.min(...coords.map((c) => c.x)) - margin.x;
    const maxX = Math.max(...coords.map((c) => c.x)) + margin.x;
    const minY = Math.min(...coords.map((c) => c.y)) - margin.yTop;
    const maxY = Math.max(...coords.map((c) => c.y)) + margin.yBottom;

    const layer = document.createElementNS(SVG_NS, 'g');
    layer.setAttribute('id', 'loop-bracket-layer');

    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', String(minX));
    rect.setAttribute('y', String(minY));
    rect.setAttribute('width', String(Math.max(0, maxX - minX)));
    rect.setAttribute('height', String(Math.max(0, maxY - minY)));
    rect.setAttribute('fill', 'rgba(59, 130, 246, 0.12)');
    rect.setAttribute('stroke', '#3b82f6');
    rect.setAttribute('stroke-width', '2');
    rect.setAttribute('stroke-dasharray', '6,3');
    rect.setAttribute('pointer-events', 'none');
    layer.appendChild(rect);

    // ループ範囲の矩形は音符の描画より手前（後の兄弟要素）にならないよう、
    // SVGの最初の子として挿入し、音符・カーソルの視認性を妨げないようにする。
    svg.insertBefore(layer, svg.firstChild);
  }

  setZoom(factor: number): void {
    this.osmd.zoom = factor;
    if (this.loaded) {
      this.osmd.render();
      // OSMDのrender()はSVG子要素を再構築するため、既存のオーバーレイをすべて再適用する。
      this.reapplyOverlays();
    }
  }

  /** setZoom等でOSMDが再描画した後、既存のオーバーレイ（運指・ループ・グレーアウト・ハイライト）を再適用する。 */
  private reapplyOverlays(): void {
    this.renderFingeringLayer();
    this.renderLoopBracketLayer();
    this.renderGrayoutLayer();
    this.renderHighlightLayer();
  }

  /**
   * 正誤判定結果に応じて楽譜上の音符を緑（正解）/赤（不正解）にハイライトする（REQ-004-003/004）。
   * `color: 'expected'` を指定するとハイライトを解除しデフォルト表示に戻す。
   */
  highlightNote(noteId: string, color: 'correct' | 'incorrect' | 'expected'): void {
    if (color === 'expected') {
      this.noteHighlights.delete(noteId);
    } else {
      this.noteHighlights.set(noteId, color);
    }
    this.renderHighlightLayer();
  }

  private renderHighlightLayer(): void {
    this.container.querySelector('#note-highlight-layer')?.remove();
    const svg = this.container.querySelector('svg');
    if (!svg || this.noteHighlights.size === 0) return;

    const layer = document.createElementNS(SVG_NS, 'g');
    layer.setAttribute('id', 'note-highlight-layer');

    for (const [noteId, color] of this.noteHighlights.entries()) {
      const coord = this.noteIdToSvgCoord.get(noteId);
      if (!coord) continue;

      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', String(coord.x));
      circle.setAttribute('cy', String(coord.y));
      circle.setAttribute('r', '9');
      circle.setAttribute(
        'fill',
        color === 'correct' ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)'
      );
      circle.setAttribute(
        'stroke',
        color === 'correct' ? 'rgba(21, 128, 61, 0.8)' : 'rgba(185, 28, 28, 0.8)'
      );
      circle.setAttribute('stroke-width', '1.5');
      circle.setAttribute('data-note-id', noteId);
      circle.setAttribute('data-highlight-color', color);
      circle.setAttribute('pointer-events', 'none');
      layer.appendChild(circle);
    }

    svg.appendChild(layer);
  }

  /**
   * 小節クリックによるカーソル移動（REQ-002-004）のため、クリック位置に最も近い
   * noteIdを解決してコールバックへ小節番号を通知する。ScoreRenderer側で
   * `score` から該当する `Note` を引き当て、`onNoteClick` prop 経由で
   * `practiceEngine.resetToMeasure` に結線する。
   */
  setOnMeasureClick(callback: ((measureNumber: number) => void) | null): void {
    this.onMeasureClickCallback = callback;
  }

  private handleContainerClick = (event: MouseEvent): void => {
    if (!this.onMeasureClickCallback) return;
    const svgPoint = this.screenToSvgCoord(event.clientX, event.clientY);
    if (!svgPoint) return;

    const noteId = this.findNearestNoteId(svgPoint);
    if (!noteId) return;

    const match = noteId.match(/-M(\d+)-/);
    if (!match) return;

    this.onMeasureClickCallback(parseInt(match[1], 10));
  };

  /**
   * 音符の右クリック（contextmenu）を処理し、クリック位置に最も近いnoteIdを解決して
   * コールバックへ通知する（REQ-008-001/003/006、REQ-009-005）。ScoreRenderer側で
   * App.tsxのコンテキストメニュー表示・annotation-store CRUDに結線する。座標解決は
   * 既存の handleContainerClick と同じ screenToSvgCoord → findNearestNoteId のパターンを
   * 流用する。楽譜上に独自のメニューを表示するため、ブラウザ既定のコンテキストメニューは
   * 常に抑止する。
   */
  setOnNoteContextMenu(
    callback: ((noteId: string, screenX: number, screenY: number) => void) | null
  ): void {
    this.onNoteContextMenuCallback = callback;
  }

  private handleContainerContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
    if (!this.onNoteContextMenuCallback) return;

    const svgPoint = this.screenToSvgCoord(event.clientX, event.clientY);
    if (!svgPoint) return;

    const noteId = this.findNearestNoteId(svgPoint);
    if (!noteId) return;

    this.onNoteContextMenuCallback(noteId, event.clientX, event.clientY);
  };

  private screenToSvgCoord(clientX: number, clientY: number): { x: number; y: number } | null {
    const svg = this.container.querySelector('svg') as SVGSVGElement | null;
    if (!svg) return null;
    try {
      const svgRect = svg.getBoundingClientRect();
      if (svgRect.width === 0) return null;

      const vb = svg.viewBox.baseVal;
      if (vb && vb.width > 0) {
        const scaleX = vb.width / svgRect.width;
        const scaleY = vb.height / svgRect.height;
        return {
          x: (clientX - svgRect.left) * scaleX + vb.x,
          y: (clientY - svgRect.top) * scaleY + vb.y,
        };
      }
      return { x: clientX - svgRect.left, y: clientY - svgRect.top };
    } catch {
      return null;
    }
  }

  private findNearestNoteId(point: { x: number; y: number }): string | null {
    let nearestId: string | null = null;
    let nearestDistSq = Infinity;

    for (const [noteId, coord] of this.noteIdToSvgCoord.entries()) {
      const dx = coord.x - point.x;
      const dy = coord.y - point.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearestId = noteId;
      }
    }

    return nearestId;
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
