package main

import "embed"

//go:embed all:pacta_appweb/dist
var staticFS embed.FS
