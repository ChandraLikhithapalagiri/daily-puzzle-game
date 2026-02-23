/**
 * main.jsx — Entry point
 *
 * Fonts are loaded via <link> in index.html (NOT here and NOT via @import in CSS).
 * That is the only correct way to load Google Fonts without blocking render.
 */
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(<App />);