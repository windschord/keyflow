import React, { useEffect, useRef, useState } from 'react';
import { Score, PracticeMode, Note, Annotation, Hand } from '../../types';
import type { ScoreLayout } from '../../types/score-layout';
import {
  OSMDController,
  ScoreMapCache,
  SCOREMAP_CACHE_SUFFIX,
} from './osmd-controller';
import { useTranslation } from '../../lib/i18n/useTranslation';

/**
 * 分頁（ページモード）でのページ間の縦間隔（px）。OSMD が生成する
 * div#osmdCanvasPage{i} 同士の間にこの余白を入れ、MuseScore のような
 * 「ページごとの紙の間隔」を表現する。
 */
const PAGE_GAP_PX = 28;

/**
 * 横向布局时滚动容器四周的留白（px）。滚动容器的 padding 会计入可滚动范围，
 * 使滚动条可以一直滚到 A4 纸的边缘之外（auto margin 不参与滚动范围，
 * 因此纸张上下之外无法滚动到——之前的 bug 根因）。
 */
const PAGE_MARGIN_PX = 32;

/** 缓存读写用 IPC 的最小接口（window.electronAPI 的 file 子集，TASK-101 以降）。 */
type ScoreRendererCacheIpc = {
  electronAPI?: {
    file?: {
      readIfExists: (path: string) => Promise<string | null>;
      write: (path: string, data: string) => Promise<unknown>;
    };
  };
};

/**
 * A4 紙の基準幅（px）。換算：210mm × 96dpi ≒ 794px。
 * OSMD の分頁モードでもページ幅をコンテナ幅（offsetWidth）から導出する
 * （sheet.pageWidth = offsetWidth / zoom / 10）ため、コンテナ幅を 794px に固定し、
 * osmd.zoom は常に 1.0 でレンダリングする。viewBox 幅は 794 で一定になり、
 * noteIdToSvgCoord 等の座標キャッシュはズームに依存しない。
 * 表示倍率は CSS zoom で表現する（レンダリングは 1 回きり、ズームで再描画しない）。
 */
const A4_PAGE_WIDTH_PX = 794;

/**
 * ズームの許容範囲（ZoomControl の選択肢 50%〜400% と同じ範囲）。
 * Ctrl+滚轮连续缩放时在此范围内夹取。
 */
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
/** 滚轮一步的缩放比例（向上滚放大，向下滚缩小）。 */
const ZOOM_STEP = 1.1;

/**
 * 按住拖动平移乐谱（pan）的激活阈值（px）。鼠标按下后移动距离小于该阈值
 * 视为「点击」（保持小节跳转），达到或超过该阈值判定为「拖动」并开始平移，
 * 同时抑制随后的 click（避免拖完误选小节）。
 */
const PAN_DRAG_THRESHOLD_PX = 5;

