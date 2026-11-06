import "./globals.css";

export const metadata = {
  title: "RAG Chat",
  description: "A ChatGPT-style chatbot that answers from your documents (RAG)",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
