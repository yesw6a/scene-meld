use std::{fs, io::Write, path::PathBuf, sync::Mutex};

use serde::{Deserialize, Serialize};
use tauri::State;
use url::Url;

use crate::types::CommandError;

#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ProxyMode {
    #[default]
    System,
    None,
    Manual,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProxySettings {
    pub mode: ProxyMode,
    #[serde(default)]
    pub url: String,
}

impl ProxySettings {
    pub fn validate(mut self) -> Result<Self, CommandError> {
        self.url = self.url.trim().to_owned();
        if self.url.is_empty() && self.mode != ProxyMode::Manual {
            return Ok(self);
        }
        let invalid = || {
            CommandError::new(
            "请输入有效的代理地址，例如 http://127.0.0.1:7890；支持 HTTP、HTTPS、SOCKS5 和 SOCKS5H。",
            "INVALID_PROXY_URL",
        )
        };
        if self.url.len() > 2048
            || self.url.chars().any(char::is_whitespace)
            || self.url.contains('\\')
        {
            return Err(invalid());
        }
        let url = Url::parse(&self.url).map_err(|_| invalid())?;
        if !matches!(url.scheme(), "http" | "https" | "socks5" | "socks5h")
            || url.host_str().is_none()
            || url.port() == Some(0)
            || (matches!(url.scheme(), "socks5" | "socks5h") && url.port().is_none())
        {
            return Err(invalid());
        }
        if !url.username().is_empty() || url.password().is_some() {
            return Err(CommandError::new(
                "暂不支持需要用户名或密码的手动代理，请勿在地址中填写凭据。",
                "PROXY_AUTH_UNSUPPORTED",
            ));
        }
        if !matches!(url.path(), "" | "/") || url.query().is_some() || url.fragment().is_some() {
            return Err(CommandError::new(
                "代理地址只能包含协议、主机和端口，不能包含路径、查询参数或片段。",
                "INVALID_PROXY_URL",
            ));
        }
        self.url = url.to_string();
        Ok(self)
    }

    pub fn client_builder(&self) -> Result<reqwest::ClientBuilder, CommandError> {
        let builder = reqwest::Client::builder();
        match self.mode {
            ProxyMode::System => Ok(builder),
            ProxyMode::None => Ok(builder.no_proxy()),
            ProxyMode::Manual => {
                let proxy = reqwest::Proxy::all(&self.url)
                    .map_err(|_| CommandError::new("无法初始化手动代理。", "INVALID_PROXY_URL"))?;
                Ok(builder.no_proxy().proxy(proxy))
            }
        }
    }

    pub fn updater_builder(
        &self,
        builder: tauri_plugin_updater::UpdaterBuilder,
    ) -> Result<tauri_plugin_updater::UpdaterBuilder, CommandError> {
        // 更新插件使用 reqwest 0.13，单独启用其系统代理和 SOCKS 功能。
        match self.mode {
            ProxyMode::System => Ok(builder),
            ProxyMode::None => Ok(builder.no_proxy()),
            ProxyMode::Manual => Ok(builder
                .proxy(Url::parse(&self.url).map_err(|_| {
                    CommandError::new("无法初始化更新代理。", "INVALID_PROXY_URL")
                })?)),
        }
    }

    pub fn apply_to_update(
        &self,
        update: &mut tauri_plugin_updater::Update,
    ) -> Result<(), CommandError> {
        update.no_proxy = self.mode == ProxyMode::None;
        update.proxy = if self.mode == ProxyMode::Manual {
            Some(
                Url::parse(&self.url)
                    .map_err(|_| CommandError::new("无法初始化更新代理。", "INVALID_PROXY_URL"))?,
            )
        } else {
            None
        };
        Ok(())
    }
}

pub struct NetworkState {
    path: PathBuf,
    settings: Mutex<Result<ProxySettings, CommandError>>,
}

