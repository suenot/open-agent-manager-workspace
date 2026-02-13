/// List available SSH private keys from ~/.ssh/
#[tauri::command]
pub fn list_ssh_keys() -> Vec<String> {
    let home = match std::env::var("HOME") {
        Ok(h) => h,
        Err(_) => return vec![],
    };

    let ssh_dir = std::path::PathBuf::from(&home).join(".ssh");
    if !ssh_dir.is_dir() {
        return vec![];
    }

    let entries = match std::fs::read_dir(&ssh_dir) {
        Ok(e) => e,
        Err(_) => return vec![],
    };

    let mut keys: Vec<String> = entries
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            let path = e.path();
            // Must be a file
            if !path.is_file() {
                return false;
            }
            // Skip .pub files, known_hosts, config, authorized_keys, agent sockets
            if name.ends_with(".pub")
                || name == "known_hosts"
                || name == "known_hosts.old"
                || name == "config"
                || name == "authorized_keys"
                || name == "environment"
                || name.starts_with(".")
            {
                return false;
            }
            true
        })
        .map(|e| {
            // Return absolute path so frontend doesn't need to expand ~
            e.path().to_string_lossy().to_string()
        })
        .collect();

    keys.sort();
    keys
}
