package config

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"runtime"

	"github.com/PACTA-Team/pacta/internal/models"
)

const (
	AppName     = "PACTA"
	DefaultPort = 3000
)

var AppVersion = "0.46.3"

// RAGConfig holds configuration for Retrieval-Augmented Generation
type RAGConfig struct {
    Mode              string `env:"RAG_MODE" default:"external"`
    LocalMode         string `env:"RAG_LOCAL_MODE" default:"cgo"`
    LocalModel        string `env:"RAG_LOCAL_MODEL" default:"qwen2.5-0.5b-instruct-q4_0.gguf"`
    EmbeddingModel    string `env:"RAG_EMBEDDING_MODEL" default:"all-minilm-l6-v2"`
    HybridStrategy    string `env:"RAG_HYBRID_STRATEGY" default:"local-first"`
    HybridRerank      bool   `env:"RAG_HYBRID_RERANK" default:"true"`
}

type Config struct {
	Addr             string
	DataDir          string
	Version          string
	AIEncryptionKey  string `env:"AI_ENCRYPTION_KEY"` // AES key for encrypting AI API keys (16/24/32 bytes)
	RAG              RAGConfig
}

func Default() *Config {
	dataDir := defaultDataDir()
	addr := os.Getenv("BIND_ADDRESS")
	if addr == "" {
		addr = fmt.Sprintf("127.0.0.1:%d", DefaultPort)
	}
	aiKey := os.Getenv("AI_ENCRYPTION_KEY")
	return &Config{
		Addr:             addr,
		DataDir:          dataDir,
		Version:          AppVersion,
		AIEncryptionKey:  aiKey,
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

// Service extends Config with a DB connection and helper methods
type Service struct {
	*Config
	DB *sql.DB
}

// GetUserByID retrieves a user by ID including company_id
func (s *Service) GetUserByID(id int64) (*models.User, error) {
	u := &models.User{}
	err := s.DB.QueryRow(`
		SELECT id, email, name, role, status, company_id, created_at, updated_at
		FROM users WHERE id = ? AND deleted_at IS NULL
	`, id).Scan(&u.ID, &u.Email, &u.Name, &u.Role, &u.Status, &u.CompanyID, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

// GetUsersByCompanyAndRole retrieves active users by company ID and role
func (s *Service) GetUsersByCompanyAndRole(companyID int64, role string) ([]models.User, error) {
	rows, err := s.DB.Query(`
		SELECT id, email, name, role, status, company_id, created_at, updated_at
		FROM users
		WHERE company_id = ? AND role = ? AND status = 'active' AND deleted_at IS NULL
		ORDER BY id
	`, companyID, role)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.Role, &u.Status, &u.CompanyID, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

// Validate validates the configuration
func (c *Config) Validate() error {
	// AI encryption key validation
	if c.AIEncryptionKey != "" {
		lenKey := len(c.AIEncryptionKey)
		if lenKey != 16 && lenKey != 24 && lenKey != 32 {
			return fmt.Errorf("AI_ENCRYPTION_KEY must be 16, 24, or 32 bytes for AES, got %d", lenKey)
		}
	}
	// No error if empty - AI features are optional
	return nil
}
