import React from 'react';
import { Toolbar } from './components/Toolbar';
import { ScoreRenderer } from './components/ScoreRenderer';
import { PianoKeyboard } from './components/PianoKeyboard';
import { usePracticeStore } from './store';
import { useShallow } from 'zustand/react/shallow';
import { parse, parseMxl } from './lib/musicxml-parser';

function App(): React.JSX.Element {
  const {
    score,
    expectedNotes,
    pressedKeys,
    incorrectKeys,
    practiceMode,
    zoom,
    pianoHeight,
    setScore,
  } = usePracticeStore(
    useShallow((s) => ({
      score: s.score,
      expectedNotes: s.expectedNotes,
      pressedKeys: s.pressedKeys,
      incorrectKeys: s.incorrectKeys,
      practiceMode: s.practiceMode,
      zoom: s.zoom,
      pianoHeight: s.pianoHeight,
      setScore: s.setScore,
    }))
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

    try {
      let parsedScore;
      if (filePath.endsWith('.mxl')) {
        const buffer = await window.electronAPI.file.readBinary(filePath);
        parsedScore = parseMxl(buffer);
      } else {
        const content = await window.electronAPI.file.read(filePath);
        parsedScore = parse(content);
      }
      setScore(parsedScore, filePath);
    } catch (error) {
      console.error('Failed to parse file:', error);
      alert('MusicXML ファイルの解析に失敗しました。ファイル形式を確認してください。');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* 1. Toolbar (Fixed Header) */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ padding: '8px', backgroundColor: '#e0e0e0', display: 'flex', gap: '8px' }}>
          <button onClick={handleOpenFile} style={{ padding: '4px 12px', cursor: 'pointer' }}>
            Open File
          </button>
        </div>
        <Toolbar />
      </div>

      {/* 2. ScoreRenderer (Flex Grow) */}
      <div style={{ flexGrow: 1, minHeight: 0, overflow: 'hidden' }}>
        <ScoreRenderer
          score={score}
          currentNoteId={null}
          practiceMode={practiceMode}
          loopRange={null}
          zoom={zoom}
          onNoteClick={() => {}}
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
          onKeyClick={() => {}}
          height={pianoHeight}
        />
      </div>
    </div>
  );
}

export default App;
