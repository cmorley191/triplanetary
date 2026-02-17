import * as React from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/app';

const container = document.getElementById("app");
if (container === null) {
  console.error("Cannot render app to null container.");
} else {
  createRoot(container).render(<App />);
}
