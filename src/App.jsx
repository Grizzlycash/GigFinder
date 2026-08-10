import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { currentUser } from '@/store/store';
import { useStoreSync } from '@/store/useStore';

import Landing from '@/routes/Landing';
import Onboarding from '@/routes/Onboarding';
import Dashboard from '@/routes/Dashboard';
import Venues from '@/routes/Venues';
import MapView from '@/routes/MapView';
import EpkList from '@/routes/EpkList';
import EpkEditor from '@/routes/EpkEditor';
import SendEpk from '@/routes/SendEpk';
import Tracker from '@/routes/Tracker';
import Lists from '@/routes/Lists';
import Pricing from '@/routes/Pricing';
import Settings from '@/routes/Settings';
import Admin from '@/routes/Admin';

function Protected({ admin = false, children }) {
  const user = currentUser();
  const { pathname } = useLocation();

  if (!user) return <Navigate to="/" replace />;
  if (!user.onboarded && pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  if (admin && !user.isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  useStoreSync();
  const user = currentUser();

  return (
    <Routes>
      <Route path="/" element={user?.onboarded ? <Navigate to="/dashboard" replace /> : <Landing />} />
      <Route path="/onboarding" element={user ? <Onboarding /> : <Navigate to="/" replace />} />

      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/venues" element={<Protected><Venues /></Protected>} />
      <Route path="/venues/:id" element={<Protected><Venues /></Protected>} />
      <Route path="/map" element={<Protected><MapView /></Protected>} />
      <Route path="/epk" element={<Protected><EpkList /></Protected>} />
      <Route path="/epk/:id" element={<Protected><EpkEditor /></Protected>} />
      <Route path="/send" element={<Protected><SendEpk /></Protected>} />
      <Route path="/outreach" element={<Protected><Tracker /></Protected>} />
      <Route path="/lists" element={<Protected><Lists /></Protected>} />
      <Route path="/pricing" element={<Protected><Pricing /></Protected>} />
      <Route path="/settings" element={<Protected><Settings /></Protected>} />

      <Route path="/admin" element={<Navigate to="/admin/overview" replace />} />
      <Route path="/admin/:tab" element={<Protected admin><Admin /></Protected>} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
