use serde::Deserialize;
use serde_json::json;

use crate::{
    http::{authenticated_client, build_endpoint, network_error, read_limited, redact_secret},
    types::{CommandError, ConversationResponse, ImagePromptPlanningRequest},
};

const PLANNER_SYSTEM_PROMPT: &str = "你是图像生成规划器。把用户创作意图整理成可直接交给图像模型的完整提示词，补全主体、环境、构图、镜头、光线、材质与风格，但不得改变核心主题。当请求多条提示词时，在保持主题一致的前提下规划明确且有价值的构图、镜头或氛围差异；不要把它们写成前后连续的分镜。只返回 JSON：{\"prompts\":[\"...\"]}。prompts 数量必须与用户要求完全一致，不要返回 Markdown 或其他字段。";

#[derive(Deserialize)]
struct PlanningPayload {
    choices: Option<Vec<PlanningChoice>>,
    error: Option<PlanningError>,
}

#[derive(Deserialize)]
struct PlanningChoice {
    message: Option<PlanningMessage>,
}

#[derive(Deserialize)]
struct PlanningMessage {
    content: Option<String>,
}

#[derive(Deserialize)]
struct PlanningError {
    message: Option<String>,
}

pub async fn plan_image_prompts(
    request: &ImagePromptPlanningRequest,
) -> Result<ConversationResponse, CommandError> {
    validate_request(request)?;

    let endpoint = build_endpoint(&request.base_url, "chat/completions")?;
    let mut user_content = vec![json!({
        "type": "text",
        "text": format!(
            "请规划 {} 条图像生成提示词。创作需求：{}",
            request.prompt_count, request.source_prompt
        )
    })];
    user_content.extend(
        request
            .vision_images
            .iter()
            .map(|image| json!({ "type": "image_url", "image_url": { "url": image } })),
    );

    let mut body = json!({
        "model": &request.model,
        "temperature": 0.5,
        "messages": [
            { "role": "system", "content": PLANNER_SYSTEM_PROMPT },
            { "role": "user", "content": user_content }
        ]
    });
    if request.supports_structured_output {
        body["response_format"] = json!({ "type": "json_object" });
    }

    let client = authenticated_client()?;
    let response = client
        .post(endpoint.clone())
        .bearer_auth(&request.api_key)
        .json(&body)
        .send()
        .await
        .map_err(|_| network_error(&endpoint))?;
    let status = response.status();
    let bytes = read_limited(response, 2 * 1024 * 1024, "RESPONSE_TOO_LARGE").await?;
    let payload = serde_json::from_slice::<PlanningPayload>(&bytes).ok();

    if !status.is_success() {
        let message = payload
            .as_ref()
            .and_then(|value| value.error.as_ref())
            .and_then(|error| error.message.as_deref())
            .map(|value| redact_secret(value, &request.api_key))
            .unwrap_or_else(|| format!("AI 提示词规划失败（HTTP {}）。", status.as_u16()));
        return Err(CommandError::with_status(
            message,
            "IMAGE_PROMPT_PLANNING_UPSTREAM_ERROR",
            status.as_u16(),
        ));
    }

    let content = payload
        .and_then(|value| value.choices)
        .and_then(|mut choices| choices.drain(..).next())
        .and_then(|choice| choice.message)
        .and_then(|message| message.content)
        .filter(|content| !content.trim().is_empty())
        .ok_or_else(|| {
            CommandError::new("AI 未返回提示词规划内容。", "MISSING_IMAGE_PROMPT_PLAN")
        })?;

    Ok(ConversationResponse { content })
}

fn validate_request(request: &ImagePromptPlanningRequest) -> Result<(), CommandError> {
    if request.api_key.trim().is_empty() || request.api_key.len() > 16_384 {
        return Err(CommandError::new("API Key 无效。", "INVALID_API_KEY"));
    }
    if request.model.trim().is_empty() || request.model.len() > 256 {
        return Err(CommandError::new("AI 模型名称无效。", "INVALID_MODEL"));
    }
    if request.source_prompt.trim().is_empty() || request.source_prompt.chars().count() > 20_000 {
        return Err(CommandError::new(
            "待规划的提示词为空或过长。",
            "INVALID_PROMPT",
        ));
    }
    if !(1..=9).contains(&request.prompt_count) {
        return Err(CommandError::new(
            "AI 规划数量必须为 1 到 9。",
            "INVALID_PROMPT_COUNT",
        ));
    }
    if request.vision_images.len() > 4
        || request
            .vision_images
            .iter()
            .any(|image| image.len() > 28 * 1024 * 1024 || !image.starts_with("data:image/"))
    {
        return Err(CommandError::new(
            "多模态参考图无效或过大。",
            "INVALID_VISION_IMAGE",
        ));
    }
    Ok(())
}
