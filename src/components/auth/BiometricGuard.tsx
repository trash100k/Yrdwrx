import React, { useState, useEffect } from "react";
import { Fingerprint, Lock, ShieldAlert } from "lucide-react";
import { safeStorage } from "../../lib/storage";

export function BiometricGuard({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if WebAuthn is supported and not nested in a sandboxed iframe
    if (window.PublicKeyCredential && window.self === window.top) {
      setIsSupported(true);
      // Automatically attempt to unlock if credential exists
      const hasInit = safeStorage.getItem("biometric_initialized");
      if (hasInit === "true") {
        try {
          handleUnlock();
        } catch (e) {
          console.error("Biometric auto-unlock failed:", e);
        }
      } else {
        // If not set up yet, require them to set it up
        setIsLocked(true);
      }
    } else {
      setIsSupported(false);
      setIsLocked(false); // Not supported or inside a restricted iframe, bypass to prevent security exceptions
    }
  }, []);

  const handleSetup = async () => {
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const userId = new Uint8Array(16);
      crypto.getRandomValues(userId);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: challenge,
          rp: { name: "YardWorx Field Module", id: window.location.hostname },
          user: {
            id: userId,
            name: "field.staff@company.com",
            displayName: "Field Staff Authorization",
          },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }], // ES256
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
          },
          timeout: 60000,
          attestation: "none",
        },
      });

      if (credential) {
        safeStorage.setItem("biometric_initialized", "true");
        safeStorage.setItem(
          "biometric_credential_id",
          (credential as any).rawId
            ? btoa(
                String.fromCharCode.apply(
                  null,
                  new Uint8Array((credential as any).rawId) as any,
                ),
              )
            : "mock_id",
        );
        setIsLocked(false);
      }
    } catch (err: any) {
      console.error(err);
      if (err.name === "NotAllowedError") {
        setError("Biometric access denied or cancelled.");
      } else {
        setError(err.message || "Failed to setup biometrics.");
      }
    }
  };

  const handleUnlock = async () => {
    setError(null);
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const credIdBase64 = safeStorage.getItem("biometric_credential_id");
      let allowCredentials = [];

      if (credIdBase64 && credIdBase64 !== "mock_id") {
        const binaryString = atob(credIdBase64);
        const credId = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          credId[i] = binaryString.charCodeAt(i);
        }
        allowCredentials.push({
          type: "public-key" as const,
          id: credId,
        });
      }

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: challenge,
          rpId: window.location.hostname,
          allowCredentials:
            allowCredentials.length > 0 ? allowCredentials : undefined,
          userVerification: "required",
        },
      });

      if (assertion) {
        setIsLocked(false);
      }
    } catch (err: any) {
      console.error(err);
      if (err.name === "NotAllowedError") {
        setError("Biometric access was cancelled.");
      } else {
        setError(err.message || "Verification failed. Please try again.");
      }
    }
  };

  if (!isLocked) {
    return <>{children}</>;
  }

  const hasInit = safeStorage.getItem("biometric_initialized") === "true";

  return (
    <div className="fixed inset-0 z-[100] bg-zinc-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-white/10 p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl">
        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Fingerprint className="w-10 h-10 text-emerald-500" />
        </div>

        <h2 className="text-xl font-bold text-white mb-2">
          Secure Field Access
        </h2>
        <p className="text-zinc-400 text-sm mb-8">
          {hasInit
            ? "Please verify your identity using FaceID or TouchID to access sensitive field data."
            : "Setup FaceID or TouchID to secure your field data access."}
        </p>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-left">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {hasInit ? (
          <button
            onClick={handleUnlock}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-4 rounded-xl transition-colors mb-3"
          >
            Unlock with Biometrics
          </button>
        ) : (
          <button
            onClick={handleSetup}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-xl transition-colors mb-3"
          >
            Setup Biometrics
          </button>
        )}

        <button
          onClick={() => {
            // Optional fallback or logout
            window.location.reload();
          }}
          className="w-full bg-transparent hover:bg-white/5 border border-white/10 text-white font-medium py-3 px-4 rounded-xl transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
