use std::{
    collections::HashSet,
    sync::{Mutex, OnceLock},
};

use serde_json::{json, Value};

use crate::types::CommandError;

static UNSUPPORTED_REASONING_PARAMETERS: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
static UNSUPPORTED_REASONING_EFFORTS: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();

#[derive(Clone, Copy, Debug)]
pub enum UnsupportedReasoningScope {
    Parameter,
    Effort,
}

pub struct ReasoningRequestAttempt {
    pub body: Value,
    pub applied_effort: Option<String>,
    pub fallback_notice: Option<String>,
}

pub fn prepare_reasoning_request(
    body: &Value,
    endpoint: &str,
    model: &str,
    configured_effort: Option<&str>,
) -> Result<ReasoningRequestAttempt, CommandError> {
    let Some(effort) = validate_reasoning_effort(configured_effort)? else {
        return Ok(ReasoningRequestAttempt {
            body: body.clone(),
            applied_effort: None,
            fallback_notice: None,
        });
    };

    let connection_key = reasoning_connection_key(endpoint, model);
    let effort_key = reasoning_effort_key(&connection_key, effort);
    if contains_cached(&UNSUPPORTED_REASONING_PARAMETERS, &connection_key)
        || contains_cached(&UNSUPPORTED_REASONING_EFFORTS, &effort_key)
    {
        return Ok(ReasoningRequestAttempt {
            body: body.clone(),
            applied_effort: None,
            fallback_notice: Some(reasoning_fallback_notice(effort)),
        });
    }

    let mut reasoning_body = body.clone();
    let Some(object) = reasoning_body.as_object_mut() else {
        return Err(CommandError::new(
            "AI 请求体格式无效。",
            "INVALID_REASONING_REQUEST_BODY",
        ));
    };
    object.insert("reasoning_effort".to_owned(), json!(effort));
    Ok(ReasoningRequestAttempt {
        body: reasoning_body,
        applied_effort: Some(effort.to_owned()),
        fallback_notice: None,
    })
}

pub fn classify_unsupported_reasoning(
    status: Option<u16>,
    detail: &str,
    effort: &str,
) -> Option<UnsupportedReasoningScope> {
    if !matches!(status, Some(400 | 422)) {
        return None;
    }
    let detail = detail.to_ascii_lowercase();
    if !contains_any(
        &detail,
        &["reasoning_effort", "reasoning effort", "reasoning-effort"],
    ) || !contains_any(
        &detail,
        &[
            "unsupported",
            "not support",
            "unknown",
            "unrecognized",
            "invalid",
            "not allowed",
            "not permitted",
            "不支持",
            "未知",
            "无法识别",
            "无效",
            "不允许",
        ],
    ) {
        return None;
    }

    let value_specific = contains_any(
        &detail,
        &[
            "unsupported_value",
            "unsupported value",
            "invalid_value",
            "invalid value",
            "allowed value",
            "supported value",
            "one of",
            "enum",
        ],
    ) || (detail.contains("value")
        && detail.contains(&effort.to_ascii_lowercase()));
    Some(if value_specific {
        UnsupportedReasoningScope::Effort
    } else {
        UnsupportedReasoningScope::Parameter
    })
}

pub fn remember_unsupported_reasoning(
    endpoint: &str,
    model: &str,
    effort: &str,
    scope: UnsupportedReasoningScope,
) {
    let connection_key = reasoning_connection_key(endpoint, model);
    match scope {
        UnsupportedReasoningScope::Parameter => {
            insert_cached(&UNSUPPORTED_REASONING_PARAMETERS, connection_key)
        }
        UnsupportedReasoningScope::Effort => insert_cached(
            &UNSUPPORTED_REASONING_EFFORTS,
            reasoning_effort_key(&connection_key, effort),
        ),
    }
}

pub fn reasoning_fallback_notice(effort: &str) -> String {
    format!(
        "当前模型不支持“{}”推理程度，已改用模型默认设置，本次任务将继续执行。",
        reasoning_effort_label(effort)
    )
}

pub fn upstream_error_detail(bytes: &[u8], api_key: &str) -> String {
    let Ok(payload) = serde_json::from_slice::<Value>(bytes) else {
        return String::new();
    };
    let Some(error) = payload.get("error") else {
        return String::new();
    };
    let message = error
        .get("message")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .replace(api_key, "[REDACTED]");
    let param = error
        .get("param")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let code = error
        .get("code")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let classification_detail = format!("{} {} {}", message, param, code);
    if !contains_any(
        &classification_detail,
        &["reasoning_effort", "reasoning effort", "reasoning-effort"],
    ) {
        return message;
    }

    let mut details = vec![message];
    if !param.is_empty() {
        details.push(format!("param: {param}"));
    }
    if !code.is_empty() {
        details.push(format!("code: {code}"));
    }
    details
        .into_iter()
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>()
        .join("; ")
}

pub fn merge_notice(current: Option<String>, notice: String) -> Option<String> {
    match current {
        Some(current) if current.trim() == notice.trim() => Some(current),
        Some(current) if !current.trim().is_empty() => Some(
            format!("{} {}", notice.trim(), current.trim())
                .chars()
                .take(1_000)
                .collect(),
        ),
        _ => Some(notice),
    }
}

fn validate_reasoning_effort(value: Option<&str>) -> Result<Option<&str>, CommandError> {
    match value.unwrap_or("auto").trim() {
        "" | "auto" => Ok(None),
        effort @ ("low" | "medium" | "high") => Ok(Some(effort)),
        _ => Err(CommandError::new(
            "推理程度无效，请选择自动、低、中或高。",
            "INVALID_REASONING_EFFORT",
        )),
    }
}

fn reasoning_connection_key(endpoint: &str, model: &str) -> String {
    format!("{}\n{}", endpoint.trim(), model.trim())
}

fn reasoning_effort_key(connection_key: &str, effort: &str) -> String {
    format!("{}\n{}", connection_key, effort.trim())
}

fn reasoning_effort_label(effort: &str) -> &'static str {
    match effort {
        "low" => "低",
        "medium" => "中",
        _ => "高",
    }
}

fn contains_any(value: &str, needles: &[&str]) -> bool {
    let value = value.to_ascii_lowercase();
    needles
        .iter()
        .any(|needle| value.contains(&needle.to_ascii_lowercase()))
}

fn contains_cached(cache: &'static OnceLock<Mutex<HashSet<String>>>, key: &str) -> bool {
    cache
        .get_or_init(|| Mutex::new(HashSet::new()))
        .lock()
        .map(|values| values.contains(key))
        .unwrap_or(false)
}

fn insert_cached(cache: &'static OnceLock<Mutex<HashSet<String>>>, key: String) {
    if let Ok(mut values) = cache.get_or_init(|| Mutex::new(HashSet::new())).lock() {
        values.insert(key);
    }
}
