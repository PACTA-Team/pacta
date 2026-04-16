package email

// EmailTemplate holds localized email content
type EmailTemplate struct {
	Subject string
	HTML    string
}

// GetVerificationTemplate returns the localized verification email template
func GetVerificationTemplate(lang, code string) EmailTemplate {
	switch lang {
	case "es":
		return EmailTemplate{
			Subject: "Tu código de verificación de PACTA",
			HTML: verificationEmailHTML(code,
				"Verifica tu cuenta de PACTA",
				"Ingresa este código para completar tu registro:",
				"Este código expira en 5 minutos.",
				"Si no solicitaste esto, ignora este correo.",
			),
		}
	default: // "en"
		return EmailTemplate{
			Subject: "Your PACTA Verification Code",
			HTML: verificationEmailHTML(code,
				"Verify Your PACTA Account",
				"Enter this code to complete your registration:",
				"This code expires in 5 minutes.",
				"If you didn't request this, ignore this email.",
			),
		}
	}
}

// GetAdminNotificationTemplate returns the localized admin notification template
func GetAdminNotificationTemplate(lang, userName, userEmail, companyName string) EmailTemplate {
	switch lang {
	case "es":
		return EmailTemplate{
			Subject: "Nueva solicitud de registro pendiente",
			HTML: adminNotificationHTML(
				"Nueva solicitud de registro",
				"Nombre", userName,
				"Correo", userEmail,
				"Empresa", companyName,
				"Inicia sesión en PACTA como administrador para revisar y aprobar este registro.",
			),
		}
	default: // "en"
		return EmailTemplate{
			Subject: "New User Registration Pending Approval",
			HTML: adminNotificationHTML(
				"New User Registration Pending",
				"Name", userName,
				"Email", userEmail,
				"Company", companyName,
				"Log in to PACTA as admin to review and approve this registration.",
			),
		}
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