impl NetworkState {
    pub fn load(path: PathBuf) -> Self {
        let settings = match fs::read(&path) {
            Ok(bytes) => serde_json::from_slice::<ProxySettings>(&bytes)
                .map_err(|_| {
                    CommandError::new(
                        "代理设置文件无效，请重新保存代理设置。",
                        "PROXY_SETTINGS_INVALID",
                    )
                })
                .and_then(ProxySettings::validate),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                Ok(ProxySettings::default())
            }
            Err(_) => Err(CommandError::new(
                "无法读取代理设置，请检查应用配置目录权限。",
                "PROXY_SETTINGS_READ_ERROR",
            )),
        };
        Self {
            path,
            settings: Mutex::new(settings),
        }
    }

    pub fn snapshot(&self) -> Result<ProxySettings, CommandError> {
        self.settings.lock().map_err(|_| state_error())?.clone()
    }

    fn save(&self, settings: ProxySettings) -> Result<ProxySettings, CommandError> {
        let settings = settings.validate()?;
        let mut current = self.settings.lock().map_err(|_| state_error())?;
        let save_error = || {
            CommandError::new(
                "无法保存代理设置，原设置仍然生效。请检查应用配置目录权限。",
                "PROXY_SETTINGS_WRITE_ERROR",
            )
        };
        let parent = self.path.parent().ok_or_else(save_error)?;
        fs::create_dir_all(parent).map_err(|_| save_error())?;
        let bytes = serde_json::to_vec_pretty(&settings).map_err(|_| save_error())?;
        // 同目录原子替换，写入失败时保留旧文件与当前生效配置。
        let mut file = tempfile::NamedTempFile::new_in(parent).map_err(|_| save_error())?;
        file.write_all(&bytes).map_err(|_| save_error())?;
        file.as_file().sync_all().map_err(|_| save_error())?;
        file.persist(&self.path).map_err(|_| save_error())?;
        *current = Ok(settings.clone());
        Ok(settings)
    }
}

fn state_error() -> CommandError {
    CommandError::new("代理设置暂时不可用，请重启应用。", "PROXY_STATE_ERROR")
}

#[tauri::command]
pub fn load_proxy_settings(state: State<'_, NetworkState>) -> Result<ProxySettings, CommandError> {
    state.snapshot()
}

#[tauri::command]
pub fn save_proxy_settings(
    settings: ProxySettings,
    state: State<'_, NetworkState>,
) -> Result<ProxySettings, CommandError> {
    state.save(settings)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_proxy_endpoints_without_accepting_credentials_or_api_paths() {
        for url in [
            "http://127.0.0.1:7890",
            "https://proxy.example:443",
            "socks5://[::1]:1080",
            "socks5h://localhost:1080",
        ] {
            assert!(ProxySettings {
                mode: ProxyMode::Manual,
                url: url.into()
            }
            .validate()
            .is_ok());
        }
        for url in [
            "",
            "127.0.0.1:7890",
            "ftp://localhost:21",
            "http://localhost:0",
            "socks5://localhost",
            "http://user:secret@localhost:7890",
            "http://localhost:7890/v1",
            "http://localhost:7890?key=secret",
            "http://localhost:7890#fragment",
            "http://local host:7890",
        ] {
            assert!(
                ProxySettings {
                    mode: ProxyMode::Manual,
                    url: url.into()
                }
                .validate()
                .is_err(),
                "{url}"
            );
        }
    }

    #[test]
    fn persists_settings_and_keeps_in_flight_snapshots_unchanged() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("proxy.json");
        let state = NetworkState::load(path.clone());
        let snapshot = state.snapshot().unwrap();
        let manual = ProxySettings {
            mode: ProxyMode::Manual,
            url: "http://127.0.0.1:7890".into(),
        };
        let saved = state.save(manual).unwrap();
        assert_eq!(snapshot.mode, ProxyMode::System);
        assert_eq!(NetworkState::load(path).snapshot().unwrap(), saved);
        assert!(state
            .save(ProxySettings {
                mode: ProxyMode::Manual,
                url: "bad".into()
            })
            .is_err());
        assert_eq!(state.snapshot().unwrap(), saved);
    }

    #[test]
    fn corrupted_settings_do_not_silently_enable_direct_connections() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("proxy.json");
        fs::write(&path, "invalid").unwrap();
        let state = NetworkState::load(path);
        assert!(state.snapshot().is_err());
        state.save(ProxySettings::default()).unwrap();
        assert_eq!(state.snapshot().unwrap().mode, ProxyMode::System);
    }

    #[test]
    fn failed_persistence_preserves_the_active_configuration() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("proxy.json");
        let state = NetworkState::load(path.clone());
        // 用同名目录模拟无法原子替换配置文件的情况。
        fs::create_dir(&path).unwrap();
        assert!(state
            .save(ProxySettings {
                mode: ProxyMode::None,
                url: String::new()
            })
            .is_err());
        assert_eq!(state.snapshot().unwrap(), ProxySettings::default());
        assert!(path.is_dir());
    }
}
