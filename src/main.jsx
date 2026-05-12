import React from 'react';
import ReactDOM from 'react-dom/client';
import AppRouter from './App.jsx';
import AlphaApp from './alpha/AlphaApp.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import './index.css';

const Root = window.location.pathname.startsWith('/alpha') ? AlphaApp : AppRouter;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </React.StrictMode>
);
