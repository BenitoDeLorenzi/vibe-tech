import type { ReactNode } from "react";

export default function PostoLayout({ children }: { children: ReactNode }) {
  return <div data-vibe-frotas="" className="min-h-screen">{children}</div>;
}
