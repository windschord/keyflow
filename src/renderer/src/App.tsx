import React from 'react';
import { Toolbar } from './components/Toolbar';
import { ScoreRenderer } from './components/ScoreRenderer';
import { PianoKeyboard } from './components/PianoKeyboard';
import { FingeringPanel } from './components/FingeringPanel';
import { usePracticeStore } from './store';
import { useShallow } from 'zustand/react/shallow';
import { parse, extractXmlFromMxl } from './lib/musicxml-parser';
import { SettingsModal } from './components/SettingsModal';
import { usePractice } from './hooks/usePractice';
import { AnnotationStoreService } from './lib/annotation-store';
import { groupNotesByStartTick } from './lib/practice-engine/note-grouping';
import type { Annotation, FingerAssignment, Note, Score } from './types';

function App(): React.JSX.Element {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isLoadingAnnotations, setIsLoadingAnnotations] = React.useState(false);
  const [fingeringAnnotations, setFingeringAnnotations] = React.useState<FingerAssignment[]>([]);
  // annotation-store が保持する運指メモ（手動入力・AI提案）の実データ。
  // PianoKeyboard に渡し、鍵盤上の指番号表示に反映する（REQ-005-007）。
  const [keyboardAnnotations, setKeyboardAnnotations] = React.useState<Annotation[]>([]);

  const { practiceEngine, audioEngine, webMidiService, handleKeyClick, noteHighlights } =
    usePractice();

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
    setScore,
    setOriginalBpm,
    setMetronomeEnabled,
    setErrorMode,
    setZoom,
    setPianoHeight,
    setMidiDeviceId,
    currentMeasure,
    currentNoteIndex,
    loopEnabled,
    loopStart,
    loopEnd,
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
      setScore: s.setScore,
      setOriginalBpm: s.setOriginalBpm,
      setMetronomeEnabled: s.setMetronomeEnabled,
      setErrorMode: s.setErrorMode,
      setZoom: s.setZoom,
      setPianoHeight: s.setPianoHeight,
      setMidiDeviceId: s.setMidiDeviceId,
      currentMeasure: s.currentMeasure,
      currentNoteIndex: s.currentNoteIndex,
      loopEnabled: s.loopEnabled,
      loopStart: s.loopStart,
      loopEnd: s.loopEnd,
    }))
  );

  // ループが有効な場合のみ ScoreRenderer にループ範囲を渡す。
  // ScoreRenderer は loopRange に基づいて楽譜上にループ範囲を可視化する
  // （osmd-controller.ts の drawLoopBracket / clearLoopBracket）。
  const loopRange = loopEnabled ? { start: loopStart, end: loopEnd } : null;

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
  //   → ui-slice.metronomeEnabled / practice-slice.errorMode
  //   （TASK-040: これを行わないと practice-engine の 'pass' 分岐が本番経路で
  //   到達不能になる）。
  // - ui.zoom / ui.pianoHeight → ui-slice.zoom / ui-slice.pianoHeight
  //   （TASK-045: ズームUI・鍵盤高さ設定UIの永続化された値を反映する）。
  // - midi.selectedDeviceId → ui-slice.midiDeviceId
  //   （TASK-045, REQ-004-008: useMidiがmidiDeviceIdの変更を購読し、
  //   WebMidiService.setSelectedDeviceへ反映する）。
  React.useEffect(() => {
    if (!window.electronAPI?.settings) return;

    let cancelled = false;
    const loadPersistedSettings = async (): Promise<void> => {
      try {
        const [practiceSettings, uiSettings, midiSettings] = await Promise.all([
          window.electronAPI.settings.get('practice'),
          window.electronAPI.settings.get('ui'),
          window.electronAPI.settings.get('midi'),
        ]);
        if (cancelled) return;

        if (practiceSettings) {
          setMetronomeEnabled(practiceSettings.metronomeEnabled);
          setErrorMode(practiceSettings.defaultErrorMode);
        }
        if (uiSettings) {
          setZoom(uiSettings.zoom);
          setPianoHeight(uiSettings.pianoHeight);
        }
        if (midiSettings) {
          setMidiDeviceId(midiSettings.selectedDeviceId);
        }
      } catch (error) {
        console.error('Failed to load persisted settings:', error);
      }
    };

    loadPersistedSettings();

    return () => {
      cancelled = true;
    };
  }, [setMetronomeEnabled, setErrorMode, setZoom, setPianoHeight, setMidiDeviceId]);

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

    setIsLoadingAnnotations(true);
    try {
      let parsedScore: Score;
      let xmlContent: string;
      if (filePath.endsWith('.mxl') || filePath.endsWith('.MXL')) {
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
      audioEngine.loadScore(parsedScore);
      setFingeringAnnotations([]);
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
  };

  const handleFingering = React.useCallback(
    async (assignments: FingerAssignment[]) => {
      if (!musicXmlPath || isLoadingAnnotations) return;
      try {
        annotationStore.current.applyAISuggestions(assignments);
        await annotationStore.current.save();
        setFingeringAnnotations(assignments);
        setKeyboardAnnotations(annotationStore.current.getAllAnnotations());
      } catch (error) {
        console.error('Failed to save fingering annotations:', error);
        alert('運指アノテーションの保存に失敗しました。');
      }
    },
    [musicXmlPath, isLoadingAnnotations]
  );

  // 小節クリックによるカーソル移動（REQ-002-004）。
  // ScoreRenderer/OSMDControllerがクリック位置に最も近い音符を解決し、その音符が
  // 属する小節番号（note.measureNumber）へ practiceEngine.resetToMeasure で移動する。
  const handleNoteClick = React.useCallback(
    (note: Note) => {
      practiceEngine.resetToMeasure(note.measureNumber);
    },
    [practiceEngine]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* 1. Header bar: Open File + FingeringPanel */}
      <div style={{ flexShrink: 0 }}>
        <div
          style={{
            padding: '6px 12px',
            backgroundColor: '#e0e0e0',
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={handleOpenFile}
            title="MusicXMLファイルを開きます"
            style={{
              height: '44px',
              padding: '0 16px',
              fontSize: '16px',
              borderRadius: '6px',
              border: '1px solid #9ca3af',
              backgroundColor: 'white',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            ファイルを開く
          </button>
          <div style={{ width: '1px', height: '28px', backgroundColor: '#bbb' }} />
          <FingeringPanel
            score={score}
            onSuggested={handleFingering}
            disabled={isLoadingAnnotations}
          />
        </div>
        <Toolbar onOpenSettings={() => setIsSettingsOpen(true)} audioEngine={audioEngine} />
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
      <div style={{ flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <ScoreRenderer
          score={score}
          musicXmlContent={musicXmlContent}
          currentNoteId={currentNoteId}
          practiceMode={practiceMode}
          loopRange={loopRange}
          zoom={zoom}
          onNoteClick={handleNoteClick}
          annotations={fingeringAnnotations}
          noteHighlights={noteHighlights}
        />
      </div>

      {/* 3. PianoKeyboard (Fixed Footer) */}
      <div style={{ flexShrink: 0 }}>
        <PianoKeyboard
          expectedNotes={expectedNotes}
          pressedKeys={pressedKeys}
          incorrectKeys={incorrectKeys}
          annotations={keyboardAnnotations}
          practiceMode={practiceMode}
          onKeyClick={handleKeyClick}
          height={pianoHeight}
          parts={score?.parts ?? []}
        />
      </div>
    </div>
  );
}

export default App;
