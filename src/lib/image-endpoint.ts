const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export class EndpointConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EndpointConfigurationError";
  }
}

export function normalizeImageApiBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new EndpointConfigurationError("请填写 API 基础地址。");
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(trimmed);
  } catch {
    throw new EndpointConfigurationError("请输入有效的 API 基础地址。");
  }

  if (baseUrl.username || baseUrl.password) {
    throw new EndpointConfigurationError("API 地址不能包含用户名或密码。");
  }

  if (baseUrl.search || baseUrl.hash) {
    throw new EndpointConfigurationError("API 基础地址不能包含查询参数或片段。");
  }

  const localDevelopmentEndpoint =
    import.meta.env.DEV &&
    baseUrl.protocol === "http:" &&
    LOCAL_HOSTS.has(baseUrl.hostname);

  if (baseUrl.protocol !== "https:" && !localDevelopmentEndpoint) {
    throw new EndpointConfigurationError(
      "公开页面只允许 HTTPS 地址；本地开发时可使用 localhost HTTP。",
    );
  }

  baseUrl.pathname = `${baseUrl.pathname.replace(/\/+$/, "")}/`;
  return baseUrl.toString().replace(/\/$/, "");
}

export function buildImageApiEndpoint(
  baseUrl: string,
  route: "images/generations" | "images/edits",
): string {
  const normalized = normalizeImageApiBaseUrl(baseUrl);
  return new URL(route, `${normalized}/`).toString();
}

export function endpointHostLabel(value: string, fallback = "未设置地址"): string {
  try {
    return new URL(normalizeImageApiBaseUrl(value)).host;
  } catch {
    return fallback;
  }
}

export function isAllowedRemoteImageUrl(value: string, baseUrl: string): URL {
  let imageUrl: URL;
  try {
    imageUrl = new URL(value, baseUrl);
  } catch {
    throw new EndpointConfigurationError("上游返回了无效的图片地址。");
  }

  if (imageUrl.username || imageUrl.password) {
    throw new EndpointConfigurationError("上游图片地址不能包含用户名或密码。");
  }

  const localDevelopmentImage =
    import.meta.env.DEV &&
    imageUrl.protocol === "http:" &&
    LOCAL_HOSTS.has(imageUrl.hostname);

  if (imageUrl.protocol !== "https:" && !localDevelopmentImage) {
    throw new EndpointConfigurationError("上游返回了不安全的非 HTTPS 图片地址。");
  }

  return imageUrl;
}
