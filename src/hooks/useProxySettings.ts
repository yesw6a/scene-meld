import { useEffect, useState } from "react";
import {
  DEFAULT_PROXY_SETTINGS,
  loadProxySettings,
  proxyErrorMessage,
  saveProxySettings,
  type ProxySettings,
} from "../lib/network-proxy";

export function useProxySettings(active: boolean) {
  const [draft, setDraft] = useState(DEFAULT_PROXY_SETTINGS);
  const [saved, setSaved] = useState<ProxySettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [touched, setTouched] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!active) return;
    let disposed = false;
    setLoading(true);
    setError(undefined);
    setTouched(false);
    setSaved(null);
    setDraft(DEFAULT_PROXY_SETTINGS);
    void loadProxySettings().then((settings) => {
      if (!disposed) {
        setSaved(settings);
        setDraft(settings);
      }
    }).catch((reason: unknown) => {
      if (!disposed) setError(proxyErrorMessage(reason));
    }).finally(() => {
      if (!disposed) setLoading(false);
    });
    return () => { disposed = true; };
  }, [active, revision]);

  const dirty = active && touched && (saved === null || draft.mode !== saved.mode || draft.url !== saved.url);

  return {
    draft, loading: active && loading, error: active ? error : undefined, dirty,
    retry: () => setRevision((value) => value + 1),
    update: (value: ProxySettings) => {
      setDraft(value);
      setTouched(true);
      setError(undefined);
    },
    save: async () => {
      try {
        // 非手动模式不提交未完成的地址草稿。
        const settings = await saveProxySettings(draft.mode === "manual" ? draft : { ...draft, url: saved?.url ?? "" });
        setSaved(settings);
        setDraft(settings);
        setTouched(false);
        setError(undefined);
      } catch (reason) {
        const message = proxyErrorMessage(reason);
        setError(message);
        throw new Error(message);
      }
    },
  };
}