export interface ScoreRendererProps {
  score: Score | null;
  musicXmlContent: string | null;
  /** MusicXML ファイルの絶対パス。キャッシュファイルのパス解決に使用する。 */
  musicXmlPath: string | null;
  currentNoteId: string | null;
  practiceMode: PracticeMode;
  loopRange: { start: number; end: number } | null;
  zoom: number;
  /**
   * ズーム値変更の通知（Ctrl+滚轮による連続ズーム用）。App 側の
   * practiceStore.setZoom に結線する。ズーム自体は ScoreRenderer 内で
   * CSS zoom として適用する（OSMD 再描画なし）。
   */
  onZoomChange?: (zoom: number) => void;
  /**
   * 楽譜ページの配置方向。'vertical'=縦積み（既定）/ 'horizontal'=横並び。
   * 純 CSS の並べ替えで実現し、OSMD の再描画・noteId 座標キャッシュには
   * 影響しない（ページ内座標 + pageIndex のままなので光标跳转/点击定位は不変）。
   */
  scoreLayout?: ScoreLayout;
  /** ページ配置方向の変更通知（QuickPanel の切替ボタンから呼ばれる）。 */
  onScoreLayoutChange?: (layout: ScoreLayout) => void;
  onNoteClick: (note: Note) => void;
  /**
   * annotation-storeの実データ（手動入力・AI提案の両方を含む）。
   * fingerNumberが設定されている項目のみ楽譜上に指番号として描画し、
   * isApprovedの値に応じて色分けする（承認済み: 濃い青、未承認: 淡い青、
   * osmd-controller.ts の renderFingeringLayer 参照）。
   */
  annotations?: Annotation[];
  /**
   * noteIdごとの正誤ハイライト状態（REQ-004-003/004）。
   * practice-engineの判定結果（usePractice経由）をApp.tsxから受け取り、OSMDController.highlightNoteに反映する。
   */
  noteHighlights?: Record<string, 'correct' | 'incorrect'>;
  /**
   * 音符の右クリック（contextmenu）を検知した際に呼び出されるコールバック
   * （REQ-008-001/003/006、REQ-009-005）。座標解決済みのnoteIdと、メニュー表示位置
   * となる画面座標（clientX/clientY）を受け取る。App.tsx側で運指メモの
   * コンテキストメニュー表示に結線する。
   */
  onNoteContextMenu?: (noteId: string, screenX: number, screenY: number) => void;
  /**
   * 指法编辑模式开关。开启后乐谱上的指法数字变为可点击，点击数字触发
   * onFingeringClick（App 侧弹出数字选择条修改指法）。关闭时数字保持不可点击，
   * 行为与未开启时完全一致。由 OSMDController.setFingeringEditMode 实现。
   */
  fingeringEditMode?: boolean;
  /**
   * 指法编辑模式下点击乐谱上的指法数字时触发（noteId + 屏幕坐标）。
   * App 侧据此弹出数字选择条（1-5）修改该音符的指法。
   */
  onFingeringClick?: (noteId: string, screenX: number, screenY: number) => void;
}

