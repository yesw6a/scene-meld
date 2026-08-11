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
    #[serde(default)]
    pub attachments: Vec<ImageAttachment>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageAttachment {
    pub name: String,
    pub mime_type: String,
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
