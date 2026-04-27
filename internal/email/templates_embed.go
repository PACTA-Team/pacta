package email

import "embed"

//go:embed templates/*.html
var templatesFS embed.FS

func LoadTemplate(name string) (string, error) {
	data, err := templatesFS.ReadFile("templates/" + name + ".html")
	if err != nil {
		return "", err
	}
	return string(data), nil
}
