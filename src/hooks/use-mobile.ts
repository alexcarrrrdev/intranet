import * as React from "react"

const MOBILE_BREAKPOINT = 768

// useSyncExternalStore évite d'appeler setState de façon synchrone dans un
// effet (voir react-hooks/set-state-in-effect) tout en restant sûr côté SSR.
function subscribe(onChange: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

function getSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
