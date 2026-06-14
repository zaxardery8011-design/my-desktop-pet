# Mr.Wu 桌寵 v0

Mr.Wu 桌寵是一個 Windows Electron 透明桌面寵物。v0 只做狐獴 Mr.Wu 在桌面底部走來走去、停下、轉向、拖曳、點一下反應，以及右鍵退出；不接 AI、不講話。

## 安裝與啟動

```powershell
cd C:\Users\User\Desktop\AIWORK\mrwu_pet
npm install
npm start
```

啟動後會開一個透明、置頂、跳過工作列的 frameless overlay。預設不攔截桌面操作；滑鼠移到 Mr.Wu 實體透明 PNG 像素上才會暫時接管滑鼠，讓你可以點擊、拖曳或右鍵叫出選單。

## v0 範圍

- Electron 透明置頂桌寵視窗。
- 使用 `assets/mrwu.png` 透明 cutout 顯示 Mr.Wu。
- 沿主螢幕 workArea 底部水平來回走動。
- 隨機走路、停頓、換方向。
- 到邊界自動左右翻面。
- CSS waddle / breathe / hop 動畫。
- 點擊穿透：`setIgnoreMouseEvents(true, { forward: true })`，滑鼠在 Mr.Wu 實體像素上才關閉穿透。
- 可拖曳，放開後平滑落回地面。
- 右鍵原生選單：退出。

## v1 計畫

- 接 AIWFF 主腦事件或對話。
- 加入文字泡泡或 TTS。
- 支援更多姿勢或多幀 sprite。
- 支援多螢幕與個別螢幕邊界。
