use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSession {
    pub session_id: String,
    pub machine_name: String,
    pub hostname: String,
    pub status: String,
    pub os: String,
    pub agent_version: String,
    pub shell: String,
    pub connected_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct NodeSessionsOutput {
    sessions: Vec<NodeSession>,
    total: u32,
    workspace_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NodeSession {
    session_id: String,
    machine_name: String,
    hostname: String,
    status: String,
    os: String,
    agent_version: String,
    shell: String,
    connected_at: String,
}

/// List terminal sessions via @cmdop/node gRPC SDK.
/// Requires Node.js to be installed and @cmdop/node in node_modules.
#[tauri::command]
pub async fn list_cmdop_sessions(
    api_key: String,
    app: tauri::AppHandle,
) -> Result<Vec<TerminalSession>, String> {
    // Find node_modules path — try project root first, then app resource dir
    let node_modules = find_node_modules(&app)?;

    let script = format!(
        r#"
const {{ CMDOPClient }} = require("{node_modules}/@cmdop/node");
(async () => {{
    try {{
        const client = await CMDOPClient.remote("{api_key}");
        const {{ sessions, total, workspaceName }} = await client.terminal.list();
        const result = {{
            sessions: sessions.map(s => ({{
                sessionId: s.sessionId,
                machineName: s.machineName,
                hostname: s.hostname,
                status: s.status,
                os: s.os,
                agentVersion: s.agentVersion || "",
                shell: s.shell || "",
                connectedAt: s.connectedAt ? s.connectedAt.toISOString() : "",
            }})),
            total,
            workspace_name: workspaceName,
        }};
        console.log(JSON.stringify(result));
        await client.close();
    }} catch (err) {{
        console.error(JSON.stringify({{ error: err.message }}));
        process.exit(1);
    }}
}})();
"#,
        node_modules = node_modules.replace('\\', "\\\\").replace('"', "\\\""),
        api_key = api_key.replace('"', "\\\""),
    );

    let node_bin = find_node_binary()?;

    let output = Command::new(&node_bin)
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| format!("Failed to run node ({}): {}. Is Node.js installed?", node_bin, e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Node script failed: {}", stderr.chars().take(500).collect::<String>()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let parsed: NodeSessionsOutput = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse node output: {} — raw: {}", e, stdout.chars().take(200).collect::<String>()))?;

    Ok(parsed
        .sessions
        .into_iter()
        .map(|s| TerminalSession {
            session_id: s.session_id,
            machine_name: s.machine_name,
            hostname: s.hostname,
            status: s.status,
            os: s.os,
            agent_version: s.agent_version,
            shell: s.shell,
            connected_at: s.connected_at,
        })
        .collect())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRunResult {
    pub text: String,
    pub success: bool,
}

/// Execute a command on a remote machine via agent.run() gRPC.
/// Returns the command output text.
#[tauri::command]
pub async fn cmdop_agent_run(
    api_key: String,
    session_id: String,
    command: String,
    app: tauri::AppHandle,
) -> Result<AgentRunResult, String> {
    let node_modules = find_node_modules(&app)?;

    let script = format!(
        r#"
const {{ CMDOPClient }} = require("{node_modules}/@cmdop/node");
(async () => {{
    try {{
        const client = await CMDOPClient.remote("{api_key}");
        const result = await client.agent.run("{session_id}", {command_json});
        console.log(JSON.stringify({{ text: result.text || "", success: !!result.success }}));
        process.exit(0);
    }} catch (err) {{
        console.error(JSON.stringify({{ error: err.message }}));
        process.exit(1);
    }}
}})();
"#,
        node_modules = node_modules.replace('\\', "\\\\").replace('"', "\\\""),
        api_key = api_key.replace('"', "\\\""),
        session_id = session_id.replace('"', "\\\""),
        command_json = serde_json::to_string(&command).unwrap_or_else(|_| format!("\"{}\"", command)),
    );

    let node_bin = find_node_binary()?;

    let output = Command::new(&node_bin)
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| format!("Failed to run node: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("agent.run failed: {}", stderr.chars().take(500).collect::<String>()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let parsed: AgentRunResult = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse agent.run output: {} — raw: {}", e, stdout.chars().take(200).collect::<String>()))?;

    Ok(parsed)
}

/// Send raw input to a terminal session via gRPC.
#[tauri::command]
pub async fn cmdop_send_input(
    api_key: String,
    session_id: String,
    data: String,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let node_modules = find_node_modules(&app)?;

    let script = format!(
        r#"
const {{ CMDOPClient }} = require("{node_modules}/@cmdop/node");
(async () => {{
    try {{
        const client = await CMDOPClient.remote("{api_key}");
        await client.terminal.sendInput("{session_id}", {data_json});
        console.log("ok");
        process.exit(0);
    }} catch (err) {{
        console.error(err.message);
        process.exit(1);
    }}
}})();
"#,
        node_modules = node_modules.replace('\\', "\\\\").replace('"', "\\\""),
        api_key = api_key.replace('"', "\\\""),
        session_id = session_id.replace('"', "\\\""),
        data_json = serde_json::to_string(&data).unwrap_or_else(|_| format!("\"{}\"", data)),
    );

    let node_bin = find_node_binary()?;

    let output = Command::new(&node_bin)
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| format!("Failed to run node: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("sendInput failed: {}", stderr.chars().take(500).collect::<String>()));
    }

    Ok(())
}

fn find_node_binary() -> Result<String, String> {
    // Common node locations on macOS
    let candidates = [
        "/opt/homebrew/bin/node",   // Homebrew (Apple Silicon)
        "/usr/local/bin/node",      // Homebrew (Intel) / manual install
        "/usr/bin/node",            // System
    ];

    for path in &candidates {
        if std::path::Path::new(path).exists() {
            return Ok(path.to_string());
        }
    }

    // Try PATH via `which node`
    if let Ok(output) = Command::new("/usr/bin/which").arg("node").output() {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() && std::path::Path::new(&path).exists() {
                return Ok(path);
            }
        }
    }

    // Try NVM default
    if let Ok(home) = std::env::var("HOME") {
        let nvm_node = format!("{}/.nvm/versions/node", home);
        if let Ok(entries) = std::fs::read_dir(&nvm_node) {
            // Pick the latest version
            let mut versions: Vec<_> = entries.filter_map(|e| e.ok()).collect();
            versions.sort_by(|a, b| b.file_name().cmp(&a.file_name()));
            if let Some(latest) = versions.first() {
                let node = latest.path().join("bin/node");
                if node.exists() {
                    return Ok(node.to_string_lossy().to_string());
                }
            }
        }
    }

    Err("Node.js not found. Install it: brew install node".to_string())
}

