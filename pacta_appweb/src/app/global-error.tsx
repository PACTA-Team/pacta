"use client";

import Error from "next/error";

export default function GlobalError({ error }: { error?: Error }) {
  return (
    <html lang="en">
      <body>
        <h1>Something went wrong</h1>
        <pre style={{ whiteSpace: 'pre-wrap' }}>
          {(error as any)?.message || 'An unexpected error occurred'}
        </pre>
        <Error statusCode={500} />
      </body>
    </html>
  );
}
