# Let's DIY

Let's DIY の開発リポジトリです。

## 開発体制

- Claude Code: アプリケーション設計、仕様策定、成果物の評価
- Codex: 実装、テスト、Git/GitHub を使ったバージョン管理

設計内容が確定するまでは、技術スタックやアプリケーション構造をこのリポジトリで先回りして固定しません。

## ブランチ運用

- `main`: 常にレビュー済みで動作確認済みの状態を保つ
- `feature/<topic>`: 機能開発
- `fix/<topic>`: 不具合修正
- `chore/<topic>`: 開発環境や保守作業

変更は小さな単位でコミットし、原則としてプルリクエスト経由で `main` に統合します。

## コミット形式

[Conventional Commits](https://www.conventionalcommits.org/) を使用します。

```text
feat: add project editor
fix: prevent duplicate saves
docs: describe asset workflow
chore: update dependencies
```

## セキュリティ

- APIキーや認証情報はコミットしない
- ローカル設定は `.env` に保存する
- 共有が必要な環境変数は値を空にした `.env.example` に記載する
