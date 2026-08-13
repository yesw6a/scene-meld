mod http;
mod files;
mod request_state;
mod secrets;
mod types;

use request_state::RequestState;
use tauri::State;
use types::{CommandError, ImageRequest, ImageResponse};

#[tauri::command]
async fn generate_image(
    request: ImageRequest,
    state: State<'_, RequestState>,
) -> Result<ImageResponse, CommandError> {
    run_image_request(request, state, false).await
}

#[tauri::command]
async fn edit_image(
    request: ImageRequest,
    state: State<'_, RequestState>,
) -> Result<ImageResponse, CommandError> {
    run_image_request(request, state, true).await
}

async fn run_image_request(
    request: ImageRequest,
    state: State<'_, RequestState>,
    edit: bool,
) -> Result<ImageResponse, CommandError> {
    let mut cancelled = state.begin(&request.request_id)?;
    let result = tokio::select! {
        response = async {
            if edit {
                http::edit(&request).await
            } else {
                http::generate(&request).await
            }
        } => response,
        _ = &mut cancelled => Err(CommandError::cancelled()),
    };
    state.finish(&request.request_id)?;
    result
}

#[tauri::command]
fn cancel_image_request(
    request_id: String,
    state: State<'_, RequestState>,
) -> Result<bool, CommandError> {
    state.cancel(&request_id)
}

#[tauri::command]
async fn load_api_key() -> Result<Option<String>, CommandError> {
    tauri::async_runtime::spawn_blocking(secrets::load_api_key)
        .await
        .map_err(|_| CommandError::new("系统凭据任务失败。", "KEYRING_TASK_ERROR"))?
}

#[tauri::command]
async fn save_api_key(api_key: String) -> Result<(), CommandError> {
    tauri::async_runtime::spawn_blocking(move || secrets::save_api_key(api_key))
        .await
        .map_err(|_| CommandError::new("系统凭据任务失败。", "KEYRING_TASK_ERROR"))?
}

#[tauri::command]
async fn delete_api_key() -> Result<(), CommandError> {
    tauri::async_runtime::spawn_blocking(secrets::delete_api_key)
        .await
        .map_err(|_| CommandError::new("系统凭据任务失败。", "KEYRING_TASK_ERROR"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(RequestState::default())
        .invoke_handler(tauri::generate_handler![
            generate_image,
            edit_image,
            cancel_image_request,
            files::save_image_file,
            load_api_key,
            save_api_key,
            delete_api_key,
        ])
        .run(tauri::generate_context!())
        .expect("error while running SceneMeld Desktop");
}
