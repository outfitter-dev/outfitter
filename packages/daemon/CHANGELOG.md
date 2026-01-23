# Changelog

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
