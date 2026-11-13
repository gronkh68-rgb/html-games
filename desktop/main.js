// Dünner Rahmen um das Spieleportal: öffnet immer die aktuelle Version von GitHub Pages.
// Neue Spiele und Fehlerkorrekturen kommen so ohne neue .exe an (jeder Push auf main wird bei GitHub veröffentlicht).
const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');
const URL_SITE = 'https://gronkh68-rgb.github.io/html-games/';

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
if (!app.requestSingleInstanceLock()) app.quit();

function create() {
  Menu.setApplicationMenu(null);
  const w = new BrowserWindow({
    width: 1400, height: 900, minWidth: 420, minHeight: 500, backgroundColor: '#080c12', autoHideMenuBar: true, title: 'HTML Games',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  const load = () => w.loadURL(URL_SITE).catch(() => {});
  w.webContents.on('did-fail-load', (_e, code, _d, url, isMain) => {
    if (!isMain || code === -3) return;
    w.loadFile(path.join(__dirname, 'offline.html'), { query: { retry: '1' } });
  });
  // Links auf fremde Seiten im normalen Browser öffnen
  w.webContents.setWindowOpenHandler(({ url }) => { if (!url.startsWith(URL_SITE)) shell.openExternal(url); return { action: url.startsWith(URL_SITE) ? 'allow' : 'deny' }; });
  w.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(URL_SITE) && !url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); } });
  w.webContents.on('before-input-event', (_e, i) => {
    if (i.type !== 'keyDown') return;
    if (i.key === 'F11') w.setFullScreen(!w.isFullScreen());
    else if (i.key === 'F5') w.webContents.reloadIgnoringCache();
    else if (i.key === 'Escape' && w.isFullScreen()) w.setFullScreen(false);
  });
  load();
  ipcRetry(w, load);
}
function ipcRetry(w, load) { w.webContents.on('console-message', (_e, _l, msg) => { if (msg === 'retry-load') load(); }); }
app.whenReady().then(create);
app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
app.on('window-all-closed', () => app.quit());
