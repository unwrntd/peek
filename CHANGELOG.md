# Changelog

All notable changes to Peek will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.0.0] - 2026-02-06

### Added
- Initial public release
- 50+ integrations for home lab monitoring
- Multi-dashboard support with drag-and-drop widgets
- Widget groups for organization
- Multiple visualization modes per widget
- Dark/Light/System theme support
- Kiosk mode for wall-mounted displays
- Package export/import for backup and migration
- Image library management
- Built-in documentation
- Dev tools with API explorer
- Network device templates (switches, devices)
- Refresh all widgets button

### Integrations
- **Infrastructure**: Proxmox, QNAP, Beszel, PiKVM, GL.iNet KVM, Kasm, ESXi
- **Networking**: UniFi, UniFi Protect, AdGuard Home, Cisco IOS-XE, NetAlertX, MikroTik, FortiGate, PAN-OS, OPNsense, Tailscale
- **Media**: Plex, Tautulli, Immich, Sonarr, Radarr, Bazarr, Tdarr, Overseerr, Prowlarr
- **Downloads**: SABnzbd, qBittorrent
- **Smart Home**: Home Assistant, Homebridge, HomeKit, Tapo, Kasa, Ring, Home Connect, Sonos, GE SmartHQ, LG ThinQ, Plant.it
- **Productivity**: Notion, GitHub, Gitea, Discord, Slack
- **Cloud**: Microsoft 365, Google Workspace, Storj
- **Other**: Ollama, Node-RED, Actual Budget, Paperless-ngx, Wazuh, Weather, KitchenOwl, Docker, Control D, 1Password

### Security
- Rate limiting on API endpoints
- Security headers (CSP, X-Frame-Options, etc.)
- Request tracing with sanitized logging
- Input validation and parameterized queries
- Encrypted credential storage for package export
