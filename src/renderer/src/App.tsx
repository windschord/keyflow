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
import type { FingerAssignment } from './types';

function App(): React.JSX.Element {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isLoadingAnnotations, setIsLoadingAnnotations] = React.useState(false);
  const [fingeringAnnotations, setFingeringAnnotations] = React.useState<FingerAssignment[]>([]);

  const { practiceEngine } = usePractice();

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
    currentMeasure,
    currentNoteIndex,
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
      currentMeasure: s.currentMeasure,
      currentNoteIndex: s.currentNoteIndex,
    }))
  );

  const currentNoteId =
    score?.measures.find((m) => m.number === currentMeasure)?.notes[currentNoteIndex]?.id || null;

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
      let parsedScore;
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
      setFingeringAnnotations([]);
      await annotationStore.current.load(filePath);
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
            Open File
          </button>
          <div style={{ width: '1px', height: '28px', backgroundColor: '#bbb' }} />
          <FingeringPanel
            score={score}
            onSuggested={handleFingering}
            disabled={isLoadingAnnotations}
          />
        </div>
        <Toolbar onOpenSettings={() => setIsSettingsOpen(true)} />
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
          loopRange={null}
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
          onKeyClick={(midiNumber) => {
            practiceEngine.handleNoteOn({
              midiNumber,
              velocity: 100,
              type: 'note-on',
              timestamp: Date.now(),
            });
            setTimeout(() => {
              practiceEngine.handleNoteOff({
                midiNumber,
                velocity: 0,
                type: 'note-off',
                timestamp: Date.now(),
              });
            }, 200); // Simulate momentary click
          }}
          height={pianoHeight}
        />
      </div>
    </div>
  );
}

export default App;
