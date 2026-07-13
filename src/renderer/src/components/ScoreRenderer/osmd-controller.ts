import { OpenSheetMusicDisplay, GraphicalNote } from 'opensheetmusicdisplay';
import { Score, Note } from '../../types';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** ウィンドウ/コンテナのリサイズ検知後、再描画・再構築するまでのデバウンス時間（ミリ秒）。 */
const RESIZE_DEBOUNCE_MS = 250;
/**
 * OSMDカーソルのタイムスタンプから導出した絶対tickと、パーサ由来Note.startTickとの
 * 照合許容差（tick単位）。divisionsがTICKS_PER_QUARTER(480)を割り切れない場合の
 * 丸め誤差を吸収するための小さな許容値。
 */
const TICK_MATCH_TOLERANCE = 2;

/**
 * 和音（同一カーソル位置に複数の構成音が解決される場合）の指番号描画座標を
 * 重ならせないための縦オフセット幅（ピクセル）。音高降順（高い音が上）に
 * 一定間隔でずらす（TASK-050）。
 */
const CHORD_NOTE_VERTICAL_OFFSET_PX = 10;

/**
 * 下段（staff 2、通常ヘ音記号=左手）の指番号をカーソル下端からさらに離す
 * マージン（ピクセル）。下段譜表の直下へ描画するために使う。
 */
const LOWER_STAFF_FINGERING_MARGIN_PX = 12;

/**
 * 同一カーソル位置で解決された構成音群の指番号描画座標を計算する（純関数）。
 *
 * 2026-07-05 実機フィードバック対応: 従来は両段（ト音・ヘ音）の構成音を
 * まとめて音高順にカーソル上端へ縦積みしていたため、右手と左手の指番号が
 * 一列に混ざって判読できなかった。段（Note.staff、未指定は1）ごとに分離し、
 * - 上段（staff<=1、右手）: 従来どおりカーソル上端（coord.y）を中心に音高降順で縦積み
 * - 下段（staff>=2、左手）: カーソル下端（coord.y + coord.height）の下に音高降順で縦積み
 * とする。
 */
export function computeFingeringCoords(
  matchedNotes: Note[],
  coord: { x: number; y: number; height: number }
): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>();

  const upper = matchedNotes.filter((n) => (n.staff ?? 1) <= 1);
  const lower = matchedNotes.filter((n) => (n.staff ?? 1) >= 2);

  const byPitchDesc = (a: Note, b: Note) => b.midiNumber - a.midiNumber;

  upper.sort(byPitchDesc).forEach((note, rank) => {
    const offsetY =
      upper.length > 1 ? (rank - (upper.length - 1) / 2) * CHORD_NOTE_VERTICAL_OFFSET_PX : 0;
    result.set(note.id, { x: coord.x, y: coord.y + offsetY });
  });

  lower.sort(byPitchDesc).forEach((note, rank) => {
    result.set(note.id, {
      x: coord.x,
      y:
        coord.y +
        coord.height +
        LOWER_STAFF_FINGERING_MARGIN_PX +
        rank * CHORD_NOTE_VERTICAL_OFFSET_PX,
    });
  });

  return result;
}

/**
 * OSMDカーソルが返すNote（`VoiceEntry.Notes`の要素）のうち、buildNoteIdMapでの照合に
 * 必要なプロパティだけを表す最小限の構造的型。実際にはOSMD自身の`Note`クラスの
 * インスタンスが渡ってくるが、依存を最小化するため実クラスは直接importせず、
 * 構造的部分型（duck typing）で受け取る。
 */
interface OsmdCursorNote {
  isRest?: () => boolean;
  /** OSMD内部の半音値（C4=48相当）。MIDIノート番号にするには+12する。 */
  halfTone?: number;
  ParentStaffEntry?: {
    ParentStaff?: { Id?: number };
    AbsoluteTimestamp?: { RealValue?: number };
  };
}

/** buildNoteIdMapの照合処理で使う、OSMD Note 1件分の正規化済み情報。 */
interface OsmdNoteEntry {
  isRest: boolean;
  /** 休符の場合は-1（比較キーとして使わない）。 */
  midiNumber: number;
  /** 1始まり。パーサのNote.staffと同じ基準（未指定/取得不可時は1）。 */
  staff: number;
  /** 曲頭からの絶対tick。導出不能な場合はNaN。 */
  absoluteTick: number;
}

