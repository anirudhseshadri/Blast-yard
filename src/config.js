/* Where the game server lives.

   The client is a static site and can be served from anywhere; the server has
   to be a process that stays running, so the two are usually on different
   hosts. Point SERVER_URL at yours after deploying it.

   Use wss:// for a deployed server. A browser on an https:// page refuses to
   open a plain ws:// socket, so http-to-ws only works for local development. */

const SERVER_URL = 'wss://blast-yard-server.onrender.com';

export function serverUrl(){
  // ?server=... wins, which makes it easy to try a local server against the
  // deployed client, or a branch server against production
  const override = new URLSearchParams(location.search).get('server');
  if(override) return override;

  // running the client from a local static server: assume the game server is
  // on this machine too, on its default port
  if(location.hostname==='localhost' || location.hostname==='127.0.0.1'){
    return 'ws://' + location.hostname + ':8080';
  }
  return SERVER_URL;
}
