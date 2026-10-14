import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StrategiesPage from './StrategiesPage';

jest.mock('../components/WeekendMomentum', () => ({
  __esModule: true,
  default: () => <div>weekend-momentum</div>,
}));
jest.mock('../components/NewsStraddle', () => ({
  __esModule: true,
  default: () => <div>news-straddle</div>,
}));
jest.mock('../components/MarketDepth', () => ({
  __esModule: true,
  default: () => <div>market-depth</div>,
}));
jest.mock('../components/VolatilityPuts', () => ({
  __esModule: true,
  default: () => (
    <div data-testid="sse-status">
      Live stop desk
    </div>
  ),
}));

function renderStrategies(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/strategies${search}`]}>
      <StrategiesPage />
    </MemoryRouter>
  );
}

describe('StrategiesPage', () => {
  it('keeps the volatility desk mounted so MU/NBIS events keep building off-tab', () => {
    renderStrategies('?tab=market-depth');
    expect(screen.getByText('market-depth')).toBeTruthy();
    expect(screen.getByTestId('sse-status')).toBeTruthy();
    expect(screen.getByText('Live stop desk')).toBeTruthy();
  });
});
