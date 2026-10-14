import React from 'react';
import { Header } from './components/Header';
import { ScoreRenderer } from './components/ScoreRenderer';
import { PianoKeyboard } from './components/PianoKeyboard';
import { NoteContextMenu } from './components/NoteContextMenu';
import { FingeringPicker } from './components/FingeringPicker';
import { LibraryView } from './components/LibraryView';
import { usePracticeStore } from './store';
import { useShallow } from 'zustand/react/shallow';
import { parse, extractXmlFromMxl } from './lib/musicxml-parser';
import { SettingsModal } from './components/SettingsModal';
import { AboutModal } from './components/AboutPanel/AboutModal';
import { usePractice } from './hooks/usePractice';
import { AnnotationStoreService } from './lib/annotation-store';
import { groupNotesByStartTick } from './lib/practice-engine/note-grouping';
import { PLAYBACK_VOICES } from './lib/audio-engine/voices';
import { deriveRepeatPlayRange, segmentsToRangeString } from './lib/audio-engine';
import { METRONOME_VOICES } from './lib/audio-engine/metronome-voices';
import { resolveLanguage } from './lib/i18n/resolve-language';
import { useTranslation } from './lib/i18n/useTranslation';
import type { Annotation, Finger, FingerAssignment, Note, Score } from './types';

// TASK-053: ドラッグ＆ドロップで受け付けるMusicXMLの拡張子（大文字小文字を区別しない）。
// Main側のfile:register-dropped-fileハンドラでも同様に検証する（多層防御）。
const ACCEPTED_DROP_EXTENSIONS = ['.xml', '.musicxml', '.mxl'];

function hasAcceptedDropExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return ACCEPTED_DROP_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

// TASK-103: パーサーが曲名を抽出できなかった場合のsentinel値（parser.ts参照）。
// ライブラリ登録用のタイトルでは、この値をファイル名フォールバックの合図として扱う。
const UNTITLED_SCORE_TITLE = 'Untitled';

/**
 * ライブラリ登録用のタイトルを決定する（TASK-103、REQ-017-001）。
 * score.titleが取得できていればそれを使い、パーサーが既定値（'Untitled'）を
 * 返した場合はファイル名（拡張子除く）にフォールバックする。
 */
function deriveLibraryTitle(score: Score, filePath: string): string {
  if (score.title && score.title !== UNTITLED_SCORE_TITLE) return score.title;
  const baseName = filePath.split(/[/\\]/).pop() ?? filePath;
  return baseName.replace(/\.(xml|musicxml|mxl)$/i, '');
}

