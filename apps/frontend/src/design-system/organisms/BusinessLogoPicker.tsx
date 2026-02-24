import { ImagePlus, Trash2, User } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import imageCompression from "browser-image-compression";
import Cropper, { type Area } from "react-easy-crop";
import { Button } from "../atoms/Button";
import { IconButton } from "../atoms/IconButton";
import { Label } from "../atoms/Label";

type BusinessLogoPickerProps = {
  logoUrl: string | null;
  disabled?: boolean;
  removing?: boolean;
  onApplyLogoFile: (file: File) => Promise<void> | void;
  onRemoveLogo?: () => Promise<void> | void;
};

export function BusinessLogoPicker({
  logoUrl,
  disabled = false,
  removing = false,
  onApplyLogoFile,
  onRemoveLogo,
}: BusinessLogoPickerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string>("logo.jpg");
  const [pendingMimeType, setPendingMimeType] = useState<string>("image/jpeg");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  useEffect(() => {
    return () => {
      if (cropSourceUrl) {
        URL.revokeObjectURL(cropSourceUrl);
      }
    };
  }, [cropSourceUrl]);

  const closeCropper = () => {
    setIsCropOpen(false);
    if (cropSourceUrl) {
      URL.revokeObjectURL(cropSourceUrl);
    }
    setCropSourceUrl(null);
    setCroppedAreaPixels(null);
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      event.target.value = "";
      return;
    }

    if (cropSourceUrl) {
      URL.revokeObjectURL(cropSourceUrl);
    }
    setCropSourceUrl(URL.createObjectURL(file));
    setPendingFileName(file.name);
    setPendingMimeType(file.type || "image/jpeg");
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setIsCropOpen(true);
    event.target.value = "";
  };

  const getCroppedFile = async () => {
    if (!cropSourceUrl || !croppedAreaPixels) {
      return null;
    }

    const image = new Image();
    const imageLoaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to load selected image"));
    });
    image.src = cropSourceUrl;
    await imageLoaded;

    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to process selected image");
    }

    const { x, y, width, height } = croppedAreaPixels;
    context.drawImage(image, x, y, width, height, 0, 0, 512, 512);

    const outputType =
      pendingMimeType === "image/png" || pendingMimeType === "image/webp"
        ? pendingMimeType
        : "image/jpeg";
    const extension =
      outputType === "image/png"
        ? "png"
        : outputType === "image/webp"
          ? "webp"
          : "jpg";
    const outputName = pendingFileName.replace(/\.[^.]+$/, "") || "logo";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(
        resolve,
        outputType,
        outputType === "image/jpeg" ? 0.9 : undefined,
      ),
    );
    if (!blob) {
      throw new Error("Unable to process selected image");
    }
    const croppedFile = new File([blob], `${outputName}.${extension}`, {
      type: outputType,
    });
    return imageCompression(croppedFile, {
      maxSizeMB: 1.8,
      maxWidthOrHeight: 512,
      useWebWorker: true,
      fileType: outputType,
      initialQuality: outputType === "image/jpeg" ? 0.9 : undefined,
    });
  };

  const onApplyCrop = async () => {
    try {
      const croppedFile = await getCroppedFile();
      if (!croppedFile) {
        closeCropper();
        return;
      }
      await onApplyLogoFile(croppedFile);
    } finally {
      closeCropper();
    }
  };

  return (
    <>
      {isCropOpen && cropSourceUrl ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/75 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
            <p className="text-sm font-semibold text-slate-800">Adjust logo crop</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Position and zoom to fit the avatar circle.
            </p>
            <div className="relative mt-3 h-72 overflow-hidden rounded-xl bg-slate-900">
              <Cropper
                image={cropSourceUrl}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
              />
            </div>
            <div className="mt-3">
              <Label htmlFor="logo-zoom" className="text-xs text-muted-foreground">
                Zoom
              </Label>
              <input
                id="logo-zoom"
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="mt-1 w-full accent-[#2f6fb7]"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeCropper}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void onApplyCrop()}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="relative h-20 w-20 shrink-0">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-dashed border-slate-300/90 bg-slate-50 ring-1 ring-slate-200/80">
          {logoUrl ? (
            <img src={logoUrl} alt="Business logo" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-500">
              <User className="h-5 w-5" aria-hidden="true" />
              <span className="text-[10px] leading-none">No logo</span>
            </div>
          )}
        </div>
        <IconButton
          icon={ImagePlus}
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="absolute -bottom-2 -left-2 h-7 w-7 rounded-full border border-[#c6d8ef] bg-[#f4f8ff] p-0 text-[#1f4167] shadow-sm hover:bg-[#eaf2ff]"
          aria-label={disabled ? "Uploading logo" : "Upload logo"}
          title={disabled ? "Uploading..." : "Upload logo"}
        />
        {logoUrl && onRemoveLogo ? (
          <IconButton
            icon={Trash2}
            type="button"
            variant="outline"
            onClick={() => {
              void onRemoveLogo();
            }}
            disabled={disabled || removing}
            className="absolute -bottom-2 -right-2 h-7 w-7 rounded-full border border-red-200 bg-red-50 p-0 text-red-700 shadow-sm hover:bg-red-100"
            aria-label={removing ? "Removing logo" : "Remove logo"}
            title={removing ? "Removing..." : "Remove logo"}
          />
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileInputChange}
        />
      </div>
    </>
  );
}
