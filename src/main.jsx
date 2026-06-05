import React from 'react';
import ReactDOM from 'react-dom/client';
import AppRouter from './App.jsx';
import AlphaApp from './alpha/AlphaApp.jsx';
import ProgressApp from './alpha-progress/ProgressApp.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import './index.css';

// /alpha-progress は /alpha を prefix に含むため、必ず先に判定する
const path = window.location.pathname;
const Root = path.startsWith('/alpha-progress') ? ProgressApp
  : path.startsWith('/alpha') ? AlphaApp
  : AppRouter;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </React.StrictMode>
);
