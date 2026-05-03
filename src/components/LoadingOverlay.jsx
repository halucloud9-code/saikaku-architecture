import LoadingScreen from '../screens/LoadingScreen';
import UaamLoadingScreen from '../screens/uaam/UAAMLoadingScreen';

export default function LoadingOverlay({ kind }) {
  const Screen = kind === 'uaam' ? UaamLoadingScreen : LoadingScreen;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: kind === 'uaam' ? '#F5F0E8' : '#0A0908',
      }}
    >
      <Screen />
    </div>
  );
}