function App(): React.JSX.Element {
  const t = useTranslation();
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  // TASK-082: Aboutをメニューバー経由で開く独立モーダルへ分離した（US-015）。
  const [isAboutOpen, setIsAboutOpen] = React.useState(false);
  const [isLoadingAnnotations, setIsLoadingAnnotations] = React.useState(false);
  // 楽譜読込全体（検証＋パース＋描画＋アノテーション）をカバーするローディング状態。
  // isLoadingAnnotations はアノテーション読込区間のみを指し、ライブラリ→検証→パースの
  // 待ち時間をカバーしないため、ユーザーへ「読込中」を示す全画面オーバーレイはこちらを使う。
  const [isLoadingScore, setIsLoadingScore] = React.useState(false);
  // TASK-053: アプリ全体へのドラッグオーバー時の視覚フィードバック用フラグ。
  const [isDraggingOver, setIsDraggingOver] = React.useState(false);
  // dragenter/dragleaveは子要素間の移動でも発火してバブリングするため、
  // 単純なbooleanだけだと子要素へ入った瞬間にオーバーレイが消えてしまう（点滅）。
  // enter/leaveの回数を数え、0に戻った時のみオーバーレイを消すことでこれを防ぐ。
  const dragCounterRef = React.useRef(0);
  // annotation-store が保持する運指メモ（手動入力・AI提案の両方）の実データ。
  // PianoKeyboard の鍵盤上指番号表示（REQ-005-007）と ScoreRenderer の楽譜上
  // 指番号表示（REQ-008-002、承認済み/未承認の色分けを含む）の両方に渡す
  // 単一の真実源とする（TASK-044: 片方だけ更新されて表示が食い違う状態を避ける）。
  const [keyboardAnnotations, setKeyboardAnnotations] = React.useState<Annotation[]>([]);
  // 右クリックで開く運指メモ編集メニュー（REQ-008-001/003/006、REQ-009-005）の状態。
  const [noteContextMenu, setNoteContextMenu] = React.useState<{
    noteId: string;
    x: number;
    y: number;
  } | null>(null);
  // 指法编辑模式开关（QuickPanel 的 FingeringEditToggle）。开启后乐谱上的指法数字
  // 可点击，点击数字弹出 FingeringPicker（数字选择条）修改指法。
  const [fingeringEditMode, setFingeringEditMode] = React.useState(false);
  // 指法编辑模式中点击乐谱数字后弹出的数字选择条（FingeringPicker）的显示状态。
  const [fingeringPicker, setFingeringPicker] = React.useState<{
    noteId: string;
    x: number;
    y: number;
  } | null>(null);
  // TASK-103: ライブラリ（US-017）から開こうとしたがファイルが見つからなかった
  // pathの集合（LibraryViewの欠損マーク表示に渡す）と、削除確認ダイアログの対象path。
  const [missingLibraryPaths, setMissingLibraryPaths] = React.useState<Set<string>>(new Set());
  const [missingEntryPath, setMissingEntryPath] = React.useState<string | null>(null);
  // CodeRabbit #46指摘4: 欠損エントリの削除成功後にLibraryViewへ一覧の再取得を促すための
  // signal。値自体に意味はなくインクリメントによる変化のみをLibraryView側が見る。
  const [libraryReloadSignal, setLibraryReloadSignal] = React.useState(0);

  const {
    practiceEngine,
    audioEngine,
    webMidiService,
    handleKeyClick,
    noteHighlights,
    soundingNotes,
  } = usePractice();

  const annotationStore = React.useRef(new AnnotationStoreService());

  const {
    score,
    musicXmlPath,
    musicXmlContent,
    expectedNotes,
    pressedKeys,
    incorrectKeys,
    practiceMode,
    zoom,
    scoreLayout,
    pianoHeight,
    showFingerings,
    keyboardSize,
    setScore,
    setOriginalBpm,
    setMetronomeEnabled,
    setMetronomeAccentEnabled,
    setErrorMode,
    setZoom,
    setScoreLayout,
    setPianoHeight,
    setMidiDeviceId,
    setVolume,
    setShowFingerings,
    setKeyboardSize,
    setPlaybackVoice,
    setMetronomeVoice,
    setLanguage,
    currentMeasure,
    currentNoteIndex,
    loopEnabled,
    loopStart,
    loopEnd,
    playbackState,
    playbackRange,
    setPlaybackRange,
    playbackLoop,
    activeView,
    setActiveView,
  } = usePracticeStore(
    useShallow((s) => ({
      score: s.score,
      musicXmlPath: s.musicXmlPath,
      musicXmlContent: s.musicXmlContent,
      expectedNotes: s.expectedNotes,
      pressedKeys: s.pressedKeys,
      incorrectKeys: s.incorrectKeys,
      practiceMode: s.practiceMode,
      zoom: s.zoom,
      scoreLayout: s.scoreLayout,
      pianoHeight: s.pianoHeight,
      showFingerings: s.showFingerings,
      keyboardSize: s.keyboardSize,
      setScore: s.setScore,
      setOriginalBpm: s.setOriginalBpm,
      setMetronomeEnabled: s.setMetronomeEnabled,
      setMetronomeAccentEnabled: s.setMetronomeAccentEnabled,
      setErrorMode: s.setErrorMode,
      setZoom: s.setZoom,
      setScoreLayout: s.setScoreLayout,
      setPianoHeight: s.setPianoHeight,
      setMidiDeviceId: s.setMidiDeviceId,
      setVolume: s.setVolume,
      setShowFingerings: s.setShowFingerings,
      setKeyboardSize: s.setKeyboardSize,
      setPlaybackVoice: s.setPlaybackVoice,
      setMetronomeVoice: s.setMetronomeVoice,
      setLanguage: s.setLanguage,
      currentMeasure: s.currentMeasure,
      currentNoteIndex: s.currentNoteIndex,
      loopEnabled: s.loopEnabled,
      loopStart: s.loopStart,
      loopEnd: s.loopEnd,
      playbackState: s.playbackState,
      playbackRange: s.playbackRange,
      setPlaybackRange: s.setPlaybackRange,
      playbackLoop: s.playbackLoop,
      activeView: s.activeView,
      setActiveView: s.setActiveView,
    }))
  );

  // ループが有効な場合のみ ScoreRenderer にループ範囲を渡す。
  // ScoreRenderer は loopRange に基づいて楽譜上にループ範囲を可視化する
  // （osmd-controller.ts の drawLoopBracket / clearLoopBracket）。
  const loopRange = loopEnabled ? { start: loopStart, end: loopEnd } : null;

  // TASK-055: 運指の一括表示/非表示トグル。OFF時はScoreRenderer/PianoKeyboardへ
  // 空配列を渡すことで、両方の指番号表示を一括で消す（あくまで表示レイヤの制御であり、
  // annotationStore/keyboardAnnotations自体のデータは変更しない）。ONに戻すと
  // 即座に元のkeyboardAnnotationsが復元される。
  // 指法编辑模式开启时强制显示指法（否则编辑模式看不到数字就无法点击修改），
  // 退出编辑模式后恢复 showFingerings 的原设置。
  const displayedAnnotations =
    fingeringEditMode || showFingerings ? keyboardAnnotations : [];

  // currentNoteIndex は小節内の「判定グループ」インデックス（同一startTickの
  // 発音ノーツ集合の並び順）を指す（TASK-032: データモデルv2の判定グループ
  // 仕様）。カーソル位置は現在の判定グループのstartTickなので、その代表として
  // グループ内の先頭ノートのidを使う（同一時刻のノートはどれでもカーソル位置は
  // 一致する）。
  const currentMeasureData = score?.measures.find((m) => m.number === currentMeasure);
  const currentNoteId = currentMeasureData
    ? (groupNotesByStartTick(currentMeasureData.notes)[currentNoteIndex]?.notes[0]?.id ?? null)
    : null;

  // TASK-034: 実起動E2Eテスト（Playwright for Electron）向けの計装。
  // usePracticeStore は本番でも使用している実際のZustandストアインスタンスであり、
  // テスト専用の代替実装ではない。E2Eテストはここに公開された参照から
  // getState() で状態（currentMeasure/currentNoteIndex/statsなど）を読み取り、
  // MIDI入力に対する正誤判定・カーソル進行の結果を検証する（読み取り専用の計装）。
  // TASK-088: 本番ビルドで攻撃対象領域を無用に広げないよう、electronAPI.isE2E
  // （main側KEYFLOW_E2E=1起動時のみpreloadが公開するフラグ）がtrueの場合のみ公開する。
  React.useEffect(() => {
    if (!window.electronAPI?.isE2E) return;
    (window as unknown as { __e2eStore__?: typeof usePracticeStore }).__e2eStore__ =
      usePracticeStore;
  }, []);

  // TASK-082: Main側メニューの「About」項目クリック（`menu:open-about`）を購読し、
  // AboutModalを表示する。購読解除はcleanupで確実に行う（StrictMode耐性）。
  React.useEffect(() => {
    const unsubscribe = window.electronAPI?.menu?.onOpenAbout(() => setIsAboutOpen(true));
    return () => unsubscribe?.();
  }, []);

  // アプリ起動時に、SettingsModal（electron-store）で設定された既定値を、
  // それぞれ対応するstoreへ反映する（単一の真実源とし、起動後はツールバー/
  // SettingsModal での変更がこれらの値を更新する）。
  // - practice.metronomeEnabled / practice.defaultErrorMode
  //   → ui-slice.metronomeEnabled / practice-slice.errorMode（TASK-040）。
  //   この反映を省くと practice-engine の 'pass' 分岐は本番経路で
  //   到達不能になる。
  // - ui.zoom / ui.pianoHeight → ui-slice.zoom / ui-slice.pianoHeight
  //   （TASK-045: ズームUI・鍵盤高さ設定UIの永続化された値を反映する）。
  // - ui.volume → ui-slice.volume
  //   （TASK-052: usePractice側のuseEffectがaudioEngine.setMasterVolumeへ反映する）。
  // - ui.showFingerings → ui-slice.showFingerings
  //   （TASK-055: 運指の一括表示/非表示トグルの永続化された値を反映する）。
  // - ui.keyboardSize → ui-slice.keyboardSize
  //   （TASK-056: 画面下鍵盤の鍵盤数プリセットの永続化された値を反映する）。
  //   PianoKeyboardの表示範囲にのみ影響し、practice-engineの判定ロジックには
  //   影響しない。
  // - midi.selectedDeviceId → ui-slice.midiDeviceId
  //   （TASK-045, REQ-004-008: useMidiがmidiDeviceIdの変更を購読し、
  //   WebMidiService.setSelectedDeviceへ反映する）。
  // - audio.playbackVoice / audio.metronomeVoice → ui-slice.playbackVoice / metronomeVoice
  //   （TASK-073, US-013）。
  //   usePractice.ts側のuseEffectがaudioEngine.setPlaybackVoice / setMetronomeVoiceへ反映する。
  // - ui.language → resolveLanguage(ui.language, navigator.language) → ui-slice.language
  //   （TASK-096, US-016, REQ-016-002/005）。'auto'・不正値・未定義はOSロケール判定に
  //   フォールバックする。useTranslation()がこの値を購読して表示文言を切り替える。
  React.useEffect(() => {
    if (!window.electronAPI?.settings) return;

    let cancelled = false;
    const loadPersistedSettings = async (): Promise<void> => {
      try {
        const [practiceSettings, uiSettings, midiSettings, audioSettings] = await Promise.all([
          window.electronAPI.settings.get('practice'),
          window.electronAPI.settings.get('ui'),
          window.electronAPI.settings.get('midi'),
          window.electronAPI.settings.get('audio'),
        ]);
        if (cancelled) return;

        if (practiceSettings) {
          setMetronomeEnabled(practiceSettings.metronomeEnabled);
          setErrorMode(practiceSettings.defaultErrorMode);
          // TASK-063: metronomeAccentEnabledはキー追加前に永続化された既存ストアには
          // 存在しない可能性があるため、typeof===booleanガードで後方互換を保つ
          // （未定義ならui-sliceの初期値true を維持する）。
          if (typeof practiceSettings.metronomeAccentEnabled === 'boolean') {
            setMetronomeAccentEnabled(practiceSettings.metronomeAccentEnabled);
          }
        }
        if (uiSettings) {
          setZoom(uiSettings.zoom);
          setPianoHeight(uiSettings.pianoHeight);
          // scoreLayout はキー追加前に永続化された既存ストアには存在しない可能性が
          // あるため、'vertical'/'horizontal' のガードで後方互換を保つ
          // （未定義なら ui-slice の初期値 'vertical' を維持する）。
          if (uiSettings.scoreLayout === 'vertical' || uiSettings.scoreLayout === 'horizontal') {
            setScoreLayout(uiSettings.scoreLayout);
          }
          if (typeof uiSettings.volume === 'number') {
            setVolume(uiSettings.volume);
          }
          if (typeof uiSettings.showFingerings === 'boolean') {
            setShowFingerings(uiSettings.showFingerings);
          }
          if (typeof uiSettings.keyboardSize === 'number') {
            setKeyboardSize(uiSettings.keyboardSize);
          }
          setLanguage(resolveLanguage(uiSettings.language, navigator.language));
        }
        if (midiSettings) {
          setMidiDeviceId(midiSettings.selectedDeviceId);
        }
        if (audioSettings) {
          // TASK-073: electron-store側の破損・想定外データに対する防御
          // （keyboardSizeと同じ既存パターン）。既知のIDでなければui-sliceの
          // 初期値（grand-piano/click）を維持する。
          if (
            typeof audioSettings.playbackVoice === 'string' &&
            audioSettings.playbackVoice in PLAYBACK_VOICES
          ) {
            setPlaybackVoice(audioSettings.playbackVoice);
          }
          if (
            typeof audioSettings.metronomeVoice === 'string' &&
            audioSettings.metronomeVoice in METRONOME_VOICES
          ) {
            setMetronomeVoice(audioSettings.metronomeVoice);
          }
        }
      } catch (error) {
        console.error('Failed to load persisted settings:', error);
      }
    };

    loadPersistedSettings();

    return () => {
      cancelled = true;
    };
  }, [
    setMetronomeEnabled,
    setMetronomeAccentEnabled,
    setErrorMode,
    setZoom,
    setPianoHeight,
    setMidiDeviceId,
    setVolume,
    setShowFingerings,
    setKeyboardSize,
    setPlaybackVoice,
    setMetronomeVoice,
    setLanguage,
  ]);

  // ダイアログ経由（handleOpenFile）・ドラッグ＆ドロップ経由（handleDrop）の両方から
  // 呼ばれる共通のオープン処理（TASK-053）。パース→setScore→初期化（練習位置リセット）
  // →アノテーション読込、の一連の流れを一本化し、どちらの経路でも同一の挙動を保証する。
  const openMusicXmlFile = React.useCallback(
    async (filePath: string, skipLibraryUpsert = false): Promise<void> => {
      setIsLoadingAnnotations(true);
      setIsLoadingScore(true);
      const perfTags: string[] = [`t0=${performance.now().toFixed(0)}`];
      try {
        let parsedScore: Score;
        let xmlContent: string;
        if (filePath.toLowerCase().endsWith('.mxl')) {
          const buffer = await window.electronAPI.file.readBinary(filePath);
          perfTags.push(`read=${performance.now().toFixed(0)}`);
          xmlContent = extractXmlFromMxl(buffer);
          perfTags.push(`unzip=${performance.now().toFixed(0)}`);
          parsedScore = parse(xmlContent);
        } else {
          xmlContent = await window.electronAPI.file.read(filePath);
          perfTags.push(`read=${performance.now().toFixed(0)}`);
          parsedScore = parse(xmlContent);
        }
        perfTags.push(`parse=${performance.now().toFixed(0)}`);
        const validNoteIds = new Set(
          parsedScore.measures.flatMap((measure) => measure.notes.map((note) => note.id))
        );
        perfTags.push(`validNoteIds=${performance.now().toFixed(0)}`);

        // 【重要】annotationStore.load を setScore **より先に** 実行する。
        // 理由：setScore が発火させる ScoreRenderer の useEffect は
        // キャッシュ未命中時に buildNoteIdMap（DOM 遍历 8-9 秒の同期処理）を
        // setTimeout(0) で開始する。JS イベンループ上の「マクロタスク実行権」を
        // buildNoteIdMap に先に取られると annotation.load IPC の応答受信（
        // マイクロタスクで解決される Promise）が 8-9 秒遅延してしまう。
        // そこで setScore の前に annotation.load を await し、
        // 「OSMD の load/render + buildNoteIdMap のスケジュール」よりも
        // 先に annotation IPC の往復を完了させておく。
        setKeyboardAnnotations([]);
        setNoteContextMenu(null);
        perfTags.push(`setState1=${performance.now().toFixed(0)}`);
        console.log(`[perf][diag] before annotation.load, t=${Date.now()}`);
        const skippedNoteIds = await annotationStore.current.load(filePath, validNoteIds);
        console.log(`[perf][diag] after annotation.load, t=${Date.now()}`);
        perfTags.push(`annotationLoad=${performance.now().toFixed(0)}`);
        if (skippedNoteIds.length > 0) {
          console.warn(
            `[App] noteId採番方式の変更（TASK-031）により ${skippedNoteIds.length} 件のアノテーションを読み込めませんでした:`,
            skippedNoteIds
          );
        }
        setKeyboardAnnotations(annotationStore.current.getAllAnnotations());

        // annotation.load 完了後に setScore / OSMD レンダリングを開始する。
        setScore(parsedScore, filePath, xmlContent);
        setOriginalBpm(parsedScore.tempo);
        // 打开文件时自动根据反复记号推导播放顺序，填充到 playbackRange 文本框。
        // 用户可手动编辑文本框（编辑后即视为用户接管，软件不再自动覆盖）。
        // 想恢复系统预设可在 PlaybackControls 上点"重置"按钮。
        try {
          const segs = deriveRepeatPlayRange(parsedScore);
          if (segs.length > 0) {
            setPlaybackRange(segmentsToRangeString(segs));
          } else {
            // 没反复记号的曲子 → 空串（线性播放）
            setPlaybackRange('');
          }
        } catch (err) {
          console.error('[App] deriveRepeatPlayRange failed:', err);
          setPlaybackRange('');
        }
        perfTags.push(`repeat=${performance.now().toFixed(0)}`);
        // TASK-103: ダイアログ・D&D・ライブラリのいずれの経路で開いた場合も、この
        // 成功点を通ることで画面遷移とライブラリ自動登録が一律に行われる
        // （REQ-017-001/002/010）。ライブラリ登録は補助機能のため、失敗しても
        // 楽譜を開く操作自体は成立させる（catchで握りつぶしログのみ出す）。
        setActiveView('score');
        perfTags.push(`viewSwitch=${performance.now().toFixed(0)}`);
        // 新規インポート時のみライブラリへ登録する。
        // library.upsert は主プロセス側で setImmediate → fs.writeFileSync により
        // 同期的にファイルへ書き込む。IPC レスポンスが戻る前に書込みが実行される
        // ため await すると書込み完了（OneDrive等では 800ms〜8秒）を待たされる。
        // ライブラリ登録は補助機能であり失敗しても楽譜オープンに影響しないため、
        // fire-and-forget で await しない。
        // ライブラリからの再オープン時は skipLibraryUpsert=true で完全にスキップする。
        if (!skipLibraryUpsert && window.electronAPI?.library) {
          window.electronAPI.library
            .upsert({
              path: filePath,
              title: deriveLibraryTitle(parsedScore, filePath),
              composer: parsedScore.composer ?? '',
            })
            .catch((error: unknown) => {
              console.error('Failed to register the score to the library:', error);
            });
        }
        perfTags.push(`libraryUpsert=${performance.now().toFixed(0)}`);
        // setScore が反映された後にリセットする必要がある（resetToMeasure は
        // store.getState().score を参照するため、呼び出し順序を変更しないこと）。
        practiceEngine.resetToMeasure(1);
        perfTags.push(`resetToMeasure=${performance.now().toFixed(0)}`);
        // audioEngine.loadScore は usePractice 側の score/practiceMode 監視エフェクト
        // （TASK-051）が同期して呼び出すため、ここでは明示的に呼ばない
        // （二重スケジューリングを避けるため）。
        perfTags.push(`done=${performance.now().toFixed(0)}`);
        console.log(`[perf] openMusicXmlFile: ${perfTags.join(' > ')}`);
      } catch (error) {
        console.error('Failed to parse file:', error);
        alert(t.app.parseError);
      } finally {
        setIsLoadingAnnotations(false);
        setIsLoadingScore(false);
      }
    },
    [practiceEngine, setOriginalBpm, setScore, setActiveView, t]
  );

  const handleOpenFile = async () => {
    if (!window.electronAPI) {
      alert(t.app.electronApiUnavailable);
      return;
    }

    let filePath: string | null = null;
    try {
      filePath = await window.electronAPI.file.showOpenDialog();
    } catch (error) {
      console.error('Failed to open dialog:', error);
      alert(t.app.openDialogError);
      return;
    }

    if (!filePath) return;

    await openMusicXmlFile(filePath);
  };

  // TASK-053: ブラウザ既定のドラッグ挙動（ファイルをそのまま開く等）を抑止しつつ、
  // Files のドラッグに対してのみ視覚フィードバック用のカウンタを更新する。
  const handleDragEnter = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!Array.from(event.dataTransfer.types).includes('Files')) return;
    event.preventDefault();
    dragCounterRef.current += 1;
    setIsDraggingOver(true);
  }, []);

  // dragover は継続的に preventDefault し続けないとドロップ自体が発生しないため、
  // ネイティブのドラッグ&ドロップ仕様に従い常に抑止する。
  const handleDragOver = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!Array.from(event.dataTransfer.types).includes('Files')) return;
    event.preventDefault();
  }, []);

  const handleDragLeave = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setIsDraggingOver(false);
    }
  }, []);

  const handleDrop = React.useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragCounterRef.current = 0;
      setIsDraggingOver(false);

      if (!window.electronAPI) {
        alert(t.app.electronApiUnavailable);
        return;
      }

      // 複数ファイルが同時にドロップされた場合は、先頭のファイルのみを対象とする
      // （2番目以降が対応拡張子であっても開かない）。
      const file = event.dataTransfer.files[0];
      if (!file) return;

      if (!hasAcceptedDropExtension(file.name)) {
        alert(t.app.unsupportedDropFormat);
        return;
      }

      let filePath = '';
      try {
        filePath = window.electronAPI.file.getDroppedFilePath(file);
      } catch (error) {
        console.error('Failed to resolve dropped file path:', error);
      }

      if (!filePath) {
        alert(t.app.droppedFilePathError);
        return;
      }

      // D&D で開いたファイルも file:write（アノテーション保存）の allowlist・
      // ファイル履歴に載せる必要があるため、Main 側の登録 IPC を経由する
      // （Main 側でも拡張子を検証する多層防御。TASK-053）。
      const registered = await window.electronAPI.file.registerDroppedFile(filePath);
      if (!registered) {
        alert(t.app.unsupportedDropFormat);
        return;
      }

      await openMusicXmlFile(filePath);
    },
    [openMusicXmlFile, t]
  );

  // TASK-103: ライブラリ画面（LibraryView）の行クリックで呼ばれる（REQ-017-007/008）。
  // library:openはallowlist登録・拡張子検証・存在確認を行った上で、既存の読み込み
  // フロー（openMusicXmlFile）を再利用できるようにする前処理である。
  const handleOpenLibraryEntry = React.useCallback(
    async (filePath: string): Promise<void> => {
      if (!window.electronAPI?.library) {
        alert(t.app.electronApiUnavailable);
        return;
      }

      // library.open の検証待ち時間も含めてオーバーレイを表示する。
      // openMusicXmlFile 内部でも setIsLoadingScore(true) が呼ばれるが、
      // ここで先に立てておくことで検証中のライブラリ画面待機も覆える。
      setIsLoadingScore(true);
      try {
        const result = await window.electronAPI.library.open(filePath);
        if (result.ok) {
          // ライブラリからのオープンは登録済みエントリを開く操作なので、library.upsert を
          // スキップして読込速度を短縮する（スキップしないと 7〜8 秒程度かかる）。
          await openMusicXmlFile(filePath, true);
          return;
        }
        // REQ-017-008: 見つからなかった場合はエラー通知＋欠損マーク＋
        // ライブラリから削除するかどうかの確認を出す（画面遷移は行わない）。
        setMissingLibraryPaths((prev) => new Set(prev).add(filePath));
        alert(t.library.missingEntryErrorMessage);
        setMissingEntryPath(filePath);
      } catch (error) {
        console.error('Failed to open the library entry:', error);
        alert(t.app.libraryOpenError);
      } finally {
        // openMusicXmlFile が呼ばれた場合はその内部の finally で false にされるが、
        // 検証失敗等で openMusicXmlFile に到達しなかった場合ここで確実に下ろす。
        setIsLoadingScore(false);
      }
    },
    [openMusicXmlFile, t]
  );

  const handleConfirmRemoveMissingEntry = React.useCallback(async () => {
    if (!missingEntryPath) return;
    const targetPath = missingEntryPath;
    setMissingEntryPath(null);
    try {
      await window.electronAPI?.library?.remove(targetPath);
      // CodeRabbit #46指摘4: 削除成功時のみ、欠損マークを外しLibraryViewへ一覧の
      // 再取得を促す（失敗時はビュー状態を変えず、catch節でalert通知する）。
      setMissingLibraryPaths((prev) => {
        const next = new Set(prev);
        next.delete(targetPath);
        return next;
      });
      setLibraryReloadSignal((count) => count + 1);
    } catch (error) {
      console.error('Failed to remove the missing library entry:', error);
      alert(t.library.missingEntryRemoveErrorMessage);
    }
  }, [missingEntryPath, t]);

  const handleKeepMissingEntry = React.useCallback(() => {
    setMissingEntryPath(null);
  }, []);

  const handleFingering = React.useCallback(
    async (assignments: FingerAssignment[]) => {
      if (!musicXmlPath || isLoadingAnnotations) return;
      // TASK-055: 運指表示がOFFのまま提案結果を反映すると、ユーザーには「提案が
      // 実行されたのに何も起こらない」ように見えてしまう。運指提案の実行は
      // トグルと独立して行えるが、結果を確認できるよう実行時は自動でONへ戻す。
      if (!showFingerings) {
        setShowFingerings(true);
      }
      // 計算済みの運指はまず表示に反映し、永続化の成否とは独立させる
      // （保存に失敗しても提案結果が見えなくならないようにする。失敗はalertで通知）。
      annotationStore.current.applyAISuggestions(assignments);
      setKeyboardAnnotations(annotationStore.current.getAllAnnotations());
      try {
        await annotationStore.current.save();
      } catch (error) {
        console.error('Failed to save fingering annotations:', error);
        alert(t.app.fingeringSaveError);
      }
    },
    [musicXmlPath, isLoadingAnnotations, showFingerings, setShowFingerings, t]
  );

  // 運指メモの右クリックメニュー結線（REQ-008-001/003/006、REQ-009-005）。
  // ScoreRenderer/OSMDControllerが座標→noteId解決したコールバックを受け、
  // クリック位置にメニューを表示する。
  const handleNoteContextMenu = React.useCallback((noteId: string, x: number, y: number) => {
    setNoteContextMenu({ noteId, x, y });
  }, []);

  const closeNoteContextMenu = React.useCallback(() => {
    setNoteContextMenu(null);
  }, []);

  // 指法编辑模式：点击乐谱上的指法数字 → 弹出数字选择条（FingeringPicker）。
  // OSMDController 已把点击数字与小节跳转区分开（编辑模式下数字可点、空白仍跳小节）。
  const handleFingeringPick = React.useCallback((noteId: string, x: number, y: number) => {
    setFingeringPicker({ noteId, x, y });
  }, []);

  const closeFingeringPicker = React.useCallback(() => {
    setFingeringPicker(null);
  }, []);

  // annotation-store への変更後、JSONサイドカーへ即時永続化し（REQ-008-004）、
  // 鍵盤・楽譜の指番号表示を更新する（handleFingering:173-187と同じ
  // エラーハンドリング＝失敗時alert）。
  const persistAnnotationChange = React.useCallback(async () => {
    try {
      await annotationStore.current.save();
      setKeyboardAnnotations(annotationStore.current.getAllAnnotations());
    } catch (error) {
      console.error('Failed to save annotation:', error);
      alert(t.app.annotationSaveError);
    }
  }, [t]);

  const handleSelectFinger = React.useCallback(
    async (noteId: string, finger: Finger) => {
      annotationStore.current.setFinger(noteId, finger);
      await persistAnnotationChange();
      setNoteContextMenu(null);
    },
    [persistAnnotationChange]
  );

  // 数字选择条（FingeringPicker）选中后：关闭选择条并复用现有的指法修改流程
  // （annotation-store 更新 + 保存）。
  const handleFingerPicked = React.useCallback(
    (noteId: string, finger: Finger) => {
      setFingeringPicker(null);
      void handleSelectFinger(noteId, finger);
    },
    [handleSelectFinger]
  );

  const handleRemoveFinger = React.useCallback(
    async (noteId: string) => {
      annotationStore.current.removeFinger(noteId);
      await persistAnnotationChange();
      setNoteContextMenu(null);
    },
    [persistAnnotationChange]
  );

  const handleSaveComment = React.useCallback(
    async (noteId: string, comment: string) => {
      annotationStore.current.setComment(noteId, comment);
      await persistAnnotationChange();
      setNoteContextMenu(null);
    },
    [persistAnnotationChange]
  );

  const handleApproveAnnotation = React.useCallback(
    async (noteId: string) => {
      annotationStore.current.approveAnnotation(noteId);
      await persistAnnotationChange();
      setNoteContextMenu(null);
    },
    [persistAnnotationChange]
  );

  const activeNoteAnnotation = noteContextMenu
    ? keyboardAnnotations.find((a) => a.noteId === noteContextMenu.noteId)
    : undefined;

  // FingeringPicker（数字选择条）当前音符的指法（用于高亮当前值）。
  const pickedNoteAnnotation = fingeringPicker
    ? keyboardAnnotations.find((a) => a.noteId === fingeringPicker.noteId)
    : undefined;

  // 音符クリックによるカーソル移動（REQ-002-004、TASK-051で小節単位から音単位へ更新）。
  // ScoreRenderer/OSMDControllerがクリック位置に最も近い音符を解決し、その音符が属する
  // 判定グループ（同一startTickのノーツ集合）へ practiceEngine.resetToPosition で移動する。
  // 小節頭に丸めず、クリックした音がそのまま属するグループへ移動する。
  const handleNoteClick = React.useCallback(
    (note: Note) => {
      const measure = score?.measures.find((m) => m.number === note.measureNumber);
      if (!measure) {
        practiceEngine.resetToMeasure(note.measureNumber);
        return;
      }

      const groups = groupNotesByStartTick(measure.notes);
      const groupIndex = groups.findIndex((g) => g.startTick === note.startTick);
      practiceEngine.resetToPosition(note.measureNumber, groupIndex >= 0 ? groupIndex : 0);
    },
    [practiceEngine, score]
  );

  // 再生の練習対象フィルタ・カーソル位置からの再生（TASK-051、REQ-010-001/010-010）。
  // PlaybackControls（Toolbar経由）にはこのラッパーを渡し、再生操作時は常に現在の
  // 判定グループのstartTick（カーソル位置）から開始する。カーソルは再生中も再生位置に
  // 追従する（REQ-010-005）ため、一時停止時点のカーソル位置＝一時停止位置であり、
  // REQ-010-003（一時停止位置からの再開）はカーソル基準でも実質満たされる。加えて
  // 一時停止中に楽譜クリックでカーソルを動かした場合はその位置から再開できる
  // （2026-07-05 実機フィードバック: 選択した再生位置から再生されない問題の修正）。
  const playbackAudioEngine = React.useMemo(
    () => ({
      playAccompaniment: async () => {
        // REQ-013-003, TASK-073: 再生音色（grand-piano等）のサンプルロードが
        // 完了するまで再生開始を待つ。ロード済み・ロード不要な音色の場合は
        // 即座に解決する（AudioEngineService.ensurePlaybackVoiceLoaded参照）。
        await audioEngine.ensurePlaybackVoiceLoaded();
        // 播放前设置小节跳转顺序（用户手动展开反复记号）
        if (score) {
          audioEngine.setupPlaybackSequence(score, playbackRange, playbackLoop);
        }
        const startTick = practiceEngine.getCurrentPositionTick();
        audioEngine.playAccompaniment(startTick ?? undefined);
      },
      pauseAccompaniment: () => audioEngine.pauseAccompaniment(),
      stopAccompaniment: () => audioEngine.stopAccompaniment(),
    }),
    [audioEngine, practiceEngine, score, playbackRange, playbackLoop]
  );

  // TASK-105: 楽譜表示への復帰導線（REQ-017-012）。楽譜読み込み済みかつ
  // ライブラリ画面表示中の場合のみ、Headerのライブラリボタンを「楽譜へ戻る」表示にし、
  // クリック時もscoreへ戻すトグルとして扱う。楽譜未読み込み時は従来通りライブラリを
  // 開く導線のみとする（戻り先がないため）。
  const isReturnToScoreMode = Boolean(score) && activeView === 'library';

  return (
    <div
      data-testid="app-container"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ display: 'flex', flexDirection: 'column', height: '100vh', position: 'relative' }}
    >
      {/* 1. Header: 1行ヘッダー（TASK-075、design/components/header.md）。
          頻用操作（開く/再生/停止/ループ/テンポ/練習対象）を常時表示し、
          低頻度操作（音量・表示倍率・運指・メトロノーム・成績）はQuickPanelへ移設する。
          ライブラリ画面ではヘッダーを非表示（display:none）にし、楽譜画面のみ表示する。
          コンポーネントはアンマウントせずCSSで隠す（ScoreRenderer/PianoKeyboardと
          同パターン。App.test.tsxの多数の結線テストがHeaderの常時マウントを
          前提としているため）。 */}
      <div style={{ flexShrink: 0, display: activeView === 'score' ? 'block' : 'none' }}>
        <Header
          onOpenFile={handleOpenFile}
          onOpenSettings={() => setIsSettingsOpen(true)}
          audioEngine={playbackAudioEngine}
          score={score}
          onFingeringSuggested={handleFingering}
          fingeringDisabled={isLoadingAnnotations}
          onOpenLibrary={() => setActiveView(isReturnToScoreMode ? 'score' : 'library')}
          isReturnToScoreMode={isReturnToScoreMode}
          fingeringEditMode={fingeringEditMode}
          onFingeringEditModeChange={setFingeringEditMode}
        />
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        webMidiService={webMidiService}
      />

      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />

      {/* 2. ScoreRenderer (Flex Grow) */}
      {/*
        このコンテナはflexアイテムとして高さを確定させる役割のみを持つ。
        overflow は指定しない（スクロールコンテナは ScoreRenderer 内部の
        単一コンテナに一本化し、二重スクロールを避けるため）。
        display: flex/flexDirection: column を設定することで、
        子である ScoreRenderer の flexGrow:1 が有効になり、
        利用可能な高さを正しく継承できるようにする。
      */}
      {/* TASK-103: 楽譜画面はactiveView==='score'の間のみ表示する。ScoreRenderer/
          PianoKeyboardはアンマウントせずdisplay:noneで隠す（既存の多数の結線テストが
          両コンポーネントの常時マウントを前提としているため、CSS上の可視性のみを
          切り替えることで挙動を変えずに画面切り替えを実現する）。 */}
      <div
        style={{
          flexGrow: 1,
          minHeight: 0,
          display: activeView === 'score' ? 'flex' : 'none',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        <ScoreRenderer
          score={score}
          musicXmlContent={musicXmlContent}
          musicXmlPath={musicXmlPath}
          currentNoteId={currentNoteId}
          practiceMode={practiceMode}
          loopRange={loopRange}
          zoom={zoom}
          onZoomChange={setZoom}
          scoreLayout={scoreLayout}
          onScoreLayoutChange={setScoreLayout}
          onNoteClick={handleNoteClick}
          annotations={displayedAnnotations}
          noteHighlights={noteHighlights}
          onNoteContextMenu={handleNoteContextMenu}
          fingeringEditMode={fingeringEditMode}
          onFingeringClick={handleFingeringPick}
        />
        {/* TASK-053: 楽譜未ロード時のドロップ可能表示（US-001 画面/UI要件）。
            ScoreRenderer自体の「楽譜ファイルを開いてください」プレースホルダとは
            独立に、上部バナーとして表示することで重なりを避ける。 */}
        {!score && (
          <div
            data-testid="drop-zone-hint"
            style={{
              position: 'absolute',
              top: 12,
              left: 0,
              right: 0,
              textAlign: 'center',
              color: '#18181b',
              fontSize: '14px',
              pointerEvents: 'none',
            }}
          >
            {t.app.dropHint}
          </div>
        )}
      </div>

      {/* TASK-103: ライブラリ画面（US-017）。起動時（activeView初期値'library'）は
          楽譜未読み込みでもここが表示される（REQ-017-010）。 */}
      {activeView === 'library' && (
        <div style={{ flexGrow: 1, minHeight: 0, overflow: 'auto' }}>
          <LibraryView
            onOpenEntry={handleOpenLibraryEntry}
            onOpenFileDialog={handleOpenFile}
            missingPaths={missingLibraryPaths}
            reloadSignal={libraryReloadSignal}
            onReturnToScore={score ? () => setActiveView('score') : undefined}
            onOpenSettings={() => setIsSettingsOpen(true)}
            />
        </div>
      )}

      {/* TASK-103: ライブラリから開こうとしたファイルが見つからなかった場合の
          確認ダイアログ（REQ-017-008）。window.confirmではなくアプリ内確認UIを使う
          （プロジェクトの既存の確認パターンに合わせる、LibraryView内の削除確認と同様）。 */}
      {missingEntryPath && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            role="dialog"
            aria-label={t.library.missingEntryConfirmTitle}
            style={{
              backgroundColor: '#fff',
              color: '#111827',
              borderRadius: '8px',
              minWidth: '320px',
              maxWidth: '90vw',
              padding: '20px 24px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            }}
          >
            <p style={{ margin: '0 0 16px 0', fontSize: '0.9375rem' }}>
              {t.library.missingEntryConfirmMessage}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={handleKeepMissingEntry}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f3f4f6',
                  color: '#111827',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                {t.library.confirmDeleteCancelButton}
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveMissingEntry}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                {t.library.confirmDeleteConfirmButton}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TASK-053: ドラッグオーバー中の視覚フィードバック。アプリ全体への
          ドロップを受け付けるため、ヘッダー/楽譜/鍵盤を横断してオーバーレイ表示する。 */}
      {isDraggingOver && (
        <div
          data-testid="drag-active-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            border: '3px dashed #18181b',
            backgroundColor: 'rgba(24, 24, 27, 0.05)',
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        />
      )}

      {noteContextMenu && (
        <NoteContextMenu
          noteId={noteContextMenu.noteId}
          x={noteContextMenu.x}
          y={noteContextMenu.y}
          annotation={activeNoteAnnotation}
          onSelectFinger={(finger) => handleSelectFinger(noteContextMenu.noteId, finger)}
          onRemoveFinger={() => handleRemoveFinger(noteContextMenu.noteId)}
          onSaveComment={(comment) => handleSaveComment(noteContextMenu.noteId, comment)}
          onApprove={() => handleApproveAnnotation(noteContextMenu.noteId)}
          onClose={closeNoteContextMenu}
        />
      )}

      {fingeringPicker && (
        <FingeringPicker
          noteId={fingeringPicker.noteId}
          x={fingeringPicker.x}
          y={fingeringPicker.y}
          currentFinger={pickedNoteAnnotation?.fingerNumber}
          onSelectFinger={handleFingerPicked}
          onClose={closeFingeringPicker}
        />
      )}

      {/* 3. PianoKeyboard (Fixed Footer)。TASK-103: 楽譜画面表示中のみ表示する
          （常時マウントの理由はScoreRendererコンテナのコメントと同様）。 */}
      <div style={{ flexShrink: 0, display: activeView === 'score' ? 'block' : 'none' }}>
        <PianoKeyboard
          expectedNotes={expectedNotes}
          pressedKeys={pressedKeys}
          incorrectKeys={incorrectKeys}
          annotations={displayedAnnotations}
          practiceMode={practiceMode}
          onKeyClick={handleKeyClick}
          height={pianoHeight}
          keyboardSize={keyboardSize}
          soundingNotes={soundingNotes}
        />
      </div>

      {/* 楽譜読込中の全画面オーバーレイ。ライブラリ/ダイアログ/D&D のいずれの経路でも
          openMusicXmlFile の最初から最後まで isLoadingScore が true になるため、
          その間ユーザーへ「読込中」フィードバックを与える。
          activeView に依存せず常に最前面に表示する（ライブラリ画面で待機中も覆う）。 */}
      {isLoadingScore && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.35)',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              padding: '24px 32px',
              borderRadius: 12,
              backgroundColor: '#fff',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 16,
              fontWeight: 500,
              color: '#333',
            }}
          >
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                border: '3px solid #ddd',
                borderTopColor: '#666',
                animation: 'app-loading-spin 0.8s linear infinite',
              }}
            />
            {t.app.loadingScore}
            <style>{`@keyframes app-loading-spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
