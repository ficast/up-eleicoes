// Gera public/og.png (imagem de compartilhamento 1200×630) a partir de scripts/og/og.html com o Chrome headless.
// Uso: npm run og   (CHROME=/caminho/do/chrome para sobrescrever)
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const chrome = process.env.CHROME ?? {
  win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
}[process.platform] ?? 'google-chrome';

const out = path.resolve('public/og.png');
execFileSync(chrome, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--virtual-time-budget=8000',
  '--window-size=1200,630', `--screenshot=${out}`, pathToFileURL(path.resolve('scripts/og/og.html')).href,
], { stdio: 'inherit' });
