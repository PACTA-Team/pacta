package main

import (
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"syscall"
	"time"
)

const (
	serverURL  = "http://127.0.0.1:3000"
	healthURL  = "http://127.0.0.1:3000/next_api/health"
	maxRetries = 15
	retryDelay = 2 * time.Second
)

func main() {
	// Check if --no-wait flag is provided
	noWait := false
	for _, arg := range os.Args[1:] {
		if arg == "--no-wait" || arg == "-n" {
			noWait = true
			break
		}
	}

	if !noWait {
		// Wait for server to be ready
		if !waitForServer() {
			showError()
			os.Exit(1)
		}
	}

	// Open browser
	openBrowser(serverURL)
}

func waitForServer() bool {
	fmt.Println("Checking PACTA server status...")

	for i := 0; i < maxRetries; i++ {
		resp, err := http.Get(healthURL)
		if err == nil && resp.StatusCode >= 200 && resp.StatusCode < 500 {
			resp.Body.Close()
			fmt.Println("Server is ready!")
			return true
		}

		remaining := maxRetries - i - 1
		if remaining > 0 {
			fmt.Printf("Server not ready, retrying... (%d attempts left)\n", remaining)
			time.Sleep(retryDelay)
		}
	}

	return false
}

func openBrowser(url string) {
	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	case "linux":
		cmd = exec.Command("xdg-open", url)
	default:
		return
	}

	cmd.Start()
}

func showError() {
	// Show a Windows MessageBox since there's no console
	message := "No se pudo conectar al servidor PACTA.\n\n" +
		"Por favor, verifica que el servicio PACTA está en ejecución:\n\n" +
		"1. Espera unos segundos y vuelve a intentarlo\n" +
		"2. Comprueba el servicio en services.msc\n" +
		"3. Revisa los logs en: C:\\Program Files\\PACTA\\shared\\logs\\"

	// Use PowerShell to show MessageBox
	psCmd := fmt.Sprintf(
		`Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('%s', 'PACTA - Error de Conexión', 'OK', 'Error')`,
		strings.ReplaceAll(message, `\`, `\\`),
	)

	cmd := exec.Command("powershell", "-Command", psCmd)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	cmd.Run()
}
