# docs

Let's DIY の設計ドキュメント。

| ファイル | 内容 | 書き手 |
|----------|------|--------|
| [DESIGN_V1.md](./DESIGN_V1.md) | Ver.1 設計書。要件・画面・UI デザイン規則・データモデル・型定義・モジュール責務・各サブシステムの設計 | Claude Code |
| [PHASES_V1.md](./PHASES_V1.md) | Phase 0〜10 の実装内容・完了条件・テスト項目 | Claude Code |
| [REVIEW_LOG.md](./REVIEW_LOG.md) | 実装レビューの指摘と、設計上の確認事項への回答 | Claude Code |
| [IMPLEMENTATION_V1.md](./IMPLEMENTATION_V1.md) | Phase ごとの実装記録と、設計側への確認事項 | Codex / Claude Code |
| [DESIGN_V2.md](./DESIGN_V2.md) | **Ver.2 設計書（未実装）**。可動部品・動作シミュレーション・金物・木取り図・加工図・留め加工 | Claude Code |
| [PHASES_V2.md](./PHASES_V2.md) | Ver.2 の Phase M0〜M12 | Claude Code |

## 実装を始めるとき

1. `DESIGN_V1.md` の **§1〜§8** を通読する（何を作るか）
2. **§3.8「UI デザイン規則」は全 Phase に適用される拘束力のある規則**なので必ず読む
3. `PHASES_V1.md` の該当 Phase に着手する
4. 各 Phase で必要になったら `DESIGN_V1.md` の該当章を参照する
5. Phase 完了ごとに Definition of Done を満たしてからコミットする
6. `REVIEW_LOG.md` に未対応の指摘があれば、次の Phase より先に片付ける

## Ver.2 に入るとき

1. [DESIGN_V2.md](./DESIGN_V2.md) の **§1〜§2** を必ず先に読む。
   §2「Ver.1 から壊れる前提」を理解していないと Phase M3 以降で必ず詰まる。
2. §19 のチェックリストで、Ver.1 のどこに手が入るかを把握する
3. [PHASES_V2.md](./PHASES_V2.md) の **M0 から**着手する
4. **M1（運動学）は UI に触らずに完成させる**。数式と描画を同時に書くと切り分けができなくなる

Ver.1 の設計書は Ver.2 でも有効。§3.8（UI デザイン規則）・§5.1（レイヤ依存）・
§15（Undo/Redo）・§17（パフォーマンス）はそのまま適用される。

## 設計と実装が食い違ったとき

`AGENTS.md` の Boundaries に従い、**実装を勝手に変えず、該当箇所を引用して報告する**。
報告先は `IMPLEMENTATION_V1.md` の「設計の確認事項」。回答は `REVIEW_LOG.md` に記録される。
設計の変更は `DESIGN_V1.md` を先に更新してから行う。
