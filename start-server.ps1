# Simple HTTP Server for Velora Website
param(
    [int]$Port = 3000
)

Add-Type -AssemblyName System.Net

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()

Write-Host "HTTP Server running at http://localhost:$Port" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow

$currentPath = Get-Location

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $path = $request.Url.AbsolutePath
        if ($path -eq '/') { $path = '/index.html' }
        
        $filePath = Join-Path $currentPath $path.TrimStart('/')
        
        if (Test-Path $filePath -PathType Leaf) {
            $content = Get-Content $filePath -Raw -Encoding UTF8
            
            # Set content type based on file extension
            $extension = [System.IO.Path]::GetExtension($filePath).ToLower()
            switch ($extension) {
                '.html' { $response.ContentType = 'text/html; charset=utf-8' }
                '.js'   { $response.ContentType = 'application/javascript' }
                '.css'  { $response.ContentType = 'text/css' }
                '.json' { $response.ContentType = 'application/json' }
                '.png'  { $response.ContentType = 'image/png' }
                '.jpg'  { $response.ContentType = 'image/jpeg' }
                '.jpeg' { $response.ContentType = 'image/jpeg' }
                '.gif'  { $response.ContentType = 'image/gif' }
                default { $response.ContentType = 'text/plain' }
            }
            
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($content)
            $response.ContentLength64 = $buffer.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        } else {
            $errorContent = "404 - File Not Found: $path"
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($errorContent)
            $response.ContentLength64 = $buffer.Length
            $response.StatusCode = 404
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        }
        
        $response.OutputStream.Close()
        
        # Log the request
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        Write-Host "[$timestamp] $($request.HttpMethod) $($request.Url.AbsolutePath) - $($response.StatusCode)" -ForegroundColor Cyan
    }
} finally {
    $listener.Stop()
    Write-Host "Server stopped." -ForegroundColor Red
}