# docs

Let's DIY の設計ドキュメント。

| ファイル | 内容 | 対象 |
|----------|------|------|
| [DESIGN_V1.md](./DESIGN_V1.md) | Ver.1 設計書。要件・画面・データモデル・型定義・モジュール責務・各サブシステムの設計 | Codex（実装の正） |
| [PHASES_V1.md](./PHASES_V1.md) | Phase 0〜10 の実装内容・完了条件・テスト項目 | Codex（作業手順） |

## 実装を始めるとき

1. `DESIGN_V1.md` の **§1〜§8** を通読する（何を作るか）
2. `PHASES_V1.md` の **Phase 0** から着手する
3. 各 Phase で必要になったら `DESIGN_V1.md` の該当章を参照する
4. Phase 完了ごとに Definition of Done を満たしてからコミットする

## 設計と実装が食い違ったとき

`AGENTS.md` の Boundaries に従い、**実装を勝手に変えず、該当箇所を引用して報告する**。
設計の変更は `DESIGN_V1.md` を先に更新してから行う。
