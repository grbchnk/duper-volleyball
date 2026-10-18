import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const port = Number(process.env.PORT || 4173);
const url = `http://127.0.0.1:${port}/index.html`;
async function ready() {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(800) });
    return r.ok && (await r.text()).includes('src/main.js');
  } catch {
    return false;
  }
}
if (!(await ready())) {
  const child = spawn(process.execPath, [fileURLToPath(new URL('./server.mjs', import.meta.url))], {
    env: { ...process.env, PORT: String(port) },
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
  for (let i = 0; i < 20 && !(await ready()); i++) await new Promise((r) => setTimeout(r, 200));
}
if (!(await ready()))
  throw Error(`Не удалось запустить игру на порту ${port}. Откройте другой порт через PORT.`);
const browser = spawn('powershell', ['-NoProfile', '-Command', `Start-Process '${url}'`], {
  stdio: 'ignore',
  windowsHide: true,
});
browser.on('error', () => console.log(url));
console.log(url);
