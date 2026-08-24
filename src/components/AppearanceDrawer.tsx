import type { ReactNode } from "react";
import * as stylex from "@stylexjs/stylex";
import { Drawer, Segmented, Typography } from "antd";
import { Monitor, Moon, Palette, Sun } from "lucide-react";

import { colors, radii } from "../styles/tokens.stylex";
import { useAppearance, type AppearanceMode } from "../theme/AppearanceProvider";

interface AppearanceDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function AppearanceDrawer({ open, onClose }: AppearanceDrawerProps) {
  const { mode, resolvedMode, setMode } = useAppearance();

  return (
    <Drawer
      title={
        <span {...stylex.props(styles.title)}>
          <Palette aria-hidden="true" size={19} strokeWidth={1.8} />
          外观
        </span>
      }
      width="min(360px, 100vw)"
      open={open}
      rootClassName="studio-glass-drawer"
      onClose={onClose}
    >
      <section {...stylex.props(styles.section)} aria-labelledby="appearance-heading">
        <div {...stylex.props(styles.heading)}>
          <Typography.Title id="appearance-heading" level={5}>
            界面主题
          </Typography.Title>
          <Typography.Paragraph type="secondary" {...stylex.props(styles.copy)}>
            当前显示为{resolvedMode === "dark" ? "深色" : "浅色"}。选择会立即生效，并尝试保存在当前设备。
          </Typography.Paragraph>
        </div>
        <Segmented<AppearanceMode>
          block
          aria-label="选择界面外观"
          value={mode}
          options={APPEARANCE_OPTIONS}
          className={`studio-appearance-segmented ${
            stylex.props(styles.control).className ?? ""
          }`}
          onChange={setMode}
        />
      </section>
    </Drawer>
  );
}

const APPEARANCE_OPTIONS = [
  { label: "自动", value: "system", icon: <Monitor size={16} aria-hidden="true" /> },
  { label: "浅色", value: "light", icon: <Sun size={16} aria-hidden="true" /> },
  { label: "深色", value: "dark", icon: <Moon size={16} aria-hidden="true" /> },
] satisfies { label: string; value: AppearanceMode; icon: ReactNode }[];

const styles = stylex.create({
  title: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  heading: {
    display: "flex",
    flexDirection: "column",
  },
  copy: {
    marginTop: "-4px",
    marginBottom: 0,
    lineHeight: 1.65,
  },
  control: {
    padding: "4px",
    backgroundColor: colors.glassSubtle,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.glassBorder,
    borderRadius: radii.medium,
  },
});
