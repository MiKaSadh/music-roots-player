// tracks.json の各曲について、iTunes から試聴音源とジャケ写、Wikipedia からアー写を取ってきて data.js に書き出す。
// 実行: node build/fetch.mjs  （music-roots-player フォルダで）
import fs from 'node:fs';

const tracks = JSON.parse(fs.readFileSync(new URL('./tracks.json', import.meta.url), 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const UA = { 'User-Agent': 'music-roots-player/0.1 (personal learning project)' };

// 表記ゆれを吸収して比べるための正規化（記号を除き、& を and に、先頭の the を外す）
const norm = s => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^the /, '');

function score(c, t) {
  const a = norm(c.artistName || ''), want = norm(t.artist);
  if (!(a.includes(want) || want.includes(a))) return -Infinity;
  const name = norm(c.trackName || ''), title = norm(t.title);
  let s = 0;
  if (name === title) s += 12; else if (name.startsWith(title)) s += 10; else if (name.includes(title)) s += 5; else return -Infinity;
  const raw = (c.trackName + ' ' + c.collectionName).toLowerCase();
  const wantLive = /live/i.test(t.hint);
  if (/\blive\b/.test(raw) && !wantLive) s -= 6;
  if (/remix|instrumental|karaoke|re-recorded|rerecorded|demo|alternate/.test(raw)) s -= 8;
  if (/hits|best of|collection|essential|anthology|gold/.test((c.collectionName || '').toLowerCase())) s -= 1;
  if (t.hint && (c.collectionName || '').toLowerCase().includes(t.hint.toLowerCase())) s += 5;
  const ry = parseInt((c.releaseDate || '9999').slice(0, 4), 10);
  s -= Math.max(0, ry - t.y) / 25;   // 発売が元の年に近いもの（原盤に近いもの）を優先
  if (!c.previewUrl) return -Infinity;
  return s;
}

async function itunes(t) {
  const term = encodeURIComponent(`${t.artist} ${t.title}`.replace(/[()"]/g, ' '));
  const url = `https://itunes.apple.com/search?term=${term}&entity=song&limit=25&country=US`;
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, { headers: UA });
    if (r.ok) { const j = await r.json(); return j.results || []; }
    await sleep(8000);   // 回数制限に当たったら待って再試行
  }
  return [];
}

async function wiki(title) {
  const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, { headers: UA });
  if (!r.ok) return null;
  const j = await r.json();
  const src = j.thumbnail && j.thumbnail.source;
  if (!src) return { photo: null, page: j.content_urls && j.content_urls.desktop.page };
  // Wikimedia は決まったサイズ（330・500・960px など）の縮小画像しか返さないため 500px を使う
  return { photo: src.replace(/\/\d+px-/, '/500px-').replace(/\?.*$/, ''), page: j.content_urls.desktop.page };
}

const out = [], report = [];
for (const t of tracks) {
  const cands = await itunes(t);
  const best = cands.map(c => ({ c, s: score(c, t) })).filter(x => x.s > -Infinity).sort((a, b) => b.s - a.s)[0];
  const w = await wiki(t.wiki);
  const rec = { ...t };
  delete rec.hint;
  if (best) {
    const c = best.c;
    Object.assign(rec, {
      track: c.trackName, album: c.collectionName, artistLabel: c.artistName,
      cover: (c.artworkUrl100 || '').replace('100x100bb', '600x600bb'),
      preview: c.previewUrl, apple: c.trackViewUrl, release: (c.releaseDate || '').slice(0, 10),
      // アルバム画面・アーティスト画面を iTunes で引くための ID
      itTrack: c.trackId, itAlbum: c.collectionId, itArtist: c.artistId
    });
  }
  rec.photo = w && w.photo; rec.wikiPage = w && w.page;
  out.push(rec);
  report.push(`${t.y}\t${t.artist} - ${t.title}\t=> ${best ? best.c.trackName + ' / ' + best.c.collectionName + ' (' + (best.c.releaseDate || '').slice(0, 4) + ')' : '✗ 見つからず'}\t写真:${w && w.photo ? '有' : '✗'}`);
  console.log(report[report.length - 1]);
  await sleep(3200);
}
fs.writeFileSync(new URL('../data.js', import.meta.url), '// build/fetch.mjs が生成。手で編集しない\nwindow.TRACKS=' + JSON.stringify(out, null, 0).replace(/},{/g, '},\n{') + ';\n');
console.log(`\n書き出し: data.js（${out.length}曲、試聴あり ${out.filter(x => x.preview).length}、写真あり ${out.filter(x => x.photo).length}）`);
