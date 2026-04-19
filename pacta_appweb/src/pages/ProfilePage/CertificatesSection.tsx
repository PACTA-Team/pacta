"use client";

import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { certificateAPI, CertType } from "@/lib/users-api";
import { toast } from "sonner";
import { Upload, FileCheck, FileX, Loader2 } from "lucide-react";

export function CertificatesSection() {
  const { t } = useTranslation("profile");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState<CertType>("digital_signature");

  const handleUploadClick = (certType: CertType) => {
    setSelectedType(certType);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = selectedType === "digital_signature" 
      ? [".p12", ".pfx"] 
      : [".cer", ".crt", ".pem"];

    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!validTypes.includes(ext)) {
      toast.error(t("invalidFileType"));
      return;
    }

    setUploading(true);
    try {
      await certificateAPI.upload(selectedType, file);
      toast.success(t("uploadSuccess"));
    } catch {
      toast.error(t("uploadError"));
    }
    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (certType: CertType) => {
    setUploading(true);
    try {
      await certificateAPI.delete(certType);
      toast.success(t("deleteSuccess"));
    } catch {
      toast.error(t("deleteError"));
    }
    setUploading(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t("certificatesTitle")}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept={selectedType === "digital_signature" ? ".p12,.pfx" : ".cer,.crt,.pem"}
          onChange={handleFileChange}
        />

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <FileCheck className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{t("digitalSignature")}</p>
                <p className="text-xs text-muted-foreground">.p12, .pfx</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete("digital_signature")}
                disabled={uploading}
              >
                <FileX className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={() => handleUploadClick("digital_signature")}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <FileCheck className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{t("publicCert")}</p>
                <p className="text-xs text-muted-foreground">.cer, .crt, .pem</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete("public_cert")}
                disabled={uploading}
              >
                <FileX className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={() => handleUploadClick("public_cert")}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}