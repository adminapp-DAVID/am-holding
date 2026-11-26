import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import AvisoVersionNueva from './components/AvisoVersionNueva';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
    <AvisoVersionNueva />
  </React.StrictMode>
);
