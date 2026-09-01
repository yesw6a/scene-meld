import * as stylex from "@stylexjs/stylex";
import { Select } from "antd";
import { AlertCircle, Info } from "lucide-react";

import {
  resolveGenerationSubmission,
  type ResolvedGenerationSubmission,
} from "../lib/generation-plan";
import {
  IMAGE_SIZE_OPTIONS,
  imageSizeLabel,
  type ImageSizeOption,
} from "../lib/image-sizes";
import type {
  GenerationMode,
  GenerationSettings,
  ImageQuality,
  ImageRequestSize,
  ImageSize,
  PromptDirectiveResult,
} from "../types";
import { colors } from "../styles/tokens.stylex";

interface GenerationControlsProps {
  settings: GenerationSettings;
  directives: PromptDirectiveResult;
  disabled: boolean;
  characterCount: string;
  onChange: (patch: Partial<GenerationSettings>) => void;
}

export default function GenerationControls({
  settings,
  directives,
  disabled,
  characterCount,
  onChange,
}: GenerationControlsProps) {
  const resolved = resolveGenerationSubmission(settings, directives);
  const modeError = directives.errorsByKey.mode;
  const sizeError = directives.errorsByKey.size;
  const qualityError = directives.errorsByKey.quality;
  const quantityError = directives.errorsByKey.quantity;

  return (
    <div {...stylex.props(styles.root)}>
      <div data-generation-toolbar="" {...stylex.props(styles.toolbar)}>
        <fieldset {...stylex.props(styles.modeFieldset)}>
          <legend {...stylex.props(styles.visuallyHidden)}>生成方式</legend>
          <Select<GenerationMode>
            value={settings.mode}
            disabled={disabled}
            options={MODE_OPTIONS}
            aria-label="生成方式"
            labelRender={() => (
              <CompactSelectValue label="模式" value={modeValueLabel(settings.mode)} />
            )}
            popupMatchSelectWidth={180}
            virtual={false}
            placement="topLeft"
            className="studio-generation-select studio-generation-mode-select"
            classNames={{
              popup: {
                root: "studio-select-popup studio-mode-select-popup",
                listItem: "studio-select-option",
              },
            }}
            onChange={(mode) =>
              onChange({
                mode,
                ...(mode === "batch" && settings.quantity < 2 ? { quantity: 2 } : {}),
              })
            }
          />
          {modeError ? <InlineError message={modeError} /> : null}
        </fieldset>

        <div
          data-generation-fields=""
          {...stylex.props(
            styles.fields,
            settings.mode === "single" ? styles.fieldsTwo : styles.fieldsThree,
          )}
        >
          <label {...stylex.props(styles.field)}>
            <span {...stylex.props(styles.visuallyHidden)}>画面比例</span>
            <Select<ImageSize>
              value={settings.size}
              aria-label="画面比例"
              disabled={disabled}
              options={IMAGE_SIZE_OPTIONS_FOR_SELECT}
              labelRender={() => (
                <CompactSelectValue label="比例" value={configuredSizeLabel(settings.size)} />
              )}
              optionRender={(option) => {
                const sizeOption = option.data as ImageSizeOption;
                return (
                  <span {...stylex.props(styles.option)}>
                    <strong>{`${sizeOption.label} · ${sizeOption.ratio}`}</strong>
                    <small>{sizeOption.dimensions}</small>
                  </span>
                );
              }}
              popupMatchSelectWidth={260}
              placement="topLeft"
              className="studio-generation-select studio-generation-ratio-select"
              classNames={{
                popup: {
                  root: "studio-select-popup studio-ratio-select-popup",
                  listItem: "studio-select-option",
                },
              }}
              onChange={(size) => onChange({ size })}
            />
            {sizeError ? <InlineError message={sizeError} /> : null}
          </label>

          <label {...stylex.props(styles.field)}>
            <span {...stylex.props(styles.visuallyHidden)}>图片质量</span>
            <Select<ImageQuality>
              value={settings.quality}
              aria-label="图片质量"
              disabled={disabled}
              options={QUALITY_OPTIONS}
              labelRender={() => (
                <CompactSelectValue label="质量" value={qualityValueLabel(settings.quality)} />
              )}
              popupMatchSelectWidth={180}
              placement="topLeft"
              className="studio-generation-select"
              classNames={{
                popup: {
                  root: "studio-select-popup studio-quality-select-popup",
                  listItem: "studio-select-option",
                },
              }}
              onChange={(quality) => onChange({ quality })}
            />
            {qualityError ? <InlineError message={qualityError} /> : null}
          </label>

          {settings.mode === "batch" ? (
            <label {...stylex.props(styles.field)}>
              <span {...stylex.props(styles.visuallyHidden)}>生成数量</span>
              <Select<number>
                value={Math.max(2, settings.quantity)}
                aria-label="多图数量"
                disabled={disabled}
                options={BATCH_QUANTITY_OPTIONS}
                labelRender={({ value }) => (
                  <CompactSelectValue label="数量" value={`${value} 张`} />
                )}
                virtual={false}
                placement="topLeft"
                className="studio-generation-select studio-generation-count-select"
                classNames={{
                  popup: {
                    root: "studio-select-popup studio-quantity-select-popup",
                    listItem: "studio-select-option",
                  },
                }}
                onChange={(quantity) => onChange({ quantity })}
              />
              {quantityError ? <InlineError message={quantityError} /> : null}
            </label>
          ) : null}

          {settings.mode === "storyboard" ? (
            <label {...stylex.props(styles.field)}>
              <span {...stylex.props(styles.visuallyHidden)}>分镜数量</span>
              <Select<number>
                value={settings.storyboardQuantity === "auto" ? 0 : settings.storyboardQuantity}
                aria-label="分镜数量"
                disabled={disabled}
                options={STORYBOARD_QUANTITY_OPTIONS}
                labelRender={({ value }) => (
                  <CompactSelectValue
                    label="分镜"
                    value={value === 0 ? "自动" : `${value} 镜头`}
                  />
                )}
                virtual={false}
                placement="topLeft"
                className="studio-generation-select studio-generation-count-select"
                classNames={{
                  popup: {
                    root: "studio-select-popup studio-quantity-select-popup",
                    listItem: "studio-select-option",
                  },
                }}
                onChange={(quantity) =>
                  onChange({ storyboardQuantity: quantity === 0 ? "auto" : quantity })
                }
              />
              {quantityError ? <InlineError message={quantityError} /> : null}
            </label>
          ) : null}
        </div>
      </div>

      <div {...stylex.props(styles.statusRow)}>
        <div
          {...stylex.props(styles.summary)}
          aria-live="polite"
          aria-label={`本次操作：${resolved.summary}${resolved.overrideSummary ?? ""}`}
          title={resolved.summary}
        >
          <Info size={14} aria-hidden="true" {...stylex.props(styles.summaryIcon)} />
          <span {...stylex.props(styles.summaryContent)}>
            <span data-generation-summary-main="">{compactSubmissionSummary(resolved)}</span>
            {resolved.overrideSummary ? (
              <small
                data-generation-override-summary=""
                title={resolved.overrideSummary}
                {...stylex.props(styles.override)}
              >
                {resolved.overrideSummary}
              </small>
            ) : null}
          </span>
        </div>
        <span {...stylex.props(styles.characterCount)}>{characterCount}</span>
      </div>
    </div>
  );
}