fn find_node_modules(app: &tauri::AppHandle) -> Result<String, String> {
    // Try 1: Project root (dev mode — CWD is project root)
    if let Ok(cwd) = std::env::current_dir() {
        let nm = cwd.join("node_modules");
        if nm.join("@cmdop/node").exists() {
            return Ok(nm.to_string_lossy().to_string());
        }
    }

    // Try 2: Relative to the binary (production — bundled app)
    if let Ok(exe) = std::env::current_exe() {
        // macOS: .app/Contents/MacOS/binary → .app/Contents/Resources/node_modules
        if let Some(parent) = exe.parent() {
            let nm = parent.join("../Resources/node_modules");
            if nm.join("@cmdop/node").exists() {
                return Ok(nm.canonicalize().unwrap_or(nm).to_string_lossy().to_string());
            }
        }
    }

    // Try 3: App resource dir (Tauri API)
    if let Ok(resource_dir) = app.path().resource_dir() {
        let nm: std::path::PathBuf = resource_dir.join("node_modules");
        if nm.join("@cmdop/node").exists() {
            return Ok(nm.to_string_lossy().to_string());
        }
    }

    // Try 4: Build-time project directory (works after `npm run tauri build`)
    {
        let build_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        if let Some(project_root) = build_dir.parent() {
            let nm = project_root.join("node_modules");
            if nm.join("@cmdop/node").exists() {
                return Ok(nm.to_string_lossy().to_string());
            }
        }
    }

    // Try 5: Home directory global node_modules
    if let Ok(home) = std::env::var("HOME") {
        let nm = std::path::PathBuf::from(&home).join("node_modules");
        if nm.join("@cmdop/node").exists() {
            return Ok(nm.to_string_lossy().to_string());
        }
    }

    Err("@cmdop/node not found. Install it: npm install @cmdop/node".to_string())
}
