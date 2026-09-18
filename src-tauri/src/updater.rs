use serde::Serialize;
use std::time::{Duration, Instant};
use tauri::{ipc::Channel, AppHandle, State};
use tauri_plugin_updater::{Error, Update, UpdaterExt};
use tokio::sync::Mutex;
use url::Url;
use crate::network::NetworkState;

const ENDPOINT: &str = "https://github.com/yesw6a/scene-meld/releases/latest/download/latest.json";
const PROXY: &str = "https://gh-proxy.com/";

#[derive(Default)]
pub struct UpdateState(Mutex<Option<PendingUpdate>>);

struct PendingUpdate {
    update: Update,
    source: Source,
}

#[derive(Clone, Copy, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Source {
    Github,
    Proxy,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEvent {
    phase: &'static str,
    source: Source,
    retrying: bool,
    downloaded: u64,
    total: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckResult {
    current_version: String,
    version: Option<String>,
    body: Option<String>,
    source: Source,
}

fn emit(channel: &Channel<UpdateEvent>, phase: &'static str, source: Source, retrying: bool) {
    let _ = channel.send(UpdateEvent {
        phase,
        source,
        retrying,
        downloaded: 0,
        total: None,
    });
}

fn network_error(error: &Error) -> bool {
    matches!(
        error,
        Error::Reqwest(_) | Error::Network(_) | Error::ReleaseNotFound
    )
}

fn validate_asset(url: &Url, version: &str) -> Result<(), String> {
    let prefix = format!("/yesw6a/scene-meld/releases/download/v{version}/");
    let release_asset = url.host_str() == Some("github.com")
        && url.path().starts_with(&prefix)
        && url.path().len() > prefix.len();
    let api_asset = url.host_str() == Some("api.github.com")
        && url
            .path()
            .strip_prefix("/repos/yesw6a/scene-meld/releases/assets/")
            .is_some_and(|id| !id.is_empty() && id.bytes().all(|b| b.is_ascii_digit()));
    if url.scheme() != "https"
        || !(release_asset || api_asset)
        || url.port().is_some()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("更新包地址与本项目发布版本不符，已停止更新。".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_release_and_api_assets_from_this_repository() {
        for address in [
            "https://github.com/yesw6a/scene-meld/releases/download/v1.11.0/app.msi",
            "https://api.github.com/repos/yesw6a/scene-meld/releases/assets/569153313",
        ] {
            assert!(validate_asset(&Url::parse(address).unwrap(), "1.11.0").is_ok());
        }
    }

    #[test]
    fn rejects_unrelated_or_mismatched_assets() {
        for address in [
            "http://github.com/yesw6a/scene-meld/releases/download/v1.11.0/app.msi",
            "https://github.com/yesw6a/scene-meld/releases/download/v1.10.1/app.msi",
            "https://github.com/other/repo/releases/download/v1.11.0/app.msi",
            "https://api.github.com/repos/yesw6a/scene-meld/releases/assets/123/other",
            "https://api.github.com/repos/yesw6a/scene-meld/releases/assets/",
            "https://api.github.com/repos/yesw6a/scene-meld/releases/assets/123?redirect=evil",
            "https://api.github.com.evil.test/repos/yesw6a/scene-meld/releases/assets/123",
        ] {
            assert!(validate_asset(&Url::parse(address).unwrap(), "1.11.0").is_err());
        }
    }

    #[test]
    fn only_network_failures_allow_fallback() {
        assert!(network_error(&Error::Network("timeout".into())));
        assert!(network_error(&Error::ReleaseNotFound));
        assert!(!network_error(&Error::SignatureUtf8(
            "bad signature".into()
        )));
        assert!(!network_error(&Error::InvalidUpdaterFormat));
        assert!(!network_error(&Error::PackageInstallFailed));
        assert!(!network_error(&Error::TargetNotFound("windows".into())));
    }
}

#[tauri::command]
pub async fn check_desktop_update(
    app: AppHandle,
    state: State<'_, UpdateState>,
    network: State<'_, NetworkState>,
    on_event: Channel<UpdateEvent>,
) -> Result<CheckResult, String> {
    let proxy = network.snapshot().map_err(|error| error.message)?;
    let mut pending = state
        .0
        .try_lock()
        .map_err(|_| "更新操作正在进行，请稍后重试。")?;
    *pending = None;
    let mut failures = Vec::new();
    for source in [Source::Github, Source::Proxy] {
        emit(&on_event, "checking", source, source == Source::Proxy);
        let endpoint = if source == Source::Proxy {
            format!("{PROXY}{ENDPOINT}")
        } else {
            ENDPOINT.into()
        };
        let updater = proxy.updater_builder(app.updater_builder())
            .map_err(|error| error.message)?
            .endpoints(vec![Url::parse(&endpoint).map_err(|e| e.to_string())?])
            .map_err(|e| e.to_string())?
            .timeout(Duration::from_secs(10))
            .build()
            .map_err(|e| e.to_string())?;
        match updater.check().await {
            Ok(update) => {
                let result = CheckResult {
                    current_version: app.package_info().version.to_string(),
                    version: update.as_ref().map(|u| u.version.clone()),
                    body: update.as_ref().and_then(|u| u.body.clone()),
                    source,
                };
                if let Some(update) = update {
                    validate_asset(&update.download_url, &update.version)?;
                    *pending = Some(PendingUpdate { update, source });
                }
                return Ok(result);
            }
            Err(error) if network_error(&error) => failures.push(error.to_string()),
            Err(error) => return Err(format!("更新清单校验失败：{error}")),
        }
    }
    Err(format!(
        "GitHub 和 gh-proxy 均无法检查更新，请检查网络与代理设置后重试。{}",
        failures.join("；")
    ))
}

async fn download(
    update: &Update,
    source: Source,
    retrying: bool,
    channel: &Channel<UpdateEvent>,
) -> Result<Vec<u8>, Error> {
    emit(channel, "downloading", source, retrying);
    let mut downloaded = 0u64;
    let mut last_sent = Instant::now();
    update
        .download(
            |chunk, total| {
                downloaded += chunk as u64;
                if last_sent.elapsed() >= Duration::from_millis(150) || total == Some(downloaded) {
                    let _ = channel.send(UpdateEvent {
                        phase: "downloading",
                        source,
                        retrying,
                        downloaded,
                        total: total.filter(|value| *value > 0),
                    });
                    last_sent = Instant::now();
                }
            },
            || emit(channel, "verifying", source, retrying),
        )
        .await
}

#[tauri::command]
pub async fn install_desktop_update(
    state: State<'_, UpdateState>,
    network: State<'_, NetworkState>,
    on_event: Channel<UpdateEvent>,
) -> Result<(), String> {
    let proxy = network.snapshot().map_err(|error| error.message)?;
    let mut pending = state
        .0
        .try_lock()
        .map_err(|_| "更新操作正在进行，请稍后重试。")?;
    let selected = pending.take().ok_or("请先检查并确认可用更新。")?;
    let mut update = selected.update;
    proxy.apply_to_update(&mut update).map_err(|error| error.message)?;
    validate_asset(&update.download_url, &update.version)?;
    let direct_url = update.download_url.clone();
    let mut source = selected.source;
    update.timeout = Some(Duration::from_secs(300));
    if source == Source::Proxy {
        update.download_url =
            Url::parse(&format!("{PROXY}{direct_url}")).map_err(|e| e.to_string())?;
    }
    let first = download(&update, source, false, &on_event).await;
    let bytes = match first {
        Ok(bytes) => bytes,
        Err(error) if source == Source::Github && network_error(&error) => {
            source = Source::Proxy;
            update.download_url =
                Url::parse(&format!("{PROXY}{direct_url}")).map_err(|e| e.to_string())?;
            download(&update, source, true, &on_event)
                .await
                .map_err(|e| format!("加速源下载失败：{e}"))?
        }
        Err(error) => return Err(format!("更新下载或签名校验失败，已停止更新：{error}")),
    };
    emit(&on_event, "installing", source, false);
    tauri::async_runtime::spawn_blocking(move || update.install(bytes))
        .await
        .map_err(|e| format!("更新安装任务失败：{e}"))?
        .map_err(|e| format!("更新安装失败：{e}"))
}