/**
 * VexFlowGraphicalNote固有のSVG要素取得API（`getSVGGElement`）を表す構造的型（TASK-060）。
 * このAPIはOSMDのVexFlowバックエンド実装（VexFlowGraphicalNote）のみが持ち、
 * 基底クラスの`GraphicalNote`型には定義がないため、依存を最小化する目的で
 * VexFlowGraphicalNoteクラス自体は直接importせず、構造的部分型で受け取る。
 */
interface SvgCapableGraphicalNote {
  getSVGGElement?: () => SVGGElement;
}

export class OSMDController {
  private osmd: OpenSheetMusicDisplay;
  private container: HTMLDivElement;
  private loaded = false;
  private disposed = false;
  private currentIteratorIndex = 0;
  private noteIdToSvgCoord = new Map<string, { x: number; y: number }>();
  /**
   * noteIdごとに対応するOSMDの`GraphicalNote`インスタンスを保持するマップ（TASK-060）。
   * グレーアウト（減光）表示のため、`GraphicalNote.getSVGGElement()`経由でSVG要素の
   * opacityを直接操作する対象を解決するために使う。buildNoteIdMapで
   * `cursor.GNotesUnderCursor()`が返す`GraphicalNote`群と、パーサ照合済みの`Note`とを
   * `GraphicalNote.sourceNote`の同一性（`===`）で対応付けて構築する。
   */
  private noteIdToGraphicalNote = new Map<string, GraphicalNote>();
  /**
   * buildNoteIdMapへ最後に渡されたパース済みScore。autoResize:false化に伴い、
   * ResizeObserver発火時・setZoom時に外部から改めてscoreを渡されなくても
   * 同じ照合ロジックでマップを再構築できるよう保持する。
   */
  private lastScore: Score | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * 直近に実際へrenderを実行した時点のコンテナサイズ（TASK-106）。
   * ライブラリ往復（隠す→同一サイズで戻す）の際、handleResizeで
   * このサイズと比較して不要な再レンダリングをスキップするために使う。
   * load完了前はnull（何とも比較せず常にサイズ変化ありと扱う）。
   */
  private lastRenderedWidth: number | null = null;
  private lastRenderedHeight: number | null = null;
  /**
   * コンテナが不可視（サイズ0）の間にsetZoom等の描画要求が発生したことを示す
   * フラグ（TASK-106）。不可視中は即時renderせず、可視復帰時のResizeObserver
   * 発火（handleResize）で一度だけ再レンダリングを実行して消化する。
   */
  private pendingRenderWhileHidden = false;
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
  /**
   * 現在減光を適用中のSVG要素→適用前のopacityのマップ（TASK-060）。
   *
   * TASK-081: 当初はnoteId単位（`Map<noteId, {element, originalOpacity}>`）で管理していた。
   * 和音は複数のnoteIdが同一のSVG要素を共有する。そのため2件目以降の処理で「既に減光後の
   * opacity(0.5)」を元値として誤って記録してしまい、復元時に減光が残留・累積する不具合に
   * なっていた。要素そのものをキーにすることで、同一要素への記録は必ず1回だけになる。
   * renderGrayoutLayerを呼び出すたび、必ず元のopacityへ先に復元してからクリアし、
   * 新しい対象集合へ改めて適用する。
   */
  private grayoutAppliedElements = new Map<SVGGElement, string>();
  /** noteIdごとの正誤ハイライト状態（'expected'は「ハイライトなし」を意味するため保持しない）。 */
  private noteHighlights = new Map<string, 'correct' | 'incorrect'>();
  /** 小節クリック時に呼び出されるコールバック（App.tsx側でpracticeEngine.resetToMeasureに結線する）。 */
  private onMeasureClickCallback: ((measureNumber: number) => void) | null = null;
  /**
   * 音符の右クリック（contextmenu）時に呼び出されるコールバック（REQ-008-001/003/006、
   * REQ-009-005）。App.tsx側で運指メモのコンテキストメニュー表示に結線する。
   */
  private onNoteContextMenuCallback:
    ((noteId: string, screenX: number, screenY: number) => void) | null = null;

