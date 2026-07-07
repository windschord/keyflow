import React from 'react';
import { Header } from './components/Header';
import { ScoreRenderer } from './components/ScoreRenderer';
import { PianoKeyboard } from './components/PianoKeyboard';
import { NoteContextMenu } from './components/NoteContextMenu';
import { usePracticeStore } from './store';
import { useShallow } from 'zustand/react/shallow';
import { parse, extractXmlFromMxl } from './lib/musicxml-parser';
import { SettingsModal } from './components/SettingsModal';
import { usePractice } from './hooks/usePractice';
import { AnnotationStoreService } from './lib/annotation-store';
import { groupNotesByStartTick } from './lib/practice-engine/note-grouping';
import { PLAYBACK_VOICES } from './lib/audio-engine/voices';
import { METRONOME_VOICES } from './lib/audio-engine/metronome-voices';
import type { Annotation, Finger, FingerAssignment, Note, Score } from './types';

// TASK-053: ドラッグ＆ドロップで受け付けるMusicXMLの拡張子（大文字小文字を区別しない）。
// Main側のfile:register-dropped-fileハンドラでも同様に検証する（多層防御）。
const ACCEPTED_DROP_EXTENSIONS = ['.xml', '.musicxml', '.mxl'];

function hasAcceptedDropExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return ACCEPTED_DROP_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

const UNSUPPORTED_DROP_MESSAGE =
  '対応していないファイル形式です。.xml / .musicxml / .mxl ファイルをドロップしてください。';

