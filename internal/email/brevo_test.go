package email

import (
	"context"
	"os"
	"testing"
	"time"

	brevo "github.com/getbrevo/brevo-go/lib"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type MockTransactionalEmailsApi struct {
	mock.Mock
}

// SendTransacEmail matches the brevo-go v1.0.0+ signature
func (m *MockTransactionalEmailsApi) SendTransacEmail(ctx context.Context, sendSmtpEmail brevo.SendSmtpEmail) (brevo.CreateSmtpEmail, error) {
	args := m.Called(ctx, sendSmtpEmail)
	return args.Get(0).(brevo.CreateSmtpEmail), args.Error(1)
}

func TestSendContractExpiryViaBrevo_Success(t *testing.T) {
	// Setup
	mockAPI := &MockTransactionalEmailsApi{}
	mockClient := &brevo.APIClient{}
	mockClient.TransactionalEmailsApi = mockAPI

	bc := &BrevoClient{client: mockClient}

	ctx := context.Background()
	contractID := int64(123)
	recipients := []string{"user@example.com", "admin@example.com"}

	// Expect SendTransacEmail to be called once
	mockAPI.On("SendTransacEmail", mock.Anything, mock.Anything).Return(brevo.CreateSmtpEmail{}, nil)

	// Call
	err := bc.SendContractExpiryViaBrevo(
		ctx,
		"CNT-2025-0042",
		7,
		time.Date(2025, 5, 15, 0, 0, 0, 0, time.UTC),
		"Service Agreement v2",
		"Acme Corp",
		"PACTA Inc",
		contractID,
		recipients,
		"admin@pacta.com",
	)

	// Assert
	assert.NoError(t, err)
	mockAPI.AssertExpectations(t)
}
