use std::{net::IpAddr, time::Duration};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use futures_util::StreamExt;
use reqwest::{
    header::CONTENT_TYPE,
    multipart::{Form, Part},
    redirect::Policy,
    Client, Response,
};
use serde::Deserialize;
use serde_json::json;
use url::Url;

use crate::types::{CommandError, ImageAttachment, ImageRequest, ImageResponse};

const MAX_IMAGE_BYTES: usize = 25 * 1024 * 1024;
const MAX_JSON_BYTES: usize = ((MAX_IMAGE_BYTES * 4) / 3) + (1024 * 1024);
const MAX_ATTACHMENT_BYTES: usize = 20 * 1024 * 1024;
const MAX_ATTACHMENT_COUNT: usize = 16;
const MAX_TOTAL_ATTACHMENT_BYTES: usize = 50 * 1024 * 1024;
const SUPPORTED_MODEL: &str = "gpt-image-2";

#[derive(Deserialize)]
struct UpstreamPayload {
    data: Option<Vec<UpstreamImage>>,
    error: Option<UpstreamError>,
}

#[derive(Deserialize)]
struct UpstreamImage {
    b64_json: Option<String>,
    url: Option<String>,
    revised_prompt: Option<String>,
    mime_type: Option<String>,
}

#[derive(Deserialize)]
struct UpstreamError {
    message: Option<String>,
    code: Option<String>,
}

pub async fn generate(request: &ImageRequest) -> Result<ImageResponse, CommandError> {
    validate_common_request(request)?;
    let endpoint = build_endpoint(&request.base_url, "images/generations")?;
    let client = authenticated_client()?;
    let response = client
        .post(endpoint.clone())
        .bearer_auth(&request.api_key)
        .json(&json!({
            "model": &request.model,
            "prompt": &request.prompt,
            "size": &request.size,
            "quality": &request.quality,
        }))
        .send()
        .await
        .map_err(|_| network_error(&endpoint))?;

    parse_image_response(response, &endpoint, &request.api_key).await
}

pub async fn edit(request: &ImageRequest) -> Result<ImageResponse, CommandError> {
    validate_common_request(request)?;
    let endpoint = build_endpoint(&request.base_url, "images/edits")?;
    let attachments = validate_attachments(&request.attachments)?;
    let mut form = Form::new()
        .text("model", request.model.clone())
        .text("prompt", request.prompt.clone())
        .text("size", request.size.clone())
        .text("quality", request.quality.clone());

    for (attachment, bytes) in request.attachments.iter().zip(attachments) {
        let part = Part::bytes(bytes)
            .file_name(attachment.name.clone())
            .mime_str(&attachment.mime_type)
            .map_err(|_| {
                CommandError::new("参考图 MIME 类型无效。", "INVALID_ATTACHMENT_MIME")
            })?;
        form = form.part("image[]", part);
    }

    let client = authenticated_client()?;
    let response = client
        .post(endpoint.clone())
        .bearer_auth(&request.api_key)
        .multipart(form)
        .send()
        .await
        .map_err(|_| network_error(&endpoint))?;

    parse_image_response(response, &endpoint, &request.api_key).await
}

fn validate_common_request(request: &ImageRequest) -> Result<(), CommandError> {
    if request.model != SUPPORTED_MODEL {
        return Err(CommandError::new(
            "当前仅支持 gpt-image-2 模型。",
            "UNSUPPORTED_MODEL",
        ));
    }
    if request.api_key.trim().is_empty() || request.api_key.len() > 16_384 {
        return Err(CommandError::new("API Key 无效。", "INVALID_API_KEY"));
    }
    if request.model.trim().is_empty() || request.model.len() > 256 {
        return Err(CommandError::new("模型名称无效。", "INVALID_MODEL"));
    }
    if request.prompt.trim().is_empty() || request.prompt.chars().count() > 20_000 {
        return Err(CommandError::new("提示词无效或超过 20,000 个字符。", "INVALID_PROMPT"));
    }
    if !matches!(request.quality.as_str(), "low" | "medium" | "high") {
        return Err(CommandError::new("图片质量选项无效。", "INVALID_QUALITY"));
    }
    if !matches!(
        request.size.as_str(),
        "1536x864" | "864x1536" | "1024x1024" | "1536x1024" | "1024x1536"
    ) {
        return Err(CommandError::new("图片尺寸选项无效。", "INVALID_SIZE"));
    }
    Ok(())
}

