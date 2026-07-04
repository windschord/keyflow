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
import type { FingerAssignment, Hand, PracticeMode, Score } from './types';

/**
 * 練習対象パート（practiceMode）から、自動伴奏の対象となる非練習パートを決定する。
 *
 * 片手のみ練習する場合は反対側の手を自動伴奏として再生する。
 * 両手とも練習対象の場合は自動伴奏すべき非練習パートが存在しないため、
 * AudioEngineService 側のデフォルト挙動（全パート再生）にフォールバックする
 * 'unknown' を渡す（暫定実装。詳細な仕様は TASK-029 で再定義予定）。
 */
function getAccompanimentHand(practiceMode: PracticeMode): Hand {
  if (practiceMode === 'left') return 'right';
  if (practiceMode === 'right') return 'left';
  return 'unknown';
}

function App(): React.JSX.Element {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isLoadingAnnotations, setIsLoadingAnnotations] = React.useState(false);
  const [fingeringAnnotations, setFingeringAnnotations] = React.useState<FingerAssignment[]>([]);

  const { practiceEngine, audioEngine, handleKeyClick } = usePractice();

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

  // アプリ起動時に、SettingsModal（electron-store）で設定された
  // 「Enable Metronome by Default」の既定値を ui-slice の metronomeEnabled へ反映する。
  // ui-slice の metronomeEnabled を単一の真実源とし、起動後はツールバーのチェック
  // ボックス操作や SettingsModal での変更がこの値を更新する。
  React.useEffect(() => {
    if (!window.electronAPI?.settings) return;

    let cancelled = false;
    const loadDefaultMetronomeSetting = async (): Promise<void> => {
      try {
        const practiceSettings = await window.electronAPI.settings.get('practice');
        if (!cancelled && practiceSettings) {
          setMetronomeEnabled(practiceSettings.metronomeEnabled);
        }
      } catch (error) {
        console.error('Failed to load default practice settings:', error);
      }
    };

    loadDefaultMetronomeSetting();

    return () => {
      cancelled = true;
    };
  }, [setMetronomeEnabled]);

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
      await audioEngine.loadAccompaniment(parsedScore, getAccompanimentHand(practiceMode));
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
      } catch (error) {
        console.error('Failed to save fingering annotations:', error);
        alert('運指アノテーションの保存に失敗しました。');
      }
    },
    [musicXmlPath, isLoadingAnnotations]
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

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

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
          onNoteClick={() => {}}
          annotations={fingeringAnnotations}
        />
      </div>

      {/* 3. PianoKeyboard (Fixed Footer) */}
      <div style={{ flexShrink: 0 }}>
        <PianoKeyboard
          expectedNotes={expectedNotes}
          pressedKeys={pressedKeys}
          incorrectKeys={incorrectKeys}
          annotations={[]}
          practiceMode={practiceMode}
          onKeyClick={handleKeyClick}
          height={pianoHeight}
        />
      </div>
    </div>
  );
}

export default App;
