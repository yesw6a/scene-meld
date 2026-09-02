use reqwest::{Client, Response, StatusCode};
use serde::Serialize;
use serde_json::Value;
use tauri::ipc::Channel;

use crate::{
    http::read_limited,
    reasoning::{
        classify_unsupported_reasoning, prepare_reasoning_request, reasoning_fallback_notice,
        remember_unsupported_reasoning, upstream_error_detail,
    },
    types::CommandError,
};

const MAX_RESPONSE_BYTES: usize = 2 * 1024 * 1024;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanningProgressEvent {
    #[serde(rename = "type")]
    event_type: String,
    request_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    received_chars: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    detail: Option<String>,
}

pub struct PlanningRequest<'a> {
    pub client: &'a Client,
    pub endpoint: &'a str,
    pub api_key: &'a str,
    pub model: &'a str,
    pub reasoning_effort: Option<&'a str>,
    pub request_id: &'a str,
    pub body: &'a Value,
    pub operation: &'a str,
    pub error_code: &'a str,
    pub on_event: &'a Channel<PlanningProgressEvent>,
}

pub async fn request_content(request: PlanningRequest<'_>) -> Result<String, CommandError> {
    emit(&request, "request-started", None, None);
    let reasoning_attempt = prepare_reasoning_request(
        request.body,
        request.endpoint,
        request.model,
        request.reasoning_effort,
    )?;
    if let Some(notice) = reasoning_attempt.fallback_notice.as_deref() {
        emit(&request, "fallback-reasoning-auto", None, Some(notice));
    }

    let result = request_content_attempt(&request, &reasoning_attempt.body).await;
    let Err(error) = result else {
        return result;
    };
    let Some(effort) = reasoning_attempt.applied_effort.as_deref() else {
        return Err(error);
    };
    let Some(scope) = classify_unsupported_reasoning(error.status, &error.message, effort) else {
        return Err(error);
    };
    remember_unsupported_reasoning(request.endpoint, request.model, effort, scope);
    let notice = reasoning_fallback_notice(effort);
    emit(&request, "fallback-reasoning-auto", None, Some(&notice));
    request_content_attempt(&request, request.body).await
}

async fn request_content_attempt(
    request: &PlanningRequest<'_>,
    body: &Value,
) -> Result<String, CommandError> {
    let response = request
        .client
        .post(request.endpoint)
        .bearer_auth(request.api_key)
        .json(body)
        .send()
        .await
        .map_err(|_| network_error(request.endpoint))?;

    if !response.status().is_success() {
        let status = response.status();
        let bytes = read_limited(response, MAX_RESPONSE_BYTES, "RESPONSE_TOO_LARGE").await?;
        return Err(upstream_error(
            request,
            status,
            upstream_error_detail(&bytes, request.api_key),
        ));
    }

    emit(request, "response-started", None, None);
    read_json_response(response, request).await
}

async fn read_json_response(
    response: Response,
    request: &PlanningRequest<'_>,
) -> Result<String, CommandError> {
    let bytes = read_limited(response, MAX_RESPONSE_BYTES, "RESPONSE_TOO_LARGE").await?;
    let payload = serde_json::from_slice::<Value>(&bytes).map_err(|_| {
        CommandError::new(
            format!("{}返回的 JSON 无法解析。", request.operation),
            "INVALID_PLANNING_RESPONSE",
        )
    })?;
    let content = message_content(&payload).ok_or_else(|| {
        CommandError::new(
            format!("{}未返回规划内容。", request.operation),
            "MISSING_PLANNING_RESULT",
        )
    })?;
    emit(
        request,
        "content-delta",
        Some(content.chars().count()),
        None,
    );
    Ok(content)
}

fn message_content(payload: &Value) -> Option<String> {
    response_message(payload)?
        .get("content")
        .and_then(content_value)
        .filter(|content| !content.trim().is_empty())
}

fn response_message(payload: &Value) -> Option<&Value> {
    payload.get("choices")?.as_array()?.first()?.get("message")
}

fn content_value(value: &Value) -> Option<String> {
    if let Some(text) = value.as_str() {
        return Some(text.to_owned());
    }
    let parts = value.as_array()?;
    Some(
        parts
            .iter()
            .filter_map(|part| part.get("text").and_then(Value::as_str))
            .collect::<Vec<_>>()
            .join("\n"),
    )
}

fn upstream_error(
    request: &PlanningRequest<'_>,
    status: StatusCode,
    detail: String,
) -> CommandError {
    let message = if detail.is_empty() {
        format!("{}失败（HTTP {}）。", request.operation, status.as_u16())
    } else {
        detail
    };
    CommandError::with_status(message, request.error_code, status.as_u16())
}

fn emit(
    request: &PlanningRequest<'_>,
    event_type: &str,
    received_chars: Option<usize>,
    detail: Option<&str>,
) {
    let _ = request.on_event.send(PlanningProgressEvent {
        event_type: event_type.to_owned(),
        request_id: request.request_id.to_owned(),
        received_chars,
        detail: detail.map(str::to_owned),
    });
}

fn network_error(endpoint: &str) -> CommandError {
    CommandError::new(
        format!("无法连接目标 API（{}）。", endpoint),
        "NETWORK_ERROR",
    )
}
