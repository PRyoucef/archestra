export interface ParsedMcpConfig {
  command?: string;
  arguments?: string;
  environment?: { key: string; value: string; type: "plain_text" | "secret" }[];
}

export function parseJsonConfig(text: string): ParsedMcpConfig | null {
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== "object") return null;

    let target = data;

    // 1. Check for `archestra_config`
    if (data.archestra_config?.client_config_permutations) {
      const perms = data.archestra_config.client_config_permutations;
      const firstKey = Object.keys(perms)[0];
      if (firstKey) {
        target = perms[firstKey];
      }
    } else if (data.archestra_config && typeof data.archestra_config === "object") {
       // fallback if no permutations but contains command/args directly
       if (data.archestra_config.command || data.archestra_config.arguments || data.archestra_config.args) {
         target = data.archestra_config;
       }
    }
    // 2. Check for `mcpServers` (Claude desktop / Official registry)
    else if (data.mcpServers) {
      const firstKey = Object.keys(data.mcpServers)[0];
      if (firstKey) {
        target = data.mcpServers[firstKey];
      }
    }
    // 3. Check for `servers` (Smithery or similar)
    else if (data.servers) {
      const firstKey = Object.keys(data.servers)[0];
      if (firstKey) {
        target = data.servers[firstKey];
      }
    }
    // 4. Check for arbitrary single top-level key containing the config
    else if (Object.keys(data).length === 1 && typeof data[Object.keys(data)[0]] === "object") {
      target = data[Object.keys(data)[0]];
    }
    
    // Now `target` should have `command`, `args` or `arguments`, `env` or `environment`
    if (!target.command && !target.args && !target.arguments && !target.env && !target.environment) {
       return null; // Doesn't match our expected formats
    }
    
    const result: ParsedMcpConfig = {};
    if (target.command && typeof target.command === "string") {
      result.command = target.command;
    }

    const args = target.args || target.arguments;
    if (Array.isArray(args)) {
      result.arguments = args.join("\n");
    } else if (typeof args === "string") {
      result.arguments = args;
    }

    const env = target.env || target.environment;
    if (env && typeof env === "object" && !Array.isArray(env)) {
      result.environment = Object.entries(env).map(([key, value]) => ({
        key,
        value: String(value),
        type: "plain_text"
      }));
    } else if (Array.isArray(env)) {
      // Handle if it's already an array of {key, value} 
      const validEnv = env.filter((e: any) => e && typeof e.key === "string" && e.value !== undefined);
      if (validEnv.length > 0) {
        result.environment = validEnv.map((e: any) => ({
          key: e.key,
          value: String(e.value),
          type: e.type === "secret" ? "secret" : "plain_text"
        }));
      }
    }

    // Only return if we actually found something useful
    if (result.command || result.arguments || (result.environment && result.environment.length > 0)) {
        return result;
    }

    return null;
  } catch (e) {
    // Silently return null for invalid JSON
    return null;
  }
}
