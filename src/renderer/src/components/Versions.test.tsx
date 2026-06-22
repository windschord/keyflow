import { render } from '@testing-library/react';
import Versions from './Versions';

describe('Versions', () => {
  it('renders without crashing', () => {
    Object.defineProperty(window, 'electron', {
      value: {
        process: {
          versions: {
            node: 'v18',
            chrome: 'v100',
            electron: 'v29',
          }
        }
      },
      writable: true,
    });

    render(<Versions />);
  });
});
