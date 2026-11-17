/**
 * GitHub bekötés: git init + első commit + remote + push.
 * Használat: pnpm run github <github-username> <repo-nev>
 * Ha gh CLI van, automatikusan repo-t is létrehoz.
 */
const { execSync } = require('child_process');
const path = require('path');

const [, , username, repoName = 'my-ai-bot'] = process.argv;

function run(cmd) {
  try {
    return execSync(cmd, { cwd: path.join(__dirname, '..'), encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch (e) {
    return null;
  }
}

if (!username) {
  console.log('Használat: pnpm run github <github-felhasználónév> [repo-név]');
  console.log('Példa:    pnpm run github kovacs-janos my-ai-bot');
  process.exit(1);
}

const repo = `https://github.com/${username}/${repoName}.git`;

console.log('1) git init...');
run('git init');
run('git branch -M main');

console.log('2) git add + commit...');
run('git add -A');
run(`git commit -m "MyAI Bot — teljesen önálló lokális AI (saját API kulcs, memória, 3D UI)"`);

console.log(`3) remote: ${repo}`);
const existing = run('git remote get-url origin');
if (existing) {
  run(`git remote set-url origin ${repo}`);
} else {
  run(`git remote add origin ${repo}`);
}

console.log('4) push (felszólithat GitHub bejelentkezésre)...');
const pushed = run('git push -u origin main');
console.log(pushed ? '✔ Push kész!' : '⚠ A push nem sikerült automatikusan.');
console.log('   Ha még nincs repo a GitHubon:');
console.log('   a) Create new repository: ' + repoName + ' (private vagy public)');
console.log('   b) utána futtasd újra: pnpm run github ' + username + ' ' + repoName);
console.log('   Vagy ha van gh CLI: gh repo create ' + username + '/' + repoName + ' --source=. --push');
