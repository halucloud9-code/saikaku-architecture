import { Navigate, Outlet, useOutletContext } from 'react-router-dom';

function Spinner() {
  return (
    <div style={{ background: '#F5F0E8', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #D4C9B0', borderTopColor: '#C4922A', animation: 'spin 1s linear infinite' }} />
    </div>
  );
}

export default function RequireAdmin() {
  const context = useOutletContext();

  if (context?.authLoading) return <Spinner />;
  if (!context?.isAdmin) return <Navigate to="/" replace />;

  return <Outlet context={context} />;
}
