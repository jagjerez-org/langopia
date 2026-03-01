"use client";

import { useEffect, useState } from "react";

export function WhiteboardPanel() {
  const [Tldraw, setTldraw] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    import("@tldraw/tldraw").then((mod) => {
      setTldraw(() => mod.Tldraw);
    });
  }, []);

  if (!Tldraw) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading whiteboard...
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <Tldraw />
    </div>
  );
}
