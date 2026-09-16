import { useEffect, useRef, useState } from "react";
import { AutoComplete, Button, Form, Select, Space, Typography } from "antd";
import { RefreshCw } from "lucide-react";
import { IMAGE_MODELS, type GenerationSettings } from "../types";
import { listConnectionModels } from "../lib/conversation-models";
import { normalizeImageApiBaseUrl } from "../lib/image-endpoint";

interface Props {
  draft: GenerationSettings;
  onChange: (model: string) => void;
}

interface Discovery {
  baseUrl: string;
  apiKey: string;
  models?: string[];
  error?: string;
  loading?: boolean;
}

export default function ImageModelSelector({ draft, onChange }: Props) {
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [manualError, setManualError] = useState<string>();
  const [confirmation, setConfirmation] = useState<{
    baseUrl: string; apiKey: string; model: string;
  } | null>(null);
  const sequence = useRef(0);
  useEffect(() => {
    sequence.current += 1;
    setDiscovery(null);
    setConfirmation(null);
    setManualError(undefined);
    return () => { sequence.current += 1; };
  }, [draft.baseUrl, draft.apiKey]);

  const current = discovery?.baseUrl === draft.baseUrl && discovery.apiKey === draft.apiKey
    ? discovery : null;
  const missing = current?.models !== undefined && !current.models.includes(draft.model);
  const confirmed = confirmation?.baseUrl === draft.baseUrl
    && confirmation.apiKey === draft.apiKey && confirmation.model === draft.model;
  const help = confirmed
    ? "手动确认，未通过模型列表验证。保存设置后使用此完整 ID。"
    : current?.error || (current?.models
    ? current.models.length === 0
      ? "当前渠道未返回支持的生图模型，可手动输入完整 ID 并确认。"
      : missing
        ? "当前渠道未返回已选模型，请选择可用模型或手动确认。"
        : `已从当前渠道获取 ${current.models.length} 个支持的模型。`
    : "支持 13 个完整模型 ID，默认使用 Flare。请获取当前渠道列表或手动确认。");

  function confirmManual() {
    const model = manualInput.trim();
    if (!IMAGE_MODELS.some(id => id === model)) {
      setManualError("请输入候选列表中的完整模型 ID，不能使用其他名称。");
      return;
    }
    try {
      normalizeImageApiBaseUrl(draft.baseUrl);
      if (!draft.apiKey.trim()) throw new Error("请先填写 API Key。");
    } catch (error) {
      setManualError(error instanceof Error ? error.message : "请先配置有效的渠道地址与密钥。");
      return;
    }
    sequence.current += 1;
    setDiscovery(value => value ? { ...value, loading: false } : value);
    setConfirmation({ baseUrl: draft.baseUrl, apiKey: draft.apiKey, model });
    setManualError(undefined);
    setManualOpen(false);
    onChange(model);
  }

  async function discover() {
    const request = ++sequence.current;
    const connection = { baseUrl: draft.baseUrl, apiKey: draft.apiKey };
    setConfirmation(null);
    setDiscovery({ ...connection, loading: true });
    try {
      normalizeImageApiBaseUrl(connection.baseUrl);
      const models = await listConnectionModels(connection);
      if (sequence.current !== request) return;
      setDiscovery({ ...connection, models: IMAGE_MODELS.filter(model => models.includes(model)) });
    } catch (error) {
      if (sequence.current !== request) return;
      const message = error instanceof Error ? error.message : "获取模型列表失败。";
      setDiscovery({ ...connection, error: message.replace(/请(?:继续)?手动填写。?/g, "请重试或检查渠道配置。") });
    }
  }

  return (
    <Form.Item label="生图模型" required help={<span aria-live="polite">{help}</span>}
      validateStatus={confirmed ? "warning" : current?.error ? "error" : missing ? "warning" : undefined}>
      <Space direction="vertical" size={8} style={{ width: "100%" }}>
        <Select
          aria-label="生图模型"
          value={draft.model}
          onChange={(model) => {
            setConfirmation(null);
            setManualOpen(false);
            onChange(model);
          }}
          style={{ width: "100%" }}
          options={IMAGE_MODELS.map(model => ({
            value: model,
            label: model,
            disabled: current?.models !== undefined && !current.models.includes(model),
          }))}
        />
        <Button onClick={() => void discover()} loading={current?.loading}
          disabled={!draft.baseUrl.trim() || !draft.apiKey.trim()}
          icon={<RefreshCw size={14} aria-hidden="true" />}>
          获取生图模型
        </Button>
        <Button type="link" style={{ height: "auto", whiteSpace: "normal", textAlign: "left" }} onClick={() => {
          setManualOpen(!manualOpen);
          setManualInput(draft.model);
          setManualError(undefined);
        }}>
          {manualOpen ? "取消手动输入" : "获取不到目标模型？手动输入并确认"}
        </Button>
        {manualOpen && (
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <label htmlFor="manual-image-model">完整模型 ID</label>
            <AutoComplete
              id="manual-image-model"
              value={manualInput}
              onChange={(value) => { setManualInput(value); setManualError(undefined); }}
              options={IMAGE_MODELS.map(value => ({ value }))}
              filterOption={(input, option) => Boolean(option?.value.includes(input.trim()))}
              style={{ width: "100%" }}
              status={manualError ? "error" : undefined}
              aria-describedby="manual-image-model-help"
              aria-invalid={Boolean(manualError)}
            />
            <Typography.Text id="manual-image-model-help" type={manualError ? "danger" : "secondary"} aria-live="polite">
              {manualError || "输入尚未应用。确认仅使用该 ID，不会发起生图或验证渠道权限。"}
            </Typography.Text>
            <Button onClick={confirmManual}>确认使用</Button>
          </Space>
        )}
        <Typography.Text type="secondary">
          模型 ID（含分辨率后缀）原样发送，质量设置不会改变模型 ID。
        </Typography.Text>
        {draft.model.startsWith("gpt-image-2.5") && (
          <Typography.Text type="secondary">
            当前使用应用现有尺寸与质量范围，暂未开放 2.5 的扩展档位；具体参数支持以渠道为准。
          </Typography.Text>
        )}
      </Space>
    </Form.Item>
  );
}