fn validate_attachments(attachments: &[ImageAttachment]) -> Result<Vec<Vec<u8>>, CommandError> {
    if attachments.is_empty() || attachments.len() > MAX_ATTACHMENT_COUNT {
        return Err(CommandError::new(
            "图生图需要 1 至 16 张参考图。",
            "INVALID_ATTACHMENT_COUNT",
        ));
    }

    let mut total_bytes = 0usize;
    attachments
        .iter()
        .map(|attachment| {
            if attachment.name.is_empty()
                || attachment.name.len() > 180
                || attachment.name.chars().any(char::is_control)
            {
                return Err(CommandError::new(
                    "参考图文件名无效。",
                    "INVALID_ATTACHMENT_NAME",
                ));
            }
            if attachment.base64.len() > ((MAX_ATTACHMENT_BYTES * 4) / 3) + (1024 * 1024) {
                return Err(CommandError::new(
                    "单张参考图不能超过 20 MB。",
                    "ATTACHMENT_TOO_LARGE",
                ));
            }
            let bytes = BASE64.decode(&attachment.base64).map_err(|_| {
                CommandError::new("参考图 Base64 数据无效。", "INVALID_ATTACHMENT_BASE64")
            })?;
            if bytes.is_empty() || bytes.len() > MAX_ATTACHMENT_BYTES {
                return Err(CommandError::new(
                    "单张参考图不能超过 20 MB。",
                    "ATTACHMENT_TOO_LARGE",
                ));
            }
            total_bytes = total_bytes.saturating_add(bytes.len());
            if total_bytes > MAX_TOTAL_ATTACHMENT_BYTES {
                return Err(CommandError::new(
                    "参考图总大小不能超过 50 MB。",
                    "ATTACHMENTS_TOO_LARGE",
                ));
            }
            let detected = detect_image_mime(&bytes)?;
            if normalize_mime(&attachment.mime_type) != Some(detected) {
                return Err(CommandError::new(
                    "参考图声明格式与实际内容不一致。",
                    "ATTACHMENT_TYPE_MISMATCH",
                ));
            }
            Ok(bytes)
        })
        .collect()
}

async fn parse_image_response(
    response: Response,
    endpoint: &Url,
    api_key: &str,
) -> Result<ImageResponse, CommandError> {
    let status = response.status();
    let bytes = read_limited(response, MAX_JSON_BYTES, "RESPONSE_TOO_LARGE").await?;
    let payload = serde_json::from_slice::<UpstreamPayload>(&bytes).ok();

    if !status.is_success() {
        let upstream_message = payload
            .as_ref()
            .and_then(|payload| payload.error.as_ref())
            .and_then(|error| error.message.as_deref())
            .map(|message| redact_secret(message, api_key));
        let upstream_code = payload
            .as_ref()
            .and_then(|payload| payload.error.as_ref())
            .and_then(|error| error.code.clone())
            .unwrap_or_else(|| "UPSTREAM_ERROR".to_owned());
        return Err(CommandError::with_status(
            upstream_message.unwrap_or_else(|| format!("图片请求失败（HTTP {}）。", status.as_u16())),
            upstream_code,
            status.as_u16(),
        ));
    }

    let payload = payload.ok_or_else(|| {
        CommandError::with_status(
            "目标 API 没有返回有效的 JSON 数据。",
            "INVALID_JSON_RESPONSE",
            status.as_u16(),
        )
    })?;
    let image = payload
        .data
        .and_then(|mut images| images.drain(..).next())
        .ok_or_else(|| CommandError::new("目标 API 没有返回图片结果。", "MISSING_IMAGE_RESULT"))?;

    if let Some(base64) = image.b64_json.filter(|value| !value.is_empty()) {
        let decoded = BASE64.decode(&base64).map_err(|_| {
            CommandError::new("目标 API 返回了无效的 Base64 图片。", "INVALID_BASE64_IMAGE")
        })?;
        if decoded.len() > MAX_IMAGE_BYTES {
            return Err(CommandError::new(
                "目标 API 返回的图片超过 25 MB。",
                "IMAGE_TOO_LARGE",
            ));
        }
        let detected = detect_image_mime(&decoded)?;
        validate_advertised_mime(image.mime_type.as_deref(), detected)?;
        return Ok(ImageResponse {
            image: base64,
            mime_type: detected.to_owned(),
            revised_prompt: image.revised_prompt,
            source: "b64_json".to_owned(),
        });
    }

    if let Some(remote_url) = image.url.filter(|value| !value.is_empty()) {
        let (image_bytes, mime_type) = download_remote_image(&remote_url, endpoint).await?;
        return Ok(ImageResponse {
            image: BASE64.encode(image_bytes),
            mime_type,
            revised_prompt: image.revised_prompt,
            source: "url".to_owned(),
        });
    }

    Err(CommandError::new(
        "目标 API 需要返回 data[0].b64_json 或 data[0].url。",
        "UNSUPPORTED_RESPONSE",
    ))
}

