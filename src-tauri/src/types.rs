use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageRequest {
    pub request_id: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub prompt: String,
    pub size: String,
    pub quality: String,
    pub output_format: String,
    #[serde(default)]
    pub attachments: Vec<ImageAttachment>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageAttachment {
    pub name: String,
    pub base64: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageResponse {
    pub image: String,
    pub mime_type: String,
    pub revised_prompt: Option<String>,
    pub source: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationRequest {
    pub request_id: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub source_prompt: String,
    pub shot_count: usize,
    pub supports_structured_output: bool,
    #[serde(default)]
    pub vision_images: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationResponse {
    pub content: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImagePromptPlanningRequest {
    pub request_id: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub source_prompt: String,
    pub prompt_count: usize,
    pub supports_structured_output: bool,
    #[serde(default)]
    pub vision_images: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptOptimizationRequest {
    pub request_id: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub prompt: String,
    #[serde(default)]
    pub rewrite_mode: Option<String>,
    #[serde(default)]
    pub safety_findings: Vec<String>,
    pub supports_structured_output: bool,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptOptimizationResponse {
    pub optimized_prompt: String,
    pub risk_level: String,
    pub changes: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notice: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelListRequest {
    pub base_url: String,
    pub api_key: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelListResponse {
    pub models: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveImageRequest {
    pub file_name: String,
    pub mime_type: String,
    pub base64: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandError {
    pub message: String,
    pub code: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<u16>,
}

impl CommandError {
    pub fn new(message: impl Into<String>, code: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            code: code.into(),
            status: None,
        }
    }

    pub fn with_status(
        message: impl Into<String>,
        code: impl Into<String>,
        status: u16,
    ) -> Self {
        Self {
            message: message.into(),
            code: code.into(),
            status: Some(status),
        }
    }

    pub fn cancelled() -> Self {
        Self::new("请求已由你停止。", "REQUEST_CANCELLED")
    }
}
