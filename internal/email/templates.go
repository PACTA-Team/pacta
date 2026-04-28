package email

import (
	"bytes"
	"html/template"
	"log"
)

// EmailTemplate holds localized email content
type EmailTemplate struct {
	Subject string
	HTML    string
}

// GetVerificationTemplate returns the localized verification email template
func GetVerificationTemplate(lang, code string) EmailTemplate {
	tmplStr, err := LoadTemplate("verification")
	if err == nil {
		tmpl, err := template.New("verification").Parse(tmplStr)
		if err == nil {
			data := map[string]string{
				"Code":       code,
				"ExpiryText": "This code expires in 5 minutes.",
				"FooterText": "If you didn't request this, ignore this email.",
			}
			switch lang {
			case "es":
				data["Title"] = "Verifica tu cuenta de PACTA"
				data["Instruction"] = "Ingresa este código para completar tu registro:"
				data["ExpiryText"] = "Este código expira en 5 minutos."
				data["FooterText"] = "Si no solicitaste esto, ignora este correo."
			default: // "en"
				data["Title"] = "Verify Your PACTA Account"
				data["Instruction"] = "Enter this code to complete your registration:"
			}
			var buf bytes.Buffer
			tmpl.Execute(&buf, data)
			subject := data["Title"]
			if lang == "es" {
				subject = "Tu código de verificación de PACTA"
			}
			return EmailTemplate{
				Subject: subject,
				HTML:    buf.String(),
			}
		}
	}

	// Fallback to simple HTML if template loading fails
	log.Printf("[email] failed to load verification template: %v", err)
	switch lang {
	case "es":
		return EmailTemplate{
			Subject: "Tu código de verificación de PACTA",
			HTML:    "<html><body><p>Ingresa el código enviado a tu correo para completar tu registro.</p></body></html>",
		}
	default: // "en"
		return EmailTemplate{
			Subject: "Your PACTA Verification Code",
			HTML:    "<html><body>Please use the verification code sent to your email.</body></html>",
		}
	}
}

// GetPasswordResetTemplate returns the localized password reset email template
func GetPasswordResetTemplate(lang, resetLink, userName string) EmailTemplate {
	tmplStr, err := LoadTemplate("password_reset")
	if err == nil {
		tmpl, err := template.New("password_reset").Parse(tmplStr)
		if err == nil {
			data := map[string]string{
				"ResetLink":   resetLink,
				"ExpiryText":  "This link expires in 30 minutes.",
				"IgnoreText":   "If you didn't request this, ignore this email.",
				"FooterText":  "If you didn't request this, ignore this email.",
			}
			switch lang {
			case "es":
				data["Title"] = "Restablecer Contraseña de PACTA"
				data["Greeting"] = "Hola " + userName + ","
				data["Instruction"] = "Haz clic en el siguiente enlace para restablecer tu contraseña:"
				data["ExpiryText"] = "Este enlace expira en 30 minutos."
				data["IgnoreText"] = "Si no solicitaste esto, ignora este correo."
				data["FooterText"] = "Si no solicitaste esto, ignora este correo."
			default: // "en"
				data["Title"] = "Reset Your PACTA Password"
				data["Greeting"] = "Hi " + userName + ","
				data["Instruction"] = "Click the link below to reset your password:"
			}
			var buf bytes.Buffer
			tmpl.Execute(&buf, data)
			subject := data["Title"]
			if lang == "es" {
				subject = "Restablecer contraseña de PACTA"
			}
			return EmailTemplate{
				Subject: subject,
				HTML:    buf.String(),
			}
		}
	}

	// Fallback
	return EmailTemplate{
		Subject: "Reset Your PACTA Password",
		HTML:    "<html><body>Password reset: " + resetLink + "</body></html>",
	}
}

