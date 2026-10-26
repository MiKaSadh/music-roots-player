# 100年を一周する

1925年のブルースから2015年のヒップホップまで、時代を変えた42曲を古い順に並べたプレイヤーです。曲を押すとその場で30秒の試聴が始まり、終わると次の曲へ自動で進みます。最初から通して聴くと、約21分で全体を一周できます。

- ジャケット写真と試聴音源：Apple の iTunes Search API
- アーティスト写真：Wikipedia（Wikimedia Commons）

詳しい背景や影響関係は、系譜グラフ版（https://mikasadh.github.io/music-roots-graph/ ）で調べられます。

## データの作り直し

`build/tracks.json` に曲を並べ、`node build/fetch.mjs` を実行すると `data.js` が作り直されます（Node.js 18以上）。