export const ScoreRenderer: React.FC<ScoreRendererProps> = ({
  score,
  musicXmlContent,
  musicXmlPath,
  currentNoteId,
  practiceMode,
  loopRange,
  zoom,
  onZoomChange,
  scoreLayout,
  onScoreLayoutChange,
  onNoteClick,
  annotations,
  noteHighlights,
  onNoteContextMenu,
  fingeringEditMode,
  onFingeringClick,
}) => {
  const t = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const scoreScrollRef = useRef<HTMLDivElement>(null);
  const osmdControllerRef = useRef<OSMDController | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  // 滚轮缩放 handler 需要读到最新的 zoom，用 ref 避免每次缩放都重绑监听
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  // 未指定时默认横向（ScoreRenderer 测试等未传 scoreLayout 的场景）
  const layout = scoreLayout ?? 'horizontal';
  const isHorizontal = layout === 'horizontal';
  // 切换布局方向时重置滚动位置，避免旧方向残留的 scrollTop/scrollLeft 导致跳页
  const prevLayoutRef = useRef(layout);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const controller = new OSMDController(containerRef.current);
    osmdControllerRef.current = controller;

    // TASK-049: アンマウント時にOSMDController.dispose()を呼び、ResizeObserverの
    // disconnectとclick/contextmenuリスナーを解除する（リソース解放漏れの防止）。
    // このeffectで生成したcontrollerをクロージャで捕捉してdisposeする。
    // これにより、StrictModeのマウント→クリーンアップ→再マウントの間も
    // osmdControllerRef.currentをnullに戻さない
    // （他のeffectのクリーンアップがcontrollerを参照できるよう保つ）。
    // 再マウント時は本effectが無条件に新しいcontrollerを生成し直す。
    return () => {
      controller.dispose();
    };
  }, []);

  useEffect(() => {
    // M4対策: ファイル連続オープン等でこのeffectが再実行されると、古いload()の
    // 完了(.then)が新しいload()より後に解決し、noteIdマップ・isLoadedを
    // 「後勝ち」で上書きしてしまう恐れがある。cancelledフラグでこのeffect実行
    // （＝この世代のload）が既に無効化されたかどうかを判定し、無効化済みなら
    // .thenの副作用（setIsLoaded/buildNoteIdMap）を実行しない。
    let cancelled = false;

    if (score && musicXmlContent && osmdControllerRef.current) {
      setIsLoaded(false);
      const controller = osmdControllerRef.current;
      const cachePath = musicXmlPath ? musicXmlPath + SCOREMAP_CACHE_SUFFIX : null;
      // window.electronAPI は preload の contextBridge 経由で注入されるため、型安全に参照する。
      const cacheIpc = window as unknown as ScoreRendererCacheIpc;
      controller
        .load(musicXmlContent)
        .then(async () => {
          if (cancelled) return;

          // キャッシュ利用可否判定。musicXmlPath が既知（= ライブラリ/ファイルから
          // 開いた）の場合は IPC 経由で cache 読み取り→applyCache を試みる。
          // applyCache が成功すると cursor 遍历（buildNoteIdMap）を完全にスキップ
          // でき、10秒程度かかる処理が O(1) のマップ復元のみで完了する。
          let cacheApplied = false;
          if (cachePath && cacheIpc.electronAPI?.file) {
            try {
              const cacheText = await cacheIpc.electronAPI.file.readIfExists(cachePath);
              if (cacheText) {
                const parsed = JSON.parse(cacheText) as ScoreMapCache;
                cacheApplied = controller.applyCache(score, parsed);
                if (cacheApplied) {
                  console.log(`[perf] scoremap cache HIT: ${cachePath}`);
                } else {
                  console.log(`[perf] scoremap cache INVALID (version/mismatch): ${cachePath}`);
                }
              }
            } catch (err) {
              console.warn('[ScoreRenderer] scoremap cache read failed, will rebuild:', err);
            }
          }

          if (!cacheApplied) {
            // キャッシュ不採用時: setIsLoaded(true) より先に setTimeout(0) を登録する。
            // これにより、JS のマクロタスクキュー上で buildNoteIdMap が
            // 「次のマイクロタスク（annotationStore.load の await 解決など）」
            // より前に実行される問題を防ぐ。
            // 具体的には：
            //   1) ここで setTimeout 登録 → キュー末尾
            //   2) setIsLoaded(true) → React setState（マイクロタスク相当）
            //   3) App.tsx 側の await annotation.load 解決（マイクロタスク）
            //   4) 次ティックで buildNoteIdMap 開始（マクロタスク）
            // こうすることで annotation.load IPC 応答が buildNoteIdMap の
            // 同期処理（DOM 遍历 8-9 秒）でブロックされなくなる。
            setTimeout(() => {
              if (cancelled) return;
              // TASK-049: 独立採番をやめ、パース済みscoreとの照合でnoteIdマップを構築する。
              controller.buildNoteIdMap(score);
              if (cachePath && cacheIpc.electronAPI?.file) {
                const cacheData = controller.serializeCache();
                if (cacheData) {
                  cacheIpc.electronAPI.file
                    .write(cachePath, JSON.stringify(cacheData))
                    .catch((err: unknown) => {
                      console.warn('[ScoreRenderer] scoremap cache write failed:', err);
                    });
                }
              }
            }, 0);
          }

          // setIsLoaded(true) は「await された IPC 応答を受け取るマイクロタスク」
          // を邪魔しないタイミングで実施する。
          setIsLoaded(true);

          if (cacheApplied) {
            // applyCache 成功時は cursor 遍历をスキップ。指番号描画等は
            // useEffect[annotations, isLoaded] 側で isLoaded 契機に再適用される。
            // グレーアウトについては applyCache のコメント参照（Task 5 で対応）。
            return;
          }
        })
        .catch((err) => {
          if (cancelled) return;
          console.error('[ScoreRenderer] OSMD load failed:', err);
        });
    } else if (!score) {
      setIsLoaded(false);
    }

    return () => {
      cancelled = true;
    };
  }, [score, musicXmlContent, musicXmlPath]);

  useEffect(() => {
    if (isLoaded && osmdControllerRef.current && currentNoteId) {
      osmdControllerRef.current.moveCursor(currentNoteId);
    }
  }, [currentNoteId, isLoaded]);

  // 缩放不再走 OSMD 重绘（setZoom 已移除）。显示倍率由容器上的 CSS zoom 实现，
  // 乐谱只渲染一次（容器宽度固定 794px、osmd.zoom=1.0）。
  const fixedPaperWidth = A4_PAGE_WIDTH_PX;

  // Ctrl+滚轮连续缩放（MuseScore 式）。CSS zoom 不触发 OSMD 重绘，因此连续变化也流畅。
  // React 的 onWheel 是 passive 监听（无法 preventDefault），这里用原生非 passive
  // 监听以阻止浏览器默认的页面级缩放（Ctrl+滚轮）。
  useEffect(() => {
    const el = scoreScrollRef.current;
    if (!el || !onZoomChange) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const next = Math.min(
        ZOOM_MAX,
        Math.max(ZOOM_MIN, zoomRef.current * (e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP))
      );
      const rounded = Math.round(next * 100) / 100;
      if (rounded !== zoomRef.current) {
        onZoomChange(rounded);
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [onZoomChange]);

  // 切换布局方向时把滚动位置归零（横向/纵向的滚动维度不同，残留位置会显得跳页）
  useEffect(() => {
    if (prevLayoutRef.current === layout) return;
    prevLayoutRef.current = layout;
    const el = scoreScrollRef.current;
    if (el) {
      el.scrollTop = 0;
      el.scrollLeft = 0;
    }
  }, [layout]);

  // 按住拖动平移乐谱（MuseScore 式 pan）。整页任意位置按下均可拖动。
  // mousedown 记录起点与起始滚动位置；mousemove 超过阈值后判定为拖动并实时更新
  // scrollLeft/scrollTop（向左拖 → 内容左移 → 滚动向右翻页）。拖动一旦激活就调用
  // controller.suppressNextClick()，让浏览器在 mouseup 后派发的 click 被
  // OSMDController 吞掉，避免把拖动误判为小节跳转（未超阈值的移动仍是正常点击）。
  // mousemove/mouseup 绑在 window 上，鼠标移出滚动容器后仍能持续拖动与松手。
  useEffect(() => {
    const el = scoreScrollRef.current;
    if (!el) return;

    let mouseDown = false;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      // 阻止文本选择/图片拖拽等浏览器默认行为（乐谱区域不应被选中）
      e.preventDefault();
      mouseDown = true;
      dragging = false;
      startX = e.clientX;
      startY = e.clientY;
      startScrollLeft = el.scrollLeft;
      startScrollTop = el.scrollTop;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!mouseDown) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!dragging) {
        // 未超阈值视为「点击」，保持小节跳转；超过阈值才进入拖动并抑制随后的 click
        if (Math.hypot(dx, dy) < PAN_DRAG_THRESHOLD_PX) return;
        dragging = true;
        osmdControllerRef.current?.suppressNextClick();
      }
      el.scrollLeft = startScrollLeft - dx;
      el.scrollTop = startScrollTop - dy;
    };

    const endDrag = () => {
      if (!mouseDown) return;
      mouseDown = false;
      dragging = false;
    };

    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', endDrag);
    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', endDrag);
      endDrag();
    };
  }, []);

  useEffect(() => {
    if (!osmdControllerRef.current) return;
    const withFinger = (annotations ?? []).filter(
      (a): a is Annotation & { fingerNumber: NonNullable<Annotation['fingerNumber']> } =>
        a.fingerNumber !== undefined
    );
    if (isLoaded && withFinger.length > 0) {
      osmdControllerRef.current.showFingerings(
        withFinger.map((a) => ({
          noteId: a.noteId,
          finger: a.fingerNumber,
          isApproved: a.isApproved,
        }))
      );
    } else {
      osmdControllerRef.current.clearFingerings();
    }
  }, [annotations, isLoaded]);

  useEffect(() => {
    if (!osmdControllerRef.current || !isLoaded) return;
    if (loopRange) {
      osmdControllerRef.current.drawLoopBracket(loopRange.start, loopRange.end);
    } else {
      osmdControllerRef.current.clearLoopBracket();
    }
  }, [loopRange, isLoaded]);

  useEffect(() => {
    // isLoaded を依存に含めることで、新しい楽譜のロード直後（noteIdToSvgCoord構築完了後）に
    // もグレーアウトが再適用される（REQ-002-007: buildNoteIdMap完了前は座標が
    // 空で、オーバーレイを描画できないことがあるための再適用）。
    // TASK-048: パート単位（Part.hand）ではなくnote単位（Note.hand）でグレーアウト対象を
    // 収集する。1パート2段譜ではパートと手（段）が一致しないため、この方式が必要。
    if (osmdControllerRef.current && score) {
      const grayedOutHand: Hand | null =
        practiceMode === 'right' ? 'left' : practiceMode === 'left' ? 'right' : null;

      const grayedOutNoteIds = grayedOutHand
        ? new Set(
            score.measures
              .flatMap((m) => m.notes)
              .filter((n) => n.hand === grayedOutHand)
              .map((n) => n.id)
          )
        : new Set<string>();

      osmdControllerRef.current.setGrayedOutNotes(grayedOutNoteIds);
    }
  }, [practiceMode, score, isLoaded]);

  // 小節クリックによるカーソル移動（REQ-002-004）。
  // OSMDController側でクリック位置に最も近いnoteIdを解決し、対応する小節番号から
  // scoreの代表音符（該当小節の先頭ノート）を引き当てて onNoteClick に渡す。
  useEffect(() => {
    if (!osmdControllerRef.current) return;
    osmdControllerRef.current.setOnMeasureClick((measureNumber) => {
      if (!score) return;
      const measure = score.measures.find((m) => m.number === measureNumber);
      const note = measure?.notes[0];
      if (note) onNoteClick(note);
    });
    return () => {
      osmdControllerRef.current?.setOnMeasureClick(null);
    };
  }, [score, onNoteClick]);

  // 音符の右クリック（contextmenu）によるコンテキストメニュー表示
  // （REQ-008-001/003/006、REQ-009-005）。OSMDController側でクリック位置に最も
  // 近いnoteIdを解決し、画面座標とともに onNoteContextMenu prop 経由で
  // App.tsxへ通知する。
  useEffect(() => {
    if (!osmdControllerRef.current) return;
    osmdControllerRef.current.setOnNoteContextMenu(onNoteContextMenu ?? null);
    return () => {
      osmdControllerRef.current?.setOnNoteContextMenu(null);
    };
  }, [onNoteContextMenu]);

  // 指法编辑模式开关 → OSMDController（切换数字的可点击性）
  useEffect(() => {
    osmdControllerRef.current?.setFingeringEditMode(!!fingeringEditMode);
  }, [fingeringEditMode]);

  // 编辑模式下点击指法数字 → onFingeringClick（App 侧弹出数字选择条）
  useEffect(() => {
    osmdControllerRef.current?.setOnFingeringClick(onFingeringClick ?? null);
    return () => {
      osmdControllerRef.current?.setOnFingeringClick(null);
    };
  }, [onFingeringClick]);

  // 正誤判定結果に応じた楽譜上のハイライト（REQ-004-003/004）。
  // usePractice/App.tsx から渡される noteHighlights の差分のみ OSMDController に反映し、
  // マップから消えたnoteIdは 'expected'（ハイライト解除）に戻す。
  const prevHighlightsRef = useRef<Record<string, 'correct' | 'incorrect'>>({});
  useEffect(() => {
    if (!osmdControllerRef.current || !isLoaded) return;
    const controller = osmdControllerRef.current;
    const next = noteHighlights ?? {};
    const prev = prevHighlightsRef.current;

    for (const noteId of Object.keys(prev)) {
      if (!(noteId in next)) {
        controller.highlightNote(noteId, 'expected');
      }
    }
    for (const [noteId, color] of Object.entries(next)) {
      if (prev[noteId] !== color) {
        controller.highlightNote(noteId, color);
      }
    }
    prevHighlightsRef.current = next;
  }, [noteHighlights, isLoaded]);

  return (
    // 外側スクロールコンテナ：表示「窓」のサイズ。固定 A4 紙を切り出して見せるだけ。
    // Ctrl+滚轮缩放监听绑在这里（原生非 passive）。
    // 纵向布局（既定）: ページを縦に積み、水平方向に中央揃え。
    // 横向布局: ページを横に並べる。垂直方向の中央揃えは alignItems ではなく
    // osmd-container 側の margin:auto が担う。align-items:center だと交叉軸の
    // オーバーフロー時に上下が裁けてスクロールできなくなるため使わない
    // （flex の「居中 + 溢出不可达」問題、縦スクロールバーが最上部で止まるバグの原因）。
    <div
      ref={scoreScrollRef}
      data-testid="score-scroll-container"
      style={{
        flexGrow: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        overflow: 'auto',
        alignItems: isHorizontal ? 'flex-start' : 'center',
        // 横向布局: 容器四周留白。滚动容器的 padding 会计入可滚动范围
        // （scrollHeight 包含 padding），因此滚动条能一直滚到 A4 纸边缘之外。
        // 纸张上下之外原本是 osmd-container 的 auto margin（不参与滚动范围），
        // 导致无法滚出纸外——改为容器 padding 后解决，且内容仍可居中显示。
        padding: isHorizontal ? PAGE_MARGIN_PX : 0,
        // 整页任意位置可按住拖动（MuseScore 式 pan）：始终保持默认光标（不显示手型），
        // 仅禁止文本选择。
        userSelect: 'none',
      }}
    >
      {!score && (
        <div
          style={{ margin: 'auto' }}
          className="kf-score-placeholder"
          data-testid="placeholder"
        >
          {t.scoreRenderer.placeholder}
        </div>
      )}
      {/*
        OSMD コンテナ本体：分頁モードでは OSMD がページごとの
        div#osmdCanvasPage{i} > svg#osmdSvgPage{i} をこの中に縦に並べる。
        幅は A4 の 794px 固定。表示倍率（zoom）は CSS zoom で表現し、
        楽譜の再描画（osmd.render）を発生させない。
        横向布局时容器变为 flex-row，让页面 div 水平并排。
        紙の見た目（白背景・影）とページ間の隙間は下の <style> で各ページ div に適用する。
      */}
      <div
        ref={containerRef}
        style={{
          // 横向布局用 flex-row 并排页面；纵向保持默认 block（页面 div 自然纵向堆叠）
          display: score ? (isHorizontal ? 'flex' : 'block') : 'none',
          flexDirection: isHorizontal ? 'row' : undefined,
          width: `${fixedPaperWidth}px`,
          flexShrink: 0,
          // 横向布局: 四个方向的 margin:auto。主轴（水平）居中、交叉轴（垂直）居中，
          // 空间不足时 auto margin 收缩为 0，内容从 start 开始可滚动到两端
          // （既能居中显示，又不会像 alignItems:center 那样溢出不可达）。
          marginTop: isHorizontal ? 'auto' : 16,
          marginBottom: isHorizontal ? 'auto' : 16,
          marginLeft: isHorizontal ? 'auto' : undefined,
          marginRight: isHorizontal ? 'auto' : undefined,
          // CSS zoom（Chromium 原生）：视觉与布局尺寸一起缩放，滚动条/居中自动适配。
          // 缩放只改样式，不触发 OSMD 重绘与 buildNoteIdMap，因此无卡顿。
          zoom,
        }}
        data-testid="osmd-container"
      />
      {isHorizontal ? (
        <style>{`
          [data-testid="osmd-container"] > div[id^="osmdCanvasPage"] {
            background-color: #ffffff;
            border-radius: 2px;
            box-shadow: 0 1px 2px rgba(16,24,40,0.08), 0 8px 24px -8px rgba(16,24,40,0.18);
            margin-right: ${PAGE_GAP_PX}px;
            flex-shrink: 0;
          }
          [data-testid="osmd-container"] > div[id^="osmdCanvasPage"]:last-child {
            margin-right: 0;
          }
        `}</style>
      ) : (
        <style>{`
          [data-testid="osmd-container"] > div[id^="osmdCanvasPage"] {
            background-color: #ffffff;
            border-radius: 2px;
            box-shadow: 0 1px 2px rgba(16,24,40,0.08), 0 8px 24px -8px rgba(16,24,40,0.18);
            margin-bottom: ${PAGE_GAP_PX}px;
          }
          [data-testid="osmd-container"] > div[id^="osmdCanvasPage"]:last-child {
            margin-bottom: 0;
          }
        `}</style>
      )}
    </div>
  );
};
