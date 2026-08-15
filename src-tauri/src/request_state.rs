use std::{collections::HashMap, sync::Mutex};

use tokio::sync::oneshot;

use crate::types::CommandError;

#[derive(Default)]
pub struct RequestState {
    pending: Mutex<HashMap<String, oneshot::Sender<()>>>,
}

impl RequestState {
    pub fn begin(&self, request_id: &str) -> Result<oneshot::Receiver<()>, CommandError> {
        if request_id.trim().is_empty() || request_id.len() > 128 {
            return Err(CommandError::new("请求标识无效。", "INVALID_REQUEST_ID"));
        }

        let (sender, receiver) = oneshot::channel();
        let mut pending = self.lock()?;
        if pending.contains_key(request_id) {
            return Err(CommandError::new(
                "同一请求标识正在使用中。",
                "DUPLICATE_REQUEST_ID",
            ));
        }
        pending.insert(request_id.to_owned(), sender);
        Ok(receiver)
    }

    pub fn finish(&self, request_id: &str) -> Result<(), CommandError> {
        self.lock()?.remove(request_id);
        Ok(())
    }

    pub fn cancel(&self, request_id: &str) -> Result<bool, CommandError> {
        let sender = self.lock()?.remove(request_id);
        Ok(sender.map(|sender| sender.send(()).is_ok()).unwrap_or(false))
    }

    fn lock(
        &self,
    ) -> Result<std::sync::MutexGuard<'_, HashMap<String, oneshot::Sender<()>>>, CommandError>
    {
        self.pending.lock().map_err(|_| {
            CommandError::new("请求状态暂时不可用。", "REQUEST_STATE_UNAVAILABLE")
        })
    }
}
