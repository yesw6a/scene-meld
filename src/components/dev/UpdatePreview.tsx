import { useState } from "react";
import { Select, Typography } from "antd";
import DesktopUpdaterPanel from "../DesktopUpdaterPanel";

const markdown = `## 新增

- **自动回退**：GitHub 连接失败后尝试加速源。
- 保留完整版本 ID，例如 \`gpt-image-2.5-flare\`。

### 修复

1. 长日志可独立滚动。
2. 下载按钮始终可见。

> 下载前请先保存当前工作。

[查看发布说明](https://github.com/yesw6a/scene-meld/releases)

\`\`\`text
这是一行很长的代码，用于验证代码区域横向滚动，而不是撑宽弹窗：abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz0123456789
\`\`\`

| 平台 | 支持 |
| --- | --- |
| Windows | 支持 |
| macOS / Linux | 支持 |

<details>
<summary>验证记录与已知限制</summary>

- 尚未执行真实安装测试。
- 加速源可能有缓存延迟。

</details>
`;

const fixtures = {
  long: Array.from({ length: 18 }, (_, i) => `### 更新分组 ${i + 1}\n\n- 优化更新状态展示，保留完整的错误说明和重试入口。\n- 修复长内容挤占操作空间的问题。`).join("\n\n") + "\n\n" + markdown,
  markdown,
  short: "### 修复\n\n- 修复更新日志显示异常。",
  empty: "",
};

export default function UpdatePreview() {
  const [scenario, setScenario] = useState<keyof typeof fixtures>("long");
  return (
    <div className="update-preview" data-update-preview="development-only">
      <div className="update-preview-controls">
        <Typography.Text type="secondary">开发预览 · 不会下载或安装</Typography.Text>
        <Select aria-label="更新预览场景" value={scenario} onChange={setScenario} options={[
          { value: "long", label: "长日志" }, { value: "markdown", label: "Markdown" },
          { value: "short", label: "短日志" }, { value: "empty", label: "空日志" },
        ]} />
      </div>
      <DesktopUpdaterPanel key={scenario} preview snapshot={{ status: "available", version: "99.0.0-preview", source: "github", body: fixtures[scenario] }} busy={false} onCheck={() => {}} onInstall={() => {}} />
    </div>
  );
}
