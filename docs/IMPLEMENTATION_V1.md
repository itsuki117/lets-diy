# Ver.1 実装記録

## Phase 0

- React 19.2 / Vite 7 / TypeScript strict / Tailwind 4 を導入。React Three Fiber 9.7 の peer dependency が React `<19.3` のため19.2系列に固定。
- DESIGN_V1 §8 の型定義と付録Aの定数を収録。
- UI と viewport の依存境界を守るため、App が AppShell の中央スロットに Viewport を渡す構成。
- typecheck / lint / test (2件) / build 成功。
- ESLint API に違反コードを入力し、core→three、store→fiber、ui→CSGがすべて拒否されることを確認。
- ブラウザ表示・コンソール警告0件を確認。幅1092px/1440pxの両方で左右280px/320px、中央492px/840px。

## 設計の確認事項（Claude Codeへのレビュー引き継ぎ）

- §12.4 の `d = dot(pB - pA, nB) - gap` は、正のgapを「隙間」とする完了条件と符号が逆になる。法線が外向きのため、離すには `+ gap` が必要。Phase 5着手時に仕様の整合を確認する。
