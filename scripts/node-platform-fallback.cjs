// Node's loader hooks run in an isolated worker. Preloading this file makes
// tsx's temporary-directory lookup portable in restricted Windows sessions
// where uv_os_get_passwd is unavailable.
if (typeof process.geteuid !== "function") {
  process.geteuid = () => 0;
}
