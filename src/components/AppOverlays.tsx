import AboutDialog from "./AboutDialog";
import AppearanceDrawer from "./AppearanceDrawer";
import SettingsDrawer from "./SettingsDrawer";
import type { DesktopUpdateSnapshot } from "../hooks/useDesktopUpdater";
import type { GenerationSettings } from "../types";

export type SettingsPanel =
  | "connection"
  | "workspace"
  | "data"
  | "appearance"
  | "about"
  | null;

interface AppOverlaysProps {
  settingsPanel: SettingsPanel;
  settings: GenerationSettings;
  conversationCount: number;
  generationCount: number;
  storageAvailable: boolean;
  historyClearing: boolean;
  desktopUpdateSnapshot: DesktopUpdateSnapshot;
  updateBusy: boolean;
  onCloseSettings: () => void;
  onSaveSettings: (settings: GenerationSettings) => void | Promise<void>;
  onResetSettings: () => void | Promise<void>;
  onClearHistory: () => void | Promise<void>;
  onCheckForUpdates: () => void | Promise<void>;
  onInstallUpdate: () => void | Promise<void>;
}

export default function AppOverlays({
  settingsPanel,
  settings,
  conversationCount,
  generationCount,
  storageAvailable,
  historyClearing,
  desktopUpdateSnapshot,
  updateBusy,
  onCloseSettings,
  onSaveSettings,
  onResetSettings,
  onClearHistory,
  onCheckForUpdates,
  onInstallUpdate,
}: AppOverlaysProps) {
  return (
    <>
      <SettingsDrawer
        open={
          settingsPanel === "connection" ||
          settingsPanel === "workspace" ||
          settingsPanel === "data"
        }
        section={
          settingsPanel === "workspace"
            ? "workspace"
            : settingsPanel === "data"
              ? "data"
              : "connection"
        }
        settings={settings}
        conversationCount={conversationCount}
        generationCount={generationCount}
        storageAvailable={storageAvailable}
        historyClearing={historyClearing}
        onClose={onCloseSettings}
        onSave={onSaveSettings}
        onReset={onResetSettings}
        onClearHistory={onClearHistory}
      />

      <AppearanceDrawer
        open={settingsPanel === "appearance"}
        onClose={onCloseSettings}
      />

      <AboutDialog
        open={settingsPanel === "about"}
        onClose={onCloseSettings}
        desktopUpdateSnapshot={desktopUpdateSnapshot}
        updateBusy={updateBusy}
        onCheckForUpdates={onCheckForUpdates}
        onInstallUpdate={onInstallUpdate}
      />

    </>
  );
}
