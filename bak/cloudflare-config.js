// wrangler.toml
name = "legislative-tracker"
main = "src/api-gateway.js"
compatibility_date = "2023-05-18"

# Configure KV namespaces
kv_namespaces = [
  { binding = "LEGISLATIVE_DATA", id = "YOUR_KV_ID_HERE", preview_id = "YOUR_PREVIEW_KV_ID_HERE" },
  { binding = "LEGISLATIVE_METADATA", id = "YOUR_KV_ID_HERE", preview_id = "YOUR_PREVIEW_KV_ID_HERE" }
]

# Optional: Configure D1 database (if needed for future expansion)
# [[d1_databases]]
# binding = "LEGISLATIVE_DB"
# database_name = "legislative-tracker"
# database_id = "YOUR_D1_ID_HERE"

# Configure scheduled triggers for data collector
[triggers]
crons = ["0 */6 * * *"] # Run every 6 hours

# Configure environment variables
[vars]
ENVIRONMENT = "production"

# Secrets that need to be set:
# - OPENSTATES_API_KEY: Your OpenStates API key

# Routes
[[routes]]
pattern = "api.yourdomain.com/*"
zone_id = "YOUR_ZONE_ID_HERE"

# Dev configuration
[dev]
port = 8787
local_protocol = "http"

# Build for data-collector worker
[build]
command = "npm run build"

# Environment-specific configurations
[env.production]
route = "api.yourdomain.com/*"
kv_namespaces = [
  { binding = "LEGISLATIVE_DATA", id = "YOUR_PROD_KV_ID_HERE" },
  { binding = "LEGISLATIVE_METADATA", id = "YOUR_PROD_KV_ID_HERE" }
]

[env.staging]
route = "staging-api.yourdomain.com/*"
kv_namespaces = [
  { binding = "LEGISLATIVE_DATA", id = "YOUR_STAGING_KV_ID_HERE" },
  { binding = "LEGISLATIVE_METADATA", id = "YOUR_STAGING_KV_ID_HERE" }
]