async fn download_remote_image(value: &str, endpoint: &Url) -> Result<(Vec<u8>, String), CommandError> {
    let image_url = resolve_remote_image_url(value, endpoint)?;
    let client = remote_image_client()?;
    let response = client
        .get(image_url)
        .send()
        .await
        .map_err(|_| CommandError::new("无法下载目标 API 返回的图片 URL。", "REMOTE_IMAGE_DOWNLOAD_ERROR"))?;
    let status = response.status();
    if !status.is_success() {
        return Err(CommandError::with_status(
            format!("下载上游图片失败（HTTP {}）。", status.as_u16()),
            "REMOTE_IMAGE_DOWNLOAD_ERROR",
            status.as_u16(),
        ));
    }
    validate_remote_url(response.url())?;
    let advertised_header = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned);
    let advertised = advertised_header
        .as_deref()
        .map(|value| {
            normalize_mime(value).ok_or_else(|| {
                CommandError::new(
                    "上游图片 URL 没有返回受支持的图片 MIME 类型。",
                    "INVALID_REMOTE_IMAGE",
                )
            })
        })
        .transpose()?;
    let bytes = read_limited(response, MAX_IMAGE_BYTES, "REMOTE_IMAGE_TOO_LARGE").await?;
    let detected = detect_image_mime(&bytes)?;
    if let Some(advertised) = advertised {
        if advertised != detected {
            return Err(CommandError::new(
                "上游图片声明格式与实际内容不一致。",
                "IMAGE_TYPE_MISMATCH",
            ));
        }
    }
    Ok((bytes, detected.to_owned()))
}

async fn read_limited(
    response: Response,
    limit: usize,
    code: &str,
) -> Result<Vec<u8>, CommandError> {
    if response.content_length().is_some_and(|size| size > limit as u64) {
        return Err(CommandError::new("目标 API 返回的数据过大。", code));
    }

    let mut bytes = Vec::new();
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|_| {
            CommandError::new("读取目标 API 响应失败。", "RESPONSE_READ_ERROR")
        })?;
        if bytes.len().saturating_add(chunk.len()) > limit {
            return Err(CommandError::new("目标 API 返回的数据过大。", code));
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}

fn authenticated_client() -> Result<Client, CommandError> {
    Client::builder()
        .redirect(Policy::none())
        .timeout(Duration::from_secs(300))
        .build()
        .map_err(|_| CommandError::new("无法初始化桌面网络客户端。", "HTTP_CLIENT_ERROR"))
}

fn remote_image_client() -> Result<Client, CommandError> {
    Client::builder()
        .redirect(Policy::custom(|attempt| {
            if attempt.previous().len() >= 5 {
                return attempt.error("too many image redirects");
            }
            if validate_remote_url(attempt.url()).is_err() {
                return attempt.error("unsafe image redirect");
            }
            attempt.follow()
        }))
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|_| CommandError::new("无法初始化图片下载客户端。", "HTTP_CLIENT_ERROR"))
}

fn build_endpoint(base_url: &str, route: &str) -> Result<Url, CommandError> {
    let mut url = Url::parse(base_url.trim()).map_err(|_| {
        CommandError::new("请输入有效的 API 基础地址。", "INVALID_BASE_URL")
    })?;
    validate_base_url(&url)?;
    {
        let mut segments = url.path_segments_mut().map_err(|_| {
            CommandError::new("API 基础地址无法追加图片路由。", "INVALID_BASE_URL")
        })?;
        segments.pop_if_empty();
        for segment in route.split('/') {
            segments.push(segment);
        }
    }
    Ok(url)
}

