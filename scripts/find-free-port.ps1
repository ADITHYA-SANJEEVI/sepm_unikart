param(
  [int]$Start = 3000,
  [int]$End = 3010
)

for ($port = $Start; $port -le $End; $port++) {
  $listener = $null
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
    $listener.Start()
    $listener.Stop()
    Write-Output $port
    exit 0
  } catch {
    if ($listener) {
      try { $listener.Stop() } catch {}
    }
  }
}

exit 1
