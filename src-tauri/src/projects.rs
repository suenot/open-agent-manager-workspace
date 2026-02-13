use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteConfig {
    #[serde(rename = "type", default)]
    pub remote_type: Option<String>, // "cmdop" | "ssh"
    // CMDOP fields
    pub machine: Option<String>,
    pub remote_path: String,
    // SSH fields
    pub host: Option<String>,
    pub user: Option<String>,
    pub port: Option<u16>,
    pub identity_file: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(default = "default_icon")]
    pub icon: String,
    pub description: Option<String>,
    #[serde(default)]
    pub env_vars: HashMap<String, String>,
    pub remote: Option<RemoteConfig>,
    pub cli: Option<String>,
}

fn default_icon() -> String {
    "📁".to_string()
}

/// Get the path to projects.json in app data dir, creating it if needed
fn projects_file(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    // Ensure directory exists
    std::fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Failed to create data dir: {}", e))?;

    let file_path = data_dir.join("projects.json");

    // If file doesn't exist, create it with empty array
    if !file_path.exists() {
        std::fs::write(&file_path, "[]")
            .map_err(|e| format!("Failed to create projects.json: {}", e))?;
    }

    Ok(file_path)
}

#[tauri::command]
pub fn get_projects(app_handle: tauri::AppHandle) -> Result<Vec<Project>, String> {
    let file_path = projects_file(&app_handle)?;
    let content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read {}: {}", file_path.display(), e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse projects.json: {}", e))
}

#[tauri::command]
pub fn add_project(app_handle: tauri::AppHandle, project: Project) -> Result<Vec<Project>, String> {
    let file_path = projects_file(&app_handle)?;
    let mut projects = get_projects(app_handle.clone())?;

    // Check for duplicate path
    if projects.iter().any(|p| p.path == project.path) {
        return Err(format!("Project with path '{}' already exists", project.path));
    }

    projects.push(project);
    let json = serde_json::to_string_pretty(&projects)
        .map_err(|e| format!("Failed to serialize: {}", e))?;
    std::fs::write(&file_path, json)
        .map_err(|e| format!("Failed to write: {}", e))?;

    Ok(projects)
}

#[tauri::command]
pub fn remove_project(app_handle: tauri::AppHandle, project_id: String) -> Result<Vec<Project>, String> {
    let file_path = projects_file(&app_handle)?;
    let mut projects = get_projects(app_handle)?;

    projects.retain(|p| p.id != project_id);

    let json = serde_json::to_string_pretty(&projects)
        .map_err(|e| format!("Failed to serialize: {}", e))?;
    std::fs::write(&file_path, json)
        .map_err(|e| format!("Failed to write: {}", e))?;

    Ok(projects)
}
