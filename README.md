# PokémonCH

运行时文件是同目录的：

- `index.html`：页面、样式和交互
- `data.json`：schema v5 的单双打排名面板、形态、速度输入、TOP1 道具目录、伤害计算元数据和远程图标 URL；`generatedAt` 记录本次 JSON 生成时间，更新器目标范围为 TOP100
- `damage-engine.js`：基于固定 NCP Champions 版本裁剪的本地伤害计算内核
- `NCP-LICENSE.txt` / `THIRD_PARTY_NOTICES.md`：第三方 MIT 许可与来源说明

页面启动后只读取本地 `data.json`，不会实时抓取 OP.GG；宝可梦与属性图标通过 OP.GG CDN URL 加载，因此显示图标需要联网。图标失败时页面保留固定空间并继续展示文字、矩阵与速度计算。复制或部署时必须同时保留这两个运行时文件。

## 打开页面

浏览器通常不允许 `file://` 页面通过 `fetch()` 读取同目录 JSON，因此请启动本地静态服务器：

```bash
cd /Users/zhangjiacheng05/Documents/websearch/pokemonCH
python3 -m http.server 8000
```

然后访问：

```text
http://localhost:8000/
```

也可以把整个目录部署到任意静态网站服务器。

## 每日更新数据

```bash
cd /Users/zhangjiacheng05/Documents/websearch/pokemonCH
./update-data.sh
```

更新器通过 ego-browser 获取 OP.GG 双打榜和每个 排名范围内的图鉴页的“全部”数据，保存招式、携带道具、特性、性格、努力值、搭档、胜于/败于及胜利/失败技能，并更新形态静态资料，最后只原子替换 `data.json`；不会修改 `index.html`。图片字段保留去除转换参数的 HTTPS CDN URL，不下载为 Base64。若 OP.GG tier 页面结构临时变化，可先保留现有榜单，再运行 `node scripts/enrich-items.mjs` 只更新当前双打主体与 Mega 形态的 166 项道具目录；该脚本同样在全部道具映射成功后才原子发布。

建议首次预演：

```bash
./update-data.sh --dry-run --fresh --verbose
```

其他命令：

```bash
./update-data.sh --resume --verbose
./update-data.sh --fresh
./update-data.sh --validate-only
```

页面中的快速对位同时承载 6 选 4摘要：我方固定为行、对手固定为列，推荐4只通过左侧绿色行头和主要分工直接标出。完整矩阵使用相同方向；页面固定展示双打 TOP100，当前数据条数由 `data.json` 决定；桌面端首行和左侧我方列固定，移动端仍按我方宝可梦分组。

## 快速对位伤害估算

快速对位选择双方后，可手动点击“计算伤害”。“可用”按我方攻击对手计算，“警惕”按对手攻击我方计算；完整矩阵不执行伤害计算。计算固定使用等级50、31个体值，并分别取双方 Stat Points TOP1、性格 TOP1、特性 TOP1和道具 TOP1；这四项是独立聚合榜首，不保证属于同一实战配置。Choice Band、Choice Specs、Life Orb、Assault Vest、Expert Belt、Muscle Band、Wise Glasses及明确的属性增伤道具按 NCP 阶段计入；一次性减伤果、普通果子、场地种子、宝石、气球、超级石等排除，已识别但尚未覆盖的道具只展示不计入。天气、场地、能力等级及其他现场状态不参与计算，双打范围招式按同时命中两个目标的0.75修正。

普通形态、每个 Mega 形态分别占一行，只显示攻击百分比；防守形态组合通过鼠标悬浮、键盘聚焦或点击查看轻量 popover，popover 中补充道具状态、特性来源和各防守形态范围。伤害内核派生自固定的 [NCP VGC Damage Calculator](https://github.com/nerd-of-now/NCP-VGC-Damage-Calculator) commit `1369b359b85f0a6343df006acde92cc4a7d07805`，许可见 `NCP-LICENSE.txt`。

## 形态与速度估算

- `profiles` 是主体级聚合战斗统计；`forms` 保存普通/Mega形态各自的名称、图标和种族速度。多形态共享主体的对位、招式、努力值和性格统计，不代表存在独立的 Mega 对位样本。
- 速度公式固定为 Pokémon Champions 50级、31个体值规则：`floor((形态种族速度 + 速度 Stat Points + 20) × 性格修正)`，修正为 1.1、1.0 或 0.9。
- 估算分别取努力值 TOP1 与性格 TOP1；它们是两张独立聚合表的榜首，不保证来自同一套配置。普通与各 Mega 形态共享这组输入，但按各自种族速度生成独立速度点。
- 不考虑顺风、麻痹、讲究围巾、天气特性、速度等级、戏法空间或其他战斗状态。

## 更新安全机制

- 50只及关键数据全部通过校验后才发布。
- 抓取失败不会覆盖当前 `data.json`。
- 正式更新前自动备份至 `.update/backups/data.<时间>.json`，保留最近14份。
- `.update/checkpoint.json` 用于断点续抓；榜单范围或排名变化时自动失效。
- 排他锁防止两个更新任务同时修改数据。
- 恢复时将选中的备份复制回 `data.json` 即可。

Champions Battle Data API 没有与 OP.GG 等价的“胜于、败于、胜利技能、失败技能”，所以这些关键数据仍由 OP.GG 页面获取。更新期间需要网络和 ego-browser；浏览页面时本地功能只依赖 `index.html` 与 `data.json`，远程图标另需访问 OP.GG CDN。
