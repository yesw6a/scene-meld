import * as stylex from "@stylexjs/stylex";
import { Alert, Button, Form, Input, Select, Typography } from "antd";
import type { ProxyMode, ProxySettings } from "../lib/network-proxy";

interface Props {
  desktop: boolean;
  draft: ProxySettings;
  loading: boolean;
  saving: boolean;
  error?: string;
  onChange: (settings: ProxySettings) => void;
  onRetry: () => void;
}

const descriptions: Record<ProxyMode, string> = {
  system: "使用操作系统的代理设置；未配置代理时直接连接。",
  none: "直接连接，不使用系统代理或代理环境变量。",
  manual: "使用指定的代理服务器；连接失败时不会自动切换为直接连接。",
};

export default function NetworkProxySection({ desktop, draft, loading, saving, error, onChange, onRetry }: Props) {
  return (
    <section aria-labelledby="network-proxy-heading" {...stylex.props(styles.section)}>
      <Typography.Title id="network-proxy-heading" level={5}>网络代理</Typography.Title>
      {!desktop ? (
        <Typography.Paragraph type="secondary">
          网页版使用浏览器或系统代理，无法在应用内指定代理服务器。桌面版支持独立设置。
        </Typography.Paragraph>
      ) : (
        <>
          <Typography.Paragraph type="secondary">
            用于图片生成、AI 辅助、模型列表、图片下载及应用更新。保存后对新操作生效，正在进行的请求保持原设置。
          </Typography.Paragraph>
          {error ? (
            <Alert type="error" showIcon title={error} action={
              <div {...stylex.props(styles.recovery)}>
                <Button size="small" onClick={onRetry} disabled={loading || saving}>重新读取</Button>
                <Button size="small" onClick={() => onChange({ mode: "system", url: "" })} disabled={loading || saving}>恢复默认草稿</Button>
              </div>
            } />
          ) : null}
          <Form.Item label="代理模式" htmlFor="network-proxy-mode" extra={<span id="network-proxy-description">{descriptions[draft.mode]}</span>}>
            <Select<ProxyMode>
              id="network-proxy-mode"
              aria-describedby="network-proxy-description"
              value={draft.mode}
              loading={loading}
              disabled={loading || saving}
              options={[
                { value: "system", label: "使用系统代理" },
                { value: "none", label: "不使用代理" },
                { value: "manual", label: "手动配置代理" },
              ]}
              onChange={(mode) => onChange({ ...draft, mode })}
            />
          </Form.Item>
          {draft.mode === "manual" ? (
            <Form.Item label="代理地址" htmlFor="network-proxy-url" extra={<span id="network-proxy-url-help">例如 http://127.0.0.1:7890 或 socks5h://127.0.0.1:1080。支持 HTTP、HTTPS、SOCKS5（本地 DNS）和 SOCKS5H（代理 DNS），暂不支持用户名和密码。</span>}>
              <Input
                id="network-proxy-url"
                aria-describedby="network-proxy-url-help"
                value={draft.url}
                placeholder="http://127.0.0.1:7890"
                autoComplete="off"
                spellCheck={false}
                maxLength={2048}
                disabled={loading || saving}
                onChange={(event) => onChange({ ...draft, url: event.target.value })}
              />
            </Form.Item>
          ) : null}
          {draft.mode === "system" ? (
            <Typography.Paragraph type="secondary" {...stylex.props(styles.note)}>
              Windows/macOS 支持系统静态代理，也会读取代理环境变量；Linux 使用代理环境变量。暂不支持 PAC 脚本与自动发现，仅配置 PAC 时请改用手动代理。
            </Typography.Paragraph>
          ) : null}
          {loading ? <span role="status">正在读取代理设置…</span> : null}
        </>
      )}
    </section>
  );
}

const styles = stylex.create({
  section: { display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 },
  note: { fontSize: "12px", lineHeight: 1.65, marginBottom: 0 },
  recovery: { display: "flex", flexWrap: "wrap", gap: "8px" },
});
