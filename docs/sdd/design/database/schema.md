# データスキーマ設計

## 概要

本アプリはRDBMSを使用しない。すべてのデータはJSON形式でローカルファイルに保存する。

---

## 1. アノテーションファイル（サイドカーJSON）

**ファイルパス**: `{musicXmlと同じディレクトリ}/{ファイル名}.annotation.json`

```json
{
  "schemaVersion": "1.0",
  "musicXmlPath": "/Users/user/scores/moonlight.xml",
  "updatedAt": "2026-06-21T12:00:00Z",
  "annotations": [
    {
      "noteId": "P1-M3-N0",
      "fingerNumber": 3,
      "comment": "スムーズな移行のためここで親指",
      "isAISuggested": true,
      "isApproved": false
    }
  ]
}
```

**noteId 形式**: `{パートID}-M{小節番号}-N{音符インデックス}`
例: `P1-M3-N0` = パート1の第3小節の0番目の音符

---

## 2. アプリ設定（electron-store）

**保存場所**: `{OS標準アプリデータフォルダ}/piano-practice-app/config.json`

```json
{
  "recentFiles": [
    { "path": "/Users/user/scores/moonlight.xml", "openedAt": "2026-06-21T10:00:00Z" }
  ],
  "midi": {
    "selectedDeviceId": "Roland Piano",
    "selectedDeviceIndex": 0
  },
  "handSettings": {
    "maxSpanSemitones": 14,
    "leftHandScaleFactor": 1.0
  },
  "ui": {
    "theme": "light",
    "zoom": 1.0,
    "pianoHeight": 120,
    "language": "ja"
  },
  "practice": {
    "defaultErrorMode": "wait",
    "metronomeEnabled": false
  }
}
```

---

## 3. 練習履歴（JSON Lines）

**ファイルパス**: `{OS標準アプリデータフォルダ}/piano-practice-app/history.jsonl`

各行が1セッションを表すJSON Lines形式。

```jsonl
{"sessionId":"abc123","musicXmlPath":"/scores/moonlight.xml","startedAt":"2026-06-21T10:00:00Z","endedAt":"2026-06-21T10:30:00Z","practiceMode":"right","totalNotes":150,"correctNotes":138,"loopRange":{"start":5,"end":12}}
{"sessionId":"def456","musicXmlPath":"/scores/fur_elise.xml","startedAt":"2026-06-21T11:00:00Z","endedAt":"2026-06-21T11:15:00Z","practiceMode":"both","totalNotes":80,"correctNotes":72,"loopRange":null}
```

---

## OS標準アプリデータフォルダ

| OS | パス |
|----|------|
| Windows | `%APPDATA%\piano-practice-app\` |
| macOS | `~/Library/Application Support/piano-practice-app/` |
