import type { JSX as ReactJSX } from 'react'


declare global {
  // React 19 ya no define el espacio JSX global; se reexporta para mantener el codigo legible.
  namespace JSX {
    type Element = ReactJSX.Element
  }
}
