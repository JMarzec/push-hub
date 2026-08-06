import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

interface AvatarPickerProps {
  userId: string;
  avatarUrl: string | null;
  initials: string;
  hasAvatar: boolean;
  onUploaded: (path: string) => void;
  onRemove: () => void;
  busy?: boolean;
}

/**
 * Uploads straight from the browser into the private `avatars` bucket under
 * `<userId>/...`, then hands the storage path to the server so the profile row
 * records it and a signed URL comes back.
 */
export function AvatarPicker({
  userId,
  avatarUrl,
  initials,
  hasAvatar,
  onUploaded,
  onRemove,
  busy,
}: AvatarPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (!ALLOWED.includes(file.type)) {
      toast.error("Use a PNG, JPEG or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image is too large — keep it under 3MB.");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw new Error(error.message);
      onUploaded(path);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const pending = uploading || busy;

  return (
    <div className="flex items-center gap-4">
      <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-lg font-extrabold text-primary-foreground">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Your profile photo"
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <span aria-hidden="true">{initials}</span>
        )}
        {pending ? (
          <span className="absolute inset-0 flex items-center justify-center bg-foreground/50">
            <Loader2 className="size-5 animate-spin text-card" aria-hidden="true" />
          </span>
        ) : null}
      </span>

      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-label="Upload a profile photo"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <Button
          variant="outline"
          className="h-10 rounded-full font-bold"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="size-4" aria-hidden="true" />
          {hasAvatar ? "Change photo" : "Add photo"}
        </Button>
        {hasAvatar ? (
          <Button
            variant="ghost"
            className="h-10 rounded-full font-bold text-destructive"
            disabled={pending}
            onClick={onRemove}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}