function App(): React.JSX.Element {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isLoadingAnnotations, setIsLoadingAnnotations] = React.useState(false);
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
    pianoHeight,
    showFingerings,
    keyboardSize,
    setScore,
    setOriginalBpm,
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
    currentMeasure,
    currentNoteIndex,
    loopEnabled,
    loopStart,
    loopEnd,
    playbackState,
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
      pianoHeight: s.pianoHeight,
      showFingerings: s.showFingerings,
      keyboardSize: s.keyboardSize,
      setScore: s.setScore,
      setOriginalBpm: s.setOriginalBpm,
      setMetronomeEnabled: s.setMetronomeEnabled,
      setMetronomeAccentEnabled: s.setMetronomeAccentEnabled,
      setErrorMode: s.setErrorMode,
      setZoom: s.setZoom,
      setPianoHeight: s.setPianoHeight,
      setMidiDeviceId: s.setMidiDeviceId,
      setVolume: s.setVolume,
      setShowFingerings: s.setShowFingerings,
      setKeyboardSize: s.setKeyboardSize,
      setPlaybackVoice: s.setPlaybackVoice,
      setMetronomeVoice: s.setMetronomeVoice,
      currentMeasure: s.currentMeasure,
      currentNoteIndex: s.currentNoteIndex,
      loopEnabled: s.loopEnabled,
      loopStart: s.loopStart,
      loopEnd: s.loopEnd,
      playbackState: s.playbackState,
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
  const displayedAnnotations = showFingerings ? keyboardAnnotations : [];

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
  React.useEffect(() => {
    (window as unknown as { __e2eStore__?: typeof usePracticeStore }).__e2eStore__ =
      usePracticeStore;
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
  //   （TASK-073, US-013: usePractice.ts側のuseEffectがaudioEngine.setPlaybackVoice /
  //   setMetronomeVoiceへ反映する）。
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
          if (typeof uiSettings.volume === 'number') {
            setVolume(uiSettings.volume);
          }
          if (typeof uiSettings.showFingerings === 'boolean') {
            setShowFingerings(uiSettings.showFingerings);
          }
          if (typeof uiSettings.keyboardSize === 'number') {
            setKeyboardSize(uiSettings.keyboardSize);
          }
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
  ]);

  // ダイアログ経由（handleOpenFile）・ドラッグ＆ドロップ経由（handleDrop）の両方から
  // 呼ばれる共通のオープン処理（TASK-053）。パース→setScore→初期化（練習位置リセット）
  // →アノテーション読込、の一連の流れを一本化し、どちらの経路でも同一の挙動を保証する。
  const openMusicXmlFile = React.useCallback(
    async (filePath: string): Promise<void> => {
      setIsLoadingAnnotations(true);
      try {
        let parsedScore: Score;
        let xmlContent: string;
        if (filePath.toLowerCase().endsWith('.mxl')) {
          const buffer = await window.electronAPI.file.readBinary(filePath);
          xmlContent = extractXmlFromMxl(buffer);
          parsedScore = parse(xmlContent);
        } else {
          xmlContent = await window.electronAPI.file.read(filePath);
          parsedScore = parse(xmlContent);
        }
        setScore(parsedScore, filePath, xmlContent);
        setOriginalBpm(parsedScore.tempo);
        // setScore が反映された後にリセットする必要がある（resetToMeasure は
        // store.getState().score を参照するため、呼び出し順序を変更しないこと）。
        practiceEngine.resetToMeasure(1);
        // audioEngine.loadScore は usePractice 側の score/practiceMode 監視エフェクト
        // （TASK-051）が同期して呼び出すため、ここでは明示的に呼ばない
        // （二重スケジューリングを避けるため）。
        setKeyboardAnnotations([]);
        setNoteContextMenu(null);
        const validNoteIds = new Set(
          parsedScore.measures.flatMap((measure) => measure.notes.map((note) => note.id))
        );
        const skippedNoteIds = await annotationStore.current.load(filePath, validNoteIds);
        if (skippedNoteIds.length > 0) {
          console.warn(
            `[App] noteId採番方式の変更（TASK-031）により ${skippedNoteIds.length} 件のアノテーションを読み込めませんでした:`,
            skippedNoteIds
          );
        }
        setKeyboardAnnotations(annotationStore.current.getAllAnnotations());
      } catch (error) {
        console.error('Failed to parse file:', error);
        alert('MusicXML ファイルの解析に失敗しました。ファイル形式を確認してください。');
      } finally {
        setIsLoadingAnnotations(false);
      }
    },
    [practiceEngine, setOriginalBpm, setScore]
  );

  const handleOpenFile = async () => {
    if (!window.electronAPI) {
      alert('Electron API が利用できません。Electron アプリとして起動してください。');
      return;
    }

    let filePath: string | null = null;
    try {
      filePath = await window.electronAPI.file.showOpenDialog();
    } catch (error) {
      console.error('Failed to open dialog:', error);
      alert('ファイル選択ダイアログを開けませんでした。');
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
        alert('Electron API が利用できません。Electron アプリとして起動してください。');
        return;
      }

      // 複数ファイルが同時にドロップされた場合は、先頭のファイルのみを対象とする
      // （2番目以降が対応拡張子であっても開かない）。
      const file = event.dataTransfer.files[0];
      if (!file) return;

      if (!hasAcceptedDropExtension(file.name)) {
        alert(UNSUPPORTED_DROP_MESSAGE);
        return;
      }

      let filePath = '';
      try {
        filePath = window.electronAPI.file.getDroppedFilePath(file);
      } catch (error) {
        console.error('Failed to resolve dropped file path:', error);
      }

      if (!filePath) {
        alert('ドロップされたファイルのパスを取得できませんでした。');
        return;
      }

      // D&D で開いたファイルも file:write（アノテーション保存）の allowlist・
      // ファイル履歴に載せる必要があるため、Main 側の登録 IPC を経由する
      // （Main 側でも拡張子を検証する多層防御。TASK-053）。
      const registered = await window.electronAPI.file.registerDroppedFile(filePath);
      if (!registered) {
        alert(UNSUPPORTED_DROP_MESSAGE);
        return;
      }

      await openMusicXmlFile(filePath);
    },
    [openMusicXmlFile]
  );

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
        alert('運指アノテーションの保存に失敗しました。');
      }
    },
    [musicXmlPath, isLoadingAnnotations, showFingerings, setShowFingerings]
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

  // annotation-store への変更後、JSONサイドカーへ即時永続化し（REQ-008-004）、
  // 鍵盤・楽譜の指番号表示を更新する（handleFingering:173-187と同じ
  // エラーハンドリング＝失敗時alert）。
  const persistAnnotationChange = React.useCallback(async () => {
    try {
      await annotationStore.current.save();
      setKeyboardAnnotations(annotationStore.current.getAllAnnotations());
    } catch (error) {
      console.error('Failed to save annotation:', error);
      alert('運指メモの保存に失敗しました。');
    }
  }, []);

  const handleSelectFinger = React.useCallback(
    async (noteId: string, finger: Finger) => {
      annotationStore.current.setFinger(noteId, finger);
      await persistAnnotationChange();
      setNoteContextMenu(null);
    },
    [persistAnnotationChange]
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
        const startTick = practiceEngine.getCurrentPositionTick();
        audioEngine.playAccompaniment(startTick ?? undefined);
      },
      pauseAccompaniment: () => audioEngine.pauseAccompaniment(),
      stopAccompaniment: () => audioEngine.stopAccompaniment(),
    }),
    [audioEngine, practiceEngine]
  );

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
          低頻度操作（音量・表示倍率・運指・メトロノーム・成績）はQuickPanelへ移設する。 */}
      <div style={{ flexShrink: 0 }}>
        <Header
          onOpenFile={handleOpenFile}
          onOpenSettings={() => setIsSettingsOpen(true)}
          audioEngine={playbackAudioEngine}
          score={score}
          onFingeringSuggested={handleFingering}
          fingeringDisabled={isLoadingAnnotations}
        />
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        webMidiService={webMidiService}
      />

      {/* 2. ScoreRenderer (Flex Grow) */}
      {/*
        このコンテナはflexアイテムとして高さを確定させる役割のみを持つ。
        overflow は指定しない（スクロールコンテナは ScoreRenderer 内部の
        単一コンテナに一本化し、二重スクロールを避けるため）。
        display: flex/flexDirection: column を設定することで、
        子である ScoreRenderer の flexGrow:1 が有効になり、
        利用可能な高さを正しく継承できるようにする。
      */}
      <div
        style={{
          flexGrow: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        <ScoreRenderer
          score={score}
          musicXmlContent={musicXmlContent}
          currentNoteId={currentNoteId}
          practiceMode={practiceMode}
          loopRange={loopRange}
          zoom={zoom}
          onNoteClick={handleNoteClick}
          annotations={displayedAnnotations}
          noteHighlights={noteHighlights}
          onNoteContextMenu={handleNoteContextMenu}
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
              color: '#2563eb',
              fontSize: '14px',
              pointerEvents: 'none',
            }}
          >
            ここにMusicXMLファイルをドロップ（またはファイルを開く）
          </div>
        )}
      </div>

      {/* TASK-053: ドラッグオーバー中の視覚フィードバック。アプリ全体への
          ドロップを受け付けるため、ヘッダー/楽譜/鍵盤を横断してオーバーレイ表示する。 */}
      {isDraggingOver && (
        <div
          data-testid="drag-active-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            border: '3px dashed #2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.08)',
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

      {/* 3. PianoKeyboard (Fixed Footer) */}
      <div style={{ flexShrink: 0 }}>
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
    </div>
  );
}

export default App;
