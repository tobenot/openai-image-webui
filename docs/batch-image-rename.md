
# 🎨 质朴的美术资源 AI 批量重命名方案（带一键还原）

## 一、 核心设计理念
1. **大内存零负担**：原图不上传、不常驻网页内存。网页只负责"看一眼（缩略图）"和"出主意（起名字）" [0]。
2. **绝对安全（一键还原）**：本地重命名通过脚本执行。脚本运行前自动备份原始命名关系，一旦后悔，双击还原脚本，1秒钟恢复原样。
3. **工业级防重名**：命名格式为 `大类_特征_特征_YYMMDD_4位随机哈希` [0]。
4. **双通道输出**：同时提供 **[下载重命名脚本（推荐）]** 与 **[下载重命名后的 ZIP 包（备用）]**。
5. **双命名模式**：
   - **🏷️ 简洁模式**：`rock_mossy_dark_260525_a4f2.png` — 游戏引擎友好的短命名
   - **📝 描述模式**：`rock_boulder_large_scattered_on_hillside_260525_a4f2.png` — 无障碍 alt-text 风格，**前两个词强制为大类+小类**（rock_boulder / tree_pine / grass_dry …），保证文件管理器排序时同类素材聚在一起且小类进一步细分；后续自由描述形状、朝向、数量、材质、空间关系等语义细节（上限 60 字符，AI 视觉 detail 自动提升）

---

## 二、 核心技术实现细节

### 1. 100MB+ 大图片内存优化（前端 Canvas 压缩）
当用户拖入 100 张甚至更多大图时，前端立刻在后台使用 Canvas 进行异步压缩：
* **目标分辨率**：等比例缩放，宽/高最大不超过 `1024px`。
* **输出格式**：超轻量 WebP 或 JPEG（质量 0.8）。
* **效果**：100MB 的单张原图会被压缩至 **100KB 左右**。发给 AI 的数据量极小，传输极快，且浏览器内存占用始终保持在极低水平 [0]。

### 2. 双模式 AI 命名与前端加工
* **命名模式切换**：UI 提供简洁/描述两种模式，切换后影响 prompt 和 AI 识图精度。

* **简洁模式 Prompt**：
  > "You are a game art asset manager. Based on the image content, give a filename.
  > Format: `category_trait_trait` (e.g. `rock_mossy_dark`, `grass_yellow_dry`).
  > Rules: English lowercase and underscores only."
  > — 使用 `detail: "low"` 快速识别

* **描述模式 Prompt**：
  > "You are an accessibility expert writing alt-text as a filename.
  > Structure: category_subcategory_description.
  > The FIRST word MUST be the primary category (e.g. rock, grass, tree, tower, wall, water, sky).
  > The SECOND word MUST be a subcategory or variant (e.g. boulder, moss, pine, brick, river, cloud).
  > After that, describe key visual details: shape, direction, quantity, material, spatial relationships.
  > Examples: `rock_boulder_large_scattered_on_hillside`, `tree_pine_on_rock_leaning_left`, `tower_brick_two_story_with_flag`.
  > Rules: English lowercase and underscores only. Keep it under 60 characters."
  > — 使用 `detail: "auto"` 让模型看到更多细节

* **前端加工逻辑**：
  收到 AI 返回的名字后，前端自动追加当前日期与 4 位随机哈希值 [0]：
  * **当前日期**：`YYMMDD` 格式（如 `260521`） [0]。
  * **4位哈希**：使用 `Math.random().toString(16).slice(2, 6)` 生成（如 `a4f2`）。
  * **描述模式截断**：AI 名称超过 60 字符时截断并去除尾部下划线。
  * **最终命名示例**：
    - 简洁模式：`rock_mossy_dark_260521_a4f2.png`
    - 描述模式：`rock_boulder_large_scattered_on_hillside_260525_a4f2.png`

---

## 三、 核心功能：双通道输出与"一键还原"

### 通道 A：【极速重命名脚本】+【一键还原脚本】（最推荐）
当用户点击 **[💾 下载重命名脚本]** 时，网页会打包下载一个 ZIP，解压后里面包含两个极其朴实但威力强大的脚本文件（以 Windows 的 `.bat` 为例）：

