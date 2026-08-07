# pg-fruitcut

滑動**切水果**：飛來的水果一刀兩半、果汁飛濺、連切加分；切到炸彈扣命。純前端，無建置步驟。

名稱與美術為原創小品，致敬「切水果／Fruit Ninja」玩法類型，非任一商業作品復刻。

也可當作 [Playgrounds（遊樂場）](https://play.samkuo.me/) 的 **SAM**（`index.html` 入口）。

## 一鍵開 SAM 小

**[一鍵開 SAM 小](https://play.samkuo.me/?open=sampot%2Fpg-fruitcut&name=%E5%88%87%E6%B0%B4%E6%9E%9C)**

```
https://play.samkuo.me/?open=sampot/pg-fruitcut&name=切水果
```

同源會重用本機已匯入的沙盒；要強制新建可加 `&fresh=1`。

## 試玩（本機）

```bash
npx --yes serve .
# 或
python3 -m http.server 8080
```

點一下頁面後音效才會出聲。

## 操作

| 操作 | 說明 |
| --- | --- |
| 畫布上滑動 | 留下刀痕並切開水果 |
| 開始 | 進入 60 秒對局（3 命） |
| 重來 | 分數／時間／命歸零 |
| 音效開／關 | 靜音 |

切到炸彈扣一命並中斷連切；命用盡或時間到結束。連切視窗內連續切開可疊加分數。

## 檔案

| 檔案 | 說明 |
| --- | --- |
| `index.html` | 結構（zh-Hant） |
| `styles.css` | 亮／暗色主題、sticky 操作列 |
| `app.js` | Canvas 繪製、指針輸入、刀痕 |
| `game.js` | 拋物線生成、切開判定、連切、粒子 |
| `audio.js` | Web Audio 合成音效 |
| `functions.js` | Playgrounds 可選 stub |

## License

MIT
