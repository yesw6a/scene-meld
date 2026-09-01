mod http;
mod files;
mod planning;
mod request_state;
mod secrets;
mod types;

use request_state::RequestState;
use tauri::State;
use types::{
    CommandError, ConversationRequest, ConversationResponse, ImagePromptPlanningRequest,
    ImageRequest, ImageResponse, ModelListRequest, ModelListResponse, PromptOptimizationRequest,
    PromptOptimizationResponse,
};

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

#[tauri::command]
async fn plan_storyboard(
    request: ConversationRequest,
    state: State<'_, RequestState>,
) -> Result<ConversationResponse, CommandError> {
    let mut cancelled = state.begin(&request.request_id)?;
    let result = tokio::select! {
        response = http::plan_storyboard(&request) => response,
        _ = &mut cancelled => Err(CommandError::cancelled()),
    };
    state.finish(&request.request_id)?;
    result
}

#[tauri::command]
async fn plan_image_prompts(
    request: ImagePromptPlanningRequest,
    state: State<'_, RequestState>,
) -> Result<ConversationResponse, CommandError> {
    let mut cancelled = state.begin(&request.request_id)?;
    let result = tokio::select! {
        response = http::plan_image_prompts(&request) => response,
        _ = &mut cancelled => Err(CommandError::cancelled()),
    };
    state.finish(&request.request_id)?;
    result
}

#[tauri::command]
async fn optimize_prompt(
    request: PromptOptimizationRequest,
    state: State<'_, RequestState>,
) -> Result<PromptOptimizationResponse, CommandError> {
    let mut cancelled = state.begin(&request.request_id)?;
    let result = tokio::select! {
        response = http::optimize_prompt(&request) => response,
        _ = &mut cancelled => Err(CommandError::cancelled()),
    };
    state.finish(&request.request_id)?;
    result
}

#[tauri::command]
async fn list_conversation_models(
    request: ModelListRequest,
) -> Result<ModelListResponse, CommandError> {
    http::list_conversation_models(&request).await
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

#[tauri::command]
async fn load_conversation_api_key() -> Result<Option<String>, CommandError> {
    tauri::async_runtime::spawn_blocking(secrets::load_conversation_api_key)
        .await
        .map_err(|_| CommandError::new("系统凭据任务失败。", "KEYRING_TASK_ERROR"))?
}

#[tauri::command]
async fn save_conversation_api_key(api_key: String) -> Result<(), CommandError> {
    tauri::async_runtime::spawn_blocking(move || secrets::save_conversation_api_key(api_key))
        .await
        .map_err(|_| CommandError::new("系统凭据任务失败。", "KEYRING_TASK_ERROR"))?
}

#[tauri::command]
async fn delete_conversation_api_key() -> Result<(), CommandError> {
    tauri::async_runtime::spawn_blocking(secrets::delete_conversation_api_key)
        .await
        .map_err(|_| CommandError::new("系统凭据任务失败。", "KEYRING_TASK_ERROR"))?
}

#[tauri::command]
fn log_frontend_error(message: String) {
    eprintln!("[SceneMeld][frontend] {}", message);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    std::panic::set_hook(Box::new(|panic| {
        eprintln!("[SceneMeld][panic] {}", panic);
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            #[cfg(desktop)]
            {
                app.handle().plugin(tauri_plugin_process::init())?;
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
            }
            eprintln!("[SceneMeld][window] setup complete");
            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { .. }
                | tauri::WindowEvent::Destroyed
                | tauri::WindowEvent::Focused(_) => {
                    eprintln!("[SceneMeld][window:{}] {:?}", window.label(), event);
                }
                _ => {}
            }
        })
        .manage(RequestState::default())
        .invoke_handler(tauri::generate_handler![
            generate_image,
            edit_image,
            plan_storyboard,
            plan_image_prompts,
            optimize_prompt,
            list_conversation_models,
            cancel_image_request,
            files::save_image_file,
            load_api_key,
            save_api_key,
            delete_api_key,
            load_conversation_api_key,
            save_conversation_api_key,
            delete_conversation_api_key,
            log_frontend_error,
        ])
        .run(tauri::generate_context!())
        .expect("error while running SceneMeld Desktop");
}
