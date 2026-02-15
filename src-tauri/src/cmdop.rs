use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Write;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, Emitter};

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
struct PythonSessionsOutput {
    sessions: Vec<PythonSession>,
    total: u32,
    workspace_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PythonSession {
    session_id: String,
    machine_hostname: String,
    machine_name: String,
    status: String,
    os: String,
    agent_version: String,
    shell: String,
    connected_at: Option<String>,
}

#[derive(Default)]
pub struct CmdopState {
    pub bridges: Arc<Mutex<HashMap<String, Child>>>,
}

#[tauri::command]
pub async fn list_cmdop_sessions(
    api_key: String,
    _app: AppHandle,
) -> Result<Vec<TerminalSession>, String> {
    let python_bin = find_python_binary()?;

    let script = format!(
        r#"
import asyncio
import json
import os
from cmdop import AsyncCMDOPClient

async def list_sessions():
    try:
        async with AsyncCMDOPClient.remote(api_key="{api_key}") as client:
            response = await client.terminal.list_sessions()
            result = {{
                "sessions": [{{
                    "session_id": s.session_id,
                    "machine_hostname": s.machine_hostname,
                    "machine_name": s.machine_name,
                    "status": s.status,
                    "os": s.os,
                    "agent_version": s.agent_version,
                    "shell": s.shell,
                    "connected_at": s.connected_at.isoformat() if s.connected_at else None
                }} for s in response.sessions],
                "total": response.total,
                "workspace_name": response.workspace_name
            }}
            print(json.dumps(result))
    except Exception as e:
        print(json.dumps({{"error": str(e)}}))

if __name__ == "__main__":
    asyncio.run(list_sessions())
"#,
        api_key = api_key.replace('"', "\\\"")
    );

    let output = Command::new(&python_bin)
        .arg("-c")
        .arg(&script)
        .output()
        .map_err(|e| format!("Failed to run python: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Python script failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    if let Ok(error_json) = serde_json::from_str::<serde_json::Value>(&stdout) {
        if let Some(err) = error_json.get("error") {
            return Err(err.as_str().unwrap_or("Unknown python error").to_string());
        }
    }

    let parsed: PythonSessionsOutput = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse python output: {} — raw: {}", e, stdout))?;

    Ok(parsed
        .sessions
        .into_iter()
        .map(|s| TerminalSession {
            session_id: s.session_id,
            machine_name: s.machine_name,
            hostname: s.machine_hostname,
            status: s.status,
            os: s.os,
            agent_version: s.agent_version,
            shell: s.shell,
            connected_at: s.connected_at.unwrap_or_default(),
        })
        .collect())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRunResult {
    pub text: String,
    pub success: bool,
}

#[tauri::command]
pub async fn cmdop_agent_run(
    api_key: String,
    session_id: String,
    command: String,
    _app: AppHandle,
) -> Result<AgentRunResult, String> {
    let python_bin = find_python_binary()?;

    let script = format!(
        r#"
import asyncio
import json
from cmdop import AsyncCMDOPClient

async def run():
    try:
        async with AsyncCMDOPClient.remote(api_key="{api_key}") as client:
            output, code = await client.terminal.execute({command_json}, session_id="{session_id}")
            print(json.dumps({{"text": output.decode('utf-8', errors='replace'), "success": code == 0}}))
    except Exception as e:
        print(json.dumps({{"error": str(e)}}))

if __name__ == "__main__":
    asyncio.run(run())
"#,
        api_key = api_key.replace('"', "\\\""),
        session_id = session_id.replace('"', "\\\""),
        command_json = serde_json::to_string(&command).unwrap()
    );

    let output = Command::new(&python_bin)
        .arg("-c")
        .arg(&script)
        .output()
        .map_err(|e| format!("Failed to run python: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("agent.run failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let parsed: serde_json::Value = serde_json::from_str(&stdout).map_err(|e| e.to_string())?;
    
    if let Some(err) = parsed.get("error") {
        return Err(err.as_str().unwrap_or("Unknown error").to_string());
    }

    Ok(AgentRunResult {
        text: parsed["text"].as_str().unwrap_or("").to_string(),
        success: parsed["success"].as_bool().unwrap_or(false),
    })
}

#[tauri::command]
pub async fn cmdop_start_stream(
    api_key: String,
    session_id: String,
    app: AppHandle,
    state: tauri::State<'_, CmdopState>,
) -> Result<(), String> {
    let python_bin = find_python_binary()?;
    let bridge_script = find_bridge_script(&app)?;

    let mut child = Command::new(&python_bin)
        .arg(bridge_script)
        .arg(&api_key)
        .arg(&session_id)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn bridge: {}", e))?;

    let stdout = child.stdout.take().ok_or("Failed to open stdout")?;
    let session_id_clone = session_id.clone();
    
    // Manage process in state
    {
        let mut bridges = state.bridges.lock().unwrap();
        bridges.insert(session_id.clone(), child);
    }

    // Spawn thread to read stdout and emit events
    let app_handle = app.clone();
    std::thread::spawn(move || {
        use std::io::{BufRead, BufReader};
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(l) = line {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&l) {
                    let event_name = format!("cmdop-event-{}", session_id_clone);
                    let _ = app_handle.emit(&event_name, json);
                }
            } else {
                break;
            }
        }
        // If thread ends, cleanup bridge (but process might still be running or dying)
        println!("[CMDOP] Bridge thread for {} ended", session_id_clone);
    });

    Ok(())
}

#[tauri::command]
pub async fn cmdop_stop_stream(
    session_id: String,
    state: tauri::State<'_, CmdopState>,
) -> Result<(), String> {
    let mut bridges = state.bridges.lock().unwrap();
    if let Some(mut child) = bridges.remove(&session_id) {
        let _ = child.kill();
    }
    Ok(())
}

#[tauri::command]
pub async fn cmdop_send_input(
    session_id: String,
    data: String,
    is_base64: bool,
    state: tauri::State<'_, CmdopState>,
) -> Result<(), String> {
    let mut bridges = state.bridges.lock().unwrap();
    if let Some(child) = bridges.get_mut(&session_id) {
        if let Some(mut stdin) = child.stdin.as_ref() {
            let b64_data = if is_base64 { data } else {
                use base64::{Engine as _, engine::general_purpose};
                general_purpose::STANDARD.encode(data.as_bytes())
            };
            let msg = serde_json::json!({
                "type": "input",
                "data": b64_data
            });
            let _ = writeln!(stdin, "{}", msg.to_string());
            return Ok(());
        }
    }
    Err("Bridge not found or stdin not available".to_string())
}

#[tauri::command]
pub async fn cmdop_resize_terminal(
    session_id: String,
    cols: u16,
    rows: u16,
    state: tauri::State<'_, CmdopState>,
) -> Result<(), String> {
    let mut bridges = state.bridges.lock().unwrap();
    if let Some(child) = bridges.get_mut(&session_id) {
        if let Some(mut stdin) = child.stdin.as_ref() {
            let msg = serde_json::json!({
                "type": "resize",
                "cols": cols,
                "rows": rows
            });
            let _ = writeln!(stdin, "{}", msg.to_string());
            return Ok(());
        }
    }
    Err("Bridge not found".to_string())
}

fn find_python_binary() -> Result<String, String> {
    let candidates = [
        "/opt/homebrew/bin/python3",
        "/usr/local/bin/python3",
        "/usr/bin/python3",
        "python3",
    ];

    for path in &candidates {
        if std::path::Path::new(path).exists() {
            return Ok(path.to_string());
        }
    }

    Ok("python3".to_string())
}

fn find_bridge_script(app: &AppHandle) -> Result<String, String> {
    // Try relative to CWD first (dev mode)
    let dev_path = std::path::Path::new("src-tauri/src/cmdop_bridge.py");
    if dev_path.exists() {
        return Ok(dev_path.to_string_lossy().to_string());
    }

    // Try in resource dir
    if let Ok(resource_dir) = app.path().resource_dir() {
        let script = resource_dir.join("cmdop_bridge.py");
        if script.exists() {
            return Ok(script.to_string_lossy().to_string());
        }
    }

    // Try manifest dir
    let build_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let script = build_dir.join("src/cmdop_bridge.py");
    if script.exists() {
        return Ok(script.to_string_lossy().to_string());
    }

    Err("cmdop_bridge.py not found".to_string())
}

