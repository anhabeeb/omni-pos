import React from 'react';
import ReactDOM from 'react-dom/client';
// Fix: App.tsx uses named exports for its components and hooks (like useAuth), so App must be imported as a named export.
import { App } from './App';
import { db } from './services/db';

const initApp = async () => {
  try {
    // Initialize the database (creates default admin and stores if not present)
    await db.init();
    
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      throw new Error("Could not find root element to mount to");
    }

    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error("Critical: Application failed to initialize database.", error);
    // Display a basic error if DB fails to init
    document.body.innerHTML = `
      <div style="padding: 40px; text-align: center; color: #ef4444; font-family: system-ui, -apple-system, sans-serif;">
        <h2 style="font-weight: 800; margin-bottom: 10px;">System Initialization Error</h2>
        <p style="color: #6b7280;">Could not initialize the local database. Please refresh the page or clear your browser storage.</p>
      </div>
    `;
  }
};

initApp();