fn validate_base_url(url: &Url) -> Result<(), CommandError> {
    if !url.username().is_empty() || url.password().is_some() {
        return Err(CommandError::new(
            "API 地址不能包含用户名或密码。",
            "URL_CREDENTIALS_NOT_ALLOWED",
        ));
    }
    if url.query().is_some() || url.fragment().is_some() {
        return Err(CommandError::new(
            "API 基础地址不能包含查询参数或片段。",
            "BASE_URL_QUERY_NOT_ALLOWED",
        ));
    }
    validate_remote_url(url)
}

fn resolve_remote_image_url(value: &str, base: &Url) -> Result<Url, CommandError> {
    let mut url = Url::parse(value).or_else(|_| base.join(value)).map_err(|_| {
        CommandError::new("目标 API 返回了无效的图片地址。", "INVALID_REMOTE_IMAGE_URL")
    })?;
    url.set_fragment(None);
    validate_remote_url(&url)?;
    Ok(url)
}

fn validate_remote_url(url: &Url) -> Result<(), CommandError> {
    if url.host_str().is_none() {
        return Err(CommandError::new(
            "远程地址缺少有效主机名。",
            "INVALID_REMOTE_HOST",
        ));
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err(CommandError::new(
            "远程地址不能包含用户名或密码。",
            "URL_CREDENTIALS_NOT_ALLOWED",
        ));
    }
    if url.scheme() == "https" || (cfg!(debug_assertions) && is_local_http(url)) {
        return Ok(());
    }
    Err(CommandError::new(
        "公开构建仅允许 HTTPS 地址；调试构建可使用 localhost HTTP。",
        "INSECURE_URL_NOT_ALLOWED",
    ))
}

fn is_local_http(url: &Url) -> bool {
    if url.scheme() != "http" {
        return false;
    }
    match url.host_str() {
        Some("localhost") => true,
        Some(host) => host
            .parse::<IpAddr>()
            .map(|address| address.is_loopback())
            .unwrap_or(false),
        None => false,
    }
}

fn normalize_mime(value: &str) -> Option<&'static str> {
    let normalized = value.split(';').next()?.trim().to_ascii_lowercase();
    match normalized.as_str() {
        "image/png" => Some("image/png"),
        "image/jpeg" | "image/jpg" => Some("image/jpeg"),
        "image/webp" => Some("image/webp"),
        "image/gif" => Some("image/gif"),
        _ => None,
    }
}

fn detect_image_mime(bytes: &[u8]) -> Result<&'static str, CommandError> {
    if bytes.starts_with(&[137, 80, 78, 71, 13, 10, 26, 10]) {
        return Ok("image/png");
    }
    if bytes.starts_with(&[0xff, 0xd8]) {
        return Ok("image/jpeg");
    }
    if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        return Ok("image/webp");
    }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        return Ok("image/gif");
    }
    Err(CommandError::new(
        "图片不是受支持的 PNG、JPEG、WebP 或 GIF 格式。",
        "UNSUPPORTED_IMAGE_TYPE",
    ))
}

fn validate_advertised_mime(value: Option<&str>, detected: &str) -> Result<(), CommandError> {
    if let Some(value) = value {
        if normalize_mime(value) != Some(detected) {
            return Err(CommandError::new(
                "目标 API 声明的图片格式与实际内容不一致。",
                "IMAGE_TYPE_MISMATCH",
            ));
        }
    }
    Ok(())
}

fn network_error(endpoint: &Url) -> CommandError {
    CommandError::new(
        format!("桌面端无法直接连接 {}，请检查网络、HTTPS 与 Endpoint 配置。", endpoint.host_str().unwrap_or("目标 API")),
        "NETWORK_ERROR",
    )
}

fn redact_secret(message: &str, secret: &str) -> String {
    let redacted = if secret.is_empty() {
        message.to_owned()
    } else {
        message.replace(secret, "[redacted]")
    };
    redacted.chars().take(500).collect()
}
