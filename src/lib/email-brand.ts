import path from "node:path";

export const emailFontFamily = "'Manrope', Arial, Helvetica, sans-serif";
export const emailFontHead = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">';

const logoCid = "vibe-tech-logo@vibetechsistemas.com";

export const emailLogoHtml = `<img src="cid:${logoCid}" width="230" height="40" alt="Vibe Tech" style="display:block;width:230px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;color:#ffffff;font-size:20px;font-weight:700;">`;

export function emailLogoAttachment() {
  return {
    filename: "vibe-tech-logo.png",
    path: path.join(process.cwd(), "public", "brand", "vibe-tech-horizontal.png"),
    cid: logoCid,
    contentType: "image/png",
    contentDisposition: "inline" as const,
  };
}
