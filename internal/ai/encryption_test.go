package ai

import (
	"strings"
	"testing"
)

func TestEncryptDecryptAPIKey(t *testing.T) {
	// Initialize encryption key (in production, this comes from env)
	SetEncryptionKey([]byte("test-key-123456789012345678901234")) // 32 bytes

	originalKey := "sk-abcdefghijklmnopqrstuvwxyz123456"

	// Encrypt
	encrypted, err := EncryptAPIKey(originalKey)
	if err != nil {
		t.Fatalf("failed to encrypt: %v", err)
	}

	// Encrypted should not contain original key
	if strings.Contains(encrypted, originalKey) {
		t.Error("encrypted string should not contain original key")
	}

	// Decrypt
	decrypted, err := DecryptAPIKey(encrypted)
	if err != nil {
		t.Fatalf("failed to decrypt: %v", err)
	}

	// Should match original
	if decrypted != originalKey {
		t.Errorf("expected %s, got %s", originalKey, decrypted)
	}
}

func TestDecryptInvalidData(t *testing.T) {
	SetEncryptionKey([]byte("test-key-123456789012345678901234"))

	_, err := DecryptAPIKey("invalid-base64!")
	if err == nil {
		t.Error("expected error for invalid base64")
	}
}

func TestEncryptEmptyKey(t *testing.T) {
	SetEncryptionKey([]byte("test-key-123456789012345678901234"))

	_, err := EncryptAPIKey("")
	if err == nil {
		t.Error("expected error for empty key")
	}
}
