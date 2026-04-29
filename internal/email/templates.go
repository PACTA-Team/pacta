package email

import (
	"bytes"
	"html/template"
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

	// Fallback to inline HTML if template loading fails
	switch lang {
	case "es":
		return EmailTemplate{
			Subject: "Tu código de verificación de PACTA",
			HTML:    verificationEmailHTML(code, "Verifica tu cuenta de PACTA", "Ingresa este código para completar tu registro:", "Este código expira en 5 minutos.", "Si no solicitaste esto, ignora este correo."),
		}
	default: // "en"
		return EmailTemplate{
			Subject: "Your PACTA Verification Code",
			HTML:    verificationEmailHTML(code, "Verify Your PACTA Account", "Enter this code to complete your registration:", "This code expires in 5 minutes.", "If you didn't request this, ignore this email."),
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
				"ExpiryText":  "This link expires in 1 hour.",
				"IgnoreText":   "If you didn't request this, ignore this email.",
				"FooterText":  "If you didn't request this, ignore this email.",
			}
			switch lang {
			case "es":
				data["Title"] = "Restablecer Contraseña de PACTA"
				data["Greeting"] = "Hola " + userName + ","
				data["Instruction"] = "Haz clic en el siguiente enlace para restablecer tu contraseña:"
				data["ExpiryText"] = "Este enlace expira en 1 hora."
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
	switch lang {
	case "es":
		return EmailTemplate{
			Subject: "Nueva solicitud de registro pendiente",
			HTML:    adminNotificationHTML("Nueva solicitud de registro", "Nombre", userName, "Correo", userEmail, "Empresa", companyName, "Inicia sesión en PACTA como administrador para revisar y aprobar este registro."),
		}
	default: // "en"
		return EmailTemplate{
			Subject: "New User Registration Pending Approval",
			HTML:    adminNotificationHTML("New User Registration Pending", "Name", userName, "Email", userEmail, "Company", companyName, "Log in to PACTA as admin to review and approve this registration."),
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

func verificationEmailHTML(code, title, instruction, expiry, ignore string) string {
	return `<html><body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#1a1a1a">` + title + `</h2>
        <p>` + instruction + `</p>
        <div style="background:#f5f5f5;padding:20px;text-align:center;font-size:32px;font-weight:bold;letter-spacing:8px;border-radius:8px;margin:20px 0">` + code + `</div>
        <p style="color:#666;font-size:14px">` + expiry + `</p>
        <p style="color:#666;font-size:12px">` + ignore + `</p>
    </body></html>`
}

func adminNotificationHTML(title, nameLabel, userName, emailLabel, userEmail, companyLabel, companyName, action string) string {
	return `<html><body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#1a1a1a">` + title + `</h2>
        <p><strong>` + nameLabel + `:</strong> ` + userName + `</p>
        <p><strong>` + emailLabel + `:</strong> ` + userEmail + `</p>
        <p><strong>` + companyLabel + `:</strong> ` + companyName + `</p>
        <p style="margin-top:20px">` + action + `</p>
    </body></html>`
}
