use keyring::{Entry, Error as KeyringError};

use crate::types::CommandError;

const SERVICE: &str = "com.clovemu.scenemeld";
const ACCOUNT: &str = "default-api-key";

pub fn load_api_key() -> Result<Option<String>, CommandError> {
    match entry()?.get_password() {
        Ok(api_key) => Ok(Some(api_key)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(_) => Err(keyring_error("无法读取操作系统凭据管理器中的 API Key。")),
    }
}

pub fn save_api_key(api_key: String) -> Result<(), CommandError> {
    let normalized = api_key.trim();
    if normalized.is_empty() || normalized.len() > 16_384 {
        return Err(CommandError::new("API Key 无效。", "INVALID_API_KEY"));
    }

    entry()?
        .set_password(normalized)
        .map_err(|_| keyring_error("无法将 API Key 写入操作系统凭据管理器。"))
}

pub fn delete_api_key() -> Result<(), CommandError> {
    match entry()?.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(_) => Err(keyring_error("无法从操作系统凭据管理器删除 API Key。")),
    }
}

fn entry() -> Result<Entry, CommandError> {
    Entry::new(SERVICE, ACCOUNT)
        .map_err(|_| keyring_error("操作系统凭据管理器当前不可用。"))
}

fn keyring_error(message: &str) -> CommandError {
    CommandError::new(message, "KEYRING_ERROR")
}
