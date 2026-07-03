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

function App(): React.JSX.Element {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isLoadingAnnotations, setIsLoadingAnnotations] = React.useState(false);
  const [fingeringAnnotations, setFingeringAnnotations] = React.useState<
    import('./types').FingerAssignment[]
  >([]);

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
    async (assignments: import('./types').FingerAssignment[]) => {
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
      {/* 1. Toolbar (Fixed Header) */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ padding: '8px', backgroundColor: '#e0e0e0', display: 'flex', gap: '8px' }}>
          <button onClick={handleOpenFile} style={{ padding: '4px 12px', cursor: 'pointer' }}>
            Open File
          </button>
        </div>
        <Toolbar onOpenSettings={() => setIsSettingsOpen(true)} />
      </div>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* 2. FingeringPanel */}
      <div style={{ flexShrink: 0 }}>
        <FingeringPanel
          score={score}
          onSuggested={handleFingering}
          disabled={isLoadingAnnotations}
        />
      </div>

      {/* 3. ScoreRenderer (Flex Grow) */}
      <div style={{ flexGrow: 1, minHeight: 0, overflow: 'hidden' }}>
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
