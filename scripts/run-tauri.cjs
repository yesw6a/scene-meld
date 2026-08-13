// Tauri / Cargo 桌面脚本的统一包装入口。
//
// 职责：
// 1. 工具链优先级修复——MSYS2/Cygwin 自带的 cargo 是 POSIX 路径层构建，tauri-cli
//    （Windows 原生）按 PATH spawn 到它时，cargo metadata 输出的 workspace_root
//    为 /cygdrive/... 格式，Windows API 无法读取（os error 3）。此处将 rustup 的
//    原生 MSVC cargo（~/.cargo/bin）前置到 PATH，确保命中正确工具链。
// 2. Rust 工具链守卫——需要编译的子命令（dev/build/run/--cargo-check）在 cargo
//    缺失时输出分平台安装指引并退出，避免裸报错。
// 3. 派发子进程：tauri 子命令经官方 CLI 的 run API 在当前进程执行（不依赖 PATH、
//    无 shell 包装），cargo 检查直接 spawn cargo.exe。
const { spawn, spawnSync } = require("node:child_process");
const { platform } = require("node:os");
const path = require("node:path");
const fs = require("node:fs");

const args = process.argv.slice(2);

// 1) 工具链优先级修复：仅 win32 生效。MSYS2/Cygwin 的 cargo（如 /usr/bin/cargo）
//    是 POSIX 路径层构建，其 current_dir() 返回 /cygdrive/...，tauri-cli spawn 到它
//    时 `cargo metadata` 输出的 workspace_root 为 POSIX 格式，解析 workspace 失败
//    （os error 3）。rustup 的 cargo（~/.cargo/bin/cargo.exe，MSVC 原生）若存在则
//    前置到 PATH，使 tauri-cli 优先命中原生工具链。node 的 process.env 写入同步
//    进程环境块，同进程 NAPI 的 tauri-cli 与后续 spawn 均能读到。
if (platform() === "win32") {
  const cargoBin = path.join(process.env.USERPROFILE || "", ".cargo", "bin");
  if (fs.existsSync(path.join(cargoBin, "cargo.exe"))) {
    process.env.PATH = `${cargoBin};${process.env.PATH}`;
  }
}

// 2) Rust 工具链守卫：仅对需要编译的子命令生效。
const CARGO_NEEDED = new Set(["dev", "build", "run", "--cargo-check"]);
const needsCargo = args.some((a) => CARGO_NEEDED.has(a));

if (needsCargo) {
  const probe = spawnSync("cargo", ["--version"], { stdio: "ignore" });
  if (probe.error || probe.status !== 0) {
    console.error("未检测到 Rust 工具链（cargo）。安装指引：");
    if (platform() === "win32") {
      console.error(
        "  Windows: 安装 rustup（winget install Rustlang.Rustup 或 https://rustup.rs），",
      );
      console.error(
        "           并安装 VS Build Tools（含 MSVC linker）与 WebView2 Runtime。",
      );
    } else if (platform() === "darwin") {
      console.error("  macOS:   运行 xcode-select --install。");
    } else {
      console.error(
        "  Linux:   按 https://rustup.rs 安装 rustup，并安装 WebKitGTK 4.1 等系统依赖（见 README）。",
      );
    }
    console.error("安装完成后请重启终端再试。");
    process.exit(1);
  }
}

// 3) 派发：cargo 检查直接执行 cargo.exe（原生可执行，无需 shell）。
if (args[0] === "--cargo-check") {
  const child = spawn("cargo", args.slice(1), { stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  // tauri 子命令经官方 CLI 的 run API 在当前进程内执行：
  // 成功时 resolve；失败时 CLI 自行打印错误并以非零码终止进程。
  const { run } = require("@tauri-apps/cli");
  run(args)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error && error.message ? error.message : error);
      process.exit(1);
    });
}
