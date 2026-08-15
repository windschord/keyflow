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
 * 光标定位到屏幕最右边时与视口右边缘的间距（px）。
 * 「整条五线谱超过屏幕长度」时，光标贴在右边缘但保留一点呼吸空间。
 */
const SCROLL_EDGE_MARGIN_PX = 8;

/**
 * 拖动乐谱（pan）后抑制随后 click 的时间窗口（毫秒）。浏览器在 mouseup 之后
 * 派发 click，这个窗口只需覆盖这一次事件派发即可；用时间窗口而非永久标志，
 * 使鼠标在窗口外松开等「click 未触发」的边界情况下抑制标志能自动过期，
 * 不会吞掉之后真正的点击。
 */
const SUPPRESS_CLICK_MS = 300;

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
 * collectMeasureRects で使う OSMD の GraphicalMeasure の最小限の構造的型。
 * PositionAndShape（AbsolutePosition/Size は内部単位 = viewBox/10）と
 * StaffLines（五線谱の各線、RelativePosition.y と StaffHeight）から
 * 「小节左右边界 × 最上线～最下线」の矩形を算出する。実クラスは import せず
 * duck typing で受け取る（他箇所と同じ方針）。
 */
interface OsmdGraphicalMeasure {
  MeasureNumber?: number;
  PositionAndShape?: {
    AbsolutePosition?: { x: number; y: number };
    Size?: { width: number; height: number };
  };
  StaffLines?: Array<{
    PositionAndShape?: { RelativePosition?: { y: number } };
    StaffHeight?: number;
  }>;
}

/**
 * rebuildGrayoutNoteMap で使う OSMD の GraphicalMeasure の最小限の構造的型。
 * staffEntries → graphicalVoiceEntries → notes（GraphicalNote）を辿って
 * noteId→GraphicalNote マップを再構築する。GraphicalStaffEntry は同一タイム
 * スタンプの垂直音符群（buildNoteIdMap の cursor 1 ステップと対応する）ため、
 * describeOsmdNote + matchNotesForTimestamp の既存照合ロジックを再利用できる。
 */
interface OsmdGraphicalMeasureNotes {
  MeasureNumber?: number;
  staffEntries?: Array<{
    graphicalVoiceEntries?: Array<{
      notes?: Array<{ sourceNote?: OsmdCursorNote }>;
    }>;
  }>;
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

/** MusicXML ファイルに紐づく noteId マップキャッシュの永続化フォーマット。 */
export interface ScoreMapCache {
  /** キャッシュバージョン（破壊的変更時にインクリメント）。分頁化（v2）で noteIdToSvgCoord に pageIndex を追加。 */
  version: 2;
  /** キャッシュ生成時の固定ページフォーマット（異なる場合はキャッシュ不採用）。 */
  pageFormat: 'A4_P';
  /**
   * キャッシュ生成時の OSMD zoom 値。iteratorIndexToCursorStyle は「当時の描画画素」
   * ベースで生成されるため、ズーム値が異なる場合はこのフィールドを
   * 捨て（applyCache で採用しない）、代わりに noteIdToCursorState の
   * iteratorIndex だけを使って moveCursor 時に逐次 next() する。
   * viewBox 座標（noteIdToSvgCoord）は zoom と独立なので常に採用可能。
   */
  zoomBase: number;
  /** noteId → cursor.iteratorIndex。moveCursor の O(1) ジャンプに使用。 */
  noteIdToCursorState: Record<string, { iteratorIndex: number }>;
  /**
   * noteId → SVG viewBox 単位の運指描画座標。分頁化後は「ページ内座標 + ページ番号」。
   * renderFingeringLayer 等のオーバーレイは対応するページの SVG へ描画するため、
   * ページ番号を一緒に保存する（v2 で追加）。
   */
  noteIdToSvgCoord: Record<string, { x: number; y: number; pageIndex: number }>;
  /** iteratorIndex → cursorElement.style.cssText スナップショット。moveCursor 高速化に使用。 */
  iteratorIndexToCursorStyle: Record<number, string>;
}

/** ScoreMapCache 永続化キャッシュファイルの suffix。 */
export const SCOREMAP_CACHE_SUFFIX = '.scoremap.cache.json';

export class OSMDController {
  private osmd: OpenSheetMusicDisplay;
  private container: HTMLDivElement;
  private loaded = false;
  private disposed = false;
  private currentIteratorIndex = 0;
  /**
   * noteId → その音符の SVG viewBox 単位の描画座標（ページ内座標）+ ページ番号（v2、分頁化対応）。
   * 分頁モードではページごとに独立した SVG が生成されるため、オーバーレイ（運指・
   * ハイライト・ループ枠）は対応するページの SVG に描画する必要がある。pageIndex は
   * getPageSvgs() の DOM 順インデックス（＝ページ番号 - 1）で保持する。
   */
  private noteIdToSvgCoord = new Map<string, { x: number; y: number; pageIndex: number }>();
  /**
   * 小节号 → 该小节在乐谱上的「可点击判定矩形列表」（viewBox 坐标 + pageIndex）。
   * 范围限定为「小节左右边界 × 五线谱最上线～最下线」围成的长方形，用于
   * 小節クリック判定（REQ-002-004）——点击落在矩形外（五线谱之间空白等）
   * 时不触发跳转。
   *
   * 双谱表（钢琴）时每个 staff 单独存一个矩形（高音谱一个、低音谱一个），
   * 不能合并成一个大矩形：高音谱与低音谱之间有空白间隙，合并会把间隙也纳入
   * 判定范围（低音谱区域点不动、间隙反而可点的 bug）。命中测试只要点在任一
   * staff 矩形内即可选中小节，间隙点不中。
   *
   * collectMeasureRects() 在 load() 渲染完成后从 OSMD 的 GraphicSheet
   * （GraphicalMeasure.PositionAndShape + StaffLines）采集，不依赖光标遍历，
   * 因此 applyCache（缓存命中）的路径同样覆盖。
   */
  private measureNumberToRect = new Map<number, Array<{ x: number; y: number; width: number; height: number; pageIndex: number }>>();
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
   * ライブラリ往復等で外部から改めてscoreを渡されなくても
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
  private lastFingeringAssignments: Array<{ noteId: string; finger: number; isApproved: boolean }> =
    [];
  /** ループ範囲の最後に指定された値。オーバーレイ再適用時に保持する。 */
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
  /**
   * 指法编辑模式是否开启。开启后乐谱上的指法数字变为可点击（pointer-events: auto），
   * 点击数字时触发 onFingeringClickCallback 而不是小节跳转。
   * 平时数字保持 pointer-events: none，行为与未开启时完全一致。
   */
  private fingeringEditMode = false;
  /** 编辑模式下点击指法数字时的回调（noteId + 屏幕坐标，供 App 弹出数字选择条）。 */
  private onFingeringClickCallback:
    ((noteId: string, screenX: number, screenY: number) => void) | null = null;
  /**
   * suppressNextClick() 设置的抑制截止时间戳（Date.now() 毫秒）。ScoreRenderer 的
   * 拖动逻辑在检测到拖动（超过阈值）后调用 suppressNextClick()，使随后派发的
   * click（浏览器在 mouseup 后触发）被 handleContainerClick 吞掉，避免把
   * 「按住拖动乐谱」误判为小节点击。
   */
  private suppressClickUntil = 0;