#### 1. 执行重命名：`run_rename.bat`
运行此脚本，会先在本地悄悄生成一个隐藏的备份文本 `_rename_backup.log`，记录"新名字=旧名字"的映射关系，然后执行重命名。
```bat
@echo off
chcp 65001 >nul
echo 正在准备重命名美术资源...

:: 1. 写入备份日志（用于一键还原）
(
echo rock_mossy_dark_260521_a4f2.png=IMG_4829.png
echo grass_dry_yellow_260521_9b8c.png=IMG_4830.png
) > _rename_backup.log

:: 2. 执行重命名
ren "IMG_4829.png" "rock_mossy_dark_260521_a4f2.png"
ren "IMG_4830.png" "grass_dry_yellow_260521_9b8c.png"

echo.
echo ==========================================
echo  🎉 重命名完成！
echo  提示：如果不满意，双击运行 [restore_names.bat] 即可一键还原。
echo ==========================================
pause
```

#### 2. 一键还原：`restore_names.bat`
如果美术人员觉得改得不好，或者误操作了，直接双击运行这个脚本，瞬间恢复原状！
```bat
@echo off
chcp 65001 >nul
echo 正在读取备份，准备还原原始文件名...

if not exist _rename_backup.log (
    echo [错误] 未找到备份日志 _rename_backup.log，无法还原！
    pause
    exit /b
)

:: 读取备份日志并逐行还原
for /f "tokens=1,2 delims=" %%A in (_rename_backup.log) do (
    for /f "tokens=1,2 delims=" %%I in ("%%A") do (
        ren "%%I" "%%J"
    )
)

:: 删除备份日志和自身
del _rename_backup.log
echo.
echo ==========================================
echo  ✅ 原始文件名已成功恢复！
echo ==========================================
pause
```
*(注：Mac/Linux 用户会对应生成 `.sh` 版本的脚本，逻辑完全一致)*

---

### 通道 B：【打包轻量 ZIP】（备用）
对于不想运行脚本、或者只想导出一份新图包的用户，提供 **[📦 下载重命名后的打包 ZIP]** 按钮。
* **实现方式**：利用 `JSZip` 库。
* **内存优化**：在用户点击下载的瞬间，才通过 `File` 对象的指针读取原图数据并写入 ZIP，写完立刻释放内存，绝不常驻浏览器。
* **结果**：下载得到一个全新的、命名漂亮的美术包，本地原图包作为"备份"完好无损。

---

## 四、 质朴的极简 UI 界面设计

网页不需要花里胡哨的排版，只有四个清晰的区域：

1. **拖拽/选择区**：
   * 支持拖入文件夹或多选图片（支持 JPG、PNG、WebP、TGA 等常见美术格式）。
2. **命名模式切换**：
   * `[ 🏷️ 简洁 ]  [ 📝 描述 ]` — 简洁模式产出引擎友好短名，描述模式产出语义丰富的 alt-text 风格长名。
3. **配置区（极简）**：
   * `[ 输入你的 API Key ]` 
   * `[ 选择 AI 模型（默认 GPT-4o-mini / Claude-3.5-haiku，便宜又快） ]`
4. **实时预览列表**：
   像打印机一样，拖入后立刻显示极小的缩略图，AI 识别一张，右侧就蹦出一个新名字：
   ```
   简洁模式：
   [ 🖼️ 缩略图 ]  IMG_4829.png  ───>  rock_mossy_dark_260521_a4f2.png    [✓]
   
   描述模式：
   [ 🖼️ 缩略图 ]  IMG_4829.png  ───>  rock_boulder_large_scattered_hillside_260525_a4f2.png  [✓]
   [ 🖼️ 缩略图 ]  IMG_4830.png  ───>  tower_brick_two_story_with_flag_260525_9b8c.png        [✓]
   ```
5. **底部操作区**：
   * **`[ 🚀 开始重命名 ]`**
   * **`[ 💾 下载重命名脚本 (推荐・带一键还原) ]`**
   * **`[ 📦 下载重命名后的打包 ZIP ]`**

---

## 五、 方案总结：为什么这个方案最让人安心？

1. **速度极快**：发给 AI 的都是 100KB 的缩略图，100 张图识别完可能只需要十几秒，网络传输毫无压力 [0]。
2. **绝对安全**：本地原图不需要上传到任何服务器，隐私安全、流量安全。
3. **反悔无忧**：有了 `restore_names.bat`，美术人员可以闭着眼睛随便改，不满意双击一下立刻还原，没有任何心理负担。
4. **结构简单**：纯前端单页面（HTML + JS），不需要写复杂的后端，部署在 GitHub Pages 上就能直接用。