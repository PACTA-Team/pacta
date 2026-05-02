package email

import (
	"context"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/wneessen/go-mail"
)

func TestGetSMTPConfig(t *testing.T) {
	// Test with nil DB (uses default values)
	cfg, err := GetSMTPConfig(context.Background(), nil)
	assert.NoError(t, err)

	assert.Equal(t, "smtp.mailtrap.io", cfg.Host)
	assert.Equal(t, 587, cfg.Port)
	assert.Equal(t, "PACTA <noreply@pacta.duckdns.org>", cfg.From)
	assert.Empty(t, cfg.User)
	assert.Empty(t, cfg.Pass)
}

func TestGetSMTPConfig_WithEnv(t *testing.T) {
	// Set environment variables
	os.Setenv("MAILTRAP_SMTP_USER", "env_user")
	os.Setenv("MAILTRAP_SMTP_PASS", "env_pass")
	os.Setenv("MAILTRAP_SMTP_HOST", "smtp.env.com")
	defer os.Unsetenv("MAILTRAP_SMTP_USER")
	defer os.Unsetenv("MAILTRAP_SMTP_PASS")
	defer os.Unsetenv("MAILTRAP_SMTP_HOST")

	cfg, err := GetSMTPConfig(context.Background(), nil)
	assert.NoError(t, err)

	assert.Equal(t, "smtp.env.com", cfg.Host)
	assert.Equal(t, "env_user", cfg.User)
	assert.Equal(t, "env_pass", cfg.Pass)
}

func TestSendWithMailtrap_MissingCredentials(t *testing.T) {
	cfg := SMTPConfig{
		Host: "smtp.mailtrap.io",
		Port: 587,
		User: "",
		Pass: "",
		From: "test@example.com",
	}

	msg := mail.NewMsg()
	_ = msg.From(cfg.From)
	_ = msg.To("to@example.com")
	msg.Subject("Test")
	msg.SetBodyString(mail.TypeTextPlain, "Test body")

	ctx := context.Background()
	err := SendWithMailtrap(ctx, msg, cfg)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "credentials not configured")
}

func TestSendWithMailtrap_InvalidCredentials(t *testing.T) {
	cfg := SMTPConfig{
		Host: "smtp.mailtrap.io",
		Port: 587,
		User: "invalid_user",
		Pass: "invalid_pass",
		From: "test@example.com",
	}

	msg := mail.NewMsg()
	_ = msg.From(cfg.From)
	_ = msg.To("to@example.com")
	msg.Subject("Test")
	msg.SetBodyString(mail.TypeTextPlain, "Test body")

	ctx := context.Background()
	err := SendWithMailtrap(ctx, msg, cfg)
	// This should fail with authentication error (expected in test)
	assert.Error(t, err)
	t.Logf("Send result (expected failure in test env): %v", err)
}