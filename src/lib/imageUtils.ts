export function compressImage(file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.7): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const rawDataUrl = event.target?.result as string;
            if (!rawDataUrl) {
                reject(new Error("Empty reader result"));
                return;
            }
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = Math.round(width);
                canvas.height = Math.round(height);
                const ctx = canvas.getContext("2d");
                
                if (!ctx) {
                    resolve(rawDataUrl);
                    return;
                }
                
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                try {
                    const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
                    resolve(compressedDataUrl);
                } catch (err) {
                    // Safari taint fallback
                    console.warn("Canvas toDataURL failed during compressImage", err);
                    resolve(rawDataUrl);
                }
            };
            img.onerror = () => reject(new Error("Failed to load image for compression"));
            img.src = rawDataUrl;
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
    });
}
