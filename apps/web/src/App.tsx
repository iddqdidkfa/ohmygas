import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { uk } from './uk';
import DiscountsPage from './pages/DiscountsPage';
import MapPage from './pages/MapPage';
import PricesPage from './pages/PricesPage';

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <strong className="logo">⛽ OhMyGas</strong>
        <nav>
          <NavLink to="/map">{uk.nav.map}</NavLink>
          <NavLink to="/prices">{uk.nav.prices}</NavLink>
          <NavLink to="/discounts">{uk.nav.discounts}</NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/map" element={<MapPage />} />
          <Route path="/prices" element={<PricesPage />} />
          <Route path="/discounts" element={<DiscountsPage />} />
          <Route path="*" element={<Navigate to="/map" replace />} />
        </Routes>
      </main>
    </div>
  );
}
