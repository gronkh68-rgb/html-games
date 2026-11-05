/* TURN-Server (Metered, feste Zugangsdaten) für die Mehrspieler-Verbindung, dieselben wie bei Rummikub.
   Wird von net.js als window.NET_TURN gelesen, wenn diese Datei vor net.js geladen wird. */
window.NET_TURN = [
  { urls: 'stun:stun.relay.metered.ca:80' },
  { urls: 'turn:global.relay.metered.ca:80', username: '4262d6a9b80f6b295e0dd718', credential: '9f7jRvov08ZaYy9z' },
  { urls: 'turn:global.relay.metered.ca:80?transport=tcp', username: '4262d6a9b80f6b295e0dd718', credential: '9f7jRvov08ZaYy9z' },
  { urls: 'turn:global.relay.metered.ca:443', username: '4262d6a9b80f6b295e0dd718', credential: '9f7jRvov08ZaYy9z' },
  { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: '4262d6a9b80f6b295e0dd718', credential: '9f7jRvov08ZaYy9z' }
];
