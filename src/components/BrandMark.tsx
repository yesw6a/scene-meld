import * as stylex from "@stylexjs/stylex";

interface BrandMarkProps {
  size?: number;
  title?: string;
}

export default function BrandMark({
  size = 24,
  title,
}: BrandMarkProps) {
  const labelled = Boolean(title);

  return (
    <img
      src="/app-icon.png"
      width={size}
      height={size}
      alt={title ?? ""}
      aria-hidden={labelled ? undefined : true}
      decoding="async"
      draggable={false}
      {...stylex.props(styles.image)}
    />
  );
}

const styles = stylex.create({
  image: {
    display: "block",
    objectFit: "contain",
    userSelect: "none",
  },
});
