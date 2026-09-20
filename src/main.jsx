import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';

// SPA GitHub Pages Redirection Handler:
// Intercepts the query parameter (?p=) injected by 404.html and restores the clean browser URL state
(function() {
  var q = window.location.search;
  if (q && q.indexOf('?p=') === 0) {
    var parser = document.createElement('a');
    parser.href = q.slice(3).replace(/~and~/g, '&');
    
    var path = parser.pathname;
    var query = parser.search;
    var hash = parser.hash;

    window.history.replaceState(
      null,
      null,
      path + query + hash
    );
  }
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename="/course_plat">
      <App />
    </BrowserRouter>
  </React.StrictMode>
);