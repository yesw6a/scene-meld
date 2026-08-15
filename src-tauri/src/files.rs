use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use tauri_plugin_dialog::DialogExt;

use crate::types::{CommandError, SaveImageRequest};

const MAX_IMAGE_BYTES: usize = 25 * 1024 * 1024;

#[tauri::command]
pub async fn save_image_file(
    request: SaveImageRequest,
    app: tauri::AppHandle,
) -> Result<bool, CommandError> {
    let extension = validate_request(&request)?;
    let bytes = BASE64.decode(&request.base64).map_err(|_| {
        CommandError::new("图片数据无效，无法保存。", "INVALID_IMAGE_BASE64")
    })?;
    if bytes.is_empty() || bytes.len() > MAX_IMAGE_BYTES {
        return Err(CommandError::new("图片超过 25 MB，无法保存。", "IMAGE_TOO_LARGE"));
    }

    tauri::async_runtime::spawn_blocking(move || {
        let selected = app
            .dialog()
            .file()
            .set_title("保存图片")
            .set_file_name(&request.file_name)
            .add_filter("图片", &[extension])
            .blocking_save_file();

        let Some(selected) = selected else {
            return Ok(false);
        };

        let path = selected.into_path().map_err(|_| {
            CommandError::new("保存位置不是有效的本地文件路径。", "INVALID_SAVE_PATH")
        })?;
        std::fs::write(path, bytes)
            .map(|_| true)
            .map_err(|_| CommandError::new("无法写入选定的图片文件。", "IMAGE_WRITE_ERROR"))
    })
    .await
    .map_err(|_| CommandError::new("图片保存任务失败。", "IMAGE_SAVE_TASK_ERROR"))?
}

fn validate_request(request: &SaveImageRequest) -> Result<&'static str, CommandError> {
    if request.file_name.trim().is_empty()
        || request.file_name.len() > 180
        || request.file_name.chars().any(char::is_control)
        || request.file_name.contains('/')
        || request.file_name.contains('\\')
    {
        return Err(CommandError::new("图片文件名无效。", "INVALID_FILE_NAME"));
    }

    let extension = match request.mime_type.as_str() {
        "image/png" => "png",
        "image/jpeg" => "jpg",
        "image/webp" => "webp",
        "image/gif" => "gif",
        _ => return Err(CommandError::new("图片格式不受支持。", "UNSUPPORTED_IMAGE_TYPE")),
    };

    if request.base64.len() > ((MAX_IMAGE_BYTES * 4) / 3) + 1024 * 1024 {
        return Err(CommandError::new("图片超过 25 MB，无法保存。", "IMAGE_TOO_LARGE"));
    }

    Ok(extension)
}
