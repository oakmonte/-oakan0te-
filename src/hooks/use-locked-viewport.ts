import { useEffect } from "react";

// Toggles a body class that locks page scroll for as long as the calling
// route is mounted, restoring normal scroll behavior automatically when
// the user navigates away. See the .oak-locked-viewport rule in styles.css.
export function useLockedViewport() {
  useEffect(() => {
    document.body.classList.add("oak-locked-viewport");
    return () => {
      document.body.classList.remove("oak-locked-viewport");
    };
  }, []);
}