  constructor(container: HTMLDivElement) {
    this.container = container;
    // TASK-049: OSMDの自動再レイアウト（autoResize）に頼ると、noteIdToSvgCoord等の
    // オーバーレイ用座標マップがロード時の1回きりのまま古くなる（stale）。
    // そのためautoResizeをoffにし、A4固定幅の分頁モードで load() 時に
    // render→buildNoteIdMap を一度だけ実行する（ズームは CSS 側で表現し、
    // 再描画は発生しない）。
    this.osmd = new OpenSheetMusicDisplay(container, {
      autoResize: false,
      backend: 'svg',
      drawTitle: true,
      // A4 縦向き固定ページフォーマット。'A4'（無効値）ではなく 'A4_P' を指定すると
      // OSMD がページモードになり、楽譜を A4 ページごとに分割して
      // div#osmdCanvasPage{i} > svg#osmdSvgPage{i} を縦に並べる（MuseScore 同様の分頁）。
      // 'A4' は PageFormatStandards に存在しないため Endless（無限スクロール）へ
      // 静かにフォールバックしてしまう点に注意。
      pageFormat: 'A4_P',
    } as ConstructorParameters<typeof OpenSheetMusicDisplay>[1]);
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
    const t0 = performance.now();
    const normalized = this.normalizeXmlTitle(xmlContent);
    const t1 = performance.now();
    // A4 縦向き固定ページフォーマット（分頁モード）。pageFormat は setOptions で
    // 正しく設定する（直接プロパティ代入では OSMD が認識せず endless モードのまま）。
    // 缩放完全交给 ScoreRenderer 侧的 CSS zoom 实现，OSMD 自身 zoom 固定为 1.0
    // （容器宽度固定 794px → viewBox 恒为 794x1123，坐标缓存与缩放无关）。
    (this.osmd as unknown as { setOptions: (opts: Record<string, unknown>) => void }).setOptions({
      pageFormat: 'A4_P',
    });
    // 光标遍历不跟随反复记号（与 GraphicSheet 渲染一致，只走一遍）。
    // 否则 buildNoteIdMap 会把反复段的小节重放一遍，二次遍历时对应小节
    // 的候选音符已被消耗，导致一堆 "could not resolve a matching Note" 警告
    // （音符本身不丢，只是重复遍历 + 噪音日志 + 首次导入更慢）。
    this.osmd.EngravingRules.CursorIgnoreRepetitions = true;
    await this.osmd.load(normalized);
    const t2 = performance.now();
    this.osmd.render();
    const t3 = performance.now();
    this.recordRenderedSize();
    this.loaded = true;

    // 采集每小节的可点击判定矩形（不依赖光标遍历，缓存命中路径同样覆盖）
    this.collectMeasureRects();

    // 诊断：render 後の SVG 幅と container 幅を確認
    const svgEl = this.container.querySelector('svg') as SVGSVGElement | null;
    const vb = svgEl?.viewBox?.baseVal;
    console.log(
      `[diag] load: container.clientWidth=${this.container.clientWidth} ` +
        `container.style.width=${this.container.style.width} ` +
        `svg.width=${svgEl?.getAttribute('width') ?? 'null'} ` +
        `svg.viewBox=${vb ? `${vb.x},${vb.y} ${vb.width}x${vb.height}` : 'null'}`
    );

    console.log(
      `[perf] OSMD load: normalize=${(t1 - t0).toFixed(0)}ms osmd.load=${(t2 - t1).toFixed(0)}ms render=${(t3 - t2).toFixed(0)}ms total=${(t3 - t0).toFixed(0)}ms`
    );
  }