function CompactSelectValue({ label, value }: { label: string; value: string }) {
  return (
    <span className="studio-generation-select-value">
      <span className="studio-generation-select-key">{label}</span>
      <span className="studio-generation-select-separator" aria-hidden="true">
        ·
      </span>
      <strong className="studio-generation-select-current">{value}</strong>
    </span>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <span {...stylex.props(styles.error)} role="alert">
      <AlertCircle size={14} aria-hidden="true" />
      {message}
    </span>
  );
}

const MODE_OPTIONS = [
  { label: "单图", value: "single" },
  { label: "多图", value: "batch" },
  { label: "分镜", value: "storyboard" },
] satisfies { label: string; value: GenerationMode }[];

const IMAGE_SIZE_OPTIONS_FOR_SELECT = IMAGE_SIZE_OPTIONS.map((option) => ({ ...option }));

const QUALITY_OPTIONS = [
  { label: "自动", value: "auto" },
  { label: "低", value: "low" },
  { label: "中", value: "medium" },
  { label: "高", value: "high" },
] satisfies { label: string; value: ImageQuality }[];

const BATCH_QUANTITY_OPTIONS = Array.from({ length: 8 }, (_, index) => ({
  label: `${index + 2} 张`,
  value: index + 2,
}));

const STORYBOARD_QUANTITY_OPTIONS = [
  { label: "自动（推荐）", value: 0 },
  ...[3, 4, 6, 9].map((value) => ({ label: `${value} 个镜头`, value })),
];

