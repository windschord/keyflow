import React from 'react';
import { Toolbar } from './components/Toolbar';
import { ScoreRenderer } from './components/ScoreRenderer';
import { PianoKeyboard } from './components/PianoKeyboard';
import { usePracticeStore } from './store';

function App(): React.JSX.Element {
  const {
    score,
    practiceMode,
    zoom,
    pianoHeight,
    expectedNotes,
    pressedKeys,
    incorrectKeys
  } = usePracticeStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* 1. Toolbar (Fixed Header) */}
      <div style={{ flexShrink: 0 }}>
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
