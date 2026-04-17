package email

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/getbrevo/brevo-go/lib"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type MockTransactionalEmailsApi struct {
	mock.Mock
}

func (m *MockTransactionalEmailsApi) SendEmail(ctx context.Context, sendEmailProps lib.SendEmailProps) (lib.SendEmailResponse, error) {
	args := m.Called(ctx, sendEmailProps)
	return args.Get(0).(lib.SendEmailResponse), args.Error(1)
}

func TestSendContractExpiryViaBrevo_Success(t *testing.T) {
	// Setup
	mockAPI := &MockTransactionalEmailsApi{}
	mockClient := &lib.APIClient{}
	mockClient.TransactionalEmailsApi = mockAPI

	bc := &BrevoClient{client: mockClient}

	ctx := context.Background()
	contractID := int64(123)
	recipients := []string{"user@example.com", "admin@example.com"}

	// Expect SendEmail to be called once
	mockAPI.On("SendEmail", mock.Anything, mock.Anything).Return(lib.SendEmailResponse{}, nil)

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
