import React from 'react';
    import ReactDOM from 'react-dom/client';
    import App from './App';
    import './index.css';

    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );

    const modalRoot = document.getElementById('modal-root');
    ReactDOM.createRoot(modalRoot).render(
      <div id="modal-container"></div>
    );