  /**
   * XML 内の `<work-title>` と `<credit-words>` を比較し、異なる場合は
   * work-title の値を credit-words の値へ書き換えた XML 文字列を返す。
   *
   * 背景: MuseScore 等のエディタはロケール依存のプレースホルダ
   * （例: zh-CN 環境の「未命名乐谱」）を work-title に書き込む一方で、
   * 真の曲名を credit-words に保存することがある。OSMD は work-title を
   * 優先的に描画するため、両者が不一致の場合は OSMD 描画前に work-title を
   * credit-words の値へ同期する。
   *
   * 最初の credit-words を真の曲名とみなす（credit-type の有無は問わない）。
   * どちらか片方でも欠けている場合は元の XML をそのまま返す。
   * 正規表現で処理するため、CDATA セクションや自己閉じタグには対応しない
   * （MuseScore 等の通常のエクスポート形式なら問題ない）。
   */
  private normalizeXmlTitle(xmlContent: string): string {
    const workTitleMatch = xmlContent.match(/<work-title>([^<]*)<\/work-title>/);
    const creditWordsMatch = xmlContent.match(/<credit-words[^>]*>([^<]*)<\/credit-words>/);
    if (!workTitleMatch || !creditWordsMatch) return xmlContent;

    const workTitle = workTitleMatch[1];
    const creditTitle = creditWordsMatch[1];
    if (workTitle === creditTitle) return xmlContent;

    // work-title を credit-words の値へ置換。XML 実体参照が必要な文字が
    // credit-words に含まれている場合は OSMD 側で再デコードされるため、
    // ここでは生のテキスト値をそのまま埋め込む。
    return xmlContent.replace(
      /<work-title>[^<]*<\/work-title>/,
      `<work-title>${creditTitle}</work-title>`
    );
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
   * A4 固定尺寸渲染后，窗口大小变化仅产生滚动条差异，不影响乐谱排版坐标。
   * 因此 ResizeObserver 不再触发重新渲染，避免破坏缓存数据。
   * load() 前（this.loaded=false）依然无操作。
   */
  private handleResize(): void {
    return;
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
  /**
   * iteratorIndex ごとに、buildNoteIdMap の事前走査時点での cursorElement の
   * style.cssText スナップショットを保持する（小節クリック時の光標ジャンプ高速化用）。
   * moveCursor で cursor.next()/reset() の逐次イテレーションを回避し、
   * 直接 style を復元して O(1) で光標を目的位置へ移動するために使う。
   */
  private iteratorIndexToCursorStyle = new Map<number, string>();

  moveCursor(noteId: string): void {
    if (!this.osmd.cursor || !this.loaded) return;

    if (this.osmd.cursor.Hidden) {
      this.osmd.cursor.show();
    }

    const state = this.noteIdToCursorState.get(noteId);

    // 高速パス: buildNoteIdMap で事前キャッシュした cursorElement の style.cssText を
    // 直接復元し、cursor.next()/reset() の逐次イテレーション（O(n)、倒序時はさらに
    // reset コストがかかる）を回避する。順序/逆順/大跨度いずれも O(1) でジャンプ可能。
    if (state) {
      const targetIndex = state.iteratorIndex;
      const cachedStyle = this.iteratorIndexToCursorStyle.get(targetIndex);

      if (cachedStyle !== undefined) {
        const cursorEl = (this.osmd.cursor as unknown as { cursorElement?: HTMLElement })
          .cursorElement;
        if (cursorEl) {
          // 分页模式下 cursorElement 挂在当前页面的 div#osmdCanvasPage{i} 下，坐标是
          // 「页面内坐标」。OSMD 只在 update()（next/reset 内部）通过 updateCurrentPage()
          // 跨页时把 cursorElement 移动到新页面 div 下，而高速路径不调用 next()/reset()，
          // 因此必须先手动把 cursorElement 移到目标页面的 div 下，再应用该页面的坐标样式，
          // 否则第二页之后的坐标会被错误地套用到旧页面上（跨页跳转错位 bug）。
          const targetCoord = this.noteIdToSvgCoord.get(noteId);
          if (targetCoord) {
            this.reparentCursorToPage(cursorEl, targetCoord.pageIndex ?? 0);
          }
          cursorEl.style.cssText = cachedStyle;
          this.currentIteratorIndex = targetIndex;
          this.scrollCursorIntoView();
          return;
        }
      }

      // キャッシュ未ヒット時のフォールバック: 従来どおり逐次イテレーション
      if (targetIndex < this.currentIteratorIndex) {
        this.osmd.cursor.reset();
        this.currentIteratorIndex = 0;
      }
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

    this.scrollCursorIntoView();
  }

  /**
   * 把 cursorElement 移动到目标页面的 div#osmdCanvasPage{i} 下（reparent）。
   *
   * 分页模式下 OSMD 把光标挂在「当前页面」的 div 下，跨页时由 update()
   * （next/reset 内部的 updateCurrentPage()）自动 reparent。但 moveCursor 的
   * O(1) 高速路径不调用 next()/reset()，该流程不会执行，导致新页面的坐标
   * （cssText）被套用到旧页面 div 上而错位。这里先把光标显式移动到目标页面
   * div 下，再应用坐标（跨页跳转 bug 修复）。
   *
   * pageIndex 是 getPageSvgs() 的 DOM 顺序索引（0 开始）。OSMD 的
   * div#osmdCanvasPage{i} 也按 DOM 顺序排列，因此与 querySelectorAll 的返回顺序一致。
   * 页面 div 不存在时（如测试 mock 环境）不做任何操作。
   */
  private reparentCursorToPage(cursorEl: HTMLElement, pageIndex: number): void {
    if (pageIndex < 0) return;
    const pageDivs = Array.from(
      this.container.querySelectorAll<HTMLDivElement>('div[id^="osmdCanvasPage"]')
    );
    const targetDiv = pageDivs[pageIndex];
    if (!targetDiv || cursorEl.parentElement === targetDiv) return;
    try {
      targetDiv.appendChild(cursorEl);
    } catch {
      // 没有 appendChild 的 mock 对象时跳过（防御性处理）
    }
  }

  /**
   * 光标滚动到视口内的合适位置（moveCursor 每次跳转后调用）。
   *
   * 旧实现用 cursorElement.scrollIntoView({behavior:'smooth', block:'nearest', inline:'nearest'})，
   * 播放时逐音符跳转会连续触发平滑动画（"一点一点滚动"），且光标总贴在边缘。
   * 改为自定义定位 + 直接设置 scrollLeft/scrollTop（无动画，瞬间跳到位）：
   *
   * - 水平方向（光标超出视口左右边缘时）：
   *   - 整行可整屏显示（一行五线谱宽度 ≤ 视口宽度）→ 光标定位到视口左 1/3 处
   *     （不贴边、右侧留出视野）。
   *   - 整行超过屏幕长度（一行五线谱宽度 > 视口宽度）→ 光标定位到屏幕最右边
   *     （左侧已演奏内容可见最大化）。
   * - 垂直方向（光标超出视口上下边缘时）→ 光标定位到视口上 1/4 处。
   *
   * 判断「整行是否超屏」用光标所在页（A4 纸，含 zoom 的实际显示宽度）与视口宽度
   * 近似比较（一行五线谱宽 ≈ 页内容宽 < 页宽）。测试 mock 等 closest 不可用或
   * 找不到滚动容器时，回退到无动画的 scrollIntoView。
   */
  private scrollCursorIntoView(): void {
    try {
      const cursorEl = (this.osmd.cursor as unknown as { cursorElement?: HTMLElement })
        ?.cursorElement;
      if (!cursorEl || typeof cursorEl.getBoundingClientRect !== 'function') return;

      const el = cursorEl as Element;
      const scrollContainer =
        typeof el.closest === 'function'
          ? (el.closest('div[data-testid="score-scroll-container"]') as HTMLElement | null)
          : null;

      // 无滚动容器（测试 mock 等）时回退到旧逻辑（无动画）
      if (!scrollContainer) {
        if (typeof cursorEl.scrollIntoView === 'function') {
          cursorEl.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
        }
        return;
      }

      const cursorRect = cursorEl.getBoundingClientRect();
      const scrollerRect = scrollContainer.getBoundingClientRect();

      // 光标所在页（A4 纸）的实际显示宽度（含 zoom）。整行宽度用页宽近似。
      let pageWidth = 0;
      if (typeof el.closest === 'function') {
        const pageEl = el.closest('div[id^="osmdCanvasPage"]') as HTMLElement | null;
        pageWidth = pageEl?.getBoundingClientRect().width ?? 0;
      }
      const lineWiderThanViewport = pageWidth > scrollerRect.width;

      // 水平方向：光标超出视口时直接定位（无动画）
      if (cursorRect.right > scrollerRect.right || cursorRect.left < scrollerRect.left) {
        let targetLeft: number;
        if (lineWiderThanViewport) {
          // 整行超屏：光标定位到屏幕最右边（左侧已演奏内容可见最大化）
          targetLeft = scrollerRect.right - cursorRect.width - SCROLL_EDGE_MARGIN_PX;
        } else {
          // 整行可整屏显示：光标定位到视口左 1/3 处
          targetLeft = scrollerRect.left + scrollerRect.width / 3;
        }
        scrollContainer.scrollLeft += cursorRect.left - targetLeft;
      }

      // 垂直方向：光标超出视口时定位到视口上 1/4 处
      if (cursorRect.bottom > scrollerRect.bottom || cursorRect.top < scrollerRect.top) {
        const targetTop = scrollerRect.top + scrollerRect.height / 4;
        scrollContainer.scrollTop += cursorRect.top - targetTop;
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
    // 分頁化後はページごとにレイヤーが存在するため全て除去する
    this.container.querySelectorAll('[id^="loop-bracket-layer"]').forEach((el) => el.remove());
  }

  private renderLoopBracketLayer(): void {
    // 分頁化後はページごとに独立した SVG へ矩形を描画するため、全ページのレイヤーを消す
    this.container.querySelectorAll('[id^="loop-bracket-layer"]').forEach((el) => el.remove());
    if (!this.lastLoopRange) return;

    const { start: startMeasure, end: endMeasure } = this.lastLoopRange;
    if (!Number.isFinite(startMeasure) || !Number.isFinite(endMeasure)) return;
    if (startMeasure > endMeasure) return;

    // 範囲内の音符座標をページごとにグルーピング（座標はページ内 viewBox 単位のため）
    const coordsByPage = new Map<number, Array<{ x: number; y: number }>>();
    for (const [noteId, coord] of this.noteIdToSvgCoord.entries()) {
      const match = noteId.match(/-M(\d+)-/);
      if (!match) continue;
      const measureNumber = parseInt(match[1], 10);
      if (measureNumber >= startMeasure && measureNumber <= endMeasure) {
        const pageIndex = coord.pageIndex ?? 0;
        const list = coordsByPage.get(pageIndex) ?? [];
        list.push({ x: coord.x, y: coord.y });
        coordsByPage.set(pageIndex, list);
      }
    }

    if (coordsByPage.size === 0) return;

    const svgs = this.getPageSvgs();
    const margin = { x: 12, yTop: 24, yBottom: 12 };
    for (const [pageIndex, coords] of coordsByPage.entries()) {
      const svg = svgs[pageIndex];
      if (!svg) continue;

      const minX = Math.min(...coords.map((c) => c.x)) - margin.x;
      const maxX = Math.max(...coords.map((c) => c.x)) + margin.x;
      const minY = Math.min(...coords.map((c) => c.y)) - margin.yTop;
      const maxY = Math.max(...coords.map((c) => c.y)) + margin.yBottom;

      const layer = document.createElementNS(SVG_NS, 'g');
      layer.setAttribute('id', `loop-bracket-layer-${pageIndex}`);

      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', String(minX));
      rect.setAttribute('y', String(minY));
      rect.setAttribute('width', String(Math.max(0, maxX - minX)));
      rect.setAttribute('height', String(Math.max(0, maxY - minY)));
      rect.setAttribute('fill', 'rgba(24, 24, 27, 0.06)');
      rect.setAttribute('stroke', '#18181b');
      rect.setAttribute('stroke-width', '2');
      rect.setAttribute('stroke-dasharray', '6,3');
      rect.setAttribute('pointer-events', 'none');
      layer.appendChild(rect);

      // ループ範囲の矩形は音符の描画より手前（後の兄弟要素）にならないよう、
      // SVGの最初の子として挿入し、音符・カーソルの視認性を妨げないようにする。
      svg.insertBefore(layer, svg.firstChild);
    }
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
    // 分頁化後はページごとに独立した SVG へ描画するため、全ページのレイヤーを消す
    this.container.querySelectorAll('[id^="note-highlight-layer"]').forEach((el) => el.remove());
    if (this.noteHighlights.size === 0) return;

    // 座標はページ内 viewBox 単位なので、ページごとにグループ化して描画する
    const byPage = new Map<number, Array<{ noteId: string; color: 'correct' | 'incorrect' }>>();
    for (const [noteId, color] of this.noteHighlights.entries()) {
      const coord = this.noteIdToSvgCoord.get(noteId);
      if (!coord) continue;
      const pageIndex = coord.pageIndex ?? 0;
      const list = byPage.get(pageIndex) ?? [];
      list.push({ noteId, color });
      byPage.set(pageIndex, list);
    }

    const svgs = this.getPageSvgs();
    for (const [pageIndex, items] of byPage.entries()) {
      const svg = svgs[pageIndex];
      if (!svg) continue;

      const layer = document.createElementNS(SVG_NS, 'g');
      layer.setAttribute('id', `note-highlight-layer-${pageIndex}`);

      for (const { noteId, color } of items) {
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

  /**
   * 开关指法编辑模式。开启后乐谱上的指法数字变为可点击（pointer-events: auto），
   * 点击数字触发 onFingeringClick（不触发小节跳转）；关闭后数字恢复不可点击。
   * 切换时重画指法层，让已有数字的 pointer-events 立即生效。
   */
  setFingeringEditMode(edit: boolean): void {
    if (this.fingeringEditMode === edit) return;
    this.fingeringEditMode = edit;
    this.renderFingeringLayer();
  }

  /**
   * 编辑模式下点击指法数字时的回调（App 侧弹出数字选择条）。
   * 传入 null 解除注册。
   */
  setOnFingeringClick(
    callback: ((noteId: string, screenX: number, screenY: number) => void) | null
  ): void {
    this.onFingeringClickCallback = callback;
  }

  /**
   * 抑制紧接着触发的下一次 click（拖动乐谱后调用）。
   *
   * 浏览器在 mouseup 之后会派发 click，因此 ScoreRenderer 的 pan 拖动一旦激活
   * （移动超过阈值）就调用本方法，让 handleContainerClick 吞掉这个伪 click，
   * 不触发小节跳转。时间窗口形式（而非永久标志）保证：鼠标在窗口外松开等
   * click 未触发的边界情况下，抑制标志会在 SUPPRESS_CLICK_MS 后自动过期，
   * 不会吞掉之后真正的点击。
   */
  suppressNextClick(): void {
    this.suppressClickUntil = Date.now() + SUPPRESS_CLICK_MS;
  }

  private handleContainerClick = (event: MouseEvent): void => {
    // 拖动乐谱后的伪 click（浏览器在 mouseup 后派发）：消费抑制标志后直接返回，
    // 不触发小节跳转。标志在本次消费时置 0，保证随后的正常点击不受影响。
    if (Date.now() < this.suppressClickUntil) {
      this.suppressClickUntil = 0;
      return;
    }

    // 指法编辑模式：点击指法数字（带 data-note-id 的元素）时不触发小节跳转，
    // 而是把 noteId 与屏幕坐标回传给调用方（App 侧弹出数字选择条）。
    if (this.fingeringEditMode && this.onFingeringClickCallback) {
      const target = event.target as Element | null;
      const noteId =
        typeof target?.closest === 'function'
          ? (target.closest('[data-note-id]')?.getAttribute('data-note-id') ?? null)
          : null;
      if (noteId) {
        this.onFingeringClickCallback(noteId, event.clientX, event.clientY);
        return;
      }
    }

    if (!this.onMeasureClickCallback) return;
    const svgPoint = this.screenToSvgCoord(event.clientX, event.clientY);
    if (!svgPoint) return;

    // 优先用小节判定矩形做命中测试（限定在「小节左右边界 × 上下线」内，空白区域不触发）。
    // 矩形未采集（异常/兜底）时回退到旧的「最近音符」判定，保证功能不失效。
    let measureNumber: number | null = null;
    if (this.measureNumberToRect.size > 0) {
      measureNumber = this.findMeasureAtPoint(svgPoint);
    } else {
      const noteId = this.findNearestNoteId(svgPoint);
      const match = noteId?.match(/-M(\d+)-/);
      measureNumber = match ? parseInt(match[1], 10) : null;
    }
    if (measureNumber === null) return;

    this.onMeasureClickCallback(measureNumber);
  };

  /**
   * 从 OSMD 的 GraphicSheet 采集每个小节的「可点击判定矩形」。
   *
   * 范围 = 小节左右边界（PositionAndShape 的 x/width）× 五线谱最上线～最下线。
   * OSMD 内部单位与 viewBox 的换算为 ×10。pageIndex 取 MusicPages 的 DOM 顺序索引。
   *
   * 每个 staff 单独存一个矩形（gmRow 的一个元素对应一个 staff）：
   * - OSMD 的谱线位于 `StaffLines[i].PositionAndShape.RelativePosition.y`，
   *   顶线 = 0、底线 = StaffHeight（= 顶线到底线的完整高度）。因此
   *   bottom = abs.y + lastLine.relY 即底线位置，**不能再叠加 StaffHeight**
   *   （否则向下多延伸一个谱表高度、侵入下方空白——之前低音谱点不动、
   *   间隙反而可点的 bug 根因）。
   * - 双谱表之间有空隙，合并成一个大矩形会把间隙纳入判定，因此按 staff 分开存。
   * 在 load() 渲染完成后调用一次即可；不依赖光标遍历，缓存命中路径同样覆盖。
   */
  private collectMeasureRects(): void {
    this.measureNumberToRect.clear();
    try {
      const gsheet = (this.osmd as unknown as {
        GraphicSheet?: {
          MusicPages?: Array<{
            MusicSystems?: Array<{ graphicalMeasures?: OsmdGraphicalMeasure[][] }>;
          }>;
        };
      }).GraphicSheet;
      const pages = gsheet?.MusicPages ?? [];
      pages.forEach((page, pageIndex) => {
        const systems = page.MusicSystems ?? [];
        for (const system of systems) {
          const measureRows = system.graphicalMeasures ?? [];
          for (const gmRow of measureRows) {
            // gmRow[staffIndex] = 该小节在某个 staff 的 GraphicalMeasure。
            if (!gmRow || gmRow.length === 0) continue;
            const measureNumber = gmRow[0]?.MeasureNumber;
            // typeof 检查先排除 undefined，再校验整数（Number.isInteger 的守卫
            // 在部分 TS 配置下不缩小 undefined，因此显式分开判断）
            if (typeof measureNumber !== 'number' || !Number.isInteger(measureNumber)) continue;

            const rects: Array<{ x: number; y: number; width: number; height: number; pageIndex: number }> = [];
            for (const gm of gmRow) {
              const pas = gm?.PositionAndShape;
              const abs = pas?.AbsolutePosition;
              const size = pas?.Size;
              if (!abs || !size || size.width <= 0) continue;
              const staffLines = gm.StaffLines ?? [];
              if (staffLines.length >= 2) {
                // 谱线相对小节顶部的偏移：顶线=0、底线=StaffHeight（内部单位）
                const firstLine = staffLines[0];
                const lastLine = staffLines[staffLines.length - 1];
                const top = abs.y + (firstLine?.PositionAndShape?.RelativePosition?.y ?? 0);
                const bottom = abs.y + (lastLine?.PositionAndShape?.RelativePosition?.y ?? 0);
                rects.push({
                  x: abs.x * 10,
                  y: top * 10,
                  width: Math.max(0, size.width * 10),
                  height: Math.max(0, (bottom - top) * 10),
                  pageIndex,
                });
              } else if (size.height > 0) {
                // 兜底：无谱线数据时退回 Size.height（OSMD 中 BorderBottom=StaffHeight，即谱表高度）
                rects.push({
                  x: abs.x * 10,
                  y: abs.y * 10,
                  width: Math.max(0, size.width * 10),
                  height: size.height * 10,
                  pageIndex,
                });
              }
            }
            if (rects.length === 0) continue;
            this.measureNumberToRect.set(measureNumber, rects);
          }
        }
      });
      // 诊断：只打印前 5 个小节的矩形明细，方便核对高低音谱判定范围
      const sample = Array.from(this.measureNumberToRect.entries()).slice(0, 5);
      console.log(
        `[diag] collectMeasureRects: measures=${this.measureNumberToRect.size} pages=${pages.length} ` +
          `sample=${JSON.stringify(sample.map(([m, rects]) => ({ m, rects })))}`
      );
    } catch (e) {
      console.warn('[OSMDController] collectMeasureRects failed:', e);
    }
  }

  /**
   * 点击命中测试：点在某个小节的任一 staff 判定矩形内（同页）时返回该小节号，
   * 否则返回 null。多个矩形重叠（理论罕见）时取面积最小者（最精确）。
   */
  private findMeasureAtPoint(point: { x: number; y: number; pageIndex: number }): number | null {
    let hit: { measure: number; area: number } | null = null;
    for (const [measureNumber, rects] of this.measureNumberToRect.entries()) {
      for (const rect of rects) {
        if (rect.pageIndex !== point.pageIndex) continue;
        if (
          point.x >= rect.x &&
          point.x <= rect.x + rect.width &&
          point.y >= rect.y &&
          point.y <= rect.y + rect.height
        ) {
          const area = rect.width * rect.height;
          if (!hit || area < hit.area) {
            hit = { measure: measureNumber, area };
          }
        }
      }
    }
    return hit?.measure ?? null;
  }

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

  /**
   * 分頁モードで OSMD が生成するページ SVG 群を DOM 順（＝ページ順）で返す。
   * endless モードの場合は1件だけ返る。オーバーレイ描画・座標変換の共通基盤。
   */
  private getPageSvgs(): SVGSVGElement[] {
    return Array.from(this.container.querySelectorAll('svg'));
  }

  /**
   * クリック位置（画面座標）を含むページ SVG を特定する。
   * ページごとに独立した SVG が縦に並ぶため、必ず「点を含む SVG」を探す。
   */
  private getSvgForPoint(clientX: number, clientY: number): SVGSVGElement | null {
    for (const svg of this.getPageSvgs()) {
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0) continue;
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        return svg;
      }
    }
    return null;
  }

  /**
   * カーソル要素が属するページ SVG を特定する。
   * OSMD はカーソルが別ページへ進むと cursorElement を該当ページの
   * div#osmdCanvasPage{i} 配下へ移動（reparent）する。cursorElement は SVG 内に
   * いる場合もあればページ div 直下（SVG の兄弟）の場合もあるため、両方に対応する。
   * テスト用モック等で closest が使えない場合は null（座標サンプリング不可）。
   */
  private resolveCursorSvg(): SVGSVGElement | null {
    const cursorEl = (this.osmd.cursor as unknown as { cursorElement?: HTMLElement })?.cursorElement;
    const pageSvgs = this.getPageSvgs();
    // テスト用モック等で closest が使えない場合は、単一 SVG 前提で先頭ページへフォールバックする。
    if (!cursorEl || typeof (cursorEl as Element).closest !== 'function') {
      return pageSvgs[0] ?? null;
    }
    const el = cursorEl as Element;
    const directSvg = el.closest('svg') as SVGSVGElement | null;
    if (directSvg) return directSvg;
    const pageDiv = el.closest('div[id^="osmdCanvasPage"]');
    if (pageDiv) return pageDiv.querySelector('svg') as SVGSVGElement | null;
    return pageSvgs[0] ?? null;
  }

  private screenToSvgCoord(clientX: number, clientY: number): { x: number; y: number; pageIndex: number } | null {
    const svgs = this.getPageSvgs();
    const svg = this.getSvgForPoint(clientX, clientY);
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
          pageIndex: svgs.indexOf(svg),
        };
      }
      return { x: clientX - svgRect.left, y: clientY - svgRect.top, pageIndex: svgs.indexOf(svg) };
    } catch {
      return null;
    }
  }

  private findNearestNoteId(point: { x: number; y: number; pageIndex: number }): string | null {
    let nearestId: string | null = null;
    let nearestDistSq = Infinity;

    // ページ内座標で保持しているため、クリックされたページと同じページの音符だけを比較する。
    for (const [noteId, coord] of this.noteIdToSvgCoord.entries()) {
      if (coord.pageIndex !== point.pageIndex) continue;
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

  /**
   * カーソル要素の画面座標を、そのカーソルが属するページ SVG の viewBox 座標系へ変換する。
   *
   * 分頁モードではページごとに独立した SVG があるため、svgRect を単一で使い回せない。
   * buildNoteIdMap 側で「ページ SVG → その getBoundingClientRect」のキャッシュ（svgRects）を
   * 用意し、カーソルが属するページの rect だけを参照する（layout thrashing 抑制）。
   *
   * 戻り値の x/y/height は「そのページの viewBox 内座標」で、pageIndex は
   * getPageSvgs() の DOM 順インデックス。オーバーレイはこの pageIndex のページ SVG に描画する。
   */
  private getCursorSvgCoord(
    svgRects?: Map<SVGSVGElement, DOMRect>
  ): { x: number; y: number; height: number; pageIndex: number } | null {
    const svg = this.resolveCursorSvg();
    // cursorElement is an internal OSMD property not exposed in the public type definitions
    const cursorEl = (this.osmd.cursor as unknown as { cursorElement?: HTMLElement })
      ?.cursorElement;
    if (!svg || !cursorEl) return null;
    try {
      // svgRect は buildNoteIdMap のループ外で1回だけ取得して使い回す（layout thrashing 抑制）
      const svgRectFinal = svgRects?.get(svg) ?? svg.getBoundingClientRect();
      const cursorRect = cursorEl.getBoundingClientRect();
      if (svgRectFinal.width === 0) return null;

      // Convert screen coords to SVG internal coords via viewBox ratio.
      // height はカーソル矩形（両段をまたぐ縦線）のSVG単位での高さで、
      // 下段（左手）の指番号をカーソル下端の下へ配置するために使う。
      const vb = svg.viewBox.baseVal;
      if (vb && vb.width > 0) {
        const scaleX = vb.width / svgRectFinal.width;
        const scaleY = vb.height / svgRectFinal.height;
        return {
          x: (cursorRect.left - svgRectFinal.left + cursorRect.width / 2) * scaleX + vb.x,
          y: (cursorRect.top - svgRectFinal.top) * scaleY + vb.y,
          height: cursorRect.height * scaleY,
          pageIndex: this.getPageSvgs().indexOf(svg),
        };
      }
      // Fallback when no viewBox
      return {
        x: cursorRect.left - svgRectFinal.left + cursorRect.width / 2,
        y: cursorRect.top - svgRectFinal.top,
        height: cursorRect.height,
        pageIndex: this.getPageSvgs().indexOf(svg),
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
    // 分頁化後はページごとに独立した SVG へ描画するため、全ページのレイヤーを消す
    this.container.querySelectorAll('[id^="fingering-layer"]').forEach((el) => el.remove());
    if (this.lastFingeringAssignments.length === 0) return;

    // 座標はページ内 viewBox 単位なので、ページごとにグループ化して描画する
    const itemsByPage = new Map<number, Array<{ noteId: string; finger: number; isApproved: boolean }>>();
    for (const assignment of this.lastFingeringAssignments) {
      const coord = this.noteIdToSvgCoord.get(assignment.noteId);
      if (!coord) continue;
      const pageIndex = coord.pageIndex ?? 0;
      const list = itemsByPage.get(pageIndex) ?? [];
      list.push(assignment);
      itemsByPage.set(pageIndex, list);
    }

    const svgs = this.getPageSvgs();
    for (const [pageIndex, items] of itemsByPage.entries()) {
      const svg = svgs[pageIndex];
      if (!svg) continue;

      const layer = document.createElementNS(SVG_NS, 'g');
      layer.setAttribute('id', `fingering-layer-${pageIndex}`);

      for (const { noteId, finger, isApproved } of items) {
        const coord = this.noteIdToSvgCoord.get(noteId);
        if (!coord) continue;
        const text = document.createElementNS(SVG_NS, 'text');
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
        // 提案中（未承認）: 中灰 / 承認済み: 深緑（状態を色相で区別）
        text.setAttribute('fill', isApproved ? '#15803d' : '#52525b');
        // data-note-id：指法编辑模式下点击数字时反查 noteId（O(1)，无需额外映射）。
        // pointer-events 按编辑模式切换：平时 none（不拦截小节点击），编辑模式 auto。
        text.setAttribute('data-note-id', noteId);
        text.setAttribute('pointer-events', this.fingeringEditMode ? 'auto' : 'none');
        text.textContent = String(finger);
        layer.appendChild(text);
      }

      svg.appendChild(layer);
    }
  }

  clearFingerings(): void {
    this.lastFingeringAssignments = [];
    this.container.querySelectorAll('[id^="fingering-layer"]').forEach((el) => el.remove());
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
    const _t0 = performance.now();
    this.lastScore = score;
    this.noteIdToCursorState.clear();
    this.noteIdToSvgCoord.clear();
    this.noteIdToGraphicalNote.clear();
    // 光標スタイルキャッシュも再構築のたびにクリアする（render 前後で座標が変わるため）
    this.iteratorIndexToCursorStyle.clear();
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

    // 7連音などのタプレットで時間マッチ（TICK_MATCH_TOLERANCE）に失敗した
    // OSMDエントリを小節ごとに記録する（TASK-補完）。時間マッチはtickの「一致」を
    // 要求するため、累積丸め誤差で全滅した小節が生じる。兜底フェーズで
    // この記録を使って「順序」ベースの1:1対応付けを行う。
    // key: measureNumber, value: その小節で時間マッチに失敗したエントリ（cursor順）
    const failedOsmdByMeasure = new Map<
      number,
      Array<{
        iteratorIndex: number;
        coord: { x: number; y: number; height: number; pageIndex: number } | null;
        entry: OsmdNoteEntry;
        ref: OsmdCursorNote;
        graphicalNotes: GraphicalNote[];
      }>
    >();

    // 各 iteratorIndex での cursorElement.style.cssText をキャッシュする。
    // cursor.next() が DOM を更新した直後にサンプリングすることで、
    // moveCursor 時に O(1) で同じ見た目へ復元できる。
    const cursorElForSampling = (this.osmd.cursor as unknown as { cursorElement?: HTMLElement })
      .cursorElement;

    // svgRect はページごとに異なる（分頁モード）。ページ数は少ないため全ページの
    // rect を1回だけ取得してキャッシュし、ループ中はカーソルが属するページの
    // rect のみを参照する（layout thrashing 抑制）。
    const svgRects = new Map<SVGSVGElement, DOMRect>();
    for (const svgEl of this.getPageSvgs()) {
      svgRects.set(svgEl, svgEl.getBoundingClientRect());
    }
    console.log(
      `[diag] buildNoteIdMap: pageSvgs=${svgRects.size} ` +
        `container.clientWidth=${this.container.clientWidth}`
    );

    while (!this.osmd.cursor.Iterator.EndReached) {
      const coord = this.getCursorSvgCoord(svgRects);
      const measureIndex = this.osmd.cursor.Iterator.CurrentMeasureIndex;
      const measureNumber = measureIndex + 1;
      const voiceEntries = this.osmd.cursor.Iterator.CurrentVoiceEntries;

      // cursorElement の現在のスタイルをキャッシュ（位置/サイズ変換含む）。
      // next() 呼び出し前の状態 = 現在の iteratorIndex に対応する見た目。
      if (cursorElForSampling) {
        this.iteratorIndexToCursorStyle.set(iteratorIndex, cursorElForSampling.style.cssText);
      }

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
              // 時間マッチ失敗。警告は出さず、兜底フェーズで「順序」ベースの
              // 1:1対応付けを試みる（7連音などでの累積誤差対策）。
              // ここで記録する情報は兜底フェーズで必要となる。
              const list = failedOsmdByMeasure.get(measureNumber) ?? [];
              list.push({
                iteratorIndex,
                coord,
                entry,
                ref: osmdNoteRefs[i],
                graphicalNotes: graphicalNotesUnderCursor,
              });
              failedOsmdByMeasure.set(measureNumber, list);
              return;
            }
            this.noteIdToCursorState.set(matchedNote.id, { iteratorIndex });
            const fingeringCoord = fingeringCoords.get(matchedNote.id);
            if (fingeringCoord && coord) {
              // ページ内座標 + ページ番号を一緒に保持（分頁化 v2）
              this.noteIdToSvgCoord.set(matchedNote.id, {
                ...fingeringCoord,
                pageIndex: coord.pageIndex,
              });
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

    // === 兜底フェーズ（順序ベースの1:1対応付け） ===
    // 時間マッチで失敗したOSMDエントリを、同じ小節の未消費candidate（パーサ側Note）と
    // 「tick昇順」で整列し、順番どおり1:1で対応付ける。
    // 7連音などではOSMD側absoluteTickとパーサ側startTickに累積丸め誤差が生じ、
    // 絶対値がずれても「順序」は保たれるため、tickの一致を要求せず順序のみで対応付け可能。
    // 小節ごとに処理するのは、別小節の音符と誤対応させないため。
    let fallbackPaired = 0;
    for (const [measureNumber, failedEntries] of failedOsmdByMeasure) {
      const candidates = remainingNotesByMeasure.get(measureNumber);
      // 兜底対象のcandidateが無い小節は、failedエントリ全てを警告（従来のskip警告の代替）
      if (!candidates || candidates.length === 0) {
        for (const failed of failedEntries) {
          const e = failed.entry;
          console.warn(
            '[OSMDController] buildNoteIdMap: could not resolve a matching Note ' +
              `(measure=${measureNumber}, tick=${e.absoluteTick}, ` +
              `isRest=${e.isRest}, midiNumber=${e.midiNumber}, staff=${e.staff}); skipping.`
          );
        }
        continue;
      }

      // NaN tick は末尾に寄せる安全なソートキー
      const sortKey = (t: number): number => (Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER);
      const sortedOsmd = [...failedEntries].sort(
        (a, b) => sortKey(a.entry.absoluteTick) - sortKey(b.entry.absoluteTick)
      );
      const sortedCandidates = [...candidates].sort(
        (a, b) =>
          sortKey(a.startTick) - sortKey(b.startTick) ||
          (a.staff ?? 1) - (b.staff ?? 1) ||
          a.noteIndex - b.noteIndex
      );

      const pairCount = Math.min(sortedOsmd.length, sortedCandidates.length);
      for (let i = 0; i < pairCount; i++) {
        const failed = sortedOsmd[i];
        const candidate = sortedCandidates[i];
        this.noteIdToCursorState.set(candidate.id, { iteratorIndex: failed.iteratorIndex });
        // 運指座標：このiteratorIndexのカーソル位置を基準に計算（既存computeFingeringCoordsを再利用）
        if (failed.coord) {
          const coords = computeFingeringCoords([candidate], failed.coord);
          const c = coords.get(candidate.id);
          if (c) {
            this.noteIdToSvgCoord.set(candidate.id, {
              ...c,
              pageIndex: failed.coord.pageIndex,
            });
          }
        }
        // グレーアウト対象SVG要素（同一iteratorIndexのGNotesUnderCursorから参照一致で引き当てる）
        const graphicalNote = failed.graphicalNotes.find((gn) => gn.sourceNote === failed.ref);
        if (graphicalNote) {
          this.noteIdToGraphicalNote.set(candidate.id, graphicalNote);
        }
        fallbackPaired++;
      }

      // 対応付けに使ったcandidateは残候補から除去（同一小節内での二重割り当て防止）
      for (let i = 0; i < pairCount; i++) {
        const idx = candidates.indexOf(sortedCandidates[i]);
        if (idx >= 0) candidates.splice(idx, 1);
      }

      // まだ対応付けられなかったOSMDエントリがあれば警告（従来のskip警告の代替）
      for (let i = pairCount; i < sortedOsmd.length; i++) {
        const e = sortedOsmd[i].entry;
        console.warn(
          '[OSMDController] buildNoteIdMap: could not resolve a matching Note ' +
            `(measure=${measureNumber}, tick=${e.absoluteTick}, ` +
            `isRest=${e.isRest}, midiNumber=${e.midiNumber}, staff=${e.staff}); skipping.`
        );
      }
    }
    if (fallbackPaired > 0) {
      console.log(
        `[perf] buildNoteIdMap: order-based fallback paired ${fallbackPaired} notes ` +
          `across ${failedOsmdByMeasure.size} measures`
      );
    }

    this.osmd.cursor.reset();
    this.currentIteratorIndex = 0;

    // Restore cursor visibility
    if (wasHidden) this.osmd.cursor.hide();

    const _t1 = performance.now();
    console.log(
      `[perf] buildNoteIdMap: iterations=${iteratorIndex} total=${(_t1 - _t0).toFixed(0)}ms`
    );
    return this.noteIdToCursorState;
  }

  /**
   * 永続化キャッシュから noteId マップ群を復元する。cursor 遍历をスキップして O(1)
   * で復元できる。バージョン不一致や非ロード状態の場合は false を返す。
   *
   * zoomBase 一致チェック：iteratorIndexToCursorStyle は「当時の描画画素」で
   * 生成されているため、ズーム値が異なる場合はこのマップだけ採用をスキップ。
   * viewBox 座標系の noteIdToCursorState / noteIdToSvgCoord は常に採用可能。
   *
   * グレーアウト（renderGrayoutLayer）が使う noteIdToGraphicalNote は「オブジェクト
   * 参照」を格納するためシリアライズできないが、rebuildGrayoutNoteMap が
   * GraphicSheet を直接走査して再構築する（cursor.next() の逐次移動を伴わないため
   * ミリ秒級。applyCache 成功時に呼び出す）。
   *
   * @param currentZoom 現在の OSMD 側ズーム。分頁モードでは osmd.zoom が実際のズーム値。
   */
  applyCache(score: Score, cache: ScoreMapCache, currentZoom?: number): boolean {
    if (!this.loaded || !this.osmd.cursor) return false;
    // v2: 分頁化で noteIdToSvgCoord に pageIndex が追加されたため、旧バージョンは不採用
    if (cache.version !== 2 || cache.pageFormat !== 'A4_P') return false;

    this.lastScore = score;
    this.noteIdToCursorState.clear();
    this.noteIdToSvgCoord.clear();
    this.noteIdToGraphicalNote.clear();
    this.iteratorIndexToCursorStyle.clear();

    for (const [noteId, state] of Object.entries(cache.noteIdToCursorState)) {
      this.noteIdToCursorState.set(noteId, state);
    }
    for (const [noteId, coord] of Object.entries(cache.noteIdToSvgCoord)) {
      this.noteIdToSvgCoord.set(noteId, coord);
    }
    // zoom 不一致時は cursorStyle を捨てる。O(1) ジャンプは効かなくなるが、
    // iteratorIndex だけでも moveCursor は O(n) ながら目的地へ到達できる。
    // 既定値は現在の OSMD zoom（分頁モードでは osmd.zoom が実際のズームを担う）。
    const actualZoom = currentZoom ?? (this.osmd as unknown as { zoom: number }).zoom;
    const cursorStylesMatch = Math.abs((cache.zoomBase ?? 1.0) - actualZoom) < 1e-6;
    if (cursorStylesMatch) {
      for (const [idxStr, style] of Object.entries(cache.iteratorIndexToCursorStyle)) {
        const idx = Number(idxStr);
        if (!Number.isNaN(idx)) {
          this.iteratorIndexToCursorStyle.set(idx, style);
        }
      }
    }

    console.log(
      `[perf] applyCache: noteIdToCursorState=${this.noteIdToCursorState.size} ` +
        `noteIdToSvgCoord=${this.noteIdToSvgCoord.size} ` +
        `iteratorIndexToCursorStyle=${this.iteratorIndexToCursorStyle.size} ` +
        `(cursorStylesMatch=${cursorStylesMatch} cache.zoomBase=${cache.zoomBase} current=${currentZoom})`
    );

    // グレーアウト用の noteId→GraphicalNote を GraphicSheet から再構築する
    // （GraphicalNote はオブジェクト参照のためキャッシュ不能。cursor 非依存の
    // 直接走査でミリ秒級に済む。buildNoteIdMap 完了済みの経路では既に構築済み）。
    this.rebuildGrayoutNoteMap(score);
    return true;
  }

  /**
   * 缓存命中（applyCache）后重建 noteIdToGraphicalNote（灰化用の noteId→SVG 元素）。
   *
   * GraphicalNote 是对象引用无法序列化，但 renderGrayoutLayer 只依赖它。与
   * collectMeasureRects 相同，直接遍历 GraphicSheet（MusicPages → MusicSystems →
   * graphicalMeasures → staffEntries → graphicalVoiceEntries.notes），不经过
   * cursor.next() 逐音符推进（那正是 buildNoteIdMap 十几秒的瓶颈），因此是毫秒级。
   *
   * 每个 GraphicalStaffEntry 是同一时间戳的垂直音符组（与 buildNoteIdMap 的
   * cursor 一步对应），因此可复用 describeOsmdNote + matchNotesForTimestamp 的
   * 既有照合逻辑，把 GraphicalNote.sourceNote 对应到 parser noteId。
   * 匹配不上（tick 累积误差等）的音符静默跳过，其余正常灰化（尽力而为）。
   */
  private rebuildGrayoutNoteMap(score: Score): void {
    this.noteIdToGraphicalNote.clear();
    if (!this.loaded) return;

    try {
      const gsheet = (this.osmd as unknown as {
        GraphicSheet?: {
          MusicPages?: Array<{
            MusicSystems?: Array<{ graphicalMeasures?: OsmdGraphicalMeasureNotes[][] }>;
          }>;
        };
      }).GraphicSheet;

      // 与 buildNoteIdMap 相同的「未消费 candidate 按小节分组」。
      // 匹配成功后从候选移除，避免同一音符被重复分配。
      const remainingNotesByMeasure = new Map<number, Note[]>();
      for (const measure of score.measures) {
        remainingNotesByMeasure.set(measure.number, [...measure.notes]);
      }

      let rebuilt = 0;
      const pages = gsheet?.MusicPages ?? [];
      for (const page of pages) {
        for (const system of page.MusicSystems ?? []) {
          const measureRows = system.graphicalMeasures ?? [];
          for (const gmRow of measureRows) {
            for (const gm of gmRow) {
              if (!gm) continue;
              const measureNumber = gm.MeasureNumber;
              if (typeof measureNumber !== 'number' || !Number.isInteger(measureNumber)) continue;
              const candidates = remainingNotesByMeasure.get(measureNumber);
              if (!candidates || candidates.length === 0) continue;

              for (const gse of gm.staffEntries ?? []) {
                const osmdEntries: OsmdNoteEntry[] = [];
                const graphicalNotes: Array<{ sourceNote?: OsmdCursorNote }> = [];
                for (const gve of gse.graphicalVoiceEntries ?? []) {
                  for (const gn of gve.notes ?? []) {
                    if (!gn.sourceNote) continue;
                    osmdEntries.push(this.describeOsmdNote(gn.sourceNote, score.ticksPerQuarter));
                    graphicalNotes.push(gn);
                  }
                }
                if (osmdEntries.length === 0) continue;

                const matched = this.matchNotesForTimestamp(osmdEntries, candidates);
                matched.forEach((note, i) => {
                  if (!note) return;
                  // 运行时是真实 GraphicalNote 实例（duck typing），仅做类型断言
                  this.noteIdToGraphicalNote.set(
                    note.id,
                    graphicalNotes[i] as unknown as GraphicalNote
                  );
                  rebuilt++;
                  const idx = candidates.indexOf(note);
                  if (idx >= 0) candidates.splice(idx, 1);
                });
              }
            }
          }
        }
      }
      console.log(`[perf] rebuildGrayoutNoteMap: rebuilt ${rebuilt} notes (cache-hit path)`);
    } catch (e) {
      console.warn('[OSMDController] rebuildGrayoutNoteMap failed:', e);
    }
  }

  /**
   * 現在のメモリ内マップ群を ScoreMapCache へシリアライズする。
   * buildNoteIdMap 未実行（noteIdToCursorState が空）の場合は null を返す。
   *
   * @param currentZoom 現在の OSMD 内部 zoom 値。分頁モードでは osmd.zoom が実際のズーム値。
   */
  serializeCache(currentZoom = 1.0): ScoreMapCache | null {
    if (this.noteIdToCursorState.size === 0) return null;
    return {
      version: 2,
      pageFormat: 'A4_P',
      zoomBase: currentZoom,
      noteIdToCursorState: Object.fromEntries(this.noteIdToCursorState),
      noteIdToSvgCoord: Object.fromEntries(this.noteIdToSvgCoord),
      iteratorIndexToCursorStyle: Object.fromEntries(this.iteratorIndexToCursorStyle),
    };
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
