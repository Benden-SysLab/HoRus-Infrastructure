# Download Role

Reusable role for downloading files via HTTP/HTTPS with proxy support and checksum validation.

## Variables
- `download_url`: Source URL (required).
- `download_dest`: Destination path (required).
- `download_checksum`: Expected checksum in format `type:value` (optional).
- `download_retries`: Number of retries (default: 3).
- `download_delay`: Delay between retries in seconds (default: 5).
- `http_proxy`, `https_proxy`, `no_proxy`: Proxy configuration (optional).
