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
  /** パートごとに最後に設定された不透明度（REQ-002-007: 非練習パートのグレーアウト）。 */
  private partOpacities = new Map<string, number>();
  /** noteIdごとの正誤ハイライト状態（'expected'は「ハイライトなし」を意味するため保持しない）。 */
  private noteHighlights = new Map<string, 'correct' | 'incorrect'>();
  /** 小節クリック時に呼び出されるコールバック（App.tsx側でpracticeEngine.resetToMeasureに結線する）。 */
  private onMeasureClickCallback: ((measureNumber: number) => void) | null = null;

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.osmd = new OpenSheetMusicDisplay(container, {
      autoResize: true,
      backend: 'svg',
      drawTitle: true,
    });
    this.container.addEventListener('click', this.handleContainerClick);
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
   * 指定パートの不透明度を設定する（REQ-002-007: 非練習パートのグレーアウト表示）。
   *
   * OSMDが生成するSVGにはインストゥルメント単位で安定して参照できるid/class属性が
   * 存在しないため、`noteIdToSvgCoord`（noteIdの先頭セグメント＝partIdを含む）から
   * 対象パートの音符座標を収集し、システム（段）ごとにY座標でクラスタリングした上で
   * 半透明の白色オーバーレイ矩形をその段の上に重ねることでグレーアウトを表現する。
   * `opacity >= 1` の場合はオーバーレイを除去し、通常表示に戻す。
   */
  setPartOpacity(partId: string, opacity: number): void {
    this.partOpacities.set(partId, opacity);
    this.renderPartOpacityLayer(partId);
  }

  private renderPartOpacityLayer(partId: string): void {
    const layerId = `part-opacity-layer-${this.sanitizeId(partId)}`;
    this.container.querySelector(`#${layerId}`)?.remove();

    const svg = this.container.querySelector('svg');
    if (!svg) return;

    const opacity = this.partOpacities.get(partId);
    if (opacity === undefined || opacity >= 1) return; // Fully opaque: no overlay needed

    const coords: Array<{ x: number; y: number }> = [];
    for (const [noteId, coord] of this.noteIdToSvgCoord.entries()) {
      if (this.parsePartId(noteId) === partId) coords.push(coord);
    }
    if (coords.length === 0) return;

    const layer = document.createElementNS(SVG_NS, 'g');
    layer.setAttribute('id', layerId);
    layer.setAttribute('data-part-id', partId);
    layer.setAttribute('data-opacity', String(opacity));

    const margin = { x: 20, yTop: 24, yBottom: 24 };
    for (const cluster of this.clusterByY(coords, 40)) {
      const minX = Math.min(...cluster.map((c) => c.x)) - margin.x;
      const maxX = Math.max(...cluster.map((c) => c.x)) + margin.x;
      const minY = Math.min(...cluster.map((c) => c.y)) - margin.yTop;
      const maxY = Math.max(...cluster.map((c) => c.y)) + margin.yBottom;

      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', String(minX));
      rect.setAttribute('y', String(minY));
      rect.setAttribute('width', String(Math.max(0, maxX - minX)));
      rect.setAttribute('height', String(Math.max(0, maxY - minY)));
      // 不透明度が低いほど白いベールを濃くし、下の音符をグレーアウトして見せる。
      rect.setAttribute('fill', `rgba(255, 255, 255, ${(1 - opacity).toFixed(2)})`);
      rect.setAttribute('pointer-events', 'none');
      layer.appendChild(rect);
    }

    // グレーアウトは音符の描画より手前（上）に重ねることで視覚的な減光を表現する。
    svg.appendChild(layer);
  }

  private renderAllPartOpacityLayers(): void {
    for (const partId of this.partOpacities.keys()) {
      this.renderPartOpacityLayer(partId);
    }
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
    this.renderAllPartOpacityLayers();
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

  /** noteId（`{partId}-M{measure}-N{index}`形式）からpartIdを抽出する。 */
  private parsePartId(noteId: string): string | null {
    const match = noteId.match(/^(.+)-M\d+-N\d+$/);
    return match ? match[1] : null;
  }

  /** SVGのid属性として安全に使えるよう、partIdの記号をハイフンに置き換える。 */
  private sanitizeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9_-]/g, '-');
  }

  /**
   * Y座標が近い（同じ譜表段に属すると推定される）座標同士をグループ化する。
   * setPartOpacity のグレーアウト矩形を、複数システム（段）にまたがる楽譜でも
   * 段ごとに分けて描画するために使用する。
   */
  private clusterByY(
    coords: Array<{ x: number; y: number }>,
    threshold: number
  ): Array<Array<{ x: number; y: number }>> {
    const sorted = [...coords].sort((a, b) => a.y - b.y);
    const clusters: Array<Array<{ x: number; y: number }>> = [];
    let current: Array<{ x: number; y: number }> = [];
    let lastY: number | null = null;

    for (const coord of sorted) {
      if (lastY === null || coord.y - lastY <= threshold) {
        current.push(coord);
      } else {
        clusters.push(current);
        current = [coord];
      }
      lastY = coord.y;
    }
    if (current.length > 0) clusters.push(current);

    return clusters;
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
