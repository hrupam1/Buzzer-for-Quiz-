import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import HostDashboard from './pages/HostDashboard';
import TeamDashboard from './pages/TeamDashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/host/:roomCode" element={<HostDashboard />} />
        <Route path="/team/:roomCode" element={<TeamDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
