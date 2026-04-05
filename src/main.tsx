import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { registerServiceWorker, syncReminderToSW } from './lib/notifications'

registerServiceWorker().then(() => {
  // Give SW a moment to activate, then sync reminder settings
  setTimeout(syncReminderToSW, 1000);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
