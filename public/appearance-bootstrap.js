(() => {
  let mode = "system";
  try {
    const stored = JSON.parse(
      localStorage.getItem("scenemeld.appearance.v1") ||
        localStorage.getItem("gpt-image-2-studio.appearance.v1") ||
        "null",
    );
    if (
      stored?.version === 1 &&
      ["system", "light", "dark"].includes(stored.mode)
    ) {
      mode = stored.mode;
    }
  } catch {}

  const resolved =
    mode === "system"
      ? matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : mode;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", resolved === "dark" ? "#0B1110" : "#F4F7F6");
})();
