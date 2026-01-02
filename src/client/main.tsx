import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// Plugins are loaded dynamically from the project's plugins folder
// See src/client/plugins for the plugin loading mechanism

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
