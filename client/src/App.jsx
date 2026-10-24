import { useEffect, useState } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import {
  firebaseConfigMissing,
  getFirebaseMessaging,
  getServiceWorkerUrl,
  isFirebaseConfigured,
  vapidKey,
} from './firebase.js';
import './App.css';

const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

async function requestJson(path, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(`${apiUrl}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
    return result;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The request took too long. Check the backend and try again.', { cause: error });
    if (error instanceof TypeError) throw new Error('Could not reach the backend. Confirm it is running and try again.', { cause: error });
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(value);
}

function App() {
  const [permission, setPermission] = useState('Notification' in window ? Notification.permission : 'unsupported');
  const [registered, setRegistered] = useState(false);
  const [registeredCount, setRegisteredCount] = useState(0);
  const [backendOnline, setBackendOnline] = useState(false);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);
  const [title, setTitle] = useState('A little update');
  const [message, setMessage] = useState('Your Firebase push notification is working.');
  const [lastResult, setLastResult] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    let active = true;
    const checkHealth = () => requestJson('/api/health')
      .then((result) => {
        if (active) {
          setBackendOnline(true);
          setRegisteredCount(result.registeredBrowsers ?? 0);
        }
      })
      .catch(() => {
        if (active) setBackendOnline(false);
      });
    checkHealth();
    const interval = window.setInterval(checkHealth, 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured || !('Notification' in window)) return undefined;
    let unsubscribe;
    let active = true;
    getFirebaseMessaging()
      .then((messaging) => {
        if (active) {
          unsubscribe = onMessage(messaging, (payload) => {
            const notification = {
              id: `${Date.now()}-${Math.random()}`,
              title: payload.notification?.title || payload.data?.title || 'Untitled notification',
              body: payload.notification?.body || payload.data?.body || '',
              time: new Date(),
            };
            setHistory((items) => [notification, ...items].slice(0, 12));
          });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  async function enableNotifications() {
    setNotice(null);
    if (!('Notification' in window)) {
      setPermission('unsupported');
      setNotice({ type: 'error', text: 'This browser does not support web notifications.' });
      return;
    }
    if (!isFirebaseConfigured) {
      const missing = firebaseConfigMissing
        .map((key) => `VITE_FIREBASE_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`)
        .join(', ');
      setNotice({ type: 'error', text: `Add the missing Firebase settings: ${missing}.` });
      return;
    }
    if (!vapidKey) {
      setNotice({ type: 'error', text: 'Add VITE_FIREBASE_VAPID_KEY from your Firebase Web Push certificates.' });
      return;
    }
    if (Notification.permission === 'denied') {
      setPermission('denied');
      setNotice({ type: 'error', text: 'Notifications are blocked for this site. Allow them in your browser site settings, then try again.' });
      return;
    }

    setBusy('register');
    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== 'granted') {
        throw new Error(permissionResult === 'denied'
          ? 'Notifications were denied. Allow them in your browser site settings to continue.'
          : 'Notification permission was not granted.');
      }
      const messaging = await getFirebaseMessaging();
      const serviceWorkerRegistration = await navigator.serviceWorker.register(getServiceWorkerUrl());
      const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration });
      if (!token) throw new Error('Firebase did not return a registration token. Check the Web Push certificate and try again.');
      const result = await requestJson('/api/register-token', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      setRegistered(true);
      setRegisteredCount(result.registeredBrowsers ?? 1);
      setNotice({ type: 'success', text: 'This browser is registered and ready to receive notifications.' });
    } catch (error) {
      setRegistered(false);
      setNotice({ type: 'error', text: error.message || 'Could not register this browser.' });
    } finally {
      setBusy('');
    }
  }

  async function sendNotification(event) {
    event.preventDefault();
    setNotice(null);
    setLastResult(null);
    if (!title.trim() || !message.trim()) {
      setNotice({ type: 'error', text: 'Add both a title and message before sending.' });
      return;
    }
    setBusy('send');
    try {
      const result = await requestJson('/api/send', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), body: message.trim() }),
      });
      setLastResult(result);
      if (typeof result.registeredBrowsers === 'number') setRegisteredCount(result.registeredBrowsers);
      setNotice({ type: result.failureCount ? 'warning' : 'success', text: result.message || 'Notification send completed.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'Could not send the notification.' });
    } finally {
      setBusy('');
    }
  }

  return (
    <main className="dashboard">
      <aside className="sidebar" aria-label="Main navigation">
        <a className="brand" href="#overview" aria-label="Signal home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>signal<span className="brand-period">.</span></span>
        </a>
        <div className="sidebar-label">WORKSPACE</div>
        <a className="nav-item active" href="#overview"><span className="nav-icon">◫</span>Overview</a>
        <a className="nav-item" href="#compose"><span className="nav-icon">↗</span>Send a push</a>
        <a className="nav-item" href="#activity"><span className="nav-icon">◷</span>Activity</a>
        <div className="sidebar-bottom"><span className="sidebar-label">DEMO ENVIRONMENT</span><span className="environment-dot" /> Local development</div>
      </aside>

      <section className="main-content" id="overview">
        <header className="topbar"><span>Workspace <span className="crumb-divider">/</span> Push notifications</span><span className="topbar-date">FIREBASE CLOUD MESSAGING</span></header>
        <div className="page-intro">
          <div><p className="eyebrow">MESSAGING CONTROL ROOM <span className="eyebrow-line" /></p><h1>Push, with purpose.</h1><p className="intro-copy">Register a browser, then send a message straight to the device.</p></div>
          <div className="connection-pill" role="status"><span className={`status-dot ${backendOnline ? 'online' : ''}`} /><span>API {backendOnline ? 'connected' : 'offline'}</span></div>
        </div>

        {notice && <div className={`notice ${notice.type}`} role="status" aria-live="polite"><span className="notice-mark">{notice.type === 'error' ? '!' : notice.type === 'warning' ? '△' : '✓'}</span>{notice.text}<button type="button" aria-label="Dismiss message" onClick={() => setNotice(null)}>×</button></div>}

        <section className="status-grid" aria-label="Connection status">
          <article className="status-card firebase-card"><div className="status-card-head"><span className="card-icon firebase-icon">✳</span><span className={`mini-status ${isFirebaseConfigured ? 'online' : ''}`}>{isFirebaseConfigured ? 'CONFIGURED' : 'NEEDS SETUP'}</span></div><p className="card-label">Firebase project</p><p className="card-value">{isFirebaseConfigured ? import.meta.env.VITE_FIREBASE_PROJECT_ID : 'Not connected'}</p><p className="card-foot">{isFirebaseConfigured ? 'Web SDK configuration detected' : 'Check your client environment file'}</p></article>
          <article className="status-card browser-card"><div className="status-card-head"><span className="card-icon browser-icon">▣</span><span className={`mini-status ${permission === 'granted' ? 'online' : ''}`}>{permission === 'unsupported' ? 'UNSUPPORTED' : permission.toUpperCase()}</span></div><p className="card-label">Browser permission</p><p className="card-value">{permission === 'granted' ? 'Allowed' : permission === 'denied' ? 'Blocked' : permission === 'unsupported' ? 'Unavailable' : 'Not requested'}</p><p className="card-foot">Permission is requested only on click</p></article>
          <article className="status-card registered-card"><div className="status-card-head"><span className="card-icon registered-icon">⌁</span><span className={`mini-status ${registered ? 'online' : ''}`}>{registered ? 'READY' : 'NOT REGISTERED'}</span></div><p className="card-label">Registered browsers</p><p className="card-value count-value">{registeredCount}<span> {registeredCount === 1 ? 'device' : 'devices'}</span></p><p className="card-foot">{registered ? 'This browser can receive pushes' : 'Tokens are held in server memory'}</p></article>
        </section>

        <div className="work-grid">
          <section className="panel registration-panel">
            <div className="panel-heading"><div><p className="section-kicker">01 / DEVICE</p><h2>Connect this browser</h2></div><span className="step-number">01</span></div>
            <p className="panel-copy">Grant permission and register an FCM token for this browser. The token stays on the backend.</p>
            <div className={`registration-state ${registered ? 'is-ready' : ''}`}><span className="state-symbol">{registered ? '✓' : '⌁'}</span><div><strong>{registered ? 'Ready for delivery' : 'Waiting for a device'}</strong><span>{registered ? 'You can send a test push now.' : 'Your browser has not been registered yet.'}</span></div></div>
            <button className="button button-dark" type="button" onClick={enableNotifications} disabled={busy !== '' || registered || !backendOnline}>{busy === 'register' ? <><span className="spinner" /> Registering…</> : registered ? 'Browser registered' : 'Enable browser notifications'}{busy !== 'register' && !registered && <span aria-hidden="true">↗</span>}</button>
            <p className="fine-print">Uses your browser’s native permission prompt. No prompt appears until you click.</p>
          </section>

          <section className="panel composer-panel" id="compose">
            <div className="panel-heading"><div><p className="section-kicker">02 / COMPOSE</p><h2>Send a notification</h2></div><span className="step-number">02</span></div>
            <form onSubmit={sendNotification}>
              <label htmlFor="notification-title">Title <span>Required</span></label>
              <input id="notification-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} placeholder="A short, clear headline" required />
              <div className="field-label-row"><label htmlFor="notification-message">Message <span>Required</span></label><span className="character-count">{message.length}/500</span></div>
              <textarea id="notification-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} rows={3} placeholder="What should your users know?" required />
              <div className="composer-footer"><span className="delivery-hint"><span className="hint-dot" /> Sends to {registeredCount} {registeredCount === 1 ? 'browser' : 'browsers'}</span><button className="button button-coral" type="submit" disabled={busy !== '' || !backendOnline || registeredCount === 0 || !title.trim() || !message.trim()}>{busy === 'send' ? <><span className="spinner light" /> Sending…</> : <>Send notification <span aria-hidden="true">↗</span></>}</button></div>
            </form>
            {lastResult && <div className="send-result" role="status"><strong>Delivery attempt complete</strong><span><b>{lastResult.successCount}</b> delivered <i /><b>{lastResult.failureCount}</b> failed</span></div>}
          </section>
        </div>

        <section className="activity-section" id="activity"><div className="activity-heading"><div><p className="section-kicker">LIVE FEED</p><h2>Foreground activity</h2></div><span className="live-label"><span className="live-dot" /> LISTENING</span></div>
          {history.length ? <div className="history-list">{history.map((item) => <article className="history-item" key={item.id}><span className="history-icon">↙</span><div className="history-content"><strong>{item.title}</strong><p>{item.body || 'No message body'}</p></div><time>{formatTime(item.time)}</time></article>)}</div> : <div className="empty-history"><span className="empty-mark">↙</span><div><strong>No foreground notifications yet</strong><p>Keep this page open and send a test notification to see it arrive here.</p></div><span className="empty-count">0 EVENTS</span></div>}
        </section>
        <footer className="page-footer"><span>Signal / FCM demo</span><span>Background delivery is handled by the service worker.</span></footer>
      </section>
    </main>
  );
}

export default App;
