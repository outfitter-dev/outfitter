# Changelog

## 0.2.2

### Patch Changes

- Updated dependencies [d683522]
- Updated dependencies [d683522]
  - @outfitter/contracts@0.3.0
  - @outfitter/logging@0.4.0
  - @outfitter/file-ops@0.2.1

## 0.2.1

### Patch Changes

- Updated dependencies [0c099bc]
  - @outfitter/logging@0.3.0

## 0.2.0

### Minor Changes

- Version alignment for v0.2.0 release

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @outfitter/contracts@0.2.0
  - @outfitter/logging@0.2.0
  - @outfitter/file-ops@0.2.0

## 0.1.0

### Minor Changes

- Release v0.1.0 - First stable release

  This release graduates from release candidate to stable, consolidating all packages at v0.1.0.

  Key changes in this release cycle:

  - Plugin system with registry for Claude Code integration
  - Tooling CLI with upgrade-bun and pre-push commands
  - Renamed stack package to kit
  - GitHub issue templates and label system

### Patch Changes

- 7522622: Fix npm publish to resolve workspace:\* dependencies to actual version numbers
- Updated dependencies [4f58c46]
- Updated dependencies [4f58c46]
- Updated dependencies [7522622]
- Updated dependencies
  - @outfitter/contracts@0.1.0
  - @outfitter/file-ops@0.1.0
  - @outfitter/logging@0.1.0

## 0.1.0-rc.4

### Minor Changes

- Release v0.1.0 - First stable release

  This release graduates from release candidate to stable, consolidating all packages at v0.1.0.

  Key changes in this release cycle:

  - Plugin system with registry for Claude Code integration
  - Tooling CLI with upgrade-bun and pre-push commands
  - Renamed stack package to kit
  - GitHub issue templates and label system

### Patch Changes

- Updated dependencies
  - @outfitter/contracts@0.1.0-rc.3
  - @outfitter/logging@0.1.0-rc.4
  - @outfitter/file-ops@0.1.0-rc.4

## 0.1.0-rc.3

### Patch Changes

- 7522622: Fix npm publish to resolve workspace:\* dependencies to actual version numbers
- Updated dependencies [7522622]
  - @outfitter/file-ops@0.1.0-rc.3
  - @outfitter/logging@0.1.0-rc.3

## 0.1.0-rc.2

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @outfitter/contracts@0.1.0-rc.2
  - @outfitter/file-ops@0.1.0-rc.2
  - @outfitter/logging@0.1.0-rc.2

## [0.1.0] - 2026-01-23

### Added

- Initial release
- Platform detection and path resolution (`isUnixPlatform`, `getSocketPath`, `getLockPath`, `getPidPath`, `getDaemonDir`)
- PID-based locking with stale detection (`acquireDaemonLock`, `releaseDaemonLock`)
- Process liveness checking (`isProcessAlive`, `isDaemonAlive`, `readLockPid`)
- Daemon lifecycle management (`createDaemon`) with:
  - PID file handling
  - Signal handling (SIGTERM, SIGINT)
  - Graceful shutdown with configurable timeout
  - Shutdown handler registration
- IPC via Unix domain sockets:
  - `createIpcServer` for daemon-side message handling
  - `createIpcClient` for client-side communication
  - JSON-serialized request/response protocol
- Health check system:
  - `createHealthChecker` for aggregated health status
  - Parallel check execution
  - Runtime check registration
  - Uptime tracking
- Error types:
  - `DaemonError` for lifecycle operations
  - `StaleSocketError`, `ConnectionRefusedError`, `ConnectionTimeoutError`, `ProtocolError` for IPC
- `LockError` for lock acquisition failures
- `DaemonConnectionError` union type for exhaustive matching

### Changed

- Align package versions to 0.1.0

### Dependencies

- Updated dependencies
  - @outfitter/contracts@0.1.0
  - @outfitter/file-ops@0.1.0
  - @outfitter/logging@0.1.0
