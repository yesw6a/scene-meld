use keyring::{Entry, Error as KeyringError};

use crate::types::CommandError;

const SERVICE: &str = "com.clovemu.scenemeld";
const IMAGE_ACCOUNT: &str = "image-api-key";
const CONVERSATION_ACCOUNT: &str = "conversation-api-key";
const LEGACY_ACCOUNT: &str = "default-api-key";

pub fn load_api_key() -> Result<Option<String>, CommandError> {
    load_named_api_key(IMAGE_ACCOUNT)
}

pub fn save_api_key(api_key: String) -> Result<(), CommandError> {
    save_named_api_key(IMAGE_ACCOUNT, api_key)
}

pub fn load_conversation_api_key() -> Result<Option<String>, CommandError> {
    load_named_api_key(CONVERSATION_ACCOUNT)
}

pub fn save_conversation_api_key(api_key: String) -> Result<(), CommandError> {
    save_named_api_key(CONVERSATION_ACCOUNT, api_key)
}

pub fn delete_conversation_api_key() -> Result<(), CommandError> {
    delete_named_api_key(CONVERSATION_ACCOUNT)
}

pub fn delete_api_key() -> Result<(), CommandError> {
    delete_named_api_key(IMAGE_ACCOUNT)
}

fn load_named_api_key(account: &str) -> Result<Option<String>, CommandError> {
    match Entry::new(SERVICE, account)
        .map_err(|_| keyring_error("操作系统凭据管理器当前不可用。"))?
        .get_password()
    {
        Ok(api_key) => Ok(Some(api_key)),
        Err(KeyringError::NoEntry) if account == IMAGE_ACCOUNT => load_legacy_api_key(),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(_) => Err(keyring_error("无法读取操作系统凭据管理器中的 API Key。")),
    }
}

fn load_legacy_api_key() -> Result<Option<String>, CommandError> {
    match Entry::new(SERVICE, LEGACY_ACCOUNT)
        .map_err(|_| keyring_error("操作系统凭据管理器当前不可用。"))?
        .get_password()
    {
        Ok(api_key) => Ok(Some(api_key)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(_) => Err(keyring_error("无法读取操作系统凭据管理器中的 API Key。")),
    }
}

fn save_named_api_key(account: &str, api_key: String) -> Result<(), CommandError> {
    let normalized = api_key.trim();
    if normalized.is_empty() || normalized.len() > 16_384 {
        return Err(CommandError::new("API Key 无效。", "INVALID_API_KEY"));
    }

    Entry::new(SERVICE, account)
        .map_err(|_| keyring_error("操作系统凭据管理器当前不可用。"))?
        .set_password(normalized)
        .map_err(|_| keyring_error("无法将 API Key 写入操作系统凭据管理器。"))
}

fn delete_named_api_key(account: &str) -> Result<(), CommandError> {
    let entry = Entry::new(SERVICE, account)
        .map_err(|_| keyring_error("操作系统凭据管理器当前不可用。"))?;
    match entry.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(_) => Err(keyring_error("无法从操作系统凭据管理器删除 API Key。")),
    }
}

fn keyring_error(message: &str) -> CommandError {
    CommandError::new(message, "KEYRING_ERROR")
}
