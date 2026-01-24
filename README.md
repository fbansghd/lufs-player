# LUFS Player

LUFS正規化機能を持つデスクトップ音楽プレイヤー。曲ごとの音量差を自動で補正し、均一なリスニング体験を提供します。

## 機能

- LUFS正規化による音量の均一化（ITU-R BS.1770-4準拠）
- 正規化ターゲットの調整（-14 LUFS / -12 LUFS / -9 LUFS）
- ファイル単体・フォルダ一括追加（サブフォルダも再帰的に検索）
- プレイリストの自動保存・復元
- シャッフル再生（デフォルトON）
- マスターボリューム調整
- 右クリックメニューで曲の削除
- MP3対応

## セットアップ

### 必要な環境

- **Node.js** v16以上
- **Rust** 最新安定版
  - macOS/Linux: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
  - Windows: https://www.rust-lang.org/tools/install

### インストール・起動

```bash
# 依存関係のインストール
npm install

# 開発モードで起動
npm run tauri dev

# ビルド（実行ファイル生成）
npm run tauri build
```

ビルド成果物は `src-tauri/target/release/` 以下に生成されます。

## 使い方

1. **ファイル追加**: 「+ ファイル追加」ボタンでMP3ファイルを選択、またはフォルダを選択して一括追加
2. **再生**: 曲をダブルクリック、または再生ボタン
3. **削除**: 曲を右クリック → 削除
4. **シャッフル**: シャッフルアイコンで切り替え
5. **音量調整**: マスターボリュームスライダーで調整

## 技術スタック

- **フロントエンド**: React 18 + Vite + SCSS Modules
- **デスクトップ**: Tauri 1.x (Rust)
- **音声処理**: Web Audio API
- **正規化方式**: LUFS（ITU-R BS.1770-4 K-weightingフィルタ + ブロック分析）

## LUFS正規化について

曲の追加時にLUFS値を計算し、再生時にゲインを適用します。

- K-weightingフィルタ（2段バイクアッドフィルタ）で人間の聴感特性に合わせた重み付け
- 400msブロック・100msステップでラウドネス解析
- 3秒間のスライディングウィンドウで短期ラウドネスを測定
- 最大ゲイン +9.5dB（3倍）にクランプしてクリッピングを防止
- デフォルトターゲット: -14 LUFS（Spotify推奨値）

## データの保存場所

プレイリストと設定は以下に自動保存されます:

- **macOS**: `~/Library/Application Support/com.lufsplayer.app/playlists.json`
- **Windows**: `%APPDATA%\com.lufsplayer.app\playlists.json`
- **Linux**: `~/.config/com.lufsplayer.app/playlists.json`

## プロジェクト構成

```
src/
  main.jsx                  # エントリポイント
  App.jsx                   # ルートコンポーネント
  components/Player/
    Player.jsx              # メインプレイヤーコンポーネント
    Player.module.scss      # スタイル
  hooks/
    useLUFSNormalizer.js    # LUFS計算ロジック
src-tauri/
  src/main.rs               # Tauriバックエンド
  tauri.conf.json           # Tauri設定
```