  constructor(container: HTMLDivElement) {
    this.container = container;
    // TASK-049: OSMDの自動再レイアウト（autoResize）に頼ると、noteIdToSvgCoord等の
    // オーバーレイ用座標マップがロード時の1回きりのまま古くなる（stale）。
    // そのためautoResizeをoffにし、ResizeObserverで
    // render→buildNoteIdMap→reapplyOverlays を自前制御する。
    this.osmd = new OpenSheetMusicDisplay(container, {
      autoResize: false,
      backend: 'svg',
      drawTitle: true,
    });
    this.container.addEventListener('click', this.handleContainerClick);
    this.container.addEventListener('contextmenu', this.handleContainerContextMenu);

    // jsdom等、テスト環境にResizeObserverが存在しない場合は監視をスキップする
    // （防御的。実行環境のブラウザ/Electronでは常に存在する）。
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.scheduleResizeHandling();
      });
      this.resizeObserver.observe(this.container);
    }
  }

  async load(xmlContent: string): Promise<void> {
    this.loaded = false;
    await this.osmd.load(xmlContent);
    this.osmd.render();
    this.recordRenderedSize();
    this.loaded = true;
  }

  /** 直近にrenderした時点のコンテナサイズを記録する（TASK-106）。 */
  private recordRenderedSize(): void {
    this.lastRenderedWidth = this.container.clientWidth;
    this.lastRenderedHeight = this.container.clientHeight;
  }

  /**
   * ResizeObserver発火をデバウンス（既定250ms、200〜300msの範囲）してから
   * handleResizeを実行する。デバウンス中に連続リサイズが来てもrenderが
   * 多重実行されないよう、直前のタイマーを毎回クリアする。
   */
  private scheduleResizeHandling(): void {
    if (this.disposed) return;
    if (this.resizeDebounceTimer !== null) {
      clearTimeout(this.resizeDebounceTimer);
    }
    this.resizeDebounceTimer = setTimeout(() => {
      this.resizeDebounceTimer = null;
      this.handleResize();
    }, RESIZE_DEBOUNCE_MS);
  }

  /**
   * リサイズデバウンス経過後の実処理: OSMDを再描画し、noteIdマップを再構築してから
   * 既存のオーバーレイ（運指・ループ・グレーアウト・ハイライト）を再適用する。
   * load()完了前（this.loaded=false）には何もしない。
   *
   * TASK-106: ライブラリ画面表示中は楽譜コンテナがdisplay:noneとなりサイズ0の
   * ResizeObserver発火が起きる。ここで無条件にrenderするとSVGが破棄されてしまうため、
   * 以下の2段階でガードする。
   * 1. コンテナが不可視（幅または高さが0）の間は何もしない（SVGを破棄しない）
   * 2. 直近の描画時サイズと比較し、サイズが変わっておらず不可視中の保留描画要求も
   *    なければ再レンダリングをスキップする（隠す→同一サイズで戻す往復を無再描画にする）
   */
  private handleResize(): void {
    if (this.disposed || !this.loaded) return;

    const { clientWidth, clientHeight } = this.container;
    if (clientWidth === 0 || clientHeight === 0) return;

    const sizeChanged =
      clientWidth !== this.lastRenderedWidth || clientHeight !== this.lastRenderedHeight;
    if (!sizeChanged && !this.pendingRenderWhileHidden) return;

    this.pendingRenderWhileHidden = false;
    this.performRender();
  }

  /** OSMDを再描画し、描画時サイズを記録してからnoteIdマップを再構築し、オーバーレイを再適用する（TASK-106）。 */
  private performRender(): void {
    this.osmd.render();
    this.recordRenderedSize();
    if (this.lastScore) {
      this.buildNoteIdMap(this.lastScore);
    }
    this.reapplyOverlays();
  }

  /**
   * OSMDControllerが保持するリソースを解放する（TASK-049）。
   * ResizeObserverのdisconnect、click/contextmenuリスナーの解除、保留中の
   * デバウンスタイマーのクリアを行う。ScoreRendererのアンマウント時に呼ばれる。
   * dispose後に他のメソッドが呼ばれてもクラッシュしないよう、以降のリサイズ処理は
   * no-opにする（disposedフラグ）。
   */
  dispose(): void {
    if (this.resizeDebounceTimer !== null) {
      clearTimeout(this.resizeDebounceTimer);
      this.resizeDebounceTimer = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.container.removeEventListener('click', this.handleContainerClick);
    this.container.removeEventListener('contextmenu', this.handleContainerContextMenu);
    // TASK-060: 減光済みSVG要素のopacityを元に戻してから破棄する（復元漏れ防止）。
    this.restoreGrayoutOpacity();
    this.disposed = true;
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
      // or explicitly typed as any by user configuration.
      // To satisfy "strict: true" and "any 禁止", we will treat this.osmd.cursor as unknown first.
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
   * note単位でグレーアウトを適用する実装に変更した。
   *
   * TASK-060: `noteIdToSvgCoord`（運指表示位置の座標）に白半透明の矩形（ベール）を
   * 重ねる方式は、符頭ではなく運指番号の表示位置に重なるバグがあったため廃止した。
   * 現在は対象noteIdに対応する`GraphicalNote`のSVG要素自体のopacityを直接下げることで
   * 減光を表現する。呼び出しごとに状態を完全に置き換える（差分適用ではない）。
   * 空集合を渡すとグレーアウトを全解除する。
   */
  setGrayedOutNotes(noteIds: ReadonlySet<string> | readonly string[], opacity = 0.5): void {
    this.grayedOutNoteIds = new Set(noteIds);
    this.grayoutOpacity = opacity;
    this.renderGrayoutLayer();
  }

  /**
   * グレーアウト対象のnoteIdに対応するSVG要素（音符本体）のopacityを直接変更して
   * 減光を表現する（TASK-060）。
   *
   * 前回減光した要素のopacityは、新しい対象集合を適用する前に必ず元へ戻す
   * （対象集合の置き換え・空集合での全解除の両方に対応するため）。
   * `getSVGGElement()`はVexFlowバックエンド固有のAPIであり、未実装・例外・要素なしの
   * 場合は該当ノートをスキップし、他のノートの処理は継続する。
   *
   * 既知の制限: 符幹・連桁（beam）が複数音符で共有される場合、`getSVGGElement()`が
   * 返すSVGグループには符頭のみが含まれ符幹・連桁は含まれないことがあるため、
   * 減光が符頭のみに適用され符幹・連桁の減光が伴わない（見た目上部分的な減光になる）
   * ことがある。
   *
   * TASK-081: 和音は複数のnoteIdが同一のSVG要素を共有する。元opacityの二重記録を
   * 防ぐため、対象noteIdのSVG要素をSetでまず重複排除する。その後、要素ごとに1回だけ
   * 「変更前のopacity」を記録し、0.5（またはopacity引数の値）を適用する。
   */
  private renderGrayoutLayer(): void {
    this.restoreGrayoutOpacity();
    if (this.grayedOutNoteIds.size === 0) return;

    const targetElements = new Set<SVGGElement>();
    for (const noteId of this.grayedOutNoteIds) {
      const graphicalNote = this.noteIdToGraphicalNote.get(noteId);
      if (!graphicalNote) continue; // 対応するGraphicalNote未解決（buildNoteIdMap未完了等）のノートは無視する

      const svgCapable = graphicalNote as unknown as SvgCapableGraphicalNote;
      if (typeof svgCapable.getSVGGElement !== 'function') continue;

      try {
        const element = svgCapable.getSVGGElement();
        if (!element) continue;
        targetElements.add(element);
      } catch (e) {
        console.warn(
          '[OSMDController] renderGrayoutLayer: failed to get SVG element for ' +
            `noteId=${noteId}; skipping.`,
          e
        );
      }
    }

    for (const element of targetElements) {
      const originalOpacity = element.style.opacity;
      element.style.opacity = String(this.grayoutOpacity);
      this.grayoutAppliedElements.set(element, originalOpacity);
    }
  }

  /** grayoutAppliedElementsに記録済みの全要素のopacityを適用前の値へ復元し、記録をクリアする。 */
  private restoreGrayoutOpacity(): void {
    for (const [element, originalOpacity] of this.grayoutAppliedElements.entries()) {
      if (originalOpacity) {
        element.style.opacity = originalOpacity;
      } else {
        element.style.removeProperty('opacity');
      }
    }
    this.grayoutAppliedElements.clear();
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

  /**
   * ズーム倍率を変更してOSMDを再描画する。
   *
   * TASK-106: コンテナが不可視（display:noneでサイズ0）の間に呼ばれた場合は
   * 即時renderせず保留フラグを立てるだけにする。可視復帰時のResizeObserver発火
   * （handleResize）で一度だけ再レンダリングして消化する。
   */
  setZoom(factor: number): void {
    this.osmd.zoom = factor;
    if (!this.loaded) return;

    const { clientWidth, clientHeight } = this.container;
    if (clientWidth === 0 || clientHeight === 0) {
      this.pendingRenderWhileHidden = true;
      return;
    }

    this.performRender();
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

  private getCursorSvgCoord(): { x: number; y: number; height: number } | null {
    const svg = this.container.querySelector('svg') as SVGSVGElement | null;
    // cursorElement is an internal OSMD property not exposed in the public type definitions
    const cursorEl = (this.osmd.cursor as unknown as { cursorElement?: HTMLElement })
      ?.cursorElement;
    if (!svg || !cursorEl) return null;
    try {
      const svgRect = svg.getBoundingClientRect();
      const cursorRect = cursorEl.getBoundingClientRect();
      if (svgRect.width === 0) return null;

      // Convert screen coords to SVG internal coords via viewBox ratio.
      // height はカーソル矩形（両段をまたぐ縦線）のSVG単位での高さで、
      // 下段（左手）の指番号をカーソル下端の下へ配置するために使う。
      const vb = svg.viewBox.baseVal;
      if (vb && vb.width > 0) {
        const scaleX = vb.width / svgRect.width;
        const scaleY = vb.height / svgRect.height;
        return {
          x: (cursorRect.left - svgRect.left + cursorRect.width / 2) * scaleX + vb.x,
          y: (cursorRect.top - svgRect.top) * scaleY + vb.y,
          height: cursorRect.height * scaleY,
        };
      }
      // Fallback when no viewBox
      return {
        x: cursorRect.left - svgRect.left + cursorRect.width / 2,
        y: cursorRect.top - svgRect.top,
        height: cursorRect.height,
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
      // 2026-07-05 実機フィードバック: 旧実装（8px・未承認は薄い水色#93c5fd）は
      // 小さく薄くて読めなかった。五線・符幹に重なっても判読できるよう、
      // 太字＋白フチ（paint-order: stroke）＋濃色で描画する。
      text.setAttribute('font-size', '12');
      text.setAttribute('font-weight', 'bold');
      text.setAttribute('stroke', '#ffffff');
      text.setAttribute('stroke-width', '3');
      text.setAttribute('paint-order', 'stroke');
      // 提案中（未承認）: 濃い青 / 承認済み: 濃い緑（状態を色相で区別）
      text.setAttribute('fill', isApproved ? '#15803d' : '#1d4ed8');
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

  /**
   * OSMDカーソルが辿るVoiceEntry群と、パース済み `Score` の `Note` を
   * 「小節番号・タイムスタンプ由来tick・midiNumber・staff」で照合し、
   * noteIdごとのカーソル位置・SVG座標マップを構築する（TASK-049）。
   *
   * 従来はOSMDカーソルのタイムスタンプ順で独自にnoteId（`{partId}-M{measure}-N{index}`）を
   * 振り直していた。しかしパーサはXML文書順（staff1全音→backup→staff2）で採番するため、
   * 多声部・2段譜の小節では順序が食い違い、同じnoteIdが別の音を指す不整合があった。
   * 本実装はパーサ側で確定済みの `Note.id` を照合によって引き当てるため、この不整合を解消する。
   *
   * 照合に失敗した音（対応するNoteが見つからない）はマップに含めず、警告ログのみ出す
   * （フォールバックで誤対応を作らない）。
   */
  buildNoteIdMap(score: Score): Map<string, { iteratorIndex: number }> {
    this.lastScore = score;
    this.noteIdToCursorState.clear();
    this.noteIdToSvgCoord.clear();
    this.noteIdToGraphicalNote.clear();
    if (!this.osmd.cursor || !this.loaded) return this.noteIdToCursorState;

    // Show cursor temporarily so CursorElement is in the DOM for coordinate sampling
    const wasHidden = this.osmd.cursor.Hidden;
    if (wasHidden) this.osmd.cursor.show();

    this.osmd.cursor.reset();
    this.currentIteratorIndex = 0;
    let iteratorIndex = 0;

    // 小節番号ごとの未消費（未マッチ）候補Noteリスト。マッチした候補はここから
    // 取り除き、同一小節内で同じNoteの二重割り当てを防ぐ。
    const remainingNotesByMeasure = new Map<number, Note[]>();
    for (const measure of score.measures) {
      remainingNotesByMeasure.set(measure.number, [...measure.notes]);
    }

    while (!this.osmd.cursor.Iterator.EndReached) {
      const coord = this.getCursorSvgCoord();
      const measureIndex = this.osmd.cursor.Iterator.CurrentMeasureIndex;
      const measureNumber = measureIndex + 1;
      const voiceEntries = this.osmd.cursor.Iterator.CurrentVoiceEntries;

      if (voiceEntries) {
        const osmdEntries: OsmdNoteEntry[] = [];
        // osmdEntries[i] に対応する生のOSMD Noteオブジェクト参照（TASK-060）。
        // GraphicalNote.sourceNote との同一性（===）比較にのみ使うため、
        // describeOsmdNoteと同じ構造的型（OsmdCursorNote）で十分。
        const osmdNoteRefs: OsmdCursorNote[] = [];

        voiceEntries.forEach((ve) => {
          if (!ve || !ve.Notes) return;
          ve.Notes.forEach((note) => {
            osmdEntries.push(this.describeOsmdNote(note, score.ticksPerQuarter));
            osmdNoteRefs.push(note);
          });
        });

        if (osmdEntries.length > 0) {
          const candidates = remainingNotesByMeasure.get(measureNumber);
          const matched = this.matchNotesForTimestamp(osmdEntries, candidates ?? []);

          // TASK-060: グレーアウト（音符自体の減光）の対象SVG要素を解決するため、
          // 同一カーソル位置のGraphicalNote群を取得する。GNotesUnderCursorは
          // OSMD 2.0のCursor APIで、GraphicalNote.sourceNoteはVoiceEntry.Notesの
          // 要素と同一のオブジェクト参照を持つ。テスト用モックカーソルが
          // 本メソッドを実装していない場合は空配列として扱う（防御的）。
          const graphicalNotesUnderCursor: GraphicalNote[] =
            typeof this.osmd.cursor.GNotesUnderCursor === 'function'
              ? this.osmd.cursor.GNotesUnderCursor()
              : [];

          // TASK-050/2026-07-05フィードバック: 同一カーソル位置(coord)には和音や
          // 両段（ト音・ヘ音）の構成音が同時に解決されることもある。OSMDカーソルは
          // 1ステップにつき1つの代表座標しか提供しないため、符頭単位座標の直接取得は
          // 行わず、段（staff）ごとに分離した縦積み座標を computeFingeringCoords
          // （純関数）で計算する（上段=カーソル上端付近、下段=カーソル下端の下）。
          const matchedNotes = matched.filter((m): m is Note => m !== undefined);
          const fingeringCoords = coord
            ? computeFingeringCoords(matchedNotes, coord)
            : new Map<string, { x: number; y: number }>();

          osmdEntries.forEach((entry, i) => {
            const matchedNote = matched[i];
            if (!matchedNote) {
              console.warn(
                '[OSMDController] buildNoteIdMap: could not resolve a matching Note ' +
                  `(measure=${measureNumber}, tick=${entry.absoluteTick}, ` +
                  `isRest=${entry.isRest}, midiNumber=${entry.midiNumber}, staff=${entry.staff}); skipping.`
              );
              return;
            }
            this.noteIdToCursorState.set(matchedNote.id, { iteratorIndex });
            const fingeringCoord = fingeringCoords.get(matchedNote.id);
            if (fingeringCoord) {
              this.noteIdToSvgCoord.set(matchedNote.id, fingeringCoord);
            }
            const graphicalNote = graphicalNotesUnderCursor.find(
              (gn) => gn.sourceNote === osmdNoteRefs[i]
            );
            if (graphicalNote) {
              this.noteIdToGraphicalNote.set(matchedNote.id, graphicalNote);
            }
            if (candidates) {
              const idx = candidates.indexOf(matchedNote);
              if (idx >= 0) candidates.splice(idx, 1);
            }
          });
        }
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

  /**
   * OSMDのNote（VoiceEntry.Notes要素）から照合に必要な情報を抽出する。
   * - isRest: 休符かどうか（Note.isRest()）
   * - midiNumber: 休符でない場合、OSMDの内部半音値（Note.halfTone、C4=48相当）に
   *   12を加算してMIDIノート番号（C4=60）に正規化した値（パーサのtoMidiNumberと同じ基準）
   * - staff: Note.ParentStaffEntry.ParentStaff.Id（1始まり。パーサのNote.staffと同じ基準）
   * - absoluteTick: Note.ParentStaffEntry.AbsoluteTimestamp（全音符=1のFraction）を
   *   4分音符=1に変換し、score.ticksPerQuarterを掛けて絶対tickに正規化した値
   */
  private describeOsmdNote(note: OsmdCursorNote, ticksPerQuarter: number): OsmdNoteEntry {
    const isRest = typeof note.isRest === 'function' ? note.isRest() : false;
    const parentStaff = note.ParentStaffEntry?.ParentStaff;
    const staff = typeof parentStaff?.Id === 'number' ? parentStaff.Id : 1;
    const absTimestampRealValue = note.ParentStaffEntry?.AbsoluteTimestamp?.RealValue;
    const absoluteTick =
      typeof absTimestampRealValue === 'number'
        ? Math.round(absTimestampRealValue * 4 * ticksPerQuarter)
        : NaN;

    return {
      isRest,
      midiNumber: isRest ? -1 : (note.halfTone ?? 0) + 12,
      staff,
      absoluteTick,
    };
  }

  /**
   * 同一タイムスタンプ（OSMDカーソルの1ステップ）に属するOSMD Note群を、同じ小節の
   * 未消費candidate（パーサNote）群と照合する。
   *
   * 手順:
   * 1. (isRest, midiNumber) の組でグルーピングする（休符同士、同じ音高同士のみ照合対象にする）。
   * 2. 各グループについて、tickがtick許容差内で一致するcandidateに絞り込む。
   * 3. OSMD側1件・candidate側1件ならそのまま対応付ける。
   * 4. 複数件（和音・複数staffでの同時発音）の場合はstaff昇順でzipし、誤対応を減らす
   *    （staff番号が同じ意味を持つことはOSMD Staff.Idとパーサ Note.staff の両方が
   *    1始まりの一致した番号であることを前提とする）。
   * 5. 候補が見つからない場合は当該インデックスをundefinedのまま返す（呼び出し元でwarn）。
   */
  private matchNotesForTimestamp(
    osmdEntries: OsmdNoteEntry[],
    candidates: Note[]
  ): Array<Note | undefined> {
    const result: Array<Note | undefined> = new Array(osmdEntries.length).fill(undefined);
    const usedCandidates = new Set<Note>();

    const groupKey = (entry: OsmdNoteEntry): string =>
      entry.isRest ? 'rest' : `n${entry.midiNumber}`;

    const groups = new Map<string, number[]>();
    osmdEntries.forEach((entry, idx) => {
      const key = groupKey(entry);
      const list = groups.get(key) ?? [];
      list.push(idx);
      groups.set(key, list);
    });

    for (const [key, osmdIdxList] of groups.entries()) {
      const referenceTick = osmdEntries[osmdIdxList[0]].absoluteTick;
      const isRestGroup = key === 'rest';

      const candidateList = candidates.filter((c) => {
        if (usedCandidates.has(c)) return false;
        if (isRestGroup) {
          if (!c.isRest) return false;
        } else {
          if (c.isRest || c.midiNumber !== Number(key.slice(1))) return false;
        }
        if (!Number.isFinite(referenceTick)) return true;
        return Math.abs(c.startTick - referenceTick) <= TICK_MATCH_TOLERANCE;
      });

      if (candidateList.length === 0) continue;

      const sortedOsmdIdx = [...osmdIdxList].sort(
        (a, b) => osmdEntries[a].staff - osmdEntries[b].staff
      );
      const sortedCandidates = [...candidateList].sort(
        (a, b) => (a.staff ?? 1) - (b.staff ?? 1) || a.noteIndex - b.noteIndex
      );

      const pairCount = Math.min(sortedOsmdIdx.length, sortedCandidates.length);
      for (let i = 0; i < pairCount; i++) {
        const osmdIdx = sortedOsmdIdx[i];
        const candidate = sortedCandidates[i];
        result[osmdIdx] = candidate;
        usedCandidates.add(candidate);
      }
    }

    return result;
  }
}
