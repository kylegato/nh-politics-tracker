// wrangler.toml
name = "nh-legislative-tracker"
compatibility_date = "2023-12-01"
main = "src/api-gateway-improved.js"

# KV Namespaces
kv_namespaces = [
  { binding = "NH_LEGISLATIVE_DATA", id = "YOUR_KV_ID_HERE", preview_id = "YOUR_PREVIEW_KV_ID_HERE" },
  { binding = "NH_LEGISLATIVE_METADATA", id = "YOUR_KV_ID_HERE", preview_id = "YOUR_PREVIEW_KV_ID_HERE" }
]

# Workers AI binding
[ai]
binding = "AI"

# Schedule for the data collection worker
[triggers]
crons = ["0 */4 * * *"] # Every 4 hours

# Environment variables
[vars]
ENVIRONMENT = "production"
NH_STATE_CODE = "nh"
VERSION = "1.0.0"

# Secrets that need to be set
# - OPENSTATES_API_KEY: Your OpenStates API key
# - API_KEY: Protected API endpoints key

# Routes configuration
[[routes]]
pattern = "api.nh-legislative-tracker.com/*"
zone_id = "YOUR_ZONE_ID_HERE"

# Development configuration
[dev]
port = 8787
local_protocol = "http"
ip = "localhost"

# Build configuration
[build]
command = "npm run build"
watch_dir = "src"

# Worker size and limits
[limits]
cpu_ms = 50  # CPU time limit in ms (Unbound usage tier)
memory_mb = 128  # Memory limit in MB
log_retention_days = 30  # Days to retain logs

# Performance configuration
[performance]
kv_batch_size = 100  # Batch size for KV operations
force_https = true  # Force HTTPS

# Environment-specific configurations
[env.production]
route = "api.nh-legislative-tracker.com/*"
kv_namespaces = [
  { binding = "NH_LEGISLATIVE_DATA", id = "YOUR_PROD_KV_ID_HERE" },
  { binding = "NH_LEGISLATIVE_METADATA", id = "YOUR_PROD_KV_ID_HERE" }
]
vars = { ENVIRONMENT = "production" }

[env.staging]
route = "staging-api.nh-legislative-tracker.com/*"
kv_namespaces = [
  { binding = "NH_LEGISLATIVE_DATA", id = "YOUR_STAGING_KV_ID_HERE" },
  { binding = "NH_LEGISLATIVE_METADATA", id = "YOUR_STAGING_KV_ID_HERE" }
]
vars = { ENVIRONMENT = "staging" }

[env.development]
vars = { ENVIRONMENT = "development" }

# Configure npm modules to bundle
[build.upload]
format = "modules"
main = "./src/api-gateway-improved.js"
dir = "./dist"

# Define additional worker for data collection
[[services]]
name = "nh-data-collector"
routes = []
main = "src/updated-bill-analysis-integration.js"
compatibility_date = "2023-12-01"

# KV namespaces for data collector
kv_namespaces = [
  { binding = "NH_LEGISLATIVE_DATA", id = "YOUR_KV_ID_HERE", preview_id = "YOUR_PREVIEW_KV_ID_HERE" },
  { binding = "NH_LEGISLATIVE_METADATA", id = "YOUR_KV_ID_HERE", preview_id = "YOUR_PREVIEW_KV_ID_HERE" }
]

# AI binding for data collector
[services.ai]
binding = "AI"

# Schedule for data collector
[services.triggers]
crons = ["0 */6 * * *"] # Every 6 hours
