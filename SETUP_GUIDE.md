# 詳細セットアップガイド

RMS Playerを初めてセットアップする方向けの詳しい手順です。

## 1. 環境構築

### Node.jsのインストール

1. [Node.js公式サイト](https://nodejs.org/)から最新のLTS版をダウンロード
2. インストーラーを実行
3. ターミナルで確認:
```bash
node --version
npm --version
```

### Rustのインストール

#### Windows
1. [Rust公式サイト](https://www.rust-lang.org/tools/install)から`rustup-init.exe`をダウンロード
2. 実行して指示に従う
3. Visual Studio C++ Build Toolsが必要な場合は、インストーラーの指示に従う
4. ターミナルを再起動して確認:
```bash
rustc --version
```

#### macOS / Linux
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
rustc --version
```

## 2. プロジェクトのセットアップ

### 依存関係のインストール

```bash
cd rms-player
npm install
```

エラーが出る場合:
```bash
# キャッシュクリア
npm cache clean --force

# 再インストール
rm -rf node_modules package-lock.json
npm install
```

## 3. 開発モードで起動

```bash
npm run tauri dev
```

初回起動時は、Rustの依存関係のダウンロードとコンパイルで時間がかかります(5-10分程度)。

### よくあるエラーと解決方法

#### エラー: `cargo not found`
→ Rustが正しくインストールされていません。ターミナルを再起動してください。

#### エラー: `VCVARSALL.BAT not found` (Windows)
→ Visual Studio C++ Build Toolsをインストールしてください。

#### エラー: `Failed to resolve tauri`
→ `npm install` を再実行してください。

## 4. ビルド(実行ファイル作成)

```bash
npm run tauri build
```

### ビルド成果物の場所

- **Windows**: `src-tauri/target/release/rms-player.exe`
- **macOS**: `src-tauri/target/release/bundle/dmg/RMS Player_1.0.0_x64.dmg`
- **Linux**: `src-tauri/target/release/rms-player`

## 5. アイコンの設定(任意)

1. 1024x1024のPNG画像を用意
2. Tauri CLIでアイコン生成:
```bash
npm install -g @tauri-apps/cli
tauri icon path/to/icon.png
```
3. 生成されたアイコンが `src-tauri/icons/` に配置されます

## 6. カスタマイズ

### ウィンドウサイズの変更

`src-tauri/tauri.conf.json` の `windows` セクション:
```json
{
  "width": 480,
  "height": 720
}
```

### アプリ名の変更

`src-tauri/tauri.conf.json` の `package` セクション:
```json
{
  "productName": "あなたのアプリ名"
}
```

### 正規化レベルのデフォルト値変更

`src/components/Player/Player.jsx` の初期値:
```javascript
const [normalizeTarget, setNormalizeTarget] = useState(-14) // ← この値を変更
```

値の目安:
- `-14`: Spotify標準
- `-12`: YouTube標準
- `-9`: より大きめの音量

## 7. トラブルシューティング

### ファイルが追加できない
- ファイルパスが正しいか確認
- MP3ファイルであることを確認
- ファイルが破損していないか確認

### 音が出ない
1. システムの音量を確認
2. アプリの音量スライダーを確認
3. 別のMP3ファイルで試す

### プレイリストが保存されない
- アプリデータディレクトリへの書き込み権限を確認
- セキュリティソフトがブロックしていないか確認

### ビルドが失敗する
```bash
# 完全クリーンビルド
cd src-tauri
cargo clean
cd ..
npm run tauri build
```

## サポート

問題が解決しない場合:
1. エラーメッセージをコピー
2. 実行環境(OS、Node.jsバージョン、Rustバージョン)を確認
3. GitHubのIssuesで報告またはDiscussionsで質問

## 参考リンク

- [Tauri公式ドキュメント](https://tauri.app/)
- [React公式ドキュメント](https://react.dev/)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
