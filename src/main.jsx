import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';

const redirect = sessionStorage.redirect;
if (redirect && redirect !== location.href) {
  delete sessionStorage.redirect;
  history.replaceState(null, '', new URL(redirect).pathname + new URL(redirect).search + new URL(redirect).hash);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);