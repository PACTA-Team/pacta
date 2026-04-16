package config

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
)

const (
	AppName     = "PACTA"
	DefaultPort = 3000
)

var AppVersion = "0.35.0"

type Config struct {
	Addr    string
	DataDir string
	Version string
}

func Default() *Config {
	dataDir := defaultDataDir()
	return &Config{
		Addr:    fmt.Sprintf(":%d", DefaultPort),
		DataDir: dataDir,
		Version: AppVersion,
	}
}

func defaultDataDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		home = os.TempDir()
	}
	switch runtime.GOOS {
	case "windows":
		localAppData := os.Getenv("LOCALAPPDATA")
		if localAppData == "" {
			localAppData = filepath.Join(home, "AppData", "Local")
		}
		return filepath.Join(localAppData, AppName, "data")
	case "darwin":
		return filepath.Join(home, "Library", "Application Support", AppName, "data")
	default:
		dataHome := os.Getenv("XDG_DATA_HOME")
		if dataHome == "" {
			dataHome = filepath.Join(home, ".local", "share")
		}
		return filepath.Join(dataHome, "pacta", "data")
	}
}