// GetAdminNotificationTemplate returns the localized admin notification template
func GetAdminNotificationTemplate(lang, userName, userEmail, companyName string) EmailTemplate {
	tmplStr, err := LoadTemplate("admin_notification")
	if err == nil {
		tmpl, err := template.New("admin_notification").Parse(tmplStr)
		if err == nil {
			data := map[string]string{
				"UserName":    userName,
				"UserEmail":   userEmail,
				"CompanyName": companyName,
			}
			switch lang {
			case "es":
				data["Title"] = "Nueva solicitud de registro"
				data["NameLabel"] = "Nombre"
				data["EmailLabel"] = "Correo"
				data["CompanyLabel"] = "Empresa"
				data["ActionText"] = "Inicia sesión en PACTA como administrador para revisar y aprobar este registro."
				data["FooterText"] = "PACTA - Gestión de contratos"
			default: // "en"
				data["Title"] = "New User Registration Pending"
				data["NameLabel"] = "Name"
				data["EmailLabel"] = "Email"
				data["CompanyLabel"] = "Company"
				data["ActionText"] = "Log in to PACTA as admin to review and approve this registration."
				data["FooterText"] = "PACTA - Contract Management"
			}
			var buf bytes.Buffer
			tmpl.Execute(&buf, data)
			subject := data["Title"]
			if lang == "es" {
				subject = "Nueva solicitud de registro pendiente"
			}
			return EmailTemplate{
				Subject: subject,
				HTML:    buf.String(),
			}
		}
	}

	// Fallback
	log.Printf("[email] failed to load admin notification template: %v", err)
	switch lang {
	case "es":
		return EmailTemplate{
			Subject: "Nueva solicitud de registro pendiente",
			HTML:    "<html><body><p>Nueva solicitud de registro pendiente. Inicia sesión en PACTA para revisar.</p></body></html>",
		}
	default: // "en"
		return EmailTemplate{
			Subject: "New User Registration Pending",
			HTML:    "<html><body>New user registration pending. Log in to PACTA to review.</body></html>",
		}
	}
}

// GetContractExpiryTemplate returns the contract expiry notification template
func GetContractExpiryTemplate(contractNumber, daysLeft, expiryDate, contractName, clientName, companyName, contractID, adminEmail string) EmailTemplate {
	tmplStr, err := LoadTemplate("contract_expiry")
	if err == nil {
		tmpl, err := template.New("contract_expiry").Parse(tmplStr)
		if err == nil {
			data := map[string]string{
				"ContractNumber": contractNumber,
				"DaysLeft":       daysLeft,
				"ExpiryDate":    expiryDate,
				"ContractName":   contractName,
				"ClientName":     clientName,
				"CompanyName":    companyName,
				"ContractID":     contractID,
				"AdminEmail":     adminEmail,
				"Title":          "Contract Expiry Notice",
				"FooterText":      "PACTA - Contract Management",
			}
			var buf bytes.Buffer
			tmpl.Execute(&buf, data)
			return EmailTemplate{
				Subject: "Contract " + contractNumber + " Expiry Notice",
				HTML:    buf.String(),
			}
		}
	}

	// Fallback
	return EmailTemplate{
		Subject: "Contract Expiry Notice",
		HTML:    "<html><body>Contract " + contractNumber + " expires in " + daysLeft + " days.</body></html>",
	}
}

// GetReportTemplate returns the report email template
func GetReportTemplate(reportDate string) EmailTemplate {
	tmplStr, err := LoadTemplate("report")
	if err == nil {
		tmpl, err := template.New("report").Parse(tmplStr)
		if err == nil {
			data := map[string]string{
				"ReportDate": reportDate,
				"Title":      "PACTA Report",
				"FooterText": "PACTA - Contract Management",
			}
			var buf bytes.Buffer
			tmpl.Execute(&buf, data)
			return EmailTemplate{
				Subject: "PACTA Report - " + reportDate,
				HTML:    buf.String(),
			}
		}
	}

	// Fallback
	return EmailTemplate{
		Subject: "PACTA Report",
		HTML:    "<html><body>Report date: " + reportDate + "</body></html>",
	}
}