function configuredSizeLabel(size: ImageSize): string {
  const option = IMAGE_SIZE_OPTIONS.find((item) => item.value === size);
  return option?.value === "auto" ? "自动" : (option?.ratio ?? imageSizeLabel(size));
}

function modeValueLabel(mode: GenerationMode): string {
  return {
    single: "单图",
    batch: "多图",
    storyboard: "分镜",
  }[mode];
}

function requestSizeLabel(size: ImageRequestSize): string {
  const option = IMAGE_SIZE_OPTIONS.find((item) => item.value === size);
  if (option) return option.value === "auto" ? "自动比例" : option.ratio;
  return imageSizeLabel(size);
}

function qualityValueLabel(quality: ImageQuality): string {
  return {
    auto: "自动",
    low: "低",
    medium: "中",
    high: "高",
  }[quality];
}

function compactSubmissionSummary(resolved: ResolvedGenerationSubmission): string {
  const specification = `${requestSizeLabel(resolved.settings.size)} · ${qualityValueLabel(resolved.settings.quality)} · PNG`;
  if (resolved.plan.mode === "storyboard") {
    const planning =
      resolved.plan.shotCount === "auto"
        ? "先自动规划分镜"
        : `先规划 ${resolved.plan.shotCount} 个分镜`;
    return `${planning}，确认后按 ${specification} 生成`;
  }
  if (resolved.plan.mode === "batch") {
    return `生成 ${resolved.plan.count} 张独立图片 · ${specification}`;
  }
  return `生成 1 张图片 · ${specification}`;
}

const styles = stylex.create({
  root: {
    minWidth: 0,
    width: "100%",
    display: "grid",
    gap: "6px",
  },
  toolbar: {
    minWidth: 0,
    display: "grid",
    gridTemplateColumns: "minmax(150px, 0.55fr) minmax(340px, 1.45fr)",
    alignItems: "start",
    gap: "clamp(6px, 1vw, 10px)",
    "@media (max-width: 767px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  modeFieldset: {
    minWidth: 0,
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    margin: 0,
    padding: 0,
    borderWidth: 0,
  },
  fields: {
    minWidth: 0,
    display: "grid",
    alignItems: "start",
    gap: "clamp(4px, 0.8vw, 8px)",
  },
  fieldsTwo: {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  },
  fieldsThree: {
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  },
  field: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    color: colors.muted,
    fontSize: "12px",
  },
  visuallyHidden: {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: 0,
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    borderWidth: 0,
  },
  option: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    lineHeight: 1.3,
  },
  statusRow: {
    minWidth: 0,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "end",
    gap: "8px",
  },
  summary: {
    minWidth: 0,
    display: "flex",
    alignItems: "flex-start",
    gap: "6px",
    padding: "1px 2px",
    color: colors.body,
    fontSize: "clamp(11px, 1.2vw, 12px)",
    lineHeight: 1.4,
  },
  summaryIcon: {
    flexShrink: 0,
    marginTop: "1px",
    color: colors.muted,
  },
  summaryContent: {
    minWidth: 0,
    overflow: "hidden",
  },
  override: {
    display: "block",
    minWidth: 0,
    marginTop: "1px",
    color: colors.primary,
    fontSize: "11px",
    lineHeight: 1.35,
  },
  characterCount: {
    flexShrink: 0,
    paddingBottom: "1px",
    whiteSpace: "nowrap",
    color: colors.subtle,
    fontSize: "11px",
    fontVariantNumeric: "tabular-nums",
  },
  error: {
    display: "inline-flex",
    alignItems: "flex-start",
    gap: "5px",
    maxWidth: "360px",
    color: colors.danger,
    fontSize: "11px",
    lineHeight: 1.45,
  },
